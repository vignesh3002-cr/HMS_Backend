const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// --prod flag checks only "dependencies" (for production start, no devDeps installed)
const onlyProd = process.argv.includes("--prod");
const declared = { ...pkg.dependencies };
if (!onlyProd) Object.assign(declared, pkg.devDependencies);

const missing = Object.keys(declared).filter(
  (name) => !fs.existsSync(path.join(root, "node_modules", ...name.split("/")))
);

if (missing.length) {
  console.error("\n✖ node_modules is out of sync with package.json.");
  console.error("  Missing: " + missing.join(", "));
  console.error("  Fix:     npm install\n");
  process.exit(1);
}
