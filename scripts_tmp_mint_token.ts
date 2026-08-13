import "dotenv/config";
import jwt from "jsonwebtoken";
import prisma from "./src/config/prisma";

async function main() {
  const user = await prisma.user_table.findFirst({
    where: { role_type: "DOCTOR" },
    select: { user_id: true, role_type: true }
  });
  if (!user) { console.error("No suitable user found"); process.exit(1); }
  const token = jwt.sign({ user_id: user.user_id, role: user.role_type }, process.env.JWT_SECRET!, { expiresIn: "6h" });
  console.log(token);
  await prisma.$disconnect();
}
main();
