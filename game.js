(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const euro = amount => '€ ' + Math.round(amount).toLocaleString('de-DE');
  const SAVE_KEY = 'cnc_factory_save_v3';
  const START = Date.UTC(2026, 0, 5, 6);
  const HIRING_FEE = 150;
  const STORAGE_RATE = .08; // euros per kg and game day
  const STORAGE_UPGRADE = 4000;
  const SELL_BASE_RATE = .60;
  const SELL_UPGRADE_RATE = .35;
  const economySystem = globalThis.CNCModules && globalThis.CNCModules.economy;
  const inventorySystem = globalThis.CNCModules && globalThis.CNCModules.inventory;
  const orderMarketSystem = globalThis.CNCModules && globalThis.CNCModules.orderMarket;
  const breakdownSystem = globalThis.CNCModules && globalThis.CNCModules.breakdowns;
  const expansionSystem = globalThis.CNCModules && globalThis.CNCModules.factoryExpansion;
  const materialSystem = globalThis.CNCModules && globalThis.CNCModules.materials;
  if (!economySystem || !inventorySystem || !orderMarketSystem || !breakdownSystem || !expansionSystem || !materialSystem) throw new Error('CNC Factory game systems failed to load.');
  const catalog = {
    standard: {name:'Nexora NX-350',kind:'Drehen',price:6500,rate:1},
    rapid: {name:'Nexora NX-420',kind:'Drehen',price:9000,rate:1.25},
    premium: {name:'Aurex AT-600',kind:'Drehen',price:12500,rate:1.55},
    mill3: {name:'Veltron VX-500',kind:'Fräsen',price:10500,rate:1.12},
    mill5: {name:'Orionis OM-650X',kind:'Fräsen',price:14800,rate:1.38}
  };
  const turningHallArtwork='hall-four-machines.webp?v=1';
  const hallMachineArtwork = {
    mill3:'assets/veltron-vx500-hall.webp?v=1',
    mill5:'assets/orionis-om650x-hall.webp?v=1'
  };
  const legacyOrders = [
    {id:'A12',kind:'Drehen',customer:'Veltraxis Mobility',part:'Wellenflansch A12',material:'1.4301 Edelstahl',kg:72,qty:50,reward:8400,duration:48,deadlineHours:7},
    {id:'B07',kind:'Drehen',customer:'Orionis Fluidics',part:'Ventilgehäuse B07',material:'1.4404 Edelstahl',kg:96,qty:40,reward:11200,duration:62,deadlineHours:9},
    {id:'C21',kind:'Drehen',customer:'Kaeldor Components',part:'Distanzring C21',material:'C45 Stahl',kg:48,qty:80,reward:6900,duration:38,deadlineHours:6},
    {id:'M14',kind:'Fräsen',customer:'Asteron Robotics',part:'Grundplatte M14',material:'EN AW-6082 Aluminium',kg:58,qty:36,reward:9800,duration:54,deadlineHours:8},
    {id:'F32',kind:'Fräsen',customer:'Kaeldor Systems',part:'Spannprisma F32',material:'42CrMo4 Stahl',kg:74,qty:30,reward:12600,duration:68,deadlineHours:10},
    {id:'P09',kind:'Fräsen',customer:'Orionis Fluidics',part:'Pumpengehäuse P09',material:'EN-GJS-400',kg:88,qty:24,reward:13900,duration:78,deadlineHours:11}
  ];
  const freshMachine = (bay, type='standard') => ({
    bay,type,level:1,maintenance:90,tool:82,operator1:false,operator2:false,
    activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,deadlineAt:null
  });
  const defaults = () => ({
    money:14000,material:0,capacity:300,staff:{shift1:0,shift2:0},
    machines:[],selectedBay:null,speed:1,paused:false,gameMinutes:0,completed:0,
    payrollDue:0,wagesPaid:0,storagePaid:0,energyPaid:0,selected:null
  });
  let state=defaults();
  function validMachine(m) {
    return m && Number.isInteger(m.bay) && m.bay>=1 && m.bay<=expansionSystem.getUnlockedBays(state) &&
      !!catalog[m.type] && typeof m.progress==='number';
  }
  try {
    const stored=JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if(stored && Number.isFinite(stored.money) && Array.isArray(stored.machines)) {
      state={...defaults(),...stored};
      expansionSystem.init(state);
      state.machines=stored.machines.filter(validMachine).map(m=>({...freshMachine(m.bay,m.type),...m}));
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
        const m=freshMachine(1);
        m.operator1=true;
        state.machines=[m];
        state.staff.shift1=Math.max(1,state.staff.shift1);
        state.selectedBay=1;
        m.level=Number(legacy.machineLevel)||1;
        m.maintenance=Number.isFinite(legacy.maintenance)?legacy.maintenance:90;
        m.tool=Number.isFinite(legacy.tool)?legacy.tool:82;
        if(legacyOrders.some(o=>o.id===legacy.activeId)){
          m.activeId=legacy.activeId;
          m.progress=Number(legacy.progress)||0;
          m.produced=Number(legacy.produced)||0;
          m.deadlineAt=Number.isFinite(legacy.deadlineAt)?legacy.deadlineAt+360:null;
        }
      }
    }
  } catch (_) { /* Storage may be unavailable. */ }
  state.machines.forEach(m=>{
    if(m.activeId&&!m.activeOrder){
      const legacyOrder=legacyOrders.find(order=>order.id===m.activeId);
      if(legacyOrder){m.activeOrder={...legacyOrder};m.activeOrderSource='legacy';}
    }
  });
  state.speed=[1,2,5,10].includes(state.speed)?state.speed:1;
  state.capacity=Math.max(300,Number(state.capacity)||300,Math.ceil(state.material));
  state.selectedBay=state.machines.some(m=>m.bay===state.selectedBay)
    ?state.selectedBay
    :(state.machines.length?state.machines.slice().sort((a,b)=>a.bay-b.bay)[0].bay:null);
  // Restored assignments may be malformed.
  for(const shift of [1,2]){
    const key='operator'+shift,staffKey='shift'+shift;
    let assigned=0;
    state.machines.forEach(m=>{if(m[key]){if(assigned<state.staff[staffKey])assigned++;else m[key]=false;}});
  }
  function syncMaterialMirror(){
    const usage=inventorySystem.getUsage(state);
    if(!usage.ok)return usage;
    state.material=usage.usage.raw;
    state.capacity=usage.capacities.raw;
    return usage;
  }
  function ensureEconomyState(){
    const result=economySystem.ensureState(state);
    if(!result.ok)throw new Error('CNC Factory save state could not be migrated.');
    syncMaterialMirror();
    orderMarketSystem.init(state);
    breakdownSystem.init(state);
    expansionSystem.init(state);
    economySystem.setTime(state,START+state.gameMinutes*60000);
  }
  ensureEconomyState();
  const save = () => {try{
    syncMaterialMirror();
    economySystem.setTime(state,START+state.gameMinutes*60000);
    localStorage.setItem(SAVE_KEY,JSON.stringify(state));
  }catch(_){}};
  save();
  function gameDateKey(minutes=state.gameMinutes){
    const d=dateAt(minutes);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  function book(category,amount,description,meta={},aggregateKey=null,timeMinutes=state.gameMinutes){
    economySystem.setTime(state,START+timeMinutes*60000);
    return economySystem.book(state,category,amount,description,meta,aggregateKey);
  }
  function consumeOrderMaterial(order){
    const result=materialSystem.reserve(state,inventorySystem,order);
    if(result.ok)syncMaterialMirror();
    return result;
  }
  function restoreOrderMaterial(consumed){
    for(const [type,amount] of Object.entries(consumed||{})){
      if(!inventorySystem.addMaterial(state,type,amount).ok)return false;
    }
    syncMaterialMirror();
    return true;
  }
  const selectedMachine=()=>state.machines.find(m=>m.bay===state.selectedBay);
  const machineAt=bay=>state.machines.find(m=>m.bay===bay);
  const job=m=>{
    if(!m)return null;
    if(m.activeOrder&&m.activeOrder.id===m.activeId)return m.activeOrder;
    return legacyOrders.find(order=>order.id===m.activeId)||null;
  };
  const compatible=(m,o)=>!!m&&!!o&&catalog[m.type].kind===o.kind;
  const upgradeInvestment=m=>m?9000*((m.level-1)*m.level/2):0;
  const resaleValue=m=>m?Math.round(catalog[m.type].price*SELL_BASE_RATE+upgradeInvestment(m)*SELL_UPGRADE_RATE):0;
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
  const readyToRun=m=>!!job(m)&&!state.paused&&!!shiftAt(state.gameMinutes)&&
    !!m['operator'+shiftAt(state.gameMinutes)]&&m.tool>=1&&m.maintenance>=8;
  const operating=m=>readyToRun(m)&&breakdownSystem.canContinueProduction(state,m.bay);
  let visual=null, currentPanel=null, messageTimer, zoomTimer, phaserGame=null;
  function say(message){
    $('message').textContent=message;
    clearTimeout(messageTimer);
    messageTimer=setTimeout(()=>{if($('message').textContent===message)$('message').textContent='';},5000);
  }
  function statusFor(m){
    if(!m)return 'Freier Stellplatz';
    if(state.paused)return 'Pausiert';
    const fault=breakdownSystem.getRecord(state,m.bay);
    if(fault?.status==='major_failure')return 'Schwerer Maschinenschaden';
    if(fault?.status==='repairing')return `Reparatur · ${formatMinutes(fault.repairRemainingMinutes)}`;
    if(fault?.status==='warning'&&!fault.riskyContinue&&!fault.scheduledRepair)return 'Störung · Entscheidung nötig';
    if(fault?.status==='warning')return fault.scheduledRepair?'Reparatur vorgemerkt':'Riskanter Betrieb';
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
    const machineOptions=state.machines.map(m=>{
      const opt=document.createElement('option');
      opt.value=m.bay;opt.textContent=`Platz ${m.bay} · ${catalog[m.type].name} · ${catalog[m.type].kind}`;
      opt.selected=m.bay===state.selectedBay;
      return opt;
    });
    if(!machineOptions.length){
      const opt=document.createElement('option');
      opt.value='';opt.textContent='Keine Maschine vorhanden';opt.selected=true;
      machineOptions.push(opt);
    }
    $('order-machine').replaceChildren(...machineOptions);
    $('order-machine').disabled=!state.machines.length;
    const offers=orderMarketSystem.getAvailable(state);
    $('orders').replaceChildren(...offers.map(o=>{
      const m=selectedMachine(),card=document.createElement('article');
      const running=state.machines.find(x=>x.activeId===o.id),fits=compatible(m,o);
      card.className='card'+(state.selected===o.id?' selected':'')+(running?' running':'')+(!fits&&!running?' incompatible':'');
      const customerType=o.customerType?`${o.customerType} · `:'';
      const difficulty=Number.isFinite(o.difficulty)?` · Schwierigkeit ${o.difficulty}/5`:'';
      const remaining=Number.isFinite(o.expiresAt)?` · gültig noch ${formatMinutes(o.expiresAt-state.gameMinutes)}`:'';
      card.innerHTML=`<div class="top"><span>${o.customer}</span><span>${o.kind} · #${o.id}</span></div><h3>${o.part}</h3><p>${customerType}${o.material} · ${o.qty} Teile${difficulty}</p><div class="values"><span>${o.kg} kg · Frist ${o.deadlineHours} h${remaining}</span><b>${euro(o.reward)}</b></div>`;
      if(running){const p=document.createElement('p');p.textContent=`Läuft auf Platz ${running.bay} · ${running.produced}/${o.qty} Teile`;card.append(p);}
      const button=document.createElement('button');
      button.type='button';
      const shortage=Math.max(0,materialSystem.requiredKg(o)-materialSystem.available(state,o));
      button.textContent=running?'Produktion läuft':!m?'Zuerst Maschine kaufen':!fits?`Benötigt ${o.kind}`:shortage>1e-9?`Fehlen ${Math.ceil(shortage)} kg ${o.material}`:`Auf Platz ${m.bay} annehmen`;
      button.disabled=!m||!!running||!!job(m)||!fits||shortage>1e-9;
      button.addEventListener('click',event=>{event.stopPropagation();startOrder(o.id);});
      card.append(button);
      card.addEventListener('click',()=>{state.selected=o.id;save();renderOrders();});
      return card;
    }));
  }
  function renderBusiness(){
    const m=selectedMachine();
    const limit=expansionSystem.getUnlockedBays(state),nextCost=expansionSystem.getExpansionCost(state);
    $('staff-summary').textContent=`S1: ${state.staff.shift1} · S2: ${state.staff.shift2} · ${state.machines.length}/${limit} Maschinen`;
    $('expansion-info').textContent=nextCost===null?'8 / 8 Plätze · Maximale Hallengröße erreicht':`Level ${state.factoryExpansion.level} · ${limit} Plätze → ${limit+2} Plätze · ${euro(nextCost)}`;
    $('expand-factory').hidden=nextCost===null;
    $('expand-factory').disabled=nextCost===null||state.money<nextCost;
    if(nextCost!==null)$('expand-factory').textContent=`Halle auf ${limit+2} Plätze erweitern · ${euro(nextCost)}`;
    renderCosts();
    $('hire-1').disabled=state.money<HIRING_FEE||state.staff.shift1>=limit;
    $('hire-2').disabled=state.money<HIRING_FEE||state.staff.shift2>=limit;
    for(const shift of [1,2]){
      const assigned=state.machines.filter(x=>x['operator'+shift]).length;
      $('fire-'+shift).disabled=state.staff['shift'+shift]<=assigned;
      $('free-'+shift).textContent=`${state.staff['shift'+shift]-assigned} frei`;
    }
    $('storage-upgrade').disabled=state.money<STORAGE_UPGRADE;
    $('machine-shop').replaceChildren(...Object.entries(catalog).map(([type,c])=>{
      const card=document.createElement('article');
      const affordable=state.money>=c.price,full=expansionSystem.getFirstFreeBay(state)===null;
      card.className='machine-card '+(c.kind==='Fräsen'?'mill-card':'turn-card')+((!affordable||full)?' locked':'');
      const head=document.createElement('div');head.className='machine-card-head';
      head.innerHTML=`<span class="machine-kind">${c.kind}</span><span class="machine-speed">${Math.round(c.rate*100)} % Tempo</span>`;
      const title=document.createElement('h4');title.textContent=c.name;
      const bar=document.createElement('div');bar.className='machine-rate';
      const fill=document.createElement('span');fill.style.width=Math.min(100,Math.round(c.rate/1.55*100))+'%';bar.append(fill);
      const foot=document.createElement('div');foot.className='machine-card-foot';
      const note=document.createElement('small');
      note.textContent=full?`Alle ${limit} Plätze belegt`:affordable?'Sofort verfügbar':'Guthaben reicht nicht';
      const button=document.createElement('button');
      button.type='button';button.className='action machine-buy';
      button.textContent=full?'Halle voll':euro(c.price);
      button.disabled=full||!affordable;
      button.addEventListener('click',()=>buyMachine(type));
      foot.append(note,button);
      card.append(head,title,bar,foot);
      return card;
    }));
    $('operator-1').textContent=m?(m.operator1?'S1 abziehen':'S1 zuweisen'):'Keine Maschine';
    $('operator-2').textContent=m?(m.operator2?'S2 abziehen':'S2 zuweisen'):'Keine Maschine';
    $('sell-machine-value').textContent=m?euro(resaleValue(m)):'—';
    $('sell-machine').disabled=!m||!!job(m);
    for(const shift of [1,2]){
      const assigned=state.machines.filter(x=>x['operator'+shift]).length;
      $('operator-'+shift).disabled=!m||(!m['operator'+shift]&&assigned>=state.staff['shift'+shift]);
    }
  }
  function renderCosts(){
    $('payroll-due').textContent=euro(state.payrollDue);
    $('wages-paid').textContent=euro(state.wagesPaid);
    $('energy-paid').textContent=euro(state.energyPaid);
    $('storage-paid').textContent=euro(state.storagePaid);
    $('storage-info').textContent=`${Math.floor(state.material)} / ${state.capacity} kg · ${euro(state.material*STORAGE_RATE)} pro Spieltag`;
    const stocks=Object.entries(materialSystem.catalog).map(([type,item])=>`${item.label}: ${Math.floor(state.inventory.rawMaterial[type]||0)} kg`);
    for(const category of new Set(Object.values(materialSystem.catalog).map(item=>item.oldCategory))){
      if(state.inventory.rawMaterial[category])stocks.push(`Altbestand ${category}: ${Math.floor(state.inventory.rawMaterial[category])} kg`);
    }
    if(state.inventory.rawMaterial.legacy)stocks.push(`Altbestand (für alle Aufträge): ${Math.floor(state.inventory.rawMaterial.legacy)} kg`);
    $('storage-stock').textContent=stocks.join(' · ');
  }
  function render(){
    const m=selectedMachine(),o=job(m),pct=m?Math.max(0,Math.min(100,m.progress)):0;
    const layout=expansionSystem.getLayoutConfig(state),hallMap=$('hall-map');
    hallMap.classList.toggle('expanded',layout.level>1);
    hallMap.style.aspectRatio=String(layout.aspectRatio);
    const fault=m?breakdownSystem.getRecord(state,m.bay):null;
    const faultInfo=fault?.fault?breakdownSystem.getFaultInfo(fault.fault):null;
    $('breakdown-panel').hidden=!fault||!['warning','major_failure','repairing'].includes(fault.status);
    $('breakdown-info').textContent=!faultInfo?'':`${faultInfo.label} · ${statusFor(m)}. ${fault.status==='major_failure'?'Produktion gestoppt.':fault.status==='warning'?'Reparieren, riskant weiterproduzieren oder Wartung nach dem Auftrag einplanen.':''}`;
    $('repair-now').disabled=!faultInfo||!['warning','major_failure'].includes(fault.status);
    $('continue-risky').disabled=fault?.status!=='warning'||fault.riskyContinue||fault.scheduledRepair;
    $('schedule-repair').disabled=!faultInfo||!['warning','major_failure'].includes(fault.status)||fault.scheduledRepair;
    const hallImage=$('hall-image');
    const artwork=layout.asset+'?v=1';
    if(hallImage.getAttribute('src')!==artwork)hallImage.src=artwork;
    hallImage.alt=`Leere Produktionshalle mit ${layout.unlockedBays} Maschinenplätzen`;
    $('money').textContent=euro(state.money);
    $('material').textContent=Math.floor(state.material)+' kg';
    $('parts').textContent=`${state.machines.length} / ${layout.unlockedBays}`;
    $('part-name').textContent=o?o.part:m?'Auftrag auswählen':'Erste Maschine kaufen';
    $('progress').style.width=pct+'%';
    $('progress-label').textContent=o?`${Math.floor(pct)} % · ${m.produced} / ${o.qty} · ${statusFor(m)}`:m?statusFor(m):'Öffne Betrieb und wähle deine erste Maschine.';
    $('clock').textContent=clock();
    $('status').textContent='● '+statusFor(m);
    $('status').classList.toggle('paused',state.paused);
    $('pause').textContent=state.paused?'▶ Weiter':'⏸ Pause';
    $('pause').classList.toggle('active',state.paused);
    document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===state.speed));
    $('speed-value').textContent=state.speed+'×';
    $('machine-heading').textContent=m?catalog[m.type].name:'Keine Maschine';
    $('machine-readout').textContent=m?`${catalog[m.type].name.toUpperCase()} · PLATZ ${m.bay}`:'KEINE MASCHINE';
    $('machine-meta').textContent=m?`Platz ${m.bay} · ${catalog[m.type].kind} · Level ${m.level} · ${statusFor(m)}`:'Kaufe im Betrieb eine Maschine für einen freien Stellplatz.';
    $('upgrade-cost').textContent=m?euro(9000*m.level)+' · +13 % Tempo':'—';
    $('tool-label').textContent=m?Math.round(m.tool)+' %':'—';
    $('tool-meter').style.width=m?Math.max(0,m.tool)+'%':'0%';
    $('maintenance-label').textContent=m?Math.round(m.maintenance)+' %':'—';
    $('maintenance-meter').style.width=m?Math.max(0,m.maintenance)+'%':'0%';

    const hudOrder=o?(o.part+' · #'+o.id):'Kein Auftrag';
    const deadlineLeft=o&&m&&m.deadlineAt!==null?m.deadlineAt-state.gameMinutes:null;
    $('hud-machine').textContent=m?(catalog[m.type].name+' · Platz '+m.bay+' · Level '+m.level):'Keine Maschine';
    $('hud-state').textContent=statusFor(m);
    $('hud-state').className='hud-state '+(m&&operating(m)?'ok':o?'wait':'idle');
    $('hud-order').textContent=hudOrder;
    $('hud-parts').textContent=o?(m.produced+' / '+o.qty):'—';
    $('hud-time').textContent=o?formatMinutes(remainingMinutes(m,o)):'—';
    $('hud-deadline').textContent=deadlineLeft===null?'—':deadlineLeft<0?(formatMinutes(-deadlineLeft)+' überfällig'):formatMinutes(deadlineLeft);
    $('hud-tool').textContent=m?Math.round(m.tool)+' %':'—';
    $('hud-maintenance').textContent=m?Math.round(m.maintenance)+' %':'—';
    $('hud-operators').textContent=m?('S1 '+(m.operator1?'✓':'–')+' · S2 '+(m.operator2?'✓':'–')):'—';
    $('hud-job-button').textContent=o?'Aufträge ansehen':m?'Auftrag wählen':'Maschine kaufen';

    const materialType=$('material-type').value,materialQuantity=Number($('material-quantity').value);
    const materialPrice=materialSystem.quote(materialType,materialQuantity);
    $('material-price').textContent=materialPrice===null?'—':`+${materialQuantity} kg · ${euro(materialPrice)}`;
    $('buy-material').disabled=materialPrice===null||state.money<materialPrice||state.material+materialQuantity>state.capacity;
    $('change-tool').disabled=!m||!!o||state.money<650||m.tool>=99;
    $('maintenance').disabled=!m||!!o||state.money<1200||m.maintenance>=99;
    $('upgrade').disabled=!m||state.money<9000*m.level;
    $('sell-machine-value').textContent=m?euro(resaleValue(m)):'—';
    $('sell-machine').disabled=!m||!!o;
    for(let bay=1;bay<=8;bay++){
      const b=$('bay-'+bay),machine=machineAt(bay);
      const slot=layout.bays.find(entry=>entry.bay===bay);
      b.hidden=!slot;
      if(!slot)continue;
      b.style.left=slot.x+'%';b.style.top=slot.y+'%';
      b.style.width=slot.width+'%';b.style.height=slot.height+'%';
      b.classList.toggle('installed',!!machine);
      b.classList.toggle('selected-bay',!!m&&bay===m.bay);
      b.classList.toggle('working-bay',!!machine&&operating(machine));
      b.classList.toggle('warning-bay',!!machine&&(machine.maintenance<8||machine.tool<1||breakdownSystem.getStatus(state,bay)!=='ok'));
      b.classList.toggle('waiting-bay',!!machine&&!!job(machine)&&!operating(machine)&&machine.maintenance>=8&&machine.tool>=1);
      const milling=!!machine&&catalog[machine.type].kind==='Fräsen';
      const turning=!!machine&&catalog[machine.type].kind==='Drehen';
      b.classList.toggle('milling-bay',milling);
      b.classList.toggle('turning-bay',turning);

      let machineArt=b.querySelector('.bay-machine');
      let turningFrame=b.querySelector('.bay-turning-frame');

      if(turning){
        if(!turningFrame){
          turningFrame=document.createElement('div');
          turningFrame.className='bay-turning-frame';
          const turningArt=document.createElement('img');
          turningArt.className='bay-turning-art';
          turningArt.alt='';
          turningArt.src=turningHallArtwork;
          turningFrame.append(turningArt);
          b.prepend(turningFrame);
        }
        turningFrame.hidden=false;
      }else if(turningFrame){
        turningFrame.hidden=true;
      }

      if(milling){
        if(!machineArt){
          machineArt=document.createElement('img');
          machineArt.className='bay-machine';
          machineArt.alt='';
          b.append(machineArt);
        }
        const src=hallMachineArtwork[machine.type];
        if(machineArt.getAttribute('src')!==src)machineArt.src=src;
        machineArt.hidden=false;
      }else if(machineArt){
        machineArt.hidden=true;
      }
      b.querySelector('span').textContent=machine?catalog[machine.type].name:`+ Platz ${bay}`;
      b.setAttribute('aria-label',machine?`${catalog[machine.type].name}, Platz ${bay} ansehen`:`Freier Stellplatz ${bay}, Maschinen kaufen`);
      b.title=machine?statusFor(machine):'Maschine kaufen';
    }
    if(visual){
      visual.running=!!m&&operating(m);
      visual.condition=!m?'idle':(m.maintenance<8||m.tool<1)?'fault':operating(m)?'running':o?'waiting':'idle';
      if(m)visual.setMachineType(m.type);
    }
  }
  function startOrder(id){
    orderMarketSystem.tick(state,state.gameMinutes);
    const o=orderMarketSystem.getAvailable(state).find(order=>order.id===id),m=selectedMachine();
    if(!o||!m||job(m)||state.machines.some(x=>x.activeId===id)){say('Dieses Angebot ist nicht mehr verfügbar oder die Maschine ist belegt.');return;}
    if(!compatible(m,o)){say(`${o.part} benötigt ${o.kind}. ${catalog[m.type].name} ist für ${catalog[m.type].kind} ausgelegt.`);return;}
    const requiredMaterial=materialSystem.requiredKg(o),availableMaterial=materialSystem.available(state,o);
    if(availableMaterial+1e-9<requiredMaterial){
      say(`Es fehlen ${Math.ceil(requiredMaterial-availableMaterial)} kg ${o.material}.`);tab('machine');return;
    }
    if(m.maintenance<8||m.tool<1){say('Vorher Werkzeug oder Wartung erneuern.');tab('machine');return;}
    const materialResult=consumeOrderMaterial(o);
    if(!materialResult.ok){say(`Materialbestand konnte nicht reserviert werden (${materialResult.code}).`);return;}
    const accepted=orderMarketSystem.accept(state,id);
    if(!accepted){restoreOrderMaterial(materialResult.consumed);say('Das Angebot ist inzwischen abgelaufen.');return;}
    orderMarketSystem.tick(state,state.gameMinutes);
    m.activeId=accepted.id;m.activeOrder=accepted;m.activeOrderSource='market';m.progress=0;m.produced=0;
    m.deadlineAt=state.gameMinutes+accepted.deadlineHours*60;
    state.selected=null;
    save();renderOrders();renderBusiness();render();closeDrawer();showMachine(m.bay);
    say(`${accepted.part} auf Platz ${m.bay} angenommen. ${statusFor(m)}.`);
  }
  function buyMachine(type){
    const c=catalog[type],bay=expansionSystem.getFirstFreeBay(state);
    if(!c||!bay||state.money<c.price)return;
    const installed=expansionSystem.installMachine(state,freshMachine(bay,type));
    if(!installed.success)return;
    if(!book('machine_purchase',-c.price,`${c.name} gekauft`,{type,bay}).ok){
      expansionSystem.uninstallMachine(state,bay);return;
    }
    breakdownSystem.init(state);
    selectBay(bay);renderBusiness();save();
    say(`${c.name} auf Platz ${bay} gekauft. Bediener zuweisen.`);
  }
  function sellMachine(){
    const m=selectedMachine();
    if(!m)return;
    if(job(m)){say('Laufenden Auftrag zuerst abschließen.');return;}
    const name=catalog[m.type].name,value=resaleValue(m),oldBay=m.bay;
    if(!book('machine_sale',value,`${name} verkauft`,{type:m.type,bay:oldBay}).ok)return;
    expansionSystem.uninstallMachine(state,oldBay);
    breakdownSystem.init(state);
    const nearest=state.machines.slice().sort((a,b)=>Math.abs(a.bay-oldBay)-Math.abs(b.bay-oldBay)||a.bay-b.bay)[0];
    state.selectedBay=nearest?nearest.bay:null;
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
    ensureEconomyState();
    clearTimeout(zoomTimer);
    closeDrawer();
    showHall();
    save();renderOrders();renderBusiness();render();
    say('Neues Spiel gestartet.');
  }
  function expandFactory(){
    const cost=expansionSystem.getExpansionCost(state);
    if(cost===null||state.money<cost)return;
    const before={...state.factoryExpansion};
    const expanded=expansionSystem.expand(state);
    if(!expanded.success)return;
    if(!book('factory_expansion',-cost,`Halle Level ${expanded.newLevel} ausgebaut`,{level:expanded.newLevel,bays:expanded.newBays}).ok){
      state.factoryExpansion=before;return;
    }
    save();renderBusiness();render();
    say(`Halle auf ${expanded.newBays} Maschinenplätze erweitert.`);
  }
  function toggleOperator(shift){
    const m=selectedMachine(),key='operator'+shift;
    if(!m)return;
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
      const storageCharge=state.material*STORAGE_RATE*step/1440;
      if(storageCharge>0){
        const dateKey=gameDateKey();
        book('storage',-storageCharge,'Lagerkosten',{gameDate:dateKey},`daily:storage:${dateKey}`);
        state.storagePaid+=storageCharge;
      }
      const faultEvents=breakdownSystem.tick(state,step,{operatingBays:state.machines.filter(readyToRun).map(m=>m.bay)});
      for(const event of faultEvents)handleBreakdownEvent(event);
      for(const m of state.machines){
        const o=job(m);
        if(!o||!operating(m))continue;
        const power=14*.28*step/60;
        const dateKey=gameDateKey();
        book('energy',-power,'Stromkosten laufende Maschinen',{gameDate:dateKey},`daily:energy:${dateKey}`);
        state.energyPaid+=power;
        const factor=productionFactor(m);
        const gain=100/o.duration*(step/6)*factor;
        m.progress=Math.min(100,m.progress+gain);
        m.produced=Math.min(o.qty,Math.floor(o.qty*m.progress/100));
        m.maintenance=Math.max(0,m.maintenance-gain*.12);
        m.tool=Math.max(0,m.tool-gain*.18);
        if(m.progress>=100){
          const late=m.deadlineAt!==null&&state.gameMinutes+step>m.deadlineAt;
          const payout=late?Math.round(o.reward*.8):o.reward;
          if(!book('income',payout,`Auftrag ${o.id} abgeschlossen`,{orderId:o.id,bay:m.bay,late},null,state.gameMinutes+step).ok)continue;
          if(m.activeOrderSource==='market'){
            orderMarketSystem.tick(state,state.gameMinutes+step);
            orderMarketSystem.onCompleted(state,o);
          }
          state.completed++;
          m.activeId=null;m.activeOrder=null;m.activeOrderSource=null;m.progress=0;m.produced=0;m.deadlineAt=null;
          state.speed=1;
          save();renderOrders();
          say(`${catalog[m.type].name}: ${o.part} fertig · ${euro(payout)}${late?' (20 % Fristabzug)':''}`);
        }
      }
      state.gameMinutes+=step;left-=step;
      orderMarketSystem.tick(state,state.gameMinutes);
      const after=dateAt(state.gameMinutes);
      if(after.getUTCMonth()!==before.getUTCMonth()||after.getUTCFullYear()!==before.getUTCFullYear()){
        if(state.payrollDue){
          book('wages',-state.payrollDue,'Monatliche Lohnabrechnung',{period:`${before.getUTCFullYear()}-${String(before.getUTCMonth()+1).padStart(2,'0')}`});
          state.wagesPaid+=state.payrollDue;
          say(`Monatliche Lohnabrechnung: −${euro(state.payrollDue)}.`);
          state.payrollDue=0;save();
        }
      }
    }
    render();
    if(currentPanel==='orders')renderOrders();
    if(currentPanel==='business')renderCosts();
  }
  function handleBreakdownEvent(event){
    if(!event)return;
    if(event.cost>0&&['repair','repair_scheduled','major_failure'].includes(event.event)){
      book('repairs',-event.cost,`Platz ${event.bay}: ${breakdownSystem.getFaultInfo(event.fault)?.label||'Reparatur'}`,{bay:event.bay,fault:event.fault,event:event.event});
    }
    if(event.event==='major_failure'&&event.scrapParts>0){
      const machine=machineAt(event.bay),order=job(machine);
      if(machine&&order){
        // The raw stock was already reserved at acceptance. Scrap consumes some
        // of that reserved material and requires one replacement part.
        machine.progress=Math.max(0,machine.progress-100*event.scrapParts/order.qty);
        machine.produced=Math.min(machine.produced,Math.floor(order.qty*machine.progress/100));
      }
    }
    if(event.event==='warning'||event.event==='major_failure'){
      say(`Platz ${event.bay}: ${breakdownSystem.getFaultInfo(event.fault)?.label||'Maschinenstörung'}. Im Maschinenmenü entscheiden.`);
    }else if(event.event==='repair_complete')say(`Platz ${event.bay}: Reparatur abgeschlossen.`);
    save();
  }
  function chooseBreakdown(action){
    const m=selectedMachine();if(!m)return;
    const before=breakdownSystem.getRecord(state,m.bay);
    const event=breakdownSystem[action](state,m.bay);
    if(!event)return;
    if(event.cost>0&&state.money<event.cost){
      state.breakdowns.machines[String(m.bay)]=before;
      say(`Für diese Reparatur fehlen ${euro(event.cost-state.money)}.`);
      return;
    }
    handleBreakdownEvent(event);
    render();renderBusiness();
    if(event.event==='repair')say(`Platz ${m.bay}: Sofortreparatur beauftragt · ${euro(event.cost)}.`);
    if(event.event==='repair_scheduled')say(`Platz ${m.bay}: Reparatur eingeplant · ${euro(event.cost)}.`);
    if(event.event==='continue_risky')say(`Platz ${m.bay}: Produktion läuft mit erhöhtem Risiko weiter.`);
  }
  for(const name of ['orders','machine','business'])
    $(name+'-tab').addEventListener('click',()=>currentPanel===name?closeDrawer():tab(name));
  $('close-drawer').addEventListener('click',closeDrawer);
  $('scrim').addEventListener('click',closeDrawer);
  for(let bay=5;bay<=8;bay++){
    const button=document.createElement('button'),label=document.createElement('span');
    button.id='bay-'+bay;button.className='bay bay-'+bay;button.type='button';
    label.textContent=`+ Platz ${bay}`;button.append(label);$('hall-map').append(button);
  }
  for(let bay=1;bay<=8;bay++)$('bay-'+bay).addEventListener('click',()=>{
    if(bay>expansionSystem.getUnlockedBays(state))return;
    if(machineAt(bay))showMachine(bay);
    else{tab('business');say(`Platz ${bay} ist frei. Wähle eine Maschine im Betrieb.`);}
  });
  $('back-to-hall').addEventListener('click',showHall);
  $('hud-job-button').addEventListener('click',()=>state.machines.length?tab('orders'):tab('business'));
  $('hud-service-button').addEventListener('click',()=>tab('machine'));
  $('hud-staff-button').addEventListener('click',()=>tab('business'));
  $('hud-toggle').addEventListener('click',()=>{
    const open=$('machine-hud').classList.toggle('mobile-open');
    $('hud-toggle').setAttribute('aria-expanded',String(open));
    $('hud-toggle').textContent=open?'Weniger':'Details';
  });
  $('order-machine').addEventListener('change',event=>selectBay(Number(event.target.value)));
  $('speed-toggle').addEventListener('click',()=>{
    const opening=$('speed-menu').hidden;
    if(opening)closeDrawer();
    $('speed-menu').hidden=!opening;
    $('speed-toggle').setAttribute('aria-expanded',String(opening));
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();$('speed-menu').hidden=true;}});
  $('buy-material').addEventListener('click',()=>{
    const type=$('material-type').value,quantity=Number($('material-quantity').value);
    const price=materialSystem.quote(type,quantity);
    if(price===null||state.money<price||state.material+quantity>state.capacity)return;
    const added=inventorySystem.addMaterial(state,type,quantity);
    if(!added.ok)return;
    if(!book('material',-price,`${quantity} kg ${materialSystem.catalog[type].label} gekauft`,{quantityKg:quantity,type}).ok){
      inventorySystem.removeMaterial(state,type,quantity);syncMaterialMirror();return;
    }
    syncMaterialMirror();save();render();renderBusiness();renderOrders();say(`${quantity} kg ${materialSystem.catalog[type].label} eingelagert.`);
  });
  $('material-type').addEventListener('change',render);
  $('material-quantity').addEventListener('change',render);
  $('change-tool').addEventListener('click',()=>{
    const m=selectedMachine();if(!m||job(m)||state.money<650||m.tool>=99)return;
    if(!book('tools',-650,'Werkzeugwechsel',{bay:m.bay,type:m.type}).ok)return;
    m.tool=100;save();render();say('Werkzeug gewechselt.');
  });
  $('maintenance').addEventListener('click',()=>{
    const m=selectedMachine();if(!m||job(m)||state.money<1200||m.maintenance>=99)return;
    if(!book('maintenance',-1200,'Wartung abgeschlossen',{bay:m.bay,type:m.type}).ok)return;
    m.maintenance=100;save();render();say('Wartung abgeschlossen.');
  });
  $('upgrade').addEventListener('click',()=>{
    const m=selectedMachine();if(!m)return;const cost=9000*m.level;if(state.money<cost)return;
    if(!book('other',-cost,`${catalog[m.type].name} Upgrade`,{bay:m.bay,level:m.level+1}).ok)return;
    m.level++;save();render();say(`${catalog[m.type].name} verbessert.`);
  });
  $('sell-machine').addEventListener('click',sellMachine);
  $('expand-factory').addEventListener('click',expandFactory);
  $('repair-now').addEventListener('click',()=>chooseBreakdown('repairNow'));
  $('continue-risky').addEventListener('click',()=>chooseBreakdown('continueRisky'));
  $('schedule-repair').addEventListener('click',()=>chooseBreakdown('scheduleRepair'));
  $('new-game').addEventListener('click',newGame);
  for(const shift of [1,2]){
    $('operator-'+shift).addEventListener('click',()=>toggleOperator(shift));
    $('hire-'+shift).addEventListener('click',()=>{
      if(state.money<HIRING_FEE||state.staff['shift'+shift]>=expansionSystem.getUnlockedBays(state))return;
      if(!book('other',-HIRING_FEE,`Bediener Schicht ${shift} eingestellt`,{shift,setupFee:true}).ok)return;
      state.staff['shift'+shift]++;
      save();renderBusiness();render();say(`Bediener Schicht ${shift} eingestellt.`);
    });
    $('fire-'+shift).addEventListener('click',()=>{
      if(state.staff['shift'+shift]<=state.machines.filter(m=>m['operator'+shift]).length)return;
      state.staff['shift'+shift]--;save();renderBusiness();render();say(`Freier Bediener Schicht ${shift} entlassen.`);
    });
  }
  $('storage-upgrade').addEventListener('click',()=>{
    if(state.money<STORAGE_UPGRADE)return;
    const expansion=inventorySystem.expandCapacity(state,'raw',200,STORAGE_UPGRADE);
    if(!expansion.ok)return;
    if(!book('storage',-STORAGE_UPGRADE,'Rohmateriallager um 200 kg erweitert',{capacity:expansion.capacity}).ok){
      state.inventory.capacities.raw-=200;syncMaterialMirror();return;
    }
    syncMaterialMirror();
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
  window.cncFactory={
    getState:()=>JSON.parse(JSON.stringify(state)),
    get orders(){return orderMarketSystem.getAvailable(state).map(order=>({...order}));}
  };
})();
