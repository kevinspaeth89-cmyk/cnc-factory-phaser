(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.CNCModules=root.CNCModules||{};root.CNCModules.orderPlanning=api;}})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const kind=type=>({turning:'Drehen',milling:'Fräsen',quality:'QS',assembly:'Montage'})[type]||type;
  function routeFor(order){
    const route=Array.isArray(order.routing)&&order.routing.length?order.routing:[{type:order.kind==='Fräsen'?'milling':'turning',requiredMachineKind:order.kind}];
    return route.map((step,index)=>({...step,id:step.id||`${order.id}-step-${index+1}`}));
  }
  function requirements(order,capabilities,choices={}){
    return routeFor(order).map(step=>{
      const operation=step.type==='external'?step.operationType:step.type;
      const stations=(capabilities.stations||[]).filter(station=>station.kind===kind(operation));
      const installed=operation==='quality'?!!capabilities.qualityStaff:stations.length>0;
      const staffed=operation==='quality'?!!capabilities.qualityStaff:stations.some(station=>station.staffed);
      const providers=(capabilities.providers||[]).filter(provider=>provider.status==='available'&&provider.operations.includes(operation));
      const provider=providers.find(item=>item.id===choices[step.id]);
      const external=step.type==='external'||!!choices[step.id];
      const ready=external?!!provider:installed&&staffed;
      return {step,operation,label:kind(operation),stations,installed,staffed,providers,provider,external,ready,
        reason:external&&!provider?'Zulieferer wählen':!installed?(operation==='quality'?'QS-Fachkraft fehlt':`${kind(operation)}-Maschine fehlt`):!staffed?'Bediener fehlt':null};
    });
  }
  function plan(order,capabilities,choices={}){
    const checks=requirements(order,capabilities,choices);
    return {ready:checks.every(check=>check.ready),checks,routing:checks.map(check=>check.external?
      {...check.step,type:'external',operationType:check.operation,requiredMachineKind:null,providerId:check.provider?.id||null}:
      {...check.step,type:check.operation,requiredMachineKind:check.operation==='quality'?null:kind(check.operation)})};
  }
  function negotiateDelivery(order,reputation,random){
    if(!Number.isInteger(order?.qty)||order.qty<2||order.isRushOrder)return {accepted:false,reason:'Für diesen Auftrag ist keine Teillieferung möglich.'};
    const chance=Math.min(0.85,Math.max(0.25,0.35+(Number(reputation)||0)/200));
    const accepted=random()<chance;
    return {accepted,firstQty:Math.ceil(order.qty/2),extensionMinutes:1440,reason:accepted?'Kunde stimmt zu: erste Hälfte zum ursprünglichen Termin, Rest einen Tag später.':'Kunde lehnt ab; der ursprüngliche Termin gilt für die gesamte Menge.'};
  }
  function lotDeadline(order,lots,lot){
    const deal=order.deliveryAgreement;
    if(!deal?.accepted)return order.deadlineAt;
    const before=lots.filter(item=>item.sequence<lot.sequence).reduce((sum,item)=>sum+item.qty,0);
    return order.deadlineAt+(before>=deal.firstQty?deal.extensionMinutes:0);
  }
  return Object.freeze({routeFor,requirements,plan,negotiateDelivery,lotDeadline});
});
