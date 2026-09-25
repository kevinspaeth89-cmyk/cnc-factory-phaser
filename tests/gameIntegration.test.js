const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir=require('node:path').resolve(__dirname,'..');
const html=fs.readFileSync(dir+'/index.html','utf8'), ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
assert.ok(html.indexOf('id="warehouse-panel"')<html.indexOf('id="buy-material"'));
assert.ok(html.indexOf('id="business-panel"')<html.indexOf('id="warehouse-panel"'));
assert.ok(html.indexOf('id="storage-stock"')<html.indexOf('id="buy-material"'));
assert.ok(html.indexOf('id="warehouse-panel"')>html.indexOf('id="machine-shop"'));
assert.ok(html.indexOf('id="buy-material"')<html.indexOf('id="storage-upgrade"'));
assert.equal(ids.includes('material-type'),false);
assert.ok(ids.includes('recruitment-panel'));
assert.ok(ids.includes('applicant-list'));
assert.equal(ids.includes('hire-1'),false);
assert.equal(ids.includes('hire-2'),false);
function boot(storage,options={}){
  const elements=new Map();
  class El {
    constructor(id=''){
      this.id=id;this.children=[];this.style={};this.attrs={};this.dataset={};this.events={};this.hidden=false;
      const classes=new Set();
      this.classList={
        add:(...names)=>names.forEach(name=>classes.add(name)),
        remove:(...names)=>names.forEach(name=>classes.delete(name)),
        contains:name=>classes.has(name),
        toggle:(name,force)=>{
          const present=force===undefined?!classes.has(name):!!force;
          if(present)classes.add(name);else classes.delete(name);
          return present;
        }
      };
      this.textContent='';
    }
    addEventListener(type,fn){this.events[type]=fn}
    append(...children){this.children.push(...children);for(const child of children)if(child.id)elements.set(child.id,child)}
    prepend(...children){this.children.unshift(...children)}
    replaceChildren(...children){this.children=children}
    querySelector(q){return q==='span'?this.children.find(x=>x.tagName==='span')||this.children[0]:this.children.find(x=>x.className===q.slice(1))||null}
    getAttribute(name){return this.attrs[name]||null}
    setAttribute(name,value){this.attrs[name]=value}
    click(){assert(this.events.click,this.id);this.events.click({stopPropagation(){}})}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new El(id));return elements.get(id)};
  for(const id of ids)get(id);get('material-quantity').value='25';get('finance-period').value='day';
  get('detail-view').hidden=true;get('hall-preview').hidden=true;
  get('hall-map').clientWidth=400;get('hall-map').clientHeight=400;
  get('hall-preview').offsetWidth=190;get('hall-preview').offsetHeight=118;
  for(let bay=1;bay<=4;bay++){const span=new El();span.tagName='span';get('bay-'+bay).append(span)}
  const document={getElementById:get,createElement:()=>new El(),querySelectorAll:()=>[],addEventListener(){}};
  let nextFrame=()=>{},saveInterval=()=>{};
  const windowEvents={};
  const context={document,console,Date,Math,JSON,performance:{now:()=>0},requestAnimationFrame:fn=>nextFrame=fn,setTimeout:(fn,ms)=>{if(options.phaser&&ms===0)fn();return 1},clearTimeout(){},setInterval:fn=>saveInterval=fn,window:{matchMedia:()=>({matches:true}),confirm:()=>true,addEventListener:(type,fn)=>windowEvents[type]=fn},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},CNCModules:{economy:require(dir+'/systems/economy.js').economy,inventory:require(dir+'/systems/economy.js').inventory,orderMarket:require(dir+'/systems/orderMarket.js'),breakdowns:require(dir+'/systems/breakdowns.js'),factoryExpansion:require(dir+'/factory-expansion.js'),materials:require(dir+'/systems/materials.js'),recruitment:require(dir+'/systems/recruitment.js')}};
  if(options.phaser)context.Phaser={Scene:class{},Game:class{},AUTO:0,Scale:{FIT:0,CENTER_BOTH:0}};
  context.globalThis=context;context.window.cncFactory=null;
  vm.runInNewContext(fs.readFileSync(dir+'/game.js','utf8'),context,{filename:'game.js'});
  return {get,frame:t=>nextFrame(t),flush:()=>saveInterval(),resize:()=>windowEvents.resize?.(),state:()=>JSON.parse(storage.cnc_factory_save_v3)};
}
let storage={cnc_factory_save_v3:JSON.stringify({money:14000,material:120,capacity:300,staff:{shift1:1,shift2:0},machines:[{bay:2,type:'standard',level:1,maintenance:50,tool:82,operator1:true,operator2:false,activeId:'A12',progress:25,produced:12,deadlineAt:420}],selectedBay:2,gameMinutes:0,speed:1,paused:false,breakdowns:{machines:{2:{status:'warning',fault:'sensor_error',severity:1,since:0,riskyContinue:false,scheduledRepair:false,operatingHours:1,warningAgeMinutes:0,repairRemainingMinutes:0,plannedRepair:false}}}})};
let app=boot(storage),st=app.state();assert.equal(st.breakdowns.machines['2'].status,'warning');assert.equal(app.get('repair-now').disabled,false);
assert.equal(st.staffRoster.shift1.length,1);
assert.equal(st.staffRoster.shift1[0].assignedBay,2);
assert.equal(ids.includes('hall-preview-open'),false);
app.get('bay-2').click();
assert.match(app.get('hall-preview-job').textContent,/12\/\d+ Teile/);
assert.match(app.get('hall-preview-time').textContent,/Rest .* · Frist /);
assert.equal(app.get('hall-preview-time').hidden,false);
assert.equal(app.get('hall-preview-progress-fill').style.width,'25%');
assert.equal(app.get('hall-preview-tool-fill').style.width,'82%');
assert.equal(app.get('hall-preview-maintenance-fill').style.width,'50%');
assert.equal(app.get('hall-preview-progress-bar').attrs['aria-valuenow'],'25');
assert.match(app.get('hall-preview-operators').textContent,/S1 ✓ · S2 –/);
app.get('repair-now').click();st=app.state();assert.equal(st.breakdowns.machines['2'].status,'repairing');assert.equal(st.money,13390);assert.equal(st.finance.transactions.filter(x=>x.category==='repairs').length,1);
app=boot(storage);st=app.state();assert.equal(st.money,13390);assert.equal(st.breakdowns.machines['2'].status,'repairing');assert.equal(st.finance.transactions.filter(x=>x.category==='repairs').length,1);assert.equal(st.machines[0].activeId,'A12');
app.frame(1000);st=app.state();assert.equal(st.breakdowns.machines['2'].status,'repairing');assert.equal(st.finance.transactions.filter(x=>x.category==='repairs').length,1);
const wornSave={money:25000,material:120,capacity:300,staff:{shift1:1,shift2:0},
  machines:[{bay:1,type:'standard',level:1,maintenance:36,tool:.5,operator1:true,operator2:false,activeId:'A12',progress:45,produced:22,deadlineAt:420}],
  selectedBay:1,gameMinutes:0,speed:1,paused:false};
