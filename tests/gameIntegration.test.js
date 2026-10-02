const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir=require('node:path').resolve(__dirname,'..');
const html=fs.readFileSync(dir+'/index.html','utf8'), ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
assert.ok(html.indexOf('id="warehouse-panel"')<html.indexOf('id="buy-material"'));
assert.ok(html.indexOf('id="business-panel"')<html.indexOf('id="warehouse-panel"'));
assert.ok(html.indexOf('id="credit-panel"')<html.indexOf('id="machine-shop"'));
assert.ok(html.indexOf('id="storage-stock"')<html.indexOf('id="buy-material"'));
assert.ok(html.indexOf('id="warehouse-panel"')>html.indexOf('id="machine-shop"'));
assert.ok(html.indexOf('id="storage-upgrade"')<html.indexOf('id="material-market-board"'));
assert.equal(ids.includes('material-type'),false);
assert.ok(ids.includes('recruitment-panel'));
assert.ok(ids.includes('applicant-list'));
assert.ok(['employee-specializations','employee-specialization-hint','employee-specialization','employee-specialization-assign'].every(id=>ids.includes(id)));
assert.ok(html.indexOf('systems/employeeDevelopment.js')<html.indexOf('game.js?v='));
assert.ok(['cf2-project-list','cf2-flow-list','active-production'].every(id=>ids.includes(id)));
assert.ok(['cf2-priority','cf2-batch-mode','cf2-route-preset','cf2-generate-special-order','cf2-create-project'].every(id=>!ids.includes(id)));
assert.ok(['systems/productionFlow.js','systems/suppliers.js','systems/customerProjects.js','systems/factorySituations.js'].every(path=>html.indexOf(path)<html.indexOf('game.js?v=')));
assert.equal(ids.includes('hire-1'),false);
assert.equal(ids.includes('hire-2'),false);
function boot(storage,options={}){
  const math=Object.create(Math);math.random=typeof options.random==='function'?options.random:Math.random;
  const breakdownApi=require(dir+'/systems/breakdowns.js');
  const breakdowns=typeof options.random==='function'?{...breakdownApi,init:(state,initOptions={})=>breakdownApi.init(state,{...initOptions,random:options.random})}:breakdownApi;
  const elements=new Map();
  class El {
    constructor(id=''){
      this.id=id;this.children=[];this.style={setProperty:(key,value)=>this.style[key]=value,removeProperty:key=>delete this.style[key]};this.attrs={};this.dataset={};this.events={};this.hidden=false;
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
      this.textContent='';this._innerHTML='';
    }
    get textContent(){return this.children.length?this.children.map(child=>child.textContent||'').join(''):this._textContent||''}
    set textContent(value){this._textContent=String(value??'');if(this.children?.length)this.children=[]}
    get innerHTML(){return this._innerHTML}
    set innerHTML(value){
      this._innerHTML=String(value);this.children=[];
      const top=this._innerHTML.match(/<div class="top">([\s\S]*?)<\/div>/i);
      if(top){
        const row=new El();row.tagName='div';row.className='top';this.append(row);
        for(const match of top[1].matchAll(/<span>([\s\S]*?)<\/span>/gi)){const span=new El();span.tagName='span';span.textContent=match[1];row.append(span)}
      }
      const heading=this._innerHTML.match(/<h3>([\s\S]*?)<\/h3>/i);
      if(heading){const h3=new El();h3.tagName='h3';h3.textContent=heading[1];this.append(h3)}
    }
    addEventListener(type,fn){this.events[type]=fn}
    append(...children){this.children.push(...children);for(const child of children){child.parentElement=this;if(child.id)elements.set(child.id,child)}}
    insertBefore(child,before){const index=before?this.children.indexOf(before):-1;if(index<0)this.children.push(child);else this.children.splice(index,0,child);child.parentElement=this;if(child.id)elements.set(child.id,child);return child}
    prepend(...children){this.children.unshift(...children)}
    replaceChildren(...children){this.children=children}
    remove(){if(!this.parentElement)return;const siblings=this.parentElement.children,index=siblings.indexOf(this);if(index>=0)siblings.splice(index,1)}
    replaceWith(...nodes){if(!this.parentElement)return;const siblings=this.parentElement.children,index=siblings.indexOf(this);if(index>=0){siblings.splice(index,1,...nodes);for(const node of nodes)node.parentElement=this.parentElement}}
    before(...nodes){if(!this.parentElement)return;const siblings=this.parentElement.children,index=siblings.indexOf(this);if(index>=0){siblings.splice(index,0,...nodes);for(const node of nodes)node.parentElement=this.parentElement}}
    after(...nodes){if(!this.parentElement)return;const siblings=this.parentElement.children,index=siblings.indexOf(this);if(index>=0){siblings.splice(index+1,0,...nodes);for(const node of nodes)node.parentElement=this.parentElement}}
    get firstChild(){return this.children[0]||null}
    get firstElementChild(){return this.children.find(child=>child&&typeof child==='object')||null}
    querySelector(q){
      const matches=node=>{
        if(/^[a-z][a-z0-9-]*$/i.test(q))return node.tagName===q.toLowerCase();
        if(q.startsWith('.'))return String(node.className||'').split(/\s+/).includes(q.slice(1));
        const attr=q.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/i);
        if(attr){
          const key=attr[1].replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
          return Object.hasOwn(node.dataset||{},key)&&(attr[2]===undefined||String(node.dataset[key])===attr[2]);
        }
        const exactOption=q.match(/^option\[value="([^"]+)"\]$/i);
        return !!exactOption&&node.tagName==='option'&&node.value===exactOption[1];
      };
      const visit=node=>{for(const child of node.children||[]){if(matches(child))return child;const nested=visit(child);if(nested)return nested}return null};
      const match=visit(this);
      if(match)return match;
      const exactOption=q.match(/^option\[value="([^"]+)"\]$/i);
      if(exactOption){const option=new El();option.tagName='option';option.value=exactOption[1];this.append(option);return option}
      return null;
    }
    querySelectorAll(q){const matches=[];const visit=node=>{for(const child of node.children||[]){if(q==='[data-office-key]'&&child.dataset?.officeKey)matches.push(child);visit(child)}};visit(this);return matches}
    closest(selector){for(let node=this;node;node=node.parentElement)if(selector.startsWith('.')&&node.className===selector.slice(1))return node;return null}
    getAttribute(name){return this.attrs[name]||null}
    setAttribute(name,value){this.attrs[name]=value}
    scrollIntoView(){}
    click(){assert(this.events.click,this.id);this.events.click({stopPropagation(){}})}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new El(id));return elements.get(id)};
  for(const id of ids)get(id);get('machine-shop').parentElement=get('business-panel');get('material-quantity').value='25';get('loan-amount').value='10000';get('loan-repayment-amount').value='all';get('finance-period').value='day';
  const repairControls=new El();repairControls.append(get('repair-now'),get('continue-risky'));const repairLabel=new El();repairLabel.tagName='span';get('repair-now').append(repairLabel);
  get('detail-view').hidden=true;get('hall-preview').hidden=true;
  get('hall-map').clientWidth=400;get('hall-map').clientHeight=400;
  get('hall-preview').offsetWidth=190;get('hall-preview').offsetHeight=118;
  for(let bay=1;bay<=4;bay++){const span=new El();span.tagName='span';get('bay-'+bay).append(span)}
  const document={head:get('document-head'),getElementById:id=>(id==='order-office-panel'||id==='event-window')&&!elements.has(id)?null:get(id),createElement:tagName=>{const element=new El();element.tagName=String(tagName).toLowerCase();return element},createTextNode:text=>{const node=new El();node.textContent=String(text);return node},querySelector:q=>q==='main'?get('stage'):null,querySelectorAll:()=>[],addEventListener(){}};
  let nextFrame=()=>{},saveInterval=()=>{};
  const windowEvents={};
  const orderMarketApi=require(dir+'/systems/orderMarket.js');
  const orderMarket=options.orderMarketSeed===undefined?orderMarketApi:{...orderMarketApi,init:(state,initOptions={})=>orderMarketApi.init(state,{...initOptions,seed:options.orderMarketSeed})};
  const productionFlowApi=require(dir+'/systems/productionFlow.js');
  const productionFlow=typeof options.productionFlowTick==='function'?{...productionFlowApi,tick:options.productionFlowTick}:productionFlowApi;
  const context={document,console:options.console||console,Date,Math:math,JSON,performance:{now:()=>0},requestAnimationFrame:fn=>nextFrame=fn,setTimeout:(fn,ms)=>{if(options.phaser&&ms===0)fn();return 1},clearTimeout(){},setInterval:fn=>saveInterval=fn,window:{matchMedia:()=>({matches:true}),confirm:()=>true,addEventListener:(type,fn)=>windowEvents[type]=fn},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},CNCModules:{orderPlanning:require(dir+'/systems/orderPlanning.js'),economy:require(dir+'/systems/economy.js').economy,inventory:require(dir+'/systems/economy.js').inventory,orderMarket,breakdowns,factoryExpansion:require(dir+'/factory-expansion.js'),materials:require(dir+'/systems/materials.js'),recruitment:require(dir+'/systems/recruitment.js'),programmingQuality:require(dir+'/systems/programmingQuality.js'),employeeDevelopment:require(dir+'/systems/employeeDevelopment.js'),productionFlow,suppliers:require(dir+'/systems/suppliers.js'),customerProjects:require(dir+'/systems/customerProjects.js'),factorySituations:require(dir+'/systems/factorySituations.js')}};
  if(options.phaser)context.Phaser={Scene:class{},Game:class{},AUTO:0,Scale:{FIT:0,CENTER_BOTH:0}};
  context.globalThis=context;context.window.cncFactory=null;
  vm.runInNewContext(fs.readFileSync(dir+'/game.js','utf8'),context,{filename:'game.js'});
  return {get,createElement:tagName=>document.createElement(tagName),frame:t=>nextFrame(t),flush:()=>saveInterval(),resize:()=>windowEvents.resize?.(),state:()=>JSON.parse(storage.cnc_factory_save_v3),live:()=>context.window.cncFactory.getState()};
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
app.get('repair-now').click();st=app.state();assert.equal(st.breakdowns.machines['2'].status,'repairing');assert.equal(st.money,13664);const repairTransactions=st.finance.transactions.filter(x=>x.category==='repairs');assert.equal(repairTransactions.length,1);assert.equal(repairTransactions[0].amount,-336);
app=boot(storage);st=app.state();assert.equal(st.money,13664);assert.equal(st.breakdowns.machines['2'].status,'repairing');const reloadedRepairs=st.finance.transactions.filter(x=>x.category==='repairs');assert.equal(reloadedRepairs.length,1);assert.equal(reloadedRepairs[0].amount,-336);assert.equal(st.machines[0].activeId,'A12');
app.frame(1000);st=app.state();assert.equal(st.breakdowns.machines['2'].status,'repairing');assert.equal(st.finance.transactions.filter(x=>x.category==='repairs').length,1);
const crashStorage={cnc_factory_save_v3:JSON.stringify({money:14000,material:0,capacity:300,staff:{shift1:0,shift2:0},machines:[],gameMinutes:0,speed:1,paused:false})};
const crashApp=boot(crashStorage,{productionFlowTick(state){state.money=1;throw new Error('injected simulation failure');},console:{error(){}}});
crashApp.frame(1000);
const recoveredCrashSave=crashApp.state();
assert.equal(recoveredCrashSave.money,14000,'failed tick mutations are rolled back');
assert.equal(recoveredCrashSave.gameMinutes,0,'failed tick time is rolled back');
assert.equal(recoveredCrashSave.paused,true,'recovered save pauses after the simulation error');
assert.equal(JSON.parse(crashStorage.cnc_factory_save_v3_backup).money,14000,'the backup contains the last stable save');

