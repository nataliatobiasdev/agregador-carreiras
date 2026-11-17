import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Briefcase, Building2, NotebookPen, Plus, Search, Settings, Trash2, Users } from 'lucide-react'
import { CommandPalette } from './components/CommandPalette'
import { QuickAddDialog } from './components/QuickAddDialog'
import { Button, cn } from './components/ui'
import { useCam, UndoContext, useUndoController } from './lib/hooks'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { CompaniesPage, CompanyPage } from './pages/CompaniesPage'
import { ContactsPage } from './pages/ContactsPage'
import { NotesPage } from './pages/NotesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TrashPage } from './pages/TrashPage'
import appIcon from '../../../build/icons/64x64.png'

export type Theme = 'system' | 'light' | 'dark'

function useTheme(): void {
  const { data } = useCam('settings.get', { key: 'ui.theme' })
  const theme = (data as Theme | null) ?? 'system'
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

const NAV = [
  { to: '/candidaturas', label: 'Candidaturas', icon: Briefcase, shortcut: 'Ctrl+2' },
  { to: '/empresas', label: 'Empresas', icon: Building2, shortcut: 'Ctrl+5' },
  { to: '/contatos', label: 'Contatos', icon: Users },
  { to: '/notas', label: 'Notas', icon: NotebookPen },
  { to: '/lixeira', label: 'Lixeira', icon: Trash2 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings }
]

export default function App() {
  useTheme()
  const navigate = useNavigate()
  const undo = useUndoController()
  const [quickAdd, setQuickAdd] = useState(false)
  const [palette, setPalette] = useState(false)

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'n' && !e.shiftKey) {
        e.preventDefault()
        setPalette(false)
        setQuickAdd(true)
      } else if (k === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (k === '2') {
        e.preventDefault()
        navigate('/candidaturas')
      } else if (k === '5') {
        e.preventDefault()
        navigate('/empresas')
      }
    },
    [navigate]
  )
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    const back = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') navigate(-1)
    }
    window.addEventListener('keydown', back)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', back)
    }
  }, [onKey, navigate])

  return (
    <UndoContext.Provider value={undo}>
      <div className="flex h-full">
        <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel/80">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <img src={appIcon} alt="" aria-hidden className="h-8 w-8 shrink-0 rounded-md" />
            <div className="min-w-0">
              <div className="font-heading text-sm font-semibold leading-tight">
                Career Application Manager
              </div>
              <div className="mt-0.5 text-xs text-muted">Suas candidaturas, organizadas</div>
            </div>
          </div>
          <div className="flex flex-col gap-1 px-2">
            <Button
              variant="primary"
              icon={<Plus size={14} />}
              onClick={() => setQuickAdd(true)}
              className="justify-start"
            >
              Nova candidatura
              <kbd className="ml-auto font-mono text-[10px] opacity-70">Ctrl+N</kbd>
            </Button>
            <Button
              variant="ghost"
              icon={<Search size={14} />}
              onClick={() => setPalette(true)}
              className="justify-start border border-border bg-field"
            >
              Buscar
              <kbd className="ml-auto rounded border border-border bg-fg/[0.06] px-1.5 font-mono text-[10px]">
                Ctrl+K
              </kbd>
            </Button>
          </div>
          <nav className="mt-3 flex flex-col gap-0.5 px-2" aria-label="Navegação principal">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-accent bg-gradient-to-r from-accent/20 to-transparent text-fg [&>svg]:text-accent'
                      : 'border-transparent text-muted hover:bg-fg/[0.05] hover:text-fg'
                  )
                }
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto scroll-thin">
          <Routes>
            <Route path="/" element={<Navigate to="/candidaturas" replace />} />
            <Route path="/candidaturas" element={<ApplicationsPage onNew={() => setQuickAdd(true)} />} />
            <Route path="/candidaturas/:id" element={<ApplicationDetailPage />} />
            <Route path="/empresas" element={<CompaniesPage />} />
            <Route path="/empresas/:id" element={<CompanyPage />} />
            <Route path="/contatos" element={<ContactsPage />} />
            <Route path="/notas" element={<NotesPage />} />
            <Route path="/lixeira" element={<TrashPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/candidaturas" replace />} />
          </Routes>
        </main>
      </div>
      <QuickAddDialog open={quickAdd} onClose={() => setQuickAdd(false)} />
      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        onNewApplication={() => {
          setPalette(false)
          setQuickAdd(true)
        }}
      />
    </UndoContext.Provider>
  )
}
