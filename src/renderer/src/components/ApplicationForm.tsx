import { useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ApplicationDetail } from '@shared/dto'
import type { CreateApplicationInput } from '@shared/contracts'
import { call } from '../lib/api'
import {
  centsToInput,
  fromLocalDateInput,
  fromLocalInput,
  parseMoneyToCents,
  toLocalDateInput,
  toLocalInput
} from '../lib/format'
import { useCam } from '../lib/hooks'
import { options } from '../i18n/pt-BR'
import { Field, Input, Select, Textarea } from './ui'

/** All form values are kept as strings while editing and converted on save. */
export interface ApplicationFormState {
  company: string
  title: string
  appliedAt: string
  platform: string
  jobUrl: string
  seniority: string
  area: string
  workMode: string
  city: string
  country: string
  employmentType: string
  priority: string
  fitScore: string
  recruiter: string
  initialNote: string
  postedSalaryMin: string
  postedSalaryMax: string
  postedCurrency: string
  postedPeriod: string
  expectedSalary: string
  expectedCurrency: string
  expectedPeriod: string
  skills: string
  requirementsRequired: string
  requirementsDesired: string
  jobDescription: string
  externalRef: string
  responseDeadline: string
  processLanguage: string
  needsVisa: string
  relocationOffered: string
  coverLetterText: string
  channel: string
}

export function emptyForm(platform = ''): ApplicationFormState {
  return {
    company: '',
    title: '',
    appliedAt: toLocalInput(new Date()),
    platform,
    jobUrl: '',
    seniority: '',
    area: '',
    workMode: '',
    city: '',
    country: '',
    employmentType: '',
    priority: 'medium',
    fitScore: '',
    recruiter: '',
    initialNote: '',
    postedSalaryMin: '',
    postedSalaryMax: '',
    postedCurrency: 'BRL',
    postedPeriod: 'month',
    expectedSalary: '',
    expectedCurrency: 'BRL',
    expectedPeriod: 'month',
    skills: '',
    requirementsRequired: '',
    requirementsDesired: '',
    jobDescription: '',
    externalRef: '',
    responseDeadline: '',
    processLanguage: '',
    needsVisa: '',
    relocationOffered: '',
    coverLetterText: '',
    channel: ''
  }
}

export function formFromDetail(a: ApplicationDetail): ApplicationFormState {
  const s = (v: string | null | undefined) => v ?? ''
  const b = (v: boolean | null) => (v === null ? '' : v ? 'yes' : 'no')
  return {
    company: a.companyName,
    title: a.title,
    appliedAt: toLocalInput(a.appliedAt),
    platform: a.platform,
    jobUrl: s(a.jobUrl),
    seniority: s(a.seniority),
    area: s(a.area),
    workMode: s(a.workMode),
    city: s(a.city),
    country: s(a.country),
    employmentType: s(a.employmentType),
    priority: a.priority,
    fitScore: a.fitScore ? String(a.fitScore) : '',
    recruiter: '',
    initialNote: '',
    postedSalaryMin: centsToInput(a.postedSalaryMin),
    postedSalaryMax: centsToInput(a.postedSalaryMax),
    postedCurrency: a.postedCurrency ?? 'BRL',
    postedPeriod: a.postedPeriod ?? 'month',
    expectedSalary: centsToInput(a.expectedSalary),
    expectedCurrency: a.expectedCurrency ?? 'BRL',
    expectedPeriod: a.expectedPeriod ?? 'month',
    skills: a.skills.join(', '),
    requirementsRequired: s(a.requirementsRequired),
    requirementsDesired: s(a.requirementsDesired),
    jobDescription: s(a.jobDescription),
    externalRef: s(a.externalRef),
    responseDeadline: toLocalDateInput(a.responseDeadline),
    processLanguage: s(a.processLanguage),
    needsVisa: b(a.needsVisa),
    relocationOffered: b(a.relocationOffered),
    coverLetterText: s(a.coverLetterText),
    channel: s(a.channel)
  }
}

export type FormErrors = Partial<Record<keyof ApplicationFormState, string>>

type Fields = Omit<CreateApplicationInput, 'company' | 'recruiter' | 'initialNote' | 'previousApplicationId'>