const backupRecoveryStorage={cnc_factory_save_v3:'{damaged json',cnc_factory_save_v3_backup:JSON.stringify({money:17000,material:0,capacity:300,staff:{shift1:0,shift2:0},machines:[],gameMinutes:60,speed:1,paused:false})};
const backupRecovered=boot(backupRecoveryStorage);
assert.equal(backupRecovered.state().money,17000,'invalid primary save falls back to the backup');
assert.equal(backupRecovered.state().gameMinutes,60,'backup save progress is retained');
assert.equal(backupRecovered.state().paused,true,'restoring a backup requires a deliberate resume');
const wornSave={money:25000,material:120,capacity:300,staff:{shift1:1,shift2:0},
  machines:[{bay:1,type:'standard',level:1,maintenance:36,tool:.5,operator1:true,operator2:false,activeId:'A12',progress:45,produced:22,deadlineAt:420}],
  selectedBay:1,gameMinutes:0,speed:1,paused:false};
const wornStorage={cnc_factory_save_v3:JSON.stringify(wornSave)};
let worn=boot(wornStorage);
assert.match(worn.get('machine-meta').textContent,/Werkzeug verschlissen/);
assert.equal(worn.get('tool-label').textContent,'<1 %');
assert.equal(worn.get('change-tool').disabled,false);
assert.equal(worn.get('maintenance').disabled,false);
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
assert.equal(due.state().machines[0].maintenance,7.5);
assert.equal(due.state().machines[0].maintenanceRemainingMinutes,60);
assert.equal(due.state().machines[0].activeId,'A12');
assert.equal(due.state().machines[0].progress,45);
due=boot(dueStorage);
assert.equal(due.state().finance.transactions.filter(x=>x.category==='maintenance').length,1);
assert.equal(due.state().machines[0].maintenanceRemainingMinutes,60);
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
const c45StockRow=empty.get('storage-stock').children.find(row=>row.children?.[0]?.textContent==='C45 Stahl');
assert.ok(c45StockRow);
assert.equal(c45StockRow.children[1].textContent,'25 kg');
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
const officeOrder={id:'OFFICE-TEST',kind:'Drehen',customer:'Test',part:'Disponentenauftrag',material:'C45 Stahl',kg:30,qty:10,reward:4000,duration:8,deadlineHours:48,createdAt:0,expiresAt:1000};
const officeBase=JSON.parse(JSON.stringify(empty.state()));
officeBase.money=20000;officeBase.material=0;officeBase.capacity=300;officeBase.staff={shift1:1,shift2:0};officeBase.gameMinutes=480;officeBase.paused=false;officeBase.speed=1;
officeBase.inventory.rawMaterial.c45=0;officeBase.factoryExpansion={level:2,unlockedBays:6};
officeBase.machines=[{bay:1,type:'standard',level:1,maintenance:90,tool:82,operator1:true,operator2:false,activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,deadlineAt:null,orderQueue:[]}];
officeBase.orderMarket.available=[officeOrder,...officeBase.orderMarket.available.map(order=>({...order,kind:'Fräsen'}))];
officeBase.orderMarket.now=480;officeBase.orderMarket.nextRefreshAt=10000;officeBase.orderMarket.pendingFollowUps=[];
officeBase.ncPrograms['Drehen:disponentenauftrag']={part:officeOrder.part,kind:officeOrder.kind,completedAt:0,legacy:true};
officeBase.orderOffice={hired:true,autoPurchase:true,autoAccept:true,cashReserve:5000,maxMarketMarkupPct:0,minMaterialSurplus:1000,queueLimit:1,nextReviewAt:480};
let office=boot({cnc_factory_save_v3:JSON.stringify(officeBase)});office.frame(1000);
let officeSaved=office.state();
assert.ok(officeSaved.machines[0].activeId==='OFFICE-TEST'||officeSaved.machines[0].orderQueue.some(entry=>entry.order.id==='OFFICE-TEST')||
  (officeSaved.productionFlow.orders['OFFICE-TEST']&&officeSaved.productionFlow.lots.some(lot=>lot.orderId==='OFFICE-TEST'&&['queued','running','waiting'].includes(lot.status))));