const wornStorage={cnc_factory_save_v3:JSON.stringify(wornSave)};
let worn=boot(wornStorage);
assert.match(worn.get('machine-meta').textContent,/Werkzeug verschlissen/);
assert.equal(worn.get('tool-label').textContent,'<1 %');
assert.equal(worn.get('change-tool').disabled,false);
assert.equal(worn.get('maintenance').disabled,true);
worn.get('change-tool').click();
let repaired=worn.state();
assert.equal(repaired.money,24350);
assert.equal(repaired.machines[0].tool,100);
assert.equal(repaired.machines[0].activeId,'A12');
assert.equal(repaired.machines[0].progress,45);
assert.equal(repaired.finance.transactions.filter(x=>x.category==='tools').length,1);
worn=boot(wornStorage);
repaired=worn.state();
assert.equal(repaired.machines[0].activeId,'A12');
assert.equal(repaired.machines[0].tool,100);
assert.equal(repaired.finance.transactions.filter(x=>x.category==='tools').length,1);
assert.equal(worn.get('change-tool').disabled,true);
const dueStorage={cnc_factory_save_v3:JSON.stringify({...wornSave,machines:[{...wornSave.machines[0],tool:100,maintenance:7.5}]})};
let due=boot(dueStorage);
assert.equal(due.get('maintenance').disabled,false);
assert.equal(due.get('change-tool').disabled,true);
due.get('maintenance').click();
assert.equal(due.state().money,23800);
assert.equal(due.state().machines[0].maintenance,100);
assert.equal(due.state().machines[0].activeId,'A12');
assert.equal(due.state().machines[0].progress,45);
due=boot(dueStorage);
assert.equal(due.state().finance.transactions.filter(x=>x.category==='maintenance').length,1);
assert.equal(due.state().machines[0].activeId,'A12');
const empty=boot({});assert.equal(empty.state().machines.length,0);assert.equal(empty.state().material,0);assert.deepEqual(Object.keys(empty.state().breakdowns.machines),[]);
assert.equal(empty.state().selectedMaterialType,'c45');
assert.equal(empty.state().staffRoster.shift1.length,0);
empty.get('bay-1').click();assert.equal(empty.get('hall-preview').hidden,true);
empty.get('warehouse-door').click();
assert.equal(empty.get('warehouse-panel').hidden,false);
assert.equal(empty.get('business-panel').hidden,true);
assert.equal(empty.get('drawer-title').textContent,'Materiallager');
assert.equal(empty.get('warehouse-door').attrs['aria-expanded'],'true');
empty.get('buy-material').click();assert.equal(empty.state().money,13550);assert.equal(empty.state().inventory.rawMaterial.c45,25);
assert.equal(empty.state().finance.transactions.filter(x=>x.category==='material').length,1);
assert.match(empty.get('storage-stock').textContent,/C45 Stahl: 25 kg/);
empty.get('warehouse-door').click();assert.equal(empty.get('drawer').hidden,true);
empty.get('warehouse-door').click();empty.get('business-tab').click();
assert.equal(empty.get('warehouse-panel').hidden,true);
assert.equal(empty.get('warehouse-door').attrs['aria-expanded'],'false');
assert.match(empty.get('finance-profit').textContent,/−?€ -450,00|€ -450,00/);
assert.ok(empty.get('finance-totals').children.some(row=>row.children[0].textContent==='Material'&&row.children[1].textContent.includes('-450,00')));
empty.get('finance-period').value='yesterday';empty.get('finance-period').events.change();
assert.match(empty.get('finance-profit').textContent,/€ 0,00/);
empty.get('finance-period').value='month';empty.get('finance-period').events.change();
assert.match(empty.get('finance-profit').textContent,/€ -450,00/);
const emptyReload=boot({cnc_factory_save_v3:JSON.stringify(empty.state())});assert.equal(emptyReload.state().inventory.rawMaterial.c45,25);
emptyReload.get('storage-upgrade').click();
assert.equal(emptyReload.state().inventory.capacities.raw,500);
assert.equal(emptyReload.state().money,9550);
const priceStorage={cnc_factory_save_v3:JSON.stringify({...empty.state(),gameMinutes:1440,money:14000})};
let priced=boot(priceStorage);
const quoted=require(dir+'/systems/materials.js').quote('c45',25,1440);
assert.match(priced.get('material-market-info').textContent,/Grundpreis .*heute .* zu gestern/);
assert.equal(priced.get('material-market-board').children.length,6);
assert.match(priced.get('material-market-board').children[0].children[1].textContent,/14,40\/kg/);
assert.match(priced.get('material-market-board').children[0].children[2].textContent,/Günstig -20 %/);
assert.ok(priced.get('material-price').textContent.includes(quoted.toLocaleString('de-DE',{minimumFractionDigits:2})));
priced.get('buy-material').click();
assert.equal(priced.state().money,14000-quoted);
assert.equal(priced.state().inventory.rawMaterial.c45,50);
assert.equal(priced.state().finance.transactions.filter(x=>x.category==='material').length,2);
priced=boot(priceStorage);
assert.equal(priced.state().money,14000-quoted);
assert.ok(priced.get('material-price').textContent.includes(quoted.toLocaleString('de-DE',{minimumFractionDigits:2})));
priced.get('material-market-board').children[1].click();
assert.equal(priced.state().selectedMaterialType,'steel42crmo4');
assert.equal(priced.get('material-market-board').children[1].attrs['aria-pressed'],'true');
assert.equal(priced.get('material-market-board').children[0].attrs['aria-pressed'],'false');
const fractional=require(dir+'/systems/materials.js').quote('steel42crmo4',25,1440);
assert.equal(fractional,618.75);
assert.ok(priced.get('material-price').textContent.includes('618,75'));
priced.get('buy-material').click();
assert.equal(priced.state().money,14000-quoted-fractional);
assert.equal(priced.state().inventory.rawMaterial.steel42crmo4,25);
assert.equal(priced.state().finance.transactions.filter(x=>x.category==='material').length,3);
priced=boot(priceStorage);
assert.equal(priced.state().money,14000-quoted-fractional);
assert.equal(priced.state().selectedMaterialType,'steel42crmo4');
assert.equal(priced.get('material-market-board').children[1].attrs['aria-pressed'],'true');
const expensive=boot({cnc_factory_save_v3:JSON.stringify({...empty.state(),gameMinutes:2880})});
assert.match(expensive.get('material-market-board').children[0].children[2].textContent,/Teuer/);
assert.equal(expensive.get('material-history').children.length,3);
assert.equal(expensive.get('material-history').children[0].children[0].textContent,'Tag 1');
assert.match(expensive.get('material-history').children[2].children[2].textContent,/20,70\/kg/);
const expandedStorage={cnc_factory_save_v3:JSON.stringify({money:250000,material:100,capacity:300,staff:{shift1:0,shift2:0},machines:[{bay:1,type:'standard',progress:0},{bay:3,type:'mill3',progress:0}],selectedBay:1,gameMinutes:0,speed:1,paused:false})};
let exp=boot(expandedStorage);assert.equal(exp.state().factoryExpansion.unlockedBays,4);
exp.get('expand-factory').click();assert.equal(exp.state().factoryExpansion.unlockedBays,6);assert.equal(exp.state().money,210000);assert.equal(exp.get('hall-image').src,'hall-level-2.svg?v=1');
exp.get('expand-factory').click();assert.equal(exp.state().factoryExpansion.unlockedBays,8);assert.equal(exp.state().money,120000);
assert.equal(exp.get('expand-factory').hidden,true);
const shop=exp.get('machine-shop').children;
shop[0].children.at(-1).children.at(-1).click();
assert.deepEqual(exp.state().machines.map(x=>x.bay),[1,3,2]);
exp=boot(expandedStorage);assert.deepEqual(exp.state().machines.map(x=>x.bay),[1,3,2]);assert.equal(exp.state().factoryExpansion.unlockedBays,8);
assert.equal(exp.state().finance.transactions.filter(x=>x.category==='factory_expansion').length,2);
exp.get('sell-machine').click();assert.deepEqual(exp.state().machines.map(x=>x.bay),[1,3]);
exp=boot(expandedStorage);assert.deepEqual(exp.state().machines.map(x=>x.bay),[1,3]);assert.equal(exp.state().factoryExpansion.unlockedBays,8);
exp.get('machine-shop').children[0].children.at(-1).children.at(-1).click();assert.deepEqual(exp.state().machines.map(x=>x.bay),[1,3,2]);
while(exp.state().machines.length<8)exp.get('machine-shop').children[0].children.at(-1).children.at(-1).click();
assert.deepEqual(exp.state().machines.map(x=>x.bay).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
exp.get('machine-shop').children[0].children.at(-1).children.at(-1).click();assert.equal(exp.state().machines.length,8);
exp=boot(expandedStorage);assert.deepEqual(exp.state().machines.map(x=>x.bay).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
const warningStorage={cnc_factory_save_v3:JSON.stringify({
 money:14000,material:120,capacity:300,staff:{shift1:1,shift2:0},machines:[{bay:1,type:'standard',level:1,maintenance:30,tool:80,operator1:true,activeId:'A12',progress:20,produced:10,deadlineAt:420}],
 selectedBay:1,gameMinutes:0,speed:1,paused:false,
 breakdowns:{machines:{1:{status:'warning',fault:'tool_break',severity:1,since:0,riskyContinue:false,scheduledRepair:false,operatingHours:1,warningAgeMinutes:0,repairRemainingMinutes:0,plannedRepair:false}}}
})};
let warned=boot(warningStorage);warned.get('continue-risky').click();assert.equal(warned.state().breakdowns.machines['1'].riskyContinue,true);
warned=boot(warningStorage);warned.get('schedule-repair').click();assert.equal(warned.state().breakdowns.machines['1'].scheduledRepair,true);
assert.equal(warned.state().finance.transactions.filter(x=>x.category==='repairs').length,1);
warned=boot(warningStorage);assert.equal(warned.state().breakdowns.machines['1'].scheduledRepair,true);
assert.equal(warned.state().finance.transactions.filter(x=>x.category==='repairs').length,1);
const typedState=empty.state();typedState.inventory.rawMaterial.aluminium6082=100;typedState.material=125;
typedState.machines=[{bay:1,type:'standard',level:1,maintenance:90,tool:82,operator1:true,operator2:false,activeId:null,progress:0,produced:0,deadlineAt:null}];typedState.staff.shift1=1;typedState.selectedBay=1;
typedState.orderMarket.available.push({id:'MATERIAL-TEST',kind:'Drehen',customer:'Test',part:'Stahlteil',material:'C45 Stahl',kg:30,qty:10,reward:4000,duration:8,deadlineHours:4,createdAt:0,expiresAt:1000});
const typedStorage={cnc_factory_save_v3:JSON.stringify(typedState)};
let typed=boot(typedStorage);let card=typed.get('orders').children.find(x=>x.innerHTML?.includes('MATERIAL-TEST'));
assert.equal(card.children.at(-1).disabled,true);
typed.get('buy-material').click();card=typed.get('orders').children.find(x=>x.innerHTML?.includes('MATERIAL-TEST'));
assert.equal(card.children.at(-1).disabled,false);
card.children.at(-1).click();const accepted=typed.state();
assert.equal(accepted.machines[0].activeId,'MATERIAL-TEST');assert.equal(accepted.inventory.rawMaterial.c45,20);
assert.equal(accepted.inventory.rawMaterial.aluminium6082,100);
typed=boot(typedStorage);assert.equal(typed.state().machines[0].activeId,'MATERIAL-TEST');assert.equal(typed.state().inventory.rawMaterial.c45,20);
assert.equal(typed.state().staffRoster.shift1[0].assignedBay,1);
const beforeTraining=typed.state().money;
typed.get('staff-development').children[0].children[1].click();
assert.equal(typed.state().money,beforeTraining-900);
assert.equal(typed.state().staffRoster.shift1[0].trained,1);
assert.equal(typed.state().finance.transactions.filter(x=>x.meta?.employeeId).length,1);
typed=boot(typedStorage);
assert.equal(typed.state().staffRoster.shift1[0].trained,1);
typed.frame(1000);
typed.flush();
assert.ok(typed.state().staffRoster.shift1[0].xp>0);
const moveState=typed.state();
moveState.machines.push({bay:2,type:'standard',level:1,maintenance:90,tool:82,operator1:false,operator2:false,activeId:null,progress:0});
const moveStorage={cnc_factory_save_v3:JSON.stringify(moveState)};
let moved=boot(moveStorage);
const workerId=moved.state().staffRoster.shift1[0].id;
moved.get('operator-1').click();
moved.get('bay-2').click();moved.get('operator-1').click();
assert.equal(moved.state().staffRoster.shift1[0].assignedBay,2);
assert.equal(moved.state().staffRoster.shift1[0].id,workerId);
assert.equal(moved.state().staffRoster.shift1[0].trained,1);
moved.get('sell-machine').click();
assert.equal(moved.state().staffRoster.shift1[0].assignedBay,null);
moved=boot(moveStorage);assert.equal(moved.state().staffRoster.shift1[0].trained,1);
const skilledState=typed.state(),noviceState=JSON.parse(JSON.stringify(skilledState));
skilledState.machines[0].progress=0;noviceState.machines[0].progress=0;
skilledState.staffRoster.shift1[0].xp=0;noviceState.staffRoster.shift1[0].xp=0;
noviceState.staffRoster.shift1[0].trained=0;
const skilled=boot({cnc_factory_save_v3:JSON.stringify(skilledState)});
const novice=boot({cnc_factory_save_v3:JSON.stringify(noviceState)});
skilled.frame(1000);novice.frame(1000);skilled.flush();novice.flush();
assert.ok(skilled.state().machines[0].progress>novice.state().machines[0].progress);
const queueState=typed.state();
queueState.orderMarket.available.push({id:'QUEUE-TEST',kind:'Drehen',customer:'Test',part:'Folgeteile',material:'C45 Stahl',kg:10,qty:10,reward:3000,duration:20,deadlineHours:4,createdAt:0,expiresAt:1000});
const queueStorage={cnc_factory_save_v3:JSON.stringify(queueState)};
let queued=boot(queueStorage);
let queueCard=queued.get('orders').children.find(x=>x.innerHTML?.includes('QUEUE-TEST'));
assert.match(queueCard.children.at(-1).textContent,/vormerken/);
queueCard.children.at(-1).click();
let queueSave=queued.state();
assert.equal(queueSave.machines[0].activeId,'MATERIAL-TEST');
assert.equal(queueSave.machines[0].orderQueue[0].order.id,'QUEUE-TEST');
assert.equal(queueSave.inventory.rawMaterial.c45,10);
assert.equal(queueSave.orderMarket.available.some(x=>x.id==='QUEUE-TEST'),false);
assert.equal(queueSave.finance.transactions.filter(x=>x.category==='income').length,0);
assert.equal(queued.get('sell-machine').disabled,true);
queued=boot(queueStorage);
assert.equal(queued.get('queued-orders').children.length,1);
queued.get('queued-orders').children[0].children[1].click();
assert.equal(queued.state().machines[0].orderQueue.length,0);
assert.equal(queued.state().inventory.rawMaterial.c45,20);
assert.equal(queued.state().finance.transactions.filter(x=>x.category==='income').length,0);
const fullWarehouse=JSON.parse(JSON.stringify(queueSave));
fullWarehouse.inventory.rawMaterial.c45=200;fullWarehouse.material=300;
const fullQueue=boot({cnc_factory_save_v3:JSON.stringify(fullWarehouse)});
assert.equal(fullQueue.get('queued-orders').children[0].children[1].disabled,true);
assert.equal(fullQueue.state().machines[0].orderQueue[0].order.id,'QUEUE-TEST');
queueSave.machines[0].progress=99.5;
queueSave.machines[0].activeOrder.customer='Veltraxis Mobility';
const completionStorage={cnc_factory_save_v3:JSON.stringify(queueSave)};
let completing=boot(completionStorage);
completing.frame(1000);
assert.equal(completing.state().machines[0].activeId,'QUEUE-TEST');
assert.equal(completing.state().machines[0].orderQueue.length,0);
assert.equal(completing.state().finance.transactions.filter(x=>x.category==='income').length,1);
assert.equal(completing.state().customerReputation['Veltraxis Mobility'],54);
assert.ok(completing.get('customer-reputation').children.some(row=>row.children[0].textContent==='Veltraxis Mobility'&&row.children[1].textContent.includes('54/100')));
completing=boot(completionStorage);
assert.equal(completing.state().machines[0].activeId,'QUEUE-TEST');
assert.equal(completing.state().finance.transactions.filter(x=>x.category==='income').length,1);
assert.equal(completing.state().customerReputation['Veltraxis Mobility'],54);
console.log('Game integration: material purchase, jobs, repair decisions, expansion and reload OK');

const legacyQueueState=JSON.parse(JSON.stringify(queueSave));
const olderEntry=legacyQueueState.machines[0].orderQueue.shift();
legacyQueueState.machines[0].queuedOrder=olderEntry.order;
legacyQueueState.machines[0].queuedMaterial=olderEntry.material;
legacyQueueState.machines[0].queuedDeadlineAt=olderEntry.deadlineAt;
const migrated=boot({cnc_factory_save_v3:JSON.stringify(legacyQueueState)});
assert.equal(migrated.state().machines[0].orderQueue[0].order.id,'QUEUE-TEST');
assert.equal(migrated.state().machines[0].orderQueue[0].deadlineAt,olderEntry.deadlineAt);
assert.equal(migrated.state().machines[0].queuedOrder,undefined);
const multiState=typed.state();
multiState.inventory.rawMaterial.c45=80;multiState.material=80;
for(let i=1;i<=4;i++)multiState.orderMarket.available.push({
  id:`BATCH-${i}`,kind:'Drehen',customer:'Test',part:`Serie ${i}`,material:'C45 Stahl',
  kg:10,qty:10,reward:3000,duration:20,deadlineHours:4,createdAt:0,expiresAt:1000
});
const multiStorage={cnc_factory_save_v3:JSON.stringify(multiState)};
let multiple=boot(multiStorage);
const multiInitialStock=multiple.state().material;
for(let i=1;i<=3;i++){
  const card=multiple.get('orders').children.find(x=>x.innerHTML?.includes(`BATCH-${i}`));
  assert.equal(card.children.at(-1).disabled,false);
  card.children.at(-1).click();
  assert.equal(multiple.state().machines[0].orderQueue.length,i);
}
assert.equal(multiple.state().material,multiInitialStock-30);
let fourth=multiple.get('orders').children.find(x=>x.innerHTML?.includes('BATCH-4'));
assert.equal(fourth.children.at(-1).disabled,true);
fourth.children.at(-1).click();
assert.equal(multiple.state().machines[0].orderQueue.length,3);
multiple=boot(multiStorage);
assert.deepEqual(multiple.state().machines[0].orderQueue.map(entry=>entry.order.id),['BATCH-1','BATCH-2','BATCH-3']);
multiple.get('queued-orders').children[1].children[1].click();
assert.deepEqual(multiple.state().machines[0].orderQueue.map(entry=>entry.order.id),['BATCH-1','BATCH-3']);
assert.equal(multiple.state().material,multiInitialStock-20);
fourth=multiple.get('orders').children.find(x=>x.innerHTML?.includes('BATCH-4'));
fourth.children.at(-1).click();
assert.deepEqual(multiple.state().machines[0].orderQueue.map(entry=>entry.order.id),['BATCH-1','BATCH-3','BATCH-4']);
assert.equal(multiple.state().material,multiInitialStock-30);
const plannedIds=['BATCH-1','BATCH-3','BATCH-4'];
for(const id of plannedIds){
  const before=multiple.state();
  before.machines[0].progress=99.5;
  before.machines[0].tool=90;before.machines[0].maintenance=90;
  const stepStorage={cnc_factory_save_v3:JSON.stringify(before)};
  multiple=boot(stepStorage);multiple.frame(1000);
  assert.equal(multiple.state().machines[0].activeId,id);
  assert.equal(multiple.state().machines[0].orderQueue.length,plannedIds.length-1-plannedIds.indexOf(id));
}
assert.equal(multiple.state().finance.transactions.filter(x=>x.category==='income').length,3);
const finalStorage={cnc_factory_save_v3:JSON.stringify(multiple.state())};
assert.equal(boot(finalStorage).state().finance.transactions.filter(x=>x.category==='income').length,3);
console.log('Three reserved jobs: save migration, inventory, cancellation, FIFO and payouts OK');

const robotState={money:25000,material:120,capacity:300,staff:{shift1:0,shift2:0},
  machines:[{bay:1,type:'standard',level:1,maintenance:90,tool:82,operator1:false,operator2:false,
    activeId:'A12',progress:20,produced:10,deadlineAt:900}],
  selectedBay:1,gameMinutes:480,speed:1,paused:false};
const robotStorage={cnc_factory_save_v3:JSON.stringify(robotState)};
let robot=boot(robotStorage);assert.equal(robot.get('buy-robot').disabled,false);
robot.get('buy-robot').click();
assert.equal(robot.state().money,16500);
assert.equal(robot.state().machines[0].operator2,false);
assert.equal(robot.state().machines[0].loadingRobot,true);
assert.equal(robot.state().staffRoster.shift2.length,0);
assert.match(robot.get('hud-operators').textContent,/S2 Roboter/);
assert.match(robot.get('bay-1').querySelector('.bay-robot').src,/loading-robot/);
assert.equal(robot.get('buy-robot').disabled,true);
assert.equal(robot.state().finance.transactions.filter(x=>x.meta?.robot).length,1);
robot=boot(robotStorage);
assert.equal(robot.state().finance.transactions.filter(x=>x.meta?.robot).length,1);
const progressBefore=robot.state().machines[0].progress;
robot.frame(1000);robot.flush();
assert.ok(robot.state().machines[0].progress>progressBefore);
assert.equal(robot.state().payrollDue,0);
assert.ok(robot.state().energyPaid>0);
const reassignedState={...robotState,staff:{shift1:0,shift2:1},machines:[{...robotState.machines[0],operator2:true}]};
const reassigned=boot({cnc_factory_save_v3:JSON.stringify(reassignedState)});
reassigned.get('buy-robot').click();
assert.equal(reassigned.state().staffRoster.shift2[0].assignedBay,null);
assert.equal(reassigned.state().staff.shift2,1);
assert.equal(reassigned.get('fire-2').disabled,false);
const soldRobot={cnc_factory_save_v3:JSON.stringify({...robot.state(),machines:[{...robot.state().machines[0],activeId:null,activeOrder:null,progress:0,orderQueue:[]}]})};
const robotSale=boot(soldRobot);
assert.match(robotSale.get('sell-machine-value').textContent,/7\.300/);
robotSale.get('sell-machine').click();
assert.equal(robotSale.state().machines.length,0);
assert.equal(robotSale.get('bay-1').querySelector('.bay-robot').hidden,true);
console.log('Loading robot: purchase, shift 2 operation, wages, reload and sale OK');

const hallStorage={cnc_factory_save_v3:JSON.stringify({
  money:14000,material:0,capacity:300,staff:{shift1:0,shift2:0},
  machines:[{bay:1,type:'standard',progress:0},{bay:3,type:'mill3',progress:0}],
  selectedBay:1,gameMinutes:0,speed:1,paused:false
})};
let hall=boot(hallStorage,{phaser:true});
hall.get('bay-1').click();
assert.equal(hall.get('hall-preview').hidden,false);
assert.match(hall.get('hall-preview-title').textContent,/Platz 1/);
assert.equal(hall.get('hall-preview-time').hidden,true);
assert.match(hall.get('hall-preview-operators').textContent,/S1 – · S2 –/);
assert.equal(hall.get('detail-view').hidden,true);
const firstTop=Number.parseInt(hall.get('hall-preview').style.top,10);
assert.equal(firstTop,6);
hall.get('bay-3').click();
assert.match(hall.get('hall-preview-title').textContent,/Platz 3/);
assert.equal(hall.get('detail-view').hidden,true);
assert.ok(Number.parseInt(hall.get('hall-preview').style.top,10)>firstTop);
hall.get('hall-preview-close').click();
assert.equal(hall.get('hall-preview').hidden,true);
hall.get('bay-3').click();
assert.equal(hall.get('detail-view').hidden,true);
hall.get('bay-3').click();
assert.equal(hall.get('detail-view').hidden,false);
hall.get('back-to-hall').click();
assert.equal(hall.get('hall-preview').hidden,true);
hall=boot(hallStorage,{phaser:true});
hall.get('bay-3').click();
assert.equal(hall.get('detail-view').hidden,true);
hall.get('bay-3').click();
assert.equal(hall.get('detail-view').hidden,false);
const eightBayStorage={cnc_factory_save_v3:JSON.stringify({
  money:150000,material:0,capacity:300,staff:{shift1:0,shift2:0},
  machines:[{bay:5,type:'standard',progress:0},{bay:8,type:'mill3',progress:0}],
  factoryExpansion:{level:3,unlockedBays:8},selectedBay:5,gameMinutes:0,speed:1,paused:false
})};
const expandedHall=boot(eightBayStorage,{phaser:true});
expandedHall.get('hall-map').clientHeight=250;
expandedHall.get('bay-8').click();
let popup=expandedHall.get('hall-preview');
assert.ok(Number.parseInt(popup.style.left,10)>=6);
assert.ok(Number.parseInt(popup.style.left,10)+popup.offsetWidth<=394);
assert.ok(Number.parseInt(popup.style.top,10)+popup.offsetHeight<=244);
expandedHall.get('hall-map').clientWidth=320;
expandedHall.resize();
assert.ok(Number.parseInt(popup.style.left,10)+popup.offsetWidth<=314);
console.log('Hall preview: first tap previews, switching changes preview, second tap opens, back and reload reset');

const artworkStorage={cnc_factory_save_v3:JSON.stringify({
  money:14000,material:0,capacity:300,staff:{shift1:0,shift2:0},
  machines:[
    {bay:1,type:'mill3',progress:0},
    {bay:2,type:'standard',progress:0},
    {bay:3,type:'mill5',progress:0}
  ],selectedBay:1,gameMinutes:0,speed:1,paused:false
})};
const artwork=boot(artworkStorage);
assert.equal(artwork.get('bay-1').classList.contains('veltron-bay'),true);
assert.equal(artwork.get('bay-2').classList.contains('veltron-bay'),false);
assert.equal(artwork.get('bay-3').classList.contains('veltron-bay'),false);
assert.match(artwork.get('bay-1').querySelector('.bay-machine').src,/veltron-vx500-hall/);
assert.match(artwork.get('bay-3').querySelector('.bay-machine').src,/orionis-om650x-hall/);
artwork.get('sell-machine').click();
assert.equal(artwork.get('bay-1').classList.contains('veltron-bay'),false);
assert.equal(artwork.get('bay-3').classList.contains('veltron-bay'),false);

const recruitStorage={};
let recruiting=boot(recruitStorage);
assert.equal(recruiting.state().staffRoster.shift1.length,0);
assert.equal(recruiting.state().recruitment.applicants.length,3);
recruiting.get('business-tab').click();
recruiting.get('open-recruitment').click();
assert.equal(recruiting.get('recruitment-panel').hidden,false);
assert.equal(recruiting.get('business-panel').hidden,true);
assert.equal(recruiting.get('drawer-title').textContent,'Bewerberbörse');
assert.equal(recruiting.get('applicant-list').children.length,3);
assert.match(recruiting.get('applicant-list').children[0].children[0].children[1].children[0].textContent,/[A-Z][a-z]+ [A-Z][a-z]+/);
assert.equal(recruiting.get('applicant-list').children[0].children[2].children.length,4);
const firstApplicant=recruiting.state().recruitment.applicants[0];
const firstHireButton=recruiting.get('applicant-list').children[0].children[3].children[0];
firstHireButton.click();
firstHireButton.click();
let recruited=recruiting.state();
assert.equal(recruited.money,13850);
assert.equal(recruited.staff.shift1,1);
assert.equal(recruited.staffRoster.shift1[0].name,firstApplicant.name);
assert.equal(recruited.staffRoster.shift1[0].profileVersion,1);
assert.equal(recruited.staffRoster.shift1[0].assignedBay,null);
assert.equal(recruited.recruitment.applicants.length,3);
assert.equal(recruited.recruitment.applicants.some(candidate=>candidate.id===firstApplicant.id),false);
assert.equal(recruited.finance.transactions.filter(entry=>entry.meta?.setupFee).length,1);
assert.equal(recruited.finance.transactions.filter(entry=>entry.meta?.setupFee)[0].amount,-150);
assert.equal(recruiting.get('applicant-list').children[0].children[3].children[1].title,'Schicht 2: 26 € pro Stunde');
recruiting.get('recruitment-back').click();
assert.equal(recruiting.get('business-panel').hidden,false);
assert.match(recruiting.get('staff-development').children[0].children[0].textContent,new RegExp(firstApplicant.name));
const secondApplicant=recruited.recruitment.applicants[0];
recruiting.get('open-recruitment').click();
recruiting.get('applicant-list').children[0].children[3].children[1].click();
recruited=recruiting.state();
assert.equal(recruited.money,13700);
assert.equal(recruited.staff.shift2,1);
assert.equal(recruited.staffRoster.shift2[0].name,secondApplicant.name);
assert.equal(recruited.finance.transactions.filter(entry=>entry.meta?.setupFee).length,2);
recruiting=boot({cnc_factory_save_v3:JSON.stringify(recruited)});
assert.equal(recruiting.state().staffRoster.shift1[0].name,firstApplicant.name);
assert.equal(recruiting.state().staffRoster.shift1[0].profileVersion,1);
assert.deepEqual(recruiting.state().recruitment.applicants,recruited.recruitment.applicants);

const oldRoster=boot({cnc_factory_save_v3:JSON.stringify({
  money:5000,material:0,capacity:300,staff:{shift1:1,shift2:0},staffRoster:{nextId:2,shift1:[{id:1,xp:640,trained:1,assignedBay:null}],shift2:[]},
  machines:[],selectedBay:null,gameMinutes:0,speed:1,paused:false
})});
const migratedEmployee=oldRoster.state().staffRoster.shift1[0];
assert.equal(migratedEmployee.profileVersion,0);
assert.ok(migratedEmployee.name);
assert.equal(migratedEmployee.xp,640);
assert.equal(migratedEmployee.trained,1);
const oldRosterReload=boot({cnc_factory_save_v3:JSON.stringify(oldRoster.state())});
assert.equal(oldRosterReload.state().staffRoster.shift1[0].name,migratedEmployee.name);
assert.equal(oldRosterReload.state().staffRoster.shift1[0].trained,1);
console.log('Recruitment: profiles, shift hiring, finance booking, refills and old-save migration OK');
