import React from 'react';
import { CalendarCheck, ClipboardList, FileText } from 'lucide-react';

/**
 * Sign-in screens: a branded panel on the left (desktop) and a clean white
 * form on the right. On phones the brand sits above the form.
 */
export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen w-full flex bg-white">
    {/* Brand panel — desktop only */}
    <aside
      className="hidden lg:flex relative w-[44%] max-w-[640px] flex-col justify-between p-10 xl:p-12 text-white overflow-hidden"
      style={{ backgroundImage: 'url("/login_bg.jpg")', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-navy/90" />
      <div className="relative flex items-center gap-3">
        <img src="/logo_leads.png" alt="" className="w-11 h-11 object-contain" />
        <div className="leading-tight">
          <div className="text-lg font-bold">Space Insulation</div>
          <div className="text-xs text-subtle">Field management</div>
        </div>
      </div>

      <div className="relative space-y-6 max-w-md">
        <h2 className="m-0 text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
          Run every insulation job from one place.
        </h2>
        <ul className="m-0 p-0 list-none space-y-3 text-sm text-white/85">
          {[
            { icon: FileText, text: 'Send estimates customers can approve online' },
            { icon: CalendarCheck, text: 'Schedule crews and see the whole week at a glance' },
            { icon: ClipboardList, text: 'Track jobs, photos, sign-offs and invoices' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-white/10 text-brand flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative text-xs text-subtle">© {new Date().getFullYear()} Space Insulation Inc.</div>
    </aside>

    {/* Form side */}
    <main className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-8 bg-canvas lg:bg-white">
      <div className="w-full max-w-[400px]">
        <div className="lg:hidden flex flex-col items-center text-center mb-8">
          <img src="/logo_leads.png" alt="Space Insulation" className="w-16 h-16 object-contain" />
          <div className="mt-2 text-lg font-bold text-navy">Space Insulation</div>
          <div className="text-xs text-muted">Field management</div>
        </div>
        {children}
      </div>
    </main>
  </div>
);

/** Error / success message used on the sign-in screens. */
export const AuthNotice: React.FC<{ tone: 'error' | 'success'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={`p-3 rounded-lg text-sm leading-relaxed border ${
      tone === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-brand-soft border-brand/30 text-brand-ink'
    }`}
  >
    {children}
  </div>
);
