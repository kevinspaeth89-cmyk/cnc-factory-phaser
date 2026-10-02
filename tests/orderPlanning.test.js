const test=require('node:test'),assert=require('node:assert/strict');
const planning=require('../systems/orderPlanning.js');
const flow=require('../systems/productionFlow.js');
const order={id:'CHAIN',kind:'Drehen',qty:100,reward:10000,routing:[{id:'turn',type:'turning',requiredMachineKind:'Drehen'},{id:'mill',type:'milling',requiredMachineKind:'Fräsen'},{id:'qs',type:'quality',requiredMachineKind:null}]};
const providers=[{id:'cut',status:'available',operations:['turning','milling']},{id:'inspect',status:'available',operations:['quality']}];
test('checks every station and staff requirement before acceptance without mutating the offer',()=>{
  const capabilities={stations:[{kind:'Drehen',staffed:true},{kind:'Fräsen',staffed:false}],qualityStaff:false,providers};
  const before=JSON.stringify(order);const plan=planning.plan(order,capabilities);
  assert.equal(plan.ready,false);assert.equal(plan.checks[0].ready,true);assert.equal(plan.checks[1].reason,'Bediener fehlt');assert.equal(plan.checks[2].reason,'QS-Fachkraft fehlt');assert.equal(JSON.stringify(order),before);
  assert.equal(planning.plan(order,capabilities,{mill:'cut',qs:'inspect'}).ready,true);
});
test('missing capabilities can be outsourced explicitly, including the first station',()=>{
  const capabilities={stations:[],qualityStaff:false,providers};
  const plan=planning.plan(order,capabilities,{turn:'cut',mill:'cut',qs:'inspect'});
  assert.equal(plan.ready,true);assert.deepEqual(plan.routing.map(step=>step.type),['external','external','external']);assert.deepEqual(plan.routing.map(step=>step.operationType),['turning','milling','quality']);
  assert.equal(planning.plan(order,capabilities,{turn:'unknown',mill:'cut',qs:'inspect'}).ready,false);
  assert.equal(planning.plan(order,{...capabilities,providers:providers.map(provider=>({...provider,status:'unknown'}))},{turn:'cut',mill:'cut',qs:'inspect'}).ready,false);
});
test('a pure turning order is one production unit regardless of obsolete batch settings',()=>{
  for(const batchMode of ['auto','small','normal','large']){
    const result=flow.createPlan({...order,routing:undefined,batchMode},{capacity:10});
    assert.equal(result.lots.length,1);assert.equal(result.lots[0].qty,100);assert.equal(result.effectiveBatchMode,'single');
  }
});
test('100 parts in a real chain release the first 20 to milling while turning continues',()=>{
  const state={gameMinutes:0};const added=flow.addOrder(state,order,{capacity:40});assert.equal(added.lots.length,5);
  const first=flow.startNext(state,'turner','Drehen',0).lot;assert.equal(first.qty,20);
  flow.completeStep(state,first.id,'turn',30);
  const milling=flow.startNext(state,'miller','Fräsen',30).lot;
  const next=flow.startNext(state,'turner','Drehen',30).lot;
  assert.equal(milling.id,first.id);assert.equal(milling.qty,20);assert.notEqual(next.id,first.id);assert.equal(next.qty,20);
  flow.ensureState(state);assert.equal(state.productionFlow.machineAssignments.miller,milling.id);assert.equal(state.productionFlow.machineAssignments.turner,next.id);
});

test('voluntary lots use the chosen size including the final remainder',()=>{
 for(const routing of [undefined,order.routing]){const result=flow.createPlan({...order,qty:95,routing,splitLots:true,batchSize:20});assert.deepEqual(result.lots.map(lot=>lot.qty),[20,20,20,20,15]);}
 assert.equal(flow.createPlan({...order,splitLots:false}).lots.length,1);
});
test('delivery negotiation preserves the original deadline unless the customer agrees',()=>{
 const root={...order,deadlineAt:2000};const yes=planning.negotiateDelivery(root,50,()=>0);const no=planning.negotiateDelivery(root,50,()=>0.99);
 assert.equal(yes.accepted,true);assert.equal(no.accepted,false);assert.equal(planning.negotiateDelivery({...root,isRushOrder:true},100,()=>0).accepted,false);
 const lots=flow.createPlan({...root,batchSize:50}).lots;const agreed={...root,deliveryAgreement:yes};
 assert.equal(planning.lotDeadline(agreed,lots,lots[0]),2000);assert.equal(planning.lotDeadline(agreed,lots,lots[1]),3440);assert.equal(planning.lotDeadline({...root,deliveryAgreement:no},lots,lots[1]),2000);
});
