import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { CompanyDto } from '@shared/dto'
import { NewNoteButton, NoteEditor } from '../components/NoteEditor'
import { Button, EmptyState, Field, Input, Modal, PageHeader, Spinner, Textarea } from '../components/ui'
import { call } from '../lib/api'
import { formatDate, relativeDays } from '../lib/format'
import { useCam, useCamMutation, useInvalidateAll, useUndo } from '../lib/hooks'
import { StatusBadge } from './ApplicationsPage'

export function CompaniesPage() {
  const [text, setText] = useState('')
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useCam('companies.list', { text: text || undefined })
  const navigate = useNavigate()
  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle={data ? `${data.length} empresas` : undefined}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            Nova empresa
          </Button>
        }
      />
      <div className="border-b border-border px-6 py-2.5">
        <Input
          className="w-64"
          placeholder="Filtrar empresas"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <Spinner />
        ) : !data?.length ? (
          <EmptyState
            title="Nenhuma empresa"
            description="Empresas são criadas automaticamente ao registrar uma candidatura."
          />
        ) : (
          <table className="surface w-full overflow-hidden rounded-lg border border-border bg-panel text-sm">
            <thead className="border-b border-border bg-fg/[0.03] font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Empresa</th>
                <th className="px-3 py-2 text-right font-medium">Candidaturas</th>
                <th className="px-3 py-2 text-right font-medium">Em aberto</th>
                <th className="px-3 py-2 text-right font-medium">Com resposta</th>
                <th className="px-3 py-2 text-left font-medium">Última atividade</th>
                <th className="px-3 py-2 text-left font-medium">Setor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle"
                  onClick={() => navigate(`/empresas/${c.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/empresas/${c.id}`)}
                >
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.applicationCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.activeApplicationCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.applicationCount ? `${c.respondedCount} de ${c.applicationCount}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted">{relativeDays(c.lastActivityAt)}</td>
                  <td className="px-3 py-2 text-muted">{c.industry ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <CompanyDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => navigate(`/empresas/${c.id}`)}
      />
    </div>
  )
}

function CompanyDialog({
  open,
  onClose,
  company,
  onSaved
}: {
  open: boolean
  onClose: () => void
  company?: CompanyDto
  onSaved?: (c: CompanyDto) => void
}) {
  const [form, setForm] = useState({ name: '', website: '', industry: '', size: '', country: '', notes: '' })
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (open && loadedFor !== (company?.id ?? 'new')) {
    setLoadedFor(company?.id ?? 'new')
    setForm({
      name: company?.name ?? '',
      website: company?.website ?? '',
      industry: company?.industry ?? '',
      size: company?.size ?? '',
      country: company?.country ?? '',
      notes: company?.notes ?? ''
    })
  }
  const create = useCamMutation('companies.create', { success: 'Empresa criada' })
  const update = useCamMutation('companies.update', { success: 'Empresa atualizada' })
  const close = () => {
    setLoadedFor(null)
    onClose()
  }
  const save = async () => {
    const input = { ...form, website: form.website || null }
    const saved = company
      ? await update.mutateAsync({ id: company.id, patch: input })
      : await create.mutateAsync(input)
    onSaved?.(saved)
    close()
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Modal
      open={open}
      onClose={close}
      title={company ? 'Editar empresa' : 'Nova empresa'}
      footer={
        <>
          <Button onClick={close}>Cancelar</Button>
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
        <Field label="Site" className="col-span-2">
          <Input value={form.website} onChange={set('website')} placeholder="https://" />
        </Field>
        <Field label="Setor">
          <Input value={form.industry} onChange={set('industry')} />
        </Field>
        <Field label="Porte">
          <Input value={form.size} onChange={set('size')} />
        </Field>
        <Field label="País">
          <Input value={form.country} onChange={set('country')} />
        </Field>
        <Field label="Notas" className="col-span-2">
          <Textarea value={form.notes} onChange={set('notes')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export function CompanyPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const undo = useUndo()
  const invalidate = useInvalidateAll()
  const [editing, setEditing] = useState(false)
  const [selectedNote, setSelectedNote] = useState<string | null>(null)
  const { data: company } = useCam('companies.get', { id })
  const { data: apps } = useCam('applications.list', { companyId: id, includeArchived: true })
  const { data: contacts } = useCam('contacts.list', { companyId: id })
  const { data: notes } = useCam('notes.list', { companyId: id })
  const del = useCamMutation('companies.delete')
  if (!company) return <Spinner />
  const note = notes?.find((n) => n.id === selectedNote) ?? notes?.[0]
  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={[company.industry, company.size, company.country].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            {company.website && (
              <Button onClick={() => void call('app.openExternal', { url: company.website! })}>Site</Button>
            )}
            <Button icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button
              icon={<Trash2 size={14} />}
              onClick={async () => {
                await del.mutateAsync({ id })
                navigate('/empresas')
                undo.offer('Empresa movida para a Lixeira', async () => {
                  await call('companies.restore', { id })
                  invalidate()
                })
              }}
            >
              Excluir
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 px-6 py-4 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Candidaturas</h2>
          {!apps?.length ? (
            <p className="text-sm text-muted">Nenhuma candidatura.</p>
          ) : (
            <ul className="surface divide-y divide-border rounded-lg border border-border bg-panel">
              {apps.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/candidaturas/${a.id}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-subtle"
                  >
                    <span className="min-w-0 flex-1 truncate">{a.title}</span>
                    <StatusBadge status={a.status} outcome={a.outcome} />
                    <span className="text-xs text-muted">{formatDate(a.appliedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-2 mt-6 text-sm font-semibold">Contatos</h2>
          {!contacts?.length ? (
            <p className="text-sm text-muted">Nenhum contato desta empresa.</p>
          ) : (
            <ul className="surface divide-y divide-border rounded-lg border border-border bg-panel">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link to={`/contatos?id=${c.id}`} className="flex gap-3 px-3 py-2 hover:bg-subtle">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted">{c.roleTitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {company.notes && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold">Sobre</h2>
              <p className="whitespace-pre-wrap text-sm text-muted">{company.notes}</p>
            </>
          )}
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Notas da empresa</h2>
            <NewNoteButton owner={{ companyId: id }} onCreated={(n) => setSelectedNote(n.id)} />
          </div>
          {notes && notes.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {notes.map((n) => (
                <Button
                  key={n.id}
                  size="sm"
                  variant={note?.id === n.id ? 'secondary' : 'ghost'}
                  onClick={() => setSelectedNote(n.id)}
                >
                  {n.title}
                </Button>
              ))}
            </div>
          )}
          {note ? (
            <NoteEditor note={note} onDeleted={() => setSelectedNote(null)} />
          ) : (
            <p className="text-sm text-muted">
              Pesquisa, cultura, sinais de alerta… valem para todas as candidaturas nesta empresa.
            </p>
          )}
        </section>
      </div>
      <CompanyDialog open={editing} onClose={() => setEditing(false)} company={company} />
    </div>
  )
}
