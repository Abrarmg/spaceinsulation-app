import fs from "fs";
const path = "src/index.css";
let content = fs.readFileSync(path, 'utf8');

const globalModalCss = `
@layer components {
  /* Automatically apply premium entrance animations to all modals */
  .fixed.inset-0 > .absolute.inset-0.backdrop-blur-sm,
  .fixed.inset-0 > .absolute.inset-0.bg-\\[\\#151A2D\\]\\/60,
  .fixed.inset-0 > .absolute.inset-0.bg-\\[\\#151A2D\\]\\/80 {
    animation: fadeIn 250ms ease-out forwards !important;
  }
  
  .fixed.inset-0 > .relative.bg-white:not(.drawer),
  .fixed.inset-0 > .relative.bg-\\[\\#151A2D\\] {
    animation: modalEntrance 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
  }
}
`;

content += "\n" + globalModalCss;
fs.writeFileSync(path, content);
console.log("Updated index.css with global modal animations");
