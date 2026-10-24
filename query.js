const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
async function f(){
  try{
    const meds = await p.medicine_master.findMany({where:{OR:[{medicine_name:{contains:'Trastuzumab'}},{generic_name:{contains:'Trastuzumab'}}]},take:10});
    console.log('M'+meds.length);
    const lm = await p.drug_lab_monitoring.findMany({take:3});
    console.log('L'+lm.length);
    const nl = await p.drug_non_lab_investigation.findMany({take:3});
    console.log('N'+nl.length);
  }catch(e){console.log('e');}
  await p.();
}
f();
