/* ==========================================================================
   SINISTRO > AGRUPAR PDF  e  SINISTRO > FOTO x PDF
   - AGRUPAR PDF: junta vários PDFs em um só, na MESMA ordem em que foram enviados
   - FOTO x PDF : transforma fotos em PDF (1 PDF com todas ou 1 PDF por foto, em ZIP)
   - Ordem = a ordem da pasta do PC (não reordena por nome). ▲ ▼ mudam a ordem.
   - ✕ remove e Ctrl+Z desfaz (várias vezes)
   - Tudo roda no navegador (nenhum arquivo é enviado para servidor)
   ========================================================================== */
(function (root) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var safeName = function (s) { return String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim(); };
  var baseName = function (n) { return String(n).replace(/\.[^.]+$/, ''); };
  var fmtSize = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; };

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ---------------- aviso "Desfazer" (Ctrl+Z) ---------------- */
  var toast = null, toastTimer = null, toastUndo = null;
  function showToast(msg, undoFn) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'demo-toast hidden';
      toast.innerHTML = '<span class="pt-toast-msg"></span><button type="button" class="pt-toast-undo">↩ Desfazer (Ctrl+Z)</button>';
      document.body.appendChild(toast);
      toast.querySelector('.pt-toast-undo').addEventListener('click', function () { if (toastUndo) toastUndo(); });
    }
    toastUndo = undoFn;
    toast.querySelector('.pt-toast-msg').textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 8000);
  }
  function hideToast() { if (toast) toast.classList.add('hidden'); }

  /* ---------------- lista ordenável (compartilhada pelas 2 abas) ---------------- */
  function Tool(cfg) {
    this.cfg = cfg;           // { p:'agr'|'fx', accept(file)->bool, rowHtml(item,i), onChange() }
    this.items = []; this.seen = {}; this.undo = []; this.errors = []; this.notes = []; this.n = 0;
  }
  Tool.prototype.idx = function (key) {
    for (var i = 0; i < this.items.length; i++) if (this.items[i].key === key) return i;
    return -1;
  };
  Tool.prototype.remove = function (key) {
    var i = this.idx(key); if (i < 0) return;
    var it = this.items.splice(i, 1)[0];
    delete this.seen[it.sig];
    this.undo.push([{ item: it, index: i }]);
    this.render();
    var self = this;
    showToast('Arquivo removido.', function () { self.undoLast(); });
  };
  Tool.prototype.clear = function () {
    if (!this.items.length) return;
    if (!confirm('Limpar todos os arquivos desta lista?')) return;
    var all = this.items.map(function (it, i) { return { item: it, index: i }; });
    this.items = []; this.seen = {}; this.errors = []; this.notes = [];
    this.undo.push(all);
    this.render();
    var self = this;
    showToast('Todos os arquivos foram removidos.', function () { self.undoLast(); });
  };
  Tool.prototype.undoLast = function () {
    var batch = this.undo.pop();
    if (!batch) return false;
    var self = this;
    batch.forEach(function (b) {
      if (b.item.sig && self.seen[b.item.sig]) return;           // o mesmo arquivo já foi adicionado de novo
      if (b.item.sig) self.seen[b.item.sig] = true;
      self.items.splice(Math.min(b.index, self.items.length), 0, b.item);   // volta na mesma posição
    });
    this.render();
    if (this.undo.length) showToast('Restaurado. Ainda dá para desfazer mais ' + this.undo.length + ' ação(ões).', function () { self.undoLast(); });
    else hideToast();
    return true;
  };
  Tool.prototype.move = function (key, dir) {
    var i = this.idx(key), j = i + dir;
    if (i < 0 || j < 0 || j >= this.items.length) return;
    var t = this.items[i]; this.items[i] = this.items[j]; this.items[j] = t;
    this.render();
  };
  Tool.prototype.setProgress = function (text) {
    var el = $(this.cfg.p + '-progress');
    el.textContent = text || ''; el.classList.toggle('hidden', !text);
  };
  Tool.prototype.render = function () {
    var p = this.cfg.p, self = this, n = this.items.length;
    $(p + '-results').classList.toggle('hidden', n === 0);
    $(p + '-list').innerHTML = this.items.map(function (it, i) {
      return '<li class="pt-row">' +
        '<span class="pt-n">' + (i + 1) + '</span>' + self.cfg.rowHtml(it) +
        '<span class="pt-btns">' +
        '<button type="button" data-act="up" data-key="' + it.key + '" title="Subir"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
        '<button type="button" data-act="down" data-key="' + it.key + '" title="Descer"' + (i === n - 1 ? ' disabled' : '') + '>▼</button>' +
        '<button type="button" data-act="rm" data-key="' + it.key + '" title="Remover">✕</button>' +
        '</span></li>';
    }).join('');
    var obs = this.errors.map(function (e) {
      return '<li class="demo-obs-erro"><span class="demo-obs-tag">❌ NÃO ADICIONADO</span> <strong>' + esc(e.name) + '</strong> — ' + esc(e.text) + '</li>';
    }).concat(this.notes.map(function (t) {
      return '<li class="demo-obs-atencao"><span class="demo-obs-tag">ℹ️ INFO</span> ' + esc(t) + '</li>';
    }));
    $(p + '-obs').innerHTML = obs.length ? '<h4>📌 Observações</h4><ul>' + obs.join('') + '</ul>' : '';
    this.cfg.onChange();
  };
  Tool.prototype.wire = function () {
    var self = this, p = this.cfg.p, drop = $(p + '-drop'), input = $(p + '-file');
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { self.add(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) self.add(e.dataTransfer.files); });
    $(p + '-list').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act'), key = b.getAttribute('data-key');
      if (act === 'rm') self.remove(key); else self.move(key, act === 'up' ? -1 : 1);
    });
    $(p + '-clear').addEventListener('click', function () { self.clear(); });
    document.addEventListener('keydown', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.altKey || String(ev.key).toLowerCase() !== 'z') return;
      var t = ev.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (!drop.offsetParent) return;                    // só quando esta aba está aberta
      if (self.undoLast()) ev.preventDefault();
    });
    this.render();
  };
  // recebe a lista de arquivos NA ORDEM em que chegou (ordem da pasta) e adiciona sem reordenar
  Tool.prototype.add = async function (fileList) {
    var self = this, files = Array.from(fileList), ok = [], skipped = 0, already = 0;
    files.forEach(function (f) {
      if (!self.cfg.accept(f)) { skipped++; return; }
      var sig = f.name + '|' + f.size + '|' + f.lastModified;
      if (self.seen[sig]) { already++; return; }
      self.seen[sig] = true; f.__sig = sig; ok.push(f);
    });
    this.errors = []; this.notes = [];
    if (skipped) this.notes.push(skipped + ' arquivo(s) de tipo diferente do esperado foram ignorados.');
    if (already) this.notes.push(already + ' arquivo(s) já adicionados antes foram ignorados.');
    for (var i = 0; i < ok.length; i++) {
      this.setProgress('Lendo arquivos… ' + (i + 1) + ' de ' + ok.length);
      try {
        var item = await this.cfg.load(ok[i]);
        item.key = 'k' + (++this.n); item.sig = ok[i].__sig; item.name = ok[i].name; item.file = ok[i];
        this.items.push(item);
      } catch (e) {
        delete this.seen[ok[i].__sig];
        this.errors.push({ name: ok[i].name, text: (e && e.userMessage) || 'não foi possível abrir este arquivo (corrompido ou protegido por senha).' });
      }
    }
    this.setProgress('');
    this.render();
  };

  function needLib(name, ok) {
    if (!ok) { var e = new Error('lib'); e.userMessage = 'A biblioteca ' + name + ' não carregou. Verifique a internet e recarregue a página (F5).'; throw e; }
  }

  /* ======================================================================
     AGRUPAR PDF
     ====================================================================== */
  function initAgrupar() {
    if (!$('agr-drop')) return;
    var tool = new Tool({
      p: 'agr',
      accept: function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; },
      load: async function (f) {
        needLib('pdf-lib', root.PDFLib);
        var bytes = new Uint8Array(await f.arrayBuffer());
        var doc = await root.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        var pages = doc.getPageCount();
        if (!pages) { var e = new Error('vazio'); e.userMessage = 'o PDF não tem nenhuma página.'; throw e; }
        return { doc: doc, pages: pages, size: f.size };
      },
      rowHtml: function (it) {
        return '<span class="pt-name" title="' + esc(it.name) + '">📄 ' + esc(it.name) + '</span>' +
          '<span class="pt-meta">' + it.pages + (it.pages === 1 ? ' página' : ' páginas') + ' · ' + fmtSize(it.size) + '</span>';
      },
      onChange: function () {
        var total = tool.items.reduce(function (n, it) { return n + it.pages; }, 0);
        $('agr-summary').textContent = tool.items.length + (tool.items.length === 1 ? ' arquivo' : ' arquivos') + ' · ' + total + (total === 1 ? ' página' : ' páginas') + ' no PDF final';
        $('agr-btn').disabled = !tool.items.length;
        $('agr-btn').textContent = '⬇ Baixar PDF agrupado (' + total + (total === 1 ? ' página)' : ' páginas)');
      }
    });
    tool.wire();
    $('agr-btn').addEventListener('click', async function () {
      if (!tool.items.length) return;
      var btn = $('agr-btn'), old = btn.textContent;
      try {
        needLib('pdf-lib', root.PDFLib);
        btn.disabled = true; btn.textContent = 'Juntando…';
        var out = await root.PDFLib.PDFDocument.create();
        for (var i = 0; i < tool.items.length; i++) {
          var src = tool.items[i].doc;
          var copied = await out.copyPages(src, src.getPageIndices());
          copied.forEach(function (pg) { out.addPage(pg); });
        }
        var bytes = await out.save();
        var d = safeName($('agr-name').value);
        download(new Blob([bytes], { type: 'application/pdf' }), 'Notas Fiscais' + (d ? ' - ' + d : '') + '.pdf');
      } catch (e) {
        alert((e && e.userMessage) || 'Não consegui juntar os PDFs: ' + (e && e.message ? e.message : e));
      } finally { btn.disabled = false; btn.textContent = old; tool.render(); }
    });
  }

  /* ======================================================================
     FOTO x PDF
     ====================================================================== */
  var MAX_SIDE = 2400;           // lado maior (px) — mantém o PDF leve e com boa qualidade
  var A4 = { w: 595.28, h: 841.89 };

  async function decodeImage(file) {
    if (root.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* tenta o método antigo */ }
      try { return await createImageBitmap(file); } catch (e2) { /* tenta o método antigo */ }
    }
    return await new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }

  function initFoto() {
    if (!$('fx-drop')) return;
    var tool = new Tool({
      p: 'fx',
      accept: function (f) { return /^image\//i.test(f.type) || /\.(jpe?g|png|webp|bmp|gif|heic|heif)$/i.test(f.name); },
      load: async function (f) {
        var bmp;
        try { bmp = await decodeImage(f); }
        catch (e) {
          var er = new Error('decode');
          er.userMessage = /\.(heic|heif)$/i.test(f.name) ? 'formato HEIC/HEIF não é aceito pelo navegador. Envie a foto em JPG ou PNG.' : 'não consegui abrir esta imagem.';
          throw er;
        }
        var w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
        var sc = Math.min(1, MAX_SIDE / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
        var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);         // PNG com fundo transparente fica branco
        ctx.drawImage(bmp, 0, 0, cw, ch);
        if (bmp.close) bmp.close();
        var blob = await new Promise(function (r) { cv.toBlob(r, 'image/jpeg', 0.88); });
        if (!blob) { var e3 = new Error('jpeg'); e3.userMessage = 'não consegui converter esta imagem.'; throw e3; }
        return { bytes: new Uint8Array(await blob.arrayBuffer()), w: cw, h: ch, size: f.size, thumb: URL.createObjectURL(f) };
      },
      rowHtml: function (it) {
        return '<img class="pt-thumb" src="' + it.thumb + '" alt="">' +
          '<span class="pt-name" title="' + esc(it.name) + '">' + esc(it.name) + '</span>' +
          '<span class="pt-meta">' + it.w + '×' + it.h + ' · ' + fmtSize(it.size) + '</span>';
      },
      onChange: function () {
        var n = tool.items.length;
        $('fx-summary').textContent = n + (n === 1 ? ' foto' : ' fotos');
        $('fx-btn').disabled = !n;
        var each = $('fx-mode').value === 'each';
        $('fx-btn').textContent = each ? '⬇ Baixar ' + n + (n === 1 ? ' PDF (ZIP)' : ' PDFs (ZIP)') : '⬇ Baixar PDF (' + n + (n === 1 ? ' página)' : ' páginas)');
      }
    });
    tool.wire();
    $('fx-mode').addEventListener('change', function () { tool.render(); });

    async function buildPdf(items, pageMode) {
      var out = await root.PDFLib.PDFDocument.create();
      for (var i = 0; i < items.length; i++) {
        var it = items[i], img = await out.embedJpg(it.bytes);
        if (pageMode === 'original') {
          var pw = it.w * 0.75, ph = it.h * 0.75;                  // px (96 dpi) -> pt
          out.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
        } else {
          var land = it.w > it.h, W = land ? A4.h : A4.w, H = land ? A4.w : A4.h, M = 20;
          var s = Math.min((W - 2 * M) / it.w, (H - 2 * M) / it.h), dw = it.w * s, dh = it.h * s;
          out.addPage([W, H]).drawImage(img, { x: (W - dw) / 2, y: (H - dh) / 2, width: dw, height: dh });
        }
      }
      return await out.save();
    }

    $('fx-btn').addEventListener('click', async function () {
      if (!tool.items.length) return;
      var btn = $('fx-btn'), old = btn.textContent;
      try {
        needLib('pdf-lib', root.PDFLib);
        btn.disabled = true; btn.textContent = 'Gerando…';
        var pageMode = $('fx-page').value, nm = safeName($('fx-name').value);
        if ($('fx-mode').value === 'each') {
          needLib('JSZip', root.JSZip);
          var zip = new root.JSZip(), used = {};
          for (var i = 0; i < tool.items.length; i++) {
            var it = tool.items[i], base = safeName(baseName(it.name)) || 'foto', nme = base, n = 0;
            while (used[nme.toUpperCase()]) { n++; nme = base + '-' + n; }       // nome repetido -> -1, -2...
            used[nme.toUpperCase()] = true;
            zip.file(nme + '.pdf', await buildPdf([it], pageMode));
          }
          download(await zip.generateAsync({ type: 'blob' }), (nm || 'Fotos em PDF') + '.zip');
        } else {
          var bytes = await buildPdf(tool.items, pageMode);
          download(new Blob([bytes], { type: 'application/pdf' }), (nm || 'Fotos') + '.pdf');
        }
      } catch (e) {
        alert((e && e.userMessage) || 'Não consegui gerar o PDF: ' + (e && e.message ? e.message : e));
      } finally { btn.disabled = false; btn.textContent = old; tool.render(); }
    });
  }

  function init() { initAgrupar(); initFoto(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})(typeof window !== 'undefined' ? window : globalThis);
