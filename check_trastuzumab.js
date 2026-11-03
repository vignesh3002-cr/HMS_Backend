const {PrismaClient}=require('@prisma/client');
const prisma=new PrismaClient();
async function main(){
  const drugs=['Trastuzumab','Pertuzumab','Phesgo'];
  for(const d of drugs){
    const meds=await prisma.medicine_master.findMany({where:{OR:[{medicine_name:{contains:d, mode:'insensitive'}},{generic_name:{contains:d, mode:'insensitive'}}]}, select:{medicine_id:true,medicine_name:true,generic_name:true}});
    console.log('===',d,'===');
    console.log(meds);
    if(meds.length){
      for(const m of meds){
        const lm=await prisma.drug_lab_monitoring.findMany({where:{medicine_id:m.medicine_id}, include:{lab_test_master:true}});
        console.log('LAB:', m.medicine_id, lm.length);
        lm.forEach(x=>console.log('  ', x.monitoring_phase, x.source_test_text, x.lab_test_master?.test_name));
        const nl=await prisma.drug_non_lab_investigation.findMany({where:{medicine_id:m.medicine_id}});
        console.log('NONLAB:', m.medicine_id, nl.length);
        nl.forEach(x=>console.log('  ', x.investigation_name, x.investigation_type));
      }
    }
    console.log();
  }
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());
