import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Ban,
  Copy,
  ExternalLink,
  FileUp,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Redo2,
  RotateCcw,
  Send,
  StickyNote,
  ThumbsUp,
  Trash2,
  X
} from 'lucide-react'
import type { ApplicationDetail, AttachmentDto, NoteDto, TimelineEventDto } from '@shared/dto'
import {
  ATTACHMENT_KINDS,
  CONTACT_ROLES,
  type AttachmentKind,
  type ContactRole,
  type ManualEventType
} from '@shared/enums'
import {
  formFromDetail,
  formToInput,
  MoreFields,
  RequiredFields,
  type ApplicationFormState,
  type FormErrors
} from '../components/ApplicationForm'
import { EventDialog } from '../components/EventDialog'
import { NewNoteButton, NoteEditor } from '../components/NoteEditor'
import {
  Badge,
  Button,
  cn,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Tabs,
  Textarea,
  useToast
} from '../components/ui'
import { call, errorMessage } from '../lib/api'
import {
  daysSince,
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  fromLocalInput,
  toLocalInput
} from '../lib/format'
import { useCam, useCamMutation, useInvalidateAll, useUndo } from '../lib/hooks'
import { label } from '../i18n/pt-BR'
import { StatusBadge } from './ApplicationsPage'

type Tab = 'timeline' | 'data' | 'contacts' | 'notes' | 'files' | 'history'
const TAB_PARAM: Record<string, Tab> = {
  notas: 'notes',
  arquivos: 'files',
  dados: 'data',
  contatos: 'contacts',
  historico: 'history'
}

export function ApplicationDetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(TAB_PARAM[params.get('aba') ?? ''] ?? 'timeline')
  const [eventType, setEventType] = useState<ManualEventType | null>(null)
  const { data: app, isLoading, error } = useCam('applications.get', { id })
  const { data: events } = useCam('events.list', { applicationId: id })
  const { data: notes } = useCam('notes.list', { applicationId: id })
  const { data: attachments } = useCam('attachments.list', { applicationId: id })

  // E / I / F shortcuts while not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || eventType) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable=true], [role=dialog]')) return
      const map: Record<string, ManualEventType> = {
        e: 'stage_changed',
        i: 'interaction',
        f: 'follow_up_sent'
      }
      const t = map[e.key.toLowerCase()]
      if (t && app && !app.deletedAt) {
        e.preventDefault()
        setEventType(t)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [app, eventType])

  if (isLoading) return <Spinner />
  if (error || !app)
    return (
      <div className="p-6">
        <EmptyState
          title="Candidatura não encontrada"
          description={error ? errorMessage(error) : undefined}
        />
      </div>
    )

  return (
    <div className="flex min-h-full flex-col">
      <Header app={app} onEvent={setEventType} />
      <div className="px-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'timeline', label: 'Linha do tempo', count: events?.filter((e) => !e.voidedAt).length },
            { value: 'data', label: 'Dados da vaga' },
            { value: 'contacts', label: 'Contatos', count: app.contacts.length },
            { value: 'notes', label: 'Notas', count: notes?.length },
            { value: 'files', label: 'Arquivos', count: attachments?.length },
            { value: 'history', label: 'Histórico de edições' }
          ]}
        />
      </div>
      <div className="flex-1 px-6 py-4">
        {tab === 'timeline' && <Timeline events={events ?? []} app={app} />}
        {tab === 'data' && <DataTab app={app} />}
        {tab === 'contacts' && <ContactsTab app={app} />}
        {tab === 'notes' && <NotesTab appId={app.id} notes={notes ?? []} />}
        {tab === 'files' && <FilesTab appId={app.id} attachments={attachments ?? []} />}
        {tab === 'history' && <HistoryTab appId={app.id} />}
      </div>
      <EventDialog app={app} type={eventType} onClose={() => setEventType(null)} />
    </div>
  )
}

// ------------------------------------------------------------------ Header

