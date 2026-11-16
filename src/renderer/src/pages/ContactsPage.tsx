import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { ContactDto } from '@shared/dto'
import {
  Button,
  cn,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea
} from '../components/ui'
import { call } from '../lib/api'
import { formatDate, formatDateTime } from '../lib/format'
import { useCam, useCamMutation, useInvalidateAll, useUndo } from '../lib/hooks'
import { label } from '../i18n/pt-BR'

export function ContactsPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('id')
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<ContactDto | 'new' | null>(null)
  const { data, isLoading } = useCam('contacts.list', { text: text || undefined })
  const select = (id: string) => setParams({ id })
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Contatos"
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Novo contato
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-border p-3 scroll-thin">
          <Input
            placeholder="Filtrar por nome, empresa ou e-mail"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {isLoading ? (
            <Spinner />
          ) : !data?.length ? (
            <p className="mt-4 text-sm text-muted">Nenhum contato.</p>
          ) : (
            <ul className="mt-2 space-y-0.5">
              {data.map((c) => (
                <li key={c.id}>
                  <button
                    className={cn(
                      'w-full rounded px-2 py-1.5 text-left',
                      selectedId === c.id ? 'bg-subtle' : 'hover:bg-subtle'
                    )}
                    onClick={() => select(c.id)}
                  >
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted">
                      {[c.roleTitle, c.companyName].filter(Boolean).join(' · ') || '—'}
                      {c.lastInteractionAt && ` · última interação ${formatDate(c.lastInteractionAt)}`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-6 scroll-thin">
          {selectedId ? (
            <ContactDetail id={selectedId} onEdit={(c) => setEditing(c)} onDeleted={() => setParams({})} />
          ) : (
            <EmptyState
              title="Escolha um contato"
              description="Recrutadores, gestores e entrevistadores ligados às suas candidaturas."
            />
          )}
        </div>
      </div>
      <ContactDialog value={editing} onClose={() => setEditing(null)} onSaved={(c) => select(c.id)} />
    </div>
  )
}

function ContactDetail({
  id,
  onEdit,
  onDeleted
}: {
  id: string
  onEdit: (c: ContactDto) => void
  onDeleted: () => void
}) {
  const { data: c } = useCam('contacts.get', { id })
  const { data: timeline } = useCam('contacts.timeline', { id })
  const { data: apps } = useCam('contacts.applications', { id })
  const undo = useUndo()
  const invalidate = useInvalidateAll()
  if (!c) return <Spinner />
  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{c.name}</h2>
          <p className="text-sm text-muted">{[c.roleTitle, c.companyName].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onEdit(c)}>Editar</Button>
          <Button
            icon={<Trash2 size={14} />}
            onClick={async () => {
              await call('contacts.delete', { id })
              invalidate()
              onDeleted()
              undo.offer('Contato movido para a Lixeira', () => call('contacts.restore', { id }))
            }}
          >
            Excluir
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
        <dt className="text-muted">E-mail</dt>
        <dd>{c.email ?? '—'}</dd>
        <dt className="text-muted">Telefone</dt>
        <dd>{c.phone ?? '—'}</dd>
        <dt className="text-muted">LinkedIn</dt>
        <dd>
          {c.linkedinUrl ? (
            <button
              className="text-accent hover:underline"
              onClick={() => void call('app.openExternal', { url: c.linkedinUrl! })}
            >
              {c.linkedinUrl}
            </button>
          ) : (
            '—'
          )}
        </dd>
        <dt className="text-muted">Manter relação</dt>
        <dd>{c.keepInTouch ? 'Sim' : 'Não'}</dd>
      </dl>
      {c.notes && <p className="whitespace-pre-wrap text-sm">{c.notes}</p>}
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">Candidaturas</h3>
        {!apps?.length ? (
          <p className="text-sm text-muted">Nenhuma.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {apps.map((a) => (
              <li key={`${a.id}-${a.role}`}>
                <Link className="hover:underline" to={`/candidaturas/${a.id}`}>
                  {a.title} — {a.companyName}
                </Link>{' '}
                <span className="text-xs text-muted">({label('contactRole', a.role)})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">Interações registradas</h3>
        {!timeline?.length ? (
          <p className="text-sm text-muted">Nenhuma interação com este contato.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {timeline.map((e) => (
              <li key={e.id} className={cn(e.voidedAt && 'line-through opacity-50')}>
                <span className="text-xs text-muted">{formatDateTime(e.occurredAt)}</span> ·{' '}
                {label('eventType', e.type)}
                {e.direction && ` (${label('direction', e.direction)})`}
                {e.summary && <span className="text-muted"> — {e.summary}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ContactDialog({
  value,
  onClose,
  onSaved
}: {
  value: ContactDto | 'new' | null
  onClose: () => void
  onSaved: (c: ContactDto) => void
}) {
  const editing = value && value !== 'new' ? value : null
  const [form, setForm] = useState({
    name: '',
    companyId: '',
    roleTitle: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    keepInTouch: false,
    notes: ''
  })
  const { data: companies } = useCam('companies.list')
  const create = useCamMutation('contacts.create', { success: 'Contato salvo' })
  const update = useCamMutation('contacts.update', { success: 'Contato salvo' })
  useEffect(() => {
    if (!value) return
    setForm({
      name: editing?.name ?? '',
      companyId: editing?.companyId ?? '',
      roleTitle: editing?.roleTitle ?? '',
      email: editing?.email ?? '',
      phone: editing?.phone ?? '',
      linkedinUrl: editing?.linkedinUrl ?? '',
      keepInTouch: editing?.keepInTouch ?? false,
      notes: editing?.notes ?? ''
    })
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!value) return null
  const save = async () => {
    const input = {
      ...form,
      companyId: form.companyId || null,
      email: form.email || null,
      linkedinUrl: form.linkedinUrl || null
    }
    const saved = editing
      ? await update.mutateAsync({ id: editing.id, patch: input })
      : await create.mutateAsync(input)
    onSaved(saved)
    onClose()
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar contato' : 'Novo contato'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Nome *" className="col-span-2">
          <Input autoFocus value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Empresa">
          <Select
            value={form.companyId}
            onChange={set('companyId')}
            placeholder="—"
            options={(companies ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="Cargo">
          <Input value={form.roleTitle} onChange={set('roleTitle')} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="LinkedIn" className="col-span-2">
          <Input
            value={form.linkedinUrl}
            onChange={set('linkedinUrl')}
            placeholder="https://www.linkedin.com/in/…"
          />
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.keepInTouch}
            onChange={(e) => setForm((f) => ({ ...f, keepInTouch: e.target.checked }))}
          />{' '}
          Manter relação (lembrete de retomar contato na V1.1)
        </label>
        <Field label="Notas" className="col-span-2">
          <Textarea value={form.notes} onChange={set('notes')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
