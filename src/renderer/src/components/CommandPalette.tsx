import { Command } from 'cmdk'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Building2, FileText, NotebookPen, Plus, Settings, Trash2, User } from 'lucide-react'
import type { SearchResult } from '@shared/dto'
import { useCam } from '../lib/hooks'
import { label } from '../i18n/pt-BR'

const ICONS = {
  application: Briefcase,
  company: Building2,
  contact: User,
  note: NotebookPen,
  attachment: FileText
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Ctrl+K: global search across applications, companies, contacts, notes and attachments, plus commands. */
export function CommandPalette({
  open,
  onClose,
  onNewApplication
}: {
  open: boolean
  onClose: () => void
  onNewApplication: () => void
}) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const q = useDebounced(text, 120)
  const { data: results } = useCam(
    'search.query',
    { text: q, limit: 40 },
    { enabled: open && q.trim().length > 0 }
  )

  useEffect(() => {
    if (open) setText('')
  }, [open])

  const grouped = useMemo(() => {
    const g = new Map<SearchResult['entityType'], SearchResult[]>()
    for (const r of results ?? []) g.set(r.entityType, [...(g.get(r.entityType) ?? []), r])
    return [...g.entries()]
  }, [results])

  if (!open) return null

  const go = (path: string) => {
    onClose()
    navigate(path)
  }
  const openResult = (r: SearchResult) => {
    if (r.entityType === 'company') return go(`/empresas/${r.entityId}`)
    if (r.entityType === 'contact') return go(`/contatos?id=${r.entityId}`)
    if (r.applicationId) {
      const tab =
        r.entityType === 'note' ? '?aba=notas' : r.entityType === 'attachment' ? '?aba=arquivos' : ''
      return go(`/candidaturas/${r.applicationId}${tab}`)
    }
    if (r.entityType === 'note') return go(`/notas?id=${r.entityId}`)
  }

  const commands = [
    { label: 'Nova candidatura', icon: Plus, run: onNewApplication, hint: 'Ctrl+N' },
    { label: 'Ir para Candidaturas', icon: Briefcase, run: () => go('/candidaturas'), hint: 'Ctrl+2' },
    { label: 'Ir para Empresas', icon: Building2, run: () => go('/empresas'), hint: 'Ctrl+5' },
    { label: 'Ir para Contatos', icon: User, run: () => go('/contatos') },
    { label: 'Ir para Notas', icon: NotebookPen, run: () => go('/notas') },
    { label: 'Ir para Lixeira', icon: Trash2, run: () => go('/lixeira') },
    { label: 'Configurações e backup', icon: Settings, run: () => go('/configuracoes') }
  ]
  const filteredCommands = commands.filter((c) => !text || c.label.toLowerCase().includes(text.toLowerCase()))

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]"
      onMouseDown={onClose}
    >
      <Command
        label="Busca global"
        shouldFilter={false}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <Command.Input
          autoFocus
          value={text}
          onValueChange={setText}
          placeholder="Buscar candidaturas, empresas, contatos, notas, arquivos… ou digitar um comando"
          className="h-11 w-full border-b border-border bg-transparent px-4 text-sm outline-none"
        />
        <Command.List className="max-h-[50vh] overflow-y-auto p-1 scroll-thin">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">Nada encontrado.</Command.Empty>
          {grouped.map(([type, items]) => (
            <Command.Group
              key={type}
              heading={label('entityType', type)}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted"
            >
              {items.map((r) => {
                const Icon = ICONS[r.entityType]
                return (
                  <Command.Item
                    key={`${r.entityType}-${r.entityId}`}
                    value={`${r.entityType}-${r.entityId}`}
                    onSelect={() => openResult(r)}
                    className="flex cursor-pointer items-start gap-2 rounded px-3 py-2 text-sm data-[selected=true]:bg-subtle"
                  >
                    <Icon size={15} className="mt-0.5 shrink-0 text-muted" />
                    <div className="min-w-0">
                      <div className="truncate">{r.title}</div>
                      {r.snippet && <div className="truncate text-xs text-muted">{r.snippet}</div>}
                    </div>
                  </Command.Item>
                )
              })}
            </Command.Group>
          ))}
          {filteredCommands.length > 0 && (
            <Command.Group
              heading="Comandos"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted"
            >
              {filteredCommands.map((c) => (
                <Command.Item
                  key={c.label}
                  value={`cmd-${c.label}`}
                  onSelect={c.run}
                  className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm data-[selected=true]:bg-subtle"
                >
                  <c.icon size={15} className="text-muted" />
                  {c.label}
                  {c.hint && <kbd className="ml-auto text-[10px] text-muted">{c.hint}</kbd>}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>,
    document.body
  )
}
