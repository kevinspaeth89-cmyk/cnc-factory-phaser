(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const euro = amount => '€ ' + Math.round(amount).toLocaleString('de-DE');
  const euroExact = amount => '€ ' + amount.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const SAVE_KEY = 'cnc_factory_save_v3';
  const START = Date.UTC(2026, 0, 5, 6);
  const HIRING_FEE = 150;
  const TRAINING_BASE_COST = 900;
  const STORAGE_RATE = .08; // euros per kg and game day
  const STORAGE_UPGRADE = 4000;
  const SELL_BASE_RATE = .60;
  const SELL_UPGRADE_RATE = .35;
  const MAX_QUEUED_ORDERS = 3;
  const LOADING_ROBOT_COST = 8500;
  const economySystem = globalThis.CNCModules && globalThis.CNCModules.economy;
  const inventorySystem = globalThis.CNCModules && globalThis.CNCModules.inventory;
  const orderMarketSystem = globalThis.CNCModules && globalThis.CNCModules.orderMarket;
  const breakdownSystem = globalThis.CNCModules && globalThis.CNCModules.breakdowns;
  const expansionSystem = globalThis.CNCModules && globalThis.CNCModules.factoryExpansion;
  const materialSystem = globalThis.CNCModules && globalThis.CNCModules.materials;
  const recruitmentSystem = globalThis.CNCModules && globalThis.CNCModules.recruitment;
  if (!economySystem || !inventorySystem || !orderMarketSystem || !breakdownSystem || !expansionSystem || !materialSystem || !recruitmentSystem) throw new Error('CNC Factory game systems failed to load.');
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
    bay,type,level:1,maintenance:90,tool:82,operator1:false,operator2:false,loadingRobot:false,
    activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,deadlineAt:null,
    orderQueue:[]
  });
  const defaults = () => ({
    money:14000,material:0,capacity:300,staff:{shift1:0,shift2:0},
    machines:[],selectedBay:null,speed:1,paused:false,gameMinutes:0,completed:0,
    payrollDue:0,wagesPaid:0,storagePaid:0,energyPaid:0,selected:null,selectedMaterialType:'c45',
    recruitment:{applicants:[],nextId:1}
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
    m.loadingRobot=!!m.loadingRobot;
    if(m.loadingRobot)m.operator2=false;
    if(m.activeId&&!m.activeOrder){
      const legacyOrder=legacyOrders.find(order=>order.id===m.activeId);
      if(legacyOrder){m.activeOrder={...legacyOrder};m.activeOrderSource='legacy';}
    }
    const savedQueue=Array.isArray(m.orderQueue)?m.orderQueue:[];
    if(m.queuedOrder&&typeof m.queuedOrder.id==='string'&&!savedQueue.some(entry=>entry?.order?.id===m.queuedOrder.id)){
      savedQueue.unshift({order:m.queuedOrder,material:m.queuedMaterial,deadlineAt:m.queuedDeadlineAt});
    }
    const seen=new Set([m.activeId]);
    m.orderQueue=savedQueue.filter(entry=>{
      const order=entry?.order;
      if(typeof order?.id!=='string'||!order.id||order.kind!==catalog[m.type]?.kind||seen.has(order.id))return false;
      seen.add(order.id);return true;
    }).map(entry=>({order:entry.order,material:entry.material&&typeof entry.material==='object'?entry.material:{},
      deadlineAt:Number.isFinite(entry.deadlineAt)?entry.deadlineAt:state.gameMinutes+entry.order.deadlineHours*60}));
    delete m.queuedOrder;delete m.queuedMaterial;delete m.queuedDeadlineAt;
    if(!m.activeId&&m.orderQueue.length){
      const next=m.orderQueue.shift();
      m.activeId=next.order.id;m.activeOrder=next.order;m.activeOrderSource='market';
      m.progress=0;m.produced=0;m.deadlineAt=next.deadlineAt;
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
  function ensureStaffRoster(){
    const old=state.staffRoster&&typeof state.staffRoster==='object'?state.staffRoster:{};
    const roster={shift1:[],shift2:[],nextId:Number.isInteger(old.nextId)&&old.nextId>0?old.nextId:1},used=new Set();
    for(const shift of [1,2]){
      const key='shift'+shift,count=state.staff[key];
      const saved=Array.isArray(old[key])?old[key]:[];
      for(const entry of saved){
        if(roster[key].length>=count)break;
        if(!Number.isInteger(entry?.id)||entry.id<1||used.has(entry.id))continue;
        used.add(entry.id);
        roster[key].push(recruitmentSystem.normalizeEmployee(entry,entry.id));
      }
      for(let i=roster[key].length;i<count;i++){
        while(used.has(roster.nextId))roster.nextId++;
        used.add(roster.nextId);
        roster[key].push(recruitmentSystem.normalizeEmployee(null,roster.nextId++));
      }
      for(const employee of roster[key]){
        if(!state.machines.some(m=>m.bay===employee.assignedBay&&m['operator'+shift]))employee.assignedBay=null;
      }
      for(const m of state.machines.filter(m=>m['operator'+shift])){
        if(roster[key].some(employee=>employee.assignedBay===m.bay))continue;
        const free=roster[key].find(employee=>employee.assignedBay===null);
        if(free)free.assignedBay=m.bay;else m['operator'+shift]=false;
      }
    }
    roster.nextId=Math.max(roster.nextId,...[...used].map(id=>id+1));
    state.staffRoster=roster;
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
    ensureStaffRoster();
    recruitmentSystem.ensureState(state);
    economySystem.setTime(state,START+state.gameMinutes*60000);
  }
  ensureEconomyState();
  if(!Object.hasOwn(materialSystem.catalog,state.selectedMaterialType))state.selectedMaterialType='c45';
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
  const resaleValue=m=>m?Math.round(catalog[m.type].price*SELL_BASE_RATE+upgradeInvestment(m)*SELL_UPGRADE_RATE+(m.loadingRobot?LOADING_ROBOT_COST*.4:0)):0;
  const skillLevel=employee=>employee?Math.min(3,Math.max(employee.trained,employee.xp>=1500?3:employee.xp>=600?2:employee.xp>=180?1:0)):0;
  const assignedEmployee=(m,shift)=>state.staffRoster['shift'+shift].find(employee=>employee.assignedBay===m.bay);
  const productionFactor=m=>{
    const employee=assignedEmployee(m,shiftAt(state.gameMinutes)||1);
    return catalog[m.type].rate*(1+(m.level-1)*.13)*Math.max(.65,m.maintenance/100*.75+.25)*
      (1+.05*skillLevel(employee))*recruitmentSystem.productionMultiplier(employee,catalog[m.type].kind);
  };
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
    !!(m['operator'+shiftAt(state.gameMinutes)]||(shiftAt(state.gameMinutes)===2&&m.loadingRobot))&&m.tool>=1&&m.maintenance>=8;
  const operating=m=>readyToRun(m)&&breakdownSystem.canContinueProduction(state,m.bay);
  const canChangeTool=m=>!!m&&state.money>=650&&m.tool<99&&(!job(m)||m.tool<1);
  const canMaintain=m=>!!m&&state.money>=1200&&m.maintenance<99&&(!job(m)||m.maintenance<8);
  const conditionLabel=value=>value>0&&value<1?'<1 %':Math.round(value)+' %';
  let visual=null, currentPanel=null, messageTimer, zoomTimer, phaserGame=null, hallPreviewBay=null;
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
    if(!m['operator'+shift]&&!(shift===2&&m.loadingRobot))return `Kein Bediener Schicht ${shift}`;
    return 'Produktion läuft';
  }
  function tab(name){
    currentPanel=name;
    $('drawer').hidden=false;
    $('scrim').hidden=false;
    $('drawer-title').textContent={orders:'Aufträge',machine:'Maschine',business:'Betrieb',recruitment:'Bewerberbörse',warehouse:'Materiallager'}[name];
    $('warehouse-panel').hidden=name!=='warehouse';
    $('recruitment-panel').hidden=name!=='recruitment';
    $('warehouse-door').setAttribute('aria-expanded',String(name==='warehouse'));
    for(const panel of ['orders','machine','business']){
      $(panel+'-panel').hidden=name!==panel;
      $(panel+'-tab').classList.toggle('active',name===panel);
      $(panel+'-tab').setAttribute('aria-expanded',String(name===panel));
    }
    $('speed-menu').hidden=true;
    $('speed-toggle').setAttribute('aria-expanded','false');
    renderOrders();renderRecruitment();
    renderBusiness();
  }
  function closeDrawer(){
    currentPanel=null;
    $('drawer').hidden=true;
    $('scrim').hidden=true;
    $('warehouse-door').setAttribute('aria-expanded','false');
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
  function renderHallPreview(){
    const machine=machineAt(hallPreviewBay),panel=$('hall-preview');
    panel.hidden=!machine;
    if(!machine)return;
    const order=job(machine);
    $('hall-preview-title').textContent=`${catalog[machine.type].name} · Platz ${machine.bay}`;
    $('hall-preview-meta').textContent=`${catalog[machine.type].kind} · Level ${machine.level} · ${statusFor(machine)}`;
    $('hall-preview-job').textContent=order?`${order.part} · ${machine.produced}/${order.qty} Teile · ${Math.floor(machine.progress)} %`:'Kein laufender Auftrag';
    $('hall-preview-progress').hidden=!order;
    for(const [name,value] of [['progress',order?machine.progress:0],['tool',machine.tool],['maintenance',machine.maintenance]]){
      const fill=$(`hall-preview-${name}-fill`);
      fill.style.width=Math.max(0,Math.min(100,value))+'%';
      fill.className='preview-meter-fill '+(name==='progress'?'progress':value<=15?'low':value<=40?'medium':'good');
      $(`hall-preview-${name}-bar`).setAttribute('aria-valuenow',String(Math.max(0,Math.min(100,Math.round(value)))));
    }
    const deadlineLeft=order&&Number.isFinite(machine.deadlineAt)?machine.deadlineAt-state.gameMinutes:null;
    $('hall-preview-time').hidden=!order;
    $('hall-preview-time').textContent=order?`Rest ${formatMinutes(remainingMinutes(machine,order))}${deadlineLeft===null?'':` · Frist ${deadlineLeft<0?`${formatMinutes(-deadlineLeft)} überfällig`:formatMinutes(deadlineLeft)}`}`:'';
    $('hall-preview-condition').textContent=`Werkzeug ${conditionLabel(machine.tool)} · Wartung ${Math.round(machine.maintenance)} % · Geplant ${machine.orderQueue.length}/${MAX_QUEUED_ORDERS}`;
    $('hall-preview-operators').textContent=`Bediener S1 ${machine.operator1?'✓':'–'} · S2 ${machine.loadingRobot?'Roboter':machine.operator2?'✓':'–'}`;
    const slot=expansionSystem.getBayLayout(state).find(item=>item.bay===machine.bay);
    const hall=$('hall-map'),width=hall.clientWidth,height=hall.clientHeight;
    if(!slot||!width||!height)return;
    const panelWidth=panel.offsetWidth,panelHeight=panel.offsetHeight;
    const center=(slot.x+slot.width/2)*width/100;
    const left=Math.max(6,Math.min(center-panelWidth/2,width-panelWidth-6));
    const above=slot.y*height/100-panelHeight-8;
    const top=Math.max(6,Math.min(above,height-panelHeight-6));
    panel.style.left=Math.round(left)+'px';
    panel.style.top=Math.round(top)+'px';
  }
  function tapHallBay(bay){
    if(!machineAt(bay)){
      hallPreviewBay=null;renderHallPreview();
      tab('business');say(`Platz ${bay} ist frei. Wähle eine Maschine im Betrieb.`);
      return;
    }
    if(hallPreviewBay===bay&&!$('hall-preview').hidden){
      showMachine(bay);
      return;
    }
    hallPreviewBay=bay;
    selectBay(bay);
    renderHallPreview();
  }
  function showMachine(bay=state.selectedBay){
    if(!machineAt(bay))return;
    selectBay(bay);
    if(typeof Phaser==='undefined'){say('Maschinenansicht konnte nicht geladen werden. Bitte neu laden.');return;}
    if(!$('detail-view').hidden)return;
    hallPreviewBay=null;renderHallPreview();
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
    hallPreviewBay=null;renderHallPreview();
  }
  function renderOrders(){
    $('customer-reputation').replaceChildren(...Object.entries(orderMarketSystem.getReputation(state)).map(([customer,score])=>{
      const row=document.createElement('div'),name=document.createElement('span'),status=document.createElement('b');
      row.className='reputation-row';name.textContent=customer;
      const bonus=Math.round((score-50)*.3);
      status.textContent=`Vertrauen ${score}/100 · ${bonus>=0?'+':''}${bonus} % für neue Angebote`;
      row.append(name,status);return row;
    }));
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
    $('queued-orders').replaceChildren(...state.machines.flatMap(m=>m.orderQueue.map((entry,index)=>{
      const row=document.createElement('div'),title=document.createElement('span'),cancel=document.createElement('button');
      row.className='queued-job';
      title.textContent=`Platz ${m.bay} · Planung ${index+1}/${MAX_QUEUED_ORDERS}: ${entry.order.part} · ${entry.order.qty} Teile · Frist ${formatMinutes(entry.deadlineAt-state.gameMinutes)}`;
      cancel.type='button';cancel.textContent='Vormerkung lösen';
      const held=Object.values(entry.material||{}).reduce((sum,amount)=>sum+amount,0);
      cancel.disabled=state.material+held>state.capacity+1e-9;
      cancel.addEventListener('click',()=>cancelQueuedOrder(m,index));
      row.append(title,cancel);return row;
    })));
    $('orders').replaceChildren(...offers.map(o=>{
      const m=selectedMachine(),card=document.createElement('article');
      const running=state.machines.find(x=>x.activeId===o.id),fits=compatible(m,o);
      card.className='card'+(state.selected===o.id?' selected':'')+(running?' running':'')+(!fits&&!running?' incompatible':'');
      const customerType=o.customerType?`${o.customerType} · `:'';
      const difficulty=Number.isFinite(o.difficulty)?` · Schwierigkeit ${o.difficulty}/5`:'';
      const remaining=Number.isFinite(o.expiresAt)?` · gültig noch ${formatMinutes(o.expiresAt-state.gameMinutes)}`:'';
      card.innerHTML=`<div class="top"><span>${o.customer}</span><span>${o.kind} · #${o.id}</span></div><h3>${o.part}</h3><p>${customerType}${o.material} · ${o.qty} Teile${difficulty}</p><div class="values"><span>${o.kg} kg · Frist ${o.deadlineHours} h${remaining}${o.reputationBonusPct?` · Kundenbonus ${o.reputationBonusPct>0?'+':''}${o.reputationBonusPct} %`:''}</span><b>${euro(o.reward)}</b></div>`;
      if(running){const p=document.createElement('p');p.textContent=`Läuft auf Platz ${running.bay} · ${running.produced}/${o.qty} Teile`;card.append(p);}
      const button=document.createElement('button');
      button.type='button';
      const shortage=Math.max(0,materialSystem.requiredKg(o)-materialSystem.available(state,o));
      button.textContent=running?'Produktion läuft':!m?'Zuerst Maschine kaufen':!fits?`Benötigt ${o.kind}`:m.orderQueue.length>=MAX_QUEUED_ORDERS?'Planung voll (3/3)':shortage>1e-9?`Fehlen ${Math.ceil(shortage)} kg ${o.material}`:job(m)?`Für Platz ${m.bay} vormerken (${m.orderQueue.length+1}/${MAX_QUEUED_ORDERS})`:`Auf Platz ${m.bay} annehmen`;
      button.disabled=!m||!!running||m?.orderQueue.length>=MAX_QUEUED_ORDERS||!fits||shortage>1e-9;
      button.addEventListener('click',event=>{event.stopPropagation();startOrder(o.id);});
      card.append(button);
      card.addEventListener('click',()=>{state.selected=o.id;save();renderOrders();});
      return card;
    }));
  }
  let lastMarketBoardKey='';
  function renderMaterialPrice(){
    const type=state.selectedMaterialType,quantity=Number($('material-quantity').value);
    const price=materialSystem.quote(type,quantity,state.gameMinutes);
    const unitPrice=materialSystem.pricePerKg(type,state.gameMinutes);
    const day=Math.max(0,Math.floor(state.gameMinutes/1440));
    const boardKey=day+':'+type;
    if(boardKey!==lastMarketBoardKey){
      const rows=Object.entries(materialSystem.catalog).map(([key,item])=>{
        const row=document.createElement('button'),name=document.createElement('span');
        const unit=document.createElement('strong'),rating=document.createElement('small');
        const change=Math.round((materialSystem.marketMultiplier(key,state.gameMinutes)-1)*100);
        const status=change<=-8?'Günstig':change>=8?'Teuer':'Normal';
        row.type='button';row.className=`market-row ${status.toLowerCase()}${key===type?' selected':''}`;
        row.setAttribute('aria-label',`${item.label}: ${euroExact(materialSystem.pricePerKg(key,state.gameMinutes))} pro kg, ${status}, ${change>=0?'+':''}${change} Prozent zum Grundpreis`);
        row.setAttribute('aria-pressed',String(key===type));
        name.className='market-name';name.textContent=item.label;
        unit.textContent=euroExact(materialSystem.pricePerKg(key,state.gameMinutes))+'/kg';
        rating.textContent=`${status} ${change>=0?'+':''}${change} %`;
        row.append(name,unit,rating);
        row.addEventListener('click',()=>{state.selectedMaterialType=key;save();renderMaterialPrice();});
        return row;
      });
      $('material-market-board').replaceChildren(...rows);
      const base=materialSystem.catalog[type].pricePer100Kg/100;
      const history=[];
      for(let index=Math.max(0,day-6);index<=day;index++){
        const unit=materialSystem.pricePerKg(type,index*1440);
        const row=document.createElement('div'),label=document.createElement('span');
        const track=document.createElement('div'),fill=document.createElement('div'),value=document.createElement('span');
        row.className='history-row'+(index===day?' current':'');
        label.textContent=`Tag ${index+1}`;
        track.className='history-track';fill.className='history-fill';
        fill.style.width=Math.max(10,Math.min(100,Math.round((unit/base-.75)*200)))+'%';
        track.append(fill);value.textContent=euroExact(unit)+'/kg';
        row.append(label,track,value);history.push(row);
      }
      $('material-history').replaceChildren(...history);
      lastMarketBoardKey=boardKey;
    }
    const change=day?Math.round((materialSystem.marketMultiplier(type,state.gameMinutes)-materialSystem.marketMultiplier(type,(day-1)*1440))*100):0;
    $('material-market-info').textContent=unitPrice===null?'':`Gewählt: ${materialSystem.catalog[type].label} · Grundpreis ${euroExact(materialSystem.catalog[type].pricePer100Kg/100)}/kg · ${day?`heute ${change>=0?'+':''}${change} % zu gestern · `:''}neuer Kurs in ${formatMinutes(1440-state.gameMinutes%1440)}. Günstig: ab 8 % unter Grundpreis; teuer: ab 8 % darüber.`;
    $('material-price').textContent=price===null?'—':`+${quantity} kg · ${euroExact(price)}`;
    $('buy-material').disabled=price===null||state.money<price||state.material+quantity>state.capacity;
  }
  function renderStaffDevelopment(){
    $('staff-development').replaceChildren(...[1,2].flatMap(shift=>state.staffRoster['shift'+shift].map(employee=>{
      const row=document.createElement('div'),label=document.createElement('span'),button=document.createElement('button');
      const level=skillLevel(employee),cost=TRAINING_BASE_COST*(level+1);
      row.className='staff-development-row';
      const profile=employee.profileVersion===1?employee.specialty:'Altbestand';
      label.textContent=`S${shift} · ${employee.name} · ${profile} · ${employee.assignedBay?'Platz '+employee.assignedBay:'frei'} · Können ${level}/3`;
      label.title=employee.about||`${Math.floor(employee.xp)} min Erfahrung`;
      button.type='button';button.textContent=level===3?'Maximal':`Schulen ${euro(cost)}`;
      button.disabled=level===3||state.money<cost;
      button.addEventListener('click',()=>trainEmployee(shift,employee.id));
      row.append(label,button);return row;
    })));
  }
  function renderRecruitment(){
    const offers=state.recruitment?.applicants||[];
    const limit=expansionSystem.getUnlockedBays(state);
    $('applicant-list').replaceChildren(...offers.map(candidate=>{
      const card=document.createElement('article');card.className='applicant-card';
      const head=document.createElement('div');head.className='applicant-head';
      const avatar=document.createElement('span');avatar.className='applicant-avatar';
      avatar.setAttribute('aria-hidden','true');
      avatar.textContent=candidate.name.split(/\s+/).map(part=>part[0]||'').join('').slice(0,2).toUpperCase();
      const identity=document.createElement('div');identity.className='applicant-identity';
      const name=document.createElement('strong');name.textContent=candidate.name;
      const specialty=document.createElement('span');specialty.className='applicant-specialty';specialty.textContent=candidate.specialty;
      identity.append(name,specialty);head.append(avatar,identity);
      const about=document.createElement('p');about.className='applicant-about';about.textContent=`${candidate.trait} · ${candidate.about}`;
      const stats=document.createElement('div');stats.className='applicant-stats';
      for(const [key,label] of [['turning','Drehen'],['milling','Fräsen'],['precision','Präzision'],['learning','Lerntempo']]){
        const stat=document.createElement('div');stat.className='applicant-stat';
        const top=document.createElement('div');top.className='applicant-stat-head';
        const statName=document.createElement('span');statName.textContent=label;
        const value=document.createElement('b');value.textContent=`${candidate.skills[key]}/5`;
        const track=document.createElement('div');track.className='applicant-track';
        const fill=document.createElement('span');fill.style.width=`${candidate.skills[key]*20}%`;track.append(fill);
        top.append(statName,value);stat.append(top,track);stats.append(stat);
      }
      const actions=document.createElement('div');actions.className='applicant-actions';
      for(const shift of [1,2]){
        const button=document.createElement('button');button.type='button';button.className='action';
        const wage=shift===1?24:26;
        const actionLabel=document.createElement('span');actionLabel.textContent=`S${shift} einstellen`;
        const costLabel=document.createElement('small');costLabel.textContent=`${euro(HIRING_FEE)} einmalig · ${wage} €/h`;
        button.append(actionLabel,costLabel);
        button.title=`Schicht ${shift}: ${wage} € pro Stunde`;
        button.disabled=state.money<HIRING_FEE||state.staff[`shift${shift}`]>=limit;
        button.addEventListener('click',()=>hireCandidate(candidate.id,shift));
        actions.append(button);
      }
      card.append(head,about,stats,actions);return card;
    }));
    $('applicant-count').textContent=`${offers.length} Profile verfügbar · Einstellungsprämie ${euro(HIRING_FEE)} · Lohn je nach Schicht`;
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
    $('open-recruitment').textContent=`Bewerber ansehen · ${state.recruitment.applicants.length}`;
    for(const shift of [1,2]){
      const assigned=state.machines.filter(x=>x['operator'+shift]).length;
      $('fire-'+shift).disabled=state.staff['shift'+shift]<=assigned;
      $('free-'+shift).textContent=`${state.staff['shift'+shift]-assigned} frei`;
    }
    renderStaffDevelopment();
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
    $('operator-2').textContent=m?(m.loadingRobot?'S2 · Roboter aktiv':m.operator2?'S2 abziehen':'S2 zuweisen'):'Keine Maschine';
    $('buy-robot').textContent=m?.loadingRobot?'Laderoboter installiert':`Laderoboter kaufen · ${euro(LOADING_ROBOT_COST)}`;
    $('buy-robot').disabled=!m||m.loadingRobot||state.money<LOADING_ROBOT_COST;
    $('sell-machine-value').textContent=m?euro(resaleValue(m)):'—';
    $('sell-machine').disabled=!m||!!job(m)||!!m.orderQueue.length;
    for(const shift of [1,2]){
      const assigned=state.machines.filter(x=>x['operator'+shift]).length;
      $('operator-'+shift).disabled=!m||(shift===2&&m.loadingRobot)||(!m['operator'+shift]&&assigned>=state.staff['shift'+shift]);
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
    renderMaterialPrice();
    if(currentPanel==='business')renderFinance();
  }
  function renderFinance(){
    const period=$('finance-period').value,now=dateAt(state.gameMinutes);
    let at=now.getTime();
    if(period==='yesterday')at-=86400000;
    if(period==='last-month')at=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,15);
    const summary=period==='month'||period==='last-month'
      ?economySystem.getMonthlySummary(state,at):economySystem.getDailySummary(state,at);
    $('finance-profit').textContent=`Gebuchter Gewinn: ${euroExact(summary.profit)}`;
    const names={income:'Aufträge (Umsatz)',material:'Material',wages:'Bezahlte Löhne',energy:'Energie',tools:'Werkzeug',maintenance:'Wartung',repairs:'Reparaturen',storage:'Lager',machine_purchase:'Maschinenkauf',machine_sale:'Maschinenverkauf',factory_expansion:'Hallenausbau',other:'Sonstiges / Upgrades'};
    $('finance-totals').replaceChildren(...Object.entries(names).filter(([key])=>
      ['income','material','wages','energy','tools','maintenance','storage'].includes(key)||Math.abs(summary.categoryTotals[key])>1e-6
    ).map(([key,label])=>{
      const row=document.createElement('div'),name=document.createElement('span'),amount=document.createElement('b');
      row.className='finance-line';name.textContent=label;
      amount.textContent=euroExact(summary.categoryTotals[key]);row.append(name,amount);
      return row;
    }));
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
    $('money').textContent=Math.abs(state.money-Math.round(state.money))<1e-9?euro(state.money):euroExact(state.money);
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
    $('tool-label').textContent=m?conditionLabel(m.tool):'—';
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
    $('hud-tool').textContent=m?conditionLabel(m.tool):'—';
    $('hud-maintenance').textContent=m?Math.round(m.maintenance)+' %':'—';
    $('hud-operators').textContent=m?('S1 '+(m.operator1?'✓':'–')+' · S2 '+(m.loadingRobot?'Roboter':m.operator2?'✓':'–')):'—';
    $('hud-job-button').textContent=o?'Aufträge ansehen':m?'Auftrag wählen':'Maschine kaufen';

    $('change-tool').disabled=!canChangeTool(m);
    $('maintenance').disabled=!canMaintain(m);
    $('upgrade').disabled=!m||state.money<9000*m.level;
    $('sell-machine-value').textContent=m?euro(resaleValue(m)):'—';
    $('sell-machine').disabled=!m||!!o||!!m.orderQueue.length;
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
      b.classList.toggle('veltron-bay',!!machine&&machine.type==='mill3');
      b.classList.toggle('turning-bay',turning);
      b.classList.toggle('robot-loading',!!machine?.loadingRobot&&operating(machine)&&shiftAt(state.gameMinutes)===2);

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
      let robotArt=b.querySelector('.bay-robot');
      if(machine?.loadingRobot){
        if(!robotArt){
          robotArt=document.createElement('img');robotArt.className='bay-robot';robotArt.alt='';
          robotArt.src='assets/loading-robot.webp?v=1';b.append(robotArt);
        }
        robotArt.hidden=false;
      }else if(robotArt)robotArt.hidden=true;
      b.querySelector('span').textContent=machine?catalog[machine.type].name:`+ Platz ${bay}`;
      b.setAttribute('aria-label',machine?`${catalog[machine.type].name}, Platz ${bay} ansehen`:`Freier Stellplatz ${bay}, Maschinen kaufen`);
      b.title=machine?statusFor(machine):'Maschine kaufen';
    }
    renderHallPreview();
    if(visual){
      visual.running=!!m&&operating(m);
      visual.condition=!m?'idle':(m.maintenance<8||m.tool<1)?'fault':operating(m)?'running':o?'waiting':'idle';
      visual.robotEnabled=!!m?.loadingRobot;
      if(m)visual.setMachineType(m.type,m.loadingRobot);
    }
  }
  function startOrder(id){
    orderMarketSystem.tick(state,state.gameMinutes);
    const o=orderMarketSystem.getAvailable(state).find(order=>order.id===id),m=selectedMachine();
    if(!o||!m||m.orderQueue.length>=MAX_QUEUED_ORDERS||state.machines.some(x=>x.activeId===id||x.orderQueue.some(entry=>entry.order.id===id))){say('Dieses Angebot ist nicht mehr verfügbar oder die Auftragsplanung ist voll.');return;}
    if(!compatible(m,o)){say(`${o.part} benötigt ${o.kind}. ${catalog[m.type].name} ist für ${catalog[m.type].kind} ausgelegt.`);return;}
    const requiredMaterial=materialSystem.requiredKg(o),availableMaterial=materialSystem.available(state,o);
    if(availableMaterial+1e-9<requiredMaterial){
      say(`Es fehlen ${Math.ceil(requiredMaterial-availableMaterial)} kg ${o.material}.`);tab('warehouse');return;
    }
    if(m.maintenance<8||m.tool<1){say('Vorher Werkzeug oder Wartung erneuern.');tab('machine');return;}
    const materialResult=consumeOrderMaterial(o);
    if(!materialResult.ok){say(`Materialbestand konnte nicht reserviert werden (${materialResult.code}).`);return;}
    const accepted=orderMarketSystem.accept(state,id);
    if(!accepted){restoreOrderMaterial(materialResult.consumed);say('Das Angebot ist inzwischen abgelaufen.');return;}
    orderMarketSystem.tick(state,state.gameMinutes);
    if(job(m)){
      m.orderQueue.push({order:accepted,material:materialResult.consumed,
        deadlineAt:state.gameMinutes+accepted.deadlineHours*60});
      state.selected=null;
      save();renderOrders();renderBusiness();render();
      say(`${accepted.part} für Platz ${m.bay} vorgemerkt (${m.orderQueue.length}/${MAX_QUEUED_ORDERS}). Material wurde reserviert.`);
      return;
    }
    m.activeId=accepted.id;m.activeOrder=accepted;m.activeOrderSource='market';m.progress=0;m.produced=0;
    m.deadlineAt=state.gameMinutes+accepted.deadlineHours*60;
    state.selected=null;
    save();renderOrders();renderBusiness();render();closeDrawer();showMachine(m.bay);
    say(`${accepted.part} auf Platz ${m.bay} angenommen. ${statusFor(m)}.`);
  }
  function cancelQueuedOrder(m,index){
    const entry=m?.orderQueue[index];if(!entry)return;
    const held=Object.values(entry.material).reduce((sum,amount)=>sum+amount,0);
    if(state.material+held>state.capacity+1e-9){say('Zum Zurücklegen des reservierten Materials fehlt Lagerplatz.');return;}
    if(!restoreOrderMaterial(entry.material))return;
    m.orderQueue.splice(index,1);
    save();renderOrders();renderBusiness();render();say('Vormerkung gelöst. Reserviertes Material ist zurück im Lager.');
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
    if(job(m)||m.orderQueue.length){say('Laufenden oder vorgemerkten Auftrag zuerst abschließen.');return;}
    const name=catalog[m.type].name,value=resaleValue(m),oldBay=m.bay;
    if(!book('machine_sale',value,`${name} verkauft`,{type:m.type,bay:oldBay}).ok)return;
    for(const shift of [1,2]){
      const employee=assignedEmployee(m,shift);
      if(employee)employee.assignedBay=null;
    }
    expansionSystem.uninstallMachine(state,oldBay);
    if(hallPreviewBay===oldBay)hallPreviewBay=null;
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
    hallPreviewBay=null;
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
    if(!m||(shift===2&&m.loadingRobot))return;
    if(!m[key]&&state.machines.filter(x=>x[key]).length>=state.staff['shift'+shift])return;
    const roster=state.staffRoster['shift'+shift];
    const employee=m[key]?roster.find(person=>person.assignedBay===m.bay):roster.find(person=>person.assignedBay===null);
    if(!employee)return;
    employee.assignedBay=m[key]?null:m.bay;
    m[key]=!m[key];
    renderBusiness();render();save();
    say(`Schicht ${shift}: Bediener ${m[key]?'zugewiesen':'abgezogen'}.`);
  }
  function hireCandidate(applicantId,shift){
    if(![1,2].includes(shift))return;
    const candidate=state.recruitment.applicants.find(person=>person.id===applicantId);
    const shiftKey=`shift${shift}`,limit=expansionSystem.getUnlockedBays(state);
    if(!candidate||state.money<HIRING_FEE||state.staff[shiftKey]>=limit)return;
    const employee=recruitmentSystem.createEmployee(candidate,state.staffRoster.nextId);
    if(!employee||!book('other',-HIRING_FEE,`Bediener ${candidate.name} für Schicht ${shift} eingestellt`,{
      employeeId:employee.id,applicantId,employeeName:candidate.name,shift,setupFee:true,skills:{...candidate.skills}
    }).ok)return;
    const hired=recruitmentSystem.takeApplicant(state,applicantId);
    if(!hired)return;
    state.staffRoster.nextId+=1;
    state.staffRoster[shiftKey].push(employee);
    state.staff[shiftKey]+=1;
    save();renderBusiness();renderRecruitment();render();
    say(`${candidate.name} beginnt in Schicht ${shift}.`);
  }
  function buyRobot(){
    const m=selectedMachine();
    if(!m||m.loadingRobot||state.money<LOADING_ROBOT_COST)return;
    if(!book('machine_purchase',-LOADING_ROBOT_COST,`Laderoboter für ${catalog[m.type].name} gekauft`,{bay:m.bay,type:m.type,robot:true}).ok)return;
    const employee=assignedEmployee(m,2);
    if(employee)employee.assignedBay=null;
    m.operator2=false;m.loadingRobot=true;
    save();renderBusiness();render();say(`Laderoboter auf Platz ${m.bay} installiert. Spätschicht ist automatisiert.`);
  }
  function trainEmployee(shift,id){
    const employee=state.staffRoster['shift'+shift].find(person=>person.id===id);
    if(!employee)return;
    const level=skillLevel(employee),cost=TRAINING_BASE_COST*(level+1);
    if(level>=3||state.money<cost)return;
    if(!book('other',-cost,`Schulung ${employee.name}`,{employeeId:id,employeeName:employee.name,shift,skillLevel:level+1}).ok)return;
    employee.trained=level+1;
    save();renderBusiness();render();say(`${employee.name} erreicht Können ${skillLevel(employee)}/3.`);
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
        const power=(14*.28+(shift===2&&m.loadingRobot?.60:0))*step/60;
        const dateKey=gameDateKey();
        book('energy',-power,'Stromkosten laufende Maschinen',{gameDate:dateKey},`daily:energy:${dateKey}`);
        state.energyPaid+=power;
        const employee=assignedEmployee(m,shift);
        const factor=productionFactor(m);
        const gain=100/o.duration*(step/6)*factor;
        m.progress=Math.min(100,m.progress+gain);
        if(employee)employee.xp=Math.round((employee.xp+step*recruitmentSystem.learningMultiplier(employee))*1000)/1000;
        m.produced=Math.min(o.qty,Math.floor(o.qty*m.progress/100));
        m.maintenance=Math.max(0,m.maintenance-gain*.12);
        m.tool=Math.max(0,m.tool-gain*.18*recruitmentSystem.toolWearMultiplier(employee));
        if(m.progress>=100){
          const late=m.deadlineAt!==null&&state.gameMinutes+step>m.deadlineAt;
          const payout=late?Math.round(o.reward*.8):o.reward;
          if(!book('income',payout,`Auftrag ${o.id} abgeschlossen`,{orderId:o.id,bay:m.bay,late},null,state.gameMinutes+step).ok)continue;
          if(m.activeOrderSource==='market'){
            orderMarketSystem.tick(state,state.gameMinutes+step);
            orderMarketSystem.onCompleted(state,o,{late});
          }
          state.completed++;
          m.activeId=null;m.activeOrder=null;m.activeOrderSource=null;m.progress=0;m.produced=0;m.deadlineAt=null;
          const next=m.orderQueue.shift();
          if(next){
            m.activeId=next.order.id;m.activeOrder=next.order;m.activeOrderSource='market';
            m.deadlineAt=next.deadlineAt;
          }
          state.speed=1;
          save();renderOrders();
          say(`${catalog[m.type].name}: ${o.part} fertig · ${euro(payout)}${late?' (20 % Fristabzug)':''}${next?' · Nächster Auftrag gestartet':''}`);
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
    if(currentPanel==='business'||currentPanel==='warehouse')renderCosts();
    if(currentPanel==='business')renderStaffDevelopment();
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
  $('open-recruitment').addEventListener('click',()=>tab('recruitment'));
  $('recruitment-back').addEventListener('click',()=>tab('business'));
  $('close-drawer').addEventListener('click',closeDrawer);
  $('scrim').addEventListener('click',closeDrawer);
  for(let bay=5;bay<=8;bay++){
    const button=document.createElement('button'),label=document.createElement('span');
    button.id='bay-'+bay;button.className='bay bay-'+bay;button.type='button';
    label.textContent=`+ Platz ${bay}`;button.append(label);$('hall-map').append(button);
  }
  for(let bay=1;bay<=8;bay++)$('bay-'+bay).addEventListener('click',()=>{
    if(bay>expansionSystem.getUnlockedBays(state))return;
    tapHallBay(bay);
  });
  $('hall-preview-close').addEventListener('click',()=>{hallPreviewBay=null;renderHallPreview();});
  $('warehouse-door').addEventListener('click',()=>{
    hallPreviewBay=null;renderHallPreview();
    currentPanel==='warehouse'?closeDrawer():tab('warehouse');
  });
  window.addEventListener('resize',renderHallPreview);
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
    const type=state.selectedMaterialType,quantity=Number($('material-quantity').value);
    const price=materialSystem.quote(type,quantity,state.gameMinutes);
    if(price===null||state.money<price||state.material+quantity>state.capacity)return;
    const added=inventorySystem.addMaterial(state,type,quantity);
    if(!added.ok)return;
    if(!book('material',-price,`${quantity} kg ${materialSystem.catalog[type].label} gekauft`,{quantityKg:quantity,type,pricePerKg:materialSystem.pricePerKg(type,state.gameMinutes),pricePer100Kg:materialSystem.quote(type,100,state.gameMinutes)}).ok){
      inventorySystem.removeMaterial(state,type,quantity);syncMaterialMirror();return;
    }
    syncMaterialMirror();save();render();renderBusiness();renderOrders();say(`${quantity} kg ${materialSystem.catalog[type].label} für ${euroExact(price)} eingelagert.`);
  });
  $('material-quantity').addEventListener('change',renderMaterialPrice);
  $('finance-period').addEventListener('change',renderFinance);
  $('change-tool').addEventListener('click',()=>{
    const m=selectedMachine();if(!canChangeTool(m))return;
    if(!book('tools',-650,'Werkzeugwechsel',{bay:m.bay,type:m.type}).ok)return;
    m.tool=100;save();render();say('Werkzeug gewechselt.');
  });
  $('maintenance').addEventListener('click',()=>{
    const m=selectedMachine();if(!canMaintain(m))return;
    if(!book('maintenance',-1200,'Wartung abgeschlossen',{bay:m.bay,type:m.type}).ok)return;
    m.maintenance=100;save();render();say('Wartung abgeschlossen.');
  });
  $('upgrade').addEventListener('click',()=>{
    const m=selectedMachine();if(!m)return;const cost=9000*m.level;if(state.money<cost)return;
    if(!book('other',-cost,`${catalog[m.type].name} Upgrade`,{bay:m.bay,level:m.level+1}).ok)return;
    m.level++;save();render();say(`${catalog[m.type].name} verbessert.`);
  });
  $('sell-machine').addEventListener('click',sellMachine);
  $('buy-robot').addEventListener('click',buyRobot);
  $('expand-factory').addEventListener('click',expandFactory);
  $('repair-now').addEventListener('click',()=>chooseBreakdown('repairNow'));
  $('continue-risky').addEventListener('click',()=>chooseBreakdown('continueRisky'));
  $('schedule-repair').addEventListener('click',()=>chooseBreakdown('scheduleRepair'));
  $('new-game').addEventListener('click',newGame);
  for(const shift of [1,2]){
    $('operator-'+shift).addEventListener('click',()=>toggleOperator(shift));
    $('fire-'+shift).addEventListener('click',()=>{
      if(state.staff['shift'+shift]<=state.machines.filter(m=>m['operator'+shift]).length)return;
      const roster=state.staffRoster['shift'+shift];
      const free=roster.filter(employee=>employee.assignedBay===null).sort((a,b)=>skillLevel(a)-skillLevel(b)||a.xp-b.xp)[0];
      const index=roster.indexOf(free);
      if(index<0)return;
      roster.splice(index,1);
      state.staff['shift'+shift]--;save();renderBusiness();render();say(`${free.name} aus Schicht ${shift} entlassen.`);
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
      this.load.image('machine-standard-robot','cell-nexora-robot.webp?v=1');
      this.load.image('machine-rapid-robot','cell-nexora-nx420-robot.webp?v=1');
      this.load.image('machine-premium-robot','cell-aurex-at600-robot.webp?v=1');
      this.load.image('machine-mill3','assets/veltron-vx500-detail.webp?v=1');
      this.load.image('machine-mill5','assets/orionis-om650x-detail.webp?v=1');
      this.load.image('loading-robot','assets/loading-robot.webp?v=1');
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
      this.robotImage=this.add.image(200,502,'loading-robot').setDisplaySize(470,510).setFlipX(true).setVisible(false);
      render();
    }
    setMachineType(type,loadingRobot=false){
      const milling=catalog[type].kind==='Fräsen';
      this.isMilling=milling;
      const robotLayout=milling?{x:335,y:550,width:370,height:320}:
        {x:type==='standard'?200:215,y:502,width:470,height:510};
      this.robotImage.setPosition(robotLayout.x,robotLayout.y).setDisplaySize(robotLayout.width,robotLayout.height);
      this.millGroup.setVisible(false);
      this.machineImage.setVisible(true);
      const key='machine-'+type+(loadingRobot&&!milling?'-robot':'');
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
      this.robotImage.setVisible(!!this.robotEnabled);
      if(this.robotEnabled)this.robotImage.setAngle(on&&shiftAt(state.gameMinutes)===2?Math.sin(this.elapsed*2)*1.4:0);
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
