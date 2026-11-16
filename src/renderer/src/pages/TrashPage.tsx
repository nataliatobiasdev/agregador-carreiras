import { useState } from 'react'
import type { TrashItem } from '@shared/dto'
import { Button, EmptyState, Field, Input, Modal, PageHeader, Spinner } from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useCam, useCamMutation } from '../lib/hooks'
import { label } from '../i18n/pt-BR'

const CONFIRM_WORD = 'EXCLUIR'

export function TrashPage() {
  const { data, isLoading } = useCam('trash.list')
  const restore = useCamMutation('trash.restore', { success: 'Restaurado' })
  const [purging, setPurging] = useState<TrashItem | null>(null)
  return (
    <div>
      <PageHeader
        title="Lixeira"
        subtitle="Itens excluídos ficam aqui por 30 dias e saem das métricas. Depois disso são apagados em definitivo."
      />
      <div className="px-6 py-4">
        {isLoading ? (
          <Spinner />
        ) : !data?.length ? (
          <EmptyState title="A Lixeira está vazia" />
        ) : (
          <ul className="surface divide-y divide-border rounded-lg border border-border bg-panel">
            {data.map((i) => (
              <li key={`${i.entityType}-${i.id}`} className="flex items-center gap-3 px-3 py-2">
                <span className="w-24 text-xs text-muted">{label('entityType', i.entityType)}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{i.title}</span>
                  {i.subtitle && <span className="text-muted"> — {i.subtitle}</span>}
                </span>
                <span className="text-xs text-muted">excluído em {formatDateTime(i.deletedAt)}</span>
                <span className="w-28 text-right text-xs text-muted">{i.daysLeft} dia(s) restantes</span>
                <Button size="sm" onClick={() => restore.mutate({ entityType: i.entityType, id: i.id })}>
                  Restaurar
                </Button>
                <Button size="sm" variant="ghost" className="!text-danger" onClick={() => setPurging(i)}>
                  Excluir em definitivo
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PurgeDialog item={purging} onClose={() => setPurging(null)} />
    </div>
  )
}

function PurgeDialog({ item, onClose }: { item: TrashItem | null; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const purge = useCamMutation('trash.purge', { success: 'Excluído em definitivo' })
  if (!item) return null
  return (
    <Modal
      open
      onClose={() => {
        setTyped('')
        onClose()
      }}
      title="Excluir em definitivo"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            disabled={typed !== CONFIRM_WORD || purge.isPending}
            onClick={async () => {
              await purge.mutateAsync({ entityType: item.entityType, id: item.id })
              setTyped('')
              onClose()
            }}
          >
            Excluir para sempre
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        <strong>{item.title}</strong> será apagado(a) em definitivo, junto com o que pertence só a ele(a)
        (linha do tempo, notas e anexos). Isso não pode ser desfeito. O histórico de edições é mantido.
      </p>
      <Field label={`Digite ${CONFIRM_WORD} para confirmar`}>
        <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
      </Field>
    </Modal>
  )
}
