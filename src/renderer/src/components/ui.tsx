import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// ----------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
const buttonStyles: Record<ButtonVariant, string> = {
  // Nevora "Linear precision": borda de 1px e brilho interno no topo.
  primary:
    'border border-white/20 bg-accent font-semibold text-accent-fg shadow-[inset_0_1px_0_0_rgb(255_255_255/0.35),0_1px_3px_rgb(0_0_0/0.35)] hover:brightness-105',
  secondary:
    'border border-border bg-panel text-fg shadow-[inset_0_1px_0_0_rgb(var(--highlight)/0.06),0_1px_2px_rgb(0_0_0/0.15)] hover:border-muted/40 hover:bg-subtle',
  ghost: 'text-muted hover:bg-fg/[0.05] hover:text-fg',
  danger: 'border border-danger/40 bg-danger/15 text-danger hover:border-danger/60 hover:bg-danger/25'
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: ReactNode }
>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-sm',
        buttonStyles[variant],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

// ----------------------------------------------------------------- Inputs

const control =
  'rounded-md border border-border bg-field px-3 text-sm text-fg transition-colors placeholder:text-muted/60 hover:border-muted/40 focus:border-accent/60 disabled:opacity-60'
/** Full width unless the caller sets an explicit width. */
const width = (className?: string) => (className && /(^|\s)(w-|flex-1)/.test(className) ? '' : 'w-full')

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(control, width(className), 'h-9', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(control, width(className), 'min-h-[80px] py-2', className)}
        {...rest}
      />
    )
  }
)

export function Select({
  options,
  placeholder,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>
  placeholder?: string
}) {
  return (
    <select className={cn(control, width(className), 'h-9 pr-7', className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  const message = error ? (
    <span className="text-xs text-danger" role="alert">
      {error}
    </span>
  ) : hint ? (
    <span className="text-xs text-muted">{hint}</span>
  ) : null
  if (htmlFor) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
          {label}
        </label>
        {children}
        {message}
      </div>
    )
  }
  // Wrapping label: associates the text with the control without needing ids.
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{label}</span>
        {children}
      </label>
      {message}
    </div>
  )
}

// ----------------------------------------------------------------- Badge

export type BadgeTone = 'neutral' | 'accent' | 'secondary' | 'success' | 'warning' | 'danger'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'border-border bg-fg/[0.06] text-muted',
  accent: 'border-accent/35 bg-accent/15 text-accent',
  secondary: 'border-secondary/35 bg-secondary/15 text-secondary',
  success: 'border-success/35 bg-success/15 text-success',
  warning: 'border-warning/35 bg-warning/15 text-warning',
  danger: 'border-danger/35 bg-danger/15 text-danger'
}

/** Pill do Nevora. `tone` usa os tokens do tema; `color` aceita um hex vindo dos dados (ex.: cor de etapa). */
export function Badge({
  children,
  tone = 'neutral',
  color,
  dot,
  className
}: {
  children: ReactNode
  tone?: BadgeTone
  color?: string | null
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        !color && badgeTones[tone],
        className
      )}
      style={color ? { backgroundColor: `${color}22`, borderColor: `${color}55`, color } : undefined}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

const STATUS_TONES: Record<string, BadgeTone> = {
  active: 'accent',
  paused: 'warning',
  offer: 'success',
  closed: 'neutral'
}
export const statusTone = (status: string): BadgeTone => STATUS_TONES[status] ?? 'neutral'

// ----------------------------------------------------------------- Modal

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg'
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const t = setTimeout(() => {
      // Respect a field that already took focus (autoFocus); otherwise focus the first control.
      if (ref.current?.contains(document.activeElement)) return
      const first = ref.current?.querySelector<HTMLElement>(
        'input, select, textarea, button:not([data-close])'
      )
      first?.focus()
    }, 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
      previous?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay/60 p-4 pt-[8vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('surface-dialog w-full rounded-xl border border-border bg-panel', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
          </div>
          <button
            data-close
            aria-label="Fechar"
            className="rounded-md p-1 text-muted transition-colors hover:bg-subtle hover:text-fg"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

// ----------------------------------------------------------------- Toasts

interface Toast {
  id: number
  message: string
  tone: 'info' | 'error' | 'success'
  action?: { label: string; onClick: () => void }
}
type ToastInput = Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone']; duration?: number }

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random()
    setToasts((all) => [...all, { id, tone: t.tone ?? 'info', message: t.message, action: t.action }])
    setTimeout(
      () => setToasts((all) => all.filter((x) => x.id !== id)),
      t.duration ?? (t.action ? 10_000 : 4_000)
    )
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'surface-dialog glass pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm',
              t.tone === 'error'
                ? 'border-danger/40 text-danger'
                : t.tone === 'success'
                  ? 'border-success/40'
                  : 'border-border'
            )}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  t.action!.onClick()
                  setToasts((all) => all.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

// ----------------------------------------------------------------- Misc

export function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-panel/40 px-6 py-12 text-center">
      <p className="font-heading text-base font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange
}: {
  tabs: Array<{ value: T; label: string; count?: number }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-bg p-1"
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm font-medium transition-all',
            value === t.value
              ? 'border-accent/40 bg-gradient-to-r from-accent/20 to-secondary/20 text-fg shadow-sm'
              : 'border-transparent text-muted hover:text-fg'
          )}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="ml-1.5 font-mono text-xs text-muted">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Spinner() {
  return <div className="p-6 text-sm text-muted">Carregando…</div>
}
