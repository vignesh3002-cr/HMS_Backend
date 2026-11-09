import XLSX from "xlsx";
const wb = XLSX.readFile("C:\\Users\\ADMIN\\Downloads\\EMR_Risk_Prognostic_Scores.xlsx");
const show = (name, maxRows) => {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n===== ${name} (${data.length} rows incl header) =====`);
  for (let i = 0; i < Math.min(data.length, maxRows); i++) {
    console.log(i, JSON.stringify(data[i]));
  }
};
show("Score_Catalogue", 90);
show("Cancer_Score_Map", 60);
show("Cancer_Types", 60);
