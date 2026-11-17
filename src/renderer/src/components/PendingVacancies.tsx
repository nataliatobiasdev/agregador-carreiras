import { BriefcaseBusiness, Check, ChevronDown, ExternalLink, MapPin, RefreshCw } from 'lucide-react'
import type { ChannelOutput } from '@shared/contracts'
import { formatDate } from '../lib/format'
import { Badge, Button } from './ui'

type PendingJob = ChannelOutput<'vagas1000.list'>[number]
type RecordData = Record<string, unknown>

function object(value: unknown): RecordData {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordData) : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** The source may contain HTML. Render it as text, never as trusted markup. */
function plainText(value: unknown): string {
  const valueText = text(value)
  if (!valueText) return ''
  const html = valueText.replace(/<\s*br\s*\/?>|<\s*\/\s*(?:p|div|li|h[1-6])\s*>/gi, '\n')
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extract(details: string) {
  try {
    const data = object(JSON.parse(details))
    const job = object(data.vaga)
    const record = object(data.registro)
    const sections = Array.isArray(record.sections) ? record.sections : []
    const description = plainText(record.description || record.description_html)
    const location = text(job.location)
    const workMode = (
      { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' } as Record<string, string>
    )[text(job.workplace).toLowerCase()]
    const technologies = Array.isArray(job.techs) ? job.techs.map(text).filter(Boolean) : []
    return { job, record, description, location, workMode, technologies, sections }
  } catch {
    return {
      job: {},
      record: {},
      description: '',
      location: '',
      workMode: '',
      technologies: [],
      sections: []
    }
  }
}

function PendingCard({
  job,
  busy,
  onApply
}: {
  job: PendingJob
  busy: boolean
  onApply: (key: string) => void
}) {
  const data = extract(job.details)
  const salary = text(data.job.salary)
  return (
    <li className="surface overflow-hidden rounded-lg border border-border bg-panel">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 font-heading text-sm font-bold text-accent"
          aria-hidden
        >
          {job.company.trim().charAt(0).toLocaleUpperCase('pt-BR') || <BriefcaseBusiness size={17} />}
        </div>
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">{job.company}</span>
            <Badge tone="secondary" dot>
              Para candidatar
            </Badge>
          </div>
          <h3 className="mt-1 break-words font-heading text-sm font-semibold text-fg">{job.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {data.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} aria-hidden />
                {data.location}
              </span>
            )}
            {data.workMode && <span>{data.workMode}</span>}
            {salary && <span>{salary}</span>}
            <span>Adicionada em {formatDate(job.addedAt)}</span>
          </div>
          {data.technologies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.technologies.map((tech) => (
                <Badge key={tech}>{tech}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/^https?:\/\//i.test(job.url) && (
            <a
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              href={job.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} aria-hidden />
              Abrir vaga
            </a>
          )}
          <Button
            variant="secondary"
            icon={<Check size={14} aria-hidden />}
            disabled={busy}
            onClick={() => onApply(job.key)}
          >
            Já me candidatei
          </Button>
        </div>
      </div>
      <details className="group border-t border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          Detalhes da vaga{' '}
          <ChevronDown size={15} aria-hidden className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4 text-sm">
          {data.description ? (
            <section>
              <h4 className="mb-2 font-heading font-semibold">Descrição</h4>
              <p className="whitespace-pre-wrap break-words leading-relaxed text-muted">{data.description}</p>
            </section>
          ) : (
            <p className="text-muted">A descrição não estava disponível na vaga recebida.</p>
          )}
          {data.sections.map((item, index) => {
            const section = object(item)
            const body = plainText(section.html || section.text)
            return body ? (
              <section key={index}>
                <h4 className="mb-2 font-heading font-semibold">
                  {text(section.title) || 'Informações adicionais'}
                </h4>
                <p className="whitespace-pre-wrap break-words leading-relaxed text-muted">{body}</p>
              </section>
            ) : null
          })}
          <details className="rounded-md border border-border bg-field">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted hover:text-fg">
              Ver registro completo
            </summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all border-t border-border p-3 font-mono text-xs text-muted">
              {job.details}
            </pre>
          </details>
        </div>
      </details>
    </li>
  )
}

export function PendingVacancies({
  jobs,
  busy,
  onApply,
  onRefresh
}: {
  jobs: PendingJob[]
  busy: boolean
  onApply: (key: string) => void
  onRefresh: () => void
}) {
  return (
    <section className="border-b border-border px-6 py-5" aria-labelledby="pending-vacancies-title">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="pending-vacancies-title" className="font-heading text-base font-semibold">
              Vagas para candidatar-se
            </h2>
            <Badge tone="secondary">{jobs.length}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">Salvas do vagas1000 para você acompanhar.</p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={13} aria-hidden />} onClick={onRefresh}>
          Atualizar
        </Button>
      </div>
      <ul className="space-y-3">
        {jobs.map((job) => (
          <PendingCard key={job.key} job={job} busy={busy} onApply={onApply} />
        ))}
      </ul>
    </section>
  )
}
