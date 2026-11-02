import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function f(){
  const meds = await p.medicine_master.findMany({where:{OR:[{medicine_name:{contains:"Trastuzumab"}},{generic_name:{contains:"Trastuzumab"}}]}});
  console.log(meds.length);
  await p.$disconnect();
}
f();
