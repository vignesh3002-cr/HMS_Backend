import prisma from '../src/config/prisma';

async function run() {
  const cols: any = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'lab_test_master'
    ORDER BY ordinal_position;
  `);
  console.log('lab_test_master columns:', cols.map((c: any) => `${c.column_name} (${c.data_type})`));

  const testCount = await prisma.lab_test_master.count();
  const paramCount = await prisma.lab_test_parameter.count();
  console.log('Counts:', { testCount, paramCount });

  const sample = await prisma.lab_test_master.findMany({ 
    take: 5,
    select: { lab_test_id: true, test_code: true, test_name: true, is_outsourced: true, outsource_lab: true }
  });
  console.log('Sample tests:', sample);

  const categories = await prisma.lab_test_category.findMany();
  console.log('Categories:', categories);

  await prisma.$disconnect();
}
run().catch(console.error);