/** Converts the form into service input; returns field errors when something cannot be parsed. */
export function formToInput(f: ApplicationFormState): { fields: Fields; errors: FormErrors } {
  const errors: FormErrors = {}
  const money = (key: keyof ApplicationFormState): number | null => {
    const v = parseMoneyToCents(f[key])
    if (Number.isNaN(v)) {
      errors[key] = 'Valor inválido'
      return null
    }
    return v
  }
  const nul = (v: string) => (v.trim() === '' ? null : v.trim())
  const bool = (v: string) => (v === 'yes' ? true : v === 'no' ? false : null)
  if (!f.title.trim()) errors.title = 'Informe o cargo'
  if (!f.platform.trim()) errors.platform = 'Informe a plataforma'
  if (!f.appliedAt) errors.appliedAt = 'Informe a data'
  if (f.jobUrl.trim() && !/^https?:\/\//i.test(f.jobUrl.trim())) errors.jobUrl = 'Use um link http(s)'
  const postedSalaryMin = money('postedSalaryMin')
  const postedSalaryMax = money('postedSalaryMax')
  const expectedSalary = money('expectedSalary')
  if (postedSalaryMin !== null && postedSalaryMax !== null && postedSalaryMin > postedSalaryMax)
    errors.postedSalaryMax = 'Máximo menor que o mínimo'
  const hasPosted = postedSalaryMin !== null || postedSalaryMax !== null
  const fields: Fields = {
    title: f.title.trim(),
    appliedAt: f.appliedAt ? fromLocalInput(f.appliedAt) : new Date().toISOString(),
    platform: f.platform,
    channel: nul(f.channel),
    jobUrl: nul(f.jobUrl),
    seniority: (nul(f.seniority) as Fields['seniority']) ?? null,
    area: nul(f.area),
    workMode: (nul(f.workMode) as Fields['workMode']) ?? null,
    city: nul(f.city),
    country: nul(f.country),
    employmentType: (nul(f.employmentType) as Fields['employmentType']) ?? null,
    priority: (f.priority || 'medium') as Fields['priority'],
    fitScore: f.fitScore ? Number(f.fitScore) : null,
    postedSalaryMin,
    postedSalaryMax,
    postedCurrency: hasPosted ? f.postedCurrency.toUpperCase() : null,
    postedPeriod: hasPosted ? (f.postedPeriod as Fields['postedPeriod']) : null,
    expectedSalary,
    expectedCurrency: expectedSalary !== null ? f.expectedCurrency.toUpperCase() : null,
    expectedPeriod: expectedSalary !== null ? (f.expectedPeriod as Fields['expectedPeriod']) : null,
    jobDescription: nul(f.jobDescription),
    requirementsRequired: nul(f.requirementsRequired),
    requirementsDesired: nul(f.requirementsDesired),
    externalRef: nul(f.externalRef),
    processLanguage: (nul(f.processLanguage) as Fields['processLanguage']) ?? null,
    needsVisa: bool(f.needsVisa),
    relocationOffered: bool(f.relocationOffered),
    coverLetterText: nul(f.coverLetterText),
    responseDeadline: fromLocalDateInput(f.responseDeadline),
    skills: f.skills
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return { fields, errors }
}

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CAD'].map((c) => ({ value: c, label: c }))
const YES_NO = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' }
]

export function RequiredFields({
  form,
  set,
  errors,
  autoFocus
}: {
  form: ApplicationFormState
  set: (patch: Partial<ApplicationFormState>) => void
  errors: FormErrors
  autoFocus?: boolean
}) {
  const ids = useId()
  const { data: companies } = useCam('companies.suggest', { text: form.company })
  const { data: titles } = useCam('applications.titles')
  const { data: platforms } = useCam('lists.items', { listKey: 'platform' })
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Empresa *" error={errors.company} htmlFor={`${ids}-company`}>
        <Input
          id={`${ids}-company`}
          autoFocus={autoFocus}
          list={`${ids}-companies`}
          value={form.company}
          onChange={(e) => set({ company: e.target.value })}
          placeholder="Digite para buscar ou criar"
          autoComplete="off"
        />
        <datalist id={`${ids}-companies`}>
          {companies?.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Cargo *" error={errors.title} htmlFor={`${ids}-title`}>
        <Input
          id={`${ids}-title`}
          list={`${ids}-titles`}
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          autoComplete="off"
        />
        <datalist id={`${ids}-titles`}>
          {titles?.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field label="Data e hora da candidatura *" error={errors.appliedAt} htmlFor={`${ids}-date`}>
        <Input
          id={`${ids}-date`}
          type="datetime-local"
          value={form.appliedAt}
          max={toLocalInput(new Date())}
          onChange={(e) => set({ appliedAt: e.target.value })}
        />
      </Field>
      <Field label="Plataforma *" error={errors.platform} htmlFor={`${ids}-platform`}>
        <Select
          id={`${ids}-platform`}
          value={form.platform}
          onChange={(e) => set({ platform: e.target.value })}
          placeholder="Escolha…"
          options={(platforms ?? []).map((p) => ({ value: p.value, label: p.label }))}
        />
      </Field>
    </div>
  )
}

export function MoreFields({
  form,
  set,
  errors,
  showCreateOnly
}: {
  form: ApplicationFormState
  set: (patch: Partial<ApplicationFormState>) => void
  errors: FormErrors
  showCreateOnly?: boolean
}) {
  const [advanced, setAdvanced] = useState(false)
  const { data: areas } = useCam('lists.items', { listKey: 'area' })
  const { data: platformSuggestion } = useCam(
    'applications.suggestPlatform',
    { url: form.jobUrl },
    { enabled: /^https?:\/\//.test(form.jobUrl) }
  )
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="URL da vaga"
          error={errors.jobUrl}
          hint={
            platformSuggestion && platformSuggestion !== form.platform
              ? `Parece ser ${platformSuggestion}. Clique para usar.`
              : undefined
          }
          className="col-span-2"
        >
          <Input
            value={form.jobUrl}
            onChange={(e) => set({ jobUrl: e.target.value })}
            placeholder="https://"
            onBlur={async () => {
              if (!form.platform && /^https?:\/\//.test(form.jobUrl)) {
                const p = await call('applications.suggestPlatform', { url: form.jobUrl })
                if (p) set({ platform: p })
              }
            }}
          />
        </Field>
        {platformSuggestion && platformSuggestion !== form.platform && (
          <button
            type="button"
            className="col-span-2 -mt-2 text-left text-xs text-accent hover:underline"
            onClick={() => set({ platform: platformSuggestion })}
          >
            Usar plataforma sugerida
          </button>
        )}
        <Field label="Senioridade">
          <Select
            value={form.seniority}
            onChange={(e) => set({ seniority: e.target.value })}
            placeholder="—"
            options={options('seniority')}
          />
        </Field>
        <Field label="Área de atuação">
          <Select
            value={form.area}
            onChange={(e) => set({ area: e.target.value })}
            placeholder="—"
            options={(areas ?? []).map((a) => ({ value: a.value, label: a.label }))}
          />
        </Field>
        <Field label="Modalidade">
          <Select
            value={form.workMode}
            onChange={(e) => set({ workMode: e.target.value })}
            placeholder="—"
            options={options('workMode')}
          />
        </Field>
        <Field label="Tipo de contratação">
          <Select
            value={form.employmentType}
            onChange={(e) => set({ employmentType: e.target.value })}
            placeholder="—"
            options={options('employmentType')}
          />
        </Field>
        <Field label="Cidade">
          <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="País">
          <Input
            value={form.country}
            onChange={(e) => set({ country: e.target.value })}
            placeholder="Brasil"
          />
        </Field>
        <Field label="Prioridade">
          <Select
            value={form.priority}
            onChange={(e) => set({ priority: e.target.value })}
            options={options('priority')}
          />
        </Field>
        <Field label="Aderência pessoal">
          <Select
            value={form.fitScore}
            onChange={(e) => set({ fitScore: e.target.value })}
            placeholder="—"
            options={options('fitScore')}
          />
        </Field>
        {showCreateOnly && (
          <>
            <Field
              label="Contato do recrutador"
              hint="Cria o contato se ainda não existir"
              className="col-span-2"
            >
              <Input
                value={form.recruiter}
                onChange={(e) => set({ recruiter: e.target.value })}
                placeholder="Nome"
              />
            </Field>
            <Field label="Nota inicial" className="col-span-2">
              <Textarea value={form.initialNote} onChange={(e) => set({ initialNote: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-muted hover:text-fg"
        onClick={() => setAdvanced((v) => !v)}
        aria-expanded={advanced}
      >
        {advanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Avançado
      </button>
      {advanced && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Faixa salarial divulgada: mínimo" error={errors.postedSalaryMin}>
            <Input
              inputMode="decimal"
              value={form.postedSalaryMin}
              onChange={(e) => set({ postedSalaryMin: e.target.value })}
              placeholder="12.000,00"
            />
          </Field>
          <Field label="Máximo" error={errors.postedSalaryMax}>
            <Input
              inputMode="decimal"
              value={form.postedSalaryMax}
              onChange={(e) => set({ postedSalaryMax: e.target.value })}
            />
          </Field>
          <Field label="Moeda da faixa">
            <Select
              value={form.postedCurrency}
              onChange={(e) => set({ postedCurrency: e.target.value })}
              options={CURRENCIES}
            />
          </Field>
          <Field label="Período da faixa">
            <Select
              value={form.postedPeriod}
              onChange={(e) => set({ postedPeriod: e.target.value })}
              options={options('period')}
            />
          </Field>
          <Field label="Pretensão salarial informada" error={errors.expectedSalary}>
            <Input
              inputMode="decimal"
              value={form.expectedSalary}
              onChange={(e) => set({ expectedSalary: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Moeda">
              <Select
                value={form.expectedCurrency}
                onChange={(e) => set({ expectedCurrency: e.target.value })}
                options={CURRENCIES}
              />
            </Field>
            <Field label="Período">
              <Select
                value={form.expectedPeriod}
                onChange={(e) => set({ expectedPeriod: e.target.value })}
                options={options('period')}
              />
            </Field>
          </div>
          <Field label="Tecnologias e competências" hint="Separe por vírgula" className="col-span-2">
            <Input
              value={form.skills}
              onChange={(e) => set({ skills: e.target.value })}
              placeholder="TypeScript, AWS, liderança"
            />
          </Field>
          <Field label="Requisitos obrigatórios" className="col-span-2">
            <Textarea
              value={form.requirementsRequired}
              onChange={(e) => set({ requirementsRequired: e.target.value })}
            />
          </Field>
          <Field label="Requisitos desejáveis" className="col-span-2">
            <Textarea
              value={form.requirementsDesired}
              onChange={(e) => set({ requirementsDesired: e.target.value })}
            />
          </Field>
          <Field
            label="Descrição da vaga"
            hint="Recomendado: anúncios saem do ar. O texto entra na busca."
            className="col-span-2"
          >
            <Textarea
              className="min-h-[140px]"
              value={form.jobDescription}
              onChange={(e) => set({ jobDescription: e.target.value })}
            />
          </Field>
          <Field label="Código da candidatura (ATS)">
            <Input value={form.externalRef} onChange={(e) => set({ externalRef: e.target.value })} />
          </Field>
          <Field label="Prazo para resposta">
            <Input
              type="date"
              value={form.responseDeadline}
              onChange={(e) => set({ responseDeadline: e.target.value })}
            />
          </Field>
          <Field label="Idioma do processo">
            <Select
              value={form.processLanguage}
              onChange={(e) => set({ processLanguage: e.target.value })}
              placeholder="—"
              options={options('processLanguage')}
            />
          </Field>
          <Field label="Canal">
            <Input
              value={form.channel}
              onChange={(e) => set({ channel: e.target.value })}
              placeholder="Ex.: indicação de ex-colega"
            />
          </Field>
          <Field label="Exige patrocínio de visto?">
            <Select
              value={form.needsVisa}
              onChange={(e) => set({ needsVisa: e.target.value })}
              placeholder="—"
              options={YES_NO}
            />
          </Field>
          <Field label="Oferece realocação?">
            <Select
              value={form.relocationOffered}
              onChange={(e) => set({ relocationOffered: e.target.value })}
              placeholder="—"
              options={YES_NO}
            />
          </Field>
          <Field label="Carta de apresentação (texto)" className="col-span-2">
            <Textarea
              value={form.coverLetterText}
              onChange={(e) => set({ coverLetterText: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  )
}
