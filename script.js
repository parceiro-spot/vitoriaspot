// ==================== AUDIO ENGINE ====================
const AudioEngine = {
  ctx: null,
  
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  
  play(type) {
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    if (type === 'gameover') {
      // 1. Som de Freada Brusca de Carro (Agudo com pitch descendente)
      const screechOsc = ctx.createOscillator();
      const screechGain = ctx.createGain();
      
      screechOsc.type = 'sawtooth';
      screechOsc.frequency.setValueAtTime(3200, now);
      screechOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
      
      screechGain.gain.setValueAtTime(0.15, now);
      screechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      // Filtro para simular o som do atrito do pneu no asfalto
      const screechFilter = ctx.createBiquadFilter();
      screechFilter.type = 'bandpass';
      screechFilter.frequency.setValueAtTime(2800, now);
      screechFilter.Q.setValueAtTime(4, now);

      screechOsc.connect(screechFilter);
      screechFilter.connect(screechGain);
      screechGain.connect(ctx.destination);
      
      screechOsc.start(now);
      screechOsc.stop(now + 0.35);

      // 2. Som de Impacto/Batida de Colisão (Ruído grave e metálico)
      const crashBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const crashData = crashBuffer.getChannelData(0);
      for (let i = 0; i < crashBuffer.length; i++) {
        crashData[i] = Math.random() * 2 - 1;
      }
      const crashSource = ctx.createBufferSource();
      crashSource.buffer = crashBuffer;

      const crashFilter = ctx.createBiquadFilter();
      crashFilter.type = 'lowpass';
      crashFilter.frequency.setValueAtTime(800, now + 0.1);
      crashFilter.frequency.exponentialRampToValueAtTime(40, now + 0.5);

      const crashGain = ctx.createGain();
      crashGain.gain.setValueAtTime(0.6, now + 0.1);
      crashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      crashSource.connect(crashFilter);
      crashFilter.connect(crashGain);
      crashGain.connect(ctx.destination);
      
      crashSource.start(now + 0.1);

      return;
    }
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    switch(type) {
      case 'jump':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(480, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
        
      case 'score':
      case 'coin':
        // Som ativado ao copiar mensagens do sinistro e ao pegar encomendas
        osc.type = 'sine';
        osc.frequency.setValueAtTime(850, now);
        osc.frequency.setValueAtTime(1250, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
    }
  }
};

window.addEventListener('load', () => {
  Game.init();
});

// ==================== NAVEGAÇÃO E UTILS ====================

function hideAllSections() {
  const sections = document.querySelectorAll('.section');
  sections.forEach(s => s.classList.add('hidden'));
}

function copyText(element) {
  if (element && element.isContentEditable) return;
  const text = element.textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    element.classList.add('copied');
    AudioEngine.play('coin'); // SOM EXCLUSIVO DE CÓPIA MANANTIDO AQUI
    showToast();
    setTimeout(() => {
      element.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    element.classList.add('copied');
    AudioEngine.play('coin'); // SOM EXCLUSIVO DE CÓPIA MANANTIDO AQUI
    showToast();
    setTimeout(() => element.classList.remove('copied'), 2000);
  });
}

function showToast() {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2000);
  }
}

function showTab(tabId, btn) {
  if (!btn) return;
  const section = btn.closest('.section');
  if (!section) return;
  
  const contents = section.querySelectorAll('.tab-content');
  contents.forEach(c => {
    c.classList.add('hidden');
    c.classList.remove('active');
  });

  const target = document.getElementById(tabId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  const buttons = section.querySelectorAll('.tab-btn');
  buttons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function toggleMenu() {
  // Som de clique removido
  const menu = document.getElementById('menu-overlay');
  if (menu) {
    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
      menu.classList.remove('hidden');
      Game.pause();
    } else {
      menu.classList.add('hidden');
      const activeSection = document.querySelector('.section:not(.hidden)');
      if (!activeSection) {
        Game.resume();
      }
    }
  }
}

function closeMenu(event) {
  if (event.target.id === 'menu-overlay') {
    toggleMenu();
  }
}

function goToMain() {
  // Som de clique removido
  hideAllSections();
  document.getElementById('menu-overlay').classList.add('hidden');
  Game.resume();
}

function goToMenu() {
  // Som de clique removido
  hideAllSections();
  document.getElementById('menu-overlay').classList.remove('hidden');
  Game.pause();
}

function openSection(sectionId) {
  // Som de clique removido
  Game.pause();
  
  hideAllSections();
  
  const loading = document.getElementById('loading-screen');
  if (loading) loading.classList.remove('hidden');
  document.getElementById('menu-overlay').classList.add('hidden');
  
  setTimeout(() => {
    if (loading) loading.classList.add('hidden');
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.remove('hidden');
      section.scrollTop = 0;
    }
  }, 400);
}

