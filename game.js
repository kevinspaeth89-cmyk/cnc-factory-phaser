(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const euro = amount => '€ ' + Math.round(amount).toLocaleString('de-DE');
  const SAVE_KEY = 'cnc_factory_save_v3';
  const START = Date.UTC(2026, 0, 5, 6);
  const HIRING_FEE = 150;
  const STORAGE_RATE = .08; // euros per kg and game day
  const STORAGE_UPGRADE = 4000;
  const MATERIAL_PRICE = 2200;
  const SELL_BASE_RATE = .60;
  const SELL_UPGRADE_RATE = .35;
  const catalog = {
    standard: {name:'Nexora NX-350',kind:'Drehen',price:6500,rate:1},
    rapid: {name:'Nexora NX-420',kind:'Drehen',price:9000,rate:1.25},
    premium: {name:'Aurex AT-600',kind:'Drehen',price:12500,rate:1.55},
    mill3: {name:'Veltron VX-500',kind:'Fräsen',price:10500,rate:1.12},
    mill5: {name:'Orionis OM-650X',kind:'Fräsen',price:14800,rate:1.38}
  };
  const hallArtwork = {
    1:'hall-four-bays.jpg?v=2',
    2:'hall-two-machines.webp?v=1',
    3:'hall-three-machines.webp?v=1',
    4:'hall-four-machines.webp?v=1'
  };
  const hallMachineArtwork = {
    mill3:'assets/veltron-vx500-hall.webp?v=1',
    mill5:'assets/orionis-om650x-hall.webp?v=1'
  };
  const orders = [
    {id:'A12',kind:'Drehen',customer:'Veltraxis Mobility',part:'Wellenflansch A12',material:'1.4301 Edelstahl',kg:72,qty:50,reward:8400,duration:48,deadlineHours:7},
    {id:'B07',kind:'Drehen',customer:'Orionis Fluidics',part:'Ventilgehäuse B07',material:'1.4404 Edelstahl',kg:96,qty:40,reward:11200,duration:62,deadlineHours:9},
    {id:'C21',kind:'Drehen',customer:'Kaeldor Components',part:'Distanzring C21',material:'C45 Stahl',kg:48,qty:80,reward:6900,duration:38,deadlineHours:6},
    {id:'M14',kind:'Fräsen',customer:'Asteron Robotics',part:'Grundplatte M14',material:'EN AW-6082 Aluminium',kg:58,qty:36,reward:9800,duration:54,deadlineHours:8},
    {id:'F32',kind:'Fräsen',customer:'Kaeldor Systems',part:'Spannprisma F32',material:'42CrMo4 Stahl',kg:74,qty:30,reward:12600,duration:68,deadlineHours:10},
    {id:'P09',kind:'Fräsen',customer:'Orionis Fluidics',part:'Pumpengehäuse P09',material:'EN-GJS-400',kg:88,qty:24,reward:13900,duration:78,deadlineHours:11}
  ];
  const freshMachine = (bay, type='standard') => ({
    bay,type,level:1,maintenance:90,tool:82,operator1:false,operator2:false,
    activeId:null,progress:0,produced:0,deadlineAt:null
  });
  const defaults = () => {
    const first=freshMachine(1);
    first.operator1=true;
    return {money:14000,material:120,capacity:300,staff:{shift1:1,shift2:0},
      machines:[first],selectedBay:1,speed:1,paused:false,gameMinutes:0,completed:0,
      payrollDue:0,wagesPaid:0,storagePaid:0,energyPaid:0,selected:null};
  };
  let state=defaults();
  function validMachine(m) {
    return m && Number.isInteger(m.bay) && m.bay>=1 && m.bay<=4 &&
      !!catalog[m.type] && typeof m.progress==='number';
  }
  try {
    const stored=JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if(stored && Number.isFinite(stored.money) && Array.isArray(stored.machines)) {
      state={...defaults(),...stored};
      state.machines=stored.machines.filter(validMachine).map(m=>({...freshMachine(m.bay,m.type),...m}));
      if(!state.machines.some(m=>m.bay===1))state.machines.unshift(defaults().machines[0]);
      state.machines=state.machines.filter((m,i,a)=>a.findIndex(x=>x.bay===m.bay)===i);
      state.staff={shift1:Math.max(0,Number(stored.staff?.shift1)||0),shift2:Math.max(0,Number(stored.staff?.shift2)||0)};
    } else {
      const legacy=JSON.parse(localStorage.getItem('cnc_factory_save_v2') || 'null');
      if(legacy && Number.isFinite(legacy.money)) {
        state.money=legacy.money;
        state.material=Number.isFinite(legacy.material)?legacy.material:120;
        state.gameMinutes=(Number(legacy.gameMinutes)||0)+360;
        state.completed=Number(legacy.completed)||0;
        state.speed=[1,2,5,10].includes(legacy.speed)?legacy.speed:1;
        state.paused=!!legacy.paused;
        state.selected=legacy.selected;
        const m=state.machines[0];
        m.level=Number(legacy.machineLevel)||1;
        m.maintenance=Number.isFinite(legacy.maintenance)?legacy.maintenance:90;
        m.tool=Number.isFinite(legacy.tool)?legacy.tool:82;
        if(orders.some(o=>o.id===legacy.activeId)){
          m.activeId=legacy.activeId;
          m.progress=Number(legacy.progress)||0;
          m.produced=Number(legacy.produced)||0;
          m.deadlineAt=Number.isFinite(legacy.deadlineAt)?legacy.deadlineAt+360:null;
        }
      }
    }
  } catch (_) { /* Storage may be unavailable. */ }
  state.speed=[1,2,5,10].includes(state.speed)?state.speed:1;
  state.capacity=Math.max(300,Number(state.capacity)||300,Math.ceil(state.material));
  state.selectedBay=state.machines.some(m=>m.bay===state.selectedBay)?state.selectedBay:1;
  // Restored assignments may be malformed. Preserve the starter's operator.
  for(const shift of [1,2]){
    const key='operator'+shift,staffKey='shift'+shift;
    let assigned=0;
    state.machines.forEach(m=>{if(m[key]){if(assigned<state.staff[staffKey])assigned++;else m[key]=false;}});
  }
  const save = () => {try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch(_){}};
  const selectedMachine=()=>state.machines.find(m=>m.bay===state.selectedBay);
  const machineAt=bay=>state.machines.find(m=>m.bay===bay);
  const job=m=>orders.find(o=>o.id===m.activeId)||null;
  const compatible=(m,o)=>!!m&&!!o&&catalog[m.type].kind===o.kind;
  const upgradeInvestment=m=>9000*((m.level-1)*m.level/2);
  const resaleValue=m=>Math.round(catalog[m.type].price*SELL_BASE_RATE+upgradeInvestment(m)*SELL_UPGRADE_RATE);
  const productionFactor=m=>catalog[m.type].rate*(1+(m.level-1)*.13)*Math.max(.65,m.maintenance/100*.75+.25);
  const remainingMinutes=(m,o)=>o?Math.max(0,(100-m.progress)*o.duration*6/(100*productionFactor(m))):0;
  const formatMinutes=min=>{
    min=Math.max(0,Math.ceil(min));
    const hours=Math.floor(min/60),mins=min%60;
    return hours?(hours+' h '+mins+' min'):(mins+' min');
  };
  const dateAt=min=>new Date(START+Math.floor(min)*60000);
  const shiftAt=min=>{
    const d=dateAt(min),day=d.getUTCDay(),hour=d.getUTCHours();
    return day===0||day===6 ? 0 : hour>=6&&hour<14 ? 1 : hour>=14&&hour<22 ? 2 : 0;
  };
  const clock=()=>{
    const d=dateAt(state.gameMinutes),day=['So','Mo','Di','Mi','Do','Fr','Sa'][d.getUTCDay()];
    return `${day} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
  };
  const operating=m=>!!job(m)&&!state.paused&&!!shiftAt(state.gameMinutes)&&
    !!m['operator'+shiftAt(state.gameMinutes)]&&m.tool>=1&&m.maintenance>=8;
  let visual=null, currentPanel=null, messageTimer, zoomTimer, phaserGame=null;
  function say(message){
    $('message').textContent=message;
    clearTimeout(messageTimer);
    messageTimer=setTimeout(()=>{if($('message').textContent===message)$('message').textContent='';},5000);
  }
  function statusFor(m){
    if(!m)return 'Freier Stellplatz';
    if(state.paused)return 'Pausiert';
    if(m.maintenance<8)return 'Wartung fällig';
    if(m.tool<1)return 'Werkzeug verschlissen';
    if(!job(m))return 'Bereit';
    const shift=shiftAt(state.gameMinutes);
    if(!shift)return 'Betrieb geschlossen';
    if(!m['operator'+shift])return `Kein Bediener Schicht ${shift}`;
    return 'Produktion läuft';
  }
  function tab(name){
    currentPanel=name;
    $('drawer').hidden=false;
    $('scrim').hidden=false;
    $('drawer-title').textContent={orders:'Aufträge',machine:'Maschine',business:'Betrieb'}[name];
    for(const panel of ['orders','machine','business']){
      $(panel+'-panel').hidden=name!==panel;
      $(panel+'-tab').classList.toggle('active',name===panel);
      $(panel+'-tab').setAttribute('aria-expanded',String(name===panel));
    }
    $('speed-menu').hidden=true;
    $('speed-toggle').setAttribute('aria-expanded','false');
    renderOrders();
    renderBusiness();
  }
  function closeDrawer(){
    currentPanel=null;
    $('drawer').hidden=true;
    $('scrim').hidden=true;
    for(const panel of ['orders','machine','business']){
      $(panel+'-tab').classList.remove('active');
      $(panel+'-tab').setAttribute('aria-expanded','false');
    }
  }
  function selectBay(bay){
    if(!machineAt(bay))return;
    state.selectedBay=bay;
    save();renderOrders();renderBusiness();render();
  }
  function showMachine(bay=state.selectedBay){
    if(!machineAt(bay))return;
    selectBay(bay);
    if(typeof Phaser==='undefined'){say('Maschinenansicht konnte nicht geladen werden. Bitte neu laden.');return;}
    if(!$('detail-view').hidden)return;
    $('hall-map').classList.add('zooming');
    clearTimeout(zoomTimer);
    zoomTimer=setTimeout(()=>{
      $('hall-view').hidden=true;
      $('detail-view').hidden=false;
      ensureGame();
      visual?.scale.refresh();
    },window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:300);
  }
  function showHall(){
    clearTimeout(zoomTimer);
    $('detail-view').hidden=true;
    $('hall-view').hidden=false;
    $('hall-map').classList.remove('zooming');
  }
  function renderOrders(){
    $('order-machine').replaceChildren(...state.machines.map(m=>{
      const opt=document.createElement('option');
      opt.value=m.bay;opt.textContent=`Platz ${m.bay} · ${catalog[m.type].name} · ${catalog[m.type].kind}`;
      opt.selected=m.bay===state.selectedBay;
      return opt;
    }));
    $('orders').replaceChildren(...orders.map(o=>{
      const m=selectedMachine(),card=document.createElement('article');
      const running=state.machines.find(x=>x.activeId===o.id),fits=compatible(m,o);
      card.className='card'+(state.selected===o.id?' selected':'')+(running?' running':'')+(!fits&&!running?' incompatible':'');
      card.innerHTML=`<div class="top"><span>${o.customer}</span><span>${o.kind} · #${o.id}</span></div><h3>${o.part}</h3><p>${o.material} · ${o.qty} Teile</p><div class="values"><span>${o.kg} kg · Frist ${o.deadlineHours} h</span><b>${euro(o.reward)}</b></div>`;
      if(running){const p=document.createElement('p');p.textContent=`Läuft auf Platz ${running.bay} · ${running.produced}/${o.qty} Teile`;card.append(p);}
      const button=document.createElement('button');
      button.type='button';
      button.textContent=running?'Produktion läuft':fits?`Auf Platz ${m.bay} starten`:`Benötigt ${o.kind}`;
      button.disabled=!!running||!!job(m)||!fits;
      button.addEventListener('click',event=>{event.stopPropagation();startOrder(o.id);});
      card.append(button);
      card.addEventListener('click',()=>{state.selected=o.id;save();renderOrders();});
      return card;
    }));
  }
  function renderBusiness(){
    const m=selectedMachine();
    $('staff-summary').textContent=`S1: ${state.staff.shift1} · S2: ${state.staff.shift2} · ${state.machines.length}/4 Maschinen`;
    renderCosts();
    $('hire-1').disabled=state.money<HIRING_FEE||state.staff.shift1>=4;
    $('hire-2').disabled=state.money<HIRING_FEE||state.staff.shift2>=4;
    for(const shift of [1,2]){
      const assigned=state.machines.filter(x=>x['operator'+shift]).length;
      $('fire-'+shift).disabled=state.staff['shift'+shift]<=assigned;
      $('free-'+shift).textContent=`${state.staff['shift'+shift]-assigned} frei`;
    }
    $('storage-upgrade').disabled=state.money<STORAGE_UPGRADE;
    $('machine-shop').replaceChildren(...Object.entries(catalog).map(([type,c])=>{
      const card=document.createElement('article');
      const affordable=state.money>=c.price,full=state.machines.length>=4;
      card.className='machine-card '+(c.kind==='Fräsen'?'mill-card':'turn-card')+((!affordable||full)?' locked':'');
      const head=document.createElement('div');head.className='machine-card-head';
      head.innerHTML=`<span class="machine-kind">${c.kind}</span><span class="machine-speed">${Math.round(c.rate*100)} % Tempo</span>`;
      const title=document.createElement('h4');title.textContent=c.name;
      const bar=document.createElement('div');bar.className='machine-rate';
      const fill=document.createElement('span');fill.style.width=Math.min(100,Math.round(c.rate/1.55*100))+'%';bar.append(fill);
      const foot=document.createElement('div');foot.className='machine-card-foot';
      const note=document.createElement('small');
      note.textContent=full?'Alle 4 Plätze belegt':affordable?'Sofort verfügbar':'Guthaben reicht nicht';
      const button=document.createElement('button');
      button.type='button';button.className='action machine-buy';
      button.textContent=full?'Halle voll':euro(c.price);
      button.disabled=full||!affordable;
      button.addEventListener('click',()=>buyMachine(type));
      foot.append(note,button);
      card.append(head,title,bar,foot);
      return card;
    }));
    $('operator-1').textContent=m.operator1?'S1 abziehen':'S1 zuweisen';
    $('operator-2').textContent=m.operator2?'S2 abziehen':'S2 zuweisen';
    $('sell-machine-value').textContent=euro(resaleValue(m));
    $('sell-machine').disabled=state.machines.length<=1||!!job(m);
    for(const shift of [1,2]){
      const assigned=state.machines.filter(x=>x['operator'+shift]).length;
      $('operator-'+shift).disabled=!m['operator'+shift]&&assigned>=state.staff['shift'+shift];
    }
  }
  function renderCosts(){
    $('payroll-due').textContent=euro(state.payrollDue);
    $('wages-paid').textContent=euro(state.wagesPaid);
    $('energy-paid').textContent=euro(state.energyPaid);
    $('storage-paid').textContent=euro(state.storagePaid);
    $('storage-info').textContent=`${Math.floor(state.material)} / ${state.capacity} kg · ${euro(state.material*STORAGE_RATE)} pro Spieltag`;
  }
  function render(){
    const m=selectedMachine(),o=job(m),pct=Math.max(0,Math.min(100,m.progress));
    const hallImage=$('hall-image'),hallCount=String(state.machines.length);
    if(hallImage.dataset.hallCount!==hallCount){
      hallImage.src=hallArtwork[state.machines.length];
      hallImage.dataset.hallCount=hallCount;
    }
    $('money').textContent=euro(state.money);
    $('material').textContent=Math.floor(state.material)+' kg';
    $('parts').textContent=`${state.machines.length} / 4`;
    $('part-name').textContent=o?o.part:'Auftrag auswählen';
    $('progress').style.width=pct+'%';
    $('progress-label').textContent=o?`${Math.floor(pct)} % · ${m.produced} / ${o.qty} · ${statusFor(m)}`:statusFor(m);
    $('clock').textContent=clock();
    $('status').textContent='● '+statusFor(m);
    $('status').classList.toggle('paused',state.paused);
    $('pause').textContent=state.paused?'▶ Weiter':'⏸ Pause';
    $('pause').classList.toggle('active',state.paused);
    document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===state.speed));
    $('speed-value').textContent=state.speed+'×';
    $('machine-heading').textContent=catalog[m.type].name;
    $('machine-readout').textContent=`${catalog[m.type].name.toUpperCase()} · PLATZ ${m.bay}`;
    $('machine-meta').textContent=`Platz ${m.bay} · ${catalog[m.type].kind} · Level ${m.level} · ${statusFor(m)}`;
    $('upgrade-cost').textContent=euro(9000*m.level)+' · +13 % Tempo';
    $('tool-label').textContent=Math.round(m.tool)+' %';
    $('tool-meter').style.width=Math.max(0,m.tool)+'%';
    $('maintenance-label').textContent=Math.round(m.maintenance)+' %';
    $('maintenance-meter').style.width=Math.max(0,m.maintenance)+'%';

    const hudOrder=o?(o.part+' · #'+o.id):'Kein Auftrag';
    const deadlineLeft=o&&m.deadlineAt!==null?m.deadlineAt-state.gameMinutes:null;
    $('hud-machine').textContent=catalog[m.type].name+' · Platz '+m.bay+' · Level '+m.level;
    $('hud-state').textContent=statusFor(m);
    $('hud-state').className='hud-state '+(operating(m)?'ok':o?'wait':'idle');
    $('hud-order').textContent=hudOrder;
    $('hud-parts').textContent=o?(m.produced+' / '+o.qty):'—';
    $('hud-time').textContent=o?formatMinutes(remainingMinutes(m,o)):'—';
    $('hud-deadline').textContent=deadlineLeft===null?'—':deadlineLeft<0?(formatMinutes(-deadlineLeft)+' überfällig'):formatMinutes(deadlineLeft);
    $('hud-tool').textContent=Math.round(m.tool)+' %';
    $('hud-maintenance').textContent=Math.round(m.maintenance)+' %';
    $('hud-operators').textContent='S1 '+(m.operator1?'✓':'–')+' · S2 '+(m.operator2?'✓':'–');
    $('hud-job-button').textContent=o?'Aufträge ansehen':'Auftrag wählen';

    $('buy-material').disabled=state.money<MATERIAL_PRICE||state.material+100>state.capacity;
    $('change-tool').disabled=!!o||state.money<650||m.tool>=99;
    $('maintenance').disabled=!!o||state.money<1200||m.maintenance>=99;
    $('upgrade').disabled=state.money<9000*m.level;
    $('sell-machine-value').textContent=euro(resaleValue(m));
    $('sell-machine').disabled=state.machines.length<=1||!!o;
    for(let bay=1;bay<=4;bay++){
      const b=$('bay-'+bay),machine=machineAt(bay);
      b.classList.toggle('installed',!!machine);
      b.classList.toggle('selected-bay',bay===m.bay);
      b.classList.toggle('working-bay',!!machine&&operating(machine));
      b.classList.toggle('warning-bay',!!machine&&(machine.maintenance<8||machine.tool<1));
      b.classList.toggle('waiting-bay',!!machine&&!!job(machine)&&!operating(machine)&&machine.maintenance>=8&&machine.tool>=1);
      const milling=!!machine&&catalog[machine.type].kind==='Fräsen';
      b.classList.toggle('milling-bay',milling);
      let machineArt=b.querySelector('.bay-machine');
      let bayPatch=b.querySelector('.bay-patch');
      if(milling){
        if(!bayPatch){
          bayPatch=document.createElement('img');
          bayPatch.className='bay-patch';
          bayPatch.alt='';
          bayPatch.src='hall-four-bays.jpg?v=2';
          b.prepend(bayPatch);
        }
        if(!machineArt){
          machineArt=document.createElement('img');
          machineArt.className='bay-machine';
          machineArt.alt='';
          b.append(machineArt);
        }
        const src=hallMachineArtwork[machine.type];
        if(machineArt.getAttribute('src')!==src)machineArt.src=src;
        bayPatch.hidden=false;
        machineArt.hidden=false;
      }else{
        if(bayPatch)bayPatch.hidden=true;
        if(machineArt)machineArt.hidden=true;
      }
      b.querySelector('span').textContent=machine?catalog[machine.type].name:`+ Platz ${bay}`;
      b.setAttribute('aria-label',machine?`${catalog[machine.type].name}, Platz ${bay} ansehen`:`Freier Stellplatz ${bay}, Maschinen kaufen`);
      b.title=machine?statusFor(machine):'Maschine kaufen';
    }
    if(visual){
      visual.running=operating(m);
      visual.condition=(m.maintenance<8||m.tool<1)?'fault':operating(m)?'running':o?'waiting':'idle';
      visual.setMachineType(m.type);
    }
  }
  function startOrder(id){
    const o=orders.find(x=>x.id===id),m=selectedMachine();
    if(!o||!m||job(m)||state.machines.some(x=>x.activeId===id)){say('Diese Maschine oder dieser Auftrag ist bereits belegt.');return;}
    if(!compatible(m,o)){say(`${o.part} benötigt ${o.kind}. ${catalog[m.type].name} ist für ${catalog[m.type].kind} ausgelegt.`);return;}
    if(state.material<o.kg){say(`Es fehlen ${o.kg-state.material} kg Material.`);tab('machine');return;}
    if(m.maintenance<8||m.tool<1){say('Vorher Werkzeug oder Wartung erneuern.');tab('machine');return;}
    state.material-=o.kg;
    m.activeId=id;m.progress=0;m.produced=0;
    m.deadlineAt=state.gameMinutes+o.deadlineHours*60;
    save();renderOrders();renderBusiness();render();closeDrawer();showMachine(m.bay);
    say(`${o.part} auf Platz ${m.bay} angenommen. ${statusFor(m)}.`);
  }
  function buyMachine(type){
    const c=catalog[type],bay=[2,3,4].find(x=>!machineAt(x));
    if(!c||!bay||state.money<c.price)return;
    state.money-=c.price;
    state.machines.push(freshMachine(bay,type));
    selectBay(bay);renderBusiness();save();
    say(`${c.name} auf Platz ${bay} gekauft. Bediener zuweisen.`);
  }
  function sellMachine(){
    const m=selectedMachine();
    if(!m)return;
    if(state.machines.length<=1){say('Die letzte Maschine kann nicht verkauft werden.');return;}
    if(job(m)){say('Laufenden Auftrag zuerst abschließen.');return;}
    const name=catalog[m.type].name,value=resaleValue(m),oldBay=m.bay;
    state.machines=state.machines.filter(x=>x!==m).sort((a,b)=>a.bay-b.bay);
    state.machines.forEach((machine,index)=>{machine.bay=index+1;});
    state.selectedBay=Math.min(oldBay,state.machines.length);
    state.money+=value;
    showHall();save();renderOrders();renderBusiness();render();
    say(`${name} verkauft · +${euro(value)}.`);
  }
  function newGame(){
    if(!window.confirm('Neues Spiel starten? Der aktuelle Spielstand wird vollständig gelöscht.'))return;
    try{
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem('cnc_factory_save_v2');
    }catch(_){}
    state=defaults();
    clearTimeout(zoomTimer);
    closeDrawer();
    showHall();
    save();renderOrders();renderBusiness();render();
    say('Neues Spiel gestartet.');
  }
  function toggleOperator(shift){
    const m=selectedMachine(),key='operator'+shift;
    if(!m[key]&&state.machines.filter(x=>x[key]).length>=state.staff['shift'+shift])return;
    m[key]=!m[key];
    renderBusiness();render();save();
    say(`Schicht ${shift}: Bediener ${m[key]?'zugewiesen':'abgezogen'}.`);
  }
  function tick(dt){
    if(state.paused)return;
    // Slice at minute boundaries so shift changes and month end are charged exactly once.
    let left=dt*state.speed*6;
    while(left>1e-8){
      const step=Math.min(left,1-(state.gameMinutes%1)||1);
      const before=dateAt(state.gameMinutes),shift=shiftAt(state.gameMinutes);
      if(shift)state.payrollDue+=state.staff['shift'+shift]*(shift===1?24:26)*step/60;
      state.money-=state.material*STORAGE_RATE*step/1440;
      state.storagePaid+=state.material*STORAGE_RATE*step/1440;
      for(const m of state.machines){
        const o=job(m);
        if(!o||!operating(m))continue;
        const power=14*.28*step/60;
        state.money-=power;state.energyPaid+=power;
        const factor=productionFactor(m);
        const gain=100/o.duration*(step/6)*factor;
        m.progress=Math.min(100,m.progress+gain);
        m.produced=Math.min(o.qty,Math.floor(o.qty*m.progress/100));
        m.maintenance=Math.max(0,m.maintenance-gain*.12);
        m.tool=Math.max(0,m.tool-gain*.18);
        if(m.progress>=100){
          const late=m.deadlineAt!==null&&state.gameMinutes+step>m.deadlineAt;
          const payout=late?Math.round(o.reward*.8):o.reward;
          state.money+=payout;state.completed++;
          m.activeId=null;m.progress=0;m.produced=0;m.deadlineAt=null;
          state.speed=1;
          save();renderOrders();
          say(`${catalog[m.type].name}: ${o.part} fertig · ${euro(payout)}${late?' (20 % Fristabzug)':''}`);
        }
      }
      state.gameMinutes+=step;left-=step;
      const after=dateAt(state.gameMinutes);
      if(after.getUTCMonth()!==before.getUTCMonth()||after.getUTCFullYear()!==before.getUTCFullYear()){
        if(state.payrollDue){
          state.money-=state.payrollDue;state.wagesPaid+=state.payrollDue;
          say(`Monatliche Lohnabrechnung: −${euro(state.payrollDue)}.`);
          state.payrollDue=0;save();
        }
      }
    }
    render();
    if(currentPanel==='business')renderCosts();
  }
  for(const name of ['orders','machine','business'])
    $(name+'-tab').addEventListener('click',()=>currentPanel===name?closeDrawer():tab(name));
  $('close-drawer').addEventListener('click',closeDrawer);
  $('scrim').addEventListener('click',closeDrawer);
  for(let bay=1;bay<=4;bay++)$('bay-'+bay).addEventListener('click',()=>{
    if(machineAt(bay))showMachine(bay);
    else{tab('business');say(`Platz ${bay} ist frei. Wähle eine Maschine im Betrieb.`);}
  });
  $('back-to-hall').addEventListener('click',showHall);
  $('hud-job-button').addEventListener('click',()=>tab('orders'));
  $('hud-service-button').addEventListener('click',()=>tab('machine'));
  $('hud-staff-button').addEventListener('click',()=>tab('business'));
  $('order-machine').addEventListener('change',event=>selectBay(Number(event.target.value)));
  $('speed-toggle').addEventListener('click',()=>{
    const opening=$('speed-menu').hidden;
    if(opening)closeDrawer();
    $('speed-menu').hidden=!opening;
    $('speed-toggle').setAttribute('aria-expanded',String(opening));
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();$('speed-menu').hidden=true;}});
  $('buy-material').addEventListener('click',()=>{
    if(state.money<MATERIAL_PRICE||state.material+100>state.capacity)return;
    state.money-=MATERIAL_PRICE;state.material+=100;save();render();renderBusiness();say('100 kg Material eingelagert.');
  });
  $('change-tool').addEventListener('click',()=>{
    const m=selectedMachine();if(job(m)||state.money<650||m.tool>=99)return;
    state.money-=650;m.tool=100;save();render();say('Werkzeug gewechselt.');
  });
  $('maintenance').addEventListener('click',()=>{
    const m=selectedMachine();if(job(m)||state.money<1200||m.maintenance>=99)return;
    state.money-=1200;m.maintenance=100;save();render();say('Wartung abgeschlossen.');
  });
  $('upgrade').addEventListener('click',()=>{
    const m=selectedMachine(),cost=9000*m.level;if(state.money<cost)return;
    state.money-=cost;m.level++;save();render();say(`${catalog[m.type].name} verbessert.`);
  });
  $('sell-machine').addEventListener('click',sellMachine);
  $('new-game').addEventListener('click',newGame);
  for(const shift of [1,2]){
    $('operator-'+shift).addEventListener('click',()=>toggleOperator(shift));
    $('hire-'+shift).addEventListener('click',()=>{
      if(state.money<HIRING_FEE||state.staff['shift'+shift]>=4)return;
      state.money-=HIRING_FEE;state.staff['shift'+shift]++;
      save();renderBusiness();render();say(`Bediener Schicht ${shift} eingestellt.`);
    });
    $('fire-'+shift).addEventListener('click',()=>{
      if(state.staff['shift'+shift]<=state.machines.filter(m=>m['operator'+shift]).length)return;
      state.staff['shift'+shift]--;save();renderBusiness();render();say(`Freier Bediener Schicht ${shift} entlassen.`);
    });
  }
  $('storage-upgrade').addEventListener('click',()=>{
    if(state.money<STORAGE_UPGRADE)return;
    state.money-=STORAGE_UPGRADE;state.capacity+=200;
    save();renderBusiness();render();say('Lager um 200 kg erweitert.');
  });
  $('pause').addEventListener('click',()=>{state.paused=!state.paused;save();render();say(state.paused?'Spiel pausiert.':'Spiel fortgesetzt.');});
  document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{
    state.speed=Number(b.dataset.speed);save();render();
    $('speed-menu').hidden=true;$('speed-toggle').setAttribute('aria-expanded','false');
  }));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  renderOrders();renderBusiness();render();
  class FactoryScene extends (typeof Phaser==='undefined'?class{}:Phaser.Scene) {
    constructor(){super('factory');this.running=false;this.condition='idle';this.elapsed=0;}
    preload(){
      this.load.image('machine-standard','cell-nexora.jpg?v=c523bfea');
      this.load.image('machine-rapid','cell-nexora-nx420.webp?v=1');
      this.load.image('machine-premium','cell-aurex-at600.webp?v=1');
      this.load.image('machine-mill3','assets/veltron-vx500-detail.webp?v=1');
      this.load.image('machine-mill5','assets/orionis-om650x-detail.webp?v=1');
    }
    create(){
      visual=this;
      const base=this.add.graphics();
      base.fillGradientStyle(0x253943,0x253943,0x101e29,0x101e29).fillRect(0,0,1000,800);
      this.machineImage=this.add.image(500,400,'machine-standard').setDisplaySize(1000,836);
      this.spindle=this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      this.sparks=Array.from({length:20},()=>{
        const p=this.add.circle(440,385,Phaser.Math.FloatBetween(.8,2.3),0x9cefff,0).setBlendMode(Phaser.BlendModes.ADD);
        return {sprite:p,phase:Math.random()*Math.PI*2,radius:12+Math.random()*57,speed:1+Math.random()*2};
      });
      this.towerRed=this.add.circle(199,29,8,0xff5b62,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.towerAmber=this.add.circle(199,45,8,0xffc15b,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.towerGreen=this.add.circle(199,61,8,0x6cff98,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.isMilling=false;
      this.millWorkX=500;this.millWorkY=405;
      this.millPhotoGlow=this.add.circle(500,405,34,0x8cefff,0).setBlendMode(Phaser.BlendModes.ADD);
      this.millPhotoRed=this.add.circle(820,120,8,0xff5b62,0).setBlendMode(Phaser.BlendModes.ADD);
      this.millPhotoAmber=this.add.circle(820,138,8,0xffc15b,0).setBlendMode(Phaser.BlendModes.ADD);
      this.millPhotoGreen=this.add.circle(820,156,8,0x6cff98,0).setBlendMode(Phaser.BlendModes.ADD);
      this.millPhotoSparks=Array.from({length:14},()=>{
        const p=this.add.circle(500,410,Phaser.Math.FloatBetween(.8,2.1),0xb5f3ff,0).setBlendMode(Phaser.BlendModes.ADD);
        return {sprite:p,phase:Math.random()*Math.PI*2,radius:10+Math.random()*38,speed:1+Math.random()*2.1};
      });

      this.millGroup=this.add.container(0,0).setVisible(false);
      const millBody=this.add.graphics();
      millBody.fillStyle(0x53646b,1).fillRoundedRect(160,105,680,565,28);
      millBody.fillStyle(0x263840,1).fillRoundedRect(205,150,470,405,18);
      millBody.fillStyle(0x0e1c23,1).fillRoundedRect(235,182,405,330,13);
      millBody.lineStyle(5,0x8da8b3,.85).strokeRoundedRect(235,182,405,330,13);
      millBody.fillStyle(0x18272e,1).fillRoundedRect(690,165,112,360,14);
      millBody.lineStyle(3,0x88a2ac,.7).strokeRoundedRect(690,165,112,360,14);
      millBody.fillStyle(0x7a8b91,1).fillRoundedRect(180,590,640,65,16);
      millBody.fillStyle(0x10222b,1).fillRect(225,525,430,42);
      this.millGroup.add(millBody);

      this.millHead=this.add.rectangle(470,265,130,118,0x687a81).setStrokeStyle(4,0xaec1c8,.85);
      this.millSpindle=this.add.rectangle(470,352,34,116,0xc7d5da).setStrokeStyle(3,0x52636a,1);
      this.millTool=this.add.rectangle(470,424,10,54,0xe7eef0);
      this.millTable=this.add.rectangle(470,500,350,54,0x526b75).setStrokeStyle(3,0x9cb0b8,.7);
      this.millWorkpiece=this.add.rectangle(470,466,165,55,0xb68d55).setStrokeStyle(3,0xe0bd81,.85);
      this.millGlow=this.add.circle(470,446,28,0x7feaff,.15).setBlendMode(Phaser.BlendModes.ADD);
      this.millPanel=this.add.rectangle(746,300,72,205,0x15262e).setStrokeStyle(2,0x78939e,.8);
      this.millScreen=this.add.rectangle(746,250,52,70,0x2a7188).setStrokeStyle(2,0x8bd8e8,.7);
      this.millTowerRed=this.add.circle(784,127,8,0xff5b62,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.millTowerAmber=this.add.circle(784,145,8,0xffc15b,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.millTowerGreen=this.add.circle(784,163,8,0x6cff98,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.millGroup.add([this.millHead,this.millSpindle,this.millTool,this.millTable,this.millWorkpiece,this.millGlow,this.millPanel,this.millScreen,this.millTowerRed,this.millTowerAmber,this.millTowerGreen]);
      this.millSparks=Array.from({length:18},()=>{
        const p=this.add.circle(470,448,Phaser.Math.FloatBetween(1,2.6),0xaeefff,0).setBlendMode(Phaser.BlendModes.ADD);
        this.millGroup.add(p);
        return {sprite:p,phase:Math.random()*Math.PI*2,radius:10+Math.random()*48,speed:1+Math.random()*2.5};
      });
      render();
    }
    setMachineType(type){
      const milling=catalog[type].kind==='Fräsen';
      this.isMilling=milling;
      this.millGroup.setVisible(false);
      this.machineImage.setVisible(true);
      const key='machine-'+type;
      if(this.machineImage.texture.key!==key)this.machineImage.setTexture(key);
      if(milling){
        this.machineImage.setDisplaySize(1000,750).setPosition(500,400);
        const cfg=type==='mill5'
          ?{work:[535,407],tower:[826,120]}
          :{work:[505,415],tower:[812,118]};
        this.millWorkX=cfg.work[0];this.millWorkY=cfg.work[1];
        this.millPhotoGlow.setPosition(this.millWorkX,this.millWorkY);
        this.millPhotoRed.setPosition(cfg.tower[0],cfg.tower[1]);
        this.millPhotoAmber.setPosition(cfg.tower[0],cfg.tower[1]+18);
        this.millPhotoGreen.setPosition(cfg.tower[0],cfg.tower[1]+36);
      }else{
        this.machineImage.setDisplaySize(1000,836).setPosition(500,400);
      }
    }
    update(_time,delta){
      const dt=Math.min(delta/1000,.2);this.elapsed+=dt;this.spindle.clear();
      const on=this.running;
      if(on){
        this.spindle.lineStyle(3,0x97e6ff,.55).beginPath().arc(445,377,31,this.elapsed*9,this.elapsed*9+1.7).strokePath();
        this.spindle.lineStyle(2,0xffffff,.32).beginPath().arc(445,377,22,-this.elapsed*13,-this.elapsed*13+1.25).strokePath();
      }
      this.sparks.forEach(p=>{
        const t=this.elapsed*p.speed*4+p.phase;
        p.sprite.setPosition(445+Math.cos(t)*p.radius,390+Math.sin(t*.8)*p.radius*.46);
        p.sprite.setAlpha(!this.isMilling&&on?.14+.6*Math.max(0,Math.sin(t*2)):0);
      });
      const pulse=.45+.45*(.5+.5*Math.sin(this.elapsed*7));
      const red=this.condition==='fault',amber=this.condition==='waiting'||this.condition==='idle',green=this.condition==='running';
      this.towerRed.setAlpha(!this.isMilling?(red?pulse:.07):0);
      this.towerAmber.setAlpha(!this.isMilling?(amber?pulse:.07):0);
      this.towerGreen.setAlpha(!this.isMilling?(green?pulse:.07):0);
      if(this.isMilling){
        this.millPhotoGlow.setAlpha(on?.12+.24*(.5+.5*Math.sin(this.elapsed*15)):.025);
        this.millPhotoSparks.forEach(p=>{
          const t=this.elapsed*p.speed*5+p.phase;
          p.sprite.setPosition(this.millWorkX+Math.cos(t)*p.radius,this.millWorkY+Math.sin(t*.9)*p.radius*.38);
          p.sprite.setAlpha(on?.08+.48*Math.max(0,Math.sin(t*1.8)):0);
        });
        this.millPhotoRed.setAlpha(red?pulse:.05);
        this.millPhotoAmber.setAlpha(amber?pulse:.05);
        this.millPhotoGreen.setAlpha(green?pulse:.05);
      }else{
        this.millPhotoGlow.setAlpha(0);
        this.millPhotoRed.setAlpha(0);this.millPhotoAmber.setAlpha(0);this.millPhotoGreen.setAlpha(0);
        this.millPhotoSparks.forEach(p=>p.sprite.setAlpha(0));
      }
    }
  }
  function ensureGame(){
    if(typeof Phaser==='undefined')return;
    if(!phaserGame)phaserGame=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1000,height:800,backgroundColor:'#152a35',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,pixelArt:false},scene:[FactoryScene]});
  }
  let previous=performance.now(),accumulator=0;
  function frame(now){
    accumulator+=Math.min((now-previous)/1000,.25);previous=now;
    if(accumulator>=.1){tick(accumulator);accumulator=0;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setInterval(save,5000);
  window.cncFactory={getState:()=>JSON.parse(JSON.stringify(state)),orders:orders.map(o=>({...o}))};
})();
