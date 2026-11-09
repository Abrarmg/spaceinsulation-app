import React, { useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useInstallOption } from '../../utils/pwa';

const DISMISS_KEY = 'si.installCard.dismissed';

/**
 * "Add to home screen" card. Android shows a one-tap Install button; iPhone
 * shows the two Safari steps. Hidden once installed or dismissed.
 */
export const InstallCard: React.FC<{ audience?: 'crew' | 'office' }> = ({ audience = 'office' }) => {
  const { kind, install } = useInstallOption();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!kind || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — hidden for this visit */
    }
  };

  return (
    <section className="relative bg-white border border-line rounded-xl shadow-card p-4 md:p-5 flex items-start gap-3.5" aria-label="Install the app">
      <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-xl border border-line shrink-0" />
      <div className="min-w-0 flex-1 pr-6">
        <h2 className="m-0 text-base font-semibold text-navy">Add the app to your home screen</h2>
        <p className="m-0 mt-0.5 text-sm text-muted">
          {audience === 'crew'
            ? 'Open your jobs in one tap, full screen — and still see today’s jobs with weak signal in an attic or basement.'
            : 'Open it in one tap, full screen, like any other app.'}
        </p>
        {kind === 'prompt' ? (
          <button
            type="button"
            onClick={async () => {
              if (await install()) dismiss();
            }}
            className="mt-3 h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand-hover text-navy text-sm font-semibold border-0"
          >
            <Download size={16} /> Install app
          </button>
        ) : (
          <ol className="m-0 mt-3 p-0 list-none space-y-1.5 text-sm text-ink-soft">
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-mist text-navy text-xs font-semibold flex items-center justify-center shrink-0">1</span>
              Tap <Share size={16} className="text-blue-600" aria-label="Share" /> at the bottom of Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-mist text-navy text-xs font-semibold flex items-center justify-center shrink-0">2</span>
              Choose <span className="inline-flex items-center gap-1 font-medium text-navy"><SquarePlus size={16} /> Add to Home Screen</span>
            </li>
          </ol>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        title="Not now"
        className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-navy hover:bg-mist border-0 bg-transparent"
      >
        <X size={16} />
      </button>
    </section>
  );
};