// ==================== JOGO DO CAMINHÃO/VAN PARCEIRO SPOT ====================
const Game = {
  canvas: null,
  ctx: null,
  width: 800,
  height: 200,
  
  running: false,
  gameOver: false,
  score: 0,
  highScore: parseInt(localStorage.getItem('spotHighScore')) || 0,
  
  level: 1,
  baseSpeed: 5.5,
  speed: 5.5,
  maxSpeed: 17,
  
  frameCount: 0,
  
  truck: {
    x: 80,
    y: 0,
    width: 68,
    height: 38,
    vy: 0,
    onGround: false,
    jumpPower: -11.5,
    gravity: 0.65
  },
  
  groundY: 160,
  groundOffset: 0,
  
  obstacles: [],
  obstacleTimer: 0,
  minObstacleInterval: 35,
  
  packages: [],
  packageTimer: 0,
  
  animId: null,
  
  init() {
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        this.jump();
      }
    });
    
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.jump();
    }, { passive: false });
    
    this.canvas.addEventListener('click', (e) => {
      if (this.gameOver) this.restart();
      else this.jump();
    });
    
    this.restart();
    this.loop();
  },
  
  resizeCanvas() {
    const container = document.getElementById('game-container');
    if (!container || !this.canvas) return;
    const rect = container.getBoundingClientRect();
    const maxWidth = Math.min(800, rect.width);
    const scale = maxWidth / 800;
    this.canvas.style.width = maxWidth + 'px';
    this.canvas.style.height = (200 * scale) + 'px';
  },
  
  pause() {
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  },

  resume() {
    if (!this.running && !this.gameOver) {
      this.running = true;
      this.loop();
    }
  },
  
  jump() {
    AudioEngine.init();
    if (this.gameOver) {
      this.restart();
      return;
    }
    if (this.truck.onGround) {
      this.truck.vy = this.truck.jumpPower;
      this.truck.onGround = false;
      AudioEngine.play('jump');
    }
  },
  
  restart() {
    this.running = true;
    this.gameOver = false;
    this.score = 0;
    this.level = 1;
    this.speed = this.baseSpeed;
    this.obstacles = [];
    this.packages = [];
    this.obstacleTimer = 0;
    this.packageTimer = 0;
    this.frameCount = 0;
    this.truck.y = this.groundY - this.truck.height;
    this.truck.vy = 0;
    this.truck.onGround = true;
    this.updateScore();
    
    const go = document.getElementById('game-over');
    if (go) go.classList.add('hidden');
  },
  
  updateScore() {
    const el = document.getElementById('score');
    if (el) {
      const hi = String(this.highScore).padStart(5, '0');
      const sc = String(Math.floor(this.score)).padStart(5, '0');
      el.textContent = `LVL ${this.level}  HI ${hi}  ${sc}`;
    }
  },

  calculateSpeedAndLevel() {
    let speedBonus = 0;
    let newLevel = 1;

    if (this.score < 500) {
      speedBonus = (this.score / 500) * 1.5;
      newLevel = 1;
    } else if (this.score < 1500) {
      speedBonus = 1.5 + ((this.score - 500) / 1000) * 2.5;
      newLevel = 2;
    } else if (this.score < 2500) {
      speedBonus = 4.0 + ((this.score - 1500) / 1000) * 3.0;
      newLevel = 3;
    } else {
      speedBonus = 7.0 + ((this.score - 2500) / 1000) * 3.5;
      newLevel = 4 + Math.floor((this.score - 2500) / 1000);
    }

    if (newLevel !== this.level) {
      this.level = newLevel;
      AudioEngine.play('score');
    }

    this.speed = Math.min(this.baseSpeed + speedBonus, this.maxSpeed);
  },
  
  update() {
    if (!this.running || this.gameOver) return;
    this.frameCount++;
    
    this.score += 0.25;
    
    this.calculateSpeedAndLevel();
    this.updateScore();
    
    this.truck.vy += this.truck.gravity;
    this.truck.y += this.truck.vy;
    
    if (this.truck.y >= this.groundY - this.truck.height) {
      this.truck.y = this.groundY - this.truck.height;
      this.truck.vy = 0;
      this.truck.onGround = true;
    }
    
    this.groundOffset -= this.speed;
    if (this.groundOffset <= -40) this.groundOffset = 0;
    
    this.obstacleTimer++;
    const currentInterval = Math.max(this.minObstacleInterval, 85 - Math.floor(this.speed * 3.5));
    
    if (this.obstacleTimer >= currentInterval + Math.random() * 25) {
      this.obstacleTimer = 0;
      this.obstacles.push({
        x: 820,
        y: this.groundY - 26,
        width: 20,
        height: 26,
        passed: false
      });
    }
    
    this.obstacles.forEach((obs) => {
      obs.x -= this.speed;
      
      const tx = this.truck.x + 6;
      const ty = this.truck.y + 4;
      const tw = this.truck.width - 12;
      const th = this.truck.height - 6;
      
      if (
        tx < obs.x + obs.width &&
        tx + tw > obs.x &&
        ty < obs.y + obs.height &&
        ty + th > obs.y
      ) {
        this.gameOver = true;
        AudioEngine.play('gameover'); // TOCA SOM DE FREADA E COLISÃO
        if (this.score > this.highScore) {
          this.highScore = Math.floor(this.score);
          localStorage.setItem('spotHighScore', this.highScore);
        }
        const go = document.getElementById('game-over');
        if (go) go.classList.remove('hidden');
        this.updateScore();
      }
    });
    
    this.obstacles = this.obstacles.filter(obs => obs.x + obs.width > -50);
    
    this.packageTimer++;
    if (this.packageTimer >= 130 + Math.random() * 50) {
      this.packageTimer = 0;
      this.packages.push({
        x: 820,
        y: this.groundY - 50 - Math.random() * 35,
        width: 22,
        height: 22,
        collected: false
      });
    }
    
    this.packages.forEach((pkg) => {
      pkg.x -= this.speed;
      
      if (!pkg.collected) {
        const tx = this.truck.x;
        const ty = this.truck.y;
        const tw = this.truck.width;
        const th = this.truck.height;
        
        if (
          tx < pkg.x + pkg.width &&
          tx + tw > pkg.x &&
          ty < pkg.y + pkg.height &&
          ty + th > pkg.y
        ) {
          pkg.collected = true;
          this.score += 40;
          this.updateScore();
          AudioEngine.play('coin');
        }
      }
    });
    
    this.packages = this.packages.filter(pkg => pkg.x + pkg.width > -50 && !pkg.collected);
  },
  
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 800, 200);
    
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, this.groundY, 800, 40);
    
    ctx.fillStyle = '#8bc53f';
    ctx.fillRect(0, this.groundY, 800, 3);
    
    ctx.fillStyle = '#ffffff';
    for (let i = this.groundOffset; i < 800; i += 50) {
      ctx.fillRect(i, this.groundY + 18, 25, 4);
    }
    
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.fillText(`NÍVEL ${this.level}`, 15, 25);
    
    this.obstacles.forEach(obs => {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height - 4);
      ctx.lineTo(obs.x, obs.y + obs.height - 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ea580c';
      ctx.fillRect(obs.x - 2, obs.y + obs.height - 4, obs.width + 4, 4);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(obs.x + 5, obs.y + 8, obs.width - 10, 3);
      ctx.fillRect(obs.x + 3, obs.y + 15, obs.width - 6, 3.5);
    });
    
    this.packages.forEach(pkg => {
      if (pkg.collected) return;
      
      ctx.fillStyle = '#d97706';
      ctx.fillRect(pkg.x, pkg.y, pkg.width, pkg.height);
      
      ctx.fillStyle = '#8bc53f';
      ctx.fillRect(pkg.x, pkg.y + 9, pkg.width, 4);
      ctx.fillRect(pkg.x + 9, pkg.y, 4, pkg.height);
      
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      ctx.strokeRect(pkg.x, pkg.y, pkg.width, pkg.height);
    });
    
    this.drawSpotVan(ctx);
  },
  
  drawSpotVan(ctx) {
    const t = this.truck;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(t.x + t.width / 2, this.groundY, 32, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, t.width, t.height - 6, [8, 12, 4, 4]);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#8bc53f';
    ctx.beginPath();
    ctx.moveTo(t.x + 2, t.y + 20);
    ctx.lineTo(t.x + t.width - 2, t.y + 14);
    ctx.lineTo(t.x + t.width - 2, t.y + 24);
    ctx.lineTo(t.x + 2, t.y + 28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(t.x + 46, t.y + 4, 16, 12, [2, 6, 2, 2]);
    ctx.fill();

    ctx.fillStyle = '#8bc53f';
    ctx.fillRect(t.x + t.width - 4, t.y + 22, 3, 5);

    ctx.fillStyle = '#111827';
    ctx.font = '900 8px Montserrat, sans-serif';
    ctx.fillText('SPOT', t.x + 12, t.y + 14);

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(t.x + 15, t.y + t.height - 4, 7, 0, Math.PI * 2);
    ctx.arc(t.x + 52, t.y + t.height - 4, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8bc53f';
    ctx.beginPath();
    ctx.arc(t.x + 15, t.y + t.height - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(t.x + 52, t.y + t.height - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },
  
  loop() {
    this.update();
    this.draw();
    this.animId = requestAnimationFrame(() => this.loop());
  }
};

function restartGame() {
  Game.restart();
}

// ===== EDITORES MANUAIS =====
(function initManualEditors(){
  const PROF_KEY='spot_manual_profarma_v1', MSG_KEY='spot_manual_messages_v1', MSG_TITLE_KEY='spot_manual_message_titles_v1', PNR_KEY='spot_manual_pnr_v1';
  const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){console.warn('Não foi possível salvar',e);}};
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?f:v;}catch(e){return f;}};
  const state=(el,text)=>{if(el){el.textContent=text;setTimeout(()=>{el.textContent='';},2200);}};
  function setupProfarma(){
    const area=qs('#profarma-manual-content'); if(!area)return;
    const saved=load(PROF_KEY,null); if(saved) area.innerHTML=saved;
    let editing=false;
    qs('[data-edit-profarma]')?.addEventListener('click',()=>{editing=!editing;area.contentEditable=String(editing);area.classList.toggle('manual-editing',editing);});
    qs('[data-add-profarma-title]')?.addEventListener('click',()=>{const h=document.createElement('h3');h.textContent='Novo título';area.prepend(h);h.focus();});
    qs('[data-format-profarma]')?.addEventListener('click',()=>document.execCommand('bold'));
    qs('[data-color-profarma]')?.addEventListener('input',e=>{document.execCommand('foreColor',false,e.target.value);});
    qs('[data-save-profarma]')?.addEventListener('click',()=>{save(PROF_KEY,area.innerHTML);state(qs('[data-profarma-state]'),'Tutorial salvo');});
  }
  function setupMessages(){
    const card=qs('.sinistro-messages-card'); if(!card)return;
    const boxes=qsa('.copy-box',card), saved=load(MSG_KEY,null), savedTitles=load(MSG_TITLE_KEY,[]);
    if(saved&&Array.isArray(saved)) boxes.forEach((b,i)=>{if(saved[i]!=null)b.innerHTML=saved[i];});
    savedTitles.forEach(title=>{const h=document.createElement('h4');h.textContent=title;h.dataset.manualTitle='1';card.insertBefore(h,boxes[0]||null);});
    let editing=false;
    qs('[data-edit-messages]')?.addEventListener('click',()=>{editing=!editing;boxes.forEach(b=>{b.contentEditable=String(editing);b.classList.toggle('message-editing',editing);});});
    qs('[data-add-message-title]')?.addEventListener('click',()=>{const h=document.createElement('h4');h.textContent='Novo título de mensagem';h.dataset.manualTitle='1';card.insertBefore(h,boxes[0]||null);});
    qs('[data-format-messages]')?.addEventListener('click',()=>document.execCommand('bold'));
    qs('[data-color-messages]')?.addEventListener('input',e=>{document.execCommand('foreColor',false,e.target.value);});
    qs('[data-save-messages]')?.addEventListener('click',()=>{save(MSG_KEY,boxes.map(b=>b.innerHTML));save(MSG_TITLE_KEY,qsa('[data-manual-title]',card).map(h=>h.textContent));state(qs('[data-messages-state]'),'Mensagens salvas');});
  }
  function noteTemplate(n,i){return `<article class="pnr-note ${n.minimized?'minimized':''}" data-pnr-index="${i}"><div class="pnr-note-head"><input class="pnr-title" value="${esc(n.title)}" style="color:${n.titleColor||'#111827'}"><button type="button" class="editor-btn" data-pnr-toggle>${n.minimized?'Mostrar':'Minimizar'}</button><button type="button" class="editor-btn" data-pnr-delete>Excluir</button></div><textarea class="pnr-description" style="color:${n.descriptionColor||'#111827'}" placeholder="Descrição">${esc(n.description)}</textarea><div class="pnr-actions"><label>Cor do título <input type="color" data-pnr-title-color value="${n.titleColor||'#111827'}"></label><label>Cor da descrição <input type="color" data-pnr-description-color value="${n.descriptionColor||'#111827'}"></label><button type="button" data-pnr-save>Salvar bloco</button></div></article>`;}
  function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function setupPNR(){
    const list=qs('#pnr-notes-list');if(!list)return;let notes=load(PNR_KEY,[]);const render=()=>{list.innerHTML=notes.length?notes.map(noteTemplate).join(''):'<p class="manual-help">Nenhum bloco criado ainda. Clique em “Adicionar bloco”.</p>';};
    qs('[data-add-pnr]')?.addEventListener('click',()=>{notes.push({title:'Novo título',description:'Escreva sua anotação aqui.',titleColor:'#111827',descriptionColor:'#111827',minimized:false});render();state(qs('[data-pnr-state]'),'Bloco adicionado');});
    list.addEventListener('click',e=>{const note=e.target.closest('.pnr-note');if(!note)return;const i=Number(note.dataset.pnrIndex);if(e.target.matches('[data-pnr-toggle]')){notes[i].minimized=!notes[i].minimized;render();}else if(e.target.matches('[data-pnr-delete]')){notes.splice(i,1);save(PNR_KEY,notes);render();}else if(e.target.matches('[data-pnr-save]')){notes[i].title=qs('.pnr-title',note).value;notes[i].description=qs('.pnr-description',note).value;notes[i].titleColor=qs('[data-pnr-title-color]',note).value;notes[i].descriptionColor=qs('[data-pnr-description-color]',note).value;save(PNR_KEY,notes);state(qs('[data-pnr-state]'),'PNR salvo');}});
    list.addEventListener('input',e=>{const note=e.target.closest('.pnr-note');if(!note)return;if(e.target.matches('[data-pnr-title-color]'))qs('.pnr-title',note).style.color=e.target.value;if(e.target.matches('[data-pnr-description-color]'))qs('.pnr-description',note).style.color=e.target.value;});render();
  }
  function start(){setupProfarma();setupMessages();setupPNR();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
