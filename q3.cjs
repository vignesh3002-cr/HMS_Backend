const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
async function f(){
  try{
    const meds = await p.medicine_master.findMany({where:{OR:[{medicine_name:{contains:'Trastuzumab'}},{generic_name:{contains:'Trastuzumab'}}]},take:10});
    console.log('MEDS:'+meds.length);
    for(const m of meds){ console.log(m.medicine_id); }
    const lm = await p.drug_lab_monitoring.findMany({take:5});
    console.log('LM:'+lm.length);
  }catch(e){console.log('ERR');}
  await p.();
}
f();
