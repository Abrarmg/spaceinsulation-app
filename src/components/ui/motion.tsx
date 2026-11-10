import React, { useEffect } from 'react';
import { LazyMotion, MotionConfig, animate, domAnimation } from 'framer-motion';
import type { Transition } from 'framer-motion';

/**
 * Every animation in the app runs on Framer Motion.
 *
 *  - Shared pieces (menus, drawers, sheets, toasts, pop-ups, page changes) use
 *    <m.*> components with the presets below, so they animate in AND out.
 *  - Older screens mark elements with simple classes (animate-fade-in,
 *    animate-slide-up, animate-in zoom-in, …) or use the standard pop-up
 *    layout; <MotionProvider> watches for those as they appear and animates
 *    them with Framer Motion's animate(). New code should prefer <m.*>.
 *  - Spinners and skeleton shimmer (animate-spin / animate-pulse) stay as CSS
 *    loops — they aren't entrance animations.
 *
 * People who turn on "reduce motion" on their device get no movement.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const transitions = {
  fast: { duration: 0.16, ease: EASE } satisfies Transition,
  base: { duration: 0.22, ease: EASE } satisfies Transition,
  spring: { type: 'spring', damping: 34, stiffness: 380, mass: 0.9 } satisfies Transition,
};

/** Backdrops and simple fades. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transitions.fast,
};

/** Dropdown menus and small panels that open under a button. */
export const pop = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -4 },
  transition: transitions.fast,
};

/** Toasts and floating bars that rise from the bottom. */
export const rise = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 16 },
  transition: transitions.base,
};

/** The phone "More" drawer sliding in from the left. */
export const drawer = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%' },
  transition: transitions.spring,
};

/** Pop-up forms: a bottom sheet on phones, a gentle zoom on bigger screens. */
export const sheet = (isPhone: boolean) =>
  isPhone
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: transitions.spring }
    : {
        initial: { opacity: 0, scale: 0.98, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 8 },
        transition: transitions.base,
      };

/* ------------------------------------------------------------------------ */
/* Older screens: animate marked elements as they appear                    */
/* ------------------------------------------------------------------------ */

type Keyframes = Parameters<typeof animate>[1];
interface Preset {
  selector: string;
  keyframes: (el: Element) => Keyframes;
  options?: (el: Element) => Record<string, unknown>;
}

// Same width as the stylesheet rule that turns pop-up forms into bottom sheets on phones.
const phoneSheet = () => window.matchMedia('(max-width: 639px)').matches;

// First match wins, so the most specific rules come first.
const PRESETS: Preset[] = [
  {
    // Standard pop-up form panel. On phones the stylesheet makes the white
    // panels full-width bottom sheets, so they slide up; elsewhere they zoom in gently.
    selector:
      '.fixed.inset-0 > .relative.bg-white:not(.drawer), .fixed.inset-0 > .relative.bg-navy, .fixed.inset-0.z-50 > [class*="animate-in"], .fixed.inset-0.z-50 > div > .relative.bg-white',
    keyframes: el =>
      phoneSheet() && el.matches('.fixed.inset-0.z-50 > .relative.bg-white, .fixed.inset-0.z-\\[60\\] > .relative.bg-white')
        ? { y: ['100%', '0%'] }
        : { opacity: [0, 1], scale: [0.98, 1], y: [8, 0] },
    options: el =>
      phoneSheet() && el.matches('.fixed.inset-0.z-50 > .relative.bg-white, .fixed.inset-0.z-\\[60\\] > .relative.bg-white')
        ? { type: 'spring', damping: 34, stiffness: 380, mass: 0.9 }
        : { duration: 0.22, ease: EASE },
  },
  {
    // Pop-up backdrops.
    selector: '.fixed.inset-0 > .absolute.inset-0',
    keyframes: () => ({ opacity: [0, 1] }),
    options: () => ({ duration: 0.18, ease: EASE }),
  },
  { selector: '.animate-sheet-up', keyframes: () => ({ y: ['100%', '0%'] }), options: () => ({ type: 'spring', damping: 34, stiffness: 380 }) },
  { selector: '.animate-slide-in', keyframes: () => ({ x: ['-100%', '0%'] }), options: () => ({ type: 'spring', damping: 34, stiffness: 380 }) },
  { selector: '.animate-scale-up', keyframes: () => ({ opacity: [0, 1], scale: [0.98, 1], y: [6, 0] }) },
  { selector: '.animate-fade-in-right', keyframes: () => ({ opacity: [0, 1], x: [8, 0] }) },
  { selector: '.animate-slide-up', keyframes: () => ({ opacity: [0, 1], y: [10, 0] }) },
  {
    selector: '[class*="animate-stagger-"]',
    keyframes: () => ({ opacity: [0, 1], y: [8, 0] }),
    options: el => {
      const n = Number(/animate-stagger-(\d)/.exec(el.className)?.[1] || 1);
      return { duration: 0.3, ease: EASE, delay: (n - 1) * 0.04 };
    },
  },
  {
    // Tailwind-animate style class names: animate-in fade-in / zoom-in-95 / slide-in-from-bottom-*.
    selector: '.animate-in',
    keyframes: el => {
      const k: Record<string, (number | string)[]> = { opacity: [0, 1] };
      if (/\bzoom-in/.test(el.className)) k.scale = [0.96, 1];
      if (/slide-in-from-bottom/.test(el.className)) k.y = [12, 0];
      if (/slide-in-from-top/.test(el.className)) k.y = [-8, 0];
      return k;
    },
  },
  { selector: '.animate-fade-in', keyframes: () => ({ opacity: [0, 1] }), options: () => ({ duration: 0.2, ease: EASE }) },
];

const ALL_SELECTORS = PRESETS.map(p => p.selector).join(', ');
const animated = new WeakSet<Element>();

const animateElement = (el: Element, reduce: boolean) => {
  if (animated.has(el) || !(el instanceof HTMLElement || el instanceof SVGElement)) return;
  // Elements already driven by <m.*> components carry inline Framer styles; leave them alone.
  if ((el as HTMLElement).dataset?.motion === 'off') return;
  const preset = PRESETS.find(p => el.matches(p.selector));
  if (!preset) return;
  animated.add(el);
  if (reduce) return;
  animate(el, preset.keyframes(el), { duration: 0.24, ease: EASE, ...(preset.options?.(el) || {}) });
};

const scan = (root: Element, reduce: boolean) => {
  if (root.matches(ALL_SELECTORS)) animateElement(root, reduce);
  root.querySelectorAll(ALL_SELECTORS).forEach(el => animateElement(el, reduce));
};

/** Wraps the app: loads Framer Motion's animation features and animates older screens' marked elements. */
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Whatever is already on screen at start-up just appears.
    document.querySelectorAll(ALL_SELECTORS).forEach(el => animated.add(el));
    const observer = new MutationObserver(records => {
      for (const r of records) {
        r.addedNodes.forEach(node => {
          if (node.nodeType === 1) scan(node as Element, reduce);
        });
        // A class added to an existing element (e.g. a panel switching state) counts too.
        if (r.type === 'attributes' && r.target.nodeType === 1) animateElement(r.target as Element, reduce);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
};
