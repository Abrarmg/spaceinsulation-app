import fs from "fs";

const cssToAdd = `
@layer utilities {
  /* Premium Easings */
  .ease-premium {
    transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* Universal Transitions */
  .transition-premium {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    transition-duration: 250ms;
  }
  
  .transition-fast {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    transition-duration: 150ms;
  }
  
  .transition-slow {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    transition-duration: 350ms;
  }

  /* Page Entrance */
  .page-transition {
    animation: pageEntrance 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  /* KPI / Card Stagger Entrance */
  .animate-stagger-1 { animation: slideUpFade 350ms cubic-bezier(0.22, 1, 0.36, 1) 0ms forwards; opacity: 0; }
  .animate-stagger-2 { animation: slideUpFade 350ms cubic-bezier(0.22, 1, 0.36, 1) 50ms forwards; opacity: 0; }
  .animate-stagger-3 { animation: slideUpFade 350ms cubic-bezier(0.22, 1, 0.36, 1) 100ms forwards; opacity: 0; }
  .animate-stagger-4 { animation: slideUpFade 350ms cubic-bezier(0.22, 1, 0.36, 1) 150ms forwards; opacity: 0; }
  .animate-stagger-5 { animation: slideUpFade 350ms cubic-bezier(0.22, 1, 0.36, 1) 200ms forwards; opacity: 0; }
  
  /* Modal Entrance */
  .modal-backdrop-anim {
    animation: fadeIn 250ms ease-out forwards;
  }
  .modal-content-anim {
    animation: modalEntrance 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  /* Primary Button Interactions */
  .btn-premium {
    transition: all 150ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .btn-premium:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(124, 194, 66, 0.25);
    filter: brightness(1.05);
  }
  .btn-premium:active:not(:disabled) {
    transform: scale(0.98);
  }
  
  /* Clock In Button Pulse */
  .clock-pulse {
    animation: subtlePulse 3s ease-in-out infinite;
  }
}

@keyframes pageEntrance {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes slideUpFade {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes modalEntrance {
  0% { opacity: 0; transform: scale(0.97) translateY(8px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes subtlePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(124, 194, 66, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(124, 194, 66, 0); }
}

/* Reduced Motion Override */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

const path = "src/index.css";
let content = fs.readFileSync(path, 'utf8');
content += "\n" + cssToAdd;
fs.writeFileSync(path, content);
console.log("Updated index.css");