assert.equal(officeSaved.inventory.rawMaterial.c45,25);
assert.equal(officeSaved.finance.transactions.filter(entry=>entry.category==='material'&&entry.meta?.automatic).length,1);
assert.equal(officeSaved.orderMarket.available.some(order=>order.id==='OFFICE-TEST'),false);
const reserveLimited={...officeBase,money:5000};
office=boot({cnc_factory_save_v3:JSON.stringify(reserveLimited)});office.frame(1000);
officeSaved=office.state();
assert.equal(officeSaved.machines[0].activeId,null);
assert.equal(officeSaved.finance.transactions.filter(entry=>entry.category==='material').length,officeBase.finance.transactions.filter(entry=>entry.category==='material').length);
assert.equal(officeSaved.inventory.rawMaterial.c45,0);
const officeUiState=JSON.parse(JSON.stringify(empty.state()));
officeUiState.money=20000;officeUiState.factoryExpansion={level:2,unlockedBays:6};
let officeUi=boot({cnc_factory_save_v3:JSON.stringify(officeUiState)});officeUi.get('business-tab').click();
assert.equal(officeUi.get('hire-order-office').disabled,false);
assert.equal(officeUi.get('order-office-settings').hidden,true);
officeUi.get('hire-order-office').click();
assert.equal(officeUi.state().orderOffice.hired,true);
assert.equal(officeUi.state().money,8000);
assert.equal(officeUi.get('order-office-settings').hidden,false);
let officeControls=officeUi.get('order-office-settings').querySelectorAll('[data-office-key]');
assert.deepEqual(officeControls.map(control=>control.dataset.officeKey).sort(),['autoAccept','autoPurchase','cashReserve','materialReserveKg','maxMarketMarkupPct','minMaterialSurplus','queueLimit'].sort());
const acceptToggle=officeControls.find(control=>control.dataset.officeKey==='autoAccept');
const reserveSelect=officeControls.find(control=>control.dataset.officeKey==='cashReserve');
assert.equal(acceptToggle.checked,true);acceptToggle.checked=false;acceptToggle.events.change();
reserveSelect.value='10000';reserveSelect.events.change();
assert.equal(officeUi.state().orderOffice.autoAccept,false);
assert.equal(officeUi.state().orderOffice.cashReserve,10000);
officeUi=boot({cnc_factory_save_v3:JSON.stringify(officeUi.state())});officeUi.get('business-tab').click();
officeControls=officeUi.get('order-office-settings').querySelectorAll('[data-office-key]');
assert.equal(officeControls.find(control=>control.dataset.officeKey==='autoAccept').checked,false);
assert.equal(officeControls.find(control=>control.dataset.officeKey==='cashReserve').value,'10000');
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
const expandedStorage={cnc_factory_save_v3:JSON.stringify({money:400000,material:100,capacity:300,staff:{shift1:0,shift2:0},machines:[{bay:1,type:'standard',progress:0},{bay:3,type:'mill3',progress:0}],selectedBay:1,gameMinutes:0,speed:1,paused:false})};
let exp=boot(expandedStorage);assert.equal(exp.state().factoryExpansion.unlockedBays,4);
exp.get('expand-factory').click();assert.equal(exp.state().factoryExpansion.unlockedBays,6);assert.equal(exp.state().money,325000);assert.equal(exp.get('hall-image').src,'hall-level-2-photo.png?v=1');
exp.get('expand-factory').click();assert.equal(exp.state().factoryExpansion.unlockedBays,8);assert.equal(exp.state().money,175000);
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
const plannedRepairState=JSON.parse(warningStorage.cnc_factory_save_v3);plannedRepairState.machines[0].activeId=null;plannedRepairState.machines[0].activeOrder=null;
const plannedRepairStorage={cnc_factory_save_v3:JSON.stringify(plannedRepairState)};
warned=boot(plannedRepairStorage);warned.get('schedule-repair').click();assert.equal(warned.state().breakdowns.machines['1'].status,'repairing');assert.equal(warned.state().breakdowns.machines['1'].plannedRepair,true);
assert.equal(warned.state().finance.transactions.filter(x=>x.category==='repairs').length,1);
warned=boot(plannedRepairStorage);assert.equal(warned.state().breakdowns.machines['1'].status,'repairing');assert.equal(warned.state().breakdowns.machines['1'].plannedRepair,true);
assert.equal(warned.state().finance.transactions.filter(x=>x.category==='repairs').length,1);
const typedState=empty.state();typedState.inventory.rawMaterial.aluminium6082=100;typedState.material=125;
typedState.machines=[{bay:1,type:'standard',level:1,maintenance:90,tool:82,operator1:true,operator2:false,activeId:null,progress:0,produced:0,deadlineAt:null}];typedState.staff.shift1=1;typedState.selectedBay=1;
typedState.ncPrograms['Drehen:stahlteil']={part:'Stahlteil',kind:'Drehen',completedAt:0,legacy:true};
typedState.orderMarket.available.push({id:'MATERIAL-TEST',kind:'Drehen',customer:'Test',part:'Stahlteil',material:'C45 Stahl',kg:30,qty:10,reward:4000,duration:8,deadlineHours:4,createdAt:0,expiresAt:1000});
const typedStorage={cnc_factory_save_v3:JSON.stringify(typedState)};
let typed=boot(typedStorage);let card=typed.get('orders').children.find(x=>x.innerHTML?.includes('MATERIAL-TEST'));
assert.equal(card.children.at(-1).disabled,true);
typed.get('buy-material').click();card=typed.get('orders').children.find(x=>x.innerHTML?.includes('MATERIAL-TEST'));
assert.equal(card.children.at(-1).disabled,false);
card.children.at(-1).click();typed.get('assignment-options').children[0].children[0].click();const accepted=typed.state();
assert.equal(accepted.machines[0].activeId,'MATERIAL-TEST');assert.equal(accepted.inventory.rawMaterial.c45,20);
assert.equal(accepted.inventory.rawMaterial.aluminium6082,100);
typed=boot(typedStorage);assert.equal(typed.state().machines[0].activeId,'MATERIAL-TEST');assert.equal(typed.state().inventory.rawMaterial.c45,20);
assert.equal(typed.state().staffRoster.shift1[0].assignedBay,1);
const beforeTraining=typed.state().money;
typed.get('staff-development').children[0].children.at(-1).click();
assert.equal(typed.state().money,beforeTraining-900);
assert.equal(typed.state().staffRoster.shift1[0].trained,1);
assert.equal(typed.state().finance.transactions.filter(x=>x.meta?.employeeId).length,1);
typed=boot(typedStorage);
assert.equal(typed.state().staffRoster.shift1[0].trained,1);
typed.frame(1000);
typed.flush();
assert.ok(typed.state().staffRoster.shift1[0].xp>0);
const moveState=typed.state();
Object.assign(moveState.machines[0],{activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,operatorProgramming:null,deadlineAt:null});
moveState.machines.push({bay:2,type:'standard',level:1,maintenance:90,tool:82,operator1:false,operator2:false,activeId:null,progress:0});
const moveStorage={cnc_factory_save_v3:JSON.stringify(moveState)};
let moved=boot(moveStorage);
const workerId=moved.state().staffRoster.shift1[0].id;
moved.get('operator-1').click();
moved.get('bay-2').click();moved.get('operator-1').click();
moved.get('operator-picker').children[1].children[0].children[2].click();
assert.equal(moved.state().staffRoster.shift1[0].assignedBay,2);
assert.equal(moved.state().staffRoster.shift1[0].id,workerId);
assert.equal(moved.state().staffRoster.shift1[0].trained,1);
moved.get('sell-machine').click();
assert.equal(moved.state().staffRoster.shift1[0].assignedBay,null);
moved=boot(moveStorage);assert.equal(moved.state().staffRoster.shift1[0].trained,1);
const skilledState=typed.state(),noviceState=JSON.parse(JSON.stringify(skilledState));
skilledState.machines[0].progress=0;noviceState.machines[0].progress=0;
for(const machine of [skilledState.machines[0],noviceState.machines[0]])Object.assign(machine,{setupRemainingMinutes:0,setupDurationMinutes:0,setupDelayMinutes:0,setupPartProduced:true,ncProgramPending:false});
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
queueCard.children.at(-1).click();
queued.get('assignment-options').children[0].children[0].click();
let queueSave=queued.state();
assert.equal(queueSave.machines[0].activeId,'MATERIAL-TEST');
let queueLot=queueSave.productionFlow.lots.find(lot=>lot.orderId==='QUEUE-TEST');
assert.equal(queueLot.status,'queued');
assert.ok(queueSave.productionFlow.queues['Drehen'].includes(queueLot.id));
assert.equal(queueSave.inventory.rawMaterial.c45,10);
assert.equal(queueSave.orderMarket.available.some(x=>x.id==='QUEUE-TEST'),false);
assert.equal(queueSave.finance.transactions.filter(x=>x.category==='income').length,0);
assert.equal(queued.get('sell-machine').disabled,true);
queued=boot(queueStorage);
queueLot=queued.state().productionFlow.lots.find(lot=>lot.orderId==='QUEUE-TEST');
assert.equal(queueLot.status,'queued','the station queue should survive a reload');
assert.ok(queued.state().productionFlow.queues['Drehen'].includes(queueLot.id));
const fullWarehouse=JSON.parse(JSON.stringify(queueSave));
fullWarehouse.inventory.rawMaterial.c45=200;fullWarehouse.material=300;
const fullQueue=boot({cnc_factory_save_v3:JSON.stringify(fullWarehouse)});
assert.equal(fullQueue.state().productionFlow.lots.find(lot=>lot.orderId==='QUEUE-TEST').status,'queued');
console.log('Game integration: material purchase, jobs, repair decisions, expansion and reload OK');

const legacyQueueState=JSON.parse(JSON.stringify(queueState));
const olderEntry={order:{id:'LEGACY-QUEUE',kind:'Drehen',customer:'Test',part:'Altauftrag',material:'C45 Stahl',kg:10,qty:10,reward:3000,duration:20,deadlineHours:4},material:{c45:10},deadlineAt:240};
legacyQueueState.machines[0].queuedOrder=olderEntry.order;
legacyQueueState.machines[0].queuedMaterial=olderEntry.material;
legacyQueueState.machines[0].queuedDeadlineAt=olderEntry.deadlineAt;
const migrated=boot({cnc_factory_save_v3:JSON.stringify(legacyQueueState)});
assert.equal(migrated.state().machines[0].orderQueue[0].order.id,'LEGACY-QUEUE');
assert.equal(migrated.state().machines[0].orderQueue[0].deadlineAt,olderEntry.deadlineAt);
assert.equal(migrated.state().machines[0].queuedOrder,undefined);
const multiState=typed.state();
multiState.inventory.rawMaterial.c45=80;multiState.material=80;
for(let i=1;i<=4;i++)multiState.orderMarket.available.push({
  id:`BATCH-${i}`,kind:'Drehen',customer:'Test',part:`Serie ${i}`,material:'C45 Stahl',
  kg:10,qty:10,reward:3000,duration:20,deadlineHours:4,priority:i===2?'high':'normal',createdAt:0,expiresAt:1000
});
const multiStorage={cnc_factory_save_v3:JSON.stringify(multiState)};
let multiple=boot(multiStorage);
const multiInitialStock=multiple.state().material;
for(let i=1;i<=4;i++){
  const card=multiple.get('orders').children.find(x=>x.innerHTML?.includes(`BATCH-${i}`));
  assert.equal(card.children.at(-1).disabled,false);
  card.children.at(-1).click();
  multiple.get('assignment-options').children[0].children[0].click();
}
assert.equal(multiple.state().material,multiInitialStock-40);
const queuedBatchOrderIds=save=>save.productionFlow.queues.Drehen.map(lotId=>save.productionFlow.lots.find(lot=>lot.id===lotId).orderId);
assert.deepEqual(queuedBatchOrderIds(multiple.state()),['BATCH-2','BATCH-1','BATCH-3','BATCH-4'],'high priority goes first; equal-priority lots remain FIFO');
multiple=boot(multiStorage);
assert.deepEqual(queuedBatchOrderIds(multiple.state()),['BATCH-2','BATCH-1','BATCH-3','BATCH-4'],'priority/FIFO order should survive reload');
console.log('Production flow queues: priority, FIFO, reload and material reservation OK');

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
const applicantCards=()=>recruiting.get('applicant-list').children.filter(node=>node.className?.includes('applicant-card'));
const operatorCards=()=>applicantCards().filter(node=>!node.className.includes('quality-applicant-card'));
assert.equal(applicantCards().length,recruiting.state().recruitment.applicants.length+recruiting.state().recruitment.qualityApplicants.length);
const firstApplicantCard=operatorCards()[0];
assert.match(firstApplicantCard.children[0].children[1].children[0].textContent,/[A-Z][a-z]+ [A-Z][a-z]+/);
assert.equal(firstApplicantCard.children[2].children.length,4);
const firstApplicant=recruiting.state().recruitment.applicants[0];
const firstHireButton=firstApplicantCard.children[3].children[0];
firstHireButton.click();
firstHireButton.click();
let recruited=recruiting.state();
assert.equal(recruited.money,13850);
assert.equal(recruited.staff.shift1,1);
assert.equal(recruited.staffRoster.shift1[0].name,firstApplicant.name);
assert.equal(recruited.staffRoster.shift1[0].profileVersion,2);
assert.equal(recruited.staffRoster.shift1[0].assignedBay,null);
assert.equal(recruited.recruitment.applicants.length,3);
assert.equal(recruited.recruitment.applicants.some(candidate=>candidate.id===firstApplicant.id),false);
assert.equal(recruited.finance.transactions.filter(entry=>entry.meta?.setupFee).length,1);
assert.equal(recruited.finance.transactions.filter(entry=>entry.meta?.setupFee)[0].amount,-150);
const secondShiftCandidate=recruited.recruitment.applicants[0];
const secondShiftWage=require(dir+'/systems/recruitment.js').hourlyWage(secondShiftCandidate,2);
assert.equal(operatorCards()[0].children[3].children[1].title,`${secondShiftCandidate.name} · Bediener Schicht 2: ${secondShiftWage} € pro Stunde`);
assert.equal(operatorCards()[0].children[3].children[1].children[0].textContent,'S2 als Bediener');
assert.ok(operatorCards()[0].children[3].children[1].children[1].textContent.endsWith(`· ${secondShiftWage} €/h`));
recruiting.get('recruitment-back').click();
assert.equal(recruiting.get('business-panel').hidden,false);
assert.match(recruiting.get('staff-development').children[0].children[1].children[0].textContent,new RegExp(firstApplicant.name));
const secondApplicant=recruited.recruitment.applicants[0];
recruiting.get('open-recruitment').click();
operatorCards()[0].children[3].children[1].click();
recruited=recruiting.state();
assert.equal(recruited.money,13700);
assert.equal(recruited.staff.shift2,1);
assert.equal(recruited.staffRoster.shift2[0].name,secondApplicant.name);
assert.equal(recruited.finance.transactions.filter(entry=>entry.meta?.setupFee).length,2);
recruiting=boot({cnc_factory_save_v3:JSON.stringify(recruited)});
assert.equal(recruiting.state().staffRoster.shift1[0].name,firstApplicant.name);
assert.equal(recruiting.state().staffRoster.shift1[0].profileVersion,2);
assert.deepEqual(recruiting.state().recruitment.applicants,recruited.recruitment.applicants);
recruiting.get('business-tab').click();
const stableTrainingButton=recruiting.get('staff-development').children[0].children[3];
recruiting.frame(1000);
assert.strictEqual(recruiting.get('staff-development').children[0].children[3],stableTrainingButton);

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
const developmentRow=recruiting.get('staff-development').children[0];
assert.match(developmentRow.children[1].children[1].textContent,/Können 0\/3/);
assert.match(developmentRow.children[3].textContent,/Stufe 1.*€ 900/);
assert.match(developmentRow.children[3].title,/\+5 % Produktionstempo/);
developmentRow.children[3].click();
const trained=recruiting.state();
assert.equal(trained.staffRoster.shift1[0].trained,1);
assert.equal(trained.money,12800);
assert.equal(trained.finance.transactions.filter(entry=>entry.text?.startsWith('Schulung')).length,1);
assert.match(recruiting.get('staff-development').children[0].children[1].children[1].textContent,/Können 1\/3/);
console.log('Recruitment: profiles, shift hiring, finance booking, training feedback and old-save migration OK');

