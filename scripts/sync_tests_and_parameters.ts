import prisma from '../src/config/prisma';
import * as xlsx from 'xlsx';

async function main() {
  console.log('=== STARTING LAB TEST MASTER & PARAMETER SYNC ===');
  const excelPath = 'C:/Users/HP/.gemini/antigravity/brain/5a538e6a-17a7-428b-b74f-be8004292d79/.user_uploaded/media_1794805184481_9e53cacf.xlsx';
  const wb = xlsx.readFile(excelPath);

  const testMasterSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['Test master']);
  const molTestsSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['Molecular tests']);
  const molParamsSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['Molecular parameters']);
  const panelParamsSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['Panel parameters']);

  console.log(`Loaded rows: Test Master=${testMasterSheet.length}, Mol Tests=${molTestsSheet.length}, Mol Params=${molParamsSheet.length}, Panel Params=${panelParamsSheet.length}`);

  // Fetch all existing categories
  const categories = await prisma.lab_test_category.findMany();
  const categoryByName = new Map<string, string>();
  categories.forEach(c => categoryByName.set(c.category_name.toLowerCase(), c.lab_test_category_id));
  const defaultCatId = categories.find(c => c.category_name === 'Haematology' || c.category_name === 'Hematology')?.lab_test_category_id || categories[0].lab_test_category_id;

  // -------------------------------------------------------------------------
  // 1. SYNC MOLECULAR TEST MOL-046 IF MISSING
  // -------------------------------------------------------------------------
  const existingMol46 = await prisma.lab_test_master.findFirst({
    where: { test_code: 'MOL-046' }
  });
  if (!existingMol46) {
    console.log('Creating missing MOL-046 test record...');
    const catMol17 = categories.find(c => c.category_code === 'MOL17')?.lab_test_category_id || defaultCatId;
    await prisma.lab_test_master.create({
      data: {
        lab_test_id: 'LT-MOL-046',
        lab_test_category_id: catMol17,
        test_code: 'MOL-046',
        test_name: 'Thyroid,ACTH,Cortisol',
        sample_type: 'Serum (ACTH in chilled EDTA plasma)',
        tat_text: '1 day',
        tat_hours: 24,
        price: 4500,
        walkin_price: 4500,
        is_outsourced: true,
        outsource_lab: 'Thyrocare',
        result_type: 'Report',
        is_panel: true,
        includes_details: 'Thyroid profile, ACTH, cortisol',
        test_status: 1,
        expiry_time_hours: 4.0
      }
    });
    console.log('Created MOL-046 successfully.');
  }

  // -------------------------------------------------------------------------
  // 2. SYNC IN-HOUSE TESTS (IH-001 through IH-019)
  // -------------------------------------------------------------------------
  const inhouseRows = testMasterSheet.filter(r => r.test_type === 'In-house');
  console.log(`\nSyncing ${inhouseRows.length} In-house tests...`);

  for (const r of inhouseRows) {
    const code = String(r.test_code).trim(); // e.g. IH-001
    const altCode = code.replace(/^IH-/, 'INH-'); // e.g. INH-001
    const name = String(r.test_name).trim();

    // Find existing by code or altCode
    const existing = await prisma.lab_test_master.findFirst({
      where: {
        OR: [
          { test_code: code },
          { test_code: altCode },
          { test_name: { equals: name, mode: 'insensitive' } }
        ]
      }
    });

    const priceNum = typeof r.mrp === 'number' ? r.mrp : parseFloat(r.mrp) || 350;
    const tatHours = typeof r.tat_hours === 'number' ? r.tat_hours : parseInt(r.tat_hours, 10) || 4;
    const isPanel = String(r.result_type).toLowerCase() === 'panel';

    if (existing) {
      await prisma.lab_test_master.update({
        where: { lab_test_id: existing.lab_test_id },
        data: {
          test_code: code, // update to IH-xxx
          test_name: name,
          is_outsourced: false,
          outsource_lab: 'In-house lab',
          price: priceNum,
          walkin_price: priceNum,
          sample_type: r.specimen || existing.sample_type,
          tat_text: r.tat_text || `${tatHours} hrs`,
          tat_hours: tatHours,
          result_type: r.result_type || (isPanel ? 'Panel' : 'Numeric'),
          includes_details: r.includes || existing.includes_details,
          is_panel: isPanel,
          test_status: 1
        }
      });
      console.log(`  Updated In-house test ${code} (${name})`);
    } else {
      const newId = `LT-IH-${code.replace(/[^0-9]/g, '')}`;
      await prisma.lab_test_master.create({
        data: {
          lab_test_id: newId,
          lab_test_category_id: defaultCatId,
          test_code: code,
          test_name: name,
          is_outsourced: false,
          outsource_lab: 'In-house lab',
          price: priceNum,
          walkin_price: priceNum,
          sample_type: r.specimen || 'Whole Blood',
          tat_text: r.tat_text || `${tatHours} hrs`,
          tat_hours: tatHours,
          result_type: r.result_type || (isPanel ? 'Panel' : 'Numeric'),
          includes_details: r.includes || null,
          is_panel: isPanel,
          test_status: 1,
          expiry_time_hours: 2.0
        }
      });
      console.log(`  Created In-house test ${code} (${name})`);
    }
  }

  // Also ensure NEW-001 through NEW-006 are marked in-house
  await prisma.lab_test_master.updateMany({
    where: {
      test_code: { in: ['NEW-001', 'NEW-002', 'NEW-003', 'NEW-004', 'NEW-005', 'NEW-006', 'CBC001', 'CBC002'] }
    },
    data: {
      is_outsourced: false,
      outsource_lab: 'In-house lab'
    }
  });

  // -------------------------------------------------------------------------
  // 3. SYNC MOLECULAR TESTS (MOL-001 through MOL-046)
  // -------------------------------------------------------------------------
  const molRows = testMasterSheet.filter(r => r.test_type === 'Molecular');
  console.log(`\nSyncing ${molRows.length} Molecular tests...`);

  for (const r of molRows) {
    const code = String(r.test_code).trim();
    const name = String(r.test_name).trim();
    const labName = String(r.lab_name).trim() || 'Core Diagnostics';
    const priceNum = typeof r.mrp === 'number' ? r.mrp : parseFloat(r.mrp) || null;
    const tatHours = typeof r.tat_hours === 'number' ? r.tat_hours : parseInt(r.tat_hours, 10) || 336;

    const existing = await prisma.lab_test_master.findFirst({
      where: { test_code: code }
    });

    if (existing) {
      await prisma.lab_test_master.update({
        where: { lab_test_id: existing.lab_test_id },
        data: {
          test_name: name,
          is_outsourced: true,
          outsource_lab: labName,
          price: priceNum,
          walkin_price: priceNum,
          sample_type: r.specimen || existing.sample_type,
          tat_text: r.tat_text || `${tatHours} hrs`,
          tat_hours: tatHours,
          result_type: r.result_type || 'Report',
          includes_details: r.includes || existing.includes_details,
          is_panel: true,
          test_status: 1
        }
      });
    }
  }
  console.log(`Molecular tests updated with partner labs.`);

  // -------------------------------------------------------------------------
  // 4. SYNC OUTSOURCED TESTS (DDC-0001 through DDC-0774)
  // -------------------------------------------------------------------------
  const outsourcedRows = testMasterSheet.filter(r => r.test_type === 'Outsourced');
  console.log(`\nSyncing ${outsourcedRows.length} Outsourced DDC tests...`);

  let ddcUpdated = 0;
  for (const r of outsourcedRows) {
    const code = String(r.test_code).trim();
    const labName = String(r.lab_name).trim() || 'DDC';
    const priceNum = typeof r.mrp === 'number' ? r.mrp : parseFloat(r.mrp) || null;
    const tatHours = typeof r.tat_hours === 'number' ? r.tat_hours : parseInt(r.tat_hours, 10) || null;

    const existing = await prisma.lab_test_master.findFirst({
      where: { test_code: code }
    });

    if (existing) {
      await prisma.lab_test_master.update({
        where: { lab_test_id: existing.lab_test_id },
        data: {
          is_outsourced: true,
          outsource_lab: labName,
          price: priceNum || existing.price,
          walkin_price: priceNum || existing.walkin_price,
          sample_type: r.specimen || existing.sample_type,
          tat_text: r.tat_text || existing.tat_text,
          tat_hours: tatHours || existing.tat_hours,
          result_type: r.result_type || existing.result_type,
          includes_details: r.includes || existing.includes_details,
          reference_range: r.reference_range_text || existing.reference_range,
          unit: r.result_unit && r.result_unit !== 'See panel parameters' ? r.result_unit : existing.unit
        }
      });
      ddcUpdated++;
    }
  }
  console.log(`Updated ${ddcUpdated} outsourced tests with partner lab information.`);

  // Ensure all remaining DDC- tests have is_outsourced = true and outsource_lab = 'DDC'
  await prisma.lab_test_master.updateMany({
    where: {
      test_code: { startsWith: 'DDC-' },
      OR: [
        { is_outsourced: null },
        { is_outsourced: false },
        { outsource_lab: null }
      ]
    },
    data: {
      is_outsourced: true,
      outsource_lab: 'DDC'
    }
  });

  // -------------------------------------------------------------------------
  // 5. INSERT MOLECULAR PARAMETERS (261 parameters)
  // -------------------------------------------------------------------------
  console.log(`\nSyncing ${molParamsSheet.length} Molecular parameters...`);
  let molParamsInserted = 0;

  for (let idx = 0; idx < molParamsSheet.length; idx++) {
    const p = molParamsSheet[idx];
    const testCode = String(p.test_code).trim();
    const paramName = String(p.parameter).trim();
    if (!paramName) continue;

    const test = await prisma.lab_test_master.findFirst({
      where: { test_code: testCode }
    });

    if (!test) {
      console.warn(`  Warning: Molecular test ${testCode} not found for param ${paramName}`);
      continue;
    }

    const refText = p['reference / interpretation'] ? String(p['reference / interpretation']).substring(0, 200) : null;
    const valueType = p.parameter_type === 'Quantitative' ? 'NUMBER' : 'TEXT';
    const remarks = [p.parameter_type, p.result_options, p.capture_details, p.cancer_site].filter(Boolean).join(' | ').substring(0, 500);

    // Check if this parameter already exists for this test
    const existingParam = await prisma.lab_test_parameter.findFirst({
      where: {
        lab_test_id: test.lab_test_id,
        parameter_name: paramName
      }
    });

    if (existingParam) {
      await prisma.lab_test_parameter.update({
        where: { lab_test_parameter_id: existingParam.lab_test_parameter_id },
        data: {
          unit: p.unit ? String(p.unit).substring(0, 50) : null,
          ref_range_text: refText,
          value_type: valueType,
          remarks: remarks || null,
          sort_order: idx + 1
        }
      });
    } else {
      const paramId = `LTP-MOL-${testCode.replace('MOL-', '')}-${String(idx + 1).padStart(3, '0')}`;
      await prisma.lab_test_parameter.create({
        data: {
          lab_test_parameter_id: paramId,
          lab_test_id: test.lab_test_id,
          parameter_name: paramName.substring(0, 100),
          unit: p.unit ? String(p.unit).substring(0, 50) : null,
          ref_range_text: refText,
          value_type: valueType,
          remarks: remarks || null,
          sort_order: idx + 1,
          gender: 'Both'
        }
      });
      molParamsInserted++;
    }
  }
  console.log(`Finished molecular parameters sync. Inserted/updated parameters across all 46 molecular tests.`);

  // -------------------------------------------------------------------------
  // 6. SYNC PANEL PARAMETERS (135 parameters)
  // -------------------------------------------------------------------------
  console.log(`\nSyncing ${panelParamsSheet.length} Panel parameters...`);

  // Group panel params by panel_key
  const panelMap = new Map<string, any[]>();
  for (const pp of panelParamsSheet) {
    const key = String(pp.panel_key).trim().toUpperCase();
    if (!panelMap.has(key)) panelMap.set(key, []);
    panelMap.get(key)!.push(pp);
  }

  // Helper function to upsert parameters for a test
  async function attachPanelParams(testCode: string, panelKeys: string[]) {
    const test = await prisma.lab_test_master.findFirst({
      where: {
        OR: [
          { test_code: testCode },
          { test_code: testCode.replace(/^IH-/, 'INH-') }
        ]
      }
    });
    if (!test) return;

    let sortOrder = 1;
    for (const key of panelKeys) {
      const params = panelMap.get(key) || [];
      for (const p of params) {
        const paramName = String(p.parameter).trim();
        const unit = p.unit && p.unit !== 'None' ? String(p.unit).trim() : null;
        const maleLow = p.male_low !== undefined && p.male_low !== null && !isNaN(Number(p.male_low)) ? Number(p.male_low) : null;
        const maleHigh = p.male_high !== undefined && p.male_high !== null && !isNaN(Number(p.male_high)) ? Number(p.male_high) : null;
        const femaleLow = p.female_low !== undefined && p.female_low !== null && !isNaN(Number(p.female_low)) ? Number(p.female_low) : null;
        const femaleHigh = p.female_high !== undefined && p.female_high !== null && !isNaN(Number(p.female_high)) ? Number(p.female_high) : null;
        const critLow = p.critical_low !== undefined && p.critical_low !== null && !isNaN(Number(p.critical_low)) ? Number(p.critical_low) : null;
        const critHigh = p.critical_high !== undefined && p.critical_high !== null && !isNaN(Number(p.critical_high)) ? Number(p.critical_high) : null;
        const isQual = String(p.qualitative).toLowerCase() === 'yes';

        let refText = '-';
        if (maleLow !== null && maleHigh !== null) {
          if (femaleLow !== null && femaleHigh !== null && (femaleLow !== maleLow || femaleHigh !== maleHigh)) {
            refText = `M: ${maleLow}-${maleHigh}, F: ${femaleLow}-${femaleHigh} ${unit || ''}`.trim();
          } else {
            refText = `${maleLow} - ${maleHigh} ${unit || ''}`.trim();
          }
        } else if (p.remarks && p.remarks !== 'None') {
          refText = String(p.remarks).substring(0, 200);
        }

        const existing = await prisma.lab_test_parameter.findFirst({
          where: {
            lab_test_id: test.lab_test_id,
            parameter_name: paramName
          }
        });

        if (existing) {
          await prisma.lab_test_parameter.update({
            where: { lab_test_parameter_id: existing.lab_test_parameter_id },
            data: {
              unit: unit ? unit.substring(0, 50) : null,
              ref_range_low: maleLow,
              ref_range_high: maleHigh,
              ref_range_text: refText.substring(0, 200),
              critical_low: critLow,
              critical_high: critHigh,
              remarks: p.remarks && p.remarks !== 'None' ? String(p.remarks) : null,
              value_type: isQual ? 'TEXT' : 'NUMBER',
              sort_order: sortOrder++
            }
          });
        } else {
          const paramId = `LTP-${test.test_code.replace(/[^a-zA-Z0-9]/g, '')}-${String(sortOrder).padStart(3, '0')}`;
          await prisma.lab_test_parameter.create({
            data: {
              lab_test_parameter_id: paramId,
              lab_test_id: test.lab_test_id,
              parameter_name: paramName.substring(0, 100),
              unit: unit ? unit.substring(0, 50) : null,
              ref_range_low: maleLow,
              ref_range_high: maleHigh,
              ref_range_text: refText.substring(0, 200),
              critical_low: critLow,
              critical_high: critHigh,
              remarks: p.remarks && p.remarks !== 'None' ? String(p.remarks) : null,
              value_type: isQual ? 'TEXT' : 'NUMBER',
              gender: 'Both',
              sort_order: sortOrder++
            }
          });
        }
      }
    }
    console.log(`  Linked panel parameters to ${test.test_code} (${test.test_name}) -> Total: ${sortOrder - 1} params`);
  }

  // Link Panel Parameters to In-House Tests
  await attachPanelParams('IH-013', ['CBC']); // Complete Blood Count
  await attachPanelParams('IH-009', ['LFT']); // Liver Function Test
  await attachPanelParams('IH-004', ['ELEC']); // Electrolytes
  await attachPanelParams('IH-008', ['LIPID']); // Lipid profile
  await attachPanelParams('NEW-001', ['RFT']); // Renal Function Test
  await attachPanelParams('NEW-002', ['COAG']); // Coagulation Profile
  await attachPanelParams('DDC-1519', ['URINE']); // Urine Routine
  await attachPanelParams('DDC-1443', ['TFT']); // TFT
  await attachPanelParams('DDC-0962', ['ABG']); // ABG
  await attachPanelParams('DDC-1046', ['CSF']); // CSF
  await attachPanelParams('DDC-1068', ['DC']); // DC
  await attachPanelParams('DDC-1152', ['HBTCDC']); // HB,TC,DC

  // Link Prechemo Packages
  // Prechemo Package (IH-002): CBC, LFT, Urea, Creatinine, RBS
  await attachPanelParams('IH-002', ['CBC', 'LFT']);
  // Prechemo Plus (IH-001): CBC, LFT, Urea, Creatinine, RBS, Calcium, Electrolytes
  await attachPanelParams('IH-001', ['CBC', 'LFT', 'ELEC']);

  // Ensure individual In-house tests have their parameters
  const singleInhouseDefs: { code: string; name: string; unit: string; range: string; low?: number; high?: number; type: string }[] = [
    { code: 'IH-003', name: 'Calcium', unit: 'mg/dL', range: '8.5 - 10.5 mg/dL', low: 8.5, high: 10.5, type: 'NUMBER' },
    { code: 'IH-010', name: 'Uric Acid', unit: 'mg/dL', range: '3.5 - 7.2 mg/dL', low: 3.5, high: 7.2, type: 'NUMBER' },
    { code: 'IH-011', name: 'Urea', unit: 'mg/dL', range: '15 - 40 mg/dL', low: 15, high: 40, type: 'NUMBER' },
    { code: 'IH-012', name: 'Creatinine', unit: 'mg/dL', range: '0.6 - 1.2 mg/dL', low: 0.6, high: 1.2, type: 'NUMBER' },
    { code: 'IH-014', name: 'Glucose Fasting', unit: 'mg/dL', range: '70 - 100 mg/dL', low: 70, high: 100, type: 'NUMBER' },
    { code: 'IH-015', name: 'Glucose Post Prandial', unit: 'mg/dL', range: '70 - 140 mg/dL', low: 70, high: 140, type: 'NUMBER' },
    { code: 'IH-016', name: 'Glucose Random', unit: 'mg/dL', range: '70 - 140 mg/dL', low: 70, high: 140, type: 'NUMBER' },
    { code: 'IH-005', name: 'HIV 1 & 2 Antibody', unit: '', range: 'Non-reactive', type: 'TEXT' },
    { code: 'IH-006', name: 'HCV Antibody', unit: '', range: 'Non-reactive', type: 'TEXT' },
    { code: 'IH-007', name: 'HBsAg (Surface Antigen)', unit: '', range: 'Non-reactive', type: 'TEXT' },
    { code: 'IH-017', name: 'Cytological Evaluation', unit: '', range: 'Negative for Intraepithelial Lesion or Malignancy', type: 'TEXT' },
    { code: 'IH-018', name: 'Procedure & Specimen Adequacy', unit: '', range: 'Satisfactory for evaluation', type: 'TEXT' },
    { code: 'IH-019', name: 'High Risk HPV DNA', unit: '', range: 'Negative', type: 'TEXT' },
  ];

  for (const s of singleInhouseDefs) {
    const test = await prisma.lab_test_master.findFirst({
      where: {
        OR: [
          { test_code: s.code },
          { test_code: s.code.replace(/^IH-/, 'INH-') }
        ]
      }
    });
    if (!test) continue;

    const existing = await prisma.lab_test_parameter.findFirst({
      where: { lab_test_id: test.lab_test_id }
    });

    if (existing) {
      await prisma.lab_test_parameter.update({
        where: { lab_test_parameter_id: existing.lab_test_parameter_id },
        data: {
          parameter_name: s.name,
          unit: s.unit || null,
          ref_range_text: s.range,
          ref_range_low: s.low ?? null,
          ref_range_high: s.high ?? null,
          value_type: s.type
        }
      });
    } else {
      await prisma.lab_test_parameter.create({
        data: {
          lab_test_parameter_id: `LTP-${s.code.replace(/[^a-zA-Z0-9]/g, '')}-001`,
          lab_test_id: test.lab_test_id,
          parameter_name: s.name,
          unit: s.unit || null,
          ref_range_text: s.range,
          ref_range_low: s.low ?? null,
          ref_range_high: s.high ?? null,
          value_type: s.type,
          sort_order: 1,
          gender: 'Both'
        }
      });
      console.log(`  Added parameter for single test ${s.code} (${s.name})`);
    }
  }

  // -------------------------------------------------------------------------
  // 7. VERIFY FINAL COUNTS
  // -------------------------------------------------------------------------
  const finalTotal = await prisma.lab_test_master.count();
  const finalInhouse = await prisma.lab_test_master.count({ where: { is_outsourced: false } });
  const finalOutsourced = await prisma.lab_test_master.count({ where: { is_outsourced: true } });
  const finalParams = await prisma.lab_test_parameter.count();
  const finalTestsWithParams = await prisma.lab_test_master.count({
    where: { lab_test_parameter: { some: {} } }
  });

  console.log('\n=== FINAL DATABASE TOTALS ===');
  console.log(`Total Tests in DB: ${finalTotal}`);
  console.log(`In-house Tests: ${finalInhouse}`);
  console.log(`Outsourced Tests: ${finalOutsourced}`);
  console.log(`Total Parameters in DB: ${finalParams}`);
  console.log(`Tests with Parameters: ${finalTestsWithParams}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('SYNC FAILED:', err);
  process.exit(1);
});
