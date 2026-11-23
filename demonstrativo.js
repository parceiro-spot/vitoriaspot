/* ==========================================================================
   DEMONSTRATIVO DE PREJUÍZO  (Sinistro > Demonstrativo)
   - Lê várias DANFEs (PDF) de uma vez
   - ID = nome do arquivo (ex.: 48054508351_17.pdf)
   - Pega: chave de acesso, número da NF, item (descrição), quantidade e
     VALOR TOTAL DA NOTA
   - ID repetido  -> 48054508351_17, 48054508351_17-1, 48054508351_17-2 ...
   - Nome com (PARTE 2) é mantido: '48569637323 (PARTE 2)'; se repetir -> '48569637323 (PARTE 2)-1'
   - Nota fora do padrão / ilegível -> avisa o ID no painel de observações
   - Exporta no mesmo formato da planilha modelo (XLSX) e em PDF
   ========================================================================== */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Utilidades                                                         */
  /* ------------------------------------------------------------------ */
  var norm = function (s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/\s+/g, ' ').trim();
  };
  var MONEY = /^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/;
  var toNum = function (s) { return Number(String(s).replace(/\./g, '').replace(',', '.')); };
  var cents = function (n) { return Math.round(n * 100); };

  function formatChave(d) { return String(d).replace(/(\d{4})(?=\d)/g, '$1 '); }
  function formatNF(n) { return String(n).padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3'); }
  function formatBRL(n) {
    return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // dígito verificador da chave de acesso (módulo 11)
  function chaveDVok(k) {
    if (!/^\d{44}$/.test(k)) return false;
    var w = 2, sum = 0;
    for (var i = 42; i >= 0; i--) { sum += Number(k[i]) * w; w = w === 9 ? 2 : w + 1; }
    var r = sum % 11, dv = (r === 0 || r === 1) ? 0 : 11 - r;
    return dv === Number(k[43]);
  }

  // agrupa itens de texto em linhas (mesmo y) -> [{y, items[], text}]
  function groupLines(items) {
    var sorted = items.slice().sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var lines = [];
    sorted.forEach(function (it) {
      var l = lines[lines.length - 1];
      if (l && Math.abs(l.y - it.y) <= 2.5) l.items.push(it);
      else lines.push({ y: it.y, items: [it] });
    });
    lines.forEach(function (l) {
      l.items.sort(function (a, b) { return a.x - b.x; });
      l.text = l.items.map(function (i) { return i.s; }).join(' ');
    });
    return lines;
  }

  function findChave(pages) {
    var strict = /^\s*(?:\d{4}\s?){10}\d{4}\s*$/;
    var loose = /(?:^|\D)((?:\d{4}\s?){10}\d{4})(?!\d)/;
    var p, i;
    for (p = 0; p < pages.length; p++) {
      for (i = 0; i < pages[p].items.length; i++) {
        var s = pages[p].items[i].s;
        if (strict.test(s)) return s.replace(/\s/g, '');
      }
    }
    for (p = 0; p < pages.length; p++) {
      var lines = groupLines(pages[p].items);
      for (i = 0; i < lines.length; i++) {
        var m = loose.exec(lines[i].text);
        if (m) return m[1].replace(/\s/g, '');
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Leitura do DANFE (a partir dos itens de texto com posição)         */
  /*  pages = [{ items:[{s,x,y,w}], width }]                             */
  /* ------------------------------------------------------------------ */
  function parseDanfe(pages) {
    var out = { ok: false, errors: [], warnings: [] };
    var total = pages.reduce(function (n, p) { return n + p.items.length; }, 0);
    if (!total) { out.errors.push('PDF sem texto selecionável (imagem/escaneado)'); return out; }

    // 1) chave de acesso + número da NF
    var chave = findChave(pages);
    if (!chave) { out.errors.push('chave de acesso não encontrada (não parece um DANFE padrão)'); return out; }
    if (!chaveDVok(chave)) { out.errors.push('chave de acesso inválida (dígito verificador não confere)'); return out; }
    out.chave = chave;
    out.nf = Number(chave.substr(25, 9));

    var items = pages[0].items, pageW = pages[0].width || 595;
    var find = function (re) { return items.filter(function (i) { return re.test(norm(i.s)); }); };

    // 2) VALOR TOTAL DA NOTA  (valor logo abaixo do rótulo)
    var lbl = find(/VALOR TOTAL DA NOTA/)[0];
    if (!lbl) { out.errors.push('campo "VALOR TOTAL DA NOTA" não encontrado (layout diferente)'); return out; }
    var vals = items.filter(function (i) {
      return MONEY.test(i.s.trim()) && i.y < lbl.y && (lbl.y - i.y) <= 30 &&
        i.x >= lbl.x - 3 && i.x <= pageW;
    }).sort(function (a, b) { return (lbl.y - a.y) - (lbl.y - b.y); });
    if (!vals.length) { out.errors.push('valor da nota não encontrado abaixo de "VALOR TOTAL DA NOTA"'); return out; }
    out.valor = toNum(vals[0].s.trim());
    if (!(out.valor > 0)) { out.errors.push('valor total da nota zerado/inválido'); return out; }

    // 3) tabela de produtos
    var hDesc = find(/^DESCRI.*PRODUTO/)[0];
    var hNcm = find(/^NCM/)[0];
    var hQtd = find(/^(QTD|QUANT)/).filter(function (i) { return hNcm && i.y < hNcm.y + 6 && i.y > hNcm.y - 6; })[0];
    var hCod = find(/^CODIGO$/)[0];
    var issqn = find(/CALCULO DO ISSQN/)[0] || find(/^DADOS ADICIONAIS/)[0];
    if (!hDesc || !hNcm || !hQtd || !issqn) {
      out.errors.push('tabela de produtos fora do padrão (cabeçalho não reconhecido)'); return out;
    }
    var yTop = Math.min(hDesc.y, hNcm.y) - 6, yBottom = issqn.y;
    var inArea = items.filter(function (i) { return i.y < yTop && i.y > yBottom; });

    var anchors = inArea.filter(function (i) {
      return /^\d{8}$/.test(i.s.trim()) && i.x >= hNcm.x - 25 && i.x <= hNcm.x + hNcm.w + 25;
    }).sort(function (a, b) { return b.y - a.y; });
    if (!anchors.length) { out.errors.push('nenhum item encontrado na nota'); return out; }

    var descMin = hCod ? ((hCod.x + hCod.w) + hDesc.x) / 2 : hDesc.x - 8;
    var descMax = hNcm.x - 4;
    var descItems = inArea.filter(function (i) { return i.x >= descMin && i.x < descMax; });
    var qtdCenter = hQtd.x + hQtd.w / 2;

    var rows = anchors.map(function () { return { parts: [], qtd: null }; });
    descItems.forEach(function (it) {
      var best = 0, bd = Infinity;
      anchors.forEach(function (a, k) { var d = Math.abs(a.y - it.y); if (d < bd) { bd = d; best = k; } });
      rows[best].parts.push(it);
    });
    anchors.forEach(function (a, k) {
      var tokens = inArea.filter(function (i) { return Math.abs(i.y - a.y) <= 3 && i.x > a.x + a.w; });
      var numeric = tokens.filter(function (i) { return /^\d+(?:[.,]\d+)*$/.test(i.s.trim()); });
      var best = null, bd = Infinity;
      numeric.forEach(function (t) {
        var d = Math.abs((t.x + t.w / 2) - qtdCenter);
        if (d < bd) { bd = d; best = t; }
      });
      if (best) rows[k].qtd = toNum(best.s.trim());
      rows[k].parts.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      rows[k].desc = rows[k].parts.map(function (p) { return p.s; }).join(' ').replace(/\s+/g, ' ').trim();
    });
    for (var r = 0; r < rows.length; r++) {
      if (!rows[r].desc) { out.errors.push('descrição do item ' + (r + 1) + ' não encontrada'); return out; }
    }

    out.itens = rows.map(function (x) { return { desc: x.desc, qtd: x.qtd }; });
    out.item = out.itens[0].desc; // nota com vários itens: copia sempre a descrição do 1º item
    out.qtd = 1; // quantidade padrão do demonstrativo
    if (out.itens.length > 1) out.warnings.push('nota com ' + out.itens.length + ' itens — foi copiada só a descrição do 1º item (quantidade 1)');
    if (pages.length > 1) out.warnings.push('nota com ' + pages.length + ' páginas — só a 1ª página foi lida para os itens; confira');
    out.ok = true;
    return out;
  }

  /* ------------------------------------------------------------------ */
  /*  Nome do arquivo -> ID                                              */
  /* ------------------------------------------------------------------ */
  function splitFileName(fileName) {
    // O nome do arquivo é respeitado exatamente como está (inclusive "(PARTE 2)").
    // Só muda depois, no assemble(), se houver outro arquivo com o mesmo nome (-1, -2...).
    var name = String(fileName).replace(/\.pdf$/i, '').replace(/\s+/g, ' ').trim();
    return { baseId: name, copyIndex: 0, part: 0 };
  }

  /* ------------------------------------------------------------------ */
  /*  Monta o demonstrativo + observações                                */
  /*  entries = [{key,fileName,baseId,copyIndex,seq,res}]                */
  /* ------------------------------------------------------------------ */
  function assemble(entries) {
    var alerts = [], good = [];
    entries.slice().sort(function (a, b) { return a.seq - b.seq; }).forEach(function (e) {
      if (e.res && e.res.ok) good.push(e);
      else alerts.push({
        type: 'erro', id: e.baseId, file: e.fileName,
        text: 'Nota não reconhecida e NÃO incluída no demonstrativo: ' + ((e.res && e.res.errors && e.res.errors[0]) || 'erro ao ler o arquivo') + '.'
      });
    });

    // mesma NF (chave) enviada duas vezes -> ignora a repetição
    var seenChave = {}, unique = [];
    good.forEach(function (e) {
      var k = e.res.chave;
      if (seenChave[k]) {
        alerts.push({
          type: 'repetida', id: e.baseId, file: e.fileName,
          text: (seenChave[k].baseId === e.baseId
            ? 'Mesmo ID e mesmas informações de nota (NF ' + e.res.nf + ', mesma chave de acesso) nos arquivos "' + seenChave[k].fileName + '" e "' + e.fileName + '". Foi mantida só uma no demonstrativo (não renomeei para -1/-2 porque é a mesma nota). Confira se não era para ser outra nota.'
            : 'A NF ' + e.res.nf + ' já foi adicionada com o ID ' + seenChave[k].baseId + ' (mesma chave de acesso). Esta repetição foi ignorada para não duplicar o valor.')
        });
      } else { seenChave[k] = e; e.part = e.part || 0; unique.push(e); }
    });

    // agrupa por ID (mantém a ordem de chegada do 1º de cada ID)
    var groups = {}, order = [];
    unique.forEach(function (e) {
      if (!groups[e.baseId]) { groups[e.baseId] = []; order.push(e.baseId); }
      groups[e.baseId].push(e);
    });
    var used = {};
    order.forEach(function (b) { used[b.toUpperCase()] = true; });

    var rows = [], renamed = 0;
    order.forEach(function (base) {
      var g = groups[base].slice().sort(function (a, b) { return a.seq - b.seq; });
      var n = 0, changes = [];
      g.forEach(function (e, idx) {
        var id = base, isRen = idx > 0;
        if (idx > 0) {
          do { n++; id = base + '-' + n; } while (used[id.toUpperCase()]);
          used[id.toUpperCase()] = true; renamed++;
          changes.push(id + ' (NF ' + String(e.res.nf) + ')');
        }
        rows.push({
          key: e.key, id: id, baseId: base, renamed: isRen,
          chave: formatChave(e.res.chave), nf: e.res.nf, item: e.res.item,
          qtd: e.res.qtd, valor: e.res.valor, status: 'SINISTRADA', warnings: e.res.warnings.slice()
        });
        e.res.warnings.forEach(function (w) { alerts.push({ type: 'atencao', id: id, file: e.fileName, text: w.charAt(0).toUpperCase() + w.slice(1) + '.' }); });
        if (!/^\d+(?:_\d+)?(?: \(PARTE \d+\))?$/i.test(base) && idx === 0) {
          alerts.push({ type: 'atencao', id: base, file: e.fileName, text: 'Nome do arquivo fora do padrão de ID (ex.: 48054508351_17, 48569637323 ou 48569637323 (PARTE 2)). O nome foi mantido como está; confira se é mesmo o ID correto.' });
          rows[rows.length - 1].warnings.push('nome fora do padrão');
        }
      });
      if (g.length > 1) {
        alerts.push({
          type: 'duplicado', id: base,
          text: 'O nome ' + base + ' apareceu em ' + g.length + ' notas (NF ' + g.map(function (e) { return e.res.nf; }).join(', ') +
            '). A 1ª manteve o nome ' + base + ' e as demais ficaram como: ' + changes.join(', ') + '.'
        });
        // repetido com as MESMAS informações da 1ª nota? (NF, descrição, quantidade e valor)
        var f = g[0];
        g.slice(1).forEach(function (e, i) {
          var same = [];
          if (String(e.res.nf) === String(f.res.nf)) same.push('mesma NF (' + e.res.nf + ')');
          if (norm(e.res.item) === norm(f.res.item)) same.push('mesma descrição');
          if (Number(e.res.qtd) === Number(f.res.qtd)) same.push('mesma quantidade');
          if (cents(e.res.valor) === cents(f.res.valor)) same.push('mesmo valor');
          if (same.length === 4) {
            alerts.push({
              type: 'igual', id: base + '-' + (i + 1),
              text: 'Nota repetida com as MESMAS informações da nota ' + base + ': ' + same.join(', ') +
                '. Ela foi mantida no demonstrativo como ' + base + '-' + (i + 1) + ' e o valor está sendo somado de novo. Confira se não é a mesma nota enviada duas vezes.'
            });
          }
        });
      }
    });

    var totalCents = rows.reduce(function (n, r) { return n + cents(r.valor); }, 0);
    var rank = { erro: 0, repetida: 1, igual: 2, duplicado: 3, atencao: 4 };
    alerts.sort(function (a, b) { return rank[a.type] - rank[b.type]; });
    return { rows: rows, alerts: alerts, stats: { notas: rows.length, total: totalCents / 100, renomeados: renamed, problemas: alerts.filter(function (a) { return a.type === 'erro' || a.type === 'repetida' || a.type === 'igual'; }).length } };
  }

  /* ------------------------------------------------------------------ */
  /*  Exportação XLSX (mesmo formato da planilha modelo)                 */
  /* ------------------------------------------------------------------ */
  var HEADERS = ['SHP_SHIPMENT_ID', 'TMS_DATA_FISCAL_NFE', 'NF', 'ITEM', 'QUANTIDADE ITEM', 'VALOR', 'STATUS'];

  async function buildXlsx(ExcelJS, rows) {
    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet('DEMONSTRATIVO DE PREJUÍZO', {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    var maxId = rows.reduce(function (m, r) { return Math.max(m, String(r.id).length); }, 0);
    var widths = [Math.max(19, maxId + 3), 54.88, 12.88, 98.88, 19, 14.75, 17.13];   // ID grande estica a coluna A
    widths.forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    var thin = { style: 'thin', color: { argb: 'FF000000' } };
    var border = { left: thin, right: thin, top: thin, bottom: thin };
    var font = { name: 'Arial', size: 11, color: { argb: 'FF000000' } };
    var align = { horizontal: 'center', vertical: 'middle' };
    var FMT_NF = '000"."000"."000', FMT_BRL = '[$R$ -416]#,##0.00';

    var head = ws.addRow(HEADERS);
    head.height = 15.75;
    var data = rows.map(function (r) { return [r.id, r.chave, r.nf, r.item, r.qtd, r.valor, r.status]; });
    data.forEach(function (d) { ws.addRow(d).height = 15.75; });

    ws.eachRow(function (row, n) {
      row.eachCell({ includeEmpty: true }, function (cell, c) {
        cell.font = (n === 1 && (c === 1 || c === 5)) ? { name: 'Arial', size: 10, color: { argb: 'FF000000' } } : font;
        cell.alignment = align; cell.border = border;
        if (n > 1) {
          if (c === 3) cell.numFmt = FMT_NF;
          if (c === 6) cell.numFmt = FMT_BRL;
        }
      });
    });
    return wb.xlsx.writeBuffer();
  }

  /* ------------------------------------------------------------------ */
  /*  Exportação PDF                                                     */
  /* ------------------------------------------------------------------ */
  function buildPdf(jsPDF, autoTable, rows) {
    // Igual ao PDF modelo: A4 paisagem, Arial (helvetica) 5,6pt em TODAS as linhas
    // (cabeçalho SHP_SHIPMENT_ID e QUANTIDADE ITEM em 5,1pt). A fonte nunca diminui:
    // descrição grande quebra em 2 linhas, mantendo o mesmo tamanho.
    var doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    var body = rows.map(function (r) {
      return [r.id, r.chave, formatNF(r.nf), r.item, Number(r.qtd).toLocaleString('pt-BR'), formatBRL(r.valor), r.status];
    });
    // Colunas SHP_SHIPMENT_ID, TMS_DATA_FISCAL_NFE e NF: esticadas pelo texto mais comprido (sem quebra).
    // A coluna ITEM (descrição) fica com o espaço que sobrar.
    doc.setFont('helvetica', 'normal');
    var need = [0, 0, 0];
    [0, 1, 2].forEach(function (c) {
      doc.setFontSize(5.6);
      body.forEach(function (r) { need[c] = Math.max(need[c], doc.getTextWidth(String(r[c]))); });
      doc.setFontSize(c === 0 ? 5.1 : 5.6);
      need[c] = Math.max(need[c], doc.getTextWidth(HEADERS[c]));
    });
    var PAD = 7;   // folga (padding + margem de segurança) em pt
    var minW = [59.6, 172.1, 40.4];
    var w = need.map(function (n, c) { return Math.max(minW[c], Math.ceil(n + PAD)); });
    var wE = 59.6, wF = 46.3, wG = 53.5;
    var wD = 741.6 - (w[0] + w[1] + w[2] + wE + wF + wG);
    if (wD < 150) wD = 150;   // segurança: descrição nunca fica espremida demais
    var tableW = w[0] + w[1] + w[2] + wD + wE + wF + wG;
    autoTable(doc, {
      head: [HEADERS], body: body, theme: 'grid',
      margin: { top: 54, right: 50.4, bottom: 54, left: 50.4 },
      tableWidth: tableW,
      styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 5.6, cellPadding: 0.8, halign: 'center', valign: 'middle', textColor: 0, lineColor: 0, lineWidth: 0.25, overflow: 'linebreak' },
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'normal', fontSize: 5.6, lineColor: 0, lineWidth: 0.25 },
      columnStyles: { 0: { cellWidth: w[0], overflow: 'visible' }, 1: { cellWidth: w[1], overflow: 'visible' }, 2: { cellWidth: w[2], overflow: 'visible' }, 3: { cellWidth: wD }, 4: { cellWidth: wE }, 5: { cellWidth: wF }, 6: { cellWidth: wG } },
      showHead: 'everyPage',
      didParseCell: function (h) {
        if (h.section === 'head' && (h.column.index === 0 || h.column.index === 4)) h.cell.styles.fontSize = 5.1;
      }
    });
    return doc;
  }

  var api = {
    parseDanfe: parseDanfe, assemble: assemble, splitFileName: splitFileName,
    buildXlsx: buildXlsx, buildPdf: buildPdf, chaveDVok: chaveDVok,
    formatChave: formatChave, formatNF: formatNF, formatBRL: formatBRL
  };
  root.DemoCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ================================================================== */
  /*  INTERFACE (só roda no navegador)                                   */
  /* ================================================================== */
  if (typeof document === 'undefined') return;

  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var entries = [], seq = 0, seen = {}, workerReady = false;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  async function ensurePdfJs() {
    if (!root.pdfjsLib) throw new Error('Biblioteca de leitura de PDF não carregou. Verifique a internet e recarregue a página (F5).');
    if (workerReady) return;
    try {
      var r = await fetch(PDFJS_WORKER);
      var blob = await r.blob();
      root.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    } catch (e) { root.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; }
    workerReady = true;
  }

  async function readPdf(file) {
    var buf = await file.arrayBuffer();
    var doc = await root.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    var pages = [];
    for (var p = 1; p <= doc.numPages; p++) {
      var page = await doc.getPage(p);
      var vp = page.getViewport({ scale: 1 });
      var tc = await page.getTextContent();
      pages.push({
        width: vp.width,
        items: tc.items.filter(function (i) { return i.str && i.str.trim(); })
          .map(function (i) { return { s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }; })
      });
    }
    return pages;
  }

  function setProgress(text) {
    var el = $('demo-progress');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
  }

  async function addFiles(fileList) {
    var files = Array.from(fileList);
    var pdfs = files.filter(function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    var skipped = files.length - pdfs.length;
    var already = 0;
    pdfs = pdfs.filter(function (f) {
      var sig = f.name + '|' + f.size + '|' + f.lastModified;
      if (seen[sig]) { already++; return false; }
      seen[sig] = true; f.__sig = sig; return true;
    });
    // Mantém a MESMA ordem em que os arquivos foram enviados (a ordem da pasta do PC). Não reordena por nome.
    if (!pdfs.length && !skipped && !already) return;

    try { await ensurePdfJs(); } catch (e) { setProgress('⚠️ ' + e.message); return; }

    for (var i = 0; i < pdfs.length; i++) {
      var f = pdfs[i];
      setProgress('Lendo notas… ' + (i + 1) + ' de ' + pdfs.length);
      var parts = splitFileName(f.name), res;
      try { res = parseDanfe(await readPdf(f)); }
      catch (e) { res = { ok: false, errors: ['não foi possível abrir o PDF (arquivo corrompido ou protegido)'], warnings: [] }; }
      entries.push({ key: 'e' + (++seq), seq: seq, file: f, fileName: f.name, sig: f.__sig, baseId: parts.baseId, copyIndex: parts.copyIndex, part: parts.part, res: res });
    }
    setProgress('');
    extraNotes = [];
    if (skipped) extraNotes.push(skipped + ' arquivo(s) que não são PDF foram ignorados.');
    if (already) extraNotes.push(already + ' arquivo(s) já adicionados antes foram ignorados.');
    render();
  }
  var extraNotes = [];

  var ICON = { erro: '❌', repetida: '♻️', igual: '🚨', duplicado: '🔁', atencao: '⚠️' };
  var LABEL = { erro: 'NÃO RECONHECIDA', repetida: 'NF REPETIDA', igual: 'REPETIDA E IGUAL', duplicado: 'ID REPETIDO', atencao: 'ATENÇÃO' };

  function render() {
    var a = assemble(entries);
    current = a;
    var has = entries.length > 0;
    $('demo-results').classList.toggle('hidden', !has);
    $('demo-stat-notas').textContent = a.stats.notas;
    $('demo-stat-total').textContent = formatBRL(a.stats.total);
    $('demo-stat-ren').textContent = a.stats.renomeados;
    $('demo-stat-prob').textContent = a.stats.problemas;
    $('demo-stat-prob').parentElement.classList.toggle('demo-stat-bad', a.stats.problemas > 0);

    var obs = $('demo-obs');
    var parts = a.alerts.map(function (x) {
      return '<li class="demo-obs-' + x.type + '"><span class="demo-obs-tag">' + ICON[x.type] + ' ' + LABEL[x.type] + '</span> ' +
        '<strong>' + esc(x.id) + '</strong> — ' + esc(x.text) + (x.file ? ' <em>(arquivo: ' + esc(x.file) + ')</em>' : '') + '</li>';
    });
    extraNotes.forEach(function (t) { parts.push('<li class="demo-obs-atencao"><span class="demo-obs-tag">ℹ️ INFO</span> ' + esc(t) + '</li>'); });
    obs.innerHTML = parts.length
      ? '<h4>📌 Observações (não vão para o demonstrativo)</h4><ul>' + parts.join('') + '</ul>'
      : '<p class="demo-ok">✅ Todas as notas foram reconhecidas e nenhum ID está repetido.</p>';

    var warnKeys = {};
    entries.forEach(function (e) { if (e.res && e.res.ok && e.res.warnings.length) warnKeys[e.key] = true; });
    $('demo-tbody').innerHTML = a.rows.map(function (r) {
      var flag = r.renamed ? ' demo-row-renamed' : (r.warnings.length ? ' demo-row-warn' : '');
      return '<tr class="' + flag.trim() + '"><td>' + esc(r.id) + '</td><td class="demo-mono">' + esc(r.chave) + '</td><td>' + esc(formatNF(r.nf)) +
        '</td><td class="demo-left" title="' + esc(r.item) + '">' + esc(r.item) + '</td><td>' + esc(Number(r.qtd).toLocaleString('pt-BR')) + '</td><td>' + esc(formatBRL(r.valor)) + '</td><td>' + esc(r.status) +
        '</td><td><button type="button" class="demo-x" data-demo-remove="' + esc(r.key) + '" title="Remover esta nota">✕</button></td></tr>';
    }).join('') || '<tr><td colspan="8" class="demo-empty">Nenhuma nota reconhecida ainda.</td></tr>';

    var dis = a.rows.length === 0;
    $('demo-btn-xlsx').disabled = dis; $('demo-btn-pdf').disabled = dis;
    $('demo-btn-notas').disabled = dis;
    $('demo-btn-notas').textContent = '⬇ BAIXAR AS ' + a.rows.length + ' NOTAS';
  }
  var current = { rows: [], alerts: [], stats: {} };

  function fileBase() {
    var d = ($('demo-driver').value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ');
    return 'DEMONSTRATIVO DE PREJUÍZO' + (d ? ' - ' + d : '');
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1500);
  }

  async function exportXlsx() {
    if (!current.rows.length) return;
    if (!root.ExcelJS) { alert('Biblioteca de Excel não carregou. Verifique a internet e recarregue (F5).'); return; }
    var buf = await buildXlsx(root.ExcelJS, current.rows);
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileBase() + '.xlsx');
  }
  function exportPdf() {
    if (!current.rows.length) return;
    if (!(root.jspdf && root.jspdf.jsPDF)) { alert('Biblioteca de PDF não carregou. Verifique a internet e recarregue (F5).'); return; }
    var jsPDF = root.jspdf.jsPDF;
    var at = function (doc, opts) { if (typeof doc.autoTable === 'function') return doc.autoTable(opts); return root.jspdf.autoTable(doc, opts); };
    var doc = buildPdf(jsPDF, at, current.rows);
    download(doc.output('blob'), fileBase() + '.pdf');
  }

  // ZIP só com as notas que entraram no demonstrativo, nomeadas com o ID final (-1, -2...)
  async function exportNotas() {
    if (!current.rows.length) return;
    if (!root.JSZip) { alert('Biblioteca de ZIP não carregou. Verifique a internet e recarregue (F5).'); return; }
    var zip = new root.JSZip(), byKey = {};
    entries.forEach(function (e) { byKey[e.key] = e; });
    current.rows.forEach(function (r) {
      var e = byKey[r.key];
      if (e && e.file) zip.file(r.id.replace(/[\\/:*?"<>|]+/g, '_') + '.pdf', e.file);
    });
    var blob = await zip.generateAsync({ type: 'blob' });
    var d = ($('demo-driver').value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ');
    download(blob, 'NOTAS FISCAIS' + (d ? ' - ' + d : '') + '.zip');
  }

  function init() {
    var drop = $('demo-drop'), input = $('demo-file');
    if (!drop || !input) return;
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
    $('demo-btn-xlsx').addEventListener('click', exportXlsx);
    $('demo-btn-pdf').addEventListener('click', exportPdf);
    $('demo-btn-notas').addEventListener('click', exportNotas);
    // ---- Desfazer (Ctrl+Z) para remoção de nota (✕) e "Limpar tudo" ----
    var undoStack = [], toastTimer = null;
    var toast = document.createElement('div');
    toast.className = 'demo-toast hidden';
    toast.innerHTML = '<span id="demo-toast-msg"></span><button type="button" id="demo-toast-undo">↩ Desfazer (Ctrl+Z)</button>';
    document.body.appendChild(toast);
    function showToast(msg) {
      document.getElementById('demo-toast-msg').textContent = msg;
      toast.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 8000);
    }
    function pushUndo(removed, msg) {
      if (!removed.length) return;
      undoStack.push(removed);
      showToast(msg);
    }
    function undo() {
      var removed = undoStack.pop();
      if (!removed) return false;
      var back = 0;
      removed.forEach(function (e) {
        if (e.sig && seen[e.sig]) return;            // o mesmo arquivo já foi adicionado de novo
        if (e.sig) seen[e.sig] = true;
        entries.push(e); back++;
      });
      entries.sort(function (a, b) { return a.seq - b.seq; });   // volta para a mesma posição de antes
      extraNotes = []; render();
      if (undoStack.length) showToast('Restaurado. Ainda dá para desfazer mais ' + undoStack.length + ' ação(ões).');
      else toast.classList.add('hidden');
      return true;
    }
    document.getElementById('demo-toast-undo').addEventListener('click', undo);
    document.addEventListener('keydown', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.altKey || String(ev.key).toLowerCase() !== 'z') return;
      var t = ev.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;   // não atrapalha o Ctrl+Z de digitação
      if (!drop.offsetParent) return;                 // só quando a aba Demonstrativo está aberta
      if (undo()) ev.preventDefault();
    });

    $('demo-btn-clear').addEventListener('click', function () {
      if (entries.length && !confirm('Limpar todas as notas carregadas?')) return;
      var all = entries.slice();
      entries = []; seen = {}; extraNotes = []; render();
      pushUndo(all, 'Todas as notas foram removidas.');
    });
    $('demo-tbody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-demo-remove]'); if (!b) return;
      var k = b.getAttribute('data-demo-remove'), removed = [];
      entries = entries.filter(function (x) { if (x.key === k) { delete seen[x.sig]; removed.push(x); return false; } return true; });
      extraNotes = []; render();
      pushUndo(removed, 'Nota removida.');
    });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})(typeof window !== 'undefined' ? window : globalThis);