function Header({ app, onEvent }: { app: ApplicationDetail; onEvent: (t: ManualEventType) => void }) {
  const navigate = useNavigate()
  const undo = useUndo()
  const invalidate = useInvalidateAll()
  const toast = useToast()
  const idle = daysSince(app.lastActivityAt)
  const act = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn()
      invalidate()
      if (success) toast({ message: success, tone: 'success' })
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' })
    }
  }
  const quick = (icon: ReactNode, text: string, type: ManualEventType, hint?: string) => (
    <Button size="sm" icon={icon} onClick={() => onEvent(type)} title={hint}>
      {text}
    </Button>
  )
  return (
    <div className="border-b border-border px-6 pb-3 pt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-muted">
            <Link to={`/empresas/${app.companyId}`} className="hover:underline">
              {app.companyName}
            </Link>
          </div>
          <h1 className="truncate text-lg font-semibold">{app.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <StatusBadge status={app.status} outcome={app.outcome} />
            {app.stageName && <Badge>{app.stageName}</Badge>}
            {app.archivedAt && <Badge>Arquivada</Badge>}
            <span>
              Aplicada em {formatDate(app.appliedAt)} via {app.platform}
            </span>
            <span>·</span>
            <span>
              {idle === null
                ? 'Sem atividade'
                : idle <= 0
                  ? 'Atividade hoje'
                  : `${idle} dia(s) desde a última atividade`}
            </span>
            {app.firstInboundAt && (
              <>
                <span>·</span>
                <span>Primeira resposta em {formatDate(app.firstInboundAt)}</span>
              </>
            )}
            {app.jobUrl && (
              <button
                className="inline-flex items-center gap-1 text-accent hover:underline"
                onClick={() => void call('app.openExternal', { url: app.jobUrl! })}
              >
                Ver anúncio <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
        <Completeness app={app} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {quick(<ArrowRightLeft size={14} />, 'Mudar etapa', 'stage_changed', 'Atalho: E')}
        {quick(<MessageSquare size={14} />, 'Interação', 'interaction', 'Atalho: I')}
        {quick(<Send size={14} />, 'Follow-up enviado', 'follow_up_sent', 'Atalho: F')}
        {quick(<ThumbsUp size={14} />, 'Feedback', 'feedback_received')}
        {quick(<StickyNote size={14} />, 'Anotação', 'note')}
        {app.status === 'paused'
          ? quick(<Play size={14} />, 'Retomar', 'resumed')
          : app.status !== 'closed' && quick(<Pause size={14} />, 'Pausar', 'paused')}
        {app.status === 'closed'
          ? quick(<RotateCcw size={14} />, 'Reabrir', 'reopened')
          : quick(<X size={14} />, 'Encerrar', 'closed')}
        <span className="mx-1 w-px bg-border" />
        <Button
          size="sm"
          variant="ghost"
          icon={<Copy size={14} />}
          title="Nova candidatura na mesma empresa, copiando os dados da vaga"
          onClick={() =>
            void act(async () => {
              const r = await call('applications.duplicate', { id: app.id })
              navigate(`/candidaturas/${r.id}`)
            }, 'Candidatura duplicada')
          }
        >
          Duplicar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Redo2 size={14} />}
          title="Nova candidatura para a mesma vaga, ligada a esta"
          onClick={() =>
            void act(async () => {
              const r = await call('applications.reapply', { id: app.id })
              navigate(`/candidaturas/${r.id}`)
            }, 'Nova candidatura à mesma vaga registrada')
          }
        >
          Candidatar de novo
        </Button>
        {app.archivedAt ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<ArchiveRestore size={14} />}
            onClick={() => void act(() => call('applications.unarchive', { id: app.id }), 'Desarquivada')}
          >
            Desarquivar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={<Archive size={14} />}
            title="Esconde das listas, mas continua nas métricas e na busca"
            onClick={() =>
              void act(async () => {
                await call('applications.archive', { id: app.id })
                undo.offer('Candidatura arquivada', () => call('applications.unarchive', { id: app.id }))
              })
            }
          >
            Arquivar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 size={14} />}
          onClick={() =>
            void act(async () => {
              await call('applications.delete', { id: app.id })
              navigate('/candidaturas')
              undo.offer('Candidatura movida para a Lixeira', () =>
                call('applications.restore', { id: app.id })
              )
            })
          }
        >
          Excluir
        </Button>
      </div>
      {app.previousApplicationId && (
        <p className="mt-2 text-xs text-muted">
          Nova tentativa para a mesma vaga.{' '}
          <Link className="text-accent hover:underline" to={`/candidaturas/${app.previousApplicationId}`}>
            Ver candidatura anterior
          </Link>
        </p>
      )}
      {app.otherApplicationsAtCompany.some((o) => o.status !== 'closed') && (
        <p className="mt-2 text-xs text-muted">
          Outras candidaturas ativas nesta empresa:{' '}
          {app.otherApplicationsAtCompany
            .filter((o) => o.status !== 'closed')
            .map((o, i) => (
              <span key={o.id}>
                {i > 0 && ', '}
                <Link className="text-accent hover:underline" to={`/candidaturas/${o.id}`}>
                  {o.title}
                </Link>
              </span>
            ))}
        </p>
      )}
    </div>
  )
}

