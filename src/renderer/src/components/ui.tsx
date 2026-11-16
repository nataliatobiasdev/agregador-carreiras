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
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'bg-panel border border-border hover:bg-subtle',
  ghost: 'hover:bg-subtle',
  danger: 'bg-danger text-white hover:opacity-90'
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
        'inline-flex items-center gap-1.5 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm',
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
  'rounded-md border border-border bg-panel px-2.5 text-sm placeholder:text-muted/70 disabled:opacity-60'
/** Full width unless the caller sets an explicit width. */
const width = (className?: string) => (className && /(^|\s)(w-|flex-1)/.test(className) ? '' : 'w-full')

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(control, width(className), 'h-8', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(control, width(className), 'min-h-[80px] py-1.5', className)}
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
    <select className={cn(control, width(className), 'h-8 pr-6', className)} {...rest}>
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

export function Badge({
  children,
  color,
  className
}: {
  children: ReactNode
  color?: string | null
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
        !color && 'bg-subtle text-muted',
        className
      )}
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      {children}
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  active: '#2563eb',
  paused: '#a16207',
  offer: '#16a34a',
  closed: '#6b7280'
}
export const statusColor = (status: string): string => STATUS_COLORS[status] ?? '#6b7280'

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('w-full rounded-lg border border-border bg-panel shadow-xl', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          <button
            data-close
            aria-label="Fechar"
            className="rounded p-1 text-muted hover:bg-subtle"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3 scroll-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-4 py-2.5">{footer}</div>}
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
              'pointer-events-auto flex max-w-sm items-center gap-3 rounded-md border px-3 py-2 text-sm shadow-lg',
              t.tone === 'error' ? 'border-danger/40 bg-panel text-danger' : 'border-border bg-panel'
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
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
    <div role="tablist" className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm',
            value === t.value
              ? 'border-accent font-medium text-fg'
              : 'border-transparent text-muted hover:text-fg'
          )}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="ml-1.5 text-xs text-muted">{t.count}</span>
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
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Spinner() {
  return <div className="p-6 text-sm text-muted">Carregando…</div>
}