const loanStorage={};
let loan=boot(loanStorage);
loan.get('business-tab').click();
assert.match(loan.get('credit-offer').textContent,/24 Monate mit gleichbleibender Tilgung/);
assert.equal(loan.get('take-loan').disabled,false);
loan.get('loan-amount').value='25000';
loan.get('loan-amount').events.change();
loan.get('take-loan').click();
let loanState=loan.state();
assert.equal(loanState.money,39000);
assert.equal(loanState.credit.principal,25000);
assert.equal(loan.get('take-loan').disabled,true);
assert.equal(loanState.finance.transactions.filter(entry=>entry.category==='loan_drawdown')[0].amount,25000);
assert.equal(require(dir+'/systems/economy.js').economy.getProfit(loanState),0);
assert.match(loan.get('finance-totals').children.map(row=>row.children[0].textContent).join(' '),/Kreditauszahlung/);
loan.get('repay-credit').click();
loanState=loan.state();
assert.equal(loanState.money,14000);
assert.equal(loanState.credit.principal,0);
assert.equal(loanState.finance.transactions.filter(entry=>entry.category==='loan_repayment')[0].amount,-25000);
assert.equal(require(dir+'/systems/economy.js').economy.getProfit(loanState),0);

const dueAtMonthStart=boot({cnc_factory_save_v3:JSON.stringify({
  money:5000,material:0,capacity:300,staff:{shift1:0,shift2:0},machines:[],selectedBay:null,
  gameMinutes:38519,speed:1,paused:false,
  credit:{principal:10000,originalAmount:10000,annualRate:.12,paymentsRemaining:24,accruedInterest:0,nextPaymentAt:38520,missedPayments:0}
})});
dueAtMonthStart.frame(1000);
const paidInstallment=dueAtMonthStart.state();
assert.equal(paidInstallment.credit.principal,9583.33);
assert.equal(paidInstallment.credit.paymentsRemaining,23);
assert.equal(paidInstallment.money,4483.33);
assert.equal(paidInstallment.finance.transactions.filter(entry=>entry.category==='loan_interest').length,1);
assert.equal(paidInstallment.finance.transactions.filter(entry=>entry.category==='loan_repayment').length,1);

const missedAtMonthStart=boot({cnc_factory_save_v3:JSON.stringify({
  money:100,material:0,capacity:300,staff:{shift1:0,shift2:0},machines:[],selectedBay:null,
  gameMinutes:38519,speed:1,paused:false,
  credit:{principal:10000,originalAmount:10000,annualRate:.12,paymentsRemaining:24,accruedInterest:0,nextPaymentAt:38520,missedPayments:0}
})});
missedAtMonthStart.frame(1000);
const missedInstallment=missedAtMonthStart.state();
assert.equal(missedInstallment.credit.principal,10000);
assert.equal(missedInstallment.credit.accruedInterest,100);
assert.equal(missedInstallment.credit.missedPayments,1);
assert.equal(missedInstallment.finance.transactions.filter(entry=>entry.category==='loan_repayment').length,0);
console.log('Credit: visible offer, drawdown, early repayment, monthly rate and missed-payment handling OK');


const pendingRushPauseStorage={cnc_factory_save_v3:JSON.stringify({
  money:14000,material:0,capacity:300,staff:{shift1:1,shift2:0},
  machines:[{bay:1,type:'standard',level:1,maintenance:90,tool:90,operator1:true,operator2:false,
    activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,deadlineAt:null,orderQueue:[]}],
  selectedBay:1,gameMinutes:120,speed:5,paused:false,
  pendingRushAssignment:{orderId:'RUSH-LOCK',bay:1,interrupt:false},
  warehouseOrderSnapshot:{
    id:'RUSH-LOCK',kind:'Drehen',customer:'Testkunde',customerProfile:'standard',part:'Eilteil',partKey:'shaft',
    material:'C45 Stahl',kg:40,qty:10,reward:5000,duration:10,difficulty:2,deadlineHours:12,
    createdAt:120,expiresAt:2000,offerLifetimeMinutes:1880,isRushOrder:true,rushBonus:800,rushBonusPct:20
  }
})};
const pendingRushPause=boot(pendingRushPauseStorage);
assert.equal(pendingRushPause.state().paused,true);
assert.equal(pendingRushPause.get('pause').disabled,true);
assert.match(pendingRushPause.get('pause').textContent,/Eilauftrag einplanen/);
const rushPausedMinute=pendingRushPause.state().gameMinutes;
pendingRushPause.frame(1000);
assert.equal(pendingRushPause.state().gameMinutes,rushPausedMinute);
pendingRushPause.get('pause').click();
assert.equal(pendingRushPause.state().paused,true);
console.log('Rush assignment lock: reload remains paused and manual resume is blocked');


const hallOperatorBase={
  money:14000,material:120,capacity:300,staff:{shift1:1,shift2:1},
  staffRoster:{
    nextId:3,
    shift1:[{id:1,profileVersion:2,name:'Mira Test',gender:'female',skills:{turning:8,milling:4,precision:9,learning:7},xp:0,trained:0,assignedBay:1}],
    shift2:[{id:2,profileVersion:2,name:'Tarek Test',gender:'male',skills:{turning:7,milling:3,precision:6,learning:5},xp:0,trained:0,assignedBay:1}]
  },
  machines:[{bay:1,type:'standard',level:1,maintenance:90,tool:90,operator1:true,operator2:true,activeId:'A12',progress:25,produced:12,deadlineAt:900}],
  selectedBay:1,speed:1,paused:false
};
let hallOperator=boot({cnc_factory_save_v3:JSON.stringify({...hallOperatorBase,gameMinutes:0})});
let hallWorker=hallOperator.get('bay-1').querySelector('.bay-operator'),hallSprite=hallOperator.get('bay-1').querySelector('.bay-worker-sprite');
let hallWorkerName=hallOperator.get('bay-1').querySelector('.bay-worker-name');
assert.ok(hallWorker||hallSprite);
assert.equal((hallWorker||hallSprite).hidden,false);
assert.equal((hallWorker||hallSprite).dataset.employeeId,'1');
assert.equal((hallWorker||hallSprite).dataset.shift,'1');
assert.match(hallWorkerName.textContent,/Mira Test/);
if(hallWorker)assert.equal(hallWorker.children[0].src,hallOperator.state().staffRoster.shift1[0].portrait);

hallOperator=boot({cnc_factory_save_v3:JSON.stringify({...hallOperatorBase,gameMinutes:480})});
hallWorker=hallOperator.get('bay-1').querySelector('.bay-operator');hallSprite=hallOperator.get('bay-1').querySelector('.bay-worker-sprite');
hallWorkerName=hallOperator.get('bay-1').querySelector('.bay-worker-name');
assert.ok(hallWorker||hallSprite);
assert.equal((hallWorker||hallSprite).hidden,false);
assert.equal((hallWorker||hallSprite).dataset.employeeId,'2');
assert.equal((hallWorker||hallSprite).dataset.shift,'2');
assert.match(hallWorkerName.textContent,/Tarek Test/);
if(hallWorker)assert.equal(hallWorker.children[0].src,hallOperator.state().staffRoster.shift2[0].portrait);

const idleHallOperator=boot({cnc_factory_save_v3:JSON.stringify({
  ...hallOperatorBase,gameMinutes:0,
  machines:[{...hallOperatorBase.machines[0],activeId:null,activeOrder:null,progress:0,produced:0}]
})});
const idleWorker=idleHallOperator.get('bay-1').querySelector('.bay-operator');
assert.equal(idleWorker?.hidden??true,true);
console.log('Hall employees: active shift uses the exact employee profile portrait and idle machines hide it');


