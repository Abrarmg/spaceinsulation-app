/**
 * Shared UI building blocks.
 *
 * Every page should build from these instead of re-styling buttons, cards and
 * badges by hand, so the whole app looks and behaves the same way.
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { fade, sheet } from './motion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { LucideIcon } from 'lucide-react';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-navy hover:bg-brand-hover shadow-card',
  secondary: 'bg-white text-navy border border-line hover:bg-mist hover:border-line-strong shadow-card',
  ghost: 'bg-transparent text-ink-soft hover:bg-mist hover:text-navy',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-card',
  dark: 'bg-navy text-white hover:bg-navy-soft shadow-card',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-sm gap-2',
};

export const buttonClasses = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') =>
  cx(
    'inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap select-none',
    'transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    extra,
  );

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  block,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={buttonClasses(variant, size, cx(block && 'w-full', className))}
    {...rest}
  >
    {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} strokeWidth={2.25} /> : null}
    {children}
  </button>
);

interface ButtonLinkProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}

export const ButtonLink: React.FC<ButtonLinkProps> = ({ to, variant = 'primary', size = 'md', icon: Icon, className = '', children }) => (
  <Link to={to} className={buttonClasses(variant, size, className)}>
    {Icon && <Icon size={16} strokeWidth={2.25} />}
    {children}
  </Link>
);

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

interface CardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  padded?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, description, actions, padded = true, className = '', children }) => (
  <section className={cx('bg-white border border-line rounded-xl shadow-card', className)}>
    {(title || actions) && (
      <header className="flex items-start justify-between gap-3 px-4 md:px-5 pt-4 pb-3 border-b border-line">
        <div className="min-w-0">
          {title && <h3 className="m-0 text-base font-semibold text-navy truncate">{title}</h3>}
          {description && <p className="m-0 mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
    )}
    <div className={padded ? 'p-4 md:p-5' : ''}>{children}</div>
  </section>
);

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export type BadgeTone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'navy';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-mist text-ink-soft',
  green: 'bg-brand-soft text-brand-ink',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
  navy: 'bg-navy text-white',
};

/** Maps the app's status words to a badge colour so every list reads the same. */
export const statusTone = (status?: string | null): BadgeTone => {
  const s = (status || '').toLowerCase().replace(/_/g, ' ');
  if (['paid', 'completed', 'approved', 'won', 'active', 'accepted', 'converted'].includes(s)) return 'green';
  if (['scheduled', 'sent', 'contacted', 'viewed'].includes(s)) return 'blue';
  if (['in progress', 'pending', 'quoted', 'awaiting', 'partial', 'partially paid', 'draft', 'unscheduled'].includes(s)) return 'amber';
  if (['overdue', 'cancelled', 'canceled', 'rejected', 'lost', 'declined', 'void'].includes(s)) return 'red';
  if (['new', 'rescheduled'].includes(s)) return 'purple';
  return 'neutral';
};

interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', dot, className = '', children }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold whitespace-nowrap capitalize',
      BADGE_TONES[tone],
      className,
    )}
  >
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
    {children}
  </span>
);

export const StatusBadge: React.FC<{ status?: string | null; className?: string }> = ({ status, className }) => (
  <Badge tone={statusTone(status)} dot className={className}>
    {(status || 'Unknown').replace(/_/g, ' ')}
  </Badge>
);

/* -------------------------------------------------------------------------- */
/* Form fields                                                                 */
/* -------------------------------------------------------------------------- */

export const inputClasses = cx(
  'w-full h-11 md:h-10 px-3 rounded-lg border border-line bg-white text-sm text-navy placeholder:text-subtle',
  'hover:border-line-strong focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15',
  'disabled:bg-canvas disabled:text-muted transition-colors',
);

interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, required, htmlFor, className = '', children }) => (
  <div className={cx('flex flex-col gap-1.5', className)}>
    {label && (
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-soft">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error ? <p className="m-0 text-2xs text-red-600">{error}</p> : hint ? <p className="m-0 text-2xs text-muted">{hint}</p> : null}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => <input ref={ref} className={cx(inputClasses, className)} {...rest} />,
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <select ref={ref} className={cx(inputClasses, 'pr-8 cursor-pointer', className)} {...rest}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => (
    <textarea ref={ref} className={cx(inputClasses, 'h-auto min-h-[96px] py-2.5 leading-relaxed', className)} {...rest} />
  ),
);
Textarea.displayName = 'Textarea';

/* -------------------------------------------------------------------------- */
/* Page layout                                                                 */
/* -------------------------------------------------------------------------- */

export const Page: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={cx('flex-grow w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-7 space-y-5 md:space-y-6', className)}>
    {children}
  </div>
);

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small line above the title, e.g. a back link or breadcrumb. */
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, eyebrow, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
    <div className="min-w-0">
      {eyebrow && <div className="mb-1 text-xs text-muted">{eyebrow}</div>}
      <h1 className="m-0 text-2xl md:text-[1.625rem] font-bold text-navy tracking-tight leading-tight">{title}</h1>
      {subtitle && <p className="m-0 mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

interface EmptyStateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={cx('flex flex-col items-center justify-center text-center px-6 py-12', className)}>
    {Icon && (
      <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center mb-3">
        <Icon size={22} />
      </div>
    )}
    <h3 className="m-0 text-base font-semibold text-navy">{title}</h3>
    {description && <p className="m-0 mt-1 max-w-sm text-sm text-muted">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Sheet — a modal that is a bottom sheet on phones and a dialog on desktop    */
/* -------------------------------------------------------------------------- */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const SHEET_SIZES = { sm: 'md:max-w-md', md: 'md:max-w-lg', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' };

export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, description, footer, size = 'md', children }) => {
  const isPhone = useMediaQuery('(max-width: 767px)');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
    <m.div
      key="sheet"
      data-motion="off"
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-6"
      role="dialog"
      aria-modal="true"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1, transition: { duration: 0.25 } }}
    >
      <m.div data-motion="off" className="absolute inset-0 bg-navy/50" onClick={onClose} {...fade} />
      <m.div
        data-motion="off"
        {...sheet(isPhone)}
        className={cx(
          'relative w-full bg-white shadow-pop flex flex-col max-h-[92vh]',
          'rounded-t-2xl md:rounded-2xl',
          SHEET_SIZES[size],
        )}
      >
        <div className="md:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" />
        {(title || description) && (
          <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
            <div className="min-w-0">
              {title && <h2 className="m-0 text-lg font-semibold text-navy">{title}</h2>}
              {description && <p className="m-0 mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:bg-mist hover:text-navy border-0 bg-transparent"
            >
              <X size={18} />
            </button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-line bg-canvas rounded-b-2xl flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </m.div>
    </m.div>
      )}
    </AnimatePresence>
  );
};