function Completeness({ app }: { app: ApplicationDetail }) {
  const pct = Math.round(app.completeness * 100)
  return (
    <div
      className="w-56 shrink-0 rounded-md border border-border bg-panel p-2.5 text-xs"
      title="Campos que alimentam as métricas"
    >
      <div className="flex justify-between">
        <span className="font-medium">Completude</span>
        <span>{pct}%</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded bg-subtle"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      {app.missingFields.length > 0 && (
        <p className="mt-1.5 text-muted">
          Falta: {app.missingFields.map((f) => label('missingField', f)).join(', ')}
        </p>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Timeline

function eventDescription(e: TimelineEventDto): string {
  const parts: string[] = []
  if (e.type === 'stage_changed' && e.stageName) parts.push(e.stageName)
  if (e.type === 'interaction')
    parts.push(
      [label('direction', e.direction), e.medium ? label('medium', e.medium) : null]
        .filter(Boolean)
        .join(' · ')
    )
  if (e.type === 'closed')
    parts.push([label('outcome', e.outcome), e.closeReason].filter((x) => x && x !== '—').join(' · '))
  if (e.payload?.sentiment) parts.push(label('sentiment', String(e.payload.sentiment)))
  if (e.payload?.expectedResumeAt)
    parts.push(`retomada prevista ${formatDate(String(e.payload.expectedResumeAt))}`)
  if (e.contactName) parts.push(e.contactName)
  return parts.filter(Boolean).join(' · ')
}

function Timeline({ events, app }: { events: TimelineEventDto[]; app: ApplicationDetail }) {
  const [editing, setEditing] = useState<TimelineEventDto | null>(null)
  const [voiding, setVoiding] = useState<TimelineEventDto | null>(null)
  if (events.length === 0) return <EmptyState title="Sem eventos" />
  return (
    <>
      <ol className="relative space-y-0 border-l border-border pl-5">
        {events.map((e) => (
          <li key={e.id} className={cn('group relative pb-4', e.voidedAt && 'opacity-50')}>
            <span
              className={cn(
                'absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg',
                e.direction === 'in' ? 'bg-success' : e.direction === 'out' ? 'bg-accent' : 'bg-muted'
              )}
            />
            <div className="flex items-baseline gap-2">
              <span className={cn('font-medium', e.voidedAt && 'line-through')}>
                {label('eventType', e.type)}
              </span>
              <span className="text-xs text-muted">{eventDescription(e)}</span>
              <span
                className="ml-auto text-xs tabular-nums text-muted"
                title={`Registrado em ${formatDateTime(e.recordedAt)}`}
              >
                {formatDateTime(e.occurredAt)}
              </span>
              {!e.voidedAt && e.type !== 'applied' && (
                <span className="invisible flex gap-1 group-hover:visible group-focus-within:visible">
                  <button
                    className="rounded p-0.5 text-muted hover:bg-subtle"
                    title="Corrigir"
                    onClick={() => setEditing(e)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="rounded p-0.5 text-muted hover:bg-subtle"
                    title="Anular (registrado por engano)"
                    onClick={() => setVoiding(e)}
                  >
                    <Ban size={13} />
                  </button>
                </span>
              )}
            </div>
            {e.summary && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{e.summary}</p>}
            {e.voidedAt && (
              <p className="mt-0.5 text-xs text-muted">
                Anulado em {formatDateTime(e.voidedAt)}: {e.voidReason}
              </p>
            )}
          </li>
        ))}
      </ol>
      <CorrectEventDialog event={editing} appliedAt={app.appliedAt} onClose={() => setEditing(null)} />
      <VoidEventDialog event={voiding} onClose={() => setVoiding(null)} />
    </>
  )
}

function CorrectEventDialog({
  event,
  onClose
}: {
  event: TimelineEventDto | null
  appliedAt: string
  onClose: () => void
}) {
  const [when, setWhen] = useState('')
  const [summary, setSummary] = useState('')
  const [allowBefore, setAllowBefore] = useState(false)
  const correct = useCamMutation('events.correct', { success: 'Evento corrigido' })
  useEffect(() => {
    if (event) {
      setWhen(toLocalInput(event.occurredAt))
      setSummary(event.summary ?? '')
      setAllowBefore(false)
    }
  }, [event])
  if (!event) return null
  return (
    <Modal
      open
      onClose={onClose}
      title={`Corrigir: ${label('eventType', event.type)}`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await correct.mutateAsync({
                id: event.id,
                occurredAt: fromLocalInput(when),
                summary,
                allowBeforeApplied: allowBefore
              })
              onClose()
            }}
          >
            Salvar correção
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted">
          A correção fica registrada no histórico de edições. A data de registro original é mantida.
        </p>
        <Field label="Quando aconteceu">
          <Input
            type="datetime-local"
            value={when}
            max={toLocalInput()}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>
        <Field label="Resumo">
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={allowBefore} onChange={(e) => setAllowBefore(e.target.checked)} />
          Permitir data anterior à candidatura
        </label>
      </div>
    </Modal>
  )
}

function VoidEventDialog({ event, onClose }: { event: TimelineEventDto | null; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const voidEvent = useCamMutation('events.void', { success: 'Evento anulado' })
  useEffect(() => setReason(''), [event])
  if (!event) return null
  return (
    <Modal
      open
      onClose={onClose}
      title="Anular evento"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={async () => {
              await voidEvent.mutateAsync({ id: event.id, reason })
              onClose()
            }}
          >
            Anular
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        O evento sai dos cálculos de status e métricas, mas continua visível, riscado, na linha do tempo.
      </p>
      <Field label="Motivo">
        <Input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: registrado na candidatura errada"
        />
      </Field>
    </Modal>
  )
}

// ------------------------------------------------------------------ Data tab

function DataTab({ app }: { app: ApplicationDetail }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ApplicationFormState>(formFromDetail(app))
  const [errors, setErrors] = useState<FormErrors>({})
  const update = useCamMutation('applications.update', { success: 'Alterações salvas' })
  useEffect(() => {
    if (!editing) setForm(formFromDetail(app))
  }, [app, editing])
  const set = (patch: Partial<ApplicationFormState>) => setForm((f) => ({ ...f, ...patch }))

  if (editing) {
    return (
      <form
        className="max-w-3xl"
        onSubmit={async (e) => {
          e.preventDefault()
          const { fields, errors: errs } = formToInput(form)
          if (!form.company.trim()) errs.company = 'Informe a empresa'
          setErrors(errs)
          if (Object.keys(errs).length) return
          await update.mutateAsync({
            id: app.id,
            patch: { ...fields, company: { name: form.company.trim() } }
          })
          setEditing(false)
        }}
      >
        <RequiredFields form={form} set={set} errors={errors} />
        <MoreFields form={form} set={set} errors={errors} />
        <div className="mt-4 flex gap-2">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            Salvar
          </Button>
          <Button onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
      </form>
    )
  }

  const row = (k: string, v: ReactNode) => (
    <div className="grid grid-cols-[200px_1fr] gap-3 border-b border-border py-1.5 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words">
        {v === null || v === undefined || v === '' ? '—' : v}
      </dd>
    </div>
  )
  const yesNo = (v: boolean | null) => (v === null ? null : v ? 'Sim' : 'Não')
  const range =
    app.postedSalaryMin !== null || app.postedSalaryMax !== null
      ? `${formatMoney(app.postedSalaryMin, app.postedCurrency)} – ${formatMoney(app.postedSalaryMax, app.postedCurrency)} ${label('period', app.postedPeriod)}`
      : null
  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex justify-end">
        <Button icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
          Editar dados
        </Button>
      </div>
      <dl className="rounded-lg border border-border bg-panel px-4 py-2 text-sm">
        {row('Empresa', app.companyName)}
        {row('Cargo', app.title)}
        {row('Data da candidatura', formatDateTime(app.appliedAt))}
        {row('Plataforma', app.platform)}
        {row('Canal', app.channel)}
        {row('URL da vaga', app.jobUrl)}
        {row('Senioridade', app.seniority && label('seniority', app.seniority))}
        {row('Área', app.area)}
        {row('Modalidade', app.workMode && label('workMode', app.workMode))}
        {row('Localização', [app.city, app.country].filter(Boolean).join(', '))}
        {row('Contratação', app.employmentType && label('employmentType', app.employmentType))}
        {row('Prioridade', label('priority', app.priority))}
        {row('Aderência pessoal', app.fitScore && label('fitScore', app.fitScore))}
        {row('Faixa divulgada', range)}
        {row(
          'Pretensão informada',
          app.expectedSalary !== null
            ? `${formatMoney(app.expectedSalary, app.expectedCurrency)} ${label('period', app.expectedPeriod)}`
            : null
        )}
        {row(
          'Competências',
          app.skills.length
            ? app.skills.map((s) => (
                <Badge key={s} className="mr-1">
                  {s}
                </Badge>
              ))
            : null
        )}
        {row('Requisitos obrigatórios', app.requirementsRequired)}
        {row('Requisitos desejáveis', app.requirementsDesired)}
        {row('Código (ATS)', app.externalRef)}
        {row('Prazo para resposta', app.responseDeadline && formatDate(app.responseDeadline))}
        {row('Idioma do processo', app.processLanguage && label('processLanguage', app.processLanguage))}
        {row('Exige visto', yesNo(app.needsVisa))}
        {row('Oferece realocação', yesNo(app.relocationOffered))}
        {row('Carta de apresentação', app.coverLetterText)}
        {row('Descrição da vaga', app.jobDescription)}
      </dl>
    </div>
  )
}

// ------------------------------------------------------------------ Contacts tab

function ContactsTab({ app }: { app: ApplicationDetail }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<ContactRole>('recruiter')
  const add = useCamMutation('applications.addContact', { success: 'Contato ligado' })
  const remove = useCamMutation('applications.removeContact')
  const { data: contacts } = useCam('contacts.list', {})
  return (
    <div className="max-w-2xl space-y-4">
      <form
        className="flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const existing = contacts?.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())
          await add.mutateAsync({
            applicationId: app.id,
            contact: existing ? { id: existing.id } : { name: name.trim() },
            role
          })
          setName('')
        }}
      >
        <Field label="Contato" hint="Nome de um contato existente ou novo" className="flex-1">
          <Input list="contacts-datalist" value={name} onChange={(e) => setName(e.target.value)} />
          <datalist id="contacts-datalist">
            {contacts?.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Papel">
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as ContactRole)}
            options={CONTACT_ROLES.map((r) => ({ value: r, label: label('contactRole', r) }))}
          />
        </Field>
        <Button type="submit" variant="primary">
          Ligar contato
        </Button>
      </form>
      {app.contacts.length === 0 ? (
        <EmptyState
          title="Nenhum contato ligado"
          description="Recrutadores, gestores, entrevistadores e quem indicou aparecem aqui."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-panel">
          {app.contacts.map((c) => (
            <li key={`${c.contactId}-${c.role}`} className="flex items-center gap-3 px-3 py-2">
              <Link to={`/contatos?id=${c.contactId}`} className="font-medium hover:underline">
                {c.name}
              </Link>
              <Badge>{label('contactRole', c.role)}</Badge>
              <span className="text-xs text-muted">{c.email}</span>
              <button
                className="ml-auto rounded p-1 text-muted hover:bg-subtle"
                title="Desligar contato"
                onClick={() => remove.mutate({ applicationId: app.id, contactId: c.contactId, role: c.role })}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Notes tab

function NotesTab({ appId, notes }: { appId: string; notes: NoteDto[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const current = notes.find((n) => n.id === selected) ?? notes[0]
  return (
    <div className="flex gap-4">
      <div className="w-64 shrink-0 space-y-2">
        <NewNoteButton owner={{ applicationId: appId }} onCreated={(n) => setSelected(n.id)} />
        <ul className="space-y-0.5">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                className={cn(
                  'w-full rounded px-2 py-1.5 text-left',
                  current?.id === n.id ? 'bg-subtle' : 'hover:bg-subtle'
                )}
                onClick={() => setSelected(n.id)}
              >
                <div className="truncate text-sm font-medium">{n.title}</div>
                <div className="text-xs text-muted">
                  {label('noteKind', n.kind)} · {formatDate(n.updatedAt)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 flex-1">
        {current ? (
          <NoteEditor note={current} onDeleted={() => setSelected(null)} />
        ) : (
          <EmptyState
            title="Sem notas"
            description="Use os modelos: preparação, debrief, informações do recrutador, negociação…"
          />
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Files tab

function FilesTab({ appId, attachments }: { appId: string; attachments: AttachmentDto[] }) {
  const toast = useToast()
  const invalidate = useInvalidateAll()
  const undo = useUndo()
  const [dragging, setDragging] = useState(false)
  const [kind, setKind] = useState<AttachmentKind>('other')
  const inputRef = useRef<HTMLInputElement>(null)
  const update = useCamMutation('attachments.update')

  const addPaths = useCallback(
    async (files: File[]) => {
      let added = 0
      for (const file of files) {
        try {
          const path = window.camBridge.pathForFile(file)
          if (path) await call('attachments.addFromPath', { applicationId: appId, path, kind })
          else {
            const bytes = new Uint8Array(await file.arrayBuffer())
            await call('attachments.addFromBytes', {
              applicationId: appId,
              name: file.name || 'arquivo',
              mime: file.type || 'application/octet-stream',
              bytes,
              kind
            })
          }
          added++
        } catch (e) {
          toast({ message: `${file.name}: ${errorMessage(e)}`, tone: 'error' })
        }
      }
      if (added) {
        invalidate()
        toast({ message: added === 1 ? 'Arquivo anexado' : `${added} arquivos anexados`, tone: 'success' })
      }
    },
    [appId, kind, invalidate, toast]
  )

  // Ctrl+V with an image (e.g. a print of the application) attaches it as proof.
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea')) return
      const items = [...(e.clipboardData?.items ?? [])].filter((i) => i.type.startsWith('image/'))
      if (items.length === 0) return
      e.preventDefault()
      for (const item of items) {
        const blob = item.getAsFile()
        if (!blob) continue
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        try {
          await call('attachments.addFromBytes', {
            applicationId: appId,
            name: `print-${stamp}.png`,
            mime: 'image/png',
            bytes,
            kind: 'application_proof'
          })
          invalidate()
          toast({ message: 'Print colado como comprovante', tone: 'success' })
        } catch (err) {
          toast({ message: errorMessage(err), tone: 'error' })
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [appId, invalidate, toast])

  return (
    <div className="max-w-3xl space-y-4">
      <div
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center text-sm',
          dragging ? 'border-accent bg-accent/5' : 'border-border'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void addPaths([...e.dataTransfer.files])
        }}
      >
        <FileUp size={20} className="text-muted" />
        <p>Arraste arquivos para cá, cole um print com Ctrl+V ou</p>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Tipo do anexo"
            className="w-56"
            value={kind}
            onChange={(e) => setKind(e.target.value as AttachmentKind)}
            options={ATTACHMENT_KINDS.map((k) => ({ value: k, label: label('attachmentKind', k) }))}
          />
          <Button onClick={() => inputRef.current?.click()}>Escolher arquivo</Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void addPaths([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </div>
        <p className="text-xs text-muted">O mesmo arquivo anexado várias vezes ocupa espaço uma vez só.</p>
      </div>
      {attachments.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-panel">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2">
              <button
                className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                onClick={() =>
                  void call('attachments.open', { id: a.id }).catch((e) =>
                    toast({ message: errorMessage(e), tone: 'error' })
                  )
                }
              >
                {a.originalName}
              </button>
              <Select
                aria-label="Tipo"
                className="w-48"
                value={a.kind}
                onChange={(e) => update.mutate({ id: a.id, kind: e.target.value as AttachmentKind })}
                options={ATTACHMENT_KINDS.map((k) => ({ value: k, label: label('attachmentKind', k) }))}
              />
              <span className="w-20 text-right text-xs text-muted">{formatBytes(a.sizeBytes)}</span>
              <span className="w-24 text-right text-xs text-muted">{formatDate(a.createdAt)}</span>
              <button
                className="rounded p-1 text-muted hover:bg-subtle"
                title="Mover para a Lixeira"
                onClick={async () => {
                  await call('attachments.delete', { id: a.id })
                  invalidate()
                  undo.offer('Anexo movido para a Lixeira', () => call('attachments.restore', { id: a.id }))
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ History tab

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function HistoryTab({ appId }: { appId: string }) {
  const { data } = useCam('applications.history', { id: appId })
  if (!data) return <Spinner />
  return (
    <ul className="max-w-3xl space-y-2">
      {data.map((h) => (
        <li key={h.id} className="rounded-lg border border-border bg-panel px-3 py-2 text-sm">
          <div className="flex gap-2">
            <span className="font-medium">
              {label('entityType', h.entityType)} · {label('auditAction', h.action)}
            </span>
            <span className="ml-auto text-xs text-muted">{formatDateTime(h.at)}</span>
          </div>
          {h.changes && (
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {Object.entries(h.changes).map(([field, [before, after]]) => (
                <li key={field}>
                  <span className="text-fg">{labelField(field)}</span>: {formatValue(before)} →{' '}
                  {formatValue(after)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

const labelField = (f: string) => (label('field', f) === f ? f : label('field', f))
