/* =====================================================================
   ANÁLISE PRÉ FATURA
   Lê a aba "Lost pack" das planilhas de pré fatura, organiza por quinzena
   (1ª e 2ª) e monta as análises de regionais, bases e motoristas ofensores.
   ===================================================================== */
(function () {
  'use strict';

  var LS_KEY = 'spot_prefatura_v1';
  var MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  var REGIONALS = ['ESPÍRITO SANTO', 'MINAS GERAIS', 'BAHIA', 'SÃO PAULO', 'RIO DE JANEIRO', 'OUTRAS', 'SEM BASE'];
  var REGIONAL_SHORT = { 'ESPÍRITO SANTO': 'ES', 'MINAS GERAIS': 'MG', 'BAHIA': 'BA', 'SÃO PAULO': 'SP', 'RIO DE JANEIRO': 'RJ', 'OUTRAS': 'Outras', 'SEM BASE': 'Sem base' };
  var REGIONAL_COLORS = { 'MINAS GERAIS': '#8dc63f', 'ESPÍRITO SANTO': '#26c6da', 'RIO DE JANEIRO': '#ffd700', 'SÃO PAULO': '#b388ff', 'BAHIA': '#ff8a3d', 'OUTRAS': '#29b6f6', 'SEM BASE': '#8a8a8a' };
  var PALETTE = ['#8dc63f', '#ff9800', '#ff5252', '#e040fb', '#29b6f6', '#ffd700', '#26a69a', '#a8de4a', '#7e57c2', '#ec407a', '#66bb6a', '#42a5f5'];

  var state = {
    imports: [],
    entries: [],
    keys: [],
    filters: { from: '', to: '', regional: 'TODOS', base: 'TODAS', tipo: 'TODOS', search: '', preset: 'tudo' },
    page: 'geral',
    driverMin: 0,
    driverTop: '20',
    driverRepeat: false,
    driverSort: 'valor',
    tempoAgrup: 'mes',
    tempoModo: 'total',
    tempoMetrica: 'valor',
    tempoAcumulado: false,
    baseDetail: null,
    driverDetail: null
  };
  var charts = {};

  /* ---------------------------------------------------------------- utils */
  function $(id) { return document.getElementById(id); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function normKey(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function fmtBRL(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function fmtInt(v) { return (Number(v) || 0).toLocaleString('pt-BR'); }
  function fmtPct(v, digits) { return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits == null ? 1 : digits, maximumFractionDigits: digits == null ? 1 : digits }) + '%'; }
  function fmtShortBRL(v) {
    var n = Number(v) || 0;
    if (Math.abs(n) >= 1000000) return 'R$ ' + (n / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return 'R$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }
  function toNumber(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim().replace(/[R$\s]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.indexOf(',') > -1) s = s.replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function isoFromDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseDateValue(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return isoFromDate(v);
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      var y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      return y + '-' + pad2(+m[2]) + '-' + pad2(+m[1]);
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    return '';
  }
  function dateBR(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function downloadCsv(filename, rows) {
    var csv = '\ufeff' + rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  /* ------------------------------------------------------- base/regional */
  function normBase(v) {
    var b = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, '');
    if (!b) return '';
    if (/^(NAN|NONE|NULL|-)$/.test(b)) return '';
    return b;
  }
  function isUnassignedBase(base) { return /^(BRN|BRX|BRD)(?:\d|$)/i.test(String(base || '')); }
  var UF_REGION = { ES: 'ESPÍRITO SANTO', MG: 'MINAS GERAIS', BA: 'BAHIA', SP: 'SÃO PAULO', RJ: 'RIO DE JANEIRO' };
  function regionalFromBase(base) {
    var b = (base || '').toUpperCase();
    if (!b) return 'SEM BASE';
    if (b.indexOf('BR') === 0 && b.length >= 4) {
      var uf = b.slice(2, 4);
      if (UF_REGION[uf]) return UF_REGION[uf];
      return 'OUTRAS';
    }
    if (/^(SES|EES|EBA)/.test(b)) return 'ESPÍRITO SANTO';
    if (/^(SMG|EMG)/.test(b)) return 'MINAS GERAIS';
    if (/^SBA/.test(b)) return 'BAHIA';
    if (/^(SRJ|ERJ)/.test(b)) return 'RIO DE JANEIRO';
    if (/^SSP/.test(b)) return 'SÃO PAULO';
    if (/^E[A-Z]/.test(b)) return 'OUTRAS';
    return 'OUTRAS';
  }
  function tipoFromBase(base, tipoRaw) {
    var t = String(tipoRaw == null ? '' : tipoRaw).trim().toUpperCase();
    if (t === 'SVC' || t === 'XPT') return t;
    var b = (base || '').toUpperCase();
    if (!b) return 'N/D';
    if (/^S/.test(b) || b.indexOf('BR') === 0) return 'SVC';
    if (/^E/.test(b)) return 'XPT';
    return 'N/D';
  }

  /* ------------------------------------------------------------ quinzena */
  function qKey(year, month, q) { return year + '-' + pad2(month) + '-Q' + q; }
  function qParts(key) {
    var p = String(key || '').split('-');
    return { year: +p[0], month: +p[1], q: +String(p[2] || 'Q1').replace('Q', '') || 1 };
  }
  function qLabel(key) {
    var p = qParts(key);
    if (!p.year || !p.month) return key;
    return (p.q === 1 ? '1ª' : '2ª') + ' quinzena · ' + MONTH_ABBR[p.month - 1] + '/' + p.year;
  }
  function qShort(key) {
    var p = qParts(key);
    return (p.q === 1 ? '1ªQ' : '2ªQ') + ' ' + MONTH_ABBR[p.month - 1] + '/' + String(p.year).slice(2);
  }
  function monthLabel(monthKey) {
    var p = String(monthKey).split('-');
    return MONTH_ABBR[+p[1] - 1] + '/' + p[0];
  }
  function sortKeys(keys) {
    return keys.slice().sort(function (a, b) {
      var pa = qParts(a), pb = qParts(b);
      return (pa.year - pb.year) || (pa.month - pb.month) || (pa.q - pb.q);
    });
  }
  function packageNameFromDescription(description, fallback) {
    var text = String(description || '');
    var named = text.match(/(?:PACOTE\s+PERDIDO|LOST\s+PACKAGES?\s+PENALTY)\s*:?\s*([A-Z0-9]{5,})/i);
    if (named) return named[1].toUpperCase();
    return String(fallback || '').trim() || '—';
  }
  function packageNumberFromDescription(description, fallback) {
    var number = String(description || '').match(/\b4\d{9,}\b/);
    return number ? number[0] : (String(fallback || '').trim() || '—');
  }
  function logisticUrl(number) {
    var n = String(number || '').replace(/\D/g, '');
    return n && n.length >= 8 ? 'https://envios.adminml.com/logistics/package-management/package/' + encodeURIComponent(n) : '';
  }
  function allQuinzenaKeysBetween(first, last) {
    var a = qParts(first), b = qParts(last), out = [];
    if (!a.year || !a.month || !b.year || !b.month) return [];
    var start = a.year * 12 + a.month - 1, end = b.year * 12 + b.month - 1;
    if (start > end || (start === end && a.q > b.q)) { var tmp = a; a = b; b = tmp; start = a.year * 12 + a.month - 1; end = b.year * 12 + b.month - 1; }
    for (var cursor = start; cursor <= end; cursor++) {
      var year = Math.floor(cursor / 12), month = cursor % 12 + 1;
      if (cursor === start && a.q === 2) out.push(qKey(year, month, 2));
      else { out.push(qKey(year, month, 1)); out.push(qKey(year, month, 2)); }
    }
    var lastKey = qKey(b.year, b.month, b.q);
    return out.filter(function (k) { return sortKeys([k, lastKey])[1] === lastKey || k === lastKey; }).filter(function (k) {
      var p = qParts(k); return (p.year * 12 + p.month - 1 < b.year * 12 + b.month - 1) || (p.year === b.year && p.month === b.month && p.q <= b.q);
    });
  }
  function monthFromText(text) {
    var t = normKey(text);
    for (var i = 0; i < MONTHS.length; i++) {
      if (t.indexOf(MONTHS[i]) > -1) return i + 1;
    }
    var abbr = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    for (var j = 0; j < abbr.length; j++) {
      if (new RegExp('(^|[^a-z])' + abbr[j] + '([^a-z]|$)').test(t)) return j + 1;
    }
    return 0;
  }
  function quinzenaFromText(text) {
    var t = normKey(text);
    var m = t.match(/(?:^|[^0-9])([12])\s*(?:a|o|º|ª)?\s*(?:q\b|quinzena)/);
    if (m) return +m[1];
    m = t.match(/q\s*([12])\b/);
    if (m) return +m[1];
    m = t.match(/quinzena\s*([12])\b/);
    if (m) return +m[1];
    return 0;
  }

  /* -------------------------------------------------------------- storage */
  function normalizeImport(raw) {
    var rows = Array.isArray(raw.rows) ? raw.rows : [];
    return {
      id: raw.id || ('pf-' + Math.random().toString(36).slice(2, 9)),
      fileName: raw.fileName || 'planilha',
      sheetName: raw.sheetName || 'Lost pack',
      quinzena: raw.quinzena || '',
      importedAt: raw.importedAt || new Date().toISOString(),
      rows: rows,
      total: Number(raw.total) || rows.reduce(function (a, r) { return a + (Number(r[4]) || 0); }, 0),
      count: rows.length
    };
  }
  function loadStore() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && Array.isArray(data.imports)) state.imports = data.imports.map(normalizeImport);
    } catch (e) { console.warn('Pré fatura: não foi possível ler o armazenamento.', e); }
  }
  function saveStore() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, imports: state.imports }));
      return true;
    } catch (e) {
      console.error(e);
      alert('Não foi possível salvar no navegador (armazenamento cheio). Exclua planilhas antigas e tente novamente.');
      return false;
    }
  }
  function buildEntries() {
    var out = [];
    state.imports.forEach(function (imp) {
      (imp.rows || []).forEach(function (r) {
        var rawBase = normBase(r[0]);
        var base = isUnassignedBase(rawBase) ? '' : rawBase;
        var baseName = String(r[9] != null && r[9] !== '' ? r[9] : (r[0] || rawBase)).trim() || 'SEM BASE';
        var value = Number(r[4]) || 0;
        if (!value && !base) return;
        var driver = String(r[2] || '').trim() || 'NÃO INFORMADO';
        out.push({
          imp: imp.id,
          q: imp.quinzena,
          base: base || 'SEM BASE',
          baseName: baseName,
          regional: regionalFromBase(base),
          tipo: tipoFromBase(base, r[1]),
          driver: driver,
          driverKey: normKey(driver),
          plate: r[3] || '',
          value: value,
          date: r[5] || '',
          pkg: r[6] || '',
          route: r[7] || '',
          description: String(r[8] || '').trim(),
          packageName: packageNameFromDescription(String(r[8] || ''), r[6] || ''),
          packageNumber: packageNumberFromDescription(String(r[8] || ''), r[6] || '')
        });
      });
    });
    state.entries = out;
    var importedKeys = sortKeys(Array.from(new Set(state.imports.map(function (i) { return i.quinzena; }).filter(Boolean))));
    state.keys = importedKeys.length ? allQuinzenaKeysBetween(importedKeys[0], importedKeys[importedKeys.length - 1]) : [];
  }

  /* ------------------------------------------------------------- filtros */
  function activeKeys() {
    var from = state.filters.from, to = state.filters.to;
    if (!state.keys.length) return [];
    var i0 = state.keys.indexOf(from), i1 = state.keys.indexOf(to);
    if (i0 < 0) i0 = 0;
    if (i1 < 0) i1 = state.keys.length - 1;
    if (i1 < i0) { var t = i0; i0 = i1; i1 = t; }
    return state.keys.slice(i0, i1 + 1);
  }
  function previousKeys() {
    var i0 = state.keys.indexOf(state.filters.from);
    var i1 = state.keys.indexOf(state.filters.to);
    if (i0 < 0 || i1 < 0) return [];
    if (i1 < i0) { var t = i0; i0 = i1; i1 = t; }
    var len = i1 - i0 + 1;
    var start = i0 - len;
    if (start < 0) return state.keys.slice(0, i0);
    return state.keys.slice(start, i0);
  }
  function baseFilters(keys) {
    var set = new Set(keys);
    var f = state.filters;
    var search = normKey(f.search);
    return state.entries.filter(function (e) {
      if (!set.has(e.q)) return false;
      if (f.regional !== 'TODOS' && e.regional !== f.regional) return false;
      if (f.base !== 'TODAS' && e.base !== f.base) return false;
      if (f.tipo !== 'TODOS' && e.tipo !== f.tipo) return false;
      if (search) {
        if (e.driverKey.indexOf(search) === -1 && normKey(e.base).indexOf(search) === -1 && String(e.pkg).indexOf(search) === -1) return false;
      }
      return true;
    });
  }
  function filteredEntries() { return baseFilters(activeKeys()); }
  function previousEntries() { return baseFilters(previousKeys()); }
  function sumValue(list) { return list.reduce(function (a, e) { return a + e.value; }, 0); }

  function groupBy(list, keyFn, labelFn) {
    var map = new Map();
    list.forEach(function (e) {
      var k = keyFn(e);
      if (k === undefined || k === null || k === '') return;
      var g = map.get(k);
      if (!g) {
        g = { key: k, label: labelFn ? labelFn(e) : k, value: 0, count: 0, drivers: new Set(), names: new Map(), bases: new Set(), regions: new Set(), qs: new Set() };
        map.set(k, g);
      }
      g.value += e.value;
      g.count += 1;
      g.drivers.add(e.driverKey);
      g.names.set(e.driver, (g.names.get(e.driver) || 0) + 1);
      g.bases.add(e.baseName || e.base);
      g.regions.add(e.regional);
      g.qs.add(e.q);
    });
    return map;
  }
  function bestName(g) {
    var best = g.label, n = -1;
    g.names.forEach(function (c, name) { if (c > n) { n = c; best = name; } });
    return best;
  }
  function variation(current, previous) {
    if (!previous) return null;
    return (current - previous) / previous * 100;
  }
  function varHtml(pct) {
    if (pct == null) return '<span class="pf-var flat">—</span>';
    var cls = pct > 0.05 ? 'up' : (pct < -0.05 ? 'down' : 'flat');
    var sign = pct > 0.05 ? '+' : '';
    return '<span class="pf-var ' + cls + '">' + sign + fmtPct(pct) + '</span>';
  }

  /* --------------------------------------------------------------- temas */
  function isLight() { return document.documentElement.classList.contains('theme-light'); }
  function tickColor() { return isLight() ? '#2b3552' : '#a3a3a3'; }
  function gridColor() { return isLight() ? 'rgba(11,18,38,.12)' : 'rgba(255,255,255,.10)'; }
  function legendColor() { return isLight() ? '#0b1226' : '#e8e8e8'; }

  function drawChart(id, cfg) {
    var el = $(id);
    if (!el) return;
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    var opts = cfg.options || (cfg.options = {});
    opts.responsive = true;
    opts.maintainAspectRatio = false;
    opts.plugins = opts.plugins || {};
    opts.plugins.legend = opts.plugins.legend || { labels: { color: legendColor(), boxWidth: 12, boxHeight: 12, usePointStyle: true, font: { size: 11 } } };
    opts.plugins.tooltip = opts.plugins.tooltip || {};
    opts.plugins.tooltip.backgroundColor = isLight() ? 'rgba(255,255,255,.97)' : 'rgba(8,14,32,.95)';
    opts.plugins.tooltip.titleColor = isLight() ? '#0b1226' : '#fff';
    opts.plugins.tooltip.bodyColor = isLight() ? '#2b3552' : '#dfe6ff';
    opts.plugins.tooltip.borderColor = isLight() ? 'rgba(11,18,38,.15)' : 'rgba(255,255,255,.18)';
    opts.plugins.tooltip.borderWidth = 1;
    opts.plugins.tooltip.padding = 10;
    opts.layout = Object.assign({ padding: { left: 6, right: 8, top: 4, bottom: 2 } }, opts.layout || {});
    var circular = cfg.type === 'doughnut' || cfg.type === 'pie';
    if (circular) {
      /* rosca/pizza não têm eixos: qualquer escala desenharia réguas vazias */
      opts.scales = {};
    } else if (opts.indexAxis === 'y' || (cfg.options && cfg.options.indexAxis === 'y')) {
      opts.scales = opts.scales || {};
      opts.scales.x = Object.assign({ beginAtZero: true, grid: { color: gridColor(), drawBorder: false }, ticks: { color: tickColor(), font: { size: 10 }, callback: function (v) { return fmtShortBRL(v); } } }, opts.scales.x || {});
      opts.scales.y = Object.assign({ grid: { display: false }, ticks: { color: tickColor(), font: { size: 11 } } }, opts.scales.y || {});
    } else {
      opts.scales = opts.scales || {};
      opts.scales.x = Object.assign({ grid: { display: false }, ticks: { color: tickColor(), font: { size: 10 }, maxRotation: 0, autoSkip: false } }, opts.scales.x || {});
      opts.scales.y = Object.assign({ beginAtZero: true, grid: { color: gridColor(), drawBorder: false }, ticks: { color: tickColor(), font: { size: 10 }, callback: function (v) { return fmtShortBRL(v); } } }, opts.scales.y || {});
    }
    charts[id] = new Chart(el.getContext('2d'), cfg);
  }
  function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  /* ------------------------------------------------------- filtros (UI) */
  function fillSelect(el, options, value) {
    if (!el) return;
    el.innerHTML = options.map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>'; }).join('');
    if (value != null && options.some(function (o) { return o.value === value; })) el.value = value;
  }
  function renderFilterOptions() {
    var fromSel = $('pfFrom'), toSel = $('pfTo');
    var keyOpts = state.keys.map(function (k) { return { value: k, label: qLabel(k) }; });
    if (!keyOpts.length) keyOpts = [{ value: '', label: 'Nenhuma quinzena importada' }];
    fillSelect(fromSel, keyOpts, state.filters.from || state.keys[0] || '');
    fillSelect(toSel, keyOpts, state.filters.to || state.keys[state.keys.length - 1] || '');
    if (state.keys.length) {
      if (state.keys.indexOf(state.filters.from) < 0) state.filters.from = state.keys[0];
      if (state.keys.indexOf(state.filters.to) < 0) state.filters.to = state.keys[state.keys.length - 1];
      fromSel.value = state.filters.from;
      toSel.value = state.filters.to;
    }

    var regs = Array.from(new Set(state.entries.map(function (e) { return e.regional; })));
    regs.sort(function (a, b) { return REGIONALS.indexOf(a) - REGIONALS.indexOf(b); });
    fillSelect($('pfRegional'), [{ value: 'TODOS', label: 'Todas as regionais' }].concat(regs.map(function (r) {
      return { value: r, label: r + ' (' + REGIONAL_SHORT[r] + ')' };
    })), state.filters.regional);

    var bases = Array.from(new Set(state.entries.filter(function (e) {
      return state.filters.regional === 'TODOS' || e.regional === state.filters.regional;
    }).map(function (e) { return e.base; })));
    bases.sort();
    fillSelect($('pfBase'), [{ value: 'TODAS', label: 'Todas as bases' }].concat(bases.map(function (b) { return { value: b, label: b }; })), state.filters.base);
    if (state.filters.base !== 'TODAS' && bases.indexOf(state.filters.base) === -1) {
      state.filters.base = 'TODAS';
      $('pfBase').value = 'TODAS';
    }

    document.querySelectorAll('#pfTipoToggle .toggle-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tipo === state.filters.tipo);
    });
    document.querySelectorAll('#pfPresets .preset-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.preset === state.filters.preset);
    });
    $('pfSearch').value = state.filters.search;
  }
  function applyPreset(name) {
    if (!state.keys.length) return;
    state.filters.preset = name;
    var last = state.keys[state.keys.length - 1];
    if (name === 'tudo') {
      state.filters.from = state.keys[0];
      state.filters.to = last;
    } else if (name === 'ultima') {
      state.filters.from = last;
      state.filters.to = last;
    } else {
      var n = parseInt(name, 10) || 3;
      var p = qParts(last);
      var d = new Date(p.year, p.month - 1 - (n - 1), 1);
      var minMonth = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
      var inWindow = state.keys.filter(function (k) { return k.slice(0, 7) >= minMonth; });
      state.filters.from = inWindow[0] || state.keys[0];
      state.filters.to = last;
    }
    $('pfFrom').value = state.filters.from;
    $('pfTo').value = state.filters.to;
    document.querySelectorAll('#pfPresets .preset-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.preset === name);
    });
  }

  /* ------------------------------------------------------------ visão geral */
  function renderGeral() {
    var list = filteredEntries();
    var prev = previousEntries();
    var total = sumValue(list);
    var prevTotal = sumValue(prev);
    var drivers = new Set(list.map(function (e) { return e.driverKey; }));
    var bases = new Set(list.map(function (e) { return e.base; }));
    var qs = activeKeys();

    $('pfKpiValor').textContent = fmtBRL(total);
    $('pfKpiPacotes').textContent = fmtInt(list.length);
    $('pfKpiBases').textContent = fmtInt(bases.size);
    $('pfKpiMotoristas').textContent = fmtInt(drivers.size);
    $('pfKpiTicket').textContent = fmtBRL(list.length ? total / list.length : 0);

    var vVar = variation(total, prevTotal);
    $('pfKpiValorDelta').className = 'pf-delta ' + (vVar == null ? '' : (vVar > 0 ? 'up' : (vVar < 0 ? 'down' : '')));
    $('pfKpiValorDelta').innerHTML = vVar == null ? '<span class="pf-delta-lbl">sem período anterior</span>' :
      (vVar > 0 ? '▲ ' : (vVar < 0 ? '▼ ' : '')) + fmtPct(Math.abs(vVar)) + '<span class="pf-delta-lbl">vs período anterior</span>';

    var pVar = variation(list.length, prev.length);
    $('pfKpiPacotesDelta').className = 'pf-delta ' + (pVar == null ? '' : (pVar > 0 ? 'up' : (pVar < 0 ? 'down' : '')));
    $('pfKpiPacotesDelta').innerHTML = pVar == null ? '<span class="pf-delta-lbl">sem período anterior</span>' :
      (pVar > 0 ? '▲ ' : (pVar < 0 ? '▼ ' : '')) + fmtPct(Math.abs(pVar)) + '<span class="pf-delta-lbl">vs período anterior</span>';

    var byBase = groupBy(list, function (e) { return e.base; });
    var topBase = Array.from(byBase.values()).sort(function (a, b) { return b.value - a.value; })[0];
    $('pfKpiBasesFoot').textContent = topBase ? 'Maior: ' + topBase.key + ' · ' + fmtBRL(topBase.value) : '—';

    var byDriver = groupBy(list, function (e) { return e.driverKey; }, function (e) { return e.driver; });
    var topDriver = Array.from(byDriver.values()).sort(function (a, b) { return b.value - a.value; })[0];
    $('pfKpiMotoristasFoot').textContent = topDriver ? 'Maior: ' + bestName(topDriver) + ' · ' + fmtBRL(topDriver.value) : '—';
    $('pfKpiTicketFoot').textContent = 'Média por pacote no período';

    var svc = list.filter(function (e) { return e.tipo === 'SVC'; }).reduce(function (a, e) { return a + e.value; }, 0);
    var xpt = list.filter(function (e) { return e.tipo === 'XPT'; }).reduce(function (a, e) { return a + e.value; }, 0);
    var impCount = state.imports.filter(function (i) { return qs.indexOf(i.quinzena) > -1; }).length;
    $('pfHeroChips').innerHTML =
      '<span class="pf-chip">Quinzenas <b>' + qs.length + '</b></span>' +
      '<span class="pf-chip">Planilhas <b>' + impCount + '</b></span>' +
      '<span class="pf-chip">SVC <b>' + fmtBRL(svc) + '</b></span>' +
      '<span class="pf-chip">XPT <b>' + fmtBRL(xpt) + '</b></span>';

    var periodTxt = qs.length ? (qs.length === 1 ? qLabel(qs[0]) : qLabel(qs[0]) + ' até ' + qLabel(qs[qs.length - 1])) : 'Sem planilhas importadas.';
    var filterBits = [];
    if (state.filters.regional !== 'TODOS') filterBits.push(state.filters.regional);
    if (state.filters.base !== 'TODAS') filterBits.push('base ' + state.filters.base);
    if (state.filters.tipo !== 'TODOS') filterBits.push(state.filters.tipo);
    if (state.filters.search) filterBits.push('busca "' + state.filters.search + '"');
    $('pfPeriodLabel').innerHTML = esc(periodTxt) + (filterBits.length ? ' · <strong>' + esc(filterBits.join(' · ')) + '</strong>' : '') +
      ' · ' + fmtInt(list.length) + ' pacote(s) · ' + fmtBRL(total);

    /* gráfico por quinzena */
    var byQ = groupBy(list, function (e) { return e.q; });
    var qLabels = qs.map(qShort);
    var qValues = qs.map(function (k) { var g = byQ.get(k); return g ? g.value : 0; });
    drawChart('pfChartQuinzena', {
      type: 'bar',
      data: {
        labels: qLabels,
        datasets: [{
          label: 'Valor',
          data: qValues,
          backgroundColor: qValues.map(function (v, i) { return i === qValues.length - 1 ? '#a8de4a' : 'rgba(141,198,63,.55)'; }),
          borderColor: '#8dc63f',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 84
        }]
      },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.y); } } } } }
    });

    /* gráfico regional */
    var byReg = groupBy(list, function (e) { return e.regional; });
    var regArr = Array.from(byReg.values()).sort(function (a, b) { return b.value - a.value; });
    drawChart('pfChartRegional', {
      type: 'doughnut',
      data: {
        labels: regArr.map(function (g) { return g.key; }),
        datasets: [{
          data: regArr.map(function (g) { return g.value; }),
          backgroundColor: regArr.map(function (g) { return REGIONAL_COLORS[g.key] || '#8a8a8a'; }),
          borderColor: isLight() ? '#fff' : '#0b0b0b',
          borderWidth: 2
        }]
      },
      options: {
        cutout: '58%',
        plugins: {
          legend: { position: 'right', labels: { color: legendColor(), boxWidth: 12, usePointStyle: true, font: { size: 11 } } },
          tooltip: { callbacks: { label: function (c) { return c.label + ': ' + fmtBRL(c.parsed) + ' (' + fmtPct(total ? c.parsed / total * 100 : 0) + ')'; } } }
        }
      }
    });

    /* bases */
    var baseArr = Array.from(byBase.values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 10);
    drawChart('pfChartBases', {
      type: 'bar',
      data: {
        labels: baseArr.map(function (g) { return g.key; }),
        datasets: [{ label: 'Valor', data: baseArr.map(function (g) { return g.value; }), backgroundColor: 'rgba(141,198,63,.75)', borderColor: '#8dc63f', borderWidth: 1, borderRadius: 5 }]
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.x); } } } } }
    });

    /* motoristas */
    var drvArr = Array.from(byDriver.values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 10);
    drawChart('pfChartMotoristas', {
      type: 'bar',
      data: {
        labels: drvArr.map(function (g) { return bestName(g); }),
        datasets: [{ label: 'Valor', data: drvArr.map(function (g) { return g.value; }), backgroundColor: 'rgba(255,152,0,.75)', borderColor: '#ff9800', borderWidth: 1, borderRadius: 5 }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.x); }, afterLabel: function (c) { var g = drvArr[c.dataIndex]; return g ? g.count + ' pacote(s) · ' + g.bases.size + ' base(s)' : ''; } } }
        }
      }
    });

    /* tabela por quinzena */
    var body = $('pfQuinzenaBody');
    if (!qs.length) {
      body.innerHTML = '<tr class="pf-empty-row"><td colspan="8">Nenhuma quinzena no período.</td></tr>';
    } else {
      body.innerHTML = qs.map(function (k, i) {
        var g = byQ.get(k) || { value: 0, count: 0, bases: new Set(), drivers: new Set(), qs: new Set() };
        var sub = list.filter(function (e) { return e.q === k; });
        var svcQ = sub.filter(function (e) { return e.tipo === 'SVC'; }).reduce(function (a, e) { return a + e.value; }, 0);
        var xptQ = sub.filter(function (e) { return e.tipo === 'XPT'; }).reduce(function (a, e) { return a + e.value; }, 0);
        var prevKey = i > 0 ? qs[i - 1] : null;
        var prevG = prevKey ? byQ.get(prevKey) : null;
        var v = prevG && prevG.value ? variation(g.value, prevG.value) : null;
        return '<tr><td><strong>' + esc(qLabel(k)) + '</strong></td>' +
          '<td class="num valor">' + fmtBRL(g.value) + '</td>' +
          '<td class="num">' + fmtInt(g.count) + '</td>' +
          '<td class="num">' + fmtInt(g.bases.size) + '</td>' +
          '<td class="num">' + fmtInt(g.drivers.size) + '</td>' +
          '<td class="num">' + fmtBRL(svcQ) + '</td>' +
          '<td class="num">' + fmtBRL(xptQ) + '</td>' +
          '<td class="num">' + varHtml(v) + '</td></tr>';
      }).join('');
    }
  }

  /* --------------------------------------------------- regionais e bases */
  function renderRegionais() {
    var list = filteredEntries();
    var prev = previousEntries();
    var total = sumValue(list);
    var qs = activeKeys();

    var byReg = groupBy(list, function (e) { return e.regional; });
    var prevReg = groupBy(prev, function (e) { return e.regional; });
    var regArr = Array.from(byReg.values()).sort(function (a, b) { return b.value - a.value; });

    /* barras */
    drawChart('pfChartRegionaisBar', {
      type: 'bar',
      data: {
        labels: regArr.map(function (g) { return REGIONAL_SHORT[g.key] || g.key; }),
        datasets: [{ label: 'Valor', data: regArr.map(function (g) { return g.value; }), backgroundColor: regArr.map(function (g) { return REGIONAL_COLORS[g.key] || '#8a8a8a'; }), borderRadius: 6, maxBarThickness: 52 }]
      },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.y) + ' (' + fmtPct(total ? c.parsed.y / total * 100 : 0) + ')'; } } } } }
    });

    /* linhas por quinzena */
    var colors = {};
    regArr.forEach(function (g, i) { colors[g.key] = REGIONAL_COLORS[g.key] || PALETTE[i % PALETTE.length]; });
    var datasets = regArr.map(function (g) {
      var series = qs.map(function (k) {
        return list.filter(function (e) { return e.q === k && e.regional === g.key; }).reduce(function (a, e) { return a + e.value; }, 0);
      });
      return { label: REGIONAL_SHORT[g.key] || g.key, data: series, borderColor: colors[g.key], backgroundColor: colors[g.key], tension: .32, borderWidth: 2, pointRadius: 2.5, fill: false };
    });
    drawChart('pfChartRegionaisLine', {
      type: 'line',
      data: { labels: qs.map(qShort), datasets: datasets },
      options: { plugins: { tooltip: { mode: 'index', intersect: false, callbacks: { label: function (c) { return c.dataset.label + ': ' + fmtBRL(c.parsed.y); } } } } }
    });

    /* tabela regionais */
    var regBody = $('pfRegionaisBody');
    if (!regArr.length) {
      regBody.innerHTML = '<tr class="pf-empty-row"><td colspan="9">Nenhum dado no período selecionado.</td></tr>';
    } else {
      regBody.innerHTML = regArr.map(function (g, i) {
        var pg = prevReg.get(g.key);
        var v = pg && pg.value ? variation(g.value, pg.value) : null;
        var pct = total ? g.value / total * 100 : 0;
        return '<tr class="clickable" data-regional="' + esc(g.key) + '">' +
          '<td><span class="pf-pos">' + (i + 1) + '</span></td>' +
          '<td><strong>' + esc(g.key) + '</strong></td>' +
          '<td class="num valor">' + fmtBRL(g.value) + '</td>' +
          '<td class="num">' + fmtPct(pct) + '<span class="pf-bar" style="margin-top:5px"><i style="width:' + Math.min(100, pct).toFixed(1) + '%;background:' + (REGIONAL_COLORS[g.key] || '#8dc63f') + '"></i></span></td>' +
          '<td class="num">' + fmtInt(g.count) + '</td>' +
          '<td class="num">' + fmtInt(g.bases.size) + '</td>' +
          '<td class="num">' + fmtInt(g.drivers.size) + '</td>' +
          '<td class="num">' + fmtBRL(g.count ? g.value / g.count : 0) + '</td>' +
          '<td class="num">' + varHtml(v) + '</td></tr>';
      }).join('');
    }

    /* bases */
    var byBase = groupBy(list, function (e) { return e.base; });
    var prevBase = groupBy(prev, function (e) { return e.base; });
    var baseArr = Array.from(byBase.values()).sort(function (a, b) { return b.value - a.value; });
    $('pfBasesCount').textContent = fmtInt(baseArr.length) + ' base(s)';
    var baseBody = $('pfBasesBody');
    if (!baseArr.length) {
      baseBody.innerHTML = '<tr class="pf-empty-row"><td colspan="10">Nenhuma base no período selecionado.</td></tr>';
    } else {
      baseBody.innerHTML = baseArr.map(function (g, i) {
        var pb = prevBase.get(g.key);
        var v = pb && pb.value ? variation(g.value, pb.value) : null;
        var pct = total ? g.value / total * 100 : 0;
        var tipos = Array.from(new Set(list.filter(function (e) { return e.base === g.key; }).map(function (e) { return e.tipo; })));
        var tipoHtml = tipos.map(function (t) { return '<span class="tag ' + (t === 'SVC' ? 'svc' : (t === 'XPT' ? 'xpt' : '')) + '">' + esc(t) + '</span>'; }).join(' ');
        var sel = state.baseDetail === g.key ? ' selected' : '';
        return '<tr class="clickable' + sel + '" data-base="' + esc(g.key) + '">' +
          '<td><span class="pf-pos">' + (i + 1) + '</span></td>' +
          '<td><strong>' + esc(g.key) + '</strong></td>' +
          '<td class="dim">' + esc(Array.from(g.regions).join(', ')) + '</td>' +
          '<td>' + tipoHtml + '</td>' +
          '<td class="num valor">' + fmtBRL(g.value) + '</td>' +
          '<td class="num">' + fmtPct(pct) + '</td>' +
          '<td class="num">' + fmtInt(g.count) + '</td>' +
          '<td class="num">' + fmtInt(g.drivers.size) + '</td>' +
          '<td class="num">' + fmtInt(g.qs.size) + '</td>' +
          '<td class="num">' + varHtml(v) + '</td></tr>';
      }).join('');
    }
    renderBaseDetail();
  }

  function renderBaseDetail() {
    var box = $('pfBaseDetail');
    var base = state.baseDetail;
    if (!base) { box.hidden = true; destroyChart('pfChartBaseEvolucao'); return; }
    var list = filteredEntries().filter(function (e) { return e.base === base; });
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    var qs = activeKeys();
    var total = sumValue(list);
    $('pfBaseDetailTitle').textContent = 'Base ' + base;
    $('pfBaseDetailSub').textContent = fmtBRL(total) + ' · ' + fmtInt(list.length) + ' pacote(s) · ' + Array.from(new Set(list.map(function (e) { return e.regional; }))).join(', ');
    drawChart('pfChartBaseEvolucao', {
      type: 'bar',
      data: {
        labels: qs.map(qShort),
        datasets: [{
          label: 'Valor',
          data: qs.map(function (k) { return list.filter(function (e) { return e.q === k; }).reduce(function (a, e) { return a + e.value; }, 0); }),
          backgroundColor: 'rgba(141,198,63,.7)', borderColor: '#8dc63f', borderWidth: 1, borderRadius: 5
        }]
      },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.y); } } } } }
    });
    var byDriver = groupBy(list, function (e) { return e.driverKey; }, function (e) { return e.driver; });
    var drv = Array.from(byDriver.values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 25);
    $('pfBaseDetailDrivers').innerHTML = drv.length ? drv.map(function (g) {
      return '<tr><td><strong>' + esc(bestName(g)) + '</strong></td><td class="num valor">' + fmtBRL(g.value) + '</td><td class="num">' + fmtInt(g.count) + '</td><td class="num">' + fmtInt(g.qs.size) + '</td></tr>';
    }).join('') : '<tr class="pf-empty-row"><td colspan="4">Sem motoristas.</td></tr>';
  }

  /* ------------------------------------------------------------ motoristas */
  function renderMotoristas() {
    var list = filteredEntries();
    var qs = activeKeys();
    var min = state.driverMin;
    var byDriver = groupBy(list, function (e) { return e.driverKey; }, function (e) { return e.driver; });
    var arr = Array.from(byDriver.values()).filter(function (g) {
      if (g.value < min) return false;
      return true;
    });
    arr.sort(function (a, b) {
      if (state.driverSort === 'pacotes') return b.count - a.count;
      if (state.driverSort === 'quinzenas') return (b.qs.size - a.qs.size) || (b.value - a.value);
      return b.value - a.value;
    });
    var total = sumValue(list);
    var topN = parseInt(state.driverTop, 10);
    var shown = topN > 0 ? arr.slice(0, topN) : arr;
    $('pfDriversCount').textContent = fmtInt(arr.length) + ' motorista(s)' + (topN > 0 && arr.length > topN ? ' · top ' + topN : '');

    var body = $('pfDriversBody');
    if (!shown.length) {
      body.innerHTML = '<tr class="pf-empty-row"><td colspan="8">Nenhum motorista com esses filtros.</td></tr>';
    } else {
      body.innerHTML = shown.map(function (g, i) {
        var lastQ = Array.from(g.qs).sort().pop();
        var sel = state.driverDetail === g.key ? ' selected' : '';
        return '<tr class="clickable' + sel + '" data-driver="' + esc(g.key) + '">' +
          '<td><span class="pf-pos">' + (i + 1) + '</span></td>' +
          '<td><strong>' + esc(bestName(g)) + '</strong></td>' +
          '<td class="num valor">' + fmtBRL(g.value) + '</td>' +
          '<td class="num">' + fmtInt(g.count) + '</td>' +
          '<td class="dim">' + esc(Array.from(g.bases).join(', ')) + '</td>' +
          '<td class="num">' + fmtInt(g.qs.size) + '</td>' +
          '<td class="dim">' + esc(lastQ ? qShort(lastQ) : '—') + '</td>' +
          '<td class="num">' + fmtBRL(g.count ? g.value / g.count : 0) + '</td></tr>';
      }).join('');
    }

    /* gráfico top 15 */
    var top = arr.slice(0, 15);
    drawChart('pfChartDriversTop', {
      type: 'bar',
      data: {
        labels: top.map(function (g) { return bestName(g); }),
        datasets: [{ label: 'Valor', data: top.map(function (g) { return g.value; }), backgroundColor: 'rgba(255,82,82,.72)', borderColor: '#ff5252', borderWidth: 1, borderRadius: 5 }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.x); }, afterLabel: function (c) { var g = top[c.dataIndex]; return g ? g.count + ' pacote(s) · ' + g.qs.size + ' quinzena(s)' : ''; } } }
        }
      }
    });

    /* resumo simples de pacotes por motorista; a antiga reincidência não é usada como filtro */
    var buckets = { '1 pacote': 0, '2–5 pacotes': 0, '6–10 pacotes': 0, '11+ pacotes': 0 };
    arr.forEach(function (g) { if (g.count === 1) buckets['1 pacote']++; else if (g.count <= 5) buckets['2–5 pacotes']++; else if (g.count <= 10) buckets['6–10 pacotes']++; else buckets['11+ pacotes']++; });
    drawChart('pfChartDriversRepeat', {
      type: 'bar',
      data: {
        labels: Object.keys(buckets),
        datasets: [{ label: 'Motoristas', data: Object.values(buckets), backgroundColor: ['rgba(141,198,63,.45)', 'rgba(255,215,0,.65)', 'rgba(255,152,0,.7)', 'rgba(255,82,82,.75)'], borderRadius: 6, maxBarThickness: 54 }]
      },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.y + ' motorista(s)'; } } } },
        scales: { y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { color: tickColor(), precision: 0 } }, x: { grid: { display: false }, ticks: { color: tickColor() } } }
      }
    });
    renderDriverDetail(total);
  }

  function renderDriverDetail() {
    var box = $('pfDriverDetail');
    var key = state.driverDetail;
    if (!key) { box.hidden = true; destroyChart('pfChartDriverEvolucao'); return; }
    var list = filteredEntries().filter(function (e) { return e.driverKey === key; });
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    var name = list[0].driver;
    var total = sumValue(list);
    var qs = activeKeys();
    var byQ = groupBy(list, function (e) { return e.q; });
    $('pfDriverDetailTitle').textContent = name;
    $('pfDriverDetailSub').textContent = fmtBRL(total) + ' · ' + fmtInt(list.length) + ' pacote(s) · Base(s): ' +
      Array.from(new Set(list.map(function (e) { return e.baseName || e.base; }))).join(', ') + ' · ' + byQ.size + ' quinzena(s)';

    drawChart('pfChartDriverEvolucao', {
      type: 'line',
      data: {
        labels: qs.map(qShort),
        datasets: [{
          label: 'Valor',
          data: qs.map(function (k) { var g = byQ.get(k); return g ? g.value : 0; }),
          borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,.18)', fill: true, tension: .3, borderWidth: 2, pointRadius: 3
        }]
      },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.y); } } } } }
    });

    var byBase = groupBy(list, function (e) { return e.baseName || e.base; });
    var bases = Array.from(byBase.values()).sort(function (a, b) { return b.value - a.value; });
    $('pfDriverDetailBases').innerHTML = bases.map(function (g) {
      return '<tr><td><strong>' + esc(g.key) + '</strong></td><td class="num valor">' + fmtBRL(g.value) + '</td><td class="num">' + fmtInt(g.count) + '</td><td class="num">' + fmtInt(g.qs.size) + '</td></tr>';
    }).join('');

    var rows = list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 200);
    $('pfDriverDetailRows').innerHTML = rows.map(function (e) {
      var number = e.packageNumber || e.pkg || '';
      var link = logisticUrl(number);
      var packageCell = '<strong>' + esc(e.packageName || '—') + '</strong><br><span class="dim">Nº ' + esc(number || '—') + '</span>' + (link ? '<br><a class="pf-logistic-link" href="' + link + '" target="_blank" rel="noopener">Ver no Logistic ↗</a>' : '');
      return '<tr><td class="dim">' + esc(qShort(e.q)) + '</td><td>' + packageCell + '</td><td>' + esc(e.baseName || e.base) + '</td><td class="pf-description">' + esc(e.description || '—') + '</td><td class="dim">' + esc(e.route || '—') + '</td><td class="dim">' + esc(dateBR(e.date)) + '</td><td class="num valor">' + fmtBRL(e.value) + '</td></tr>';
    }).join('');
  }

  /* ------------------------------------------------------- evolução tempo */
  function renderTempo() {
    var list = filteredEntries();
    var qs = activeKeys();
    var byQ = state.tempoAgrup === 'mes';
    var periods = byQ ? Array.from(new Set(qs.map(function (k) { return k.slice(0, 7); }))).sort() : qs;
    var labels = byQ ? periods.map(monthLabel) : periods.map(qShort);
    var metric = state.tempoMetrica;
    var valueOf = function (sub) { return metric === 'valor' ? sumValue(sub) : sub.length; };
    var fmtVal = metric === 'valor' ? fmtBRL : fmtInt;

    $('pfTempoTitle').textContent = (metric === 'valor' ? 'Evolução do valor' : 'Evolução dos pacotes') + ' por ' + (byQ ? 'mês' : 'quinzena');

    function seriesFor(filterFn) {
      return periods.map(function (p) {
        var sub = list.filter(function (e) {
          var k = byQ ? e.q.slice(0, 7) : e.q;
          return k === p && filterFn(e);
        });
        return valueOf(sub);
      });
    }

    var datasets = [];
    if (state.tempoModo === 'regional' || state.tempoModo === 'base') {
      var groups = state.tempoModo === 'regional'
        ? Array.from(new Set(list.map(function (e) { return e.regional; }))).sort(function (a, b) { return REGIONALS.indexOf(a) - REGIONALS.indexOf(b); })
        : Array.from(groupBy(list, function (e) { return e.base; }).values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 8).map(function (g) { return g.key; });
      datasets = groups.map(function (r, i) {
        return {
          label: state.tempoModo === 'regional' ? (REGIONAL_SHORT[r] || r) : (r || 'SEM BASE'),
          data: seriesFor(function (e) { return state.tempoModo === 'regional' ? e.regional === r : e.base === r; }),
          borderColor: state.tempoModo === 'regional' ? (REGIONAL_COLORS[r] || PALETTE[i % PALETTE.length]) : PALETTE[i % PALETTE.length],
          backgroundColor: state.tempoModo === 'regional' ? (REGIONAL_COLORS[r] || PALETTE[i % PALETTE.length]) : PALETTE[i % PALETTE.length],
          tension: .32, borderWidth: 2, pointRadius: 2.5, fill: false
        };
      });
    } else {
      var data = seriesFor(function () { return true; });
      if (state.tempoAcumulado) {
        var acc = 0;
        data = data.map(function (v) { acc += v; return acc; });
      }
      datasets = [{
        label: metric === 'valor' ? 'Valor' : 'Pacotes',
        data: data,
        borderColor: '#8dc63f',
        backgroundColor: 'rgba(141,198,63,.20)',
        fill: true, tension: .3, borderWidth: 2.5, pointRadius: 3
      }];
    }
    if (state.tempoAcumulado && state.tempoModo === 'regional') {
      datasets = datasets.map(function (d) {
        var acc = 0;
        return Object.assign({}, d, { data: d.data.map(function (v) { acc += v; return acc; }), fill: false });
      });
    }

    var valueLabels = {
      id: 'pfTempoValueLabels',
      afterDatasetsDraw: function (chart) {
        if (chart.data.datasets.length !== 1 || metric !== 'valor') return;
        var ctx = chart.ctx, meta = chart.getDatasetMeta(0), data = chart.data.datasets[0].data;
        ctx.save(); ctx.font = '600 10px Plus Jakarta Sans, sans-serif'; ctx.fillStyle = legendColor(); ctx.textAlign = 'center';
        meta.data.forEach(function (point, i) { if (data[i] == null) return; ctx.fillText(fmtShortBRL(data[i]), point.x, point.y - 9); });
        ctx.restore();
      }
    };
    drawChart('pfChartTempo', {
      type: 'line',
      plugins: [valueLabels],
      data: { labels: labels, datasets: datasets },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: state.tempoModo !== 'total', position: 'top', align: 'end', labels: { color: legendColor(), boxWidth: 12, usePointStyle: true, font: { size: 11 } } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + fmtVal(c.parsed.y); } } }
        },
        scales: metric === 'valor'
          ? { y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { color: tickColor(), callback: function (v) { return fmtShortBRL(v); } } }, x: { grid: { display: false }, ticks: { color: tickColor() } } }
          : { y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { color: tickColor(), precision: 0 } }, x: { grid: { display: false }, ticks: { color: tickColor() } } }
      }
    });

    /* top bases e motoristas no período */
    var byBase = groupBy(list, function (e) { return e.base; });
    var bases = Array.from(byBase.values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 5);
    drawChart('pfChartTempoBases', {
      type: 'bar',
      data: { labels: bases.map(function (g) { return g.key; }), datasets: [{ label: 'Valor', data: bases.map(function (g) { return g.value; }), backgroundColor: 'rgba(141,198,63,.7)', borderRadius: 5 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.x); } } } } }
    });
    var byDriver = groupBy(list, function (e) { return e.driverKey; }, function (e) { return e.driver; });
    var drivers = Array.from(byDriver.values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 5);
    drawChart('pfChartTempoDrivers', {
      type: 'bar',
      data: { labels: drivers.map(function (g) { return bestName(g); }), datasets: [{ label: 'Valor', data: drivers.map(function (g) { return g.value; }), backgroundColor: 'rgba(255,152,0,.7)', borderRadius: 5 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmtBRL(c.parsed.x); } } } } }
    });

    /* tabela comparativa */
    var body = $('pfTempoBody');
    if (!periods.length) {
      body.innerHTML = '<tr class="pf-empty-row"><td colspan="7">Nenhum período no intervalo selecionado.</td></tr>';
      return;
    }
    body.innerHTML = periods.map(function (p, i) {
      var sub = list.filter(function (e) { return (byQ ? e.q.slice(0, 7) : e.q) === p; });
      var val = sumValue(sub);
      var prevSub = i > 0 ? list.filter(function (e) { return (byQ ? e.q.slice(0, 7) : e.q) === periods[i - 1]; }) : null;
      var v = prevSub && sumValue(prevSub) ? variation(val, sumValue(prevSub)) : null;
      return '<tr><td><strong>' + esc(byQ ? monthLabel(p) : qLabel(p)) + '</strong></td>' +
        '<td class="num valor">' + fmtBRL(val) + '</td>' +
        '<td class="num">' + fmtInt(sub.length) + '</td>' +
        '<td class="num">' + fmtInt(new Set(sub.map(function (e) { return e.base; })).size) + '</td>' +
        '<td class="num">' + fmtInt(new Set(sub.map(function (e) { return e.driverKey; })).size) + '</td>' +
        '<td class="num">' + fmtBRL(sub.length ? val / sub.length : 0) + '</td>' +
        '<td class="num">' + varHtml(v) + '</td></tr>';
    }).join('');
  }

  /* -------------------------------------------------------------- importar */
  function renderImportar() {
    var body = $('pfImportsBody');
    var imports = state.imports.slice().sort(function (a, b) {
      return (b.quinzena || '').localeCompare(a.quinzena || '') || String(b.importedAt).localeCompare(String(a.importedAt));
    });
    $('pfImportsCount').textContent = fmtInt(imports.length) + ' planilha(s)';
    $('pfImportsEmpty').style.display = imports.length ? 'none' : 'block';
    body.innerHTML = imports.map(function (imp) {
      var p = qParts(imp.quinzena);
      var monthVal = imp.quinzena ? imp.quinzena.slice(0, 7) : '';
      return '<tr data-imp="' + esc(imp.id) + '">' +
        '<td><div class="pf-imp-q">' +
        '<select data-imp-q="' + esc(imp.id) + '" aria-label="Quinzena da planilha ' + esc(imp.fileName) + '">' +
        '<option value="1"' + (p.q === 1 ? ' selected' : '') + '>1ª</option>' +
        '<option value="2"' + (p.q === 2 ? ' selected' : '') + '>2ª</option>' +
        '</select>' +
        '<input type="month" data-imp-m="' + esc(imp.id) + '" value="' + esc(monthVal) + '" aria-label="Mês e ano da planilha ' + esc(imp.fileName) + '">' +
        '</div><div class="pf-mini-help" style="margin:4px 0 0">' + esc(imp.quinzena ? qLabel(imp.quinzena) : 'Quinzena não definida') + '</div></td>' +
        '<td><strong>' + esc(imp.fileName) + '</strong></td>' +
        '<td class="dim">' + esc(imp.sheetName) + '</td>' +
        '<td class="num">' + fmtInt(imp.rows.length) + '</td>' +
        '<td class="num valor">' + fmtBRL(imp.total) + '</td>' +
        '<td class="dim">' + esc(new Date(imp.importedAt).toLocaleString('pt-BR')) + '</td>' +
        '<td><button type="button" class="del-btn" data-imp-del="' + esc(imp.id) + '" title="Excluir esta planilha" aria-label="Excluir ' + esc(imp.fileName) + '"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg></button></td>' +
        '</tr>';
    }).join('');

    /* resumo por quinzena */
    var byQ = new Map();
    state.imports.forEach(function (imp) {
      if (!imp.quinzena) return;
      var g = byQ.get(imp.quinzena) || { files: 0, count: 0, value: 0, svc: 0, xpt: 0 };
      g.files += 1;
      (imp.rows || []).forEach(function (r) {
        var v = Number(r[4]) || 0;
        var base = normBase(r[0]);
        var tipo = tipoFromBase(base, r[1]);
        g.count += 1; g.value += v;
        if (tipo === 'SVC') g.svc += v; else if (tipo === 'XPT') g.xpt += v;
      });
      byQ.set(imp.quinzena, g);
    });
    var keys = sortKeys(Array.from(byQ.keys()));
    $('pfQuinzenaResumoBody').innerHTML = keys.length ? keys.map(function (k) {
      var g = byQ.get(k);
      return '<tr><td><strong>' + esc(qLabel(k)) + '</strong></td><td class="num">' + fmtInt(g.files) + '</td><td class="num">' + fmtInt(g.count) + '</td><td class="num valor">' + fmtBRL(g.value) + '</td><td class="num">' + fmtBRL(g.svc) + '</td><td class="num">' + fmtBRL(g.xpt) + '</td></tr>';
    }).join('') : '<tr class="pf-empty-row"><td colspan="6">Nenhuma quinzena salva.</td></tr>';

    var bytes = 0;
    try { bytes = (localStorage.getItem(LS_KEY) || '').length; } catch (e) { }
    var totalRows = state.imports.reduce(function (a, i) { return a + i.rows.length; }, 0);
    $('pfStorageInfo').innerHTML = state.imports.length
      ? '<strong>' + fmtInt(state.imports.length) + '</strong> planilha(s) · <strong>' + fmtInt(totalRows) + '</strong> pacote(s) · <strong>' + (bytes / 1024).toFixed(0) + ' KB</strong> salvos neste navegador.<br>Os dados ficam apenas no seu computador (localStorage) e não são enviados para nenhum servidor.'
      : 'Nenhuma planilha salva neste navegador.';
  }

  /* ----------------------------------------------------------------- parse */
  function findLostSheet(wb) {
    var names = wb.SheetNames || [];
    var n = names.find(function (x) { return /lost\s*_?\s*pack/i.test(x); });
    if (!n) n = names.find(function (x) { return /^\s*lost\s*$/i.test(x); });
    if (!n) n = names.find(function (x) { return /lost/i.test(x); });
    if (!n) n = names.find(function (x) { return /perdid/i.test(x) && /pack/i.test(x); });
    return n || null;
  }
  function detectQuinzenaInfo(sheetNames, fileName, rows) {
    var sheetText = (sheetNames || []).join(' | ');
    var nameText = fileName || '';
    var info = { year: 0, month: 0, q: 0 };

    [sheetText, nameText].forEach(function (txt) {
      if (!txt) return;
      if (!info.q) info.q = quinzenaFromText(txt);
      if (!info.month) info.month = monthFromText(txt);
      if (!info.year) { var m = txt.match(/(20\d{2})/); if (m) info.year = +m[1]; }
    });
    if (!info.year) { var m2 = nameText.match(/(20\d{2})/); if (m2) info.year = +m2[1]; }

    if (!info.month || !info.year) {
      var counts = new Map();
      rows.forEach(function (r) {
        var d = r[5];
        if (!d) return;
        var k = d.slice(0, 7);
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      var best = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; })[0];
      if (best) {
        var y = +best[0].slice(0, 4), mo = +best[0].slice(5, 7);
        if (!info.year) info.year = y;
        if (!info.month) info.month = mo;
      }
    }
    if (!info.q) info.q = 1;
    if (!info.year) info.year = new Date().getFullYear();
    if (!info.month) info.month = new Date().getMonth() + 1;
    return info;
  }

  function parseWorkbook(wb, fileName) {
    var sheetName = findLostSheet(wb);
    if (!sheetName) {
      throw new Error('Aba "Lost pack" não encontrada. Abas no arquivo: ' + (wb.SheetNames || []).join(', '));
    }
    var ws = wb.Sheets[sheetName];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
    if (!rows.length) throw new Error('A aba "' + sheetName + '" está vazia.');

    var hIdx = -1;
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var cells = (rows[i] || []).map(function (c) { return normKey(c); });
      var hasBase = cells.some(function (c) { return c === 'bases' || c === 'base'; });
      var hasDesc = cells.some(function (c) { return c.indexOf('descri') === 0; });
      if (hasBase && hasDesc) { hIdx = i; break; }
    }
    if (hIdx < 0) throw new Error('Não encontrei o cabeçalho (Bases / Descrição) na aba "' + sheetName + '".');

    var idx = {};
    (rows[hIdx] || []).forEach(function (h, col) {
      var k = normKey(h);
      if (!k) return;
      if (/^bases?$/.test(k) && idx.base == null) idx.base = col;
      else if (k === 'tipo' && idx.tipo == null) idx.tipo = col;
      else if (k.indexOf('descri') === 0 && idx.desc == null) idx.desc = col;
      else if ((k.indexOf('id da rota') === 0 || k === 'id rota' || k === 'rota') && idx.route == null) idx.route = col;
      else if ((k.indexOf('data de inicio') === 0 || k === 'data inicio' || k === 'inicio') && idx.start == null) idx.start = col;
      else if ((k.indexOf('data de termino') === 0 || k === 'data termino' || k === 'termino') && idx.end == null) idx.end = col;
      else if (k === 'placa' && idx.plate == null) idx.plate = col;
      else if (k.indexOf('motorista') === 0 && idx.driver == null) idx.driver = col;
      else if ((k.indexOf('quantidade') === 0 || k === 'qtd') && idx.qty == null) idx.qty = col;
      else if ((k.indexOf('preco unitario') === 0 || k === 'preco' || k === 'valor unitario') && idx.unit == null) idx.unit = col;
      else if (k === 'total' && idx.total == null) idx.total = col;
    });
    if (idx.desc == null && idx.base == null) throw new Error('Colunas essenciais não encontradas na aba "' + sheetName + '".');

    var out = [];
    for (var r = hIdx + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var desc = String(idx.desc != null && row[idx.desc] != null ? row[idx.desc] : '').trim();
      var baseRaw = idx.base != null ? row[idx.base] : '';
      var tipoRaw = idx.tipo != null ? row[idx.tipo] : '';
      if (!desc && !baseRaw) continue;
      if (/^total/i.test(normKey(desc))) continue;

      var qty = idx.qty != null ? toNumber(row[idx.qty]) : 1;
      if (!qty) qty = 1;
      var unit = idx.unit != null ? toNumber(row[idx.unit]) : 0;
      var tot = idx.total != null ? toNumber(row[idx.total]) : 0;
      var value = tot > 0 ? tot : unit * qty;
      if (!value) continue;

      var plate = '';
      var pkg = '';
      var descDate = '';
      var m = desc.match(/penalty[:\s]*([A-Z0-9]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{6,})/i);
      if (m) { plate = m[1].toUpperCase(); descDate = parseDateValue(m[2]); pkg = m[3]; }
      else {
        var nums = desc.match(/\b(\d{8,})\b/g);
        if (nums && nums.length) pkg = nums[nums.length - 1];
        var dm = desc.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dm) descDate = parseDateValue(dm[1]);
        var codes = desc.match(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/i);
        if (codes) plate = codes[1].toUpperCase();
      }
      var rawPlate = idx.plate != null && row[idx.plate] != null ? String(row[idx.plate]).trim() : '';
      if (!plate && rawPlate && /[A-Z]/i.test(rawPlate)) plate = rawPlate.toUpperCase();

      var date = (idx.start != null ? parseDateValue(row[idx.start]) : '') || descDate;
      var route = idx.route != null && row[idx.route] != null ? String(row[idx.route]).trim() : '';

      out.push([normBase(baseRaw), String(tipoRaw || '').trim().toUpperCase(), String(idx.driver != null && row[idx.driver] != null ? row[idx.driver] : '').trim(), plate, Math.round(value * 100) / 100, date, pkg, route, desc, String(baseRaw == null ? '' : baseRaw).trim()]);
    }
    if (!out.length) throw new Error('Nenhuma linha com valor foi encontrada na aba "' + sheetName + '".');
    return { sheetName: sheetName, rows: out, detected: detectQuinzenaInfo(wb.SheetNames, fileName, out) };
  }

  /* --------------------------------------------------------------- import */
  function setProgress(html) {
    var box = $('pfImportProgress');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = html;
  }
  function cameraSvg() {
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M8 5l1-2h6l1 2"/></svg>';
  }
  function captureElement(element, fileName) {
    if (!window.html2canvas) { alert('O recurso de captura ainda está carregando. Tente novamente em alguns segundos.'); return; }
    var button = element.querySelector('.pf-capture-btn');
    if (button) button.classList.add('is-capturing');
    html2canvas(element, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim() || '#050505', scale: Math.min(2, window.devicePixelRatio || 1), useCORS: true, logging: false }).then(function (canvas) {
      canvas.toBlob(function (blob) {
        if (!blob) return;
        if (navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {
            if (button) { button.title = 'Imagem copiada'; setTimeout(function () { button.title = 'Capturar e copiar'; }, 2500); }
          }).catch(function () { alert('O navegador bloqueou a cópia da imagem. Permita o acesso à área de transferência e tente novamente.'); });
        } else alert('Este navegador não permite copiar imagens diretamente.');
      }, 'image/png');
    }).catch(function (err) { console.error(err); alert('Não foi possível capturar esta tela.'); }).finally(function () { if (button) button.classList.remove('is-capturing'); });
  }
  function bindCaptureButtons() {
    document.querySelectorAll('.chart-card, .import-card').forEach(function (card, index) {
      var head = card.querySelector('.chart-card-head') || card.querySelector('h3');
      if (!head || card.querySelector('.pf-card-capture')) return;
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'pf-capture-btn pf-card-capture'; button.title = 'Capturar e copiar este bloco'; button.setAttribute('aria-label', 'Capturar e copiar este bloco'); button.innerHTML = cameraSvg();
      if (head.classList.contains('chart-card-head')) head.appendChild(button); else { button.style.float = 'right'; head.parentNode.insertBefore(button, head.nextSibling); }
      button.addEventListener('click', function (ev) { ev.stopPropagation(); captureElement(card, 'prefatura-bloco-' + (index + 1)); });
    });
    var pageButton = $('pfCapturePage');
    if (pageButton && !pageButton.dataset.bound) {
      pageButton.dataset.bound = '1';
      pageButton.addEventListener('click', function () { var page = document.querySelector('.page.active'); if (page) captureElement(page, 'prefatura-' + (state.page || 'pagina')); });
    }
  }
  function handleFiles(fileList) {
    var files = Array.from(fileList || []);
    if (!files.length) return;
    var forcedQ = $('pfImpQuinzena').value;
    var forcedMonth = $('pfImpMes').value;
    var startedAt = Date.now();
    var progressTimer = null;
    setProgress('<div>Lendo ' + files.length + ' arquivo(s)...</div><div class="dim">Preparando a importação...</div>');
    var messages = [];
    var done = 0;

    function finish() {
      if (progressTimer) clearInterval(progressTimer);
      buildEntries();
      if (!state.keys.length) { renderAll(); return; }
      /* mantém o período coerente: "Tudo"/"Última" passam a incluir a planilha nova */
      if (state.filters.preset === 'tudo' || state.filters.preset === 'ultima' || !state.filters.preset) {
        applyPreset(state.filters.preset || 'tudo');
      }
      renderFilterOptions();
      saveStore();
      renderAll();
      setProgress(messages.join('') + '<div class="dim">Concluído em ' + ((Date.now() - startedAt) / 1000).toFixed(1).replace('.', ',') + ' s.</div>');
    }

    function updateProgress(current, fileName, stage) {
      var elapsed = ((Date.now() - startedAt) / 1000).toFixed(1).replace('.', ',');
      setProgress('<div>Lendo arquivo ' + current + ' de ' + files.length + '...</div><div>' + esc(fileName) + '</div><div class="dim">' + stage + ' · ' + elapsed + ' s</div>');
    }

    progressTimer = setInterval(function () {
      if (done < files.length) updateProgress(done + 1, files[done] ? files[done].name : '', 'Ainda processando; planilhas grandes podem levar alguns segundos');
    }, 3000);

    files.forEach(function (file, fileIndex) {
      var reader = new FileReader();
      updateProgress(fileIndex + 1, file.name, 'Carregando arquivo');
      reader.onerror = function () {
        messages.push('<div class="err">' + esc(file.name) + ': não foi possível ler o arquivo.</div>');
        if (++done === files.length) finish();
      };
      reader.onload = function (evt) {
        /* Deixa o navegador pintar a etapa antes do parse síncrono do XLSX. */
        updateProgress(fileIndex + 1, file.name, 'Localizando a aba Lost pack');
        setTimeout(function () {
          try {
            var wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array', cellDates: true, dense: true, cellHTML: false, cellStyles: false, cellNF: false, cellFormula: false });
            updateProgress(fileIndex + 1, file.name, 'Lendo as linhas da aba Lost pack');
            var parsed = parseWorkbook(wb, file.name);
            var det = parsed.detected;
            var q = forcedQ === 'auto' ? det.q : +forcedQ;
            var month = det.month, year = det.year;
            if (forcedMonth) {
              var p = forcedMonth.split('-');
              year = +p[0]; month = +p[1];
            }
            var key = qKey(year, month, q);
            var total = parsed.rows.reduce(function (a, r) { return a + (Number(r[4]) || 0); }, 0);

            var existing = state.imports.find(function (i) { return i.fileName === file.name && i.quinzena === key; });
            if (existing) {
              existing.rows = parsed.rows;
              existing.total = total;
              existing.sheetName = parsed.sheetName;
              existing.importedAt = new Date().toISOString();
              messages.push('<div class="ok">' + esc(file.name) + '</div><div>' + esc(qLabel(key)) + ' · planilha atualizada · ' + fmtInt(parsed.rows.length) + ' pacote(s) · ' + fmtBRL(total) + '</div>');
            } else {
              state.imports.push({
                id: 'pf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
                fileName: file.name,
                sheetName: parsed.sheetName,
                quinzena: key,
                importedAt: new Date().toISOString(),
                rows: parsed.rows,
                total: total,
                count: parsed.rows.length
              });
              messages.push('<div class="ok">' + esc(file.name) + '</div><div>' + esc(qLabel(key)) + ' · ' + fmtInt(parsed.rows.length) + ' pacote(s) · ' + fmtBRL(total) + '</div>');
            }
          } catch (err) {
            console.error(err);
            messages.push('<div class="err">' + esc(file.name) + ': ' + esc(err.message || 'erro ao ler a planilha') + '</div>');
          }
          if (++done === files.length) finish();
        }, 30);
      };
      reader.readAsArrayBuffer(file);
    });
  }
  function updateLastImportBox() {
    var box = $('pfLastBox');
    if (!state.imports.length) { box.style.display = 'none'; return; }
    var last = state.imports.slice().sort(function (a, b) { return String(b.importedAt).localeCompare(String(a.importedAt)); })[0];
    box.style.display = 'block';
    $('pfLastDt').textContent = last.fileName;
    $('pfLastMeta').textContent = qLabel(last.quinzena) + ' · ' + fmtInt(last.rows.length) + ' pacote(s) · ' + fmtBRL(last.total) + ' · ' + new Date(last.importedAt).toLocaleString('pt-BR');
  }

  /* --------------------------------------------------------------- render */
  function renderAll() {
    var hasData = state.entries.length > 0;
    $('pfEmpty').hidden = hasData || state.page === 'importar';
    $('pfFilters').style.display = state.page === 'importar' ? 'none' : '';
    renderFilterOptions();
    if (state.page === 'geral') renderGeral();
    else if (state.page === 'regionais') renderRegionais();
    else if (state.page === 'motoristas') renderMotoristas();
    else if (state.page === 'tempo') renderTempo();
    else if (state.page === 'importar') { renderImportar(); updateLastImportBox(); }
  }
  function setPage(page) {
    state.page = page;
    document.querySelectorAll('.nav-btn[data-page]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-' + page);
    });
    if (page !== 'regionais') { state.baseDetail = null; }
    if (page !== 'motoristas') { state.driverDetail = null; }
    renderAll();
  }

  /* ----------------------------------------------------------------- tema */
  function applyTheme(theme) {
    var de = document.documentElement;
    de.classList.remove('theme-light', 'theme-pink');
    if (theme === 'light') de.classList.add('theme-light');
    try { localStorage.setItem('spot_dashboard_theme_v1', theme); } catch (e) { }
    document.querySelectorAll('#themeMenu .theme-option').forEach(function (b) {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
    renderAll();
  }

  /* ---------------------------------------------------------------- eventos */
  function bind() {
    document.querySelectorAll('.nav-btn[data-page]').forEach(function (b) {
      b.addEventListener('click', function () { setPage(b.dataset.page); });
    });
    $('pfEmptyGo').addEventListener('click', function () { setPage('importar'); });

    $('pfFrom').addEventListener('change', function () {
      state.filters.from = this.value;
      state.filters.preset = '';
      document.querySelectorAll('#pfPresets .preset-btn').forEach(function (b) { b.classList.remove('active'); });
      renderAll();
    });
    $('pfTo').addEventListener('change', function () {
      state.filters.to = this.value;
      state.filters.preset = '';
      document.querySelectorAll('#pfPresets .preset-btn').forEach(function (b) { b.classList.remove('active'); });
      renderAll();
    });
    document.querySelectorAll('#pfPresets .preset-btn').forEach(function (b) {
      b.addEventListener('click', function () { applyPreset(b.dataset.preset); renderAll(); });
    });
    $('pfRegional').addEventListener('change', function () {
      state.filters.regional = this.value;
      state.filters.base = 'TODAS';
      renderAll();
    });
    $('pfBase').addEventListener('change', function () {
      state.filters.base = this.value;
      state.baseDetail = null;
      renderAll();
    });
    document.querySelectorAll('#pfTipoToggle .toggle-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.filters.tipo = b.dataset.tipo;
        renderAll();
      });
    });
    var searchTimer = null;
    $('pfSearch').addEventListener('input', function () {
      var v = this.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { state.filters.search = v; renderAll(); }, 250);
    });
    $('pfReset').addEventListener('click', function () {
      state.filters = { from: state.keys[0] || '', to: state.keys[state.keys.length - 1] || '', regional: 'TODOS', base: 'TODAS', tipo: 'TODOS', search: '', preset: 'tudo' };
      state.baseDetail = null;
      state.driverDetail = null;
      renderAll();
    });

    /* cliques nas tabelas */
    document.addEventListener('click', function (ev) {
      var tr = ev.target.closest ? ev.target.closest('tr[data-base],tr[data-driver],tr[data-regional]') : null;
      if (!tr) return;
      if (ev.target.closest('button,a,select,input')) return;
      if (tr.dataset.base) {
        state.baseDetail = state.baseDetail === tr.dataset.base ? null : tr.dataset.base;
        renderRegionais();
      } else if (tr.dataset.driver) {
        state.driverDetail = state.driverDetail === tr.dataset.driver ? null : tr.dataset.driver;
        renderMotoristas();
      } else if (tr.dataset.regional) {
        state.filters.regional = tr.dataset.regional;
        state.filters.base = 'TODAS';
        renderAll();
      }
    });

    /* motoristas */
    $('pfDriverMin').addEventListener('change', function () {
      state.driverMin = toNumber(this.value);
      renderMotoristas();
    });
    $('pfDriverTop').addEventListener('change', function () { state.driverTop = this.value; renderMotoristas(); });
    $('pfDriverSort').addEventListener('change', function () { state.driverSort = this.value; renderMotoristas(); });
    $('pfDriverCsv').addEventListener('click', function () {
      var list = filteredEntries();
      var byDriver = groupBy(list, function (e) { return e.driverKey; }, function (e) { return e.driver; });
      var arr = Array.from(byDriver.values()).sort(function (a, b) { return b.value - a.value; });
      var rows = [['Motorista', 'Valor', 'Pacotes', 'Bases', 'Regionais', 'Quinzenas']];
      arr.forEach(function (g) {
        rows.push([bestName(g), g.value.toFixed(2).replace('.', ','), g.count, Array.from(g.bases).join(' | '), Array.from(g.regions).join(' | '), g.qs.size]);
      });
      downloadCsv('prefatura-motoristas.csv', rows);
    });

    /* bases */
    $('pfBasesCsv').addEventListener('click', function () {
      var list = filteredEntries();
      var byBase = groupBy(list, function (e) { return e.base; });
      var arr = Array.from(byBase.values()).sort(function (a, b) { return b.value - a.value; });
      var rows = [['Base', 'Regional', 'Valor', 'Pacotes', 'Motoristas', 'Quinzenas']];
      arr.forEach(function (g) {
        rows.push([g.key, Array.from(g.regions).join(' | '), g.value.toFixed(2).replace('.', ','), g.count, g.drivers.size, g.qs.size]);
      });
      downloadCsv('prefatura-bases.csv', rows);
    });
    $('pfBaseDetailClose').addEventListener('click', function () { state.baseDetail = null; renderRegionais(); });
    $('pfDriverDetailClose').addEventListener('click', function () { state.driverDetail = null; renderMotoristas(); });

    /* tempo */
    $('pfTempoAgrup').addEventListener('change', function () { state.tempoAgrup = this.value; renderTempo(); });
    $('pfTempoModo').addEventListener('change', function () { state.tempoModo = this.value; renderTempo(); });
    $('pfTempoMetrica').addEventListener('change', function () { state.tempoMetrica = this.value; renderTempo(); });
    $('pfTempoAcumulado').addEventListener('change', function () { state.tempoAcumulado = this.checked; renderTempo(); });

    /* importação */
    $('pfFileInput').addEventListener('change', function () {
      handleFiles(this.files);
      this.value = '';
    });
    $('pfImportsBody').addEventListener('change', function (ev) {
      var sel = ev.target.closest('select[data-imp-q]');
      var mon = ev.target.closest('input[data-imp-m]');
      if (sel) {
        var imp = state.imports.find(function (i) { return i.id === sel.dataset.impQ; });
        if (imp) {
          var p = qParts(imp.quinzena);
          imp.quinzena = qKey(p.year, p.month, +sel.value);
          saveStore(); buildEntries(); renderImportar(); renderFilterOptions();
        }
      } else if (mon) {
        var imp2 = state.imports.find(function (i) { return i.id === mon.dataset.impM; });
        if (imp2 && mon.value) {
          var mm = mon.value.split('-');
          var p2 = qParts(imp2.quinzena);
          imp2.quinzena = qKey(+mm[0], +mm[1], p2.q || 1);
          saveStore(); buildEntries(); renderImportar(); renderFilterOptions();
        }
      }
    });
    $('pfImportsBody').addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-imp-del]');
      if (!btn) return;
      var imp = state.imports.find(function (i) { return i.id === btn.dataset.impDel; });
      if (!imp) return;
      if (!confirm('Excluir a planilha "' + imp.fileName + '"?\nEla deixa de somar na quinzena ' + qLabel(imp.quinzena) + '.')) return;
      state.imports = state.imports.filter(function (i) { return i.id !== imp.id; });
      saveStore();
      buildEntries();
      if (!state.keys.length) { state.filters.from = ''; state.filters.to = ''; }
      renderAll();
    });

    /* tema */
    var themeButton = $('themeButton'), themeMenu = $('themeMenu');
    themeButton.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var open = themeMenu.classList.toggle('show');
      themeButton.setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('#themeMenu .theme-option').forEach(function (b) {
      b.addEventListener('click', function () {
        applyTheme(b.dataset.theme);
        themeMenu.classList.remove('show');
        themeButton.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', function (ev) {
      if (!themeMenu.contains(ev.target) && ev.target !== themeButton) {
        themeMenu.classList.remove('show');
        themeButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    if (window.Chart) {
      Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
      Chart.defaults.font.size = 11;
      Chart.defaults.color = tickColor();
    }
    loadStore();
    buildEntries();
    if (state.keys.length) {
      state.filters.from = state.keys[0];
      state.filters.to = state.keys[state.keys.length - 1];
    }
    bind();
    var current = 'dark';
    try { var t = localStorage.getItem('spot_dashboard_theme_v1'); if (t === 'light') current = 'light'; } catch (e) { }
    document.querySelectorAll('#themeMenu .theme-option').forEach(function (b) { b.classList.toggle('active', b.dataset.theme === current); });
    renderAll();
    bindCaptureButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
