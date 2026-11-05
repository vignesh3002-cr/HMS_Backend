const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
async function f(){
  const meds = await p.medicine_master.findMany({where:{OR:[{medicine_name:{contains:'Trastuzumab'}},{generic_name:{contains:'Trastuzumab'}}]},take:20});
  console.log('MEDS:'+meds.length);
  for(const m of meds){ console.log(m.medicine_id+':'+m.medicine_name); }
  const lm = await p.drug_lab_monitoring.findMany({include:{medicine_master:true, lab_test_master:true}});
  const nl = await p.drug_non_lab_investigation.findMany({include:{medicine_master:true}});
  console.log('LM:'+lm.length+' NL:'+nl.length);
  const trast = meds.map(function(m){return m.medicine_id;});
  for(const x of lm){ if(trast.indexOf(x.medicine_id)>=0){ console.log('LM:'+x.medicine_master.medicine_name+'->'+x.lab_test_master.test_name); } }
  for(const x of nl){ if(trast.indexOf(x.medicine_id)>=0){ console.log('NL:'+x.medicine_master.medicine_name+'->'+x.investigation_name); } }
  await p.();
}
f();