const namedWorkerSpriteBase={
  money:14000,material:120,capacity:300,staff:{shift1:1,shift2:1},
  staffRoster:{
    nextId:3,
    shift1:[{id:1,profileVersion:2,name:'Vaska Feilensang',gender:'female',skills:{turning:8,milling:4,precision:9,learning:7},xp:0,trained:0,assignedBay:1}],
    shift2:[{id:2,profileVersion:2,name:'Kael Drehkamm',gender:'male',skills:{turning:9,milling:3,precision:7,learning:5},xp:0,trained:0,assignedBay:1}]
  },
  machines:[{bay:1,type:'rapid',level:1,maintenance:90,tool:90,operator1:true,operator2:true,activeId:'A12',progress:25,produced:12,deadlineAt:900}],
  selectedBay:1,speed:1,paused:false
};

let namedWorker=boot({cnc_factory_save_v3:JSON.stringify({...namedWorkerSpriteBase,gameMinutes:0})});
let namedSprite=namedWorker.get('bay-1').querySelector('.bay-worker-sprite');
assert.ok(namedSprite);
assert.equal(namedSprite.hidden,false);
assert.equal(namedSprite.dataset.employeeId,'1');
assert.match(namedSprite.src,/assets\/vaska-working\.webp\?v=2$/);
assert.equal(namedWorker.get('bay-1').querySelector('.bay-operator')?.hidden??true,true);

namedWorker=boot({cnc_factory_save_v3:JSON.stringify({...namedWorkerSpriteBase,gameMinutes:480})});
namedSprite=namedWorker.get('bay-1').querySelector('.bay-worker-sprite');
assert.ok(namedSprite);
assert.equal(namedSprite.hidden,false);
assert.equal(namedSprite.dataset.employeeId,'2');
assert.match(namedSprite.src,/assets\/kael-working\.webp\?v=2$/);
console.log('Named hall sprites: Vaska and Kael switch with the active shift');

const factory2State=JSON.parse(JSON.stringify(empty.state()));
factory2State.money=100000;factory2State.material=500;factory2State.gameMinutes=360;factory2State.speed=10;factory2State.paused=false;
factory2State.inventory.rawMaterial.c45=500;
factory2State.staff={shift1:2,shift2:2};
factory2State.staffRoster={nextId:5,
  shift1:[{id:1,profileVersion:2,name:'Dreher S1',gender:'female',skills:{turning:8,milling:6,precision:8,learning:6},xp:0,trained:0,assignedBay:1},{id:2,profileVersion:2,name:'Fräser S1',gender:'male',skills:{turning:6,milling:8,precision:8,learning:6},xp:0,trained:0,assignedBay:2}],
  shift2:[{id:3,profileVersion:2,name:'Dreher S2',gender:'female',skills:{turning:8,milling:6,precision:8,learning:6},xp:0,trained:0,assignedBay:1},{id:4,profileVersion:2,name:'Fräser S2',gender:'male',skills:{turning:6,milling:8,precision:8,learning:6},xp:0,trained:0,assignedBay:2}]};
factory2State.qualityStaff={shift1:[{id:5,profileVersion:2,name:'QS S1',profileType:'quality',qualityCertified:true,qualityTrainingRemainingMinutes:0,skills:{precision:9,learning:7},xp:0}],
  shift2:[{id:6,profileVersion:2,name:'QS S2',profileType:'quality',qualityCertified:true,qualityTrainingRemainingMinutes:0,skills:{precision:9,learning:7},xp:0}]};
factory2State.machines=[
  {bay:1,type:'standard',level:1,maintenance:100,tool:100,operator1:true,operator2:true,activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,deadlineAt:null,orderQueue:[]},
  {bay:2,type:'mill3',level:1,maintenance:100,tool:100,operator1:true,operator2:true,activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,deadlineAt:null,orderQueue:[]}
];
for(const [bay,type] of [[3,'standard'],[4,'standard'],[5,'mill3'],[6,'mill3']]){
  const machine={...factory2State.machines[0],bay,type,activeId:null,activeOrder:null,activeOrderSource:null,progress:0,produced:0,deadlineAt:null,orderQueue:[]};
  factory2State.machines.push(machine);
  const turning=type==='standard';
  const skills=turning?{turning:8,milling:6,precision:8,learning:6}:{turning:6,milling:8,precision:8,learning:6};
  factory2State.staffRoster.shift1.push({id:bay+2,profileVersion:2,name:'Zusatzkraft S1 '+bay,gender:'female',skills:{...skills},xp:0,trained:0,assignedBay:bay});
  factory2State.staffRoster.shift2.push({id:bay+6,profileVersion:2,name:'Zusatzkraft S2 '+bay,gender:'male',skills:{...skills},xp:0,trained:0,assignedBay:bay});
}
factory2State.staff={shift1:6,shift2:6};factory2State.staffRoster.nextId=13;
factory2State.selectedBay=1;factory2State.factoryExpansion={level:2,unlockedBays:6};factory2State.nextRushOrderAt=1000000;factory2State.inventory.tools.standard=20;factory2State.inventory.tools.mill3=20;factory2State.factorySituations={version:1,randomState:1,nextSpecialOrderNumber:1,nextSituationNumber:1,nextSituationCheckAtMinute:1000000,lastTickAtMinute:360,scheduled:[],active:[],history:[]};
const flowProject=require(dir+'/systems/customerProjects.js').create(factory2State,{customer:'Veltraxis Mobility',reputation:50},{size:'medium',atMinute:360});
const factory2Order={id:'FLOW-120',kind:'Drehen',customer:'Veltraxis Mobility',part:'120er Wellenserie',partKey:'shaft',material:'C45 Stahl',kg:120,qty:120,reward:12000.07,duration:12,difficulty:1,deadlineHours:48,createdAt:360,expiresAt:3000};
Object.assign(factory2Order,{priority:'high',batchMode:'small',routing:[{id:'flow-turn',type:'turning',requiredMachineKind:'Drehen'},{id:'flow-mill',type:'milling',requiredMachineKind:'Fräsen'},{id:'flow-qs',type:'quality',requiredMachineKind:null}]});
factory2State.orderMarket.available=[factory2Order];factory2State.orderMarket.now=360;factory2State.orderMarket.nextRefreshAt=3000;factory2State.orderMarket.pendingFollowUps=[];
let factory2=boot({cnc_factory_save_v3:JSON.stringify(factory2State)},{random:()=>0.999999});
let flowCard=factory2.get('orders').children.find(node=>node.innerHTML?.includes('FLOW-120'));
assert.ok(flowCard,'120-part order should be visible in the offer list');
flowCard.children.at(-1).click();
factory2.get('assignment-options').children[0].children[0].click();
let factory2Saved=factory2.state(),flowOrder=factory2Saved.productionFlow.orders['FLOW-120'];
assert.equal(flowOrder.priority,'high');assert.equal(flowOrder.batchMode,'small');assert.equal(flowOrder.projectId,flowProject.id);
assert.deepEqual(flowOrder.routing.map(step=>step.type),['turning','milling','quality']);
let flowLots=factory2Saved.productionFlow.lots.filter(lot=>lot.orderId==='FLOW-120');
assert.ok(flowLots.length>1);assert.equal(flowLots.reduce((sum,lot)=>sum+lot.qty,0),120);
assert.ok(flowLots.some(lot=>lot.status==='running'),'first compatible machine should start a queued lot');
assert.equal(factory2Saved.inventory.rawMaterial.c45,380);
factory2=boot({cnc_factory_save_v3:JSON.stringify(factory2Saved)},{random:()=>0.999999});
assert.equal(factory2.state().productionFlow.lots.filter(lot=>lot.orderId==='FLOW-120').length,flowLots.length);
let flowClock=1000;
for(;flowClock<=240000;flowClock+=1000){
  factory2.frame(flowClock);factory2Saved=factory2.live();
  flowLots=factory2Saved.productionFlow.lots.filter(lot=>lot.orderId==='FLOW-120');
  if(flowLots.some(lot=>lot.routePosition>=2))break;
}
assert.ok(flowLots.some(lot=>lot.routePosition>=2),'at least one lot should reach or finish the QS route step');
assert.equal(factory2Saved.customerProjects.projects.find(project=>project.id===flowProject.id).phaseResults.length,0,'project phase must wait for every lot');
factory2Saved=factory2.state();

for(let t=flowClock;t<=flowClock+120000;t+=250){
  factory2.frame(t);factory2Saved=factory2.live();
  flowLots=factory2Saved.productionFlow.lots.filter(lot=>lot.orderId==='FLOW-120');
  if(flowLots.every(lot=>lot.status==='completed'))break;
}
assert.ok(flowLots.every(lot=>lot.status==='completed'),'all 120 parts should finish the mixed route');
factory2.flush();factory2Saved=factory2.state();
const completedFlowProject=factory2Saved.customerProjects.projects.find(project=>project.id===flowProject.id);
assert.equal(completedFlowProject.phaseResults.length,1,'all lots should advance exactly one project phase');
assert.equal(completedFlowProject.phaseResults[0].qualityDefectParts,factory2Saved.factory2.orderResults['FLOW-120'].qualityDefectParts,'project phase should record aggregate lot quality');
assert.equal(completedFlowProject.phaseResults[0].late,factory2Saved.factory2.orderResults['FLOW-120'].late);
assert.equal(factory2Saved.orderMarket.completedOrderIds.filter(id=>id==='FLOW-120').length,1);
const incomeEntries=factory2Saved.finance.transactions.filter(entry=>entry.category==='income'&&entry.meta?.orderId==='FLOW-120');
assert.equal(incomeEntries.length,flowLots.length,'each completed lot should be paid once');
const incomeTotal=incomeEntries.reduce((sum,entry)=>sum+entry.amount,0);
assert.equal(incomeTotal,12000.07,'deterministic per-lot cents should pay the accepted reward exactly once in aggregate');
factory2=boot({cnc_factory_save_v3:JSON.stringify(factory2Saved)},{random:()=>0.999999});
assert.equal(factory2.state().finance.transactions.filter(entry=>entry.category==='income'&&entry.meta?.orderId==='FLOW-120').length,flowLots.length);
console.log('Factory 2 flow: 120 parts, split lots, mixed route, staffed QS time/reload and one-time payout OK');

