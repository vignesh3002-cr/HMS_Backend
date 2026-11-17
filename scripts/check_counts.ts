import prisma from '../src/config/prisma';

async function run() {
  const inhouseTests = await prisma.lab_test_master.findMany({
    where: {
      OR: [
        { test_code: { startsWith: 'IH-' } },
        { test_code: { startsWith: 'INH-' } },
        { is_outsourced: false }
      ]
    },
    select: { lab_test_id: true, test_code: true, test_name: true, is_outsourced: true, outsource_lab: true, _count: { select: { lab_test_parameter: true } } }
  });
  console.log(`In-house / non-outsourced tests count: ${inhouseTests.length}`);
  console.log('Sample In-house tests:', inhouseTests.slice(0, 15));

  const molTests = await prisma.lab_test_master.findMany({
    where: { test_code: { startsWith: 'MOL-' } },
    select: { lab_test_id: true, test_code: true, test_name: true, is_outsourced: true, outsource_lab: true, _count: { select: { lab_test_parameter: true } } }
  });
  console.log(`MOL- tests count: ${molTests.length}`);
  if (molTests.length > 0) {
    console.log('Sample MOL tests:', molTests.slice(0, 5));
  }

  const ddcTests = await prisma.lab_test_master.findMany({
    where: { test_code: { startsWith: 'DDC-' } },
    select: { lab_test_id: true, test_code: true, test_name: true, is_outsourced: true, outsource_lab: true, _count: { select: { lab_test_parameter: true } } }
  });
  console.log(`DDC- tests count: ${ddcTests.length}`);

  const testsWithParams = await prisma.lab_test_master.findMany({
    where: { lab_test_parameter: { some: {} } },
    select: { test_code: true, test_name: true, is_outsourced: true, _count: { select: { lab_test_parameter: true } } }
  });
  console.log(`Tests with parameters count: ${testsWithParams.length}`);
  console.log('Tests with parameters:', testsWithParams);

  await prisma.$disconnect();
}
run().catch(console.error);
