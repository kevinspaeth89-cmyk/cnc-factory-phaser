(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const euro = amount => '€ ' + Math.round(amount).toLocaleString('de-DE');
  const orders = [
    {id:'A12',customer:'Veltraxis Mobility',part:'Wellenflansch A12',material:'1.4301 Edelstahl',kg:72,qty:50,reward:8400,duration:48,deadlineHours:7},
    {id:'B07',customer:'Orionis Fluidics',part:'Ventilgehäuse B07',material:'1.4404 Edelstahl',kg:96,qty:40,reward:11200,duration:62,deadlineHours:9},
    {id:'C21',customer:'Kaeldor Components',part:'Distanzring C21',material:'C45 Stahl',kg:48,qty:80,reward:6900,duration:38,deadlineHours:6}
  ];
  const defaults = () => ({money:14000,material:120,machineLevel:1,maintenance:90,tool:82,speed:1,paused:false,activeId:null,progress:0,produced:0,selected:null,gameMinutes:0,deadlineAt:null,completed:0});
  let state = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem('cnc_factory_save_v2') || 'null');
    if (saved && typeof saved.money === 'number' && Number.isFinite(saved.money)) {
      state = {...state,...saved};
      if (!orders.some(o => o.id === state.activeId)) state.activeId = null;
      if (![1,2,5,10].includes(state.speed)) state.speed = 1;
    }
  } catch (_) { /* Private browsing can disable local storage. */ }
  const save = () => { try { localStorage.setItem('cnc_factory_save_v2',JSON.stringify(state)); } catch (_) {} };
  const active = () => orders.find(o => o.id === state.activeId) || null;
  let visual = null;
  let messageTimer;
  function say(message) {
    $('message').textContent = message;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { if ($('message').textContent === message) $('message').textContent = ''; },5000);
  }
  function tab(name) {
    $('orders-panel').hidden = name !== 'orders';
    $('machine-panel').hidden = name !== 'machine';
    $('orders-tab').classList.toggle('active',name === 'orders');
    $('machine-tab').classList.toggle('active',name === 'machine');
  }
  function renderOrders() {
    $('orders').replaceChildren(...orders.map(o => {
      const card = document.createElement('article');
      card.className = 'card' + (state.selected === o.id ? ' selected' : '') + (state.activeId === o.id ? ' running' : '');
      card.innerHTML = `<div class="top"><span>${o.customer}</span><span>#${o.id}</span></div><h3>${o.part}</h3><p>${o.material} · ${o.qty} Teile</p><div class="values"><span>${o.kg} kg · Frist ${o.deadlineHours} h</span><b>${euro(o.reward)}</b></div>`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = state.activeId === o.id ? 'Produktion läuft' : 'Auftrag starten';
      button.disabled = !!state.activeId;
      button.addEventListener('click',event => {event.stopPropagation(); startOrder(o.id);});
      card.append(button);
      card.addEventListener('click',() => {state.selected=o.id;save();renderOrders();});
      return card;
    }));
  }
  function clock() {
    const minutes = Math.floor(state.gameMinutes);
    const day = ['Mo','Di','Mi','Do','Fr'][Math.floor(minutes/1440)%5];
    return `${day} ${String(Math.floor(minutes%1440/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  }
  function render() {
    const o=active(), pct=Math.max(0,Math.min(100,state.progress));
    $('money').textContent=euro(state.money);
    $('material').textContent=Math.floor(state.material)+' kg';
    $('parts').textContent=o ? `${state.produced} / ${o.qty}` : `${state.completed} fertig`;
    $('part-name').textContent=o ? o.part : 'Auftrag auswählen';
    $('progress').style.width=pct+'%';
    $('progress-label').textContent=o ? `${Math.floor(pct)} % · ${state.produced} / ${o.qty} Teile` : 'Bereit für den nächsten Auftrag';
    $('clock').textContent=clock();
    const status=$('status');
    status.textContent=o ? (state.paused ? '● Pausiert' : '● Produktion läuft') : '● Bereit';
    status.classList.toggle('paused',!!o && state.paused);
    $('pause').textContent=state.paused ? '▶ Fortsetzen' : '⏸ Pause';
    $('pause').classList.toggle('active',state.paused);
    $('pause').disabled=!o;
    document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===state.speed));
    $('machine-meta').textContent=`Level ${state.machineLevel} · ${Math.round((state.machineLevel-1)*13)} % schneller · ${state.completed} Aufträge abgeschlossen`;
    $('upgrade-cost').textContent=euro(9000*state.machineLevel)+' · +13 % Tempo';
    $('tool-label').textContent=Math.round(state.tool)+' %';
    $('tool-meter').style.width=Math.max(0,state.tool)+'%';
    $('maintenance-label').textContent=Math.round(state.maintenance)+' %';
    $('maintenance-meter').style.width=Math.max(0,state.maintenance)+'%';
    $('buy-material').disabled=state.money<2200;
    $('change-tool').disabled=!!o || state.money<650 || state.tool>=99;
    $('maintenance').disabled=!!o || state.money<1200 || state.maintenance>=99;
    $('upgrade').disabled=state.money<9000*state.machineLevel;
    if(visual)visual.running=!!o&&!state.paused;
  }
  function startOrder(id) {
    const o=orders.find(item=>item.id===id);
    if(!o || active()) {say('Zuerst den laufenden Auftrag abschließen.');return;}
    if(state.material<o.kg) {say(`Es fehlen ${o.kg-state.material} kg Material. Im Maschinen-Reiter kaufen.`);tab('machine');return;}
    if(state.maintenance<20) {say('Vor dem Start ist eine Wartung erforderlich.');tab('machine');return;}
    if(state.tool<15) {say('Vor dem Start muss das Werkzeug gewechselt werden.');tab('machine');return;}
    state.material-=o.kg;
    state.activeId=id;
    state.selected=id;
    state.deadlineAt=state.gameMinutes+o.deadlineHours*60;
    state.progress=0;state.produced=0;state.paused=false;
    save();renderOrders();render();tab('machine');say(`${o.part} gestartet. Produktion läuft.`);
  }
  function tick(dt) {
    if(state.paused)return;
    state.gameMinutes+=dt*state.speed*6;
    const o=active();
    if(!o) {render();return;}
    const factor=(1+(state.machineLevel-1)*.13)*Math.max(.65,state.maintenance/100*.75+.25);
    const gain=100/o.duration*dt*state.speed*factor;
    state.progress=Math.min(100,state.progress+gain);
    state.produced=Math.min(o.qty,Math.floor(o.qty*state.progress/100));
    state.maintenance=Math.max(0,state.maintenance-gain*.12);
    state.tool=Math.max(0,state.tool-gain*.18);
    if(state.progress>=100) {
      const late=state.deadlineAt!==null && state.gameMinutes>state.deadlineAt;
      const payout=late?Math.round(o.reward*.8):o.reward;
      state.money+=payout;state.completed++;state.activeId=null;state.progress=0;state.produced=0;
      state.deadlineAt=null;state.speed=1;state.paused=false;
      save();renderOrders();render();tab('orders');say(`${o.part} abgeschlossen · ${euro(payout)}${late?' (20 % Verspätungsabzug)':''}`);
      return;
    }
    render();
  }
  $('orders-tab').addEventListener('click',()=>tab('orders'));
  $('machine-tab').addEventListener('click',()=>tab('machine'));
  $('buy-material').addEventListener('click',()=>{if(state.money<2200)return;state.money-=2200;state.material+=100;save();render();say('100 kg Rohmaterial eingelagert.');});
  $('change-tool').addEventListener('click',()=>{if(active()||state.money<650||state.tool>=99)return;state.money-=650;state.tool=100;save();render();say('Werkzeug gewechselt.');});
  $('maintenance').addEventListener('click',()=>{if(active()||state.money<1200||state.maintenance>=99)return;state.money-=1200;state.maintenance=100;save();render();say('Wartung abgeschlossen.');});
  $('upgrade').addEventListener('click',()=>{const cost=9000*state.machineLevel;if(state.money<cost)return;state.money-=cost;state.machineLevel++;save();render();say('Nexora NX-350 verbessert.');});
  $('pause').addEventListener('click',()=>{if(!active())return;state.paused=!state.paused;save();render();say(state.paused?'Produktion pausiert.':'Produktion fortgesetzt.');});
  document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{state.speed=Number(b.dataset.speed);save();render();}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  renderOrders();render();tab(active()?'machine':'orders');
  if(typeof Phaser==='undefined') {say('Spiel konnte nicht geladen werden. Bitte die Seite neu laden.');return;}
  class FactoryScene extends Phaser.Scene {
    constructor(){super('factory');this.running=false;this.elapsed=0;}
    preload(){this.load.image('nexora','cell-nexora.jpg');}
    create(){
      visual=this;
      const base=this.add.graphics();
      base.fillGradientStyle(0x253943,0x253943,0x101e29,0x101e29).fillRect(0,0,1000,800);
      this.add.image(500,400,'nexora').setDisplaySize(1000,836);
      // Rotating spindle glint and flying chips are anchored inside the real machine window.
      this.spindle=this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      this.sparks=Array.from({length:20},()=>{
        const p=this.add.circle(440,385,Phaser.Math.FloatBetween(.8,2.3),0x9cefff,0).setBlendMode(Phaser.BlendModes.ADD);
        return {sprite:p,phase:Math.random()*Math.PI*2,radius:12+Math.random()*57,speed:1+Math.random()*2};
      });
      this.tower=this.add.circle(199,45,8,0x6cff98,.12).setBlendMode(Phaser.BlendModes.ADD);
      render();
    }
    update(_time,delta){
      const dt=Math.min(delta/1000,.2);
      this.elapsed+=dt;
      this.spindle.clear();
      const on=this.running;
      if(on){
        this.spindle.lineStyle(3,0x97e6ff,.55).beginPath().arc(445,377,31,this.elapsed*9,this.elapsed*9+1.7).strokePath();
        this.spindle.lineStyle(2,0xffffff,.32).beginPath().arc(445,377,22,-this.elapsed*13,-this.elapsed*13+1.25).strokePath();
      }
      this.sparks.forEach(p=>{
        const t=this.elapsed*p.speed*4+p.phase;
        p.sprite.setPosition(445+Math.cos(t)*p.radius,390+Math.sin(t*.8)*p.radius*.46);
        p.sprite.setAlpha(on ? .14+.6*Math.max(0,Math.sin(t*2)) : 0);
      });
      this.tower.setAlpha(on ? .18+.45*(.5+.5*Math.sin(this.elapsed*8)) : .09);
    }
  }
  new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1000,height:800,backgroundColor:'#152a35',scale:{mode:Phaser.Scale.ENVELOP,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,pixelArt:false},scene:[FactoryScene]});
  let previous=performance.now(),accumulator=0;
  function frame(now){
    accumulator+=Math.min((now-previous)/1000,.25);previous=now;
    if(accumulator>=.1){tick(accumulator);accumulator=0;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setInterval(save,5000);
  window.cncFactory={getState:()=>({...state}),orders:orders.map(o=>({...o}))};
})();