const specializationUiState=JSON.parse(JSON.stringify(factory2State));
specializationUiState.staffRoster.shift1[0].xp=240;
let specializationUiApp=boot({cnc_factory_save_v3:JSON.stringify(specializationUiState)});
const employeeHead=specializationUiApp.createElement('div');employeeHead.className='employee-card-head';employeeHead.append(specializationUiApp.get('employee-card-close'));
specializationUiApp.get('employee-card').append(employeeHead);
const personalSection=specializationUiApp.createElement('div');personalSection.className='employee-card-section';personalSection.append(specializationUiApp.get('employee-card-personal'));
specializationUiApp.get('employee-card').append(personalSection);
specializationUiApp.get('detail-workplace').dataset.bay='1';specializationUiApp.get('detail-workplace').dataset.shift='1';
specializationUiApp.get('detail-workplace').click();
const specializationSelect=specializationUiApp.get('employee-specialization');
assert.ok(specializationSelect.children.some(option=>option.value==='turning'),'eligible specialization appears in the employee card');
specializationSelect.value='turning';
specializationUiApp.get('employee-specialization-assign').click();
assert.ok(specializationUiApp.live().staffRoster.shift1[0].specializations.includes('turning'),'the employee card applies and persists the selected specialization');
console.log('Employee development UI: specialization selection and assignment persist');

const qualityTimerState=JSON.parse(JSON.stringify(factory2State));
qualityTimerState.gameMinutes=480;qualityTimerState.speed=1;qualityTimerState.orderMarket.available=[];qualityTimerState.orderMarket.now=480;qualityTimerState.orderMarket.nextRefreshAt=1000000;
const qualityTimerOrder={id:'QS-PERSIST',kind:'Drehen',customer:'QS Test',part:'QS-Zeitprüfung',partKey:'qs-timer',material:'C45 Stahl',kg:1,qty:1,reward:100,duration:20,difficulty:1,deadlineHours:48,deadlineAt:3360,
  priority:'low',routing:[{id:'QS-PERSIST-step',type:'quality',requiredMachineKind:null}]};
assert.equal(require(dir+'/systems/productionFlow.js').addOrder(qualityTimerState,qualityTimerOrder,{capacity:40}).ok,true);
const qualityPriorityOrder={...qualityTimerOrder,id:'QS-HIGH-PRIORITY',part:'Dringende QS-Prüfung',priority:'high',routing:[{id:'QS-HIGH-PRIORITY-step',type:'quality',requiredMachineKind:null}]};
assert.equal(require(dir+'/systems/productionFlow.js').addOrder(qualityTimerState,qualityPriorityOrder,{capacity:40}).ok,true);
let qualityTimerApp=boot({cnc_factory_save_v3:JSON.stringify(qualityTimerState)},{random:()=>0.999999});
qualityTimerApp.frame(250);
let qualityTimerLot=qualityTimerApp.live().productionFlow.lots.find(lot=>lot.orderId==='QS-HIGH-PRIORITY');
assert.equal(qualityTimerLot.status,'running');
assert.ok(qualityTimerLot.qualityInspection.remainingMinutes>0);
assert.equal(qualityTimerApp.live().productionFlow.lots.find(lot=>lot.orderId==='QS-PERSIST').status,'queued','only the highest-priority lot occupies the single inspector');
const savedInspectionMinutes=qualityTimerLot.qualityInspection.remainingMinutes;
qualityTimerApp.flush();
const qualityTimerPersisted=qualityTimerApp.state().productionFlow.lots.find(lot=>lot.orderId==='QS-HIGH-PRIORITY');
assert.equal(qualityTimerPersisted.qualityInspection.remainingMinutes,savedInspectionMinutes,'QS timer is persisted by the adapter');
qualityTimerApp=boot({cnc_factory_save_v3:JSON.stringify(qualityTimerApp.state())},{random:()=>0.999999});
qualityTimerLot=qualityTimerApp.live().productionFlow.lots.find(lot=>lot.orderId==='QS-HIGH-PRIORITY');
assert.equal(qualityTimerLot.qualityInspection.remainingMinutes,savedInspectionMinutes,'in-progress QS timer survives reload');
assert.equal(qualityTimerApp.live().productionFlow.lots.find(lot=>lot.orderId==='QS-PERSIST').status,'queued');
console.log('Factory 2 QS: priority queue and staffed inspection persist across reload');

const qualityOrderingState=JSON.parse(JSON.stringify(factory2State));
qualityOrderingState.gameMinutes=480;qualityOrderingState.speed=1;qualityOrderingState.orderMarket.available=[];qualityOrderingState.orderMarket.now=480;qualityOrderingState.orderMarket.nextRefreshAt=1000000;
const productionFlowApi=require(dir+'/systems/productionFlow.js');
const lowFirstOrder={...qualityTimerOrder,id:'QS-LOW-FIRST',part:'Frühes niedriges Los',priority:'low',difficulty:1,routing:[{id:'QS-LOW-FIRST-step',type:'quality',requiredMachineKind:null}]};
const normalSecondOrder={...qualityTimerOrder,id:'QS-NORMAL-SECOND',part:'Späteres normales Los',priority:'normal',difficulty:4,routing:[{id:'QS-NORMAL-SECOND-step',type:'quality',requiredMachineKind:null}]};
assert.equal(productionFlowApi.addOrder(qualityOrderingState,lowFirstOrder,{capacity:40}).ok,true);
assert.equal(productionFlowApi.addOrder(qualityOrderingState,normalSecondOrder,{capacity:40}).ok,true);
let qualityOrderingApp=boot({cnc_factory_save_v3:JSON.stringify(qualityOrderingState)},{random:()=>0.999999});
qualityOrderingApp.frame(250);
const lowFirstLot=qualityOrderingApp.live().productionFlow.lots.find(lot=>lot.orderId==='QS-LOW-FIRST');
const normalSecondLot=qualityOrderingApp.live().productionFlow.lots.find(lot=>lot.orderId==='QS-NORMAL-SECOND');
assert.equal(normalSecondLot.status,'running','normal priority starts ahead of the earlier low-priority lot');
assert.equal(lowFirstLot.status,'queued');
assert.equal(normalSecondLot.qualityInspection.totalMinutes,21);
assert.equal(lowFirstLot.qualityInspection,undefined,'the queue must not attach the normal lot timer to the queued low-priority lot');

const rushFlowState=JSON.parse(JSON.stringify(factory2State));
rushFlowState.gameMinutes=480;rushFlowState.speed=1;rushFlowState.paused=false;rushFlowState.eventQueue=[];
rushFlowState.orderMarket.available=[];rushFlowState.orderMarket.now=480;rushFlowState.orderMarket.nextRefreshAt=1000000;rushFlowState.nextRushOrderAt=1000000;
const interruptedOrder={id:'FLOW-INTERRUPT-E2E',kind:'Drehen',customer:'Unterbrechungstest',part:'Präzisionswelle',partKey:'interrupt-shaft',material:'C45 Stahl',kg:10,qty:10,reward:3000,duration:180,difficulty:2,deadlineHours:48,deadlineAt:3360,setupMinutes:40,interruptionSensitivity:1,
  routing:[{id:'FLOW-INTERRUPT-turning',type:'turning',requiredMachineKind:'Drehen'}],batchMode:'large'};
assert.equal(productionFlowApi.addOrder(rushFlowState,interruptedOrder,{capacity:40,setupMinutes:40,restartSetupFraction:0.5}).ok,true);
const interruptedStart=productionFlowApi.startNext(rushFlowState,'1','Drehen',480);
assert.equal(interruptedStart.ok,true);
const interruptedLot=rushFlowState.productionFlow.lots.find(lot=>lot.id===interruptedStart.lot.id);
interruptedLot.qtyCompleted=2;interruptedLot.progress=40;
rushFlowState.factory2.orderResults[interruptedOrder.id]={paid:0,completedLots:0,qualityDefectParts:0,late:false};
const interruptedMachine=rushFlowState.machines.find(machine=>machine.bay===1);
interruptedMachine.activeId=interruptedOrder.id;
interruptedMachine.activeOrder={...interruptedOrder,flowLotId:interruptedLot.id,flowRouteStepId:interruptedOrder.routing[0].id,qty:interruptedLot.qty,reward:1500};
interruptedMachine.activeOrderSource='factory2';interruptedMachine.progress=40;interruptedMachine.produced=2;
interruptedMachine.deadlineAt=3360;interruptedMachine.setupDurationMinutes=40;interruptedMachine.setupRemainingMinutes=0;
interruptedMachine.setupPartProduced=true;interruptedMachine.ncProgramPending=false;
const rushOffer={id:'RUSH-FLOW-INTERRUPT',kind:'Drehen',customer:'Eilkunde',customerProfile:'standard',part:'Eilwelle',partKey:'rush-shaft',material:'C45 Stahl',kg:1,qty:1,reward:1000,baseReward:800,rushBonus:200,rushBonusPct:25,duration:1,difficulty:1,deadlineHours:72,deadlineAt:480+4320,createdAt:480,expiresAt:480+4320+1440,offerLifetimeMinutes:5760,isRushOrder:true};
const programApi=require(dir+'/systems/programmingQuality.js');const rushProgramKey=programApi.programKey(rushOffer),interruptedProgramKey=programApi.programKey(interruptedOrder);rushFlowState.ncPrograms[rushProgramKey]={part:rushOffer.part,kind:rushOffer.kind,completedAt:480};rushFlowState.ncPrograms[interruptedProgramKey]={part:interruptedOrder.part,kind:interruptedOrder.kind,completedAt:480};
rushFlowState.eventQueue=[{event:'rush_order',id:'rush-flow-interrupt-event',order:rushOffer,createdAt:480}];rushFlowState.paused=true;
let rushFlowApp=boot({cnc_factory_save_v3:JSON.stringify(rushFlowState)},{random:()=>0.999999});
const interruptChoice=rushFlowApp.get('event-window').querySelector('.rush-interrupt-choice');
assert.ok(interruptChoice,'rush event shows the insert-now choice for a running Factory 2 lot');
assert.equal(interruptChoice.disabled,false,interruptChoice.textContent);
interruptChoice.click();
let insertedRushState=rushFlowApp.live();
let interruptedSnapshot=insertedRushState.productionFlow.lots.find(lot=>lot.id===interruptedLot.id);
assert.equal(interruptedSnapshot.status,'waiting');
assert.equal(interruptedSnapshot.qtyCompleted,2);
assert.equal(interruptedSnapshot.interrupted.restartSetupMinutes,20);
assert.equal(insertedRushState.machines.find(machine=>machine.bay===1).suspendedOrder.source,'factory2');
assert.equal(insertedRushState.machines.find(machine=>machine.bay===1).suspendedOrder.progress,40);
assert.equal(insertedRushState.machines.find(machine=>machine.bay===1).activeId,rushOffer.id);
rushFlowApp.flush();
rushFlowApp=boot({cnc_factory_save_v3:JSON.stringify(rushFlowApp.state())},{random:()=>0.999999});
assert.equal(rushFlowApp.live().productionFlow.lots.find(lot=>lot.id===interruptedLot.id).interrupted.restartSetupMinutes,20,'interruption and restart estimate survive reload');
let resumedFlowMachine=null;
for(let t=250;t<=60000;t+=250){
  rushFlowApp.frame(t);
  const live=rushFlowApp.live(),machine=live.machines.find(item=>item.bay===1);
  const lot=live.productionFlow.lots.find(item=>item.id===interruptedLot.id);
  if(machine.activeOrderSource==='factory2'&&machine.activeId===interruptedOrder.id&&lot.status==='running'){
    resumedFlowMachine=machine;break;
  }
}
assert.ok(resumedFlowMachine,'the Factory 2 order resumes after the rush job completes');
assert.equal(resumedFlowMachine.progress,40,'resumed production keeps its previous progress');
assert.equal(resumedFlowMachine.setupDurationMinutes,20,'restart setup uses the saved interruption estimate');
assert.ok(resumedFlowMachine.setupRemainingMinutes>0&&resumedFlowMachine.setupRemainingMinutes<=20,'restart setup begins after the rush job and advances only by elapsed simulation time');
rushFlowApp.flush();
rushFlowApp=boot({cnc_factory_save_v3:JSON.stringify(rushFlowApp.state())},{random:()=>0.999999});
const reloadedResumeMachine=rushFlowApp.live().machines.find(machine=>machine.bay===1);
assert.equal(reloadedResumeMachine.activeId,interruptedOrder.id);
assert.equal(reloadedResumeMachine.progress,40);
assert.equal(reloadedResumeMachine.setupDurationMinutes,20);
console.log('Factory 2 rush: interruption, progress, restart setup and reload survive through rush completion');

