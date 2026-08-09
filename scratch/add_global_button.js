import fs from "fs";
const path = "src/index.css";
let content = fs.readFileSync(path, 'utf8');

const globalBtnCss = `
@layer components {
  /* Automatically apply premium interactions to all primary green buttons */
  button[class*="bg-[#76C442]"],
  button[class*="bg-[#7CC242]"],
  a[class*="bg-[#76C442]"] {
    transition: all 150ms cubic-bezier(0.22, 1, 0.36, 1) !important;
  }
  button[class*="bg-[#76C442]"]:hover:not(:disabled),
  button[class*="bg-[#7CC242]"]:hover:not(:disabled),
  a[class*="bg-[#76C442]"]:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(124, 194, 66, 0.25) !important;
    filter: brightness(1.05) !important;
  }
  button[class*="bg-[#76C442]"]:active:not(:disabled),
  button[class*="bg-[#7CC242]"]:active:not(:disabled),
  a[class*="bg-[#76C442]"]:active {
    transform: scale(0.98) !important;
  }

  /* Table row interactions */
  tbody tr {
    transition: all 150ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  tbody tr:hover {
    background-color: rgba(248, 250, 252, 0.8);
  }
}
`;

content += "\n" + globalBtnCss;
fs.writeFileSync(path, content);
console.log("Updated index.css with global buttons and tables");
