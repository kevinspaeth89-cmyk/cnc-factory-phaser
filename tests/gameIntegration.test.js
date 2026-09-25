const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir=require('node:path').resolve(__dirname,'..');
const html=fs.readFileSync(dir+'/index.html','utf8'), ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
assert.ok(html.indexOf('id="warehouse-panel"')<html.indexOf('id="buy-material"'));
assert.ok(html.indexOf('id="business-panel"')<html.indexOf('id="warehouse-panel"'));
assert.ok(html.indexOf('id="storage-stock"')<html.indexOf('id="buy-material"'));
assert.ok(html.indexOf('id="warehouse-panel"')>html.indexOf('id="machine-shop"'));
assert.ok(html.indexOf('id="buy-material"')<html.indexOf('id="storage-upgrade"'));
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
  for(const id of ids)get(id);get('material-type').value='c45';get('material-quantity').value='25';
  get('detail-view').hidden=true;get('hall-preview').hidden=true;
  get('hall-map').clientWidth=400;get('hall-map').clientHeight=400;
  get('hall-preview').offsetWidth=190;get('hall-preview').offsetHeight=118;
  for(let bay=1;bay<=4;bay++){const span=new El();span.tagName='span';get('bay-'+bay).append(span)}
  const document={getElementById:get,createElement:()=>new El(),querySelectorAll:()=>[],addEventListener(){}};
  let nextFrame=()=>{};
  const windowEvents={};
  const context={document,console,Date,Math,JSON,performance:{now:()=>0},requestAnimationFrame:fn=>nextFrame=fn,setTimeout:(fn,ms)=>{if(options.phaser&&ms===0)fn();return 1},clearTimeout(){},setInterval(){},window:{matchMedia:()=>({matches:true}),confirm:()=>true,addEventListener:(type,fn)=>windowEvents[type]=fn},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},CNCModules:{economy:require(dir+'/systems/economy.js').economy,inventory:require(dir+'/systems/economy.js').inventory,orderMarket:require(dir+'/systems/orderMarket.js'),breakdowns:require(dir+'/systems/breakdowns.js'),factoryExpansion:require(dir+'/factory-expansion.js'),materials:require(dir+'/systems/materials.js')}};
  if(options.phaser)context.Phaser={Scene:class{},Game:class{},AUTO:0,Scale:{FIT:0,CENTER_BOTH:0}};
  context.globalThis=context;context.window.cncFactory=null;
  vm.runInNewContext(fs.readFileSync(dir+'/game.js','utf8'),context,{filename:'game.js'});
  return {get,frame:t=>nextFrame(t),resize:()=>windowEvents.resize?.(),state:()=>JSON.parse(storage.cnc_factory_save_v3)};
}
let storage={cnc_factory_save_v3:JSON.stringify({money:14000,material:120,capacity:300,staff:{shift1:1,shift2:0},machines:[{bay:2,type:'standard',level:1,maintenance:50,tool:82,operator1:true,operator2:false,activeId:'A12',progress:25,produced:12,deadlineAt:420}],selectedBay:2,gameMinutes:0,speed:1,paused:false,breakdowns:{machines:{2:{status:'warning',fault:'sensor_error',severity:1,since:0,riskyContinue:false,scheduledRepair:false,operatingHours:1,warningAgeMinutes:0,repairRemainingMinutes:0,plannedRepair:false}}}})};
let app=boot(storage),st=app.state();assert.equal(st.breakdowns.machines['2'].status,'warning');assert.equal(app.get('repair-now').disabled,false);
assert.equal(ids.includes('hall-preview-open'),false);
app.get('bay-2').click();
assert.match(app.get('hall-preview-job').textContent,/12\/\d+ Teile/);
assert.match(app.get('hall-preview-time').textContent,/Rest .* · Frist /);
assert.equal(app.get('hall-preview-time').hidden,false);
assert.match(app.get('hall-preview-operators').textContent,/S1 ✓ · S2 –/);
app.get('repair-now').click();st=app.state();assert.equal(st.breakdowns.machines['2'].status,'repairing');assert.equal(st.money,13390);assert.equal(st.finance.transactions.filter(x=>x.category==='repairs').length,1);
app=boot(storage);st=app.state();assert.equal(st.money,13390);assert.equal(st.breakdowns.machines['2'].status,'repairing');assert.equal(st.finance.transactions.filter(x=>x.category==='repairs').length,1);assert.equal(st.machines[0].activeId,'A12');
app.frame(1000);st=app.state();assert.equal(st.breakdowns.machines['2'].status,'repairing');assert.equal(st.finance.transactions.filter(x=>x.category==='repairs').length,1);
const empty=boot({});assert.equal(empty.state().machines.length,0);assert.equal(empty.state().material,0);assert.deepEqual(Object.keys(empty.state().breakdowns.machines),[]);
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
const emptyReload=boot({cnc_factory_save_v3:JSON.stringify(empty.state())});assert.equal(emptyReload.state().inventory.rawMaterial.c45,25);
emptyReload.get('storage-upgrade').click();
assert.equal(emptyReload.state().inventory.capacities.raw,500);
assert.equal(emptyReload.state().money,9550);
const priceStorage={cnc_factory_save_v3:JSON.stringify({...empty.state(),gameMinutes:1440,money:14000})};
let priced=boot(priceStorage);
const quoted=require(dir+'/systems/materials.js').quote('c45',25,1440);
assert.match(priced.get('material-market-info').textContent,/Tageskurs .*gegenüber gestern/);
assert.match(priced.get('material-price').textContent,new RegExp(String(quoted)));
priced.get('buy-material').click();
assert.equal(priced.state().money,14000-quoted);
assert.equal(priced.state().inventory.rawMaterial.c45,50);
assert.equal(priced.state().finance.transactions.filter(x=>x.category==='material').length,2);
priced=boot(priceStorage);
assert.equal(priced.state().money,14000-quoted);
assert.match(priced.get('material-price').textContent,new RegExp(String(quoted)));
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
console.log('Game integration: material purchase, jobs, repair decisions, expansion and reload OK');

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