const materialSituationState=JSON.parse(JSON.stringify(factory2State));
materialSituationState.gameMinutes=480;materialSituationState.money=100000;materialSituationState.material=0;
materialSituationState.inventory.rawMaterial={c45:0};materialSituationState.orderMarket.available=[];materialSituationState.orderMarket.now=480;
materialSituationState.factorySituations.active=[{id:'SIT-MATERIAL-TEST',type:'material-price-spike',status:'active',startAtMinute:300,endAtMinute:900}];
const baseMaterialQuote=require(dir+'/systems/materials.js').quote('c45',25,480);
const materialSituationApp=boot({cnc_factory_save_v3:JSON.stringify(materialSituationState)},{random:()=>0.999999});
materialSituationApp.get('buy-material').click();
const situationMaterialCharge=materialSituationApp.state().finance.transactions.filter(entry=>entry.category==='material').at(-1);
assert.equal(situationMaterialCharge.amount,-Math.round(baseMaterialQuote*1.18*100)/100,'active material-price situation changes the purchase charge');
console.log('Factory 2 situations: material-price factor reaches the warehouse purchase');

const toolingSituationState=JSON.parse(JSON.stringify(factory2State));
const toolingOrder={id:'SIT-TOOLING-TEST',kind:'Drehen',customer:'Testkunde',part:'Werkzeugengpass-Test',partKey:'tooling-test',routing:[{id:'tool-turn',type:'turning',requiredMachineKind:'Drehen'},{id:'tool-qs',type:'quality',requiredMachineKind:null}],material:'C45 Stahl',kg:1,qty:200,reward:50000,duration:40,difficulty:1,deadlineHours:48,createdAt:360,expiresAt:3000};
toolingSituationState.gameMinutes=480;toolingSituationState.orderMarket.available=[toolingOrder];toolingSituationState.orderMarket.now=480;toolingSituationState.orderMarket.nextRefreshAt=3000;
toolingSituationState.factorySituations.active=[{id:'SIT-TOOLING-ACTIVE',type:'tooling-shortage',status:'active',startAtMinute:420,endAtMinute:570}];
let toolingApp=boot({cnc_factory_save_v3:JSON.stringify(toolingSituationState)},{random:()=>0.999999});
const toolingCard=toolingApp.get('orders').children.find(node=>node.innerHTML?.includes('SIT-TOOLING-TEST'));
assert.ok(toolingCard);toolingCard.children.at(-1).click();toolingApp.get('assignment-options').children[0].children[0].click();
let toolingSaved=toolingApp.state(),toolingFlowOrder=toolingSaved.productionFlow.orders['SIT-TOOLING-TEST'];
assert.equal(toolingFlowOrder.situationEffects.capacityFactor,0.88);assert.equal(toolingFlowOrder.situationEffects.durationFactor,1.12);
assert.equal(toolingSaved.productionFlow.lots.filter(lot=>lot.orderId==='SIT-TOOLING-TEST').length,12,'capacity factor reduces automatic batch capacity');
assert.equal(require(dir+'/systems/productionFlow.js').createPlan(toolingOrder,{capacity:40}).lots.length,10,'normal automatic capacity baseline');
const situationApi=require(dir+'/systems/factorySituations.js');
const durationDuringSituation=situationApi.applyModifiers({},situationApi.getActiveModifiers(toolingApp.live(),555)).situationEffects.durationFactor;
const durationAfterSituation=situationApi.applyModifiers({},situationApi.getActiveModifiers(toolingApp.live(),571)).situationEffects.durationFactor;
assert.equal(durationDuringSituation,1.12);assert.equal(durationAfterSituation,1,'duration modifier stops when the situation ends');
console.log('Factory 2 situations: capacity and duration factors apply only during their event window');

const smallProjectState=JSON.parse(JSON.stringify(factory2State));
smallProjectState.gameMinutes=360;smallProjectState.orderMarket.available=[];smallProjectState.orderMarket.now=360;smallProjectState.nextRushOrderAt=1000000;
smallProjectState.customerProjects={version:1,projects:[],decisions:[],nextProjectNumber:1,randomState:1,now:360};
let smallProjectApp=boot({cnc_factory_save_v3:JSON.stringify(smallProjectState)},{random:()=>0.999999});
const smallCreated=smallProjectApp.state();require(dir+'/systems/customerProjects.js').create(smallCreated,{customer:'Veltraxis Mobility'},{size:'small',atMinute:360});smallProjectApp=boot({cnc_factory_save_v3:JSON.stringify(smallCreated)},{random:()=>0.999999});
const smallProjectId=smallProjectApp.state().customerProjects.projects[0].id;
for(let t=250;t<=3750;t+=250)smallProjectApp.frame(t);
const autoProject=smallProjectApp.live().customerProjects.projects.find(project=>project.id===smallProjectId);
assert.equal(autoProject.phases[0].status,'completed');assert.equal(autoProject.currentPhaseId,'pilot','small project advances from the simulation tick');

const heldProjectState=JSON.parse(JSON.stringify(smallProjectState));heldProjectState.machines=[];heldProjectState.selectedBay=null;
let heldProjectApp=boot({cnc_factory_save_v3:JSON.stringify(heldProjectState)},{random:()=>0.999999});
const heldCreated=heldProjectApp.state();require(dir+'/systems/customerProjects.js').create(heldCreated,{customer:'Veltraxis Mobility'},{size:'small',atMinute:360});heldProjectApp=boot({cnc_factory_save_v3:JSON.stringify(heldCreated)},{random:()=>0.999999});
const heldProjectId=heldProjectApp.state().customerProjects.projects[0].id;
const heldOrder={id:'SMALL-PROJECT-LIVE-ORDER',kind:'Drehen',customer:'Veltraxis Mobility',part:'Prototyp',partKey:'turn-prototype',material:'C45 Stahl',kg:1,qty:1,reward:100,duration:40,difficulty:1,deadlineHours:48,routing:[{id:'held-step',type:'turning',requiredMachineKind:'Drehen'}]};
const heldState=heldProjectApp.state();assert.equal(require(dir+'/systems/productionFlow.js').addOrder(heldState,heldOrder).ok,true);
heldState.factory2.projectOrders[heldOrder.id]=heldProjectId;
heldProjectApp=boot({cnc_factory_save_v3:JSON.stringify(heldState)},{random:()=>0.999999});
for(let t=250;t<=3750;t+=250)heldProjectApp.frame(t);
assert.equal(heldProjectApp.live().customerProjects.projects.find(project=>project.id===heldProjectId).phaseResults.length,0,'linked small project waits for its live production order');

const decisionState=JSON.parse(JSON.stringify(factory2State));
decisionState.gameMinutes=360;decisionState.orderMarket.available=[{...toolingOrder,id:'PROJECT-DECISION-BLOCK',customer:'Veltraxis Mobility',qty:1,kg:1}];
decisionState.orderMarket.now=360;decisionState.orderMarket.nextRefreshAt=3000;decisionState.customerProjects={version:1,projects:[],decisions:[],nextProjectNumber:1,randomState:7,now:360};
const decisionProjectModule=require(dir+'/systems/customerProjects.js');
const decisionProject=decisionProjectModule.create(decisionState,{customer:'Veltraxis Mobility',reputation:50},{size:'medium',atMinute:360});
assert.equal(decisionProjectModule.completePhase(decisionState,decisionProject.id,'prototype',{performance:0},361).ok,true);
assert.ok(decisionState.customerProjects.projects[0].availableDecision);
const decisionApp=boot({cnc_factory_save_v3:JSON.stringify(decisionState)},{random:()=>0.999999});
const decisionCard=decisionApp.get('orders').children.find(node=>node.innerHTML?.includes('PROJECT-DECISION-BLOCK'));
assert.ok(decisionCard);decisionCard.children.at(-1).click();decisionApp.get('assignment-options').children[0].children[0].click();
assert.equal(decisionApp.state().productionFlow.orders['PROJECT-DECISION-BLOCK'].projectId,null,'a follow-up order cannot skip an unresolved project decision');
console.log('Factory 2 projects: small phase auto-advance and decision gating work through the adapter');
const supplierState=JSON.parse(JSON.stringify(factory2State));
const supplierOrder={id:'SUPPLIER-E2E',kind:'Drehen',customer:'Veltraxis Mobility',part:'Extern gefrästes Bauteil',partKey:'shaft',material:'C45 Stahl',kg:1,qty:1,reward:5000,duration:1,difficulty:1,deadlineHours:48,createdAt:360,expiresAt:3000,
  routing:[{id:'SUPPLIER-E2E-external',type:'external',operationType:'milling',requiredMachineKind:null},{id:'SUPPLIER-E2E-milling',type:'milling',requiredMachineKind:'Fräsen'}]};
