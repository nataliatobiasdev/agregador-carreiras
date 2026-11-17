import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, Plus, Table2 } from 'lucide-react'
import { APPLICATION_STATUSES, type ApplicationStatus } from '@shared/enums'
import type { ApplicationFilter } from '@shared/contracts'
import type { ApplicationListItem } from '@shared/dto'
import {
  Badge,
  Button,
  cn,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
  statusTone
} from '../components/ui'
import { formatDate, relativeDays } from '../lib/format'
import { useCam, useCamMutation } from '../lib/hooks'
import { label } from '../i18n/pt-BR'
import { PendingVacancies } from '../components/PendingVacancies'

type View = 'table' | 'list'

export function StatusBadge({ status, outcome }: { status: string; outcome?: string | null }) {
  return (
    <Badge tone={statusTone(status)} dot>
      {label('status', status)}
      {status === 'closed' && outcome ? ` · ${label('outcome', outcome)}` : ''}
    </Badge>
  )
}

export function ApplicationsPage({ onNew }: { onNew: () => void }) {
  const navigate = useNavigate()
  const { data: savedView } = useCam('settings.get', { key: 'ui.applicationsView' })
  const saveView = useCamMutation('settings.set', { silentError: true })
  const view: View = (savedView as View | null) ?? 'table'
  const [statuses, setStatuses] = useState<ApplicationStatus[]>([])
  const [companyId, setCompanyId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [text, setText] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)

  const filter: ApplicationFilter = useMemo(
    () => ({
      statuses: statuses.length ? statuses : undefined,
      companyId: companyId || undefined,
      appliedFrom: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      appliedTo: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      text: text || undefined,
      includeArchived: includeArchived || undefined
    }),
    [statuses, companyId, from, to, text, includeArchived]
  )
  const { data: apps, isLoading } = useCam('applications.list', filter)
  const { data: companies } = useCam('companies.list')
  const pending = useCam('vagas1000.list', undefined, { refetchInterval: 5000 })
  const markApplied = useCamMutation('vagas1000.markApplied', { success: 'Candidatura registrada' })
  const filtered = statuses.length > 0 || companyId || from || to || text || includeArchived

  const toggleStatus = (s: ApplicationStatus) =>
    setStatuses((all) => (all.includes(s) ? all.filter((x) => x !== s) : [...all, s]))

  return (
    <div>
      <PageHeader
        title="Candidaturas"
        subtitle={apps ? `${apps.length} ${apps.length === 1 ? 'candidatura' : 'candidaturas'}` : undefined}
        actions={
          <>
            <div className="flex rounded-md border border-border" role="group" aria-label="Visualização">
              <button
                className={cn('flex items-center gap-1 px-2 py-1 text-xs', view === 'table' && 'bg-subtle')}
                aria-pressed={view === 'table'}
                onClick={() => saveView.mutate({ key: 'ui.applicationsView', value: 'table' })}
              >
                <Table2 size={14} /> Tabela
              </button>
              <button
                className={cn(
                  'flex items-center gap-1 border-l border-border px-2 py-1 text-xs',
                  view === 'list' && 'bg-subtle'
                )}
                aria-pressed={view === 'list'}
                onClick={() => saveView.mutate({ key: 'ui.applicationsView', value: 'list' })}
              >
                <List size={14} /> Lista
              </button>
            </div>
            <Button variant="primary" icon={<Plus size={14} />} onClick={onNew}>
              Nova candidatura
            </Button>
          </>
        }
      />
      {pending.isError && (
        <div role="alert" className="border-b border-border px-6 py-3 text-sm text-danger">
          Não foi possível carregar as vagas adicionadas pelo vagas1000.{' '}
          <Button variant="ghost" size="sm" onClick={() => void pending.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!!pending.data?.length && (
        <PendingVacancies
          jobs={pending.data}
          busy={markApplied.isPending}
          onRefresh={() => void pending.refetch()}
          onApply={(key) =>
            void markApplied.mutateAsync({ key }).then((r) => navigate(`/candidaturas/${r.id}`))
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-2.5">
        <Input
          className="w-56"
          placeholder="Filtrar por cargo ou empresa"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-1" role="group" aria-label="Status">
          {APPLICATION_STATUSES.map((s) => (
            <button
              key={s}
              aria-pressed={statuses.includes(s)}
              onClick={() => toggleStatus(s)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs',
                statuses.includes(s)
                  ? 'border-accent bg-accent/10 text-fg'
                  : 'border-border text-muted hover:text-fg'
              )}
            >
              {label('status', s)}
            </button>
          ))}
        </div>
        <Select
          className="w-48"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          placeholder="Todas as empresas"
          options={(companies ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <label className="flex items-center gap-1 text-xs text-muted">
          De <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          até <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />{' '}
          Mostrar arquivadas
        </label>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setStatuses([])
              setCompanyId('')
              setFrom('')
              setTo('')
              setText('')
              setIncludeArchived(false)
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <Spinner />
        ) : !apps || apps.length === 0 ? (
          filtered ? (
            <EmptyState title="Nenhuma candidatura com esses filtros" />
          ) : (
            <EmptyState
              title="Nenhuma candidatura registrada ainda"
              description={
                pending.data?.length
                  ? 'Depois de se candidatar a uma vaga salva, selecione “Já me candidatei” para acompanhar o processo aqui.'
                  : 'Cada candidatura que você fizer entra aqui. Com 4 campos (empresa, cargo, data e plataforma) o registro leva segundos.'
              }
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={onNew}>
                  Registrar a primeira
                </Button>
              }
            />
          )
        ) : view === 'table' ? (
          <ApplicationsTable apps={apps} onOpen={(id) => navigate(`/candidaturas/${id}`)} />
        ) : (
          <ApplicationsList apps={apps} onOpen={(id) => navigate(`/candidaturas/${id}`)} />
        )}
      </div>
    </div>
  )
}

type SortKey = 'appliedAt' | 'companyName' | 'title' | 'lastActivityAt' | 'status'

function ApplicationsTable({ apps, onOpen }: { apps: ApplicationListItem[]; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'appliedAt', dir: -1 })
  const sorted = useMemo(
    () =>
      [...apps].sort((a, b) => {
        const x = a[sort.key] ?? ''
        const y = b[sort.key] ?? ''
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
      }),
    [apps, sort]
  )
  const th = (key: SortKey, text: string) => (
    <th scope="col" className="px-3 py-2 text-left font-medium">
      <button
        className="uppercase tracking-wide hover:text-fg"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}
        aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
      >
        {text} {sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
      </button>
    </th>
  )
  return (
    <div className="surface overflow-hidden rounded-lg border border-border bg-panel">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-fg/[0.03] font-mono text-[11px] uppercase tracking-wide text-muted">
          <tr>
            {th('companyName', 'Empresa')}
            {th('title', 'Cargo')}
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Etapa
            </th>
            {th('status', 'Status')}
            {th('appliedAt', 'Aplicada em')}
            {th('lastActivityAt', 'Última atividade')}
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Plataforma
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr
              key={a.id}
              tabIndex={0}
              className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-subtle focus:bg-subtle"
              onClick={() => onOpen(a.id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(a.id)}
            >
              <td className="px-3 py-2 font-medium">{a.companyName}</td>
              <td className="px-3 py-2">
                {a.title}
                {a.archivedAt && <Badge className="ml-2">Arquivada</Badge>}
              </td>
              <td className="px-3 py-2 text-muted">{a.stageName ?? '—'}</td>
              <td className="px-3 py-2">
                <StatusBadge status={a.status} outcome={a.outcome} />
              </td>
              <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted">
                {formatDate(a.appliedAt)}
              </td>
              <td className="px-3 py-2 text-muted">{relativeDays(a.lastActivityAt)}</td>
              <td className="px-3 py-2 text-muted">{a.platform}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ApplicationsList({ apps, onOpen }: { apps: ApplicationListItem[]; onOpen: (id: string) => void }) {
  const groups = APPLICATION_STATUSES.map((s) => ({
    status: s,
    items: apps.filter((a) => a.status === s)
  })).filter((g) => g.items.length > 0)
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.status}>
          <h2 className="mb-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-muted">
            {label('status', g.status)} · {g.items.length}
          </h2>
          <ul className="surface divide-y divide-border rounded-lg border border-border bg-panel">
            {g.items.map((a) => (
              <li key={a.id}>
                <button
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                  onClick={() => onOpen(a.id)}
                >
                  <span className="w-40 shrink-0 truncate font-medium">{a.companyName}</span>
                  <span className="min-w-0 flex-1 truncate">{a.title}</span>
                  <span className="text-xs text-muted">{a.stageName}</span>
                  <span className="w-24 text-right text-xs text-muted">{relativeDays(a.lastActivityAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
