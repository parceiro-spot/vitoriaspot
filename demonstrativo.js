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
    if (n == null || n === '' || isNaN(Number(n))) return '';
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

  // O PDF pode separar o título da DACE em vários itens de texto, ou colocá-lo
  // em uma página diferente da primeira. Junta todo o texto normalizado para
  // reconhecer o documento sem depender da diagramação do fornecedor.
  function allPagesText(pages) {
    return pages.map(function (p) {
      return p.items.map(function (i) { return norm(i.s); }).join(' ');
    }).join(' ');
  }

  function cleanDescription(s) {
    return String(s || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ------------------------------------------------------------------ */
  /*  Leitura do DANFE (a partir dos itens de texto com posição)         */
  /*  pages = [{ items:[{s,x,y,w}], width }]                             */
  /* ------------------------------------------------------------------ */
  function parseDanfe(pages) {
    var out = { ok: false, errors: [], warnings: [] };
    var total = pages.reduce(function (n, p) { return n + p.items.length; }, 0);
    if (!total) { out.errors.push('PDF sem texto selecionável (imagem/escaneado)'); return out; }

    // 0) Declaração de conteúdo (DC-e / DACE): documento de transporte sem
    // valor fiscal. O título costuma vir quebrado em vários itens/páginas.
    var textoCompleto = allPagesText(pages);
    var ehDace = /\bDACE(?:\s+RESUMIDA)?\b/.test(textoCompleto) ||
      /\bDECLARACAO\s+AUXILIAR\s+DE\s+CONTEUDO\b/.test(textoCompleto) ||
      /\bCHAVE\s+DE\s+ACESSO\s+DA\s+DC-?E\b/.test(textoCompleto);
    var ehDeclaracaoConteudo = /\bDECLARACAO\s+(?:DE\s+)?CONTEUDO\b/.test(textoCompleto);
    // Declaração de transporte simples (título só "DECLARAÇÃO"): tem USUARIO EMITENTE / MODALIDADE DO TRANSPORTE e não é DANFE.
    var ehDeclaracaoTransporte = /\bDECLARACAO\b/.test(textoCompleto) &&
      /\bMODALIDADE\s+DO\s+TRANSPORTE\b/.test(textoCompleto) &&
      /\bUSUARIO\s+EMITENTE\b/.test(textoCompleto) && !/\bDANFE\b/.test(textoCompleto);
    if (ehDace || ehDeclaracaoConteudo || ehDeclaracaoTransporte) {
      out.ignored = true; out.ignoreReason = 'declaração de conteúdo (DC-e) sem valor';
      out.docTitle = textoCompleto.match(/(?:DACE[^ ]*(?:\s+RESUMIDA)?|DECLARACAO\s+(?:AUXILIAR\s+DE\s+)?CONTEUDO)/i);
      out.docTitle = out.docTitle ? out.docTitle[0] : 'Declaração auxiliar de conteúdo';
      return out;
    }

    // 1) chave de acesso + número da NF
    var chave = findChave(pages);
    if (!chave) { out.errors.push('chave de acesso não encontrada (não parece um DANFE padrão)'); return out; }
    if (!chaveDVok(chave)) { out.errors.push('chave de acesso inválida (dígito verificador não confere)'); return out; }
    out.chave = chave;
    out.nf = Number(chave.substr(25, 9));

    var items = pages[0].items, pageW = pages[0].width || 595;
    var find = function (re) { return items.filter(function (i) { return re.test(norm(i.s)); }); };
    var review = out.review = [];          // motivos pelos quais a nota precisa de revisão (layout estranho)

    // 2) VALOR TOTAL DA NOTA  (valor logo abaixo do rótulo)
    out.valor = null;
    var lbl = find(/VALOR TOTAL DA NOTA/)[0];
    if (!lbl) review.push('campo "VALOR TOTAL DA NOTA" não encontrado (layout diferente)');
    else {
      var vals = items.filter(function (i) {
        return MONEY.test(i.s.trim()) && i.y < lbl.y && (lbl.y - i.y) <= 30 && i.x >= lbl.x - 3 && i.x <= pageW;
      }).sort(function (a, b) { return (lbl.y - a.y) - (lbl.y - b.y); });
      if (!vals.length) review.push('valor da nota não encontrado abaixo de "VALOR TOTAL DA NOTA"');
      else {
        var v = toNum(vals[0].s.trim());
        if (v > 0) out.valor = v; else review.push('valor total da nota zerado/inválido');
      }
    }

    // 3) itens
    var itens = readItens(items, find, review);
    out.itens = itens || [];
    out.item = itens ? cleanDescription(itens[0].desc) : '';
    out.qtd = 1; // quantidade padrão do demonstrativo
    if (itens && itens.length > 1) out.warnings.push('nota com ' + itens.length + ' itens — foi copiada só a descrição do 1º item (quantidade 1)');
    if (pages.length > 1) out.warnings.push('nota com ' + pages.length + ' páginas — só a 1ª página foi lida para os itens; confira');
    if (review.length) { out.partial = true; return out; }   // tem chave de NF-e, mas o layout não foi lido por completo
    out.ok = true;
    return out;
  }

  // Lê as descrições dos itens (2 layouts conhecidos). Em caso de dúvida devolve null e registra o motivo em review.
  function readItens(items, find, review) {
    var hDesc = find(/^DESCRI.*PRODUTO/)[0];
    var hCstCfop = find(/^CST \/ CFOP/)[0];
    var fail = function (m) { review.push(m); return null; };

    if (hDesc && hCstCfop) {                       // layout novo (IBS/CBS): cada item é um bloco que começa em "CÓD:"
      var issqnB = find(/CALCULO DO ISSQN|^DADOS ADICIONAIS/).filter(function (i) { return i.y < hDesc.y; }).sort(function (x, y) { return y.y - x.y; })[0];
      if (!issqnB) return fail('tabela de produtos fora do padrão (rodapé não reconhecido)');
      var yTopB = hDesc.y - 4, xMinB = hDesc.x - 3, xMaxB = hCstCfop.x - 3;
      var areaB = items.filter(function (i) { return i.y < yTopB && i.y > issqnB.y && i.x >= xMinB && i.x < xMaxB; });
      var ancB = areaB.filter(function (i) { return /^COD\s*:/.test(norm(i.s)); }).sort(function (a, b) { return b.y - a.y; });
      if (!ancB.length) return fail('nenhum item encontrado na nota');
      var descsB = ancB.map(function (a, k) {
        var yMax = a.y + 3, yMin = k + 1 < ancB.length ? ancB[k + 1].y + 3 : -Infinity;
        var bloco = areaB.filter(function (i) { return i.y <= yMax && i.y > yMin; });
        return groupLines(bloco).map(function (l) { return cleanDescription(l.text); }).filter(function (t) {
          var n = norm(t);
          return t && !/^COD\s*:/.test(n) && !/^NCM\s*:/.test(n) && !/^(REFERENCIA|REF)\s*:/.test(n) &&
            !/^(EAN|GTIN|SKU)\b/.test(n) && !/^[A-Z]_\d{6,}$/.test(n);
        }).join(' ').trim();
      });
      for (var q = 0; q < descsB.length; q++) if (!descsB[q]) return fail('descrição do item ' + (q + 1) + ' não encontrada');
      return descsB.map(function (d) { return { desc: cleanDescription(d), qtd: 1 }; });
    }

    // layout clássico: colunas CÓDIGO | DESCRIÇÃO | NCM/SH | CST | CFOP | UN | QTD ...
    var hNcm = find(/^NCM/)[0];
    var hQtd = find(/^(QTD|QUANT)/).filter(function (i) { return hNcm && i.y < hNcm.y + 6 && i.y > hNcm.y - 6; })[0];
    var hCod = find(/^CODIGO$/)[0];
    var issqn = find(/CALCULO DO ISSQN/)[0] || find(/^DADOS ADICIONAIS/)[0];
    if (!hDesc || !hNcm || !hQtd || !issqn) return fail('tabela de produtos fora do padrão (cabeçalho não reconhecido)');
    var yTop = Math.min(hDesc.y, hNcm.y) - 6, yBottom = issqn.y;
    var inArea = items.filter(function (i) { return i.y < yTop && i.y > yBottom; });
    var anchors = inArea.filter(function (i) {
      return /^\d{8}$/.test(i.s.trim()) && i.x >= hNcm.x - 25 && i.x <= hNcm.x + hNcm.w + 25;
    }).sort(function (a, b) { return b.y - a.y; });
    if (!anchors.length) return fail('nenhum item encontrado na nota');
    var descMin = hCod ? ((hCod.x + hCod.w) + hDesc.x) / 2 : hDesc.x - 8;
    var descMax = hNcm.x - 4;
    var descItems = inArea.filter(function (i) { return i.x >= descMin && i.x < descMax; });
    var rows = anchors.map(function () { return { parts: [] }; });
    descItems.forEach(function (it) {
      var best = 0, bd = Infinity;
      anchors.forEach(function (a, k) { var d = Math.abs(a.y - it.y); if (d < bd) { bd = d; best = k; } });
      rows[best].parts.push(it);
    });
    for (var r = 0; r < rows.length; r++) {
      rows[r].parts.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      rows[r].desc = cleanDescription(rows[r].parts.map(function (p) { return p.s; }).join(' '));
      if (!rows[r].desc) return fail('descrição do item ' + (r + 1) + ' não encontrada');
    }
    return rows.map(function (x) { return { desc: x.desc, qtd: 1 }; });
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
  function parseMoney(t) {
    var x = String(t || '').replace(/[^\d.,]/g, '');
    if (!x) return null;
    if (x.indexOf(',') >= 0) x = x.replace(/\./g, '').replace(',', '.');
    var n = Number(x);
    return n > 0 ? n : null;
  }
  function detRow(e, papel, id) {
    return { papel: papel, id: id, file: e.fileName, nf: e.res.nf, chave: formatChave(e.res.chave), item: e.res.item, valor: e.res.valor };
  }
  function assemble(entries) {
    var alerts = [], good = [];
    var daces = [];
    entries.slice().sort(function (a, b) { return a.seq - b.seq; }).forEach(function (e) {
      if (e.res && e.res.ignored) { daces.push(e); return; }     // DACE resumida: de fato não entra (aviso único no final)
      if (e.res && e.res.partial) {
        // chave de NF-e válida, mas o layout não foi lido por completo -> vem INCLUÍDA por padrão, com opção de incluir / não incluir
        var ov = e.override || {};
        var item = (ov.item != null && ov.item !== '') ? ov.item : (e.res.item || '');
        var valor = ov.valor != null ? ov.valor : e.res.valor;
        var inc = e.include !== false;
        var falta = [];
        if (!item) falta.push('descrição');
        if (valor == null) falta.push('valor');
        alerts.push({
          type: 'revisar', id: e.baseId, file: e.fileName, key: e.key, include: inc, missing: { item: !item, valor: valor == null },
          item: item, valor: valor,
          details: { kind: 'revisar', title: 'Nota para revisar — ' + e.baseId, rows: [{ papel: inc ? 'Incluída (padrão)' : 'Não incluída', id: e.baseId, file: e.fileName, nf: e.res.nf, chave: formatChave(e.res.chave), item: item, valor: valor, motivo: e.res.review.join('; ') }] },
          text: 'Layout diferente do padrão — conferir. ' + e.res.review.join('; ') + '.' + (falta.length ? ' Faltou ler: ' + falta.join(' e ') + ' (preencha abaixo).' : ' Os dados foram lidos, mas confira.')
        });
        if (inc) {
          var res2 = Object.assign({}, e.res, { item: item, valor: valor, ok: true });
          good.push(Object.assign({}, e, { res: res2 }));
        }
        return;
      }
      if (e.res && e.res.ok) good.push(e);
      else {
        var errReason = (e.res && e.res.errors && e.res.errors[0]) || 'erro ao ler o arquivo';
        var manual = e.override || {};
        if (e.include === true) {
          var manualRes = Object.assign({}, e.res, {
            ok: true, nf: manual.nf ? Number(String(manual.nf).replace(/\D/g, '')) : null,
            chave: String(manual.chave || '').replace(/\s/g, ''), item: cleanDescription(manual.item || ''),
            valor: manual.valor != null ? parseMoney(manual.valor) : null, qtd: 1, warnings: []
          });
          good.push(Object.assign({}, e, { res: manualRes }));
        }
        alerts.push({
          type: 'erro', id: e.baseId, file: e.fileName, key: e.key, include: e.include === true,
          manual: manual,
          details: { title: 'Nota não reconhecida — ' + e.baseId, kind: 'erro', rows: [{ papel: e.include === true ? 'Incluída manualmente' : 'Não incluída', id: e.baseId, file: e.fileName, motivo: errReason }] },
          text: e.include === true
            ? 'Arquivo incluído manualmente, mas os dados precisam ser conferidos: ' + errReason + '.'
            : 'ID SEM PDF'
        });
      }
    });
    if (daces.length) {
      alerts.push({
        type: 'dace', id: daces.length + (daces.length === 1 ? ' declaração' : ' declarações'),
        details: { kind: 'dace', title: 'DACE resumida — declaração auxiliar de conteúdo', rows: daces.map(function (e) { return { papel: 'Não entra', id: e.baseId, file: e.fileName, titulo: e.res.docTitle || '' }; }) },
        text: 'DECLARAÇÃO AUXILIAR DE CONTEÚDO (DACE) — não entra no demonstrativo. IDs: ' + daces.map(function (e) { return e.baseId; }).join(', ') + '.'
      });
    }

    // mesma NF (chave) enviada duas vezes -> ignora a repetição
    var seenChave = {}, unique = [], duplicadasIguais = [], iguaisPorChave = 0;
    function mesmaNota(a, b) {
      return String(a.res.nf) === String(b.res.nf) &&
        norm(a.res.item) === norm(b.res.item) &&
        String(a.res.chave) === String(b.res.chave) &&
        Number(a.res.qtd) === Number(b.res.qtd) &&
        cents(a.res.valor) === cents(b.res.valor);
    }
    good.forEach(function (e) {
      var k = e.res.chave;
      if (seenChave[k]) {
        if (seenChave[k].baseId === e.baseId && mesmaNota(seenChave[k], e)) {
          iguaisPorChave++;
          duplicadasIguais.push(e);
        }
        alerts.push({
          type: 'repetida', id: e.baseId, file: e.fileName,
          details: { kind: 'repetida', title: 'Nota repetida — ' + e.baseId, rows: [detRow(seenChave[k], 'Mantida no demonstrativo', seenChave[k].baseId), detRow(e, 'Ignorada (é a mesma nota)', e.baseId)] },
          text: (seenChave[k].baseId === e.baseId && mesmaNota(seenChave[k], e)
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
      var n = 0, changes = [], ids = [];
      g.forEach(function (e, idx) {
        var id = base, isRen = idx > 0;
        if (idx > 0) {
          do { n++; id = base + '-' + n; } while (used[id.toUpperCase()]);
          used[id.toUpperCase()] = true; renamed++;
          changes.push(id + ' (NF ' + String(e.res.nf) + ')');
        }
        ids.push(id);
        rows.push({
          key: e.key, id: id, baseId: base, renamed: isRen,
          chave: formatChave(e.res.chave), nf: e.res.nf, item: e.res.item,
          qtd: e.res.qtd, valor: e.res.valor, status: 'SINISTRADA', warnings: e.res.warnings.slice(), incomplete: !e.res.item || e.res.valor == null
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
          details: { kind: 'duplicado', title: 'ID repetido — ' + base, rows: g.map(function (e, i) { return detRow(e, i === 0 ? 'Mantém o nome original' : 'Renomeada', ids[i]); }) },
          text: 'O nome ' + base + ' apareceu em ' + g.length + ' notas (NF ' + g.map(function (e) { return e.res.nf; }).join(', ') +
            '). A 1ª manteve o nome ' + base + ' e as demais ficaram como: ' + changes.join(', ') + '.'
        });
        // Repetido com todas as informações iguais (a chave também precisa ser igual).
        var f = g[0];
        g.slice(1).forEach(function (e, i) {
          var same = [];
          if (String(e.res.nf) === String(f.res.nf)) same.push('mesma NF (' + e.res.nf + ')');
          if (norm(e.res.item) === norm(f.res.item)) same.push('mesma descrição');
          if (String(e.res.chave) === String(f.res.chave)) same.push('mesma chave de acesso');
          if (Number(e.res.qtd) === Number(f.res.qtd)) same.push('mesma quantidade');
          if (cents(e.res.valor) === cents(f.res.valor)) same.push('mesmo valor');
          if (same.length === 5) {
            alerts.push({
              type: 'igual', id: base + '-' + (i + 1),
              details: { kind: 'igual', title: 'Repetida e igual — ' + base, rows: [detRow(f, 'Original', ids[0]), detRow(e, 'Repetida', base + '-' + (i + 1))] },
              text: 'Nota repetida com as MESMAS informações da nota ' + base + ': ' + same.join(', ') +
                '. Ela foi mantida no demonstrativo como ' + base + '-' + (i + 1) + ' e o valor está sendo somado de novo. Confira se não é a mesma nota enviada duas vezes.'
            });
          }
        });
      }
    });

    var totalCents = rows.reduce(function (n, r) { return n + cents(r.valor); }, 0);
    var rank = { erro: 0, revisar: 1, repetida: 2, igual: 3, duplicado: 4, atencao: 5, dace: 6 };
    alerts.sort(function (a, b) { return rank[a.type] - rank[b.type]; });
    return { rows: rows, allValid: good, duplicadasIguais: duplicadasIguais, alerts: alerts, stats: {
      notas: rows.length,
      total: totalCents / 100,
      renomeados: renamed,
      repetidosIguais: iguaisPorChave + alerts.filter(function (a) { return a.type === 'igual'; }).length,
      problemas: alerts.reduce(function (n, a) { if (a.type === 'igual' || a.type === 'atencao') return n; return n + (a.type === 'dace' && a.details && a.details.rows ? a.details.rows.length : 1); }, 0)
    } };
  }

  /* ------------------------------------------------------------------ */
  /*  Exportação XLSX (mesmo formato da planilha modelo)                 */
  /* ------------------------------------------------------------------ */
  var HEADERS = ['SHP_SHIPMENT_ID', 'TMS_DATA_FISCAL_NFE', 'NF', 'ITEM', 'QUANTIDADE ITEM', 'VALOR', 'STATUS'];

  // Largura de coluna do Excel (em "caracteres") que cabe o texto em Arial: igual ao clique duplo na borda da coluna.
  function excelUnits(text, sizePt) {
    text = String(text);
    try {
      if (typeof document !== 'undefined') {
        var cv = excelUnits._cv || (excelUnits._cv = document.createElement('canvas'));
        var ctx = cv.getContext('2d');
        ctx.font = (sizePt * 96 / 72) + 'px Arial, Helvetica, sans-serif';
        var px = ctx.measureText(text).width;
        if (px > 0) return px / 7 + 1;
      }
    } catch (e) { /* usa a estimativa abaixo */ }
    return text.length * 1.15 + 1;
  }

  async function buildXlsx(ExcelJS, rows) {
    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet('DEMONSTRATIVO DE PREJUÍZO', {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    // Auto-ajuste (como o clique duplo na borda): A, B, C e VALOR esticam só se o conteúdo for maior que o padrão do modelo.
    // A descrição (D), QUANTIDADE e STATUS ficam como no modelo.
    var fit = function (def, getter, headTxt, headSize) {
      var w = excelUnits(headTxt, headSize);
      rows.forEach(function (r) { w = Math.max(w, excelUnits(getter(r), 11)); });
      return Math.max(def, Math.ceil(w * 100) / 100);
    };
    var widths = [
      fit(19, function (r) { return r.id; }, HEADERS[0], 10),
      fit(54.88, function (r) { return r.chave; }, HEADERS[1], 11),
      fit(12.88, function (r) { return formatNF(r.nf); }, HEADERS[2], 11),
      98.88, 19,
      fit(14.75, function (r) { return formatBRL(r.valor); }, HEADERS[5], 11),
      17.13
    ];
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
    // Todas as colunas (menos a descrição) são ajustadas ao texto, como o clique duplo no Excel: nada quebra.
    // A descrição fica com o espaço que sobrar. Se ainda assim não couber, as margens da página diminuem
    // (mesma fonte, linha única). Só em último caso a descrição quebra em 2 linhas.
    doc.setFont('helvetica', 'normal');
    var need = [0, 0, 0, 0, 0, 0, 0];
    for (var c = 0; c < 7; c++) {
      doc.setFontSize(5.6);
      body.forEach(function (r) { need[c] = Math.max(need[c], doc.getTextWidth(String(r[c]))); });
      if (c !== 3) { doc.setFontSize((c === 0 || c === 4) ? 5.1 : 5.6); need[c] = Math.max(need[c], doc.getTextWidth(HEADERS[c])); }
    }
    var PAD = 8;   // padding + folga de segurança (pt)
    var pageW = doc.internal.pageSize.getWidth();
    var w = need.map(function (n) { return Math.ceil(n + PAD); });
    var others = w[0] + w[1] + w[2] + w[4] + w[5] + w[6];
    var dNeed = Math.ceil(need[3] + PAD);
    var mLR = 50.4, avail = pageW - 2 * mLR;      // margens do modelo (0,7")
    var wD;
    if (others + dNeed <= avail) { wD = avail - others; }                       // sobra espaço: descrição absorve
    else {
      mLR = Math.max(15, (pageW - (others + dNeed)) / 2);                        // diminui as margens
      avail = pageW - 2 * mLR;
      wD = Math.min(dNeed, avail - others);                                      // se ainda não couber, quebra em 2 linhas
      if (others + wD < avail) wD = avail - others;
    }
    var tableW = others + wD;
    autoTable(doc, {
      head: [HEADERS], body: body, theme: 'grid',
      margin: { top: 54, right: mLR, bottom: 54, left: mLR },
      tableWidth: tableW,
      styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 5.6, cellPadding: 0.8, halign: 'center', valign: 'middle', textColor: 0, lineColor: 0, lineWidth: 0.25, overflow: 'linebreak' },
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'normal', fontSize: 5.6, lineColor: 0, lineWidth: 0.25 },
      columnStyles: {
        0: { cellWidth: w[0], overflow: 'visible' }, 1: { cellWidth: w[1], overflow: 'visible' }, 2: { cellWidth: w[2], overflow: 'visible' },
        3: { cellWidth: wD }, 4: { cellWidth: w[4], overflow: 'visible' }, 5: { cellWidth: w[5], overflow: 'visible' }, 6: { cellWidth: w[6], overflow: 'visible' }
      },
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
    // A extensão .pdf pode estar sendo usada em um arquivo HTML/JSON de erro,
    // em uma página baixada incompleta ou em outro tipo de arquivo. Nesse caso
    // o ID precisa aparecer no cartão ERRO com a causa real.
    var magic = new Uint8Array(buf.slice(0, 5));
    var signature = String.fromCharCode.apply(null, magic);
    if (signature !== '%PDF-') {
      var invalid = new Error('not-pdf');
      invalid.userMessage = 'SEM PDF DENTRO DO ID: o arquivo não contém um PDF válido (assinatura %PDF- ausente). O ID foi mantido no ERRO para conferência; baixe a nota novamente.';
      throw invalid;
    }
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
      catch (e) {
        var msg = (e && e.userMessage) || 'não foi possível abrir o PDF (arquivo corrompido ou protegido)';
        if (!e || !e.userMessage) {
          try {
            var t = await f.text();
            if (/^\s*[\{<]/.test(t) || /error|not_found/i.test(t)) msg = 'o arquivo não é um PDF: é uma mensagem de erro do sistema que gerou a nota' + (/not_found/i.test(t) ? ' (nota não encontrada)' : '') + '. Baixe a nota novamente';
          } catch (_) { /* mantém a mensagem padrão */ }
        }
        res = { ok: false, errors: [msg], warnings: [] };
      }
      entries.push({ key: 'e' + (++seq), seq: seq, file: f, fileName: f.name, sig: f.__sig, baseId: parts.baseId, copyIndex: parts.copyIndex, part: parts.part, res: res });
    }
    setProgress('');
    extraNotes = [];
    if (skipped) extraNotes.push(skipped + ' arquivo(s) que não são PDF foram ignorados.');
    if (already) extraNotes.push(already + ' arquivo(s) já adicionados antes foram ignorados.');
    render();
  }
  var extraNotes = [];

  var ICON = { erro: '❌', revisar: '🧐', repetida: '♻️', igual: '🚨', duplicado: '🔁', atencao: '⚠️', dace: '📄' };
  var LABEL = { erro: 'NÃO RECONHECIDA', revisar: 'REVISAR LAYOUT', repetida: 'NF REPETIDA', igual: 'REPETIDA E IGUAL', duplicado: 'ID REPETIDO', atencao: 'ATENÇÃO', dace: 'DACE · DECLARAÇÃO AUXILIAR DE CONTEÚDO' };

  function reviewControls(x) {
    var k = esc(x.key);
    return '<div class="demo-review-ctl">' +
      '<label class="demo-radio"><input type="radio" name="inc-' + k + '" value="1" data-demo-include="' + k + '"' + (x.include ? ' checked' : '') + '> ✅ Incluir no demonstrativo</label>' +
      '<label class="demo-radio"><input type="radio" name="inc-' + k + '" value="0" data-demo-include="' + k + '"' + (x.include ? '' : ' checked') + '> 🚫 Não incluir</label>' +
      (x.include ? '<span class="demo-fill"><label>Descrição <input type="text" class="' + (x.missing.item ? 'demo-need' : '') + '" data-demo-fill="item" data-key="' + k + '" value="' + esc(x.item) + '" placeholder="descrição do item"></label>' +
        '<label>Valor (R$) <input type="text" class="' + (x.missing.valor ? 'demo-need' : '') + '" data-demo-fill="valor" data-key="' + k + '" value="' + (x.valor != null ? esc(Number(x.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })) : '') + '" placeholder="0,00" size="9"></label></span>' : '') +
      '</div>';
  }

  function errorControls(x) {
    var k = esc(x.key), m = x.manual || {};
    return '<div class="demo-review-ctl">' +
      '<label class="demo-radio"><input type="radio" name="inc-' + k + '" value="1" data-demo-include="' + k + '"' + (x.include ? ' checked' : '') + '> ✅ Incluir no demonstrativo</label>' +
      '<label class="demo-radio"><input type="radio" name="inc-' + k + '" value="0" data-demo-include="' + k + '"' + (x.include ? '' : ' checked') + '> 🚫 Não incluir</label>' +
      (x.include ? '<span class="demo-fill demo-fill-error">' +
        '<label>NF <input type="text" data-demo-error-fill="nf" data-key="' + k + '" value="' + esc(m.nf || '') + '" placeholder="número da NF"></label>' +
        '<label>Chave de acesso <input type="text" data-demo-error-fill="chave" data-key="' + k + '" value="' + esc(m.chave || '') + '" placeholder="44 dígitos"></label>' +
        '<label>Descrição <input type="text" data-demo-error-fill="item" data-key="' + k + '" value="' + esc(m.item || '') + '" placeholder="descrição do item"></label>' +
        '<label>Valor (R$) <input type="text" data-demo-error-fill="valor" data-key="' + k + '" value="' + esc(m.valor || '') + '" placeholder="0,00" size="9"></label>' +
        '</span>' : '') +
      '</div>';
  }

  function render() {
    var a = assemble(entries);
    current = a;
    var has = entries.length > 0;
    $('demo-results').classList.toggle('hidden', !has);
    $('demo-stat-notas').textContent = a.stats.notas;
    $('demo-stat-total').textContent = formatBRL(a.stats.total);
    $('demo-stat-ren').textContent = a.stats.renomeados;
    $('demo-stat-igual').textContent = a.stats.repetidosIguais;
    $('demo-stat-igual-card').classList.toggle('demo-stat-bad', a.stats.repetidosIguais > 0);
    $('demo-stat-prob').textContent = a.stats.problemas;
    $('demo-stat-prob').parentElement.classList.toggle('demo-stat-bad', a.stats.problemas > 0);
    (function(c){ if(!c.__demoJump){ c.__demoJump=true; c.style.cursor='pointer'; c.title='Clique para ver as notas com problema'; c.addEventListener('click',function(){ var m=$('demo-prob-modal'); if(m) m.classList.remove('hidden'); }); var m=$('demo-prob-modal'); if(m){ m.addEventListener('click',function(e){ if(e.target===m||e.target.closest('.demo-prob-close')) m.classList.add('hidden'); }); document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ var d=document.querySelector('.demo-modal:not(.hidden):not(#demo-prob-modal)'); if(!d) m.classList.add('hidden'); } }); } } })($('demo-stat-prob').parentElement);

    var obs = $('demo-obs');
    var parts = a.alerts.map(function (x, idx) {
      return '<li class="demo-obs-' + x.type + '"><span class="demo-obs-tag">' + ICON[x.type] + ' ' + LABEL[x.type] + '</span> ' +
        '<strong>' + esc(x.id) + '</strong> — ' + esc(x.text) + (x.file ? ' <em>(arquivo: ' + esc(x.file) + ')</em>' : '') +
        (x.details ? ' <button type="button" class="demo-details-btn" data-demo-details="' + idx + '">🔍 VER DETALHES</button>' : '') +
        (x.type === 'revisar' ? reviewControls(x) : x.type === 'erro' ? errorControls(x) : '') + '</li>';
    });
    extraNotes.forEach(function (t) { parts.push('<li class="demo-obs-atencao"><span class="demo-obs-tag">ℹ️ INFO</span> ' + esc(t) + '</li>'); });
    var erroIds = a.alerts.filter(function (x) { return x.type === 'erro'; }).map(function (x) { return x.id; });
    obs.innerHTML = parts.length
      ? '<h4>📌 Notas com problema e avisos' + (erroIds.length ? ' <button type="button" class="demo-details-btn" data-demo-copy-errors>📋 COPIAR IDS</button>' : '') + '</h4><ul>' + parts.join('') + '</ul>'
      : '<p class="demo-ok">✅ Todas as notas foram reconhecidas e nenhum ID está repetido.</p>';

    var warnKeys = {};
    entries.forEach(function (e) { if (e.res && e.res.ok && e.res.warnings.length) warnKeys[e.key] = true; });
    $('demo-tbody').innerHTML = a.rows.map(function (r) {
      var flag = r.incomplete ? ' demo-row-warn' : (r.renamed ? ' demo-row-renamed' : (r.warnings.length ? ' demo-row-warn' : ''));
      return '<tr class="' + flag.trim() + '"><td>' + esc(r.id) + '</td><td class="demo-mono">' + esc(r.chave) + '</td><td>' + esc(formatNF(r.nf)) +
        '</td><td class="demo-left" title="' + esc(r.item) + '">' + (esc(r.item) || '—') + '</td><td>' + esc(Number(r.qtd).toLocaleString('pt-BR')) + '</td><td>' + (esc(formatBRL(r.valor)) || '—') + '</td><td>' + esc(r.status) +
        '</td><td><button type="button" class="demo-x" data-demo-remove="' + esc(r.key) + '" title="Remover esta nota">✕</button></td></tr>';
    }).join('') || '<tr><td colspan="8" class="demo-empty">Nenhuma nota reconhecida ainda.</td></tr>';

    var dis = a.rows.length === 0;
    $('demo-btn-xlsx').disabled = dis; $('demo-btn-pdf').disabled = dis;
    $('demo-btn-notas').disabled = dis;
    var temDuplicadas = a.duplicadasIguais.length > 0, nTodas = a.allValid.length;
    $('demo-btn-notas').textContent = '⬇ BAIXAR NOTAS (' + a.rows.length + ')' + (temDuplicadas ? ' · SEM DUPLICADAS' : '');
    $('demo-btn-notas').title = 'ZIP com as notas do demonstrativo, sem as repetidas com informações iguais (IDs iguais com notas diferentes já saem separados: -1, -2...)';
    $('demo-btn-agrupar').disabled = !a.rows.length;
    $('demo-btn-agrupar').textContent = temDuplicadas ? '⬇ AGRUPAR NOTAS (' + a.rows.length + ') · SEM DUPLICADAS' : '⬇ AGRUPAR TODAS AS ' + a.rows.length + ' NOTAS';
    $('demo-btn-notas-duplicadas').classList.toggle('hidden', !temDuplicadas);
    $('demo-btn-notas-duplicadas').disabled = !temDuplicadas;
    $('demo-btn-notas-duplicadas').textContent = '⬇ BAIXAR COM DUPLICADAS (' + nTodas + ')';
    $('demo-btn-notas-duplicadas').title = 'ZIP com todas as notas, inclusive as repetidas com informações iguais';
    $('demo-btn-agrupar-duplicadas').classList.toggle('hidden', !temDuplicadas);
    $('demo-btn-agrupar-duplicadas').disabled = !temDuplicadas;
    $('demo-btn-agrupar-duplicadas').textContent = '⬇ AGRUPAR TODAS AS ' + nTodas + ' NOTAS · COM DUPLICADAS';
    $('demo-btn-agrupar-duplicadas').title = 'Um único PDF com todas as notas, inclusive as repetidas com informações iguais';
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

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  function confirmaIncompletas() {
    var n = current.rows.filter(function (r) { return r.incomplete; }).length;
    return !n || confirm(n + ' nota(s) incluída(s) estão sem descrição ou sem valor (marcadas com —). Exportar mesmo assim?');
  }
  async function exportXlsx() {
    if (!current.rows.length || !confirmaIncompletas()) return;
    if (!root.ExcelJS) { alert('Biblioteca de Excel não carregou. Verifique a internet e recarregue (F5).'); return; }
    var buf = await buildXlsx(root.ExcelJS, current.rows);
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileBase() + '.xlsx');
  }
  function exportPdf() {
    if (!current.rows.length || !confirmaIncompletas()) return;
    if (!(root.jspdf && root.jspdf.jsPDF)) { alert('Biblioteca de PDF não carregou. Verifique a internet e recarregue (F5).'); return; }
    var jsPDF = root.jspdf.jsPDF;
    var at = function (doc, opts) { if (typeof doc.autoTable === 'function') return doc.autoTable(opts); return root.jspdf.autoTable(doc, opts); };
    var doc = buildPdf(jsPDF, at, current.rows);
    download(doc.output('blob'), fileBase() + '.pdf');
  }

  // ZIP somente com as notas do demonstrativo, sem duplicatas idênticas.
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
    download(blob, 'NOTAS FISCAIS - SEM DUPLICADAS IGUAIS' + (d ? ' - ' + d : '') + '.zip');
  }

  // ZIP com todas as notas reconhecidas, inclusive duplicatas idênticas.
  // As cópias idênticas recebem (1), (2)... apenas dentro do ZIP para não sobrescrever arquivos.
  async function exportTodasNotas() {
    if (!current.allValid || !current.allValid.length) return;
    if (!root.JSZip) { alert('Biblioteca de ZIP não carregou. Verifique a internet e recarregue (F5).'); return; }
    var zip = new root.JSZip(), byKey = {}, rowByKey = {}, usedNames = {}, duplicateNumbers = {};
    entries.forEach(function (e) { byKey[e.key] = e; });
    current.rows.forEach(function (r) { rowByKey[r.key] = r.id; usedNames[r.id.toUpperCase()] = true; });
    current.allValid.forEach(function (e) {
      var id = rowByKey[e.key];
      if (!id) {
        var base = e.baseId, n = duplicateNumbers[base] || 0;
        do { n++; id = base + ' (' + n + ')'; } while (usedNames[id.toUpperCase()]);
        duplicateNumbers[base] = n;
        usedNames[id.toUpperCase()] = true;
      }
      var file = byKey[e.key] && byKey[e.key].file;
      if (file) zip.file(id.replace(/[\\/:*?"<>|]+/g, '_') + '.pdf', file);
    });
    var blob = await zip.generateAsync({ type: 'blob' });
    var d = ($('demo-driver').value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ');
    download(blob, 'NOTAS FISCAIS - TODAS' + (d ? ' - ' + d : '') + '.zip');
  }

  async function exportNotasDuplicadas() {
    if (!current.duplicadasIguais || !current.duplicadasIguais.length) return;
    if (!root.JSZip) { alert('Biblioteca de ZIP não carregou. Verifique a internet e recarregue a página (F5).'); return; }
    var zip = new root.JSZip(), used = {};
    current.duplicadasIguais.forEach(function (e, i) {
      var base = e.baseId, n = i + 1, id = base + ' (' + n + ')';
      while (used[id.toUpperCase()]) { n++; id = base + ' (' + n + ')'; }
      used[id.toUpperCase()] = true;
      if (e.file) zip.file(id.replace(/[\\/:*?"<>|]+/g, '_') + '.pdf', e.file);
    });
    var blob = await zip.generateAsync({ type: 'blob' });
    var d = ($('demo-driver').value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ');
    download(blob, 'NOTAS FISCAIS DUPLICADAS IGUAIS' + (d ? ' - ' + d : '') + '.zip');
  }

  // Agrupa os PDFs do próprio demonstrativo em um único arquivo, como na aba AGRUPAR PDF.
  async function exportAgrupado() {
    if (!current.allValid || !current.allValid.length) return;
    if (!root.PDFLib) { alert('A biblioteca de PDF não carregou. Verifique a internet e recarregue a página (F5).'); return; }
    var selected = current.rows.map(function (r) {
      return entries.find(function (e) { return e.key === r.key; });
    }).filter(Boolean);
    if (!selected.length) return;

    var btn = $('demo-btn-agrupar'), old = btn.textContent;
    try {
      btn.disabled = true; btn.textContent = 'Juntando…';
      var out = await root.PDFLib.PDFDocument.create();
      for (var i = 0; i < selected.length; i++) {
        var src = await root.PDFLib.PDFDocument.load(await selected[i].file.arrayBuffer(), { ignoreEncryption: true });
        var pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(function (page) { out.addPage(page); });
      }
      var bytes = await out.save();
      var d = ($('demo-driver').value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ');
      download(new Blob([bytes], { type: 'application/pdf' }), 'NOTAS FISCAIS AGRUPADAS - TODAS AS ' + selected.length + ' NOTAS' + (d ? ' - ' + d : '') + '.pdf');
    } catch (e) {
      alert('Não consegui agrupar os PDFs: ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false; btn.textContent = old; render();
    }
  }

  async function exportAgrupadoDuplicadas() {
    if (!current.duplicadasIguais || !current.duplicadasIguais.length) return;
    if (!root.PDFLib) { alert('A biblioteca de PDF não carregou. Verifique a internet e recarregue a página (F5).'); return; }
    var btn = $('demo-btn-agrupar-duplicadas'), old = btn.textContent;
    try {
      btn.disabled = true; btn.textContent = 'Juntando…';
      var out = await root.PDFLib.PDFDocument.create();
      for (var i = 0; i < current.allValid.length; i++) {
        var src = await root.PDFLib.PDFDocument.load(await current.allValid[i].file.arrayBuffer(), { ignoreEncryption: true });
        var pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(function (page) { out.addPage(page); });
      }
      var bytes = await out.save();
      var d = ($('demo-driver').value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ');
      download(new Blob([bytes], { type: 'application/pdf' }), 'NOTAS FISCAIS AGRUPADAS - COM NOTAS DUPLICADAS' + (d ? ' - ' + d : '') + '.pdf');
    } catch (e) {
      alert('Não consegui agrupar as notas duplicadas: ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false; btn.textContent = old; render();
    }
  }

  /* ---------------- VER DETALHES (revisão agrupada) ---------------- */
  var modalEl = null;
  function closeDetails() { if (modalEl) modalEl.classList.add('hidden'); }
  function detailsHtml(d) {
    var rows = d.rows || [];
    if (d.kind === 'erro') {
      var r0 = rows[0] || {};
      return '<div class="demo-rev-box demo-rev-bad"><strong>Arquivo:</strong> ' + esc(r0.file) + '<br><strong>ID:</strong> ' + esc(r0.id) + '<br><strong>Motivo:</strong> ' + esc(r0.motivo) + '</div>' +
        '<p class="demo-modal-note">Esta nota <strong>não entrou</strong> no demonstrativo, nem nos ZIPs e PDFs agrupados. Corrija o arquivo e adicione de novo.</p>';
    }
    if (d.kind === 'dace') {
      return '<div class="demo-table-wrap"><table class="demo-table"><thead><tr><th>ID</th><th>Arquivo</th><th>Título no documento</th><th>Situação</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td><strong>' + esc(r.id) + '</strong></td><td>' + esc(r.file) + '</td><td>' + esc(r.titulo) + '</td><td>' + esc(r.papel) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="demo-rev-box demo-rev-ok"><strong>DACE RESUMIDA - DECLARAÇÃO AUXILIAR DE CONTEÚDO</strong> é só o documento de transporte do pacote: não tem valor de nota fiscal. Por isso de fato <strong>não entram</strong> no demonstrativo.</div>';
    }
    if (d.kind === 'revisar') {
      var rv = rows[0] || {};
      return '<div class="demo-table-wrap"><table class="demo-table"><thead><tr><th>Situação</th><th>ID</th><th>Arquivo</th><th>NF</th><th>Descrição lida</th><th>Valor lido</th></tr></thead><tbody><tr><td>' + esc(rv.papel) + '</td><td><strong>' + esc(rv.id) + '</strong></td><td>' + esc(rv.file) + '</td><td>' + esc(formatNF(rv.nf)) + '</td><td class="demo-left">' + (esc(rv.item) || '—') + '</td><td>' + (esc(formatBRL(rv.valor)) || '—') + '</td></tr></tbody></table></div>' +
        '<div class="demo-rev-box demo-rev-bad"><strong>Por que está em revisão:</strong> ' + esc(rv.motivo) + '</div>' +
        '<p class="demo-modal-note">Ela é uma NF-e válida (a chave de acesso foi lida), mas o layout é diferente dos conhecidos. Por padrão ela fica <strong>incluída</strong>; na lista de observações você pode escolher <strong>Não incluir</strong> ou completar descrição/valor.</p>';
    }
    var fields = [['nf', 'NF'], ['chave', 'chave de acesso'], ['item', 'descrição'], ['valor', 'valor']];
    var key = function (f, r) { return f === 'item' ? norm(r.item) : f === 'valor' ? String(cents(r.valor)) : String(r[f]); };
    var diff = {}, diffNames = [], sameNames = [];
    fields.forEach(function (f) {
      var vals = rows.map(function (r) { return key(f[0], r); });
      var differs = vals.some(function (v) { return v !== vals[0]; });
      diff[f[0]] = differs; (differs ? diffNames : sameNames).push(f[1]);
    });
    var cell = function (f, txt, cls) { return '<td class="' + (cls || '') + (diff[f] ? ' demo-diff' : '') + '" title="' + esc(txt) + '">' + esc(txt) + '</td>'; };
    var html = '<div class="demo-table-wrap"><table class="demo-table demo-rev-table"><thead><tr><th>Situação</th><th>ID no demonstrativo</th><th>Arquivo</th><th>NF</th><th>Descrição</th><th>Valor</th><th>Chave de acesso</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.papel) + '</td><td><strong>' + esc(r.id) + '</strong></td><td>' + esc(r.file) + '</td>' +
          cell('nf', formatNF(r.nf)) + cell('item', r.item, 'demo-left') + cell('valor', formatBRL(r.valor)) + cell('chave', r.chave, 'demo-mono') + '</tr>';
      }).join('') + '</tbody></table></div>';
    var rev;
    if (d.kind === 'duplicado') {
      rev = diffNames.length
        ? '<div class="demo-rev-box demo-rev-ok"><strong>✔ Notas diferentes com o mesmo ID.</strong> Todas ficam no demonstrativo, separadas como ' + rows.map(function (r) { return '<code>' + esc(r.id) + '</code>'; }).join(', ') + '.<br>Diferem em: <strong>' + esc(diffNames.join(', ')) + '</strong>' + (sameNames.length ? ' · Iguais: ' + esc(sameNames.join(', ')) : '') + '.</div>'
        : '<div class="demo-rev-box demo-rev-bad"><strong>⚠ Todas as informações são iguais.</strong> Confira se não é a mesma nota enviada duas vezes.</div>';
    } else {
      rev = '<div class="demo-rev-box demo-rev-bad"><strong>⚠ É a mesma nota</strong> (mesma chave de acesso' + (diffNames.length ? '' : ', mesmo ID e mesmas informações') + '). Só uma fica no demonstrativo e em <em>BAIXAR NOTAS</em> / <em>AGRUPAR NOTAS</em>. Para levar as duas, use os botões <strong>COM DUPLICADAS</strong>.</div>';
    }
    return html + rev + '<p class="demo-modal-note">Células em amarelo = informação diferente entre as notas.</p>';
  }
  function openDetails(d) {
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'demo-modal hidden';
      modalEl.innerHTML = '<div class="demo-modal-box" role="dialog" aria-modal="true"><div class="demo-modal-head"><h4 id="demo-modal-title"></h4><button type="button" class="demo-modal-x" aria-label="Fechar">✕</button></div><div id="demo-modal-body" class="demo-modal-body"></div><div class="demo-modal-foot"><button type="button" class="editor-btn demo-modal-close">Fechar</button></div></div>';
      document.body.appendChild(modalEl);
      modalEl.addEventListener('click', function (e) { if (e.target === modalEl || e.target.closest('.demo-modal-x, .demo-modal-close')) closeDetails(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetails(); });
    }
    document.getElementById('demo-modal-title').textContent = d.title || 'Detalhes';
    document.getElementById('demo-modal-body').innerHTML = detailsHtml(d);
    modalEl.classList.remove('hidden');
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
    $('demo-btn-agrupar').addEventListener('click', exportAgrupado);
    $('demo-btn-notas-duplicadas').addEventListener('click', exportTodasNotas);
    $('demo-btn-agrupar-duplicadas').addEventListener('click', exportAgrupadoDuplicadas);
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
    $('demo-obs').addEventListener('change', function (e) {
      var t = e.target, key, en;
      if (t.matches('[data-demo-include]')) {
        key = t.getAttribute('data-demo-include'); en = entries.find(function (x) { return x.key === key; });
        if (en) { en.include = t.value === '1'; render(); }
      } else if (t.matches('[data-demo-fill]')) {
        key = t.getAttribute('data-key'); en = entries.find(function (x) { return x.key === key; });
        if (!en) return;
        en.override = en.override || {};
        if (t.getAttribute('data-demo-fill') === 'valor') en.override.valor = parseMoney(t.value);
        else en.override.item = t.value.replace(/\s+/g, ' ').trim();
        render();
      } else if (t.matches('[data-demo-error-fill]')) {
        key = t.getAttribute('data-key'); en = entries.find(function (x) { return x.key === key; });
        if (!en) return;
        en.override = en.override || {};
        en.override[t.getAttribute('data-demo-error-fill')] = t.value.trim();
        render();
      }
    });
    $('demo-obs').addEventListener('click', function (e) {
      var copy = e.target.closest('[data-demo-copy-errors]');
      if (copy) {
        var ids = current.alerts.filter(function (x) { return x.type === 'erro'; }).map(function (x) { return x.id; }).join(' ');
        copyText(ids).then(function () {
          copy.textContent = '✅ IDS COPIADOS';
          setTimeout(function () { copy.textContent = '📋 COPIAR IDS'; }, 1800);
        }).catch(function () { alert('Não foi possível copiar os IDs automaticamente.'); });
        return;
      }
      var b = e.target.closest('[data-demo-details]'); if (!b) return;
      var al = current.alerts[Number(b.getAttribute('data-demo-details'))];
      if (al && al.details) openDetails(al.details);
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
