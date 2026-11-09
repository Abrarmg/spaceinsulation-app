import { useEffect, useState } from 'react';

/**
 * Installing the app on a phone's home screen, and working with weak signal.
 * The offline rules live in public/sw.js.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

if (typeof window !== 'undefined') {
  // Android / Chrome: keep the browser's install offer so we can show our own button.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Registers the offline worker (production builds only, so development never serves stale files). */
export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Offline support could not start:', err));
  });
};

/** Removes saved crew data from this device, e.g. when someone signs out. */
export const clearOfflineData = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_DATA' });
  if ('caches' in window) caches.keys().then(keys => keys.filter(k => k.startsWith('si-data-')).forEach(k => caches.delete(k)));
};

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** How this device can install the app: a one-tap button, iPhone instructions, or not at all. */
export const useInstallOption = (): { kind: 'prompt' | 'ios' | null; install: () => Promise<boolean> } => {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  if (isStandalone()) return { kind: null, install: async () => false };
  if (deferredPrompt) {
    return {
      kind: 'prompt',
      install: async () => {
        const p = deferredPrompt;
        if (!p) return false;
        await p.prompt();
        const { outcome } = await p.userChoice;
        deferredPrompt = null;
        notify();
        return outcome === 'accepted';
      },
    };
  }
  if (isIOS()) return { kind: 'ios', install: async () => false };
  return { kind: null, install: async () => false };
};

/** True while the device has no connection. */
export const useOnline = () => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
};
