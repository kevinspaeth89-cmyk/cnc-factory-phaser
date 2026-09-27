(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const euro = amount => '€ ' + Math.round(amount).toLocaleString('de-DE');
  const euroExact = amount => '€ ' + amount.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const SAVE_KEY = 'cnc_factory_save_v3';
  const START = Date.UTC(2026, 0, 5, 6);
  const GAME_MINUTES_PER_REAL_SECOND = 10;
  const HIRING_FEE = 150;
  const TRAINING_BASE_COST = 900;
  const PREVENTIVE_MAINTENANCE_COST = 1200;
  const PREVENTIVE_MAINTENANCE_MINUTES = 60;
  const CREDIT_AMOUNTS = [10000,25000,50000,100000];
  const CREDIT_RATE_BY_AMOUNT = Object.freeze({10000:.09,25000:.10,50000:.11,100000:.12});
  const CREDIT_ANNUAL_RATE = .12;
  const CREDIT_TERM_MONTHS = 24;
  const LEGACY_MACHINE_PRICES = {standard:6500,rapid:9000,premium:12500,mill3:10500,mill5:14800};
  const STORAGE_RATE = .08; // euros per kg and game day
  const STORAGE_UPGRADE = 4000;
  const MACHINE_POWER_COST_PER_HOUR = 7.50;
  const ROBOT_POWER_COST_PER_HOUR = 1.20;
  const SELL_BASE_RATE = .60;
  const SELL_UPGRADE_RATE = .35;
  const MAX_QUEUED_ORDERS = 3;
  const LOADING_ROBOT_COST = 8500;
  const ORDER_OFFICE_SETUP_COST = 12000;
  const SHIFT_LEADER_SETUP_COST = 10000;
  const SHIFT_LEADER_HOURLY_WAGE = 42;
  const SHIFT_LEADER_SPENDING_LIMITS = [1000,2500,5000,10000];
  const ROBOT_FAILURE_RATE_PER_HOUR = 0.004;
  const ROBOT_RESTART_MINUTES = [90,150];
  const ROBOT_TECHNICIAN_COST = 900;
  const ROBOT_TECHNICIAN_MINUTES = [25,45];
  const ORDER_OFFICE_HOURLY_WAGE = 36;
  const ORDER_OFFICE_REVIEW_MINUTES = 30;
  const ORDER_OFFICE_MIN_DEADLINE_BUFFER_MINUTES = 30;
  const ORDER_OFFICE_DEADLINE_BUFFER_RATIO = 0.1;
  const PROGRAMMER_HIRING_FEE = 4500;
  const PROGRAMMER_HOURLY_WAGE = 42;
  const economySystem = globalThis.CNCModules && globalThis.CNCModules.economy;
  const inventorySystem = globalThis.CNCModules && globalThis.CNCModules.inventory;
  const orderMarketSystem = globalThis.CNCModules && globalThis.CNCModules.orderMarket;
  const breakdownSystem = globalThis.CNCModules && globalThis.CNCModules.breakdowns;
  const expansionSystem = globalThis.CNCModules && globalThis.CNCModules.factoryExpansion;
  const materialSystem = globalThis.CNCModules && globalThis.CNCModules.materials;
  const recruitmentSystem = globalThis.CNCModules && globalThis.CNCModules.recruitment;
  const programmingQuality = globalThis.CNCModules && globalThis.CNCModules.programmingQuality;
  if (!economySystem || !inventorySystem || !orderMarketSystem || !breakdownSystem || !expansionSystem || !materialSystem || !recruitmentSystem || !programmingQuality) throw new Error('CNC Factory game systems failed to load.');
  const catalog = {
    standard: {name:'Nexora NX-350',kind:'Drehen',price:18000,rate:1},
    rapid: {name:'Nexora NX-420',kind:'Drehen',price:27000,rate:1.25},
    premium: {name:'Aurex AT-600',kind:'Drehen',price:42000,rate:1.55},
    mill3: {name:'Veltron VX-500',kind:'Fräsen',price:38000,rate:1.12},
    mill5: {name:'Orionis OM-650X',kind:'Fräsen',price:58000,rate:1.38}
  };
  const turningHallArtwork='hall-four-machines.webp?v=1';
  const turningMachineArtwork = {
    standard:'assets/nexora-nx350-hall-v2.png?v=1',
    rapid:'assets/nexora-nx420-hall-v2.png?v=1',
    premium:'assets/aurex-at600-hall-v2.png?v=1'
  };
  const hallMachineArtwork = {
    mill3:'assets/veltron-vx500-hall-front.png?v=1',
    mill5:'assets/orionis-om650x-hall-straight.webp?v=2'
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
    bay,type,purchasePrice:catalog[type].price,level:1,maintenance:90,maintenanceRemainingMinutes:0,tool:82,operator1:false,operator2:false,loadingRobot:false,robotFault:false,robotRepairRemainingMinutes:0,
    activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,deadlineAt:null,
    setupDurationMinutes:0,setupRemainingMinutes:0,setupDelayMinutes:0,setupPartProduced:false,
    orderQueue:[],suspendedOrder:null,operatorProgramming:null,qualityReworkQueue:[],qualityInspectedOrderId:null,ncProgramPending:false
  });
  const defaults = () => ({
    money:14000,material:0,capacity:300,staff:{shift1:0,shift2:0},
    machines:[],selectedBay:null,speed:1,paused:false,gameMinutes:0,completed:0,
    eventQueue:[],nextRushOrderAt:null,ncPrograms:{},programmer:{hired:false,active:null,queue:[]},pendingQualityComplaints:[],
    payrollDue:0,wagesPaid:0,storagePaid:0,energyPaid:0,selected:null,selectedMaterialType:'c45',
    credit:{principal:0,originalAmount:0,annualRate:CREDIT_ANNUAL_RATE,paymentsRemaining:0,accruedInterest:0,nextPaymentAt:null,missedPayments:0},
    recruitment:{applicants:[],nextId:1},
    orderOffice:{hired:false,autoPurchase:true,autoAccept:true,cashReserve:5000,maxMarketMarkupPct:0,minMaterialSurplus:1000,queueLimit:1,nextReviewAt:0},
    shiftLeader:{shift1:{hired:false,autoMaintenance:true,autoTools:true,autoBreakdowns:true,spendingLimit:2500,nextDecisionAt:0},shift2:{hired:false,autoMaintenance:true,autoTools:true,autoBreakdowns:true,spendingLimit:2500,nextDecisionAt:0}},pendingRushAssignment:null
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
      state.ncPrograms=stored.ncPrograms&&typeof stored.ncPrograms==='object'&&!Array.isArray(stored.ncPrograms)?stored.ncPrograms:{};
      const savedProgrammer=stored.programmer&&typeof stored.programmer==='object'?stored.programmer:{};
      state.programmer={hired:!!savedProgrammer.hired,active:savedProgrammer.active&&typeof savedProgrammer.active.key==='string'?savedProgrammer.active:null,
        queue:Array.isArray(savedProgrammer.queue)?savedProgrammer.queue.filter(task=>task&&typeof task.key==='string'&&Number.isFinite(task.remainingMinutes)&&Number.isFinite(task.totalMinutes)):[]};
      state.pendingQualityComplaints=Array.isArray(stored.pendingQualityComplaints)?stored.pendingQualityComplaints.filter(item=>item&&typeof item.id==='string'&&Number.isFinite(item.dueAt)&&item.order&&typeof item.order.id==='string'):[];
      const pendingRush=stored.pendingRushAssignment;
      state.pendingRushAssignment=pendingRush&&typeof pendingRush.orderId==='string'&&Number.isInteger(pendingRush.bay)&&pendingRush.bay>0
        ?{orderId:pendingRush.orderId,bay:pendingRush.bay,interrupt:!!pendingRush.interrupt}:null;
      expansionSystem.init(state);
      state.machines=stored.machines.filter(validMachine).map(m=>{
        const hasSetupState=Object.prototype.hasOwnProperty.call(m,'setupDurationMinutes');
        const hasProgramState=Object.prototype.hasOwnProperty.call(m,'ncProgramPending');
        const machine={...freshMachine(m.bay,m.type),...m};
        const suspended=m.suspendedOrder;
        machine.suspendedOrder=suspended&&suspended.order&&typeof suspended.order.id==='string'
          ?{...suspended,progress:Math.max(0,Number(suspended.progress)||0),produced:Math.max(0,Number(suspended.produced)||0),
            deadlineAt:Number.isFinite(suspended.deadlineAt)?suspended.deadlineAt:null,
            setupDurationMinutes:Math.max(0,Number(suspended.setupDurationMinutes)||0),
            setupRemainingMinutes:Math.max(0,Number(suspended.setupRemainingMinutes)||0),
            setupDelayMinutes:Math.max(0,Number(suspended.setupDelayMinutes)||0),
            setupPartProduced:!!suspended.setupPartProduced,ncProgramPending:!!suspended.ncProgramPending,
            qualityInspectedOrderId:typeof suspended.qualityInspectedOrderId==='string'?suspended.qualityInspectedOrderId:null}:null;
        machine.ncProgramPending=hasProgramState?!!m.ncProgramPending:false;
        machine.robotFault=!!machine.loadingRobot&&!!machine.robotFault;
        machine.robotRepairRemainingMinutes=machine.loadingRobot?Math.max(0,Number(machine.robotRepairRemainingMinutes)||0):0;
        if(!machine.loadingRobot)machine.robotFault=false;
        machine.operatorProgramming=m.operatorProgramming&&typeof m.operatorProgramming.key==='string'&&Number.isFinite(m.operatorProgramming.remainingMinutes)?m.operatorProgramming:null;
        machine.qualityReworkQueue=Array.isArray(m.qualityReworkQueue)?m.qualityReworkQueue.filter(task=>task&&typeof task.id==='string'&&Number.isFinite(task.remainingMinutes)):[];
        machine.qualityInspectedOrderId=typeof m.qualityInspectedOrderId==='string'?m.qualityInspectedOrderId:null;
        if(!hasProgramState&&machine.activeOrder){
          const key=programmingQuality.programKey(machine.activeOrder);
          if(key&&!state.ncPrograms[key])state.ncPrograms[key]={part:machine.activeOrder.part,kind:machine.activeOrder.kind,completedAt:state.gameMinutes,legacy:true};
        }
        if(!hasSetupState&&machine.activeId)machine.setupPartProduced=true;
        machine.setupDurationMinutes=Math.max(0,Number(machine.setupDurationMinutes)||0);
        machine.setupRemainingMinutes=Math.min(machine.setupDurationMinutes,Math.max(0,Number(machine.setupRemainingMinutes)||0));
        machine.setupDelayMinutes=Math.max(0,Number(machine.setupDelayMinutes)||0);
        machine.setupPartProduced=!!machine.setupPartProduced;
        if(!Number.isFinite(m.purchasePrice))machine.purchasePrice=LEGACY_MACHINE_PRICES[m.type]||catalog[m.type].price;
        return machine;
      });
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
  state.nextRushOrderAt=Number.isFinite(state.nextRushOrderAt)&&state.nextRushOrderAt>0
    ?state.nextRushOrderAt:state.gameMinutes+36*60;
  state.eventQueue=Array.isArray(state.eventQueue)?state.eventQueue.filter(event=>
    event&&(
      (['warning','major_failure'].includes(event.event)&&Number.isInteger(event.bay)&&typeof event.fault==='string')||
      (event.event==='robot_failure'&&Number.isInteger(event.bay))||
      (event.event==='rush_order'&&event.order?.isRushOrder===true&&typeof event.order.id==='string'&&
        typeof event.order.customer==='string'&&Number.isFinite(event.order.createdAt)&&Number.isFinite(event.order.expiresAt))||
      (event.event==='quality_issue'&&Number.isInteger(event.bay)&&event.order&&typeof event.order.id==='string'&&Number.isInteger(event.defectParts)&&event.defectParts>0)||
      (event.event==='quality_complaint'&&event.order&&typeof event.order.id==='string'&&typeof event.customer==='string')
    )
  ).map(event=>({...event,id:event.id||(['rush_order','quality_issue','quality_complaint'].includes(event.event)?`${event.event}:${event.order.id}`:`${event.event}:${event.bay}:${event.since??state.gameMinutes}`)})):[];
  if(state.eventQueue.length)state.paused=true;
  state.machines.forEach(m=>{
    m.loadingRobot=!!m.loadingRobot;
    m.maintenanceRemainingMinutes=Math.max(0,Number(m.maintenanceRemainingMinutes)||0);
    if(m.loadingRobot)m.operator2=false;
    if(m.activeId&&!m.activeOrder){
      const legacyOrder=legacyOrders.find(order=>order.id===m.activeId);
      if(legacyOrder){m.activeOrder={...legacyOrder};m.activeOrderSource='legacy';}
    }
    if(m.activeOrder&&!Object.hasOwn(m,'ncProgramPending'))m.ncProgramPending=false;
    if(m.activeOrder&&m.activeOrderSource==='legacy'&&!m.ncProgramPending){
      const key=programmingQuality.programKey(m.activeOrder);
      if(key&&!state.ncPrograms[key])state.ncPrograms[key]={part:m.activeOrder.part,kind:m.activeOrder.kind,completedAt:state.gameMinutes,legacy:true};
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
      m.setupDurationMinutes=0;m.setupRemainingMinutes=0;m.setupDelayMinutes=0;m.setupPartProduced=false;
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
  function ensureShiftLeaderState(){
    const saved=state.shiftLeader&&typeof state.shiftLeader==='object'?state.shiftLeader:{};
    const hasSlots=!!(saved.shift1||saved.shift2),legacyShift=Number(saved.shift)===2?2:1;
    const leaders={};
    for(const shift of [1,2]){
      const old=hasSlots&&saved['shift'+shift]&&typeof saved['shift'+shift]==='object'?saved['shift'+shift]:{};
      const legacyHired=!hasSlots&&!!saved.hired&&legacyShift===shift;
      leaders['shift'+shift]={
        hired:!!old.hired||legacyHired,
        autoMaintenance:old.autoMaintenance!==false,
        autoTools:old.autoTools!==false,
        autoBreakdowns:old.autoBreakdowns!==false,
        spendingLimit:SHIFT_LEADER_SPENDING_LIMITS.includes(Number(old.spendingLimit))?Number(old.spendingLimit):2500,
        nextDecisionAt:Number.isFinite(old.nextDecisionAt)?Math.max(state.gameMinutes,old.nextDecisionAt):state.gameMinutes
      };
    }
    state.shiftLeader=leaders;
  }
  function shiftLeaderFor(shift){return state.shiftLeader?.['shift'+(Number(shift)===2?2:1)]||null;}
  function ensureOrderOfficeState(){
    const saved=state.orderOffice&&typeof state.orderOffice==='object'?state.orderOffice:{};
    const choice=(value,allowed,fallback)=>allowed.includes(Number(value))?Number(value):fallback;
    state.orderOffice={
      hired:!!saved.hired,
      autoPurchase:saved.autoPurchase!==false,
      autoAccept:saved.autoAccept!==false,
      cashReserve:choice(saved.cashReserve,[5000,10000,20000],5000),
      maxMarketMarkupPct:choice(saved.maxMarketMarkupPct,[0,10,20],0),
      minMaterialSurplus:choice(saved.minMaterialSurplus,[1000,2500,5000],1000),
      queueLimit:choice(saved.queueLimit,[1,2,3],1),
      nextReviewAt:Number.isFinite(saved.nextReviewAt)?saved.nextReviewAt:state.gameMinutes
    };
  }
  function nextMonthMinute(minutes){
    const date=new Date(START+Math.floor(Math.max(0,Number(minutes)||0))*60000);
    return (Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)-START)/60000;
  }
  function ensureCreditState(){
    const saved=state.credit&&typeof state.credit==='object'?state.credit:{};
    const principal=Math.max(0,Number.isFinite(saved.principal)?saved.principal:0);
    const active=principal>0;
    state.credit={
      principal:Math.round(principal*100)/100,
      originalAmount:active?Math.max(principal,Number.isFinite(saved.originalAmount)?saved.originalAmount:principal):0,
      annualRate:active&&Number.isFinite(saved.annualRate)?Math.min(.4,Math.max(0,saved.annualRate)):CREDIT_ANNUAL_RATE,
      paymentsRemaining:active?Math.max(1,Math.min(CREDIT_TERM_MONTHS,Math.floor(Number.isFinite(saved.paymentsRemaining)?saved.paymentsRemaining:CREDIT_TERM_MONTHS))):0,
      accruedInterest:active?Math.max(0,Math.round((Number.isFinite(saved.accruedInterest)?saved.accruedInterest:0)*100)/100):0,
      nextPaymentAt:active?(Number.isFinite(saved.nextPaymentAt)?saved.nextPaymentAt:nextMonthMinute(state.gameMinutes)):null,
      missedPayments:active?Math.max(0,Math.floor(Number.isFinite(saved.missedPayments)?saved.missedPayments:0)):0
    };
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
    ensureOrderOfficeState();
    ensureShiftLeaderState();
    ensureCreditState();
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
  const programKey=order=>programmingQuality.programKey(order);
  const programReady=order=>!!(programKey(order)&&state.ncPrograms?.[programKey(order)]);
  function programTaskFor(key){
    if(state.programmer?.active?.key===key)return state.programmer.active;
    return state.programmer?.queue?.find(task=>task.key===key)||null;
  }
  function programmingETA(order,machine=null){
    if(programReady(order))return 0;
    const key=programKey(order);
    if(machine?.operatorProgramming?.key===key)return Math.max(0,machine.operatorProgramming.remainingMinutes);
    let elapsed=0;
    const tasks=[state.programmer?.active,...(state.programmer?.queue||[])].filter(Boolean);
    for(const task of tasks){
      elapsed+=Math.max(0,Number(task.remainingMinutes)||0);
      if(task.key===key)return elapsed;
    }
    const base=programmingQuality.programmingMinutes(order,state.programmer?.hired?'programmer':'operator');
    return elapsed+base;
  }
  function scheduledProgrammingETA(workMinutes,canWorkAt){
    let remaining=Math.max(0,Number(workMinutes)||0);
    if(remaining<=0)return 0;
    const start=Math.floor(state.gameMinutes),limit=start+366*24*60;
    for(let minute=start;minute<limit;minute++){
      if(canWorkAt(minute)){
        remaining--;
        if(remaining<=1e-8)return minute+1-start;
      }
    }
    return Infinity;
  }
  function programmerCompletionETA(order){
    const key=programKey(order);let workload=0,found=false;
    for(const task of [state.programmer?.active,...(state.programmer?.queue||[])].filter(Boolean)){
      workload+=Math.max(0,Number(task.remainingMinutes)||0);
      if(task.key===key){found=true;break;}
    }
    if(!found)workload+=programmingQuality.programmingMinutes(order,'programmer');
    return scheduledProgrammingETA(workload,minute=>shiftAt(minute)===1);
  }
  function operatorCompletionETA(machine,order){
    const key=programKey(order),existing=machine.operatorProgramming;
    const workload=existing?.key===key
      ?Math.max(0,Number(existing.remainingMinutes)||0)
      :programmingQuality.programmingMinutes(order,'operator');
    if(![1,2].some(shift=>machine['operator'+shift]&&assignedEmployee(machine,shift)))return Infinity;
    return scheduledProgrammingETA(workload,minute=>{
      const shift=shiftAt(minute);
      return !!shift&&!!machine['operator'+shift]&&!!assignedEmployee(machine,shift)&&breakdownSystem.canContinueProduction(state,machine.bay);
    });
  }
  function enqueueNcProgram(order){
    if(!state.programmer?.hired||!order||programReady(order))return false;
    const key=programKey(order);
    if(!key||programTaskFor(key)||state.machines.some(machine=>machine.operatorProgramming?.key===key))return false;
    const totalMinutes=programmingQuality.programmingMinutes(order,'programmer');
    state.programmer.queue.push({key,part:order.part,kind:order.kind,orderId:order.id,totalMinutes,remainingMinutes:totalMinutes});
    return true;
  }
  function cancelProgrammerTask(key){
    if(state.programmer?.active?.key===key)state.programmer.active=null;
    if(state.programmer?.queue)state.programmer.queue=state.programmer.queue.filter(task=>task.key!==key);
  }
  function beginOperatorProgramming(machine,order){
    if(!machine||!order||programReady(order)||machine.operatorProgramming)return false;
    const key=programKey(order);
    if(!key)return false;
    const totalMinutes=programmingQuality.programmingMinutes(order,'operator');
    machine.operatorProgramming={key,part:order.part,kind:order.kind,orderId:order.id,totalMinutes,remainingMinutes:totalMinutes};
    machine.ncProgramPending=true;
    save();
    return true;
  }
  function scheduleActiveOrderProgramming(machine,order){
    if(!machine||!order||programReady(order)||machine.operatorProgramming)return false;
    const key=programKey(order);
    if(!key)return false;
    if(state.programmer?.active?.key===key)return false;
    const programmerHasTask=!!programTaskFor(key);
    const programmerETA=state.programmer?.hired?programmerCompletionETA(order):Infinity;
    const operatorETA=operatorCompletionETA(machine,order);
    if(!state.programmer?.hired||operatorETA<programmerETA){
      if(programmerHasTask)cancelProgrammerTask(key);
      return beginOperatorProgramming(machine,order);
    }
    return enqueueNcProgram(order);
  }
  function reassessActiveProgrammingRoutes(){
    let changed=false;
    for(const machine of state.machines){
      const active=job(machine);
      if(active&&!programReady(active)&&!machine.operatorProgramming)
        changed=scheduleActiveOrderProgramming(machine,active)||changed;
    }
    return changed;
  }
  function schedulePlannedPrograms(){
    let changed=false;
    for(const machine of state.machines){
      const active=job(machine);
      if(active&&!programReady(active))changed=scheduleActiveOrderProgramming(machine,active)||changed;
    }
    for(const machine of state.machines)
      for(const entry of machine.orderQueue||[])if(!programReady(entry.order))changed=enqueueNcProgram(entry.order)||changed;
    changed=reassessActiveProgrammingRoutes()||changed;
    if(changed)save();
    return changed;
  }

  function completeNcProgram(task,method){
    if(!task?.key)return;
    state.ncPrograms[task.key]={part:task.part,kind:task.kind,completedAt:state.gameMinutes,method};
    for(const machine of state.machines){
      const order=job(machine);
      if(!order||programKey(order)!==task.key)continue;
      machine.ncProgramPending=false;
      if(machine.setupRemainingMinutes<=0&&!machine.setupPartProduced)beginMachineSetup(machine,order);
    }
  }
  function hireProgrammer(){
    if(state.programmer.hired||state.money<PROGRAMMER_HIRING_FEE)return;
    if(!book('other',-PROGRAMMER_HIRING_FEE,'NC-Programmierer eingestellt',{hourlyWage:PROGRAMMER_HOURLY_WAGE}).ok)return;
    state.programmer.hired=true;
    schedulePlannedPrograms();
    save();renderBusiness();render();
    say(`NC-Programmierer eingestellt · ${euro(PROGRAMMER_HOURLY_WAGE)} je Frühschichtstunde. Eingeplante Neuteile kommen in die Programmierwarteschlange.`);
  }
  function tickProgrammer(step,shift){
    if(!state.programmer?.hired||shift!==1)return;
    if(!state.programmer.active)state.programmer.active=state.programmer.queue.shift()||null;
    const task=state.programmer.active;
    if(!task)return;
    task.remainingMinutes=Math.max(0,task.remainingMinutes-step);
    if(task.remainingMinutes>1e-8)return;
    completeNcProgram(task,'programmer');
    state.programmer.active=null;
    reassessActiveProgrammingRoutes();
    say(`NC-Programm für ${task.part} fertig. Eingeplante passende Aufträge können jetzt starten.`);
    save();
  }
  function renderProgrammer(){
    const active=state.programmer.active,queue=state.programmer.queue||[];
    $('programmer-status').textContent=!state.programmer.hired
      ?'Noch nicht eingestellt. Bediener können Neuteile an ihrer Maschine programmieren.'
      :active?`Programmiert ${active.part} · noch ${formatMinutes(active.remainingMinutes)} · ${queue.length} weitere geplant`
      :queue.length?`Wartet auf die Frühschicht · ${queue.length} Programm${queue.length===1?'':'e'} eingeplant`
      :'Bereit · keine neuen Programme in der Warteschlange.';
    const button=$('hire-programmer');
    button.textContent=state.programmer.hired?'NC-Programmierer eingestellt':`Programmierer einstellen · ${euro(PROGRAMMER_HIRING_FEE)}`;
    button.disabled=state.programmer.hired||state.money<PROGRAMMER_HIRING_FEE;
  }
  function renderProgramPanel(machine,order){
    const panel=$('nc-programming-panel'),button=$('program-active-order');
    const needsProgram=!!machine&&!!order&&!programReady(order);
    panel.hidden=!needsProgram;
    if(!needsProgram)return;
    const task=programTaskFor(programKey(order)),shift=shiftAt(state.gameMinutes),employee=shift?assignedEmployee(machine,shift):null;
    const operatorAvailable=[1,2].some(assignedShift=>machine['operator'+assignedShift]&&assignedEmployee(machine,assignedShift));
    const eta=programmingETA(order,machine),tolerance=programmingQuality.toleranceClass(order);
    $('nc-program-info').textContent=machine.operatorProgramming
      ?`${employee?'Bediener-Programmierung läuft':'Wartet auf zugewiesenen Bediener'} · ${formatMinutes(machine.operatorProgramming.remainingMinutes)} verbleibend. Während der Programmierung steht diese Maschine.`
      :task?`Der Programmierer bereitet ${order.part} vor · ca. ${formatMinutes(eta)} bis zur Fertigstellung. ${tolerance} Toleranz.`
      :`Neuteil ${order.part} braucht ein CNC-Programm. Es wird automatisch ${state.programmer.hired&&operatorAvailable?'dem Programmierer oder bei Überlast dem Bediener':state.programmer.hired?'dem Programmierer':'vom Bediener'} zugewiesen. ${tolerance} Toleranz.`;
    button.hidden=true;button.disabled=true;
  }

  function qualityRiskFor(machine,order){
    const shifts=[1,2].filter(shift=>machine['operator'+shift]);
    const employees=shifts.map(shift=>assignedEmployee(machine,shift)).filter(Boolean);
    const precision=employees.length?employees.reduce((sum,employee)=>sum+(Number(employee.skills?.precision)||5),0)/employees.length:5;
    const trained=employees.length?employees.reduce((sum,employee)=>sum+skillLevel(employee),0)/employees.length:0;
    const planned=plannedOrderMinutes(machine,order,productionFactor(machine));
    const slack=machine.activeId===order.id&&Number.isFinite(machine.deadlineAt)?machine.deadlineAt-state.gameMinutes:order.deadlineHours*60-planned;
    const timePressure=slack<0?4:slack<120?3:slack<360?2:slack<720?1:0;
    return programmingQuality.riskPercent({order,machine,precision,trained,timePressure});
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
  const resaleValue=m=>m?Math.round((Number.isFinite(m.purchasePrice)?m.purchasePrice:LEGACY_MACHINE_PRICES[m.type]||catalog[m.type].price)*SELL_BASE_RATE+upgradeInvestment(m)*SELL_UPGRADE_RATE+(m.loadingRobot?LOADING_ROBOT_COST*.4:0)):0;
  const skillLevel=employee=>employee?Math.min(3,Math.max(employee.trained,employee.xp>=1500?3:employee.xp>=600?2:employee.xp>=180?1:0)):0;
  const assignedEmployee=(m,shift)=>state.staffRoster['shift'+shift].find(employee=>employee.assignedBay===m.bay);
  const productionFactorForShift=(m,shift)=>{
    const employee=assignedEmployee(m,shift);
    return catalog[m.type].rate*(1+(m.level-1)*.13)*Math.max(.65,m.maintenance/100*.75+.25)*
      (1+.05*skillLevel(employee))*recruitmentSystem.productionMultiplier(employee,catalog[m.type].kind);
  };
  const productionFactor=m=>productionFactorForShift(m,shiftAt(state.gameMinutes)||1);
  const setupMinutesForOrder=order=>{
    const difficulty=Math.min(5,Math.max(1,Number(order?.difficulty)||1));
    const quantity=Math.max(1,Number(order?.qty)||1);
    const duration=Math.max(0,Number(order?.duration)||0);
    const complexity=(difficulty-1)*24+
      Math.min(60,Math.max(0,quantity-15)*.7)+
      Math.min(45,Math.max(0,duration-40)*.65)+
      (order?.kind==='Fräsen'?20:0);
    return Math.min(240,Math.max(60,Math.round((60+complexity)/15)*15));
  };
  const setupProblemChance=(machine,order)=>{
    const difficulty=Math.min(5,Math.max(1,Number(order?.difficulty)||1));
    const maintenance=Math.max(0,Math.min(100,Number(machine?.maintenance)||0));
    const tool=Math.max(0,Math.min(100,Number(machine?.tool)||0));
    return Math.min(.55,.1+(difficulty-1)*.035+Math.max(0,70-maintenance)*.003+Math.max(0,60-tool)*.002);
  };
  const expectedSetupMinutes=(machine,order)=>setupMinutesForOrder(order)+setupProblemChance(machine,order)*75;
  function beginMachineSetup(machine,order){
    const baseMinutes=setupMinutesForOrder(order);
    const delayMinutes=Math.random()<setupProblemChance(machine,order)?30+Math.floor(Math.random()*7)*15:0;
    const totalMinutes=baseMinutes+delayMinutes;
    machine.setupDurationMinutes=totalMinutes;
    machine.setupRemainingMinutes=totalMinutes;
    machine.setupDelayMinutes=delayMinutes;
    machine.setupPartProduced=false;
    machine.progress=0;
    machine.produced=0;
    return {baseMinutes,delayMinutes,totalMinutes};
  }
  const orderProgressPercent=(machine,order)=>{
    if(!machine||!order)return 0;
    const quantity=Math.max(1,Number(order.qty)||1);
    if(!machine.setupPartProduced&&machine.setupDurationMinutes>0){
      const setupProgress=Math.max(0,Math.min(1,1-machine.setupRemainingMinutes/machine.setupDurationMinutes));
      return 100/quantity*setupProgress;
    }
    return Math.max(0,Math.min(100,Number(machine.progress)||0));
  };
  const remainingMinutes=(machine,order,factor=productionFactor(machine))=>{
    if(!machine||!order)return 0;
    const quantity=Math.max(1,Number(order.qty)||1);
    const productionProgress=machine.setupPartProduced
      ?machine.progress
      :Math.max(machine.progress,100/quantity);
    const setupRemaining=Math.max(0,Number(machine.setupRemainingMinutes)||0);
    return programmingETA(order,machine)+setupRemaining+Math.max(0,(100-productionProgress)*order.duration*6/(100*factor));
  };
  const plannedOrderMinutes=(machine,order,factor)=>{
    if(!order||!Number.isFinite(order.duration))return 0;
    const quantity=Math.max(1,Number(order.qty)||1);
    return programmingETA(order,machine)+expectedSetupMinutes(machine,order)+Math.max(0,(quantity-1)/quantity)*order.duration*6/factor;
  };
  function scheduledWorkCompletionAt(machine,startAt,workMinutes,operatorOnly=false){
    if(!Number.isFinite(startAt)||!Number.isFinite(workMinutes))return Infinity;
    let remaining=Math.max(0,workMinutes),minuteAt=Math.max(state.gameMinutes,startAt);
    if(remaining<=1e-8)return minuteAt;
    const hasShift1=!!machine.operator1&&!!assignedEmployee(machine,1);
    const hasShift2=(!!machine.operator2&&!!assignedEmployee(machine,2))||(!operatorOnly&&!!machine.loadingRobot);
    const robotReadyAt=machine.loadingRobot
      ?machine.robotFault&&!(machine.robotRepairRemainingMinutes>0)?Infinity:state.gameMinutes+Math.max(0,Number(machine.robotRepairRemainingMinutes)||0)
      :Infinity;
    if(!hasShift1&&!hasShift2)return Infinity;
    for(let dayIndex=0;dayIndex<366;dayIndex++){
      const date=dateAt(minuteAt),dayStart=(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-START)/60000;
      if(date.getUTCDay()===0||date.getUTCDay()===6){minuteAt=dayStart+1440;continue;}
      for(const shift of [1,2]){
        if(!(shift===1?hasShift1:hasShift2))continue;
        const shiftStart=dayStart+(shift===1?360:840),shiftEnd=dayStart+(shift===1?840:1320);
        if(minuteAt>=shiftEnd)continue;
        const workStart=Math.max(minuteAt,shiftStart,shift===2&&machine.loadingRobot?robotReadyAt:0),worked=Math.min(remaining,shiftEnd-workStart);
        if(worked<=0)continue;
        minuteAt=workStart+worked;remaining-=worked;
        if(remaining<=1e-8)return minuteAt;
        minuteAt=shiftEnd;
      }
      minuteAt=dayStart+1440;
    }
    return Infinity;
  }
  function forecastOrderOnMachine(machine,order,freeAt,factor,isActive=false,knownProgramReadyAt=null){
    const key=programKey(order),programMinutes=machine.operatorProgramming?.key===key
      ?Math.max(0,Number(machine.operatorProgramming.remainingMinutes)||0)
      :programmingQuality.programmingMinutes(order,'operator');
    const processMinutes=isActive
      ?Math.max(0,remainingMinutes(machine,order,factor)-programmingETA(order,machine))
      :setupMinutesForOrder(order)+Math.max(0,(Math.max(1,Number(order.qty)||1)-1)/Math.max(1,Number(order.qty)||1)*order.duration*6/factor);
    let startsAt=Math.max(state.gameMinutes,freeAt),operatorProgrammingMinutes=0,programReadyAt=state.gameMinutes;
    if(programReady(order)){
      programReadyAt=state.gameMinutes;
    }else if(Number.isFinite(knownProgramReadyAt)){
      programReadyAt=knownProgramReadyAt;startsAt=Math.max(startsAt,programReadyAt);
    }else{
      const operatorTask=machine.operatorProgramming?.key===key;
      if(operatorTask||!state.programmer.hired){
        programReadyAt=scheduledWorkCompletionAt(machine,startsAt,programMinutes,true);
        startsAt=programReadyAt;
        operatorProgrammingMinutes=programMinutes;
      }else{
        const programmerStarted=state.programmer.active?.key===key;
        const programmerReadyAt=state.gameMinutes+programmerCompletionETA(order);
        if(programmerStarted){
          programReadyAt=programmerReadyAt;startsAt=Math.max(startsAt,programReadyAt);
        }else{
          const operatorReadyAt=scheduledWorkCompletionAt(machine,startsAt,programMinutes,true);
          if(operatorReadyAt<programmerReadyAt){programReadyAt=operatorReadyAt;startsAt=operatorReadyAt;operatorProgrammingMinutes=programMinutes;}
          else{programReadyAt=programmerReadyAt;startsAt=Math.max(startsAt,programReadyAt);}
        }
      }
    }
    const finishAt=scheduledWorkCompletionAt(machine,startsAt,processMinutes);
    return {finishAt,programReadyAt,workMinutes:processMinutes+operatorProgrammingMinutes};
  }
  function plannedMachineLoad(machine,additionalOrder=null){
    const shifts=[1,2].filter(shift=>(machine['operator'+shift]&&assignedEmployee(machine,shift))||(shift===2&&machine.loadingRobot));
    const factor=shifts.length
      ?shifts.reduce((sum,shift)=>sum+productionFactorForShift(machine,shift),0)/shifts.length
      :productionFactor(machine);
    const commitments=[];
    const active=job(machine);
    const deadlineFor=(order,at)=>Number.isFinite(at)?at:state.gameMinutes+Math.max(0,Number(order?.deadlineHours)||0)*60;
    if(active)commitments.push({order:active,deadlineAt:deadlineFor(active,machine.deadlineAt),active:true});
    for(const entry of machine.orderQueue||[]){
      commitments.push({order:entry.order,deadlineAt:deadlineFor(entry.order,entry.deadlineAt),active:false});
    }
    if(Number.isFinite(additionalOrder?.duration)){
      commitments.push({order:additionalOrder,deadlineAt:deadlineFor(additionalOrder,additionalOrder.deadlineAt),active:false});
    }
    const reworkMinutes=(machine.qualityReworkQueue||[]).reduce((sum,task)=>sum+Math.max(0,Number(task.remainingMinutes)||0),0);
    let freeAt=active?state.gameMinutes:scheduledWorkCompletionAt(machine,state.gameMinutes,reworkMinutes,true),plannedMinutes=reworkMinutes,critical=null;
    const predictedPrograms=new Map();
    const deadlineChecks=commitments.map(item=>{
      const key=programKey(item.order),knownProgramReadyAt=predictedPrograms.get(key);
      const forecast=forecastOrderOnMachine(machine,item.order,freeAt,factor,item.active,knownProgramReadyAt);
      if(key&&!predictedPrograms.has(key))predictedPrograms.set(key,forecast.programReadyAt);
      freeAt=forecast.finishAt;plannedMinutes+=forecast.workMinutes;
      const deadlineMinutes=item.deadlineAt-state.gameMinutes,leadMinutes=forecast.finishAt-state.gameMinutes;
      const percent=deadlineMinutes>0?leadMinutes/deadlineMinutes*100:leadMinutes>0?Infinity:0;
      const check={orderId:item.order.id,part:item.order.part,deadlineAt:item.deadlineAt,deadlineMinutes,leadMinutes,
        finishAt:forecast.finishAt,bufferMinutes:item.deadlineAt-forecast.finishAt,requiredMinutes:plannedMinutes,percent};
      if(!critical||check.percent>critical.percent)critical=check;
      if(item.active&&reworkMinutes>0)freeAt=scheduledWorkCompletionAt(machine,freeAt,reworkMinutes,true);
      return check;
    });
    return {shifts,plannedMinutes,deadlineChecks,critical,percent:!shifts.length?null:critical?.percent??0};
  }

  function rushInterruptionForecast(machine,rushOrder){
    const interrupted=job(machine);
    if(!interrupted||machine.suspendedOrder||!programReady(interrupted)||machine.ncProgramPending||machine.operatorProgramming)return null;
    const shifts=[1,2].filter(shift=>(machine['operator'+shift]&&assignedEmployee(machine,shift))||(shift===2&&machine.loadingRobot));
    if(!shifts.length)return null;
    const factor=shifts.reduce((sum,shift)=>sum+productionFactorForShift(machine,shift),0)/shifts.length;
    const rush=forecastOrderOnMachine(machine,rushOrder,state.gameMinutes,factor,false);
    const quantity=Math.max(1,Number(interrupted.qty)||1),duration=Math.max(0,Number(interrupted.duration)||0);
    const hasProduced=machine.setupPartProduced||machine.produced>0;
    const remainingProduction=hasProduced
      ?Math.max(0,(100-Math.max(0,Number(machine.progress)||0))*duration*6/(100*factor))
      :Math.max(0,(quantity-1)/quantity*duration*6/factor);
    const resumedSetup=setupMinutesForOrder(interrupted);
    const finishAt=scheduledWorkCompletionAt(machine,rush.finishAt,resumedSetup+remainingProduction);
    const deadlineAt=Number.isFinite(machine.deadlineAt)?machine.deadlineAt:state.gameMinutes+Math.max(0,Number(interrupted.deadlineHours)||0)*60;
    return {interrupted,rushFinishAt:rush.finishAt,finishAt,deadlineAt,bufferMinutes:deadlineAt-finishAt,
      resumedSetup,hasProduced,shifts,factor};
  }

  const formatMinutes=min=>{
    min=Math.max(0,Math.ceil(min));
    const hours=Math.floor(min/60),mins=min%60;
    return hours?(hours+' h '+mins+' min'):(mins+' min');
  };
  const formatEstimateMinutes=min=>Number.isFinite(min)?formatMinutes(Math.max(0,min)):'nicht absehbar';
  const dateAt=min=>new Date(START+Math.floor(min)*60000);
  const shiftAt=min=>{
    const d=dateAt(min),day=d.getUTCDay(),hour=d.getUTCHours();
    return day===0||day===6 ? 0 : hour>=6&&hour<14 ? 1 : hour>=14&&hour<22 ? 2 : 0;
  };
  const clock=()=>{
    const d=dateAt(state.gameMinutes),day=['So','Mo','Di','Mi','Do','Fr','Sa'][d.getUTCDay()];
    const date=`${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${d.getUTCFullYear()}`;
    const time=`${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    return `${day} ${date} · ${time}`;
  };
  const robotAvailable=m=>!!m?.loadingRobot&&!m.robotFault&&!(m.robotRepairRemainingMinutes>0);
  const readyToRun=m=>!!job(m)&&programReady(job(m))&&!m.operatorProgramming&&!state.paused&&!(m.maintenanceRemainingMinutes>0)&&!!shiftAt(state.gameMinutes)&&
    !!(m['operator'+shiftAt(state.gameMinutes)]||(shiftAt(state.gameMinutes)===2&&robotAvailable(m)))&&m.tool>=1&&m.maintenance>=8;
  const operating=m=>readyToRun(m)&&breakdownSystem.canContinueProduction(state,m.bay);
  const spareToolCount=m=>m?Math.max(0,Number(state.inventory?.tools?.[m.type])||0):0;
  function autoReplaceWornTool(machine,shift){
    if(!machine||machine.tool>=1||!machine['operator'+shift]||spareToolCount(machine)<1)return false;
    const result=inventorySystem.consumeTool(state,machine.type,1);
    if(!result.ok)return false;
    machine.tool=100;
    save();
    say(`Bediener Schicht ${shift} hat an Platz ${machine.bay} automatisch ein Reservewerkzeug eingesetzt.`);
    return true;
  }
  const canChangeTool=m=>!!m&&m.tool<100&&(spareToolCount(m)>0||state.money>=650);
  const canBuySpareTool=m=>{
    if(!m||state.money<650)return false;
    const usage=inventorySystem.getUsage(state);
    return !!usage.ok&&usage.remaining.tools>=1;
  };
  const canMaintain=m=>!!m&&state.money>=PREVENTIVE_MAINTENANCE_COST&&m.maintenance<99&&
    !(m.maintenanceRemainingMinutes>0)&&breakdownSystem.getStatus(state,m.bay)==='ok';
  function changeMachineTool(m){
    if(!canChangeTool(m))return false;
    const usingSpare=spareToolCount(m)>0;
    if(usingSpare){if(!inventorySystem.consumeTool(state,m.type,1).ok)return false;}
    else if(!book('tools',-650,'Werkzeugwechsel',{bay:m.bay,type:m.type}).ok)return false;
    m.tool=100;save();renderBusiness();render();
    say(usingSpare?'Reservewerkzeug eingesetzt.':'Werkzeug gewechselt.');
    return true;
  }
  function startPreventiveMaintenance(m){
    if(!canMaintain(m))return false;
    if(!book('maintenance',-PREVENTIVE_MAINTENANCE_COST,'Vorbeugende Wartung gestartet',{bay:m.bay,type:m.type,durationMinutes:PREVENTIVE_MAINTENANCE_MINUTES}).ok)return false;
    m.maintenanceRemainingMinutes=PREVENTIVE_MAINTENANCE_MINUTES;
    save();renderBusiness();render();
    say(catalog[m.type].name+': vorbeugende Wartung gestartet · '+formatMinutes(PREVENTIVE_MAINTENANCE_MINUTES)+' Stillstand.');
    return true;
  }
  function leaderCanSpend(leader,cost){
    return !!leader&&Number(leader.spendingLimit)>=cost&&state.money>=cost;
  }
  function leaderBuySpareTool(leader,machine){
    if(!leaderCanSpend(leader,650)||!canBuySpareTool(machine))return false;
    const added=inventorySystem.addTool(state,machine.type,1);
    if(!added.ok)return false;
    const debit=book('tools',-650,'Schichtleitung: Reservewerkzeug gekauft',{bay:machine.bay,type:machine.type,role:'shift_leader'});
    if(!debit.ok){inventorySystem.consumeTool(state,machine.type,1);return false;}
    return true;
  }
  function runShiftLeaderAutomation(shift){
    const leader=shiftLeaderFor(shift);
    if(!leader?.hired)return false;
    let changed=false;
    if(shift===2&&leader.autoTools){
      for(const machine of state.machines){
        if(!machine.loadingRobot||machine.robotFault||machine.robotRepairRemainingMinutes>0||machine.tool>=1||
          breakdownSystem.getStatus(state,machine.bay)!=='ok')continue;
        if(spareToolCount(machine)<1&&leaderBuySpareTool(leader,machine)){
          say('Schichtleiter S2 hat ein Reservewerkzeug für den Laderoboter gekauft.');
          changed=true;
        }
        if(spareToolCount(machine)>0&&inventorySystem.consumeTool(state,machine.type,1).ok){
          machine.tool=100;
          say('Schichtleiter S2 hat das Werkzeug am Laderoboter auf Platz '+machine.bay+' gewechselt.');
          changed=true;
        }
      }
    }
    if(state.gameMinutes+1e-8<leader.nextDecisionAt){
      if(changed)save();
      return changed;
    }
    leader.nextDecisionAt=state.gameMinutes+60;
    if(leader.autoTools){
      for(const machine of state.machines){
        if(machine.tool>40||spareToolCount(machine)>0||machine.maintenanceRemainingMinutes>0||
          breakdownSystem.getStatus(state,machine.bay)!=='ok')continue;
        if(leaderBuySpareTool(leader,machine)){
          say('Schichtleiter S'+shift+' hat ein Reservewerkzeug für Platz '+machine.bay+' bereitgelegt.');
          changed=true;
          break;
        }
      }
    }
    if(leader.autoMaintenance&&leaderCanSpend(leader,PREVENTIVE_MAINTENANCE_COST)){
      const machine=state.machines.filter(item=>
        !job(item)&&item.orderQueue.length===0&&!item.qualityReworkQueue.length&&
        item.maintenanceRemainingMinutes<=0&&item.maintenance<=60&&canMaintain(item)
      ).sort((a,b)=>a.maintenance-b.maintenance)[0];
      if(machine&&book('maintenance',-PREVENTIVE_MAINTENANCE_COST,'Schichtleitung: vorbeugende Wartung gestartet',{
        bay:machine.bay,type:machine.type,durationMinutes:PREVENTIVE_MAINTENANCE_MINUTES,role:'shift_leader',shift
      }).ok){
        machine.maintenanceRemainingMinutes=PREVENTIVE_MAINTENANCE_MINUTES;
        say('Schichtleiter S'+shift+' hat vorbeugende Wartung auf Platz '+machine.bay+' eingeplant.');
        changed=true;
      }
    }
    if(changed)save();
    return changed;
  }
  const conditionLabel=value=>value>0&&value<1?'<1 %':Math.round(value)+' %';
  let visual=null, currentPanel=null, businessSection='factory', messageTimer, zoomTimer, phaserGame=null, hallPreviewBay=null, shiftLeaderPanelShift=1, shiftLeaderAdviceKey='';
  function say(message){
    $('message').textContent=message;
    clearTimeout(messageTimer);
    messageTimer=setTimeout(()=>{if($('message').textContent===message)$('message').textContent='';},5000);
  }
  function setupEventWindow(){
    if($('event-window'))return;
    const overlay=document.createElement('section'),card=document.createElement('article');
    const eyebrow=document.createElement('span'),title=document.createElement('h2'),detail=document.createElement('p');
    const consequence=document.createElement('div'),managerAdvice=document.createElement('p'),orderTiming=document.createElement('div'),rushCapacity=document.createElement('section'),actions=document.createElement('div'),count=document.createElement('p');
    const rushStyle=document.createElement('style');
    rushStyle.textContent='.rush-machine-actions{display:grid;grid-template-columns:1fr;gap:5px;margin-top:6px}.rush-machine-choice{width:100%;min-height:38px;padding:6px 8px;text-align:left;font-size:10px;line-height:1.25}.rush-machine-choice small{display:block;margin-top:3px;color:#d1dcdf;font-size:9px;font-weight:600;line-height:1.3}.rush-interrupt-choice{background:#644426;border-color:#d3944d}.rush-capacity-rows{max-height:min(38vh,330px)}.shift-leader-event-advice{margin:7px 0;padding:8px 10px;border-left:3px solid #74d7a4;border-radius:5px;background:#102a31;color:#d7f0e3;font-size:11px;line-height:1.4}.shift-leader-event-advice[hidden]{display:none}';
    document.head.append(rushStyle);
    overlay.id='event-window';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','event-title');
    card.className='event-card';eyebrow.id='event-eyebrow';eyebrow.className='event-eyebrow';
    title.id='event-title';detail.id='event-detail';consequence.id='event-consequence';consequence.className='event-consequence';
    managerAdvice.id='shift-leader-event-advice';managerAdvice.className='shift-leader-event-advice';managerAdvice.hidden=true;
    orderTiming.id='event-order-timing';orderTiming.className='event-order-timing';
    const deadlineCell=document.createElement('div'),deadlineLabel=document.createElement('small'),deadlineValue=document.createElement('strong');
    deadlineCell.id='event-order-deadline-cell';deadlineLabel.id='event-order-deadline-label';deadlineLabel.textContent='AUFTRAGSFRIST';deadlineValue.id='event-order-deadline';
    deadlineCell.append(deadlineLabel,deadlineValue);
    const processCell=document.createElement('div'),processLabel=document.createElement('small'),processValue=document.createElement('strong');
    processLabel.id='event-order-processing-label';processLabel.textContent='BEARBEITUNG NOCH';processValue.id='event-order-processing';
    processCell.append(processLabel,processValue);orderTiming.append(deadlineCell,processCell);
    rushCapacity.id='rush-capacity-check';rushCapacity.className='rush-capacity-check';rushCapacity.hidden=true;
    actions.id='event-actions';actions.className='event-actions';count.id='event-count';count.className='event-count';
    card.append(eyebrow,title,detail,consequence,managerAdvice,orderTiming,rushCapacity,actions,count);overlay.append(card);document.querySelector('main').append(overlay);
    const selfButton=$('repair-now'),selfDetail=document.createElement('b');selfDetail.id='repair-self-detail';
    selfButton.replaceChildren(document.createTextNode('Selbst reparieren'),selfDetail);
    const technician=document.createElement('button'),technicianDetail=document.createElement('b');
    technician.id='repair-technician';technician.type='button';technician.className='action';
    technician.append(document.createTextNode('Monteur beauftragen'),technicianDetail);technicianDetail.id='repair-technician-detail';
    technician.addEventListener('click',()=>chooseBreakdown('repairTechnician'));
    selfButton.parentElement.insertBefore(technician,$('continue-risky'));
    const scheduleDetail=document.createElement('b');scheduleDetail.id='schedule-repair-detail';$('schedule-repair').append(scheduleDetail);
  }
  function renderRushOrderEvent(event){
    const order=event.order,bonus=Number.isFinite(order.rushBonus)?order.rushBonus:Math.max(0,order.reward-(order.baseReward||order.reward));
    const rate=order.kind==='Fräsen'?catalog.mill3.rate:catalog.standard.rate;
    const processing=programmingETA(order)+setupMinutesForOrder(order)+Math.max(0,(order.qty-1)/Math.max(1,order.qty)*order.duration*6/rate);
    $('event-window').querySelector('.event-card').classList.add('rush-event-card');
    $('event-eyebrow').textContent='STAMMKUNDEN-ANFRAGE · EILAUFTRAG';
    $('event-title').textContent=`${order.customer} braucht kurzfristig ${order.part}`;
    $('event-detail').textContent=`${order.qty} Teile · ${order.kind} · ${order.material} · ${order.kg} kg. Du hast bereits für diesen Kunden gearbeitet.`;
    $('event-consequence').textContent=`Eilzuschlag: +${order.rushBonusPct||20} % (${euro(bonus)}). Lieferfrist ${order.deadlineHours} Stunden ab Zusage. Pünktlich fertig: stärkerer Vertrauensgewinn; verspätet: stärkerer Vertrauensverlust.`;
    const timing=$('event-order-timing');timing.hidden=false;
    $('event-order-deadline-label').textContent='LIEFERFRIST AB ZUSAGE';
    $('event-order-processing-label').textContent='BEARBEITUNGSZEIT';
    $('event-order-deadline-cell').classList.remove('deadline-overdue');
    $('event-order-deadline').textContent=`${order.deadlineHours} Std.`;
    $('event-order-processing').textContent=`Ca. ${formatMinutes(processing)}`;
    renderRushCapacityCheck(order,event);
    const actions=$('event-actions');actions.replaceChildren();
    const addChoice=(label,detail,accepted,risky=false)=>{
      const button=document.createElement('button'),small=document.createElement('small');
      button.type='button';button.className='action event-choice'+(risky?' event-risk':'');
      button.append(document.createTextNode(label));small.textContent=detail;button.append(small);
      button.addEventListener('click',()=>resolveRushOrderEvent(event,accepted));actions.append(button);
    };
    addChoice('Zusage – später einplanen',`+${euro(bonus)} Zuschlag · Kundenzufriedenheit +6`,true);
    addChoice('Ablehnen','Kein Zeitdruck · Kundenzufriedenheit −10',false,true);
    $('event-count').textContent=state.eventQueue.length>1
      ?`Ereignis 1 von ${state.eventQueue.length} · Das Spiel ist pausiert.`
      :'Das Spiel ist pausiert, bis du zusagst oder ablehnst.';
  }
  function renderRushCapacityCheck(order,event){
    const panel=$('rush-capacity-check');panel.hidden=false;
    const heading=document.createElement('strong'),note=document.createElement('p'),rows=document.createElement('div');
    heading.className='rush-capacity-title';heading.textContent='Fristwirkung je Maschine';
    note.className='rush-capacity-note';
    note.textContent='Grün bedeutet pünktlich, Rot bedeutet voraussichtlich verspätet. Beim Unterbrechen zeigen wir zusätzlich, wie sich die Frist des laufenden Auftrags verschiebt.';
    rows.className='rush-capacity-rows';
    const machines=state.machines.filter(machine=>compatible(machine,order));
    if(!machines.length){
      const empty=document.createElement('p');empty.className='rush-capacity-empty';empty.textContent='Keine passende '+order.kind+'-Maschine vorhanden.';rows.append(empty);
    }
    machines.forEach(machine=>{
      const current=plannedMachineLoad(machine),projected=plannedMachineLoad(machine,order),interruption=rushInterruptionForecast(machine,order);
      const rushCheck=projected.deadlineChecks.find(check=>check.orderId===order.id);
      const bufferMinutes=rushCheck?.bufferMinutes??-Infinity;
      const activeOrder=job(machine);
      const activeDeadlineCheck=activeOrder?current.deadlineChecks.find(check=>check.orderId===activeOrder.id):null;
      const row=document.createElement('div'),top=document.createElement('div'),name=document.createElement('strong'),status=document.createElement('strong'),load=document.createElement('p'),window=document.createElement('p'),choices=document.createElement('div');
      const reason=rushAssignmentBlockReason(machine,order,false,true);
      const blocked=!!reason||!projected.shifts.length;
      const tight=bufferMinutes<0;
      row.className='rush-capacity-row';
      row.classList.toggle('over-capacity',tight||blocked);
      top.className='rush-capacity-row-head';
      name.textContent='Platz '+machine.bay+' · '+catalog[machine.type].name;
      status.className='rush-capacity-status';
      status.classList.toggle('rush-impact-late',!reason&&!!rushCheck&&tight);
      status.classList.toggle('rush-impact-on-time',!reason&&!!rushCheck&&!tight);
      status.textContent=reason||(!projected.shifts.length?'Keine besetzte Schicht':!rushCheck?'Zeitplan nicht berechenbar':tight?'Eilauftrag voraussichtlich verspätet':'Eilauftrag voraussichtlich pünktlich');
      top.append(name,status);
      const percentLabel=load=>load.percent===null?'keine Schicht':Number.isFinite(load.percent)?Math.round(load.percent)+' %':'∞ %';
      const currentPercent=percentLabel(current),projectedPercent=percentLabel(projected);
      load.className='rush-capacity-load';
      load.textContent='Fristauslastung: ohne Eilauftrag '+currentPercent+' · mit Eilauftrag '+projectedPercent+' (über 100 % = voraussichtlich verspätet)';
      window.className='rush-capacity-window';
      window.classList.toggle('rush-impact-late',tight);
      const rushOutcome=bufferMinutes>=0?'Fristpuffer '+formatEstimateMinutes(bufferMinutes):'Frist voraussichtlich um '+formatEstimateMinutes(-bufferMinutes)+' überschritten';
      window.textContent=rushCheck
        ?'Eilauftrag '+order.part+': fertig in '+formatEstimateMinutes(rushCheck.leadMinutes)+' · '+rushOutcome
        :'Eilauftrag: Fertigstellung nicht berechenbar.';
      choices.className='rush-machine-actions';
      const normalButton=document.createElement('button'),normalDetail=document.createElement('small');
      normalButton.type='button';normalButton.className='action rush-machine-choice';
      const materialShortage=Math.max(0,materialSystem.requiredKg(order)-materialSystem.available(state,order));
      normalButton.append(document.createTextNode(materialShortage>1e-9?'Material kaufen & hier einplanen':activeOrder?'Nach laufendem Auftrag einplanen':'Direkt auf dieser Maschine starten'));
      const normalTiming=rushCheck
        ?'Eilauftrag fertig in '+formatEstimateMinutes(rushCheck.leadMinutes)+' · '+rushOutcome
        :'Eilfrist nicht berechenbar';
      normalDetail.textContent=reason||(!projected.shifts.length?'Keine besetzte Schicht':materialShortage>1e-9?'Es fehlen '+Math.ceil(materialShortage)+' kg '+order.material+' · nach dem Kauf '+(activeOrder?'in die Warteschlange':'direkt')+' auf Platz '+machine.bay+' · '+euro(Number(order.rushBonus)||0)+' Zuschlag · Kundenzufriedenheit +6 · '+normalTiming:euro(Number(order.rushBonus)||0)+' Zuschlag · Kundenzufriedenheit +6 · '+normalTiming);
      normalButton.append(normalDetail);normalButton.disabled=!!reason||!projected.shifts.length;
      normalButton.addEventListener('click',()=>resolveRushOrderEvent(event,true,machine.bay,false));
      choices.append(normalButton);
      if(activeOrder){
        const interruptButton=document.createElement('button'),interruptDetail=document.createElement('small');
        const interruptReason=rushAssignmentBlockReason(machine,order,true,true);
        interruptButton.type='button';interruptButton.className='action rush-machine-choice rush-interrupt-choice';
        interruptButton.append(document.createTextNode(materialShortage>1e-9?'Material kaufen & Auftrag hier einschieben':'Jetzt starten und laufenden Auftrag unterbrechen'));
        if(interruption){
          const deadlineRemaining=interruption.deadlineAt-state.gameMinutes;
          const deadlineText=deadlineRemaining>=0
            ?'Frist in '+formatEstimateMinutes(deadlineRemaining)
            :'Frist bereits '+formatEstimateMinutes(-deadlineRemaining)+' überfällig';
          const outcome=interruption.bufferMinutes>=0
            ?formatEstimateMinutes(interruption.bufferMinutes)+' Puffer'
            :'voraussichtlich '+formatEstimateMinutes(-interruption.bufferMinutes)+' zu spät';
          const afterFinish=interruption.finishAt-state.gameMinutes;
          let finishImpact='Abschluss danach in '+formatEstimateMinutes(afterFinish)+'.';
          if(activeDeadlineCheck){
            const delay=interruption.finishAt-activeDeadlineCheck.finishAt;
            const delayText=(delay>=0?'später um ':'früher um ')+formatEstimateMinutes(Math.abs(delay));
            finishImpact='Vorher fertig in '+formatEstimateMinutes(activeDeadlineCheck.leadMinutes)+' · danach in '+formatEstimateMinutes(afterFinish)+' ('+delayText+').';
          }
          interruptDetail.textContent=(materialShortage>1e-9?'Es fehlen '+Math.ceil(materialShortage)+' kg '+order.material+'; nach dem Kauf wird der Eilauftrag auf Platz '+machine.bay+' zuerst gestartet. ':'')+
            'Kundenzufriedenheit +6 · Eilauftrag zuerst: fertig in '+(rushCheck?formatEstimateMinutes(rushCheck.leadMinutes):'nicht berechenbar')+'.\n'+
            'Danach '+activeOrder.part+': '+finishImpact+'\n'+
            'Neue Rüstzeit '+formatMinutes(interruption.resumedSetup)+' · '+deadlineText+' · danach '+outcome+'.';
        }else interruptDetail.textContent=interruptReason||'Frist des laufenden Auftrags nicht berechenbar.';
        interruptButton.append(interruptDetail);
        interruptButton.disabled=!!interruptReason||!interruption;
        interruptButton.addEventListener('click',()=>resolveRushOrderEvent(event,true,machine.bay,true));
        choices.append(interruptButton);
      }
      row.append(top,load,window,choices);rows.append(row);
    });
    panel.replaceChildren(heading,note,rows);
  }
  function addQualityChoice(label,detail,callback,cost=0,risky=false){
    const button=document.createElement('button'),small=document.createElement('small');
    button.type='button';button.className='action event-choice quality-choice'+(risky?' event-risk':'');
    button.append(document.createTextNode(label));small.textContent=detail;button.append(small);
    button.disabled=cost>0&&cost>state.money+1e-9;button.addEventListener('click',callback);
    $('event-actions').append(button);return button;
  }
  function renderQualityIssueEvent(event){
    const order=event.order,machine=machineAt(event.bay),qty=Math.max(1,Number(order.qty)||1);
    const reworkCost=Number.isFinite(event.reworkCost)?event.reworkCost:Math.max(250,Math.round(order.reward*event.defectParts/qty*.55));
    event.reworkCost=reworkCost;
    $('event-window').querySelector('.event-card').classList.add('quality-event-card');
    $('event-eyebrow').textContent='QUALITÄTSPRÜFUNG · NACHARBEIT';
    $('event-title').textContent=`Endkontrolle findet Maßfehler bei ${order.part}`;
    $('event-detail').textContent=`${event.defectParts} von ${order.qty} Teilen liegen außerhalb der ${programmingQuality.toleranceClass(order)}-Toleranz. Die Prüfung hat den Fehler vor der Auslieferung entdeckt.`;
    $('event-consequence').textContent=`Maschinenzustand ${Math.round(machine?.maintenance||0)} % · Werkzeug ${Math.round(machine?.tool||0)} % · geschätztes Fehlerrisiko vor Fertigung ${event.riskPct} %. Nacharbeit verlängert den Auftrag und kostet Material sowie Prüfzeit.`;
    const timing=$('event-order-timing');timing.hidden=false;
    $('event-order-deadline-label').textContent='LIEFERFRIST';
    $('event-order-processing-label').textContent='NACHARBEIT';
    const deadline=Number.isFinite(machine?.deadlineAt)?machine.deadlineAt-state.gameMinutes:null;
    $('event-order-deadline-cell').classList.toggle('deadline-overdue',deadline!==null&&deadline<0);
    $('event-order-deadline').textContent=deadline===null?'Keine Frist':deadline<0?`${formatMinutes(-deadline)} überfällig`:`Noch ${formatMinutes(deadline)}`;
    $('event-order-processing').textContent=`${formatMinutes(replacementWorkMinutes(order,event.defectParts,machine))} zusätzliche Maschinenzeit`;
    const actions=$('event-actions');actions.replaceChildren();
    addQualityChoice('Nacharbeiten & neu fertigen',`${event.defectParts} Ersatzteile · ${euro(reworkCost)} · ohne Kundenreklamation`,()=>resolveQualityIssue(event,'rework'),reworkCost);
    addQualityChoice('Trotz Fehler ausliefern','10 % Preisabzug · Kunde kann später reklamieren',()=>resolveQualityIssue(event,'ship'),0,true);
    $('event-count').textContent='Das Spiel ist pausiert, bis du die geprüften Teile freigibst oder nacharbeiten lässt.';
  }
  function renderQualityComplaintEvent(event){
    const order=event.order,machine=findQualityReworkMachine(order),work=machine?replacementWorkMinutes(order,event.defectParts||1,machine):0;
    const reworkCost=Number.isFinite(event.reworkCost)?event.reworkCost:Math.max(400,Math.round(order.reward*.18));
    event.reworkCost=reworkCost;event.reworkBay=machine?.bay??null;event.reworkMinutes=work;
    $('event-window').querySelector('.event-card').classList.add('quality-event-card');
    $('event-eyebrow').textContent='KUNDENREKLAMATION';
    $('event-title').textContent=`${event.customer} reklamiert ${order.part}`;
    $('event-detail').textContent=`Die fehlerhaften Teile wurden ausgeliefert. ${event.defectParts||1} Teil${event.defectParts===1?'':'e'} müssen ersetzt oder gutgeschrieben werden.`;
    $('event-consequence').textContent='Die Simulation ist pausiert. Eine Ersatzcharge erhält die Kundenbeziehung eher, kostet aber Maschinenzeit und Material.';
    $('event-order-timing').hidden=true;
    const actions=$('event-actions');actions.replaceChildren();
    const rework=addQualityChoice('Ersatzcharge nacharbeiten',machine?`Platz ${machine.bay} · ${formatMinutes(work)} · ${euro(reworkCost)}`:'Keine passende einsatzbereite Maschine',()=>resolveQualityComplaint(event,'rework'),reworkCost);
    rework.disabled=!machine||reworkCost>state.money+1e-9;
    addQualityChoice('Gutschrift anbieten',`${euro(Math.max(400,Math.round(order.reward*.35)))} · Vertrauen −4`,()=>resolveQualityComplaint(event,'credit'),Math.max(400,Math.round(order.reward*.35)),true);
    addQualityChoice('Reklamation ablehnen','Keine Sofortkosten · Vertrauen −18',()=>resolveQualityComplaint(event,'reject'),0,true);
    $('event-count').textContent='Wähle, wie du den Kundenfall löst.';
  }
  function shiftLeaderEventAdvice(event){
    if(!event)return '';
    const leader=shiftLeaderFor(event.event==='robot_failure'?2:shiftAt(state.gameMinutes));
    if(!leader?.hired)return '';
    if(event.event==='robot_failure')return leader.autoBreakdowns?'Schichtleiter S2 übernimmt die Roboterstörung automatisch, sofern die Reparatur innerhalb des Ausgabenlimits liegt.':'Schichtleiter S2 ist für automatische Störungsbehandlung deaktiviert.';
    if(event.event==='warning'||event.event==='major_failure'){
      const options=breakdownSystem.getRepairOptions(state,event.bay);
      if(!options)return '';
      const selfChance=Number(options.self.failureChance);
      const preferSelf=!event.selfRepairFailed&&Number.isFinite(selfChance)&&selfChance>=.75&&
        options.self.cost<=options.technician.cost&&options.self.downtime<options.technician.downtime;
      if(preferSelf)return 'Schichtleiter empfiehlt Selbstreparatur: '+Math.round(selfChance*100)+' % Erfolgschance, geringere Kosten und kürzerer Stillstand als beim Monteur.';
      return event.selfRepairFailed
        ?'Schichtleiter empfiehlt den Monteur: Der Selbstversuch ist für diese Störung gesperrt.'
        :'Schichtleiter empfiehlt den Monteur: Die Selbstreparatur ist bei diesem Risiko die unsicherere Wahl.';
    }
    if(event.event==='quality_issue'){
      const machine=machineAt(event.bay),order=event.order;
      if(!machine||!order)return '';
      const cost=Number.isFinite(event.reworkCost)?event.reworkCost:Math.max(250,Math.round(order.reward*(event.defectParts||1)/Math.max(1,order.qty)*.55));
      const extra=replacementWorkMinutes(order,event.defectParts||1,machine);
      if(state.money<cost)return 'Schichtleiter: Nacharbeit schützt vor fehlerhafter Auslieferung, ist mit '+euro(cost)+' aktuell aber nicht finanzierbar.';
      const deadlineLeft=Number.isFinite(machine.deadlineAt)?machine.deadlineAt-state.gameMinutes:null;
      const buffer=deadlineLeft===null?null:deadlineLeft-extra;
      const timing=buffer===null?'Frist nicht berechenbar.':buffer>=0?'Danach bleiben voraussichtlich '+formatEstimateMinutes(buffer)+' Fristpuffer.':'Nacharbeit würde den Auftrag voraussichtlich um '+formatEstimateMinutes(-buffer)+' weiter verspäten.';
      return 'Schichtleiter empfiehlt Nacharbeit: '+euro(cost)+' und '+formatMinutes(extra)+' Zusatzzeit; '+timing;
    }
    if(event.event==='quality_complaint'){
      const order=event.order,machine=findQualityReworkMachine(order);
      const cost=Number.isFinite(event.reworkCost)?event.reworkCost:Math.max(400,Math.round(order.reward*.18));
      if(machine&&state.money>=cost){
        const extra=replacementWorkMinutes(order,event.defectParts||1,machine);
        return 'Schichtleiter empfiehlt eine Ersatzcharge: Sie schützt die Kundenbeziehung, kostet '+euro(cost)+' und etwa '+formatMinutes(extra)+' Maschinenzeit.';
      }
      return 'Schichtleiter empfiehlt eine Gutschrift, da aktuell keine finanzierbare Ersatzcharge mit passender Maschine verfügbar ist.';
    }
    return '';
  }
  function renderRobotFailureEvent(event){
    const machine=machineAt(event.bay),card=$('event-window').querySelector('.event-card');
    card.classList.remove('rush-event-card','quality-event-card');
    $('event-eyebrow').textContent='ROBOTERSTÖRUNG';
    $('event-title').textContent='Laderoboter ausgefallen · Platz '+event.bay;
    $('event-detail').textContent='Der Roboter kann die Spätschicht vorerst nicht bedienen. Entscheide zwischen einem kostenlosen Neustart und einer schnelleren Reparatur durch den Servicetechniker.';
    const activeOrder=machine&&job(machine),effects=[];
    if(activeOrder)effects.push('Laufender Auftrag: '+activeOrder.part+' · '+machine.produced+'/'+activeOrder.qty+' Teile');
    effects.push('Der Roboter bleibt bis zum Abschluss der Reparatur außer Betrieb.');
    $('event-consequence').textContent=effects.join(' · ');
    const timing=$('event-order-timing'),deadlineLeft=machine&&Number.isFinite(machine.deadlineAt)?machine.deadlineAt-state.gameMinutes:null;
    timing.hidden=!activeOrder;
    if(activeOrder){
      $('event-order-deadline-label').textContent='AUFTRAGSFRIST';
      $('event-order-processing-label').textContent='BEARBEITUNG NOCH';
      $('event-order-deadline-cell').classList.toggle('deadline-overdue',deadlineLeft!==null&&deadlineLeft<0);
      $('event-order-deadline').textContent=deadlineLeft===null?'Keine Frist':deadlineLeft<0?formatMinutes(-deadlineLeft)+' überfällig':'Noch '+formatMinutes(deadlineLeft);
      $('event-order-processing').textContent='Noch '+formatMinutes(remainingMinutes(machine,activeOrder));
    }
    const actions=$('event-actions');actions.replaceChildren();
    const addChoice=(label,detail,method,cost=0)=>{
      const button=document.createElement('button'),small=document.createElement('small');
      button.type='button';button.className='action event-choice';
      button.append(document.createTextNode(label));small.textContent=detail;button.append(small);
      button.disabled=cost>state.money;
      button.addEventListener('click',()=>resolveRobotFailureEvent(event,method,false));
      actions.append(button);
    };
    addChoice('Neustart & neu ausrichten','Keine Sofortkosten · '+formatMinutes(ROBOT_RESTART_MINUTES[0])+'–'+formatMinutes(ROBOT_RESTART_MINUTES[1]),'restart');
    addChoice('Servicetechniker rufen',euro(ROBOT_TECHNICIAN_COST)+' · '+formatMinutes(ROBOT_TECHNICIAN_MINUTES[0])+'–'+formatMinutes(ROBOT_TECHNICIAN_MINUTES[1])+' · zuverlässig','technician',ROBOT_TECHNICIAN_COST);
    $('event-count').textContent='Das Spiel ist pausiert, bis du den Roboter wieder einsatzbereit machst.';
  }
  function renderEventWindow(){
    const overlay=$('event-window');
    if(!overlay)return;
    const capacityPanel=$('rush-capacity-check');
    if(capacityPanel)capacityPanel.hidden=true;
    const event=state.eventQueue[0];overlay.hidden=!event;
    if(!event)return;
    const managerAdvice=$('shift-leader-event-advice'),advice=shiftLeaderEventAdvice(event);
    if(managerAdvice){managerAdvice.textContent=advice;managerAdvice.hidden=!advice;}
    try{
      if(event.event==='rush_order'){
        renderRushOrderEvent(event);
        return;
      }
      $('event-window').querySelector('.event-card').classList.remove('rush-event-card');
      if(event.event==='quality_issue'){
        renderQualityIssueEvent(event);
        return;
      }
      if(event.event==='quality_complaint'){
        renderQualityComplaintEvent(event);
        return;
      }
      if(event.event==='robot_failure'){
        renderRobotFailureEvent(event);
        return;
      }
    $('event-window').querySelector('.event-card').classList.remove('quality-event-card');
    $('event-order-deadline-label').textContent='AUFTRAGSFRIST';
    $('event-order-processing-label').textContent='BEARBEITUNG NOCH';
    const machine=machineAt(event.bay),warning=event.event==='warning',selfRepairFailed=event.selfRepairFailed===true;
    const fault=breakdownSystem.getFaultInfo(event.fault),options=breakdownSystem.getRepairOptions(state,event.bay);
    $('event-eyebrow').textContent=selfRepairFailed?'SELBSTREPARATUR GESCHEITERT':event.sudden?'PLÖTZLICHER MASCHINENCRASH':warning?'MASCHINENWARNUNG':'SCHWERER MASCHINENSCHADEN';
    $('event-title').textContent=`${fault?.label||'Maschinenstörung'} · Platz ${event.bay}`;
    $('event-detail').textContent=selfRepairFailed
      ?'Der Selbstversuch ist fehlgeschlagen. Ein weiterer Selbstversuch ist für diese Störung gesperrt; beauftrage einen Monteur oder entscheide später.'
      :event.sudden
      ?'Die Maschine ist ohne vorherige Warnung ausgefallen. Die Produktion auf diesem Platz steht.'
      :warning?'Die Maschine meldet eine Störung. Entscheide jetzt, wie der Betrieb weitergeht.':'Ein schwerer Maschinenschaden hat die Produktion gestoppt.';
    const effects=[];
    const activeOrder=machine&&job(machine);
    if(activeOrder)effects.push(`Laufender Auftrag: ${activeOrder.part} · ${machine.produced}/${activeOrder.qty} Teile`);
    if(event.scrapParts)effects.push(`${event.scrapParts} Teil${event.scrapParts===1?'':'e'} Ausschuss`);
    if(event.cost)effects.push(`Schadenskosten bereits gebucht: ${euro(event.cost)}`);
    if(event.downtime)effects.push(`Grundausfallzeit: ${formatMinutes(event.downtime)}`);
    $('event-consequence').textContent=effects.length?effects.join(' · '):'Die Maschine bleibt bis zur Entscheidung angehalten.';
    const timing=$('event-order-timing'),deadlineLeft=machine&&Number.isFinite(machine.deadlineAt)?machine.deadlineAt-state.gameMinutes:null;
    timing.hidden=!activeOrder;
    if(activeOrder){
      $('event-order-deadline-cell').classList.toggle('deadline-overdue',deadlineLeft!==null&&deadlineLeft<0);
      $('event-order-deadline').textContent=deadlineLeft===null?'Keine Frist':deadlineLeft<0?`${formatMinutes(-deadlineLeft)} überfällig`:`Noch ${formatMinutes(deadlineLeft)}`;
      $('event-order-processing').textContent=`Noch ${formatMinutes(remainingMinutes(machine,activeOrder))}`;
    }
    const actions=$('event-actions');actions.replaceChildren();
    const addChoice=(label,detailText,action,cost=0,risky=false)=>{
      const button=document.createElement('button'),small=document.createElement('small');
      button.type='button';button.className='action event-choice'+(risky?' event-risk':'');
      button.append(document.createTextNode(label));small.textContent=detailText;button.append(small);
      button.disabled=cost>state.money;button.addEventListener('click',()=>chooseBreakdown(action,event.bay,event.id));actions.append(button);
    };
    if(options){
      const selfDuration=options.self.downtime>options.technician.downtime?' · langsamer als Monteur':'';
      const selfRange=options.self.failureRange;
      const selfRisk=selfRange?`${Math.round(selfRange.min*100)}–${Math.round(selfRange.max*100)}% Fehlerrisiko`:`${Math.round(options.self.failureChance*100)}% Fehlerrisiko`;
      if(!selfRepairFailed)addChoice('Selbst reparieren',`${euro(options.self.cost)} · ${formatMinutes(options.self.downtime)} bei Erfolg · ${selfRisk}${selfDuration}`, 'repairSelf',options.self.cost);
      addChoice('Monteur beauftragen',`${euro(options.technician.cost)} · ${formatMinutes(options.technician.downtime)} · verlässlich`, 'repairTechnician',options.technician.cost);
      if(warning){
        if(!selfRepairFailed)addChoice('Riskant weiterproduzieren','Keine Sofortkosten · höheres Crash- und Ausschussrisiko','continueRisky');
      }
    }
    const defer=document.createElement('button');defer.type='button';defer.className='action event-choice';
    defer.textContent='Später entscheiden';
    const deferHint=document.createElement('small');deferHint.textContent='Diese Maschine bleibt stehen.';defer.append(deferHint);
    defer.addEventListener('click',()=>resolveEventWithoutAction());actions.append(defer);
      $('event-count').textContent=state.eventQueue.length>1?`Ereignis 1 von ${state.eventQueue.length} · Das Spiel ist pausiert.`:'Das Spiel ist pausiert, bis du eine Entscheidung triffst.';
    }catch(error){
      console.error('Ereignisfenster konnte nicht dargestellt werden.',error);
      const card=overlay.querySelector('.event-card');
      if(!card)return;
      card.classList.remove('rush-event-card','quality-event-card');
      $('event-eyebrow').textContent='SPIELMELDUNG';
      $('event-title').textContent='Diese Meldung konnte nicht geladen werden';
      $('event-detail').textContent='Der Spielstand bleibt erhalten. Schließe die fehlerhafte Meldung, um fortzufahren.';
      $('event-consequence').textContent='Falls eine Maschine gestört ist, bleibt sie stehen und kann anschließend im Maschinenmenü repariert werden.';
      $('event-order-timing').hidden=true;
      const actions=$('event-actions');actions.replaceChildren();
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='action event-choice';
      dismiss.textContent='Meldung schließen & fortfahren';
      dismiss.addEventListener('click',()=>dismissUnrenderableEvent(event));
      actions.append(dismiss);
      $('event-count').textContent='Das betroffene Ereignis wird beim Schließen verworfen.';
      state.paused=true;
    }
  }
  function dismissUnrenderableEvent(event){
    const index=state.eventQueue.findIndex(item=>item.id===event?.id);
    if(index<0)return false;
    const [discarded]=state.eventQueue.splice(index,1);
    if(discarded.event==='rush_order'&&discarded.order)orderMarketSystem.recordRushDecision(state,discarded.order,false);
    state.paused=state.eventQueue.length>0;
    save();render();
    if(discarded.event==='quality_issue'){
      const machine=machineAt(discarded.bay),order=machine&&job(machine);
      if(machine&&order&&order.id===discarded.order?.id&&Number.isInteger(discarded.defectParts)&&discarded.defectParts>0){
        finishOrder(machine,order,{defectParts:discarded.defectParts,riskPct:discarded.riskPct},state.gameMinutes);
        say('Die fehlerhafte Meldung wurde geschlossen; die betroffenen Teile wurden mit dem üblichen Preisabschlag ausgeliefert.');
        return true;
      }
    }
    say('Die Meldung wurde geschlossen. Der Spielstand bleibt erhalten; eine betroffene Maschine kann im Maschinenmenü geprüft werden.');
    return true;
  }
  function resolveEventWithoutAction(){
    state.eventQueue.shift();state.paused=state.eventQueue.length>0;save();render();
  }
  function resolveRushOrderEvent(event,accepted,targetBay=null,interrupt=false){
    if(!state.eventQueue.some(item=>item.id===event.id))return false;
    let offer=event.order,materialPurchaseAssignment=null;
    if(accepted){
      if(Number.isInteger(targetBay)){
        const machine=machineAt(targetBay),reason=machine&&rushAssignmentBlockReason(machine,offer,interrupt,true);
        if(!machine||reason||!plannedMachineLoad(machine).shifts.length){
          say(reason||'Für diese Maschine ist keine besetzte Schicht geplant.');return false;
        }
      }
      offer={...offer,acceptedRushAt:state.gameMinutes,
        deadlineAt:state.gameMinutes+offer.deadlineHours*60};
      offer.expiresAt=Math.max(offer.expiresAt,offer.deadlineAt+24*60);
      offer.offerLifetimeMinutes=offer.expiresAt-offer.createdAt;
      const added=orderMarketSystem.acceptRushOffer(state,offer);
      if(!added){say('Der Eilauftrag konnte nicht angenommen werden. Die Auftragsbörse ist voll.');return false;}
      offer=added;
      orderMarketSystem.recordRushDecision(state,offer,true);
      if(Number.isInteger(targetBay)){
        const shortage=Math.max(0,materialSystem.requiredKg(offer)-materialSystem.available(state,offer));
        if(shortage>1e-9)materialPurchaseAssignment={orderId:offer.id,bay:targetBay,interrupt:!!interrupt};
      }
    }else{
      orderMarketSystem.recordRushDecision(state,offer,false);
    }
    const index=state.eventQueue.findIndex(item=>item.id===event.id);
    if(index>=0)state.eventQueue.splice(index,1);
    state.paused=state.eventQueue.length>0;
    if(materialPurchaseAssignment){
      state.pendingRushAssignment=materialPurchaseAssignment;
      state.selected=offer.id;
      state.warehouseOrderSnapshot={...offer};
      state.selectedMaterialType=materialSystem.typeForOrder(offer)||state.selectedMaterialType;
    }
    save();render();
    if(accepted){
      if(materialPurchaseAssignment){
        const shortage=Math.max(0,materialSystem.requiredKg(offer)-materialSystem.available(state,offer));
        tab('warehouse');
        say('Eilauftrag zugesagt: '+offer.part+' · Es fehlen '+Math.ceil(shortage)+' kg '+offer.material+'. Nach dem Kauf wird er '+(interrupt?'gestartet und der laufende Auftrag unterbrochen':'auf Platz '+targetBay+' eingeplant')+'.');
        return true;
      }
      if(Number.isInteger(targetBay)){
        startOrder(offer.id,targetBay,{rushEvent:true,interrupt});
        return true;
      }
      if(state.eventQueue.length)return true;
      const shortage=Math.max(0,materialSystem.requiredKg(offer)-materialSystem.available(state,offer));
      if(shortage>1e-9){
        state.selected=offer.id;
        state.warehouseOrderSnapshot={...offer};
        state.selectedMaterialType=materialSystem.typeForOrder(offer)||state.selectedMaterialType;
        save();tab('warehouse');
        say(`Eilauftrag zugesagt: ${offer.part} · Es fehlen ${Math.ceil(shortage)} kg ${offer.material}.`);
      }else{
        tab('orders');openOrderMachineChooser(offer.id);
        say(`Eilauftrag zugesagt: ${offer.part} · Lieferfrist ${offer.deadlineHours} h · ${euro(offer.rushBonus)} Zuschlag.`);
      }
    }else{
      say(`Eilauftrag von ${offer.customer} abgelehnt. Kundenzufriedenheit −10.`);
    }
    return true;
  }
  function findQualityReworkMachine(order){
    return state.machines.filter(machine=>{
      if(!compatible(machine,order)||machine.maintenance<8||machine.tool<1||machine.maintenanceRemainingMinutes>0||machine.qualityReworkQueue.length>=3)return false;
      const fault=breakdownSystem.getRecord(state,machine.bay);
      return !(fault?.fault&&(fault.status==='major_failure'||fault.status==='repairing'||
        (fault.status==='warning'&&!fault.riskyContinue&&!fault.scheduledRepair)));
    }).sort((a,b)=>plannedMachineLoad(a).plannedMinutes-plannedMachineLoad(b).plannedMinutes||a.bay-b.bay)[0]||null;
  }
  function replacementWorkMinutes(order,parts,machine){
    const qty=Math.max(1,Number(order?.qty)||1),count=Math.max(1,Number(parts)||1);
    const rate=machine?catalog[machine.type].rate:order?.kind==='Fräsen'?catalog.mill3.rate:catalog.standard.rate;
    const output=Math.max(30,Number(order?.duration)||30)*6*count/qty/Math.max(.5,rate);
    return Math.min(360,Math.max(60,Math.ceil((45+output)/15)*15));
  }
  function removeEvent(event){
    const index=state.eventQueue.findIndex(item=>item.id===event.id);
    if(index>=0)state.eventQueue.splice(index,1);
    state.paused=state.eventQueue.length>0;
  }
  function resolveQualityIssue(event,decision){
    if(!state.eventQueue.some(item=>item.id===event.id))return false;
    const machine=machineAt(event.bay),order=machine&&job(machine);
    if(!machine||!order||order.id!==event.order.id)return false;
    if(decision==='rework'){
      const cost=event.reworkCost;
      if(state.money<cost||!book('quality',-cost,`Nacharbeit ${order.part}`,{orderId:order.id,bay:machine.bay,defectParts:event.defectParts}).ok)return false;
      const quantity=Math.max(1,order.qty),remaining=Math.max(0,quantity-event.defectParts);
      machine.progress=remaining/quantity*100;
      machine.produced=remaining;
      machine.setupPartProduced=true;machine.setupRemainingMinutes=0;machine.setupDurationMinutes=0;machine.setupDelayMinutes=0;
      machine.qualityInspectedOrderId=order.id;
      removeEvent(event);save();renderOrders();renderBusiness();render();
      say(`Qualitätsprüfung: ${event.defectParts} fehlerhafte Teile werden auf Platz ${machine.bay} für ${euro(cost)} nachgefertigt.`);
      return true;
    }
    if(decision!=='ship')return false;
    removeEvent(event);
    finishOrder(machine,order,{defectParts:event.defectParts,riskPct:event.riskPct});
    say(`${event.defectParts} fehlerhafte Teile ausgeliefert · Preisnachlass 10 % · mögliche Reklamation nach 12 Spielstunden.`);
    return true;
  }
  function resolveQualityComplaint(event,decision){
    if(!state.eventQueue.some(item=>item.id===event.id))return false;
    const order=event.order,customer=event.customer;
    if(decision==='rework'){
      const machine=findQualityReworkMachine(order),cost=event.reworkCost;
      if(!machine||state.money<cost||machine.qualityReworkQueue.length>=3)return false;
      if(!book('quality',-cost,`Ersatzcharge nach Reklamation · ${order.part}`,{orderId:order.id,bay:machine.bay,customer,defectParts:event.defectParts}).ok)return false;
      machine.qualityReworkQueue.push({id:event.id,order:{...order},customer,remainingMinutes:event.reworkMinutes,totalMinutes:event.reworkMinutes});
      orderMarketSystem.adjustReputation(state,customer,-2);
      removeEvent(event);save();renderOrders();renderBusiness();render();
      say(`Reklamation angenommen: Ersatzcharge für ${customer} auf Platz ${machine.bay} eingeplant (${formatMinutes(event.reworkMinutes)} · ${euro(cost)}).`);
      return true;
    }
    if(decision==='credit'){
      const cost=Math.max(400,Math.round(order.reward*.35));
      if(state.money<cost||!book('quality',-cost,`Gutschrift nach Reklamation · ${order.part}`,{orderId:order.id,customer}).ok)return false;
      orderMarketSystem.adjustReputation(state,customer,-4);
      removeEvent(event);save();renderOrders();render();say(`Gutschrift über ${euro(cost)} an ${customer} gezahlt. Kundenvertrauen −4.`);return true;
    }
    if(decision==='reject'){
      orderMarketSystem.adjustReputation(state,customer,-18);
      removeEvent(event);save();renderOrders();render();say(`Reklamation von ${customer} abgelehnt. Kundenvertrauen −18.`);return true;
    }
    return false;
  }
  function queueDueQualityComplaints(){
    const pending=state.pendingQualityComplaints||[],remaining=[];
    for(const complaint of pending){
      if(complaint.dueAt>state.gameMinutes){remaining.push(complaint);continue;}
      state.eventQueue.push({event:'quality_complaint',id:complaint.id,order:complaint.order,customer:complaint.customer,
        bay:complaint.bay,defectParts:complaint.defectParts,dueAt:complaint.dueAt});
    }
    state.pendingQualityComplaints=remaining;
    if(state.eventQueue.some(event=>event.event==='quality_complaint')){state.paused=true;renderEventWindow();save();return true;}
    return false;
  }
  function finishOrder(machine,order,quality=null,completedAt=state.gameMinutes){
    const late=machine.deadlineAt!==null&&completedAt>machine.deadlineAt;
    const qualityDiscount=quality?.defectParts?0.9:1;
    const payout=Math.round(order.reward*(late ? .8 : 1)*qualityDiscount);
    if(!book('income',payout,`Auftrag ${order.id} abgeschlossen`,{orderId:order.id,bay:machine.bay,late,qualityDefectParts:quality?.defectParts||0},null,completedAt).ok)return false;
    if(machine.activeOrderSource==='market'){
      orderMarketSystem.tick(state,completedAt);
      orderMarketSystem.onCompleted(state,order,{late});
    }
    if(quality?.defectParts){
      const id=`quality_complaint:${order.id}`;
      if(!state.pendingQualityComplaints.some(item=>item.id===id))state.pendingQualityComplaints.push({id,dueAt:completedAt+12*60,
        order:{...order},customer:order.customer,bay:machine.bay,defectParts:quality.defectParts,riskPct:quality.riskPct});
    }
    state.completed++;
    const interrupted=machine.suspendedOrder&&order?.isRushOrder?machine.suspendedOrder:null;
    machine.activeId=null;machine.activeOrder=null;machine.activeOrderSource=null;machine.progress=0;machine.produced=0;machine.deadlineAt=null;
    machine.setupDurationMinutes=0;machine.setupRemainingMinutes=0;machine.setupDelayMinutes=0;machine.setupPartProduced=false;
    machine.ncProgramPending=false;machine.qualityInspectedOrderId=null;
    let resumedSetup=null,resumed=false;
    if(interrupted){
      const saved=interrupted,restoredOrder=saved.order,alreadyProduced=!!saved.setupPartProduced||Number(saved.produced)>0;
      machine.suspendedOrder=null;machine.activeId=restoredOrder.id;machine.activeOrder=restoredOrder;
      machine.activeOrderSource=saved.source||'market';machine.deadlineAt=saved.deadlineAt;
      machine.progress=alreadyProduced?Math.max(0,Number(saved.progress)||0):0;
      machine.produced=Math.max(0,Number(saved.produced)||0);machine.setupPartProduced=alreadyProduced;
      machine.qualityInspectedOrderId=saved.qualityInspectedOrderId||null;
      machine.ncProgramPending=!programReady(restoredOrder)||!!saved.ncProgramPending;
      if(!machine.ncProgramPending){
        resumedSetup=beginMachineSetup(machine,restoredOrder);
        machine.progress=alreadyProduced?Math.max(0,Number(saved.progress)||0):0;
        machine.produced=Math.max(0,Number(saved.produced)||0);machine.setupPartProduced=alreadyProduced;
      }else scheduleActiveOrderProgramming(machine,restoredOrder);
      reassessActiveProgrammingRoutes();resumed=true;
    }
    const next=resumed||machine.qualityReworkQueue.length?null:machine.orderQueue.shift();
    let nextSetup=null;
    if(next){
      machine.activeId=next.order.id;machine.activeOrder=next.order;machine.activeOrderSource='market';machine.deadlineAt=next.deadlineAt;
      machine.progress=0;machine.produced=0;machine.ncProgramPending=!programReady(next.order);
      if(programReady(next.order))nextSetup=beginMachineSetup(machine,next.order);else scheduleActiveOrderProgramming(machine,next.order);
      reassessActiveProgrammingRoutes();
    }
    save();renderOrders();renderBusiness();
    say(`${catalog[machine.type].name}: ${order.part} fertig · ${euro(payout)}${late?' (20 % Fristabzug)':''}${quality?.defectParts?' (10 % Qualitätsabzug)':''}${resumed?` · ${machine.activeOrder.part} fortgesetzt · neue Rüstzeit ${formatMinutes(resumedSetup?.totalMinutes||0)}`:''}${next?` · Nächster Auftrag gestartet${nextSetup?` · Rüstzeit ${formatMinutes(nextSetup.totalMinutes)}`:''}`:''}`);
    return true;
  }
  function startNextQueuedOrder(machine){
    if(job(machine)||machine.qualityReworkQueue.length||!machine.orderQueue.length)return false;
    const next=machine.orderQueue.shift();
    machine.activeId=next.order.id;machine.activeOrder=next.order;machine.activeOrderSource='market';machine.deadlineAt=next.deadlineAt;
    machine.progress=0;machine.produced=0;machine.qualityInspectedOrderId=null;machine.ncProgramPending=!programReady(next.order);
    if(programReady(next.order))beginMachineSetup(machine,next.order);else scheduleActiveOrderProgramming(machine,next.order);
    reassessActiveProgrammingRoutes();
    save();renderOrders();return true;
  }
  function processQualityRework(machine,step,shift){
    const task=machine.qualityReworkQueue[0];
    if(!task||state.paused||!shift||!machine['operator'+shift]||!assignedEmployee(machine,shift)||
      machine.maintenanceRemainingMinutes>0||machine.maintenance<8||machine.tool<1||
      !breakdownSystem.canContinueProduction(state,machine.bay))return false;
    const power=MACHINE_POWER_COST_PER_HOUR*step/60,dateKey=gameDateKey();
    book('energy',-power,'Stromkosten Qualitätsnacharbeit',{bay:machine.bay,dateKey},`daily:energy:${dateKey}`);
    state.energyPaid+=power;
    task.remainingMinutes=Math.max(0,task.remainingMinutes-step);
    if(task.remainingMinutes>1e-8)return true;
    machine.qualityReworkQueue.shift();
    orderMarketSystem.adjustReputation(state,task.customer,3);
    say(`Ersatzcharge ${task.order.part} auf Platz ${machine.bay} fertig · Kundenvertrauen +3.`);
    save();renderOrders();renderBusiness();
    return true;
  }
  function statusFor(m){
    if(!m)return 'Freier Stellplatz';
    if(state.paused)return 'Pausiert';
    if(m.maintenanceRemainingMinutes>0)return `Wartung läuft · ${formatMinutes(m.maintenanceRemainingMinutes)}`;
    const fault=breakdownSystem.getRecord(state,m.bay);
    if(fault?.status==='major_failure')return 'Schwerer Maschinenschaden';
    if(fault?.status==='repairing')return `Reparatur · ${formatMinutes(fault.repairRemainingMinutes)}`;
    if(fault?.status==='warning'&&!fault.riskyContinue&&!fault.scheduledRepair)return 'Störung · Entscheidung nötig';
    if(fault?.status==='warning')return fault.scheduledRepair?'Reparatur vorgemerkt':'Riskanter Betrieb';
    if(m.maintenance<8)return 'Wartung fällig';
    if(m.tool<1)return 'Werkzeug verschlissen';
    if(!job(m)&&m.qualityReworkQueue.length)return `Ersatzcharge · ${formatMinutes(m.qualityReworkQueue[0].remainingMinutes)}`;
    if(!job(m))return 'Bereit';
    if(m.operatorProgramming)return `Bediener programmiert · ${formatMinutes(m.operatorProgramming.remainingMinutes)}`;
    if(!programReady(job(m))){const task=programTaskFor(programKey(job(m)));return task?`NC-Programmierung · ${formatMinutes(programmingETA(job(m),m))}`:'NC-Programm fehlt';}
    const shift=shiftAt(state.gameMinutes);
    if(!shift)return 'Betrieb geschlossen';
    if(shift===2&&m.loadingRobot&&!robotAvailable(m))return m.robotRepairRemainingMinutes>0?'Laderoboter wird repariert · '+formatMinutes(m.robotRepairRemainingMinutes):'Laderoboter ausgefallen';
    if(!m['operator'+shift]&&!(shift===2&&m.loadingRobot))return `Kein Bediener Schicht ${shift}`;
    if(m.setupRemainingMinutes>0)return `${m.setupDelayMinutes?'Rüstproblem · ':''}Rüstzeit · ${formatMinutes(m.setupRemainingMinutes)}`;
    return 'Produktion läuft';
  }
  function setBusinessSection(name){
    if(!['factory','staff','finance'].includes(name))return;
    businessSection=name;
    $('drawer-body').scrollTop=0;
    for(const section of ['factory','staff','finance']){
      const active=section===name;
      const button=document.querySelector(`[data-business-section="${section}"]`);
      if(button)button.setAttribute('aria-pressed',String(active));
      const panel=$(`business-${section}-section`);
      if(panel)panel.hidden=!active;
    }
  }
  function tab(name){
    if(name!=='orders'&&pendingOrderAssignmentId)closeOrderMachineChooser();
    currentPanel=name;
    $('drawer-body').scrollTop=0;
    $('drawer').classList.toggle('warehouse-focus',name==='warehouse'&&!!state.warehouseOrderSnapshot);
    $('drawer').hidden=false;
    $('scrim').hidden=false;
    $('drawer-title').textContent={orders:'Aufträge',machine:'Maschine',business:'Betrieb',recruitment:'Bewerberbörse',warehouse:'Materiallager'}[name];
    if(name==='business')setBusinessSection(businessSection);
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
    if(name==='warehouse')renderWarehouseOrderContext();
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
    const progress=order?orderProgressPercent(machine,order):0;
    $('hall-preview-job').textContent=order?`${order.part} · ${machine.produced}/${order.qty} Teile · ${machine.setupRemainingMinutes>0?'Rüstphase':`${Math.floor(progress)} %`}`:'Kein laufender Auftrag';
    $('hall-preview-progress').hidden=!order;
    for(const [name,value] of [['progress',progress],['tool',machine.tool],['maintenance',machine.maintenance]]){
      const fill=$(`hall-preview-${name}-fill`);
      fill.style.width=Math.max(0,Math.min(100,value))+'%';
      fill.className='preview-meter-fill '+(name==='progress'?'progress':value<=15?'low':value<=40?'medium':'good');
      $(`hall-preview-${name}-bar`).setAttribute('aria-valuenow',String(Math.max(0,Math.min(100,Math.round(value)))));
    }
    const deadlineLeft=order&&Number.isFinite(machine.deadlineAt)?machine.deadlineAt-state.gameMinutes:null;
    $('hall-preview-time').hidden=!order;
    $('hall-preview-time').textContent=order?`Rest ${formatMinutes(remainingMinutes(machine,order))}${deadlineLeft===null?'':` · Frist ${deadlineLeft<0?`${formatMinutes(-deadlineLeft)} überfällig`:formatMinutes(deadlineLeft)}`}`:'';
    $('hall-preview-condition').textContent=`Werkzeug ${conditionLabel(machine.tool)} · Wartung ${Math.round(machine.maintenance)} %${machine.maintenanceRemainingMinutes>0?` · Wartung läuft ${formatMinutes(machine.maintenanceRemainingMinutes)}`:''} · Geplant ${machine.orderQueue.length}/${MAX_QUEUED_ORDERS}`;
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
  let lastOrdersRenderKey='';
  function ordersRenderKey(){
    const offers=orderMarketSystem.getAvailable(state);
    const marketDay=Math.floor(state.gameMinutes/1440);
    return [offers.map(o=>o.id).join(','),JSON.stringify(state.inventory.rawMaterial),marketDay,Object.keys(state.ncPrograms||{}).sort().join(',')].join('::');
  }
  let pendingOrderAssignmentId=null;
  function renderMachineLoadCard(machine){
    const card=document.createElement('section');
    const head=document.createElement('div'),title=document.createElement('strong'),value=document.createElement('span');
    const bar=document.createElement('div'),fill=document.createElement('span'),meta=document.createElement('p');
    card.dataset.bay=String(machine.bay);
    card.className='machine-load-card';
    head.className='machine-load-head';
    title.textContent=`Platz ${machine.bay} · ${catalog[machine.type].name}`;
    value.className='machine-load-value';
    head.append(title,value);
    bar.className='machine-load-bar';bar.setAttribute('role','progressbar');
    bar.setAttribute('aria-label',`Theoretische Fristauslastung Platz ${machine.bay}`);
    bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.append(fill);
    meta.className='machine-load-meta';card.append(head,bar,meta);
    updateMachineLoadCard(card,machine);return card;
  }
  function updateMachineLoadCard(card,machine){
    const load=plannedMachineLoad(machine),rounded=load.percent===null?null:Math.round(load.percent);
    const value=card.querySelector('.machine-load-value'),bar=card.querySelector('.machine-load-bar'),fill=bar?.firstElementChild,meta=card.querySelector('.machine-load-meta');
    card.classList.toggle('overloaded',rounded!==null&&rounded>100);
    value.textContent=rounded===null?'—':Number.isFinite(rounded)?`${rounded} %`:'∞ %';
    bar.setAttribute('aria-valuenow',String(Math.max(0,Math.min(100,rounded||0))));
    fill.style.width=`${Math.max(0,Math.min(100,load.percent||0))}%`;
    const plannedHours=(load.plannedMinutes/60).toLocaleString('de-DE',{maximumFractionDigits:1});
    if(load.percent===null)meta.textContent=`${plannedHours} h geplant · keine Schicht zugewiesen`;
    else if(!load.critical)meta.textContent=`Fristauslastung · ${plannedHours} h Maschinenarbeit · keine offenen Lieferfristen`;
    else meta.textContent=load.critical.bufferMinutes>=0
      ?`Fristauslastung · ${plannedHours} h Maschinenarbeit · Puffer ${formatEstimateMinutes(load.critical.bufferMinutes)} bei ${load.critical.part}`
      :`Fristauslastung · ${plannedHours} h Maschinenarbeit · ${load.critical.part} vsl. ${formatEstimateMinutes(-load.critical.bufferMinutes)} zu spät`;
  }

  function updateMachineLoadCards(){
    document.querySelectorAll('.machine-load-card').forEach(card=>{
      const machine=machineAt(Number(card.dataset.bay));if(machine)updateMachineLoadCard(card,machine);
    });
  }
  function renderOrders(){
    $('customer-reputation').replaceChildren(...Object.entries(orderMarketSystem.getReputation(state)).map(([customer,score])=>{
      const row=document.createElement('div'),name=document.createElement('span'),status=document.createElement('b');
      row.className='reputation-row';name.textContent=customer;
      const bonus=Math.round((score-50)*.3);
      status.textContent=`Vertrauen ${score}/100 · ${bonus>=0?'+':''}${bonus} % für neue Angebote`;
      row.append(name,status);return row;
    }));
    const offers=orderMarketSystem.getAvailable(state);
    lastOrdersRenderKey=ordersRenderKey();
    $('queued-orders').replaceChildren(...state.machines.map(renderMachineLoadCard),...state.machines.flatMap(m=>m.orderQueue.map((entry,index)=>{
      const row=document.createElement('div'),title=document.createElement('span'),controls=document.createElement('div'),cancel=document.createElement('button');
      row.className='queued-job';
      title.textContent=`Platz ${m.bay} · Planung ${index+1}/${MAX_QUEUED_ORDERS}: ${entry.order.part} · ${entry.order.qty} Teile · `;
      const deadline=document.createElement('strong');
      deadline.className='queue-deadline-countdown';deadline.dataset.deadlineAt=String(entry.deadlineAt);
      title.append(deadline);
      controls.className='queue-order-controls';
      const moveUp=document.createElement('button');
      moveUp.type='button';moveUp.textContent='↑';moveUp.title='Auftrag nach oben verschieben';
      moveUp.setAttribute('aria-label',`Auftrag auf Platz ${m.bay} nach oben verschieben`);
      moveUp.disabled=index===0;
      moveUp.addEventListener('click',event=>{event.stopPropagation();moveQueuedOrder(m,index,-1);});
      const moveDown=document.createElement('button');
      moveDown.type='button';moveDown.textContent='↓';moveDown.title='Auftrag nach unten verschieben';
      moveDown.setAttribute('aria-label',`Auftrag auf Platz ${m.bay} nach unten verschieben`);
      moveDown.disabled=index===m.orderQueue.length-1;
      moveDown.addEventListener('click',event=>{event.stopPropagation();moveQueuedOrder(m,index,1);});
      controls.append(moveUp,moveDown);
      cancel.type='button';cancel.textContent='Vormerkung lösen';
      cancel.className='queue-cancel';
      const held=Object.values(entry.material||{}).reduce((sum,amount)=>sum+amount,0);
      cancel.disabled=state.material+held>state.capacity+1e-9;
      cancel.addEventListener('click',()=>cancelQueuedOrder(m,index));
      row.append(title,controls,cancel);return row;
    })));
    $('orders').replaceChildren(...offers.map(o=>{
      const card=document.createElement('article');
      const running=state.machines.find(x=>x.activeId===o.id||x.orderQueue.some(entry=>entry.order.id===o.id));
      const compatibleMachines=state.machines.filter(machine=>compatible(machine,o));
      card.className='card'+(state.selected===o.id?' selected':'')+(running?' running':'')+(!compatibleMachines.length&&!running?' incompatible':'');
      const customerType=o.customerType?`${o.customerType} · `:'';
      const difficulty=Number.isFinite(o.difficulty)?` · Schwierigkeit ${o.difficulty}/5`:'';
      const materialType=materialSystem.typeForOrder(o),materialKg=materialSystem.requiredKg(o);
      const materialPrice=materialType?materialSystem.pricePerKg(materialType,state.gameMinutes):null;
      const materialCost=Number.isFinite(materialPrice)&&Number.isFinite(materialKg)?materialPrice*materialKg:null;
      const materialContribution=Number.isFinite(materialCost)?o.reward-materialCost:null;
      const baseMachineRate=o.kind==='Fräsen'?catalog.mill3.rate:catalog.standard.rate;
      const estimateMinutes=programmingETA(o)+setupMinutesForOrder(o)+Math.max(0,(o.qty-1)/Math.max(1,o.qty)*o.duration*6/baseMachineRate);
      const contributionPerHour=Number.isFinite(materialContribution)&&estimateMinutes>0?materialContribution/(estimateMinutes/60):null;
      const risks=compatibleMachines.map(machine=>qualityRiskFor(machine,o)).sort((a,b)=>a-b);
      const qualityHint=` · ${programmingQuality.toleranceClass(o)}${risks.length?` · Qualitätsrisiko ${risks[0]}${risks.length>1&&risks[0]!==risks[risks.length-1]?`–${risks[risks.length-1]}`:''} %`:''}`;
      card.innerHTML=`<div class="top"><span>${o.customer}</span><span>${o.kind} · #${o.id}</span></div><h3>${o.part}</h3><p>${customerType}${o.material} · ${o.qty} Teile${difficulty}${qualityHint}</p><div class="values"><span>${o.kg} kg · Frist ${o.deadlineHours} h${o.reputationBonusPct?` · Kundenbonus ${o.reputationBonusPct>0?'+':''}${o.reputationBonusPct} %`:''}</span><b>${euro(o.reward)}</b></div><div class="order-economics${materialContribution!==null&&materialContribution<0?' loss':''}"><div class="order-economics-grid"><span>Material zum Tageskurs<strong>${materialCost===null?'—':euro(materialCost)}</strong></span><span>Nach Material<strong>${materialContribution===null?'—':euro(materialContribution)}</strong></span></div><p>${contributionPerHour===null?'':`Etwa ${euro(contributionPerHour)} je Maschinenstunde · ${formatMinutes(estimateMinutes)} Rüst- und Maschinenzeit`}</p><small>Grundmaschine, ohne Lohn, Strom und Verschleiß</small></div>`;
      if(o.isRushOrder){
        card.classList.add('rush-order-card');
        const badge=document.createElement('strong');badge.className='rush-order-badge';
        badge.textContent=`EILAUFTRAG · +${o.rushBonusPct||20} % · Lieferfrist ${o.deadlineHours} h ab Zusage`;
        card.querySelector('.top').after(badge);
      }
      if(!programReady(o)){
        const badge=document.createElement('strong');badge.className='nc-program-badge';
        const task=programTaskFor(programKey(o));
        badge.textContent=task
          ?`NEUTEIL · PROGRAMMIERUNG EINGEPLANT · ca. ${formatMinutes(programmingETA(o))}`
          :state.programmer.hired?'NEUTEIL · AUTOMATISCHE ZUWEISUNG':'NEUTEIL · BEDIENER PROGRAMMIERT AUTOMATISCH';
        card.querySelector('.top').after(badge);
      }
      if(Number.isFinite(o.expiresAt)){
        const countdown=document.createElement('p');countdown.className='order-countdown';countdown.dataset.expiresAt=String(o.expiresAt);card.append(countdown);
      }
      if(running){const p=document.createElement('p');p.textContent=`Läuft auf Platz ${running.bay} · ${running.produced}/${o.qty} Teile`;card.append(p);}
      const button=document.createElement('button');
      button.type='button';
      const shortage=Math.max(0,materialSystem.requiredKg(o)-materialSystem.available(state,o));
      const machineReady=compatibleMachines.some(machine=>!machineOrderBlockReason(machine,o));
      const allQueuesFull=compatibleMachines.length>0&&compatibleMachines.every(machine=>machine.orderQueue.length>=MAX_QUEUED_ORDERS);
      if(shortage>1e-9){
        const marketButton=document.createElement('button');
        marketButton.type='button';marketButton.className='action order-market-button';marketButton.textContent='Material & Markt ansehen';
        marketButton.addEventListener('click',event=>{
          event.stopPropagation();state.selected=o.id;state.warehouseOrderSnapshot={...o};state.selectedMaterialType=materialSystem.typeForOrder(o)||state.selectedMaterialType;
          save();renderOrders();renderMaterialPrice();tab('warehouse');
        });
        card.append(marketButton);
      }
      button.textContent=running?'Bereits eingeplant':!state.machines.length?'Zuerst Maschine kaufen':!compatibleMachines.length?`Benötigt ${o.kind}`:shortage>1e-9?`Fehlen ${Math.ceil(shortage)} kg ${o.material}`:!machineReady?allQueuesFull?'Planung voll (3/3)':'Maschinenservice nötig':'Auftrag annehmen';
      button.disabled=!state.machines.length||!!running||!compatibleMachines.length||shortage>1e-9||!machineReady;
      button.addEventListener('click',event=>{event.stopPropagation();openOrderMachineChooser(o.id);});
      card.append(button);
      card.addEventListener('click',()=>{state.selected=o.id;save();renderOrders();});
      return card;
    }));
    updateOrderCountdowns();
    renderOrderMachineChooser();
  }
  function machineOrderBlockReason(machine,order){
    if(!compatible(machine,order))return `Benötigt ${order.kind}`;
    if(machine.maintenanceRemainingMinutes>0)return 'Wartung läuft';
    if(machine.orderQueue.length>=MAX_QUEUED_ORDERS)return 'Planung voll (3/3)';
    if(machine.maintenance<8||machine.tool<1)return 'Wartung oder Werkzeug erneuern';
    return '';
  }
  function rushAssignmentBlockReason(machine,order,interrupt=false,allowMaterialShortage=false){
    if(!compatible(machine,order))return `Benötigt ${order.kind}`;
    const shortage=Math.max(0,materialSystem.requiredKg(order)-materialSystem.available(state,order));
    if(shortage>1e-9&&!allowMaterialShortage)return `Material fehlt: ${Math.ceil(shortage)} kg ${order.material}`;
    if(machine.maintenanceRemainingMinutes>0)return 'Wartung läuft';
    if(machine.maintenance<8||machine.tool<1)return 'Wartung oder Werkzeug erneuern';
    const fault=breakdownSystem.getRecord(state,machine.bay);
    if(fault?.fault&&(fault.status==='major_failure'||fault.status==='repairing'||
      (fault.status==='warning'&&!fault.riskyContinue&&!fault.scheduledRepair)))return 'Maschinenstörung';
    if(interrupt){
      if(!job(machine))return 'Kein laufender Auftrag';
      if(machine.suspendedOrder)return 'Ein unterbrochener Auftrag wartet bereits';
      if(job(machine).isRushOrder)return 'Eilauftrag läuft bereits';
      if(!programReady(job(machine))||machine.ncProgramPending||machine.operatorProgramming)return 'Programmierung noch nicht abgeschlossen';
      if(machine.qualityReworkQueue.length)return 'Nacharbeit zuerst abschließen';
    }else if(machine.orderQueue.length>=MAX_QUEUED_ORDERS)return 'Planung voll (3/3)';
    return '';
  }
  function openOrderMachineChooser(id){
    const order=orderMarketSystem.getAvailable(state).find(item=>item.id===id);
    if(!order){say('Dieses Angebot ist inzwischen abgelaufen.');return;}
    pendingOrderAssignmentId=id;state.selected=id;renderOrderMachineChooser();save();renderOrders();
    $('order-machine-chooser').hidden=false;
    $('order-machine-chooser').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function updateAssignmentLoadLine(line,machine,order){
    const current=plannedMachineLoad(machine),projected=plannedMachineLoad(machine,order);
    const currentValue=line.querySelector('[data-load-current]'),projectedValue=line.querySelector('[data-load-projected]');
    const percentLabel=load=>load.percent===null?'keine Schicht':Number.isFinite(load.percent)?`${Math.round(load.percent)} %`:'∞ %';
    currentValue.textContent=`Jetzt ${percentLabel(current)}`;
    const check=projected.deadlineChecks.find(item=>item.orderId===order.id);
    const margin=check?` · ${check.bufferMinutes>=0?'Puffer':'zu spät'} ${formatEstimateMinutes(Math.abs(check.bufferMinutes))}`:'';
    projectedValue.textContent=`Mit Auftrag ${percentLabel(projected)}${margin}`;
    currentValue.classList.toggle('assignment-overloaded',current.percent!==null&&current.percent>100);
    projectedValue.classList.toggle('assignment-overloaded',projected.percent!==null&&projected.percent>100);
    line.setAttribute('aria-label',`Theoretische Fristauslastung: aktuell ${percentLabel(current)}, mit diesem Auftrag ${percentLabel(projected)}${margin}`);
  }

  function updateAssignmentLoads(){
    if(!pendingOrderAssignmentId||$('order-machine-chooser').hidden)return;
    const order=orderMarketSystem.getAvailable(state).find(item=>item.id===pendingOrderAssignmentId);
    if(!order)return;
    document.querySelectorAll('[data-assignment-load]').forEach(line=>{
      const machine=machineAt(Number(line.dataset.bay));
      if(machine)updateAssignmentLoadLine(line,machine,order);
    });
  }
  function renderOrderMachineChooser(){
    const panel=$('order-machine-chooser');
    if(!pendingOrderAssignmentId){panel.hidden=true;return;}
    const order=orderMarketSystem.getAvailable(state).find(item=>item.id===pendingOrderAssignmentId);
    if(!order){pendingOrderAssignmentId=null;panel.hidden=true;return;}
    $('assignment-title').textContent='Welche Maschine soll den Auftrag übernehmen?';
    $('assignment-detail').textContent=`${order.part} · ${order.kind} · ${order.material} · Fristauslastung: jetzt / mit Auftrag. Über 100 % bedeutet voraussichtlich verspätet.`;
    $('assignment-options').replaceChildren(...state.machines.map(machine=>{
      const button=document.createElement('button'),reason=machineOrderBlockReason(machine,order);
      const name=document.createElement('span'),loadLine=document.createElement('span'),currentLoad=document.createElement('span'),projectedLoad=document.createElement('strong');
      button.type='button';button.className='action assignment-option';
      name.className='assignment-option-name';
      name.textContent=`Platz ${machine.bay} · ${catalog[machine.type].name} · ${catalog[machine.type].kind}${reason?` · ${reason}`:job(machine)||machine.qualityReworkQueue.length?` · Vormerken ${machine.orderQueue.length+1}/${MAX_QUEUED_ORDERS}`:' · Direkt starten'}`;
      loadLine.className='assignment-option-load';loadLine.dataset.assignmentLoad='';loadLine.dataset.bay=String(machine.bay);
      currentLoad.dataset.loadCurrent='';projectedLoad.dataset.loadProjected='';
      loadLine.append(currentLoad,projectedLoad);
      button.append(name,loadLine);
      updateAssignmentLoadLine(loadLine,machine,order);
      button.disabled=!!reason;
      button.addEventListener('click',()=>startOrder(order.id,machine.bay));
      return button;
    }));
    panel.hidden=false;
  }
  function closeOrderMachineChooser(){pendingOrderAssignmentId=null;$('order-machine-chooser').hidden=true;}
  function updateOrderCountdowns(){
    document.querySelectorAll('.order-countdown').forEach(node=>{
      node.textContent=`Gültig noch ${formatMinutes(Number(node.dataset.expiresAt)-state.gameMinutes)}`;
    });
    document.querySelectorAll('.queue-deadline-countdown').forEach(node=>{
      const remaining=Number(node.dataset.deadlineAt)-state.gameMinutes,overdue=remaining<0;
      node.classList.toggle('overdue',overdue);
      node.textContent=overdue?`Überfällig seit ${formatMinutes(-remaining)}`:`Frist ${formatMinutes(remaining)}`;
    });
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
    renderWarehouseOrderContext();
  }
  function renderWarehouseOrderContext(){
    const box=$('warehouse-order-context');
    const snapshot=state.warehouseOrderSnapshot;
    const order=(snapshot&&orderMarketSystem.getAvailable(state).find(item=>item.id===snapshot.id))||snapshot;
    if(!order){box.hidden=true;box.replaceChildren();return;}
    let title=box.querySelector('.warehouse-order-title'),details=box.querySelector('.warehouse-order-details');
    let back=box.querySelector('.warehouse-order-back'),accept=box.querySelector('.warehouse-order-accept'),stamp=box.querySelector('.expired-stamp');
    if(!title){
      title=document.createElement('strong');title.className='warehouse-order-title';
      details=document.createElement('p');details.className='warehouse-order-details';
      const actions=document.createElement('div');actions.className='warehouse-order-actions';
      const backWrap=document.createElement('div');backWrap.className='warehouse-order-back-wrap';
      back=document.createElement('button');back.type='button';back.className='action warehouse-order-back';back.textContent='Zurück zu Aufträgen';
      back.addEventListener('click',()=>tab('orders'));
      accept=document.createElement('button');accept.type='button';accept.className='action warehouse-order-accept';accept.textContent='Auftrag annehmen';
      accept.addEventListener('click',acceptWarehouseOrder);
      stamp=document.createElement('span');stamp.className='expired-stamp';stamp.setAttribute('aria-label','Angebot abgelaufen');
      stamp.innerHTML='<b>×</b><strong>ANGEBOT ABGELAUFEN</strong>';
      backWrap.append(back,stamp);actions.append(backWrap,accept);box.append(title,details,actions);
    }
    const required=materialSystem.requiredKg(order),available=materialSystem.available(state,order);
    const machine=state.machines.find(m=>m.activeId===order.id||m.orderQueue.some(entry=>entry.order.id===order.id));
    const offerAvailable=orderMarketSystem.getAvailable(state).some(item=>item.id===order.id);
    const hasMaterial=available+1e-9>=required;
    const missing=Math.max(0,Math.ceil(required-available));
    const pendingRush=state.pendingRushAssignment?.orderId===order.id?state.pendingRushAssignment:null;
    const pendingMachine=pendingRush?machineAt(pendingRush.bay):null;
    const pendingReason=pendingRush
      ?!pendingMachine?'Die ausgewählte Maschine ist nicht mehr verfügbar.'
        :rushAssignmentBlockReason(pendingMachine,order,pendingRush.interrupt,true)
          ||(!plannedMachineLoad(pendingMachine).shifts.length?'Für diese Maschine ist keine besetzte Schicht geplant.':'')
      :'';
    const machineReady=state.machines.some(m=>compatible(m,order)&&!machineOrderBlockReason(m,order));
    const status=pendingRush?'zugesagt · wartet auf Material für Platz '+pendingRush.bay
      :machine?'angenommen für Platz '+machine.bay:offerAvailable?'noch im Angebot':'Angebot abgelaufen';
    title.textContent='Ausgewählter Auftrag: '+order.part;
    details.textContent=order.material+' · benötigt '+required+' kg · im Lager '+Math.floor(available)+' kg · es fehlen '+missing+' kg · '+status+(offerAvailable?' · gültig noch '+formatMinutes(order.expiresAt-state.gameMinutes):'');
    stamp.hidden=offerAvailable||!!machine;
    if(pendingRush){
      accept.hidden=false;
      accept.disabled=!hasMaterial||!!pendingReason;
      accept.textContent=pendingReason||(!hasMaterial?'Noch '+missing+' kg '+order.material+' kaufen'
        :pendingRush.interrupt?'Eilauftrag auf Platz '+pendingRush.bay+' starten & einschieben'
        :'Eilauftrag auf Platz '+pendingRush.bay+' einplanen');
    }else{
      accept.hidden=!offerAvailable||!!machine||!hasMaterial;
      accept.disabled=!machineReady;
      accept.textContent=machineReady?'Auftrag annehmen':'Keine passende Maschine verfügbar';
    }
    accept.parentElement.classList.toggle('with-accept',!accept.hidden);
    box.hidden=false;
    $('drawer').classList.toggle('warehouse-focus',currentPanel==='warehouse');
  }
  function acceptWarehouseOrder(){
    const id=state.warehouseOrderSnapshot?.id;
    const order=orderMarketSystem.getAvailable(state).find(item=>item.id===id);
    if(!order){say('Dieses Angebot ist inzwischen abgelaufen.');renderWarehouseOrderContext();return;}
    const required=materialSystem.requiredKg(order),available=materialSystem.available(state,order);
    const pendingRush=state.pendingRushAssignment?.orderId===order.id?state.pendingRushAssignment:null;
    if(pendingRush){
      if(available+1e-9<required){say('Es fehlen noch '+Math.ceil(required-available)+' kg '+order.material+'.');renderWarehouseOrderContext();return;}
      const machine=machineAt(pendingRush.bay);
      if(!machine){say('Die für den Eilauftrag gewählte Maschine ist nicht mehr verfügbar.');renderWarehouseOrderContext();return;}
      const reason=rushAssignmentBlockReason(machine,order,pendingRush.interrupt,true);
      if(reason||!plannedMachineLoad(machine).shifts.length){
        say(reason||'Für diese Maschine ist keine besetzte Schicht geplant.');renderWarehouseOrderContext();return;
      }
      state.pendingRushAssignment=null;
      const started=startOrder(order.id,pendingRush.bay,{rushEvent:true,interrupt:pendingRush.interrupt});
      if(!started){state.pendingRushAssignment=pendingRush;save();renderWarehouseOrderContext();}
      return;
    }
    if(available+1e-9<required){say('Es fehlen noch '+Math.ceil(required-available)+' kg '+order.material+'.');renderWarehouseOrderContext();return;}
    if(!state.machines.some(m=>compatible(m,order)&&!machineOrderBlockReason(m,order))){
      say('Keine passende Maschine ist gerade aufnahmebereit.');return;
    }
    tab('orders');
    openOrderMachineChooser(order.id);
  }
  function renderStaffDevelopment(){
    $('staff-development').replaceChildren(...[1,2].flatMap(shift=>state.staffRoster['shift'+shift].map(employee=>{
      const row=document.createElement('div'),portrait=document.createElement('img'),details=document.createElement('div');
      const name=document.createElement('strong'),about=document.createElement('small'),rating=document.createElement('span'),button=document.createElement('button');
      const level=skillLevel(employee),cost=TRAINING_BASE_COST*(level+1);
      row.className='staff-development-row';
      row.dataset.employeeId=String(employee.id);row.dataset.shift=String(shift);
      portrait.className='staff-profile-portrait';portrait.src=employee.portrait||recruitmentSystem.portraitFor(employee.id);
      portrait.alt='Porträt von '+employee.name;portrait.loading='lazy';
      details.className='staff-profile-details';
      const profile=employee.profileVersion===2?employee.specialty:'Altbestand';
      name.className='staff-profile-name';
      name.textContent='S'+shift+' · '+employee.name+' · '+profile+' · '+(employee.assignedBay?'Platz '+employee.assignedBay:'frei');
      about.className='staff-profile-about';about.textContent=`${employee.about||'Mitarbeiterprofil'} · ${Math.floor(employee.xp)} min Erfahrung · Können ${level}/3`;
      rating.className='staff-rating';rating.textContent=(employee.rating||recruitmentSystem.ratingFromSkills(employee.skills))+'/10';
      rating.setAttribute('aria-label','Profilbewertung '+rating.textContent);
      details.append(name,about);
      button.type='button';button.textContent=level===3?'Können maximal':'Auf Stufe '+(level+1)+' schulen · '+euro(cost);
      button.title=level===3?'Höchste Könnensstufe erreicht':`Schulung auf Stufe ${level+1}: +5 % Produktionstempo für ${euro(cost)}`;
      button.disabled=level===3||state.money<cost;
      button.addEventListener('click',()=>trainEmployee(shift,employee.id));
      row.append(portrait,details,rating,button);return row;
    })));
  }
  function updateStaffDevelopment(){
    for(const row of $('staff-development').children){
      const shift=Number(row.dataset.shift),id=Number(row.dataset.employeeId);
      const employee=state.staffRoster['shift'+shift].find(person=>person.id===id);
      if(!employee)continue;
      const level=skillLevel(employee),cost=TRAINING_BASE_COST*(level+1),about=row.children[1]?.children[1],button=row.children[3];
      if(about)about.textContent=`${employee.about||'Mitarbeiterprofil'} · ${Math.floor(employee.xp)} min Erfahrung · Können ${level}/3`;
      if(button){
        button.textContent=level===3?'Können maximal':'Auf Stufe '+(level+1)+' schulen · '+euro(cost);
        button.title=level===3?'Höchste Könnensstufe erreicht':`Schulung auf Stufe ${level+1}: +5 % Produktionstempo für ${euro(cost)}`;
        button.disabled=level===3||state.money<cost;
      }
    }
  }
  function renderOrderOffice(){
    const shop=$('machine-shop');
    let panel=$('order-office-panel');
    if(!panel){
      panel=document.createElement('section');panel.id='order-office-panel';panel.className='office-panel';
      const title=document.createElement('h3');title.textContent='Auftragsbüro';
      const intro=document.createElement('p');intro.className='hint';intro.textContent='Der Disponent prüft Preise und Maschinenauslastung. Er nimmt nur Aufträge mit passender Schicht und mindestens 30 Minuten sowie 10 % Fristpuffer an. Deine Einkaufs- und Auftragsgrenzen gelten weiterhin.';
      const status=document.createElement('p');status.id='order-office-status';status.className='hint';
      const hire=document.createElement('button');hire.id='hire-order-office';hire.type='button';hire.className='action full-action';
      hire.addEventListener('click',hireOrderOffice);
      const settings=document.createElement('div');settings.id='order-office-settings';settings.className='office-settings';
      const toggle=(labelText,key)=>{
        const label=document.createElement('label');label.className='office-toggle';
        const input=document.createElement('input');input.type='checkbox';input.dataset.officeKey=key;
        const text=document.createElement('span');text.textContent=labelText;
        input.addEventListener('change',()=>{state.orderOffice[key]=input.checked;save();});
        label.append(input,text);settings.append(label);
      };
      const select=(labelText,key,options)=>{
        const label=document.createElement('label');label.className='office-setting';
        const text=document.createElement('span');text.textContent=labelText;
        const input=document.createElement('select');input.dataset.officeKey=key;
        for(const [value,name] of options){const option=document.createElement('option');option.value=String(value);option.textContent=name;input.append(option);}
        input.addEventListener('change',()=>{state.orderOffice[key]=Number(input.value);save();});
        label.append(text,input);settings.append(label);
      };
      toggle('Passende Aufträge automatisch annehmen','autoAccept');
      toggle('Fehlendes Material automatisch kaufen','autoPurchase');
      select('Mindestguthaben','cashReserve',[[5000,'€ 5.000'],[10000,'€ 10.000'],[20000,'€ 20.000']]);
      select('Max. Aufschlag zum Grundpreis','maxMarketMarkupPct',[[0,'0 %'],[10,'10 %'],[20,'20 %']]);
      select('Mindestüberschuss nach Material','minMaterialSurplus',[[1000,'€ 1.000'],[2500,'€ 2.500'],[5000,'€ 5.000']]);
      select('Warteschlange je Maschine','queueLimit',[[1,'1 Auftrag'],[2,'2 Aufträge'],[3,'3 Aufträge']]);
      panel.append(title,intro,status,hire,settings);
      shop.parentElement.insertBefore(panel,shop.previousElementSibling);
    }
    const office=state.orderOffice,unlocked=state.factoryExpansion.level>=2;
    $('order-office-status').textContent=office.hired
      ?'Besetzt · prüft alle 30 Spielminuten (Mo–Fr, 08–16 Uhr), solange Aufträge und Lager nicht geöffnet sind.'
      :unlocked?'Noch unbesetzt. Der Disponent kostet € 12.000 einmalig und € 36 je Spielstunde (Mo–Fr, 08–16 Uhr).'
      :'Wird mit der ersten Hallenerweiterung (6 Plätze) verfügbar.';
    $('hire-order-office').hidden=office.hired;
    $('hire-order-office').disabled=!unlocked||state.money<ORDER_OFFICE_SETUP_COST;
    $('hire-order-office').textContent=unlocked?`Disponenten einstellen · ${euro(ORDER_OFFICE_SETUP_COST)}`:'Ab Hallenausbau auf 6 Plätze';
    $('order-office-settings').hidden=!office.hired;
    panel.querySelectorAll('[data-office-key]').forEach(input=>{
      const value=office[input.dataset.officeKey];
      if(input.type==='checkbox')input.checked=!!value;
      else input.value=String(value);
    });
  }
  function shiftLeaderStateKey(){
    const shift=shiftLeaderPanelShift===2?2:1,leader=shiftLeaderFor(shift)||{};
    const workers=(state.staffRoster['shift'+shift]||[]).map(employee=>employee.assignedBay||0).join(',');
    const machines=state.machines.map(machine=>[
      machine.bay,machine['operator'+shift],shift===2&&robotAvailable(machine),machine.robotFault,machine.robotRepairRemainingMinutes>0,machine.activeId,
      machine.orderQueue.map(entry=>entry.order.id).join(','),machine.qualityReworkQueue.length,
      machine.tool<=40,spareToolCount(machine)>0,machine.maintenance<=65,machine.maintenanceRemainingMinutes>0,
      breakdownSystem.getStatus(state,machine.bay)
    ].join(':')).join('|');
    return [shift,leader.hired,leader.autoMaintenance,leader.autoTools,leader.autoBreakdowns,leader.spendingLimit,leader.nextDecisionAt,
      workers,machines,state.shiftLeader.shift1.hired,state.shiftLeader.shift2.hired,
      state.money>=SHIFT_LEADER_SETUP_COST,state.money>=PREVENTIVE_MAINTENANCE_COST,state.money>=ROBOT_TECHNICIAN_COST].join('::');
  }
  function shiftLeaderRecommendations(shift){
    const recommendations=[];
    const roster=state.staffRoster['shift'+shift]||[];
    const freeEmployee=roster.find(employee=>employee.assignedBay===null);
    const unstaffed=state.machines.filter(machine=>
      !(shift===2&&machine.loadingRobot)&&!machine['operator'+shift]&&
      (!!job(machine)||machine.orderQueue.length>0||machine.qualityReworkQueue.length>0)
    );
    if(unstaffed.length&&freeEmployee){
      const candidates=unstaffed.map(machine=>{
        const plan=plannedMachineLoad(machine),key=catalog[machine.type].kind==='Fräsen'?'milling':'turning';
        const skill=Number(freeEmployee.skills?.[key])||5;
        return {machine,plan,skill};
      }).sort((a,b)=>(a.plan.critical?.bufferMinutes??Infinity)-(b.plan.critical?.bufferMinutes??Infinity)||b.skill-a.skill||a.machine.bay-b.machine.bay);
      const {machine,plan,skill}=candidates[0],key=catalog[machine.type].kind==='Fräsen'?'Fräsen':'Drehen';
      const deadline=plan.critical?'Engster Fristpuffer: '+(plan.critical.bufferMinutes>=0?formatEstimateMinutes(plan.critical.bufferMinutes):formatEstimateMinutes(-plan.critical.bufferMinutes)+' zu spät')+'.':'Frist nicht berechenbar.';
      recommendations.push({
        title:'Bediener für Platz '+machine.bay+' einteilen',
        detail:freeEmployee.name+' hat '+skill+'/10 in '+key+'. Dort wartet Arbeit für Schicht '+shift+'. '+deadline,
        button:'Bediener zuweisen',
        action:()=>assignShiftLeaderOperator(machine,shift,freeEmployee.id)
      });
    }else if(unstaffed.length){
      const machine=unstaffed[0];
      recommendations.push({
        title:'Bediener für Platz '+machine.bay+' fehlt',
        detail:'In Schicht '+shift+' wartet Arbeit, aber es ist niemand frei. Neue Bediener findest du unter „Bewerber ansehen“.',
        button:'Bewerber ansehen',
        action:()=>$('open-recruitment').click()
      });
    }
    let bestSwap=null;
    for(const machine of state.machines){
      if(machine.orderQueue.length<2)continue;
      const before=plannedMachineLoad(machine).deadlineChecks;
      if(before.length<2)continue;
      const beforeWorst=Math.min(...before.map(check=>check.bufferMinutes));
      const beforeById=new Map(before.map(check=>[check.orderId,check]));
      for(let index=1;index<machine.orderQueue.length;index++){
        const reordered=machine.orderQueue.slice();
        [reordered[index-1],reordered[index]]=[reordered[index],reordered[index-1]];
        const after=plannedMachineLoad({...machine,orderQueue:reordered}).deadlineChecks;
        if(after.length!==before.length)continue;
        const afterWorst=Math.min(...after.map(check=>check.bufferMinutes));
        const keepsOnTime=after.every(check=>{
          const original=beforeById.get(check.orderId);
          return !original||original.bufferMinutes<0||check.bufferMinutes>=0;
        });
        const improvement=afterWorst-beforeWorst;
        if(!keepsOnTime||!Number.isFinite(improvement)||improvement<30)continue;
        if(!bestSwap||improvement>bestSwap.improvement)bestSwap={machine,index,improvement,order:machine.orderQueue[index].order};
      }
    }
    if(bestSwap){
      recommendations.push({
        title:'Warteschlange auf Platz '+bestSwap.machine.bay+' anpassen',
        detail:bestSwap.order.part+' eine Position vorziehen. Der engste Fristpuffer verbessert sich rechnerisch um '+formatEstimateMinutes(bestSwap.improvement)+', ohne einen derzeit pünktlichen Auftrag verspätet zu machen.',
        button:'Eine Position nach oben',
        action:()=>moveQueuedOrder(bestSwap.machine,bestSwap.index,-1)
      });
    }
    const leader=shiftLeaderFor(shift);
    const toolMachine=leader?.autoTools?null:state.machines.find(machine=>
      !job(machine)&&machine.orderQueue.length===0&&!machine.qualityReworkQueue.length&&
      machine.maintenanceRemainingMinutes<=0&&machine.tool<=25&&spareToolCount(machine)>0&&
      machine['operator'+shift]&&assignedEmployee(machine,shift)&&breakdownSystem.getStatus(state,machine.bay)==='ok'
    );
    if(toolMachine){
      recommendations.push({
        title:'Reservewerkzeug für Platz '+toolMachine.bay+' einsetzen',
        detail:'Werkzeugstand '+Math.round(toolMachine.tool)+' %. Die Maschine ist in Schicht '+shift+' gerade ohne Auftrag; der Wechsel verbraucht kein Materialgeld und unterbricht keine Produktion.',
        button:'Werkzeug jetzt wechseln',
        action:()=>changeMachineTool(toolMachine)
      });
    }
    const maintenanceMachine=leader?.autoMaintenance?null:state.machines.filter(machine=>
      !job(machine)&&machine.orderQueue.length===0&&!machine.qualityReworkQueue.length&&
      machine.maintenanceRemainingMinutes<=0&&machine.maintenance<=45&&canMaintain(machine)
    ).sort((a,b)=>a.maintenance-b.maintenance)[0];
    if(maintenanceMachine){
      recommendations.push({
        title:'Vorbeugende Wartung für Platz '+maintenanceMachine.bay+' einplanen',
        detail:'Maschinenzustand '+Math.round(maintenanceMachine.maintenance)+' %. Sie ist gerade ohne Auftrag. Die Wartung kostet '+euro(PREVENTIVE_MAINTENANCE_COST)+' und dauert '+formatMinutes(PREVENTIVE_MAINTENANCE_MINUTES)+'.',
        button:'Wartung jetzt starten',
        action:()=>startPreventiveMaintenance(maintenanceMachine)
      });
    }
    return recommendations;
  }
  function assignShiftLeaderOperator(machine,shift,employeeId){
    const key='operator'+shift,employee=(state.staffRoster['shift'+shift]||[]).find(person=>person.id===employeeId);
    if(!machine||!employee||employee.assignedBay!==null||machine[key]||(shift===2&&machine.loadingRobot))return;
    if(state.machines.filter(item=>item[key]).length>=state.staff['shift'+shift])return;
    employee.assignedBay=machine.bay;machine[key]=true;
    save();renderBusiness();render();
    say('Schichtleiter-Vorschlag übernommen: '+employee.name+' arbeitet in Schicht '+shift+' auf Platz '+machine.bay+'.');
  }
  function renderShiftLeader(){
    const parent=$('business-staff-section');
    if(!parent)return;
    let panel=$('shift-leader-panel');
    if(!panel){
      panel=document.createElement('section');panel.id='shift-leader-panel';panel.className='office-panel shift-leader-panel';
      const style=document.createElement('style');
      style.textContent='.shift-leader-policy-grid{display:grid;gap:5px;margin:8px 0}.shift-leader-policy{display:flex;align-items:flex-start;gap:8px;padding:7px 9px;border-radius:7px;background:#102832;color:#d6e6e9;font-size:11px;line-height:1.35}.shift-leader-policy input{margin:1px 0 0;accent-color:#78d7a5}.shift-leader-limit{margin-top:7px}';
      document.head.append(style);
      const title=document.createElement('h3');title.textContent='Schichtleitung';
      const intro=document.createElement('p');intro.className='hint';intro.textContent='Bis zu ein Schichtleiter je Schicht. Sie kümmern sich automatisch um Wartung, Werkzeuge und Störungen innerhalb deines Ausgabenlimits.';
      const status=document.createElement('p');status.id='shift-leader-status';status.className='hint';
      const shiftLabel=document.createElement('label');shiftLabel.className='office-setting';
      const shiftText=document.createElement('span');shiftText.textContent='Schicht auswählen';
      const select=document.createElement('select');select.id='shift-leader-shift';
      for(const [value,text] of [[1,'S1 · Frühschicht'],[2,'S2 · Spätschicht']]){
        const option=document.createElement('option');option.value=String(value);option.textContent=text;select.append(option);
      }
      select.addEventListener('change',()=>{
        shiftLeaderPanelShift=Number(select.value)===2?2:1;
        renderShiftLeader();
      });
      shiftLabel.append(shiftText,select);
      const hire=document.createElement('button');hire.id='hire-shift-leader';hire.type='button';hire.className='action full-action';
      hire.addEventListener('click',()=>hireShiftLeader(shiftLeaderPanelShift));
      const controls=document.createElement('div');controls.id='shift-leader-controls';controls.className='shift-leader-controls';
      const policies=document.createElement('div');policies.id='shift-leader-policy-grid';policies.className='shift-leader-policy-grid';
      const policyOptions=[
        ['autoMaintenance','Vorbeugende Wartung im Leerlauf selbst einplanen'],
        ['autoTools','Ersatzwerkzeuge bereitstellen und verschlissene Werkzeuge wechseln'],
        ['autoBreakdowns','Maschinen- und Roboterausfälle selbst behandeln']
      ];
      for(const [key,labelText] of policyOptions){
        const label=document.createElement('label');label.className='shift-leader-policy';
        const input=document.createElement('input');input.type='checkbox';input.id='shift-leader-'+key;
        const text=document.createElement('span');text.textContent=labelText;
        input.addEventListener('change',()=>{
          const leader=shiftLeaderFor(shiftLeaderPanelShift);
          if(!leader?.hired)return;
          leader[key]=input.checked;save();renderShiftLeader();
          say(input.checked?'Automatische Entscheidung der Schichtleitung aktiviert.':'Automatische Entscheidung der Schichtleitung deaktiviert.');
        });
        label.append(input,text);policies.append(label);
      }
      const limitLabel=document.createElement('label');limitLabel.className='office-setting shift-leader-limit';
      const limitText=document.createElement('span');limitText.textContent='Ausgabenlimit je Maßnahme';
      const limit=document.createElement('select');limit.id='shift-leader-limit';
      for(const amount of SHIFT_LEADER_SPENDING_LIMITS){
        const option=document.createElement('option');option.value=String(amount);option.textContent=euro(amount);limit.append(option);
      }
      limit.addEventListener('change',()=>{
        const leader=shiftLeaderFor(shiftLeaderPanelShift);
        if(!leader?.hired)return;
        leader.spendingLimit=Number(limit.value);save();renderShiftLeader();
        say('Ausgabenlimit der Schichtleitung angepasst.');
      });
      limitLabel.append(limitText,limit);controls.append(policies,limitLabel);
      const list=document.createElement('div');list.id='shift-leader-recommendations';list.className='shift-leader-recommendations';
      panel.append(title,intro,status,shiftLabel,hire,controls,list);parent.append(panel);
    }
    const shift=shiftLeaderPanelShift===2?2:1,leader=shiftLeaderFor(shift),unlocked=state.factoryExpansion.level>=2;
    shiftLeaderAdviceKey=shiftLeaderStateKey();
    const status=$('shift-leader-status'),hire=$('hire-shift-leader'),controls=$('shift-leader-controls'),list=$('shift-leader-recommendations');
    $('shift-leader-shift').value=String(shift);
    const hiredCount=[1,2].filter(slot=>shiftLeaderFor(slot)?.hired).length;
    hire.hidden=!!leader.hired;
    hire.disabled=!unlocked||!!leader.hired||hiredCount>=2||state.money<SHIFT_LEADER_SETUP_COST;
    hire.textContent=leader.hired?'Für diese Schicht bereits besetzt'
      :!unlocked?'Ab Hallenausbau auf 6 Plätze'
      :hiredCount>=2?'Beide Schichten sind bereits besetzt'
      :'Schichtleiter für S'+shift+' einstellen · '+euro(SHIFT_LEADER_SETUP_COST);
    status.textContent=leader.hired
      ?'Besetzt · S'+shift+' · '+euro(SHIFT_LEADER_HOURLY_WAGE)+' je Stunde dieser Schicht · Ausgabenlimit '+euro(leader.spendingLimit)+' je Maßnahme.'
      :unlocked?'S'+shift+' ist noch unbesetzt · '+euro(SHIFT_LEADER_SETUP_COST)+' einmalig, danach '+euro(SHIFT_LEADER_HOURLY_WAGE)+' je Stunde in dieser Schicht.'
      :'Schichtleitung wird mit dem Hallenausbau auf 6 Plätze verfügbar.';
    controls.hidden=!leader.hired;
    if(!leader.hired){
      list.replaceChildren();
      const note=document.createElement('p');note.className='hint';note.textContent='Stelle bis zu zwei Personen ein – jeweils eine für Früh- und Spätschicht.';
      list.append(note);return;
    }
    for(const key of ['autoMaintenance','autoTools','autoBreakdowns'])$('shift-leader-'+key).checked=leader[key]!==false;
    $('shift-leader-limit').value=String(leader.spendingLimit);
    const suggestions=shiftLeaderRecommendations(shift);
    if(!suggestions.length){
      list.replaceChildren();
      const quiet=document.createElement('p');quiet.className='shift-leader-clear';quiet.textContent='Aktuell gibt es keine offene Besetzungs- oder Auftragsreihenfolge. Die Automatik erledigt die aktivierten Aufgaben innerhalb des Ausgabenlimits.';
      list.append(quiet);return;
    }
    list.replaceChildren(...suggestions.map(suggestion=>{
      const card=document.createElement('article'),heading=document.createElement('strong'),detail=document.createElement('p'),button=document.createElement('button');
      card.className='shift-leader-advice';heading.textContent=suggestion.title;detail.textContent=suggestion.detail;
      button.type='button';button.className='action';button.textContent=suggestion.button;
      button.addEventListener('click',suggestion.action);card.append(heading,detail,button);return card;
    }));
  }
  function hireShiftLeader(shift=shiftLeaderPanelShift){
    shift=Number(shift)===2?2:1;
    const leader=shiftLeaderFor(shift);
    if(!leader||leader.hired||state.factoryExpansion.level<2||state.money<SHIFT_LEADER_SETUP_COST||
      [1,2].filter(slot=>shiftLeaderFor(slot)?.hired).length>=2)return;
    if(!book('other',-SHIFT_LEADER_SETUP_COST,'Schichtleiter eingestellt',{role:'shift_leader',shift,hourlyWage:SHIFT_LEADER_HOURLY_WAGE}).ok)return;
    leader.hired=true;leader.nextDecisionAt=state.gameMinutes;
    save();renderBusiness();render();
    say('Schichtleiter für Schicht '+shift+' eingestellt. Wartung, Werkzeuge und Störungen können innerhalb deines Limits automatisch betreut werden.');
  }
    function hireOrderOffice(){
    if(state.orderOffice.hired||state.factoryExpansion.level<2||state.money<ORDER_OFFICE_SETUP_COST)return;
    if(!book('other',-ORDER_OFFICE_SETUP_COST,'Disponent für das Auftragsbüro eingestellt',{role:'order_office'}).ok)return;
    state.orderOffice.hired=true;state.orderOffice.nextReviewAt=state.gameMinutes+ORDER_OFFICE_REVIEW_MINUTES;
    save();renderBusiness();render();say('Auftragsbüro besetzt. Der Disponent arbeitet innerhalb deiner Einkaufs- und Auftragsgrenzen.');
  }
  function creditPaymentQuote(credit=state.credit){
    if(!credit||credit.principal<=0)return {principal:0,interest:0,total:0};
    const principalDue=Math.round(Math.min(credit.principal,credit.originalAmount/CREDIT_TERM_MONTHS)*100)/100;
    const interestDue=Math.round((credit.principal*credit.annualRate/12+credit.accruedInterest)*100)/100;
    return {principal:principalDue,interest:interestDue,total:Math.round((principalDue+interestDue)*100)/100};
  }
  function renderCreditPanel(){
    const credit=state.credit,active=credit.principal>0;
    const selectedAmount=Number($('loan-amount').value)||CREDIT_AMOUNTS[0];
    const selectedRate=CREDIT_RATE_BY_AMOUNT[selectedAmount]??CREDIT_ANNUAL_RATE;
    const firstQuote=creditPaymentQuote({principal:selectedAmount,originalAmount:selectedAmount,annualRate:selectedRate,accruedInterest:0});
    $('loan-amount').disabled=active;
    $('credit-offer').textContent=active
      ?'Ein weiterer Kredit ist erst nach Rückzahlung des offenen Kredits möglich.'
      :`${(selectedRate*100).toLocaleString('de-DE')} % Zinsen p. a. · ${CREDIT_TERM_MONTHS} Monate mit gleichbleibender Tilgung. Erste Rate: ${euroExact(firstQuote.total)} (${euroExact(firstQuote.principal)} Tilgung + ${euroExact(firstQuote.interest)} Zinsen); danach sinkt sie monatlich. Sondertilgung ohne Vorfälligkeitsgebühr.`;
    $('take-loan').disabled=active;
    const quote=active?creditPaymentQuote():null;
    const rateLabel=active?`${(credit.annualRate*100).toLocaleString('de-DE',{maximumFractionDigits:1})} % p. a.`:'';
    $('credit-summary').textContent=active
      ?`Restschuld ${euroExact(credit.principal)} · ${rateLabel} · offene Zinsen ${euroExact(credit.accruedInterest)} · ${credit.paymentsRemaining} Raten offen · nächste Rate ${euroExact(quote.total)} (${euroExact(quote.principal)} Tilgung + ${euroExact(quote.interest)} Zinsen) zum Monatsanfang${credit.missedPayments?` · ${credit.missedPayments} Rate${credit.missedPayments===1?'':'n'} ausstehend`:''}.`
      :'Kein Kredit offen. Die Kreditaufnahme erscheint im Kontostand, aber nicht als Gewinn; Zinsen zählen als Ausgabe.';
    $('loan-repayment-amount').disabled=!active;
    $('repay-credit').disabled=!active||state.money<=0;
  }
  function takeCredit(){
    if(state.credit.principal>0)return;
    const amount=Number($('loan-amount').value);
    if(!CREDIT_AMOUNTS.includes(amount))return;
    const annualRate=CREDIT_RATE_BY_AMOUNT[amount]??CREDIT_ANNUAL_RATE;
    if(!book('loan_drawdown',amount,`Kredit über ${euro(amount)} aufgenommen`,{amount,annualRate,termMonths:CREDIT_TERM_MONTHS}).ok)return;
    state.credit={principal:amount,originalAmount:amount,annualRate,paymentsRemaining:CREDIT_TERM_MONTHS,
      accruedInterest:0,nextPaymentAt:nextMonthMinute(state.gameMinutes),missedPayments:0};
    save();renderBusiness();render();
    const firstQuote=creditPaymentQuote();
    say(`Kredit über ${euro(amount)} zu ${(annualRate*100).toLocaleString('de-DE')} % p. a. aufgenommen. Die erste Rate über ${euroExact(firstQuote.total)} ist zum nächsten Monatsanfang fällig.`);
  }
  function repayCredit(){
    const credit=state.credit;
    if(credit.principal<=0||state.money<=0)return;
    const selection=$('loan-repayment-amount').value;
    const requested=selection==='all'?credit.principal+credit.accruedInterest:Number(selection);
    const amount=Math.min(state.money,credit.principal+credit.accruedInterest,Number.isFinite(requested)?requested:0);
    if(amount<=0)return;
    const interest=Math.min(credit.accruedInterest,amount),principal=Math.max(0,amount-interest);
    if(interest>0&&!book('loan_interest',-interest,'Kreditzinsen per Sondertilgung',{voluntary:true}).ok)return;
    if(principal>0&&!book('loan_repayment',-principal,'Kredit per Sondertilgung getilgt',{voluntary:true}).ok)return;
    credit.accruedInterest=Math.round((credit.accruedInterest-interest)*100)/100;
    credit.principal=Math.round((credit.principal-principal)*100)/100;
    if(credit.principal<=.005){
      credit.principal=0;credit.originalAmount=0;credit.paymentsRemaining=0;credit.accruedInterest=0;credit.nextPaymentAt=null;credit.missedPayments=0;
    }
    save();renderBusiness();render();
    say(credit.principal>0?`Sondertilgung ${euroExact(amount)} gebucht. Restschuld ${euroExact(credit.principal)}.`:'Kredit vollständig zurückgezahlt.');
  }
  function serviceMonthlyCredit(){
    const credit=state.credit;
    if(credit.principal<=0||!Number.isFinite(credit.nextPaymentAt)||state.gameMinutes+1e-8<credit.nextPaymentAt)return;
    const quote=creditPaymentQuote();
    if(state.money+1e-8>=quote.total){
      if(quote.interest>0&&!book('loan_interest',-quote.interest,'Monatliche Kreditzinsen',{principal:credit.principal}).ok)return;
      if(quote.principal>0&&!book('loan_repayment',-quote.principal,'Monatliche Kredittilgung',{principal:quote.principal}).ok)return;
      credit.principal=Math.round((credit.principal-quote.principal)*100)/100;
      credit.accruedInterest=0;credit.paymentsRemaining=Math.max(0,credit.paymentsRemaining-1);credit.missedPayments=0;
      if(credit.principal<=.005){
        credit.principal=0;credit.originalAmount=0;credit.paymentsRemaining=0;credit.nextPaymentAt=null;
        say('Letzte Kreditrate bezahlt. Der Kredit ist vollständig zurückgezahlt.');
      }else{
        credit.nextPaymentAt=nextMonthMinute(state.gameMinutes);
        say(`Kreditrate ${euroExact(quote.total)} bezahlt · Restschuld ${euroExact(credit.principal)}.`);
      }
    }else{
      const currentInterest=Math.round((credit.principal*credit.annualRate/12)*100)/100;
      credit.accruedInterest=Math.round((credit.accruedInterest+currentInterest)*100)/100;
      credit.missedPayments+=1;credit.nextPaymentAt=nextMonthMinute(state.gameMinutes);
      say(`Kreditrate ${euroExact(quote.total)} nicht gedeckt. Sie bleibt offen; Zinsen werden angezeigt und die Rate nächsten Monat erneut versucht.`);
    }
    save();
  }
  function renderRecruitment(){
    const offers=state.recruitment?.applicants||[];
    const limit=expansionSystem.getUnlockedBays(state);
    $('applicant-list').replaceChildren(...offers.map(candidate=>{
      const card=document.createElement('article');card.className='applicant-card';
      const head=document.createElement('div');head.className='applicant-head';
      const avatar=document.createElement('img');avatar.className='applicant-avatar';
      avatar.src=candidate.portrait||recruitmentSystem.portraitFor(candidate.id);
      avatar.alt='Porträt von '+candidate.name;avatar.loading='lazy';
      const identity=document.createElement('div');identity.className='applicant-identity';
      const name=document.createElement('strong');name.textContent=candidate.name;
      const specialty=document.createElement('span');specialty.className='applicant-specialty';specialty.textContent=candidate.specialty;
      identity.append(name,specialty);
      const rating=document.createElement('strong');rating.className='applicant-rating';
      rating.textContent=candidate.rating+'/10';rating.setAttribute('aria-label','Profilbewertung '+rating.textContent);
      head.append(avatar,identity,rating);
      const about=document.createElement('p');about.className='applicant-about';about.textContent=`${candidate.trait} · ${candidate.about}`;
      const stats=document.createElement('div');stats.className='applicant-stats';
      for(const [key,label] of [['turning','Drehen'],['milling','Fräsen'],['precision','Präzision'],['learning','Lerntempo']]){
        const stat=document.createElement('div');stat.className='applicant-stat';
        const top=document.createElement('div');top.className='applicant-stat-head';
        const statName=document.createElement('span');statName.textContent=label;
        const value=document.createElement('b');value.textContent=`${candidate.skills[key]}/10`;
        const track=document.createElement('div');track.className='applicant-track';
        const fill=document.createElement('span');fill.style.width=`${candidate.skills[key]*10}%`;track.append(fill);
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
    $('business-storage-summary').textContent=`${Math.floor(state.material)} / ${state.capacity} kg belegt`;
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
    renderProgrammer();
    renderShiftLeader();
    renderOrderOffice();
    renderCreditPanel();
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
    $('operator-2').textContent=m?(m.loadingRobot?(robotAvailable(m)?'S2 · Roboter aktiv':m.robotRepairRemainingMinutes>0?'S2 · Roboter Reparatur':'S2 · Roboter gestört'):m.operator2?'S2 abziehen':'S2 zuweisen'):'Keine Maschine';
    $('buy-robot').textContent=m?.loadingRobot?'Laderoboter installiert':`Laderoboter kaufen · ${euro(LOADING_ROBOT_COST)}`;
    $('buy-robot').disabled=!m||m.loadingRobot||state.money<LOADING_ROBOT_COST;
    $('sell-machine-value').textContent=m?euro(resaleValue(m)):'—';
    $('sell-machine').disabled=!m||!!job(m)||!!m.orderQueue.length||!!m.qualityReworkQueue.length||m.maintenanceRemainingMinutes>0;
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
    const stockBox=$('storage-stock');
    stockBox.className='hint storage-stock-list';stockBox.setAttribute('role','list');
    const stockRows=Object.entries(materialSystem.catalog).map(([type,item])=>{
      const row=document.createElement('span'),name=document.createElement('span'),amount=document.createElement('strong');
      const quantity=Math.max(0,Number(state.inventory.rawMaterial[type])||0);
      row.className='storage-stock-row'+(quantity<=1e-9?' empty':'');row.setAttribute('role','listitem');
      name.textContent=item.label;amount.textContent=`${quantity.toLocaleString('de-DE',{minimumFractionDigits:Number.isInteger(quantity)?0:1,maximumFractionDigits:1})} kg`;
      row.append(name,amount);return row;
    });
    const legacyLabels={steel:'Altbestand · Stahl',stainless:'Altbestand · Edelstahl',aluminium:'Altbestand · Aluminium',castiron:'Altbestand · Gusseisen'};
    for(const category of new Set(Object.values(materialSystem.catalog).map(item=>item.oldCategory))){
      const quantity=Math.max(0,Number(state.inventory.rawMaterial[category])||0);
      if(quantity<=1e-9)continue;
      const row=document.createElement('span'),name=document.createElement('span'),amount=document.createElement('strong');
      row.className='storage-stock-row legacy';row.setAttribute('role','listitem');
      name.textContent=legacyLabels[category]||`Altbestand · ${category}`;
      amount.textContent=`${quantity.toLocaleString('de-DE',{minimumFractionDigits:Number.isInteger(quantity)?0:1,maximumFractionDigits:1})} kg`;
      row.append(name,amount);stockRows.push(row);
    }
    const legacyQuantity=Math.max(0,Number(state.inventory.rawMaterial.legacy)||0);
    if(legacyQuantity>1e-9){
      const row=document.createElement('span'),name=document.createElement('span'),amount=document.createElement('strong');
      row.className='storage-stock-row legacy';row.setAttribute('role','listitem');
      name.textContent='Altbestand · für alle Aufträge';amount.textContent=`${legacyQuantity.toLocaleString('de-DE',{minimumFractionDigits:Number.isInteger(legacyQuantity)?0:1,maximumFractionDigits:1})} kg`;
      row.append(name,amount);stockRows.push(row);
    }
    stockBox.replaceChildren(...stockRows);
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
    const names={income:'Aufträge (Umsatz)',material:'Material',wages:'Bezahlte Löhne',energy:'Energie',tools:'Werkzeug',maintenance:'Wartung',repairs:'Reparaturen',quality:'Qualität & Reklamationen',storage:'Lager',machine_purchase:'Maschinenkauf',machine_sale:'Maschinenverkauf',factory_expansion:'Hallenausbau',loan_drawdown:'Kreditauszahlung',loan_repayment:'Kredittilgung',loan_interest:'Kreditzinsen',other:'Sonstiges / Upgrades'};
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
    const m=selectedMachine(),o=job(m),pct=m?orderProgressPercent(m,o):0;
    const layout=expansionSystem.getLayoutConfig(state),hallMap=$('hall-map');
    hallMap.classList.toggle('expanded',layout.level>1);
    hallMap.classList.toggle('six-bay',layout.level===2);
    hallMap.classList.toggle('eight-bay',layout.level===3);
    hallMap.style.aspectRatio=String(layout.aspectRatio);
    const fault=m?breakdownSystem.getRecord(state,m.bay):null;
    const faultInfo=fault?.fault?breakdownSystem.getFaultInfo(fault.fault):null;
    const repairOptions=m?breakdownSystem.getRepairOptions(state,m.bay):null;
    $('breakdown-panel').hidden=!fault||!['warning','major_failure','repairing'].includes(fault.status);
    $('breakdown-info').textContent=!faultInfo?'':`${faultInfo.label} · ${statusFor(m)}. ${fault?.selfRepairFailed?'Selbstversuch fehlgeschlagen; ein weiterer ist nicht möglich.':'Selbstreparatur kostet weniger, kann aber scheitern.'} Der Monteur arbeitet verlässlich.`;
    const selfRange=repairOptions?.self.failureRange;
    $('repair-self-detail').textContent=repairOptions?`${euro(repairOptions.self.cost)} · ${formatMinutes(repairOptions.self.downtime)} bei Erfolg · ${selfRange?`${Math.round(selfRange.min*100)}–${Math.round(selfRange.max*100)}% Risiko`:`${Math.round(repairOptions.self.failureChance*100)}% Risiko`}`:'Fehlerrisiko';
    $('repair-technician-detail').textContent=repairOptions?`${euro(repairOptions.technician.cost)} · ${formatMinutes(repairOptions.technician.downtime)} · verlässlich`:'verlässlich';
    $('schedule-repair-detail').textContent=repairOptions?`${euro(repairOptions.planned.cost)} · ${formatMinutes(repairOptions.planned.downtime)}`:'';
    $('repair-now').firstChild.textContent=fault?.selfRepairFailed?'Selbstversuch fehlgeschlagen':'Selbst reparieren';
    $('repair-now').disabled=!repairOptions||!repairOptions.self.allowed||state.money<repairOptions.self.cost;
    $('repair-technician').disabled=!repairOptions||state.money<repairOptions.technician.cost;
    $('continue-risky').disabled=fault?.status!=='warning'||fault.riskyContinue||fault.scheduledRepair;
    $('schedule-repair').disabled=!repairOptions||fault?.status!=='warning'||fault.scheduledRepair||!!job(m)||state.money<repairOptions.planned.cost;
    const hallImage=$('hall-image');
    const artwork=layout.asset+'?v=1';
    if(hallImage.getAttribute('src')!==artwork)hallImage.src=artwork;
    hallImage.alt=`Leere Produktionshalle mit ${layout.unlockedBays} Maschinenplätzen`;
    $('money').textContent=Math.abs(state.money-Math.round(state.money))<1e-9?euro(state.money):euroExact(state.money);
    $('material').textContent=Math.floor(state.material)+' kg';
    $('parts').textContent=`${state.machines.length} / ${layout.unlockedBays}`;
    $('part-name').textContent=o?o.part:m?'Auftrag auswählen':'Erste Maschine kaufen';
    $('progress').style.width=pct+'%';
    $('progress-label').textContent=o?(m.setupRemainingMinutes>0?`${m.setupDelayMinutes?`Einrichtungsproblem +${formatMinutes(m.setupDelayMinutes)} · `:''}Rüstphase · ${formatMinutes(m.setupRemainingMinutes)} · ${m.produced} / ${o.qty} Teile`:`${Math.floor(pct)} % · ${m.produced} / ${o.qty} · ${statusFor(m)}`):m?statusFor(m):'Öffne Betrieb und wähle deine erste Maschine.';
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
    renderProgramPanel(m,o);
    $('upgrade-cost').textContent=m?euro(9000*m.level)+' · +13 % Tempo':'—';
    $('tool-label').textContent=m?conditionLabel(m.tool):'—';
    $('tool-meter').style.width=m?Math.max(0,m.tool)+'%':'0%';
    const spareTools=m?spareToolCount(m):0;
    const toolUsage=inventorySystem.getUsage(state);
    $('tool-stock-label').textContent=m?`${spareTools} passend`:'—';
    $('tool-change-cost').textContent=spareTools?'Reservewerkzeug einsetzen':'€ 650 · direkt wechseln';
    $('buy-spare-tool').disabled=!canBuySpareTool(m);
    $('spare-tool-price').textContent=!m?'Maschine auswählen':toolUsage.ok&&toolUsage.remaining.tools>=1?'€ 650 · passend für diese Maschine':'Werkzeuglager voll';
    $('maintenance-label').textContent=m?Math.round(m.maintenance)+' %':'—';
    $('maintenance-meter').style.width=m?Math.max(0,m.maintenance)+'%':'0%';
    const maintenanceRemaining=Math.max(0,Number(m?.maintenanceRemainingMinutes)||0);
    $('maintenance-title').textContent=maintenanceRemaining>0?'Wartung läuft':'Vorbeugende Wartung starten';
    $('maintenance-detail').textContent=maintenanceRemaining>0
      ?`${formatMinutes(maintenanceRemaining)} verbleibend · Produktion pausiert`
      :`${euro(PREVENTIVE_MAINTENANCE_COST)} · ${formatMinutes(PREVENTIVE_MAINTENANCE_MINUTES)} Stillstand`;

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
    $('sell-machine').disabled=!m||!!o||!!m.orderQueue.length||!!m.qualityReworkQueue.length||maintenanceRemaining>0;
    for(let bay=1;bay<=8;bay++){
      const b=$('bay-'+bay),machine=machineAt(bay);
      const slot=layout.bays.find(entry=>entry.bay===bay);
      b.hidden=!slot;
      if(!slot)continue;
      b.style.left=slot.x+'%';b.style.top=slot.y+'%';
      b.style.width=slot.width+'%';b.style.height=slot.height+'%';
      if(layout.level===2){
        b.style.setProperty('--six-art-width',(22.3/slot.width*100)+'%');
        b.style.setProperty('--six-art-height',((catalog[machine?.type]?.kind==='Fräsen'?21.5:22)/slot.height*100)+'%');
      }else{
        b.style.removeProperty('--six-art-width');
        b.style.removeProperty('--six-art-height');
      }
      if(layout.level===3){
        b.style.setProperty('--eight-art-width',(19/slot.width*100)+'%');
        b.style.setProperty('--eight-art-height',(19/slot.height*100)+'%');
        b.style.setProperty('--eight-robot-width',(11/slot.width*100)+'%');
        b.style.setProperty('--eight-robot-height',(15/slot.height*100)+'%');
      }else{
        for(const variable of ['--eight-art-width','--eight-art-height','--eight-robot-width','--eight-robot-height'])b.style.removeProperty(variable);
      }
      b.classList.toggle('installed',!!machine);
      b.classList.toggle('selected-bay',!!m&&bay===m.bay);
      b.classList.toggle('working-bay',!!machine&&operating(machine));
      b.classList.toggle('warning-bay',!!machine&&(machine.maintenance<8||machine.tool<1||breakdownSystem.getStatus(state,bay)!=='ok'));
      b.classList.toggle('waiting-bay',!!machine&&!!job(machine)&&!operating(machine)&&machine.maintenance>=8&&machine.tool>=1);
      const milling=!!machine&&catalog[machine.type].kind==='Fräsen';
      const turning=!!machine&&catalog[machine.type].kind==='Drehen';
      b.classList.toggle('milling-bay',milling);
      b.classList.toggle('veltron-bay',!!machine&&machine.type==='mill3');
      b.classList.toggle('orionis-bay',!!machine&&machine.type==='mill5');
      b.classList.toggle('turning-bay',turning);
      b.classList.toggle('robot-loading',!!machine?.loadingRobot&&operating(machine)&&shiftAt(state.gameMinutes)===2);

      let machineArt=b.querySelector('.bay-machine');
      let turningFrame=b.querySelector('.bay-turning-frame');

      if(turning&&layout.level===2){
        if(!machineArt){
          machineArt=document.createElement('img');
          machineArt.className='bay-machine';
          machineArt.alt='';
          b.append(machineArt);
        }
        const src=turningMachineArtwork[machine.type];
        if(machineArt.getAttribute('src')!==src)machineArt.src=src;
        machineArt.hidden=false;
        if(turningFrame)turningFrame.hidden=true;
      }else if(turning){
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
        if(machineArt)machineArt.hidden=true;
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
      }else if(machineArt&&!(turning&&layout.level===2)){
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
    renderEventWindow();
    if(visual){
      visual.running=!!m&&operating(m);
      visual.condition=!m?'idle':(m.maintenance<8||m.tool<1)?'fault':operating(m)?'running':o?'waiting':'idle';
      visual.robotEnabled=!!m?.loadingRobot;
      if(m)visual.setMachineType(m.type,m.loadingRobot);
    }
  }
  function startOrder(id,bay,options={}){
    orderMarketSystem.tick(state,state.gameMinutes);
    const o=orderMarketSystem.getAvailable(state).find(order=>order.id===id),m=state.machines.find(machine=>machine.bay===Number(bay));
    if(!o||!m||(!options.interrupt&&m.orderQueue.length>=MAX_QUEUED_ORDERS)||state.machines.some(x=>x.activeId===id||x.orderQueue.some(entry=>entry.order.id===id))){if(!options.automatic)say('Dieses Angebot ist nicht mehr verfügbar oder die Auftragsplanung ist voll.');return false;}
    if(options.interrupt&&(!job(m)||m.suspendedOrder)){if(!options.automatic)say('Der laufende Auftrag kann auf dieser Maschine nicht unterbrochen werden.');return false;}
    if(!compatible(m,o)){if(!options.automatic)say(`${o.part} benötigt ${o.kind}. ${catalog[m.type].name} ist für ${catalog[m.type].kind} ausgelegt.`);return false;}
    const requiredMaterial=materialSystem.requiredKg(o),availableMaterial=materialSystem.available(state,o);
    if(availableMaterial+1e-9<requiredMaterial){
      if(!options.automatic){say(`Es fehlen ${Math.ceil(requiredMaterial-availableMaterial)} kg ${o.material}.`);tab('warehouse');}return false;
    }
    if(m.maintenance<8||m.tool<1){if(!options.automatic){say('Vorher Werkzeug oder Wartung erneuern.');tab('machine');}return false;}
    const materialResult=consumeOrderMaterial(o);
    if(!materialResult.ok){if(!options.automatic)say(`Materialbestand konnte nicht reserviert werden (${materialResult.code}).`);return false;}
    const accepted=orderMarketSystem.accept(state,id);
    if(!accepted){restoreOrderMaterial(materialResult.consumed);if(!options.automatic)say('Das Angebot ist inzwischen abgelaufen.');return false;}
    orderMarketSystem.tick(state,state.gameMinutes);
    const interrupted=options.interrupt?{
      order:m.activeOrder,source:m.activeOrderSource,progress:m.progress,produced:m.produced,deadlineAt:m.deadlineAt,
      setupDurationMinutes:m.setupDurationMinutes,setupRemainingMinutes:m.setupRemainingMinutes,setupDelayMinutes:m.setupDelayMinutes,
      setupPartProduced:m.setupPartProduced,ncProgramPending:m.ncProgramPending,qualityInspectedOrderId:m.qualityInspectedOrderId
    }:null;
    if(!options.automatic){closeOrderMachineChooser();state.selectedBay=m.bay;}
    if((job(m)&&!options.interrupt)||(!options.interrupt&&m.qualityReworkQueue.length)){
      m.orderQueue.push({order:accepted,material:materialResult.consumed,
        deadlineAt:Number.isFinite(accepted.deadlineAt)?accepted.deadlineAt:state.gameMinutes+accepted.deadlineHours*60});
      enqueueNcProgram(accepted);
      if(state.programmer.hired)reassessActiveProgrammingRoutes();
      if(state.warehouseOrderSnapshot?.id===accepted.id)state.warehouseOrderSnapshot=null;
      if(state.pendingRushAssignment?.orderId===accepted.id)state.pendingRushAssignment=null;
      if(!options.automatic)state.selected=null;
      save();renderOrders();renderBusiness();render();
      if(!options.automatic)say(`${accepted.part} für Platz ${m.bay} vorgemerkt (${m.orderQueue.length}/${MAX_QUEUED_ORDERS}). Material wurde reserviert.`);
      return true;
    }
    if(interrupted)m.suspendedOrder=interrupted;
    m.activeId=accepted.id;m.activeOrder=accepted;m.activeOrderSource='market';m.progress=0;m.produced=0;
    m.ncProgramPending=!programReady(accepted);
    const setupPlan=programReady(accepted)?beginMachineSetup(m,accepted):null;
    if(m.ncProgramPending){scheduleActiveOrderProgramming(m,accepted);reassessActiveProgrammingRoutes();}
    m.deadlineAt=Number.isFinite(accepted.deadlineAt)?accepted.deadlineAt:state.gameMinutes+accepted.deadlineHours*60;
    if(state.warehouseOrderSnapshot?.id===accepted.id)state.warehouseOrderSnapshot=null;
    if(state.pendingRushAssignment?.orderId===accepted.id)state.pendingRushAssignment=null;
    if(!options.automatic)state.selected=null;
    save();renderOrders();renderBusiness();render();
    if(!options.automatic){closeDrawer();showMachine(m.bay);if(m.ncProgramPending)tab('machine');say(options.interrupt
      ?`Eilauftrag ${accepted.part} auf Platz ${m.bay} gestartet. ${interrupted.order.part} wird danach mit neuer Rüstzeit fortgesetzt.`
      :m.ncProgramPending
      ?`${accepted.part} auf Platz ${m.bay} angenommen. Die Programmierung wurde automatisch zugewiesen.`
      :`${accepted.part} auf Platz ${m.bay} angenommen. Rüstzeit ${formatMinutes(setupPlan.totalMinutes)}${setupPlan.delayMinutes?` · Einrichtungsproblem verlängert um ${formatMinutes(setupPlan.delayMinutes)}`:''}.`);}
    return true;
  }
  function maybeQueueRushOrderEvent(){
    if(state.gameMinutes+1e-8<state.nextRushOrderAt)return false;
    if(state.eventQueue.length){state.nextRushOrderAt=state.gameMinutes+6*60;save();return false;}
    const eligibleMachines=state.machines.filter(machine=>{
      const kind=catalog[machine.type]?.kind;
      const canInterrupt=!!job(machine)&&!machine.suspendedOrder&&!job(machine).isRushOrder&&
        !machine.operatorProgramming&&!machine.ncProgramPending&&programReady(job(machine))&&!machine.qualityReworkQueue.length;
      if(!kind||machine.maintenanceRemainingMinutes>0||machine.maintenance<8||machine.tool<1||
        (machine.orderQueue.length>=MAX_QUEUED_ORDERS&&!canInterrupt))return false;
      const fault=breakdownSystem.getRecord(state,machine.bay);
      return !(fault?.fault&&(fault.status==='major_failure'||fault.status==='repairing'||
        (fault.status==='warning'&&!fault.riskyContinue&&!fault.scheduledRepair)));
    });
    const kinds=[...new Set(eligibleMachines.map(machine=>catalog[machine.type].kind))];
    const order=orderMarketSystem.createRushOrder(state,kinds);
    if(!order){state.nextRushOrderAt=state.gameMinutes+12*60;save();return false;}
    const id=`rush:${order.id}`;
    state.eventQueue.push({event:'rush_order',id,order,createdAt:state.gameMinutes});
    state.nextRushOrderAt=state.gameMinutes+72*60;
    state.paused=true;
    save();renderEventWindow();
    return true;
  }
  function officeOpenAt(minutes){
    const date=dateAt(minutes),weekday=date.getUTCDay(),hour=date.getUTCHours();
    return weekday>=1&&weekday<=5&&hour>=8&&hour<16;
  }
  function runOrderOffice(){
    const office=state.orderOffice;
    if(!office.hired||state.gameMinutes+1e-8<office.nextReviewAt)return;
    office.nextReviewAt=state.gameMinutes+ORDER_OFFICE_REVIEW_MINUTES;
    if(!officeOpenAt(state.gameMinutes)||currentPanel==='orders'||currentPanel==='warehouse'||pendingOrderAssignmentId)return;
    const offers=orderMarketSystem.getAvailable(state).slice().sort((a,b)=>a.expiresAt-b.expiresAt);
    const accepted=[];
    for(const order of offers){
      if(!office.autoAccept||state.machines.some(machine=>machine.activeId===order.id||machine.orderQueue.some(entry=>entry.order.id===order.id)))continue;
      if(!programReady(order)&&!state.programmer.hired)continue;
      const required=materialSystem.requiredKg(order),type=materialSystem.typeForOrder(order);
      if(!Number.isFinite(required)||required<=0||!type)continue;
      const base=materialSystem.catalog[type].pricePer100Kg/100,unit=materialSystem.pricePerKg(type,state.gameMinutes);
      if(unit===null||unit>base*(1+office.maxMarketMarkupPct/100)+1e-9||order.reward-required*unit<office.minMaterialSurplus)continue;
      const candidates=state.machines.filter(machine=>{
        const fault=breakdownSystem.getRecord(state,machine.bay);
        const faultBlocks=fault?.fault&&(fault.status==='major_failure'||fault.status==='repairing'||
          (fault.status==='warning'&&!fault.riskyContinue&&!fault.scheduledRepair));
        return compatible(machine,order)&&machine.maintenanceRemainingMinutes<=0&&machine.maintenance>=8&&machine.tool>=1&&!faultBlocks&&
        !machine.qualityReworkQueue.length&&machine.orderQueue.length<MAX_QUEUED_ORDERS&&(!job(machine)||machine.orderQueue.length<office.queueLimit);
      })
        .map(machine=>({machine,projection:plannedMachineLoad(machine,order)}))
        .filter(({projection})=>projection.shifts.length>0&&projection.deadlineChecks.length>0&&
          projection.deadlineChecks.every(check=>check.bufferMinutes>=Math.max(ORDER_OFFICE_MIN_DEADLINE_BUFFER_MINUTES,check.leadMinutes*ORDER_OFFICE_DEADLINE_BUFFER_RATIO)))
        .sort((a,b)=>a.projection.percent-b.projection.percent||
          (b.projection.critical?.bufferMinutes||0)-(a.projection.critical?.bufferMinutes||0)||a.machine.bay-b.machine.bay);
      const machine=candidates[0]?.machine;if(!machine)continue;
      const shortage=Math.max(0,required-materialSystem.available(state,order));
      if(shortage>1e-9){
        if(!office.autoPurchase||state.material+shortage>state.capacity+1e-9)continue;
        const cost=Math.round(unit*shortage*100)/100;
        if(state.money-cost<office.cashReserve-1e-9)continue;
        const added=inventorySystem.addMaterial(state,type,shortage);if(!added.ok)continue;
        if(!book('material',-cost,`${shortage.toLocaleString('de-DE')} kg ${materialSystem.catalog[type].label} durch Auftragsbüro gekauft`,{quantityKg:shortage,type,pricePerKg:unit,automatic:true}).ok){
          inventorySystem.removeMaterial(state,type,shortage);syncMaterialMirror();continue;
        }
        syncMaterialMirror();
      }
      if(startOrder(order.id,machine.bay,{automatic:true}))accepted.push(`${order.part} → Platz ${machine.bay}`);
    }
    if(accepted.length){save();say(`Auftragsbüro: ${accepted.length} Auftrag${accepted.length===1?'':'s'} automatisch angenommen (${accepted.join('; ')}).`);}
  }
  function cancelQueuedOrder(m,index){
    const entry=m?.orderQueue[index];if(!entry)return;
    const held=Object.values(entry.material).reduce((sum,amount)=>sum+amount,0);
    if(state.material+held>state.capacity+1e-9){say('Zum Zurücklegen des reservierten Materials fehlt Lagerplatz.');return;}
    if(!restoreOrderMaterial(entry.material))return;
    m.orderQueue.splice(index,1);
    save();renderOrders();renderBusiness();render();say('Vormerkung gelöst. Reserviertes Material ist zurück im Lager.');
  }
  function moveQueuedOrder(m,index,direction){
    if(!m||!Array.isArray(m.orderQueue))return;
    const target=index+direction;
    if(target<0||target>=m.orderQueue.length)return;
    [m.orderQueue[index],m.orderQueue[target]]=[m.orderQueue[target],m.orderQueue[index]];
    save();renderOrders();renderBusiness();render();
    say(`Auftrag auf Platz ${m.bay} in der Planung ${direction<0?'nach oben':'nach unten'} verschoben.`);
  }
  function buyMachine(type){
    const c=catalog[type],bay=expansionSystem.getFirstFreeBay(state);
    if(!c||!bay||state.money<c.price)return;
    const installed=expansionSystem.installMachine(state,freshMachine(bay,type));
    if(!installed.success)return;
    if(!book('machine_purchase',-c.price,`${c.name} gekauft`,{type,bay,purchasePrice:c.price}).ok){
      expansionSystem.uninstallMachine(state,bay);return;
    }
    breakdownSystem.init(state);
    selectBay(bay);renderBusiness();save();
    say(`${c.name} auf Platz ${bay} gekauft. Bediener zuweisen.`);
  }
  function sellMachine(){
    const m=selectedMachine();
    if(!m)return;
    if(m.maintenanceRemainingMinutes>0){say('Maschine erst nach Abschluss der Wartung verkaufen.');return;}
    if(job(m)||m.orderQueue.length||m.qualityReworkQueue.length){say('Laufende Aufträge und Qualitätsnacharbeit zuerst abschließen.');return;}
    const name=catalog[m.type].name,value=resaleValue(m),oldBay=m.bay;
    if(!book('machine_sale',value,`${name} verkauft`,{type:m.type,bay:oldBay,purchasePrice:Number.isFinite(m.purchasePrice)?m.purchasePrice:LEGACY_MACHINE_PRICES[m.type]}).ok)return;
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
  function setupNewGameConfirm(){
    if($('new-game-confirm'))return;
    const style=document.createElement('style');
    style.textContent='#new-game-confirm[hidden]{display:none!important}#new-game-confirm{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:16px;background:#02080bd9;backdrop-filter:blur(4px)}#new-game-confirm .new-game-card{width:min(100%,430px);padding:18px;border:1px solid #d5a055;border-radius:15px;background:linear-gradient(155deg,#203a45,#101e28);box-shadow:0 18px 65px #000c}#new-game-confirm .event-eyebrow{display:block;margin-bottom:5px;color:#ffd17b;font-size:10px;font-weight:900;letter-spacing:.12em}#new-game-confirm h2{margin:0 0 8px;font-size:20px}#new-game-confirm p{margin:6px 0 12px;color:#d2e0e4;font-size:13px;line-height:1.45}#new-game-confirm .new-game-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}#new-game-confirm #confirm-new-game{background:#6d3438;border-color:#b76368}';
    document.head.append(style);
    const overlay=document.createElement('section'),card=document.createElement('article');
    const eyebrow=document.createElement('span'),title=document.createElement('h2'),detail=document.createElement('p'),actions=document.createElement('div');
    const cancel=document.createElement('button'),confirm=document.createElement('button');
    overlay.id='new-game-confirm';overlay.hidden=true;overlay.setAttribute('role','alertdialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','new-game-confirm-title');overlay.setAttribute('aria-describedby','new-game-confirm-detail');
    card.className='new-game-card';eyebrow.className='event-eyebrow';eyebrow.textContent='SPIELSTAND';
    title.id='new-game-confirm-title';title.textContent='Neues Spiel starten?';
    detail.id='new-game-confirm-detail';detail.textContent='Der aktuelle Spielstand mit Maschinen, Material und Fortschritt wird gelöscht.';
    actions.className='new-game-actions';
    cancel.id='cancel-new-game';cancel.type='button';cancel.className='action';cancel.textContent='Abbrechen';
    confirm.id='confirm-new-game';confirm.type='button';confirm.className='action danger';confirm.textContent='Spielstand löschen';
    actions.append(cancel,confirm);card.append(eyebrow,title,detail,actions);overlay.append(card);document.querySelector('main').append(overlay);
    cancel.addEventListener('click',closeNewGameConfirm);
    confirm.addEventListener('click',confirmNewGame);
    overlay.addEventListener('click',event=>{if(event.target===overlay)closeNewGameConfirm();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!overlay.hidden)closeNewGameConfirm();});
  }
  function newGame(){
    setupNewGameConfirm();
    $('new-game-confirm').hidden=false;
    $('cancel-new-game').focus();
  }
  function closeNewGameConfirm(){
    const overlay=$('new-game-confirm');
    if(overlay)overlay.hidden=true;
    $('new-game').focus();
  }
  function confirmNewGame(){
    $('new-game-confirm').hidden=true;
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
    save();renderBusiness();render();say(`${employee.name}: Können ${level}/3 → ${skillLevel(employee)}/3 · +5 % Produktionstempo · ${euro(cost)} bezahlt.`);
  }
  function tick(dt){
    if(state.paused)return;
    // Slice at minute boundaries so shift changes and month end are charged exactly once.
    let left=dt*state.speed*GAME_MINUTES_PER_REAL_SECOND;
    while(left>1e-8&&!state.paused){
      const step=Math.min(left,1-(state.gameMinutes%1)||1);
      const before=dateAt(state.gameMinutes),shift=shiftAt(state.gameMinutes);
      if(shift)state.payrollDue+=state.staff['shift'+shift]*(shift===1?24:26)*step/60;
      if(state.orderOffice.hired&&officeOpenAt(state.gameMinutes))state.payrollDue+=ORDER_OFFICE_HOURLY_WAGE*step/60;
      if(state.programmer.hired&&shift===1)state.payrollDue+=PROGRAMMER_HOURLY_WAGE*step/60;
      const leader=shiftLeaderFor(shift);
      if(shift&&leader?.hired)state.payrollDue+=SHIFT_LEADER_HOURLY_WAGE*step/60;
      if(shift){for(const machine of state.machines)autoReplaceWornTool(machine,shift);runShiftLeaderAutomation(shift);}
      const storageCharge=state.material*STORAGE_RATE*step/1440;
      if(storageCharge>0){
        const dateKey=gameDateKey();
        book('storage',-storageCharge,'Lagerkosten',{gameDate:dateKey},`daily:storage:${dateKey}`);
        state.storagePaid+=storageCharge;
      }
      const faultEvents=breakdownSystem.tick(state,step,{operatingBays:state.machines.filter(readyToRun).map(m=>m.bay)});
      for(const event of faultEvents)handleBreakdownEvent(event);
      if(!state.paused&&shift===2){
        for(const machine of state.machines){
          if(!machine.loadingRobot||!robotAvailable(machine)||!readyToRun(machine)||!breakdownSystem.canContinueProduction(state,machine.bay))continue;
          const chance=1-Math.exp(-ROBOT_FAILURE_RATE_PER_HOUR*step/60);
          if(Math.random()<chance){
            handleRobotFailureEvent({event:'robot_failure',id:'robot_failure:'+machine.bay+':'+Math.floor(state.gameMinutes+step),bay:machine.bay,since:state.gameMinutes+step});
            if(state.paused)break;
          }
        }
      }
      if(!state.paused)tickProgrammer(step,shift);
      for(const m of state.machines){
        if(m.operatorProgramming){
          const task=m.operatorProgramming;
          if(!state.paused&&shift&&m['operator'+shift]&&assignedEmployee(m,shift)&&breakdownSystem.canContinueProduction(state,m.bay)){
            task.remainingMinutes=Math.max(0,task.remainingMinutes-step);
            if(task.remainingMinutes<=1e-8){
              completeNcProgram(task,'operator');m.operatorProgramming=null;
              say(`NC-Programm für ${task.part} fertig. ${catalog[m.type].name} kann jetzt fertigen.`);save();renderOrders();
            }
          }
          continue;
        }
        if(!job(m)&&m.qualityReworkQueue.length){processQualityRework(m,step,shift);continue;}
        if(!job(m)&&m.orderQueue.length)startNextQueuedOrder(m);
        const o=job(m);
        if(!o)continue;
        if(!programReady(o)){
          if(!m.operatorProgramming&&!programTaskFor(programKey(o)))scheduleActiveOrderProgramming(m,o);
          continue;
        }
        if(!m.setupPartProduced&&m.setupRemainingMinutes<=0)beginMachineSetup(m,o);
        if(!operating(m))continue;
        const power=(MACHINE_POWER_COST_PER_HOUR+(shift===2&&m.loadingRobot?ROBOT_POWER_COST_PER_HOUR:0))*step/60;
        const dateKey=gameDateKey();
        book('energy',-power,'Stromkosten laufende Maschinen',{gameDate:dateKey},`daily:energy:${dateKey}`);
        state.energyPaid+=power;
        const employee=assignedEmployee(m,shift);
        const factor=productionFactor(m);
        let productionStep=step;
        if(m.setupRemainingMinutes>0){
          const setupStep=Math.min(step,m.setupRemainingMinutes);
          m.setupRemainingMinutes=Math.max(0,m.setupRemainingMinutes-setupStep);
          productionStep=Math.max(0,productionStep-setupStep);
          if(m.setupRemainingMinutes<=1e-8){
            m.setupRemainingMinutes=0;
            if(!m.setupPartProduced){
              m.setupPartProduced=true;
              const firstPartProgress=100/Math.max(1,o.qty);
              m.progress=Math.max(m.progress,firstPartProgress);
              m.produced=Math.min(o.qty,Math.max(1,Math.floor(o.qty*m.progress/100)));
              m.maintenance=Math.max(0,m.maintenance-firstPartProgress*.12);
              m.tool=Math.max(0,m.tool-firstPartProgress*.18*recruitmentSystem.toolWearMultiplier(employee));
            }
          }
        }
        if(productionStep>1e-8){
          const gain=100/o.duration*(productionStep/6)*factor;
          m.progress=Math.min(100,m.progress+gain);
          m.produced=Math.max(m.produced,Math.min(o.qty,Math.floor(o.qty*m.progress/100)));
          m.maintenance=Math.max(0,m.maintenance-gain*.12);
          m.tool=Math.max(0,m.tool-gain*.18*recruitmentSystem.toolWearMultiplier(employee));
        }
        if(employee)employee.xp=Math.round((employee.xp+step*recruitmentSystem.learningMultiplier(employee))*1000)/1000;
        if(m.progress>=100){
          if(m.qualityInspectedOrderId!==o.id){
            const riskPct=qualityRiskFor(m,o),defects=programmingQuality.defectParts(o,riskPct);
            if(defects>0){
              m.qualityInspectedOrderId=o.id;
              const event={event:'quality_issue',id:`quality_issue:${o.id}`,bay:m.bay,order:{...o},riskPct,defectParts:defects,
                reworkCost:Math.max(250,Math.round(o.reward*defects/Math.max(1,o.qty)*.55)),createdAt:state.gameMinutes+step};
              if(!state.eventQueue.some(item=>item.id===event.id))state.eventQueue.push(event);
              state.paused=true;renderEventWindow();save();break;
            }
          }
          finishOrder(m,o,null,state.gameMinutes+step);
        }
      }
      state.gameMinutes+=step;left-=step;
      for(const m of state.machines){
        if(m.robotRepairRemainingMinutes>0){
          m.robotRepairRemainingMinutes=Math.max(0,m.robotRepairRemainingMinutes-step);
          if(m.robotRepairRemainingMinutes===0&&m.robotFault){
            m.robotFault=false;save();
            say('Platz '+m.bay+': Laderoboter wieder einsatzbereit.');
          }
        }
        if(!(m.maintenanceRemainingMinutes>0))continue;
        m.maintenanceRemainingMinutes=Math.max(0,m.maintenanceRemainingMinutes-step);
        if(m.maintenanceRemainingMinutes===0){
          m.maintenance=100;
          save();
          say(`Platz ${m.bay}: vorbeugende Wartung abgeschlossen.`);
        }
      }
      orderMarketSystem.tick(state,state.gameMinutes);
      runOrderOffice();
      queueDueQualityComplaints();
      maybeQueueRushOrderEvent();
      const after=dateAt(state.gameMinutes);
      if(after.getUTCMonth()!==before.getUTCMonth()||after.getUTCFullYear()!==before.getUTCFullYear()){
        serviceMonthlyCredit();
        if(state.payrollDue){
          book('wages',-state.payrollDue,'Monatliche Lohnabrechnung',{period:`${before.getUTCFullYear()}-${String(before.getUTCMonth()+1).padStart(2,'0')}`});
          state.wagesPaid+=state.payrollDue;
          say(`Monatliche Lohnabrechnung: −${euro(state.payrollDue)}.`);
          state.payrollDue=0;save();
        }
      }
    }
    render();
    if(currentPanel==='orders'&&ordersRenderKey()!==lastOrdersRenderKey)renderOrders();
    if(currentPanel==='orders'){
      updateOrderCountdowns();
      updateMachineLoadCards();
      updateAssignmentLoads();
    }
    if(currentPanel==='business'||currentPanel==='warehouse')renderCosts();
    if(currentPanel==='business'){updateStaffDevelopment();renderProgrammer();renderCreditPanel();if(shiftLeaderAdviceKey!==shiftLeaderStateKey())renderShiftLeader();}
  }
  function tryShiftLeaderRepair(event){
    const shift=shiftAt(state.gameMinutes),leader=shiftLeaderFor(shift);
    if(!leader?.hired||!leader.autoBreakdowns)return false;
    const options=breakdownSystem.getRepairOptions(state,event.bay);
    if(!options)return false;
    const selfChance=Number(options.self.failureChance);
    const selfAllowed=!event.selfRepairFailed&&options.self.allowed!==false&&Number.isFinite(selfChance);
    let action=null;
    if(selfAllowed&&selfChance>=.9&&options.self.cost<=leader.spendingLimit&&options.self.cost<=state.money&&
      options.self.cost<=options.technician.cost&&options.self.downtime<options.technician.downtime){
      action='repairSelf';
    }else if(options.technician.cost<=leader.spendingLimit&&options.technician.cost<=state.money){
      action='repairTechnician';
    }else if(selfAllowed&&selfChance>=.72&&options.self.cost<=leader.spendingLimit&&options.self.cost<=state.money){
      action='repairSelf';
    }
    if(!action)return false;
    const started=chooseBreakdown(action,event.bay);
    if(started)say('Schichtleiter S'+shift+' hat die Reparatur auf Platz '+event.bay+' selbst eingeleitet.');
    return started;
  }
  function resolveRobotFailureEvent(event,method,automatic=false){
    const machine=machineAt(event?.bay);
    if(!machine||!machine.loadingRobot)return false;
    let duration;
    if(method==='technician'){
      if(state.money<ROBOT_TECHNICIAN_COST)return false;
      const payment=book('repairs',-ROBOT_TECHNICIAN_COST,'Laderoboter repariert',{bay:machine.bay,type:machine.type,method:'technician'});
      if(!payment.ok)return false;
      duration=ROBOT_TECHNICIAN_MINUTES[0]+Math.floor(Math.random()*(ROBOT_TECHNICIAN_MINUTES[1]-ROBOT_TECHNICIAN_MINUTES[0]+1));
    }else{
      duration=ROBOT_RESTART_MINUTES[0]+Math.floor(Math.random()*(ROBOT_RESTART_MINUTES[1]-ROBOT_RESTART_MINUTES[0]+1));
    }
    machine.robotFault=true;machine.robotRepairRemainingMinutes=duration;
    const eventIndex=state.eventQueue.findIndex(item=>item.id===event.id);
    if(eventIndex>=0)state.eventQueue.splice(eventIndex,1);
    state.paused=state.eventQueue.length>0;
    say((automatic?'Schichtleiter S2 hat den Laderoboter':'Laderoboter')+' auf Platz '+machine.bay+
      (method==='technician'?' durch den Servicetechniker reparieren lassen':' neu gestartet')+' · wieder einsatzbereit in '+formatMinutes(duration)+'.');
    save();render();renderBusiness();renderEventWindow();
    return true;
  }
  function handleRobotFailureEvent(event){
    const machine=machineAt(event?.bay);
    if(!machine||!machine.loadingRobot)return false;
    machine.robotFault=true;
    const leader=shiftLeaderFor(2);
    if(leader?.hired&&leader.autoBreakdowns){
      const method=leaderCanSpend(leader,ROBOT_TECHNICIAN_COST)?'technician':'restart';
      if(resolveRobotFailureEvent(event,method,true))return true;
    }
    state.eventQueue=Array.isArray(state.eventQueue)?state.eventQueue:[];
    if(!state.eventQueue.some(item=>item.id===event.id))state.eventQueue.push(event);
    state.paused=true;save();renderEventWindow();
    return true;
  }
  function handleBreakdownEvent(event){
    if(!event)return;
    if(event.cost>0&&['repair','repair_scheduled','major_failure'].includes(event.event)){
      const method=event.method==='technician'?'Monteur':event.method==='self'?'Selbstreparatur':event.event==='major_failure'?'Maschinenschaden':'geplante Reparatur';
      book('repairs',-event.cost,`Platz ${event.bay}: ${method} · ${breakdownSystem.getFaultInfo(event.fault)?.label||'Reparatur'}`,{bay:event.bay,fault:event.fault,event:event.event,method,downtime:event.downtime});
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
      if(tryShiftLeaderRepair(event)){save();return;}
      state.speed=1;
      state.eventQueue=Array.isArray(state.eventQueue)?state.eventQueue:[];
      const id=event.id||`${event.event}:${event.bay}:${event.since??state.gameMinutes}`;
      if(!state.eventQueue.some(item=>item.id===id))state.eventQueue.push({...event,id});
      state.paused=true;
      renderEventWindow();
    }else if(event.event==='repair_complete')say(`Platz ${event.bay}: Reparatur abgeschlossen.`);
    save();
  }
  function chooseBreakdown(action,bay=selectedMachine()?.bay,eventId=null){
    const m=machineAt(Number(bay));if(!m)return false;
    const before=breakdownSystem.getRecord(state,m.bay);
    const event=breakdownSystem[action](state,m.bay);
    if(!event)return false;
    if(event.cost>0&&state.money<event.cost){
      state.breakdowns.machines[String(m.bay)]=before;
      say(`Für diese Reparatur fehlen ${euro(event.cost-state.money)}.`);
      return false;
    }
    handleBreakdownEvent(event);
    if(event.event==='repair')say(`Platz ${m.bay}: ${event.method==='technician'?'Monteur beauftragt':'Selbstreparatur gestartet'} · ${euro(event.cost)} · ${formatMinutes(event.downtime)}.`);
    if(event.event==='repair_scheduled')say(`Platz ${m.bay}: Reparatur eingeplant · ${euro(event.cost)}.`);
    if(event.event==='continue_risky')say(`Platz ${m.bay}: Produktion läuft mit erhöhtem Risiko weiter.`);
    if(eventId){
      const index=state.eventQueue.findIndex(item=>item.id===eventId);
      if(index>=0)state.eventQueue.splice(index,1);
      state.paused=state.eventQueue.length>0;
      save();
    }
    render();renderBusiness();
    return true;
  }
  for(const name of ['orders','machine','business'])
    $(name+'-tab').addEventListener('click',()=>currentPanel===name?closeDrawer():tab(name));
  document.querySelectorAll('.business-section-tab').forEach(button=>button.addEventListener('click',()=>setBusinessSection(button.dataset.businessSection)));
  $('open-recruitment').addEventListener('click',()=>tab('recruitment'));
  $('open-warehouse-from-business').addEventListener('click',()=>tab('warehouse'));
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
  $('assignment-close').addEventListener('click',closeOrderMachineChooser);
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
    syncMaterialMirror();save();render();renderBusiness();renderOrders();renderWarehouseOrderContext();say(`${quantity} kg ${materialSystem.catalog[type].label} für ${euroExact(price)} eingelagert.`);
  });
  $('material-quantity').addEventListener('change',renderMaterialPrice);
  $('finance-period').addEventListener('change',renderFinance);
  $('change-tool').addEventListener('click',()=>changeMachineTool(selectedMachine()));
  $('buy-spare-tool').addEventListener('click',()=>{
    const m=selectedMachine();if(!canBuySpareTool(m))return;
    const added=inventorySystem.addTool(state,m.type,1);
    if(!added.ok){say(added.code==='capacity_exceeded'?'Werkzeuglager ist voll.':'Ersatzwerkzeug konnte nicht eingelagert werden.');return;}
    if(!book('tools',-650,'Ersatzwerkzeug auf Reserve gekauft',{bay:m.bay,type:m.type}).ok){inventorySystem.consumeTool(state,m.type,1);return;}
    save();render();say(`Ersatzwerkzeug für ${catalog[m.type].name} auf Reserve gelegt.`);
  });
  $('maintenance').addEventListener('click',()=>startPreventiveMaintenance(selectedMachine()));
  $('upgrade').addEventListener('click',()=>{
    const m=selectedMachine();if(!m)return;const cost=9000*m.level;if(state.money<cost)return;
    if(!book('other',-cost,`${catalog[m.type].name} Upgrade`,{bay:m.bay,level:m.level+1}).ok)return;
    m.level++;save();render();say(`${catalog[m.type].name} verbessert.`);
  });
  $('sell-machine').addEventListener('click',sellMachine);
  $('buy-robot').addEventListener('click',buyRobot);
  $('expand-factory').addEventListener('click',expandFactory);
  $('loan-amount').addEventListener('change',renderCreditPanel);
  $('take-loan').addEventListener('click',takeCredit);
  $('repay-credit').addEventListener('click',repayCredit);
  $('repair-now').addEventListener('click',()=>chooseBreakdown('repairSelf'));
  $('hire-programmer').addEventListener('click',hireProgrammer);
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
  setupEventWindow();schedulePlannedPrograms();renderOrders();renderBusiness();render();
  class FactoryScene extends (typeof Phaser==='undefined'?class{}:Phaser.Scene) {
    constructor(){super('factory');this.running=false;this.condition='idle';this.elapsed=0;}
    preload(){
      this.load.image('machine-standard','cell-nexora.jpg?v=c523bfea');
      this.load.image('machine-rapid','cell-nexora-nx420.webp?v=1');
      this.load.image('machine-premium','cell-aurex-at600.webp?v=1');
      this.load.image('machine-standard-robot','cell-nexora-robot.webp?v=1');
      this.load.image('machine-rapid-robot','cell-nexora-nx420-robot.webp?v=1');
      this.load.image('machine-premium-robot','cell-aurex-at600-robot.webp?v=1');
      this.load.image('machine-mill3','assets/veltron-vx500-detail-hd.png?v=1');
      this.load.image('machine-mill5','assets/orionis-om650x-detail-hd.webp?v=1');
      this.load.image('loading-robot','assets/loading-robot.webp?v=1');
    }
    create(){
      visual=this;
      const base=this.add.graphics();
      base.fillGradientStyle(0x253943,0x253943,0x101e29,0x101e29).fillRect(0,0,1000,800);
      this.machineImage=this.add.image(500,400,'machine-standard').setDisplaySize(1000,836);
      this.coolantZones={
        standard:{source:[475,362],target:[420,374],points:[[354,298],[527,356],[530,491],[354,423]]},
        rapid:{source:[495,350],target:[410,365],points:[[352,286],[552,325],[565,448],[353,439]]},
        premium:{source:[520,340],target:[435,365],points:[[327,230],[579,303],[548,420],[327,357]]},
        mill3:{source:[520,286],target:[512,365],points:[[365,222],[526,222],[526,530],[365,530]]}
      };
      this.coolantJet=this.add.graphics();
      this.coolantSplash=this.add.graphics();
      this.coolantMaskShape=this.make.graphics({x:0,y:0,add:false});
      this.coolantMask=this.coolantMaskShape.createGeometryMask();
      this.coolantSprayEndpoints=[];
      this.coolantJet.setMask(this.coolantMask);this.coolantSplash.setMask(this.coolantMask);
      this.coolantParticles=Array.from({length:58},(_,index)=>{
        const glassDrop=index>=18&&index<42,splashDrop=index>=50;
        const size=glassDrop?Phaser.Math.FloatBetween(3.5,4.8):splashDrop?Phaser.Math.FloatBetween(3.3,5.8):Phaser.Math.FloatBetween(2.2,3.5);
        const sprite=this.add.ellipse(0,0,size,size*(glassDrop?1.2:1),glassDrop?0xf1f3ed:0xe1edf0,.95).setStrokeStyle(1,0x586e74,glassDrop?.8:.8).setMask(this.coolantMask);
        return {sprite,glassDrop,splashDrop,dropIndex:index,dripping:false,dripProgress:0,lastBurstCycle:-1,anchorX:0,anchorY:0,progress:Math.random(),phase:Math.random()*Math.PI*2,speed:2.2+Math.random()*2.8};
      });
      this.spindle=this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      this.sparks=Array.from({length:20},()=>{
        const p=this.add.circle(440,385,Phaser.Math.FloatBetween(.8,2.3),0x9cefff,0).setBlendMode(Phaser.BlendModes.ADD);
        return {sprite:p,phase:Math.random()*Math.PI*2,radius:12+Math.random()*57,speed:1+Math.random()*2};
      });
      this.towerRed=this.add.circle(199,29,8,0xff5b62,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.towerAmber=this.add.circle(199,45,8,0xffc15b,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.towerGreen=this.add.circle(199,61,8,0x6cff98,.08).setBlendMode(Phaser.BlendModes.ADD);
      this.isMilling=false;
      this.coolantEnabled=false;
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
      this.robotShadow=this.add.ellipse(0,0,200,22,0x10191c,.42).setVisible(false);
      this.robotImage=this.add.image(200,502,'loading-robot').setDisplaySize(470,510).setFlipX(true).setVisible(false);
      render();
    }
    setMachineType(type,loadingRobot=false){
      const milling=catalog[type].kind==='Fräsen';
      this.isMilling=milling;
      this.coolantEnabled=!milling||type==='mill3';
      if(this.coolantEnabled&&this.coolantZones&&this.coolantZoneType!==type){
        const zone=this.coolantZones[type]||this.coolantZones.standard;
        this.coolantSource=zone.source;this.coolantTarget=zone.target;
        this.coolantWindowPolygon=new Phaser.Geom.Polygon(zone.points);
        this.coolantMaskShape.clear().fillStyle(0xffffff,1).fillPoints(zone.points.map(([x,y])=>new Phaser.Geom.Point(x,y)),true);
        this.coolantSprayEndpoints=[];
        this.coolantZoneType=type;
      }
      const robotLayout=type==='mill3'?{x:250,y:560,width:460,height:460}:milling?{x:335,y:550,width:370,height:320}:
        {x:type==='standard'?200:215,y:502,width:470,height:510};
      this.robotImage.setPosition(robotLayout.x,robotLayout.y).setDisplaySize(robotLayout.width,robotLayout.height);
      this.robotShadowEnabled=type==='mill3';
      this.robotShadow.setPosition(robotLayout.x-robotLayout.width*.18,robotLayout.y+robotLayout.height*.42);
      this.millGroup.setVisible(false);
      this.machineImage.setVisible(true);
      const key='machine-'+type+(loadingRobot&&!milling?'-robot':'');
      if(this.machineImage.texture.key!==key)this.machineImage.setTexture(key);
      if(milling){
        const source=this.machineImage.texture.getSourceImage();
        const sourceWidth=source.naturalWidth||source.width,sourceHeight=source.naturalHeight||source.height;
        const closeupScale=Math.max(1000/sourceWidth,800/sourceHeight)*1.04;
        this.machineImage.setScale(closeupScale).setPosition(500,400);
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
      this.robotShadow.setVisible(!!this.robotEnabled&&!!this.robotShadowEnabled);
      if(this.robotEnabled)this.robotImage.setAngle(on&&shiftAt(state.gameMinutes)===2?Math.sin(this.elapsed*2)*1.4:0);
      if(on&&!this.isMilling){
        this.spindle.lineStyle(3,0x97e6ff,.55).beginPath().arc(445,377,31,this.elapsed*9,this.elapsed*9+1.7).strokePath();
        this.spindle.lineStyle(2,0xffffff,.32).beginPath().arc(445,377,22,-this.elapsed*13,-this.elapsed*13+1.25).strokePath();
      }
      const coolantOn=on&&this.coolantEnabled;
      const coolantPulsePeriod=1.15;
      const coolantPulseDuration=.8;
      const coolantPhase=(this.elapsed%coolantPulsePeriod)/coolantPulsePeriod;
      const coolantCycle=Math.floor(this.elapsed/coolantPulsePeriod);
      const sprayProgress=coolantPhase<coolantPulseDuration?coolantPhase/coolantPulseDuration:0;
      const burst=sprayProgress>0?Math.sin(Math.PI*sprayProgress):0;
      this.coolantJet.clear();this.coolantSplash.clear();
      if(coolantOn&&this.coolantSource&&this.coolantTarget){
        const [sx,sy]=this.coolantSource,[tx,ty]=this.coolantTarget;
        const pulse=.72+.28*burst;
        const endX=tx+Math.sin(this.elapsed*8)*3,endY=ty+Math.cos(this.elapsed*7)*2;
        const bendX=(sx+endX)*.5+2,bendY=(sy+endY)*.5+3+Math.sin(this.elapsed*6)*1.5;
        const streamPoint=t=>({x:(1-t)*(1-t)*sx+2*(1-t)*t*bendX+t*t*endX,y:(1-t)*(1-t)*sy+2*(1-t)*t*bendY+t*t*endY});
        this.coolantJet.lineStyle(7,0x33464d,.9).lineBetween(sx+5,sy-2,sx+2,sy-1);
        this.coolantJet.lineStyle(3.5,0x80969c,.95).lineBetween(sx+5,sy-2,sx+2,sy-1);
        this.coolantJet.fillStyle(0x263940,1).fillCircle(sx+2,sy-1,3.5);
        for(let segment=0;segment<8;segment++){
          const a=streamPoint(segment/8),b=streamPoint((segment+1)/8);
          const taper=segment<5?1:1-(segment-4)*.12;
          this.coolantJet.lineStyle(7.2*taper,0x9eafae,.84*pulse).lineBetween(a.x,a.y,b.x,b.y);
          this.coolantJet.lineStyle(2.2*taper,0xf0f2e9,.88*pulse).lineBetween(a.x,a.y,b.x,b.y);
        }
        const hitX=endX,hitY=endY;
        if(burst>.02){
          const fan=12+44*sprayProgress;
          const sprayAxis=Math.atan2(sy-ty,sx-tx);
          const endpoints=[];
          for(let drop=0;drop<16;drop++){
            const angle=sprayAxis+(drop/15-.5)*2.05+Math.sin(this.elapsed*12+drop)*.16;
            const length=fan*(.3+((drop*7)%11)/13);
            const ex=hitX+Math.cos(angle)*length,ey=hitY+Math.sin(angle)*length;
            if(Phaser.Geom.Polygon.Contains(this.coolantWindowPolygon,ex,ey))endpoints.push({x:ex,y:ey});
            for(let bead=0;bead<3;bead++){
              const along=.35+bead*.28;
              const bx=hitX+(ex-hitX)*along+Math.sin(drop*2.3+bead*1.7)*2;
              const by=hitY+(ey-hitY)*along+Math.cos(drop*1.9+bead*2.1)*2;
              this.coolantSplash.fillStyle(bead===2?0xf0f2e9:0xc9d7d4,(.48+bead*.12)*burst)
                .fillCircle(bx,by,bead===2?2.1:1.4);
            }
            this.coolantSplash.fillStyle(0xf0f2e9,.75*burst).fillCircle(ex,ey,drop%3===0?2.4:1.6);
          }
          if(endpoints.length)this.coolantSprayEndpoints=endpoints;
          this.coolantSplash.fillStyle(0xeaf5f6,.3+.3*burst).fillCircle(hitX,hitY,4+4*burst);
        }
      }
      this.coolantParticles.forEach(p=>{
        if(!coolantOn){p.sprite.setAlpha(0);return;}
        p.progress+=dt*p.speed;
        if(p.progress>=1)p.progress-=1;
        const t=p.progress,[sx,sy]=this.coolantSource,[tx,ty]=this.coolantTarget;
        if(p.glassDrop){
          const endpoints=this.coolantSprayEndpoints;
          if(!p.dripping&&Math.floor((p.dropIndex-18)/4)===coolantCycle%6&&p.lastBurstCycle!==coolantCycle&&coolantPhase>.4&&coolantPhase<coolantPulseDuration&&endpoints.length){
            const groupIndex=(p.dropIndex-18)%4;
            const anchor=endpoints[Math.round(groupIndex*(endpoints.length-1)/3)];
            p.anchorX=anchor.x;p.anchorY=anchor.y;p.dripping=true;p.dripProgress=0;p.lastBurstCycle=coolantCycle;
          }
          if(p.dripping){
            p.dripProgress=Math.min(1,p.dripProgress+dt*.45);
            const drip=p.dripProgress,fade=Math.min(1,(1-drip)*4);
            const x=p.anchorX+Math.sin(this.elapsed*1.7+p.phase)*.4;
            const y=p.anchorY+drip*48;
            p.sprite.setPosition(x,y).setAngle(Math.PI/2).setScale(1,1+drip*.25);
            p.sprite.setAlpha(.92*fade);
            if(drip>=1)p.dripping=false;
          }else p.sprite.setAlpha(0);
        }else if(p.splashDrop){
          const active=sprayProgress;
          const radius=7+active*(20+(p.phase%23));
          const spread=p.phase;
          p.sprite.setPosition(tx+Math.cos(spread)*radius,ty+Math.sin(spread)*radius+active*active*8)
            .setAngle(spread).setScale(1+active*.45);
          p.sprite.setAlpha(.95*burst);
        }else{
          const jitter=Math.sin(t*10+p.phase)*3.4;
          const x=sx+(tx-sx)*t+jitter;
          const y=sy+(ty-sy)*t+9*t*t;
          p.sprite.setPosition(x,y).setAngle(Math.atan2(ty-sy,tx-sx)+Math.sin(this.elapsed*7+p.phase)*.22).setScale(.9,1.2);
          p.sprite.setAlpha(Math.sin(Math.PI*t)*(.52+.4*burst));
        }
      });
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
    if(accumulator>=.1){
      const elapsed=accumulator;accumulator=0;
      try{tick(elapsed);}catch(error){
        console.error('Simulationsschritt fehlgeschlagen; Spielstand wird pausiert gesichert.',error);
        state.paused=true;
        try{save();render();}catch(recoveryError){console.error('Spielstand konnte nach dem Fehler nicht dargestellt werden.',recoveryError);}
        say('Technischer Fehler im Spielablauf. Spielstand wurde gesichert; bitte die Seite neu laden.');
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setInterval(save,5000);
  window.cncFactory={
    getState:()=>JSON.parse(JSON.stringify(state)),
    get orders(){return orderMarketSystem.getAvailable(state).map(order=>({...order}));}
  };
})();