supplierState.factory2.offerChoices={'SUPPLIER-E2E':{'SUPPLIER-E2E-external':'supplier-local-machining'}};
supplierState.orderMarket.available=[supplierOrder];supplierState.orderMarket.now=360;supplierState.orderMarket.nextRefreshAt=3000;
let supplierApp=boot({cnc_factory_save_v3:JSON.stringify(supplierState)});
const supplierCard=supplierApp.get('orders').children.find(node=>node.innerHTML?.includes('SUPPLIER-E2E'));
assert.ok(supplierCard,'external route offer should be visible');supplierCard.children.at(-1).click();
supplierApp.get('assignment-options').children[0].click();
let supplierSaved=supplierApp.state();
const supplierLot=supplierSaved.productionFlow.lots.find(lot=>lot.orderId==='SUPPLIER-E2E');
assert.equal(supplierLot.status,'outsourced','the provider chosen before acceptance is dispatched automatically');
let supplierJob=supplierSaved.suppliers.jobs.find(job=>job.orderId==='SUPPLIER-E2E');
assert.ok(supplierJob,'awarding the lot quote should create a supplier job');
assert.equal(supplierSaved.productionFlow.lots.find(lot=>lot.id===supplierLot.id).status,'outsourced');
const supplierChargeKey=`factory2-supplier:${supplierJob.id}`;
let supplierCharges=supplierSaved.finance.transactions.filter(entry=>entry.category==='other'&&entry.meta?.aggregateKey===supplierChargeKey);
assert.equal(supplierCharges.length,1,'dispatch should post one persistent supplier charge');
supplierSaved.factory2.paidSupplierJobIds=supplierSaved.factory2.paidSupplierJobIds.filter(id=>id!==supplierJob.id);
supplierSaved.factory2.pendingSupplierRelease[supplierJob.id]=true;
supplierJob=supplierSaved.suppliers.jobs.find(job=>job.id===supplierJob.id);supplierJob.dueAtMinute=supplierSaved.gameMinutes+100;
supplierApp=boot({cnc_factory_save_v3:JSON.stringify(supplierSaved)});supplierApp.frame(1000);supplierApp.flush();
supplierSaved=supplierApp.state();
supplierCharges=supplierSaved.finance.transactions.filter(entry=>entry.category==='other'&&entry.meta?.aggregateKey===supplierChargeKey);
assert.equal(supplierCharges.length,1,'replayed release after reload must not charge the saved supplier job again');
assert.ok(supplierSaved.factory2.paidSupplierJobIds.includes(supplierJob.id),'release retry should restore the persistent paid marker');
supplierJob=supplierSaved.suppliers.jobs.find(job=>job.id===supplierJob.id);supplierJob.dueAtMinute=supplierSaved.gameMinutes;
supplierApp=boot({cnc_factory_save_v3:JSON.stringify(supplierSaved)});supplierApp.frame(1000);supplierApp.flush();
supplierSaved=supplierApp.state();
const deliveredLot=supplierSaved.productionFlow.lots.find(lot=>lot.id===supplierLot.id);
assert.equal(deliveredLot.routePosition,1,'supplier delivery should advance the lot to the next production step');
assert.equal(deliveredLot.routeStepType,'milling');
assert.equal(deliveredLot.status,'running','supplier delivery should release the lot to the next internal machine queue');
assert.equal(supplierSaved.suppliers.jobs.find(job=>job.id===supplierJob.id).status,'completed');
console.log('Factory 2 suppliers: waiting external lot quoted, charged once across reload, and released to next route step');

// Fresh hires have no personalGiftId until the first save is reloaded.
// Exercise the actual UI handlers rather than starting from a normalized save.
const firstProductionStorage={},firstProductionErrors=[];
let firstProduction=boot(firstProductionStorage,{orderMarketSeed:1,random:()=>0.999999,console:{...console,error:(...args)=>firstProductionErrors.push(args)}});
assert.equal(firstProduction.live().machines.length,0);
firstProduction.get('pause').click();
firstProduction.get('take-loan').click();
firstProduction.get('machine-shop').children[0].children.at(-1).children.at(-1).click();
firstProduction.get('open-recruitment').click();
firstProduction.get('applicant-list').children.find(node=>node.className==='applicant-card').children[3].children[0].click();
firstProduction.get('recruitment-back').click();
assert.equal(firstProduction.live().staffRoster.shift1[0].personalGiftId,undefined);
firstProduction.get('operator-1').click();
assert.doesNotThrow(()=>firstProduction.get('operator-picker').children[1].children[0].children[2].click(),'assigning a fresh employee without a gift must render safely');
assert.equal(firstProduction.live().staffRoster.shift1[0].assignedBay,1);
assert.equal(firstProduction.get('detail-workplace-items').children.length,1,'no phantom gift is displayed');
firstProduction.get('material-quantity').value='25';firstProduction.get('buy-material').click();
const firstProductionOrder=firstProduction.live().orderMarket.available.find(order=>order.kind==='Drehen'&&order.material==='C45 Stahl');
assert.ok(firstProductionOrder);
firstProduction.get('orders').children.find(node=>node.innerHTML?.includes(firstProductionOrder.id)).children.at(-1).click();
firstProduction.get('assignment-options').children[0].children[0].click();
assert.equal(firstProduction.live().machines[0].activeId,firstProductionOrder.id);
firstProduction.get('pause').click();
for(let t=250;t<=120000;t+=250)firstProduction.frame(t);
let firstProductionLive=firstProduction.live();
assert.deepEqual(firstProductionErrors,[],'first production must not trigger rollback or render errors');
assert.equal(firstProductionLive.paused,false);
assert.ok(firstProductionLive.gameMinutes>=480,'simulation advances through an entire early shift');
assert.ok(firstProductionLive.machines[0].progress>0||firstProductionLive.completed>0,'programming and setup lead to actual production');
firstProduction.flush();
firstProduction=boot(firstProductionStorage,{random:()=>0.999999,console:{...console,error:(...args)=>firstProductionErrors.push(args)}});
assert.equal(firstProduction.live().staffRoster.shift1[0].personalGiftId,null);
const firstProductionReloadMinute=firstProduction.live().gameMinutes;
for(let t=250;t<=5000;t+=250)firstProduction.frame(t);
assert.ok(firstProduction.live().gameMinutes>firstProductionReloadMinute);
assert.deepEqual(firstProductionErrors,[],'reloading and continuing production remains safe');
console.log('Fresh game: loan, first machine, fresh hire, assignment, material, acceptance, programming, production and reload OK');

// Capabilities and outsourcing choices are checked on the actual offer card.
const planningState=JSON.parse(JSON.stringify(factory2State));
planningState.customerProjects={version:1,projects:[],decisions:[],nextProjectNumber:1,randomState:7,now:360};
planningState.machines=[];planningState.qualityStaff={shift1:[],shift2:[]};
planningState.orderMarket.available=[{...factory2Order,id:'ORGANIC-PLAN',projectInvitation:{size:'medium'},routing:[{id:'organic-turn',type:'turning',requiredMachineKind:'Drehen'},{id:'organic-mill',type:'milling',requiredMachineKind:'Fräsen'}]}];
let planningApp=boot({cnc_factory_save_v3:JSON.stringify(planningState)},{random:()=>0.999999});
let planningCard=planningApp.get('orders').children.find(node=>node.innerHTML?.includes('ORGANIC-PLAN'));
assert.equal(planningCard.children.at(-1).disabled,true,'missing stations block acceptance');
assert.equal(planningApp.live().customerProjects.projects.length,0,'an invitation alone does not start a project');
const routePanel=planningCard.children.find(node=>node.className==='order-route');
for(const row of routePanel.children.filter(node=>node.className==='order-step')){const select=row.children[1];select.value='supplier-local-machining';select.events.change();}
assert.equal(planningApp.state().factory2.offerChoices['ORGANIC-PLAN']['organic-turn'],'supplier-local-machining');
planningApp=boot({cnc_factory_save_v3:JSON.stringify(planningApp.state())},{random:()=>0.999999});
planningCard=planningApp.get('orders').children.find(node=>node.innerHTML?.includes('ORGANIC-PLAN'));
assert.equal(planningCard.children.at(-1).disabled,false,'all missing operations can be explicitly outsourced without owning a machine');
planningCard.children.at(-1).click();planningApp.get('assignment-options').children[0].click();
const organicSaved=planningApp.state();assert.ok(organicSaved.productionFlow.orders['ORGANIC-PLAN']);
assert.ok(organicSaved.productionFlow.lots.filter(lot=>lot.orderId==='ORGANIC-PLAN').every(lot=>lot.status==='outsourced'));
assert.equal(organicSaved.customerProjects.projects.length,1,'accepting the organic invitation starts one project');
assert.equal(organicSaved.factory2.offerChoices['ORGANIC-PLAN'],undefined);
planningApp=boot({cnc_factory_save_v3:JSON.stringify(organicSaved)},{random:()=>0.999999});
assert.equal(planningApp.live().customerProjects.projects.length,1,'reload does not duplicate the accepted project');
console.log('Organic planning: missing stations, per-offer outsourcing persistence, machine-free acceptance and invitation project verified');
