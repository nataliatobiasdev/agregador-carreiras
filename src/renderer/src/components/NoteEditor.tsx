import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { History, Pin, Trash2 } from 'lucide-react'
import type { NoteDto } from '@shared/dto'
import { NOTE_KINDS, type NoteKind } from '@shared/enums'
import { call } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { useCam, useCamMutation, useInvalidateAll, useUndo } from '../lib/hooks'
import { label } from '../i18n/pt-BR'
import { Button, cn, Input, Modal, Select, Textarea, useToast } from './ui'

const AUTOSAVE_MS = 1500

/** Markdown note editor with live preview, autosave and version history. */
export function NoteEditor({ note, onDeleted }: { note: NoteDto; onDeleted?: () => void }) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.bodyMd)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState<'idle' | 'pending' | 'saved'>('idle')
  const [historyOpen, setHistoryOpen] = useState(false)
  const invalidate = useInvalidateAll()
  const toast = useToast()
  const undo = useUndo()
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const latest = useRef({ title, body })
  latest.current = { title, body }

  useEffect(() => {
    setTitle(note.title)
    setBody(note.bodyMd)
    setSaving('idle')
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    clearTimeout(timer.current)
    const { title: t, body: b } = latest.current
    if (t === note.title && b === note.bodyMd) return
    if (!t.trim()) return
    try {
      await call('notes.update', { id: note.id, title: t, bodyMd: b })
      setSaving('saved')
      invalidate()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' })
    }
  }

  // Saves pending edits when switching notes or leaving the page.
  useEffect(() => () => void save(), [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const schedule = () => {
    setSaving('pending')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
  }

  const update = useCamMutation('notes.update')
  const del = async () => {
    await call('notes.delete', { id: note.id })
    invalidate()
    onDeleted?.()
    undo.offer('Nota movida para a Lixeira', () => call('notes.restore', { id: note.id }))
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Título da nota"
          className="h-9 flex-1 text-base font-medium"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            schedule()
          }}
          onBlur={() => void save()}
        />
        <Select
          aria-label="Tipo da nota"
          className="w-56"
          value={note.kind}
          onChange={(e) => update.mutate({ id: note.id, kind: e.target.value as NoteKind })}
          options={NOTE_KINDS.map((k) => ({ value: k, label: label('noteKind', k) }))}
        />
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={note.pinned}
          title={note.pinned ? 'Desafixar' : 'Fixar'}
          onClick={() => update.mutate({ id: note.id, pinned: !note.pinned })}
          icon={<Pin size={14} className={cn(note.pinned && 'fill-current')} />}
        />
        <Button
          size="sm"
          variant="ghost"
          title="Versões"
          onClick={() => setHistoryOpen(true)}
          icon={<History size={14} />}
        />
        <Button
          size="sm"
          variant="ghost"
          title="Excluir nota"
          onClick={() => void del()}
          icon={<Trash2 size={14} />}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <button className={cn(mode === 'edit' && 'font-semibold text-fg')} onClick={() => setMode('edit')}>
          Editar
        </button>
        <button
          className={cn(mode === 'preview' && 'font-semibold text-fg')}
          onClick={() => setMode('preview')}
        >
          Visualizar
        </button>
        <span className="ml-auto">
          {saving === 'pending'
            ? 'Salvando…'
            : saving === 'saved'
              ? 'Salvo'
              : `Atualizada em ${formatDateTime(note.updatedAt)}`}
        </span>
      </div>
      {mode === 'edit' ? (
        <Textarea
          aria-label="Conteúdo da nota (Markdown)"
          className="min-h-[320px] flex-1 font-mono text-[13px] leading-relaxed"
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            schedule()
          }}
          onBlur={() => void save()}
          placeholder="Escreva em Markdown: **negrito**, - listas, - [ ] checklists, ```código```"
        />
      ) : (
        <div className="prose prose-sm max-w-none flex-1 rounded-md border border-border bg-panel p-3 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body || '*Nota vazia*'}</ReactMarkdown>
        </div>
      )}
      <RevisionsDialog open={historyOpen} onClose={() => setHistoryOpen(false)} noteId={note.id} />
    </div>
  )
}

function RevisionsDialog({ open, onClose, noteId }: { open: boolean; onClose: () => void; noteId: string }) {
  const { data } = useCam('notes.revisions', { id: noteId }, { enabled: open })
  const restore = useCamMutation('notes.restoreRevision', { success: 'Versão restaurada' })
  const [selected, setSelected] = useState<string | null>(null)
  const rev = data?.find((r) => r.id === selected) ?? data?.[0]
  return (
    <Modal open={open} onClose={onClose} title="Versões da nota" width="max-w-3xl">
      <div className="flex gap-3">
        <ul className="w-48 shrink-0 space-y-0.5">
          {data?.map((r) => (
            <li key={r.id}>
              <button
                className={cn(
                  'w-full rounded px-2 py-1 text-left text-xs',
                  rev?.id === r.id ? 'bg-subtle font-medium' : 'hover:bg-subtle'
                )}
                onClick={() => setSelected(r.id)}
              >
                {formatDateTime(r.savedAt)}
              </button>
            </li>
          ))}
        </ul>
        <div className="min-w-0 flex-1">
          {rev && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{rev.title}</span>
                <Button
                  size="sm"
                  onClick={() => {
                    restore.mutate({ revisionId: rev.id })
                    onClose()
                  }}
                >
                  Restaurar esta versão
                </Button>
              </div>
              <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded bg-subtle p-3 text-xs">
                {rev.bodyMd || '(vazia)'}
              </pre>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Creates a note from a template kind and returns it. */
export function NewNoteButton({
  owner,
  onCreated
}: {
  owner?: { applicationId?: string; companyId?: string; contactId?: string }
  onCreated: (n: NoteDto) => void
}) {
  const [kind, setKind] = useState<NoteKind>('free')
  const create = useCamMutation('notes.create')
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Modelo da nova nota"
        className="w-56"
        value={kind}
        onChange={(e) => setKind(e.target.value as NoteKind)}
        options={NOTE_KINDS.map((k) => ({ value: k, label: label('noteKind', k) }))}
      />
      <Button
        variant="primary"
        onClick={async () => {
          const n = await create.mutateAsync({ kind, title: label('noteKind', kind), owner })
          onCreated(n)
        }}
      >
        Nova nota
      </Button>
    </div>
  )
}
