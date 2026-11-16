import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NOTE_KINDS, type NoteKind } from '@shared/enums'
import { NewNoteButton, NoteEditor } from '../components/NoteEditor'
import { cn, EmptyState, PageHeader, Select } from '../components/ui'
import { formatDate } from '../lib/format'
import { useCam } from '../lib/hooks'
import { label } from '../i18n/pt-BR'

export function NotesPage() {
  const [params, setParams] = useSearchParams()
  const [kind, setKind] = useState<NoteKind | ''>('')
  const { data: notes } = useCam('notes.list', kind ? { kind } : {})
  const selected = notes?.find((n) => n.id === params.get('id')) ?? notes?.[0]
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Notas"
        subtitle="Todas as notas, de candidaturas, empresas, contatos e gerais"
        actions={<NewNoteButton onCreated={(n) => setParams({ id: n.id })} />}
      />
      <div className="flex min-h-0 flex-1">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-border p-3 scroll-thin">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as NoteKind | '')}
            placeholder="Todos os tipos"
            options={NOTE_KINDS.map((k) => ({ value: k, label: label('noteKind', k) }))}
          />
          <ul className="mt-2 space-y-0.5">
            {notes?.map((n) => (
              <li key={n.id}>
                <button
                  className={cn(
                    'w-full rounded px-2 py-1.5 text-left',
                    selected?.id === n.id ? 'bg-subtle' : 'hover:bg-subtle'
                  )}
                  onClick={() => setParams({ id: n.id })}
                >
                  <div className="truncate text-sm font-medium">
                    {n.pinned ? '📌 ' : ''}
                    {n.title}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {label('noteKind', n.kind)} · {n.ownerLabel ?? 'Geral'} · {formatDate(n.updatedAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-6 scroll-thin">
          {selected ? (
            <>
              {selected.applicationId && (
                <p className="mb-2 text-xs text-muted">
                  Ligada a{' '}
                  <Link
                    className="text-accent hover:underline"
                    to={`/candidaturas/${selected.applicationId}?aba=notas`}
                  >
                    {selected.ownerLabel}
                  </Link>
                </p>
              )}
              {selected.companyId && (
                <p className="mb-2 text-xs text-muted">
                  Ligada a{' '}
                  <Link className="text-accent hover:underline" to={`/empresas/${selected.companyId}`}>
                    {selected.ownerLabel}
                  </Link>
                </p>
              )}
              <NoteEditor note={selected} onDeleted={() => setParams({})} />
            </>
          ) : (
            <EmptyState
              title="Nenhuma nota"
              description="Crie notas gerais aqui ou dentro de cada candidatura e empresa."
            />
          )}
        </div>
      </div>
    </div>
  )
}
