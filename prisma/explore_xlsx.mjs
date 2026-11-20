import XLSX from "xlsx";
const wb = XLSX.readFile("C:\\Users\\ADMIN\\Downloads\\EMR_Risk_Prognostic_Scores.xlsx");
console.log("Sheets:", wb.SheetNames.map(s => `${s} (${wb.Sheets[s].ref})`));
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  console.log(`\n=== ${name} ===`);
  console.log("range:", ws.ref);
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  for (let i = 0; i < Math.min(6, data.length); i++) {
    console.log(i, JSON.stringify(data[i]).slice(0, 500));
  }
}
