import { useEffect, useState } from 'react'
import type { ApplicationDetail } from '@shared/dto'
import { MEDIUMS, OUTCOMES, type ManualEventType } from '@shared/enums'
import { ApiError } from '../lib/api'
import { fromLocalInput, toLocalInput } from '../lib/format'
import { useCam, useCamMutation } from '../lib/hooks'
import { label, options } from '../i18n/pt-BR'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'

const TITLES: Record<ManualEventType, string> = {
  stage_changed: 'Mudar etapa',
  interaction: 'Registrar interação',
  follow_up_sent: 'Registrar follow-up enviado',
  feedback_received: 'Registrar feedback',
  paused: 'Pausar processo',
  resumed: 'Retomar processo',
  closed: 'Encerrar processo',
  reopened: 'Reabrir processo',
  note: 'Anotação rápida na linha do tempo'
}

/** Short dialog to record what happened: date (default now), type fields and an optional note. */
export function EventDialog({
  app,
  type,
  onClose
}: {
  app: ApplicationDetail
  type: ManualEventType | null
  onClose: () => void
}) {
  const [occurredAt, setOccurredAt] = useState(toLocalInput())
  const [stageId, setStageId] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [medium, setMedium] = useState('')
  const [contactId, setContactId] = useState('')
  const [summary, setSummary] = useState('')
  const [outcome, setOutcome] = useState('')
  const [closeReason, setCloseReason] = useState('')
  const [sentiment, setSentiment] = useState('')
  const [expectedResumeAt, setExpectedResumeAt] = useState('')
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: stages } = useCam('stages.list')
  const { data: reasons } = useCam('lists.items', { listKey: 'close_reason' })
  const record = useCamMutation('events.record', {
    silentError: true,
    success: 'Registrado na linha do tempo'
  })

  useEffect(() => {
    if (!type) return
    setOccurredAt(toLocalInput())
    setStageId('')
    setDirection(type === 'interaction' ? 'in' : 'out')
    setMedium('')
    setContactId('')
    setSummary('')
    setOutcome('')
    setCloseReason('')
    setSentiment('')
    setExpectedResumeAt('')
    setNeedsConfirm(false)
    setError(null)
  }, [type])

  if (!type) return null

  const submit = async (allowBeforeApplied = false) => {
    setError(null)
    try {
      await record.mutateAsync({
        applicationId: app.id,
        type,
        occurredAt: fromLocalInput(occurredAt),
        stageId: stageId || null,
        direction: type === 'interaction' ? direction : null,
        medium: (medium || null) as (typeof MEDIUMS)[number] | null,
        contactId: contactId || null,
        summary: summary || null,
        outcome: (outcome || null) as (typeof OUTCOMES)[number] | null,
        closeReason: closeReason || null,
        sentiment: (sentiment || null) as 'positive' | 'neutral' | 'negative' | null,
        expectedResumeAt: expectedResumeAt ? new Date(`${expectedResumeAt}T12:00:00`).toISOString() : null,
        allowBeforeApplied
      })
      onClose()
    } catch (e) {
      if (
        e instanceof ApiError &&
        (e.payload.details as { needsConfirmation?: string } | undefined)?.needsConfirmation
      ) {
        setNeedsConfirm(true)
      }
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const contactOptions = app.contacts.map((c) => ({
    value: c.contactId,
    label: `${c.name} (${label('contactRole', c.role)})`
  }))

  return (
    <Modal
      open
      onClose={onClose}
      title={TITLES[type]}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          {needsConfirm ? (
            <Button variant="primary" onClick={() => void submit(true)}>
              Registrar mesmo assim
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void submit()} disabled={record.isPending}>
              Registrar
            </Button>
          )}
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(needsConfirm)
        }}
      >
        <Field label="Quando aconteceu" hint="Padrão: agora. Pode registrar algo que aconteceu antes.">
          <Input
            type="datetime-local"
            value={occurredAt}
            max={toLocalInput()}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>
        {type === 'stage_changed' && (
          <Field label="Nova etapa">
            <Select
              autoFocus
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              placeholder="Escolha…"
              options={(stages ?? []).map((s) => ({
                value: s.id,
                label: `${s.name} · ${label('stageCategory', s.category)}`
              }))}
            />
          </Field>
        )}
        {type === 'interaction' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Direção">
              <Select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
                options={options('direction')}
              />
            </Field>
            <Field label="Canal">
              <Select
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                placeholder="—"
                options={options('medium')}
              />
            </Field>
          </div>
        )}
        {(type === 'interaction' || type === 'feedback_received' || type === 'follow_up_sent') &&
          contactOptions.length > 0 && (
            <Field label="Contato">
              <Select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder="—"
                options={contactOptions}
              />
            </Field>
          )}
        {type === 'feedback_received' && (
          <Field label="Tom do feedback">
            <Select
              value={sentiment}
              onChange={(e) => setSentiment(e.target.value)}
              placeholder="—"
              options={options('sentiment')}
            />
          </Field>
        )}
        {type === 'paused' && (
          <Field label="Previsão de retomada">
            <Input
              type="date"
              value={expectedResumeAt}
              onChange={(e) => setExpectedResumeAt(e.target.value)}
            />
          </Field>
        )}
        {type === 'closed' && (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Desfecho"
              hint="Sem resposta é decisão sua; rejeitada é só quando a empresa confirmou."
            >
              <Select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="Escolha…"
                options={options('outcome')}
              />
            </Field>
            <Field label="Motivo">
              <Select
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="—"
                options={(reasons ?? []).map((r) => ({ value: r.value, label: r.label }))}
              />
            </Field>
          </div>
        )}
        <Field
          label={
            type === 'note'
              ? 'Anotação'
              : type === 'feedback_received'
                ? 'Feedback recebido'
                : 'Resumo (opcional)'
          }
        >
          <Textarea
            autoFocus={type !== 'stage_changed'}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </Field>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
