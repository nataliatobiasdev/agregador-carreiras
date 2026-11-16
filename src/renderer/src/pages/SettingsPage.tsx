import { useState, type ReactNode } from 'react'
import type { BackupVerification, IntegrityReport, ListItemDto, StageDto } from '@shared/dto'
import { LIST_KEYS, STAGE_CATEGORIES, type ListKey, type StageCategory } from '@shared/enums'
import { Badge, Button, Input, Modal, PageHeader, Select, useToast } from '../components/ui'
import { call, errorMessage } from '../lib/api'
import { formatBytes, formatDateTime } from '../lib/format'
import { useCam, useCamMutation, useInvalidateAll } from '../lib/hooks'
import { label } from '../i18n/pt-BR'

function Section({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-panel p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Configurações" />
      <div className="grid max-w-5xl gap-4 px-6 py-4">
        <BackupSection />
        <AppearanceSection />
        <StagesSection />
        <ListsSection />
        <MaintenanceSection />
        <AboutSection />
      </div>
    </div>
  )
}

function AppearanceSection() {
  const { data } = useCam('settings.get', { key: 'ui.theme' })
  const set = useCamMutation('settings.set')
  return (
    <Section title="Aparência">
      <div className="flex gap-2" role="radiogroup" aria-label="Tema">
        {(
          [
            ['system', 'Seguir o Windows'],
            ['light', 'Claro'],
            ['dark', 'Escuro']
          ] as const
        ).map(([value, text]) => (
          <Button
            key={value}
            role="radio"
            aria-checked={(data ?? 'system') === value}
            variant={(data ?? 'system') === value ? 'primary' : 'secondary'}
            onClick={() => set.mutate({ key: 'ui.theme', value })}
          >
            {text}
          </Button>
        ))}
      </div>
    </Section>
  )
}

function BackupSection() {
  const toast = useToast()
  const invalidate = useInvalidateAll()
  const { data: backups } = useCam('backup.list')
  const { data: settings } = useCam('backup.getSettings')
  const create = useCamMutation('backup.create', { success: (b) => `Backup criado: ${b.fileName}` })
  const setExtra = useCamMutation('backup.setExtraDir', { success: 'Pasta extra atualizada' })
  const [report, setReport] = useState<{ path: string; result: BackupVerification } | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const test = async (path: string) => {
    setBusy(true)
    try {
      const result = await call('backup.verify', { path })
      setReport({ path, result })
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const restore = async (path: string) => {
    setBusy(true)
    try {
      await call('backup.restore', { path })
      invalidate()
      toast({
        message: 'Backup restaurado. O estado anterior foi salvo como backup "pre-restore".',
        tone: 'success'
      })
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' })
    } finally {
      setBusy(false)
      setConfirmRestore(null)
    }
  }
  const choose = async (then: (p: string) => void) => {
    const p = await call('backup.chooseFile')
    if (p) then(p)
  }

  return (
    <Section
      title="Backup e restauração"
      description="Backup automático diário (mantém 14 diários e 8 semanais). Cada backup tem banco, anexos e um manifesto com hashes, e pode ser testado sem alterar nada."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          disabled={create.isPending || busy}
          onClick={() => create.mutate(undefined)}
        >
          Fazer backup agora
        </Button>
        <Button disabled={busy} onClick={() => void choose(test)}>
          Testar um backup…
        </Button>
        <Button disabled={busy} onClick={() => void choose(setConfirmRestore)}>
          Restaurar de um arquivo…
        </Button>
        <span className="text-xs text-muted">
          Último automático: {formatDateTime(settings?.lastAutoBackupAt)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-muted">Pasta extra (ex.: OneDrive):</span>
        <span className="truncate">{settings?.extraDir ?? 'não configurada'}</span>
        <Button
          size="sm"
          onClick={async () => {
            const dir = await call('backup.chooseExtraFolder')
            if (dir) setExtra.mutate({ extraDir: dir })
          }}
        >
          Escolher…
        </Button>
        {settings?.extraDir && (
          <Button size="sm" variant="ghost" onClick={() => setExtra.mutate({ extraDir: null })}>
            Remover
          </Button>
        )}
      </div>
      {backups && backups.length > 0 && (
        <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto rounded border border-border text-sm scroll-thin">
          {backups.map((b) => (
            <li key={b.path} className="flex items-center gap-3 px-3 py-1.5">
              <Badge>{b.kind}</Badge>
              <span className="tabular-nums">{formatDateTime(b.createdAt)}</span>
              <span className="text-xs text-muted">{formatBytes(b.sizeBytes)}</span>
              {b.fileName.endsWith('.zip') && (
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void test(b.path)}>
                    Testar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRestore(b.path)}>
                    Restaurar
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={report !== null} onClose={() => setReport(null)} title="Resultado do teste de backup">
        {report && <VerificationReport result={report.result} />}
      </Modal>
      <Modal
        open={confirmRestore !== null}
        onClose={() => setConfirmRestore(null)}
        title="Restaurar backup?"
        footer={
          <>
            <Button onClick={() => setConfirmRestore(null)}>Cancelar</Button>
            <Button variant="danger" disabled={busy} onClick={() => void restore(confirmRestore!)}>
              {busy ? 'Restaurando…' : 'Restaurar'}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Os dados atuais serão substituídos pelos do backup. Antes disso o app verifica o backup e salva o
          estado atual como um backup “pre-restore”, que você pode restaurar depois se mudar de ideia.
        </p>
      </Modal>
    </Section>
  )
}

function VerificationReport({ result }: { result: BackupVerification }) {
  return (
    <div className="space-y-2 text-sm">
      <p className={result.ok ? 'font-medium text-success' : 'font-medium text-danger'}>
        {result.ok
          ? 'Backup íntegro: pode ser restaurado.'
          : 'O backup tem problemas e não deve ser restaurado.'}
      </p>
      {result.manifest && (
        <p className="text-xs text-muted">
          Criado em {formatDateTime(result.manifest.createdAt)} pela versão {result.manifest.appVersion}{' '}
          (esquema {result.manifest.schemaVersion}).
        </p>
      )}
      {result.problems.length > 0 && (
        <ul className="list-disc pl-5 text-danger">
          {result.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {result.ok && (
        <>
          <p className="text-xs text-muted">
            integrity_check: {result.integrityCheck} · violações de chave estrangeira:{' '}
            {result.foreignKeyViolations}
            {result.migrationsApplied.length > 0 &&
              ` · migrações aplicadas na restauração: ${result.migrationsApplied.join(', ')}`}
          </p>
          <p className="text-xs text-muted">
            {result.counts.applications ?? 0} candidaturas, {result.counts.events ?? 0} eventos,{' '}
            {result.counts.notes ?? 0} notas, {result.counts.attachments ?? 0} anexos,{' '}
            {result.counts.files ?? 0} arquivos.
          </p>
        </>
      )}
    </div>
  )
}

function StagesSection() {
  const { data: stages } = useCam('stages.list', { includeInactive: true })
  const create = useCamMutation('stages.create', { success: 'Etapa criada' })
  const [name, setName] = useState('')
  const [category, setCategory] = useState<StageCategory>('interview')
  return (
    <Section
      title="Etapas do processo"
      description="Cada etapa tem uma categoria fixa usada nas métricas. Etapas já usadas não podem ser excluídas nem mudar de categoria, só desativadas."
    >
      <ul className="divide-y divide-border rounded border border-border">
        {stages?.map((s) => (
          <StageRow key={s.id} stage={s} />
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await create.mutateAsync({ name, category })
          setName('')
        }}
      >
        <Input
          className="w-64"
          placeholder="Nova etapa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          className="w-40"
          value={category}
          onChange={(e) => setCategory(e.target.value as StageCategory)}
          options={STAGE_CATEGORIES.map((c) => ({ value: c, label: label('stageCategory', c) }))}
        />
        <Button type="submit">Adicionar</Button>
      </form>
    </Section>
  )
}

function StageRow({ stage }: { stage: StageDto }) {
  const update = useCamMutation('stages.update')
  const setActive = useCamMutation('stages.setActive')
  const [name, setName] = useState(stage.name)
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color ?? '#888' }} />
      <Input
        aria-label="Nome da etapa"
        className="h-7 w-56"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== stage.name && update.mutate({ id: stage.id, patch: { name } })}
      />
      <Select
        aria-label="Categoria"
        className="h-7 w-36"
        disabled={stage.usageCount > 0}
        value={stage.category}
        onChange={(e) =>
          update.mutate({ id: stage.id, patch: { category: e.target.value as StageCategory } })
        }
        options={STAGE_CATEGORIES.map((c) => ({ value: c, label: label('stageCategory', c) }))}
      />
      <span className="text-xs text-muted">{stage.usageCount} uso(s)</span>
      {stage.isDefaultApplied ? (
        <Badge className="ml-auto">Etapa inicial</Badge>
      ) : (
        <label className="ml-auto flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={stage.active}
            onChange={(e) => setActive.mutate({ id: stage.id, active: e.target.checked })}
          />{' '}
          Ativa
        </label>
      )}
    </li>
  )
}

const LIST_TITLES: Record<ListKey, string> = {
  platform: 'Plataformas',
  area: 'Áreas de atuação',
  close_reason: 'Motivos de encerramento'
}

function ListsSection() {
  return (
    <Section
      title="Listas editáveis"
      description="Itens desativados somem das opções, mas continuam nos registros antigos."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {LIST_KEYS.map((k) => (
          <ListEditor key={k} listKey={k} />
        ))}
      </div>
    </Section>
  )
}

function ListEditor({ listKey }: { listKey: ListKey }) {
  const { data } = useCam('lists.items', { listKey, includeInactive: true })
  const add = useCamMutation('lists.add')
  const [text, setText] = useState('')
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold text-muted">{LIST_TITLES[listKey]}</h3>
      <ul className="space-y-0.5">
        {data?.map((i) => (
          <ListItemRow key={i.id} item={i} />
        ))}
      </ul>
      <form
        className="mt-2 flex gap-1"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          await add.mutateAsync({ listKey, label: text })
          setText('')
        }}
      >
        <Input
          className="h-7"
          placeholder="Adicionar"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button size="sm" type="submit">
          +
        </Button>
      </form>
    </div>
  )
}

function ListItemRow({ item }: { item: ListItemDto }) {
  const update = useCamMutation('lists.update')
  const [text, setText] = useState(item.label)
  return (
    <li className="flex items-center gap-1.5">
      <input
        type="checkbox"
        aria-label="Ativo"
        checked={item.active}
        onChange={(e) => update.mutate({ id: item.id, active: e.target.checked })}
      />
      <Input
        className="h-7"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() && text !== item.label && update.mutate({ id: item.id, label: text })}
      />
    </li>
  )
}

function MaintenanceSection() {
  const toast = useToast()
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null)
  const rebuild = useCamMutation('app.rebuildDerived', {
    success: (r) => `Recalculado: ${r.applications} candidaturas, ${r.searchEntries} itens no índice de busca`
  })
  return (
    <Section title="Manutenção" description="Ferramentas de verificação. Nenhuma delas apaga dados.">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={async () => {
            try {
              setIntegrity(await call('attachments.verifyIntegrity'))
            } catch (e) {
              toast({ message: errorMessage(e), tone: 'error' })
            }
          }}
        >
          Verificar integridade dos anexos
        </Button>
        <Button onClick={() => rebuild.mutate(undefined)}>
          Reconstruir dados derivados e índice de busca
        </Button>
      </div>
      {integrity && (
        <div className="mt-3 text-sm">
          <p>
            {integrity.checkedFiles} arquivo(s) verificado(s): {integrity.missing.length} ausente(s),{' '}
            {integrity.corrupted.length} corrompido(s), {integrity.orphanFilesOnDisk.length} sem referência.
          </p>
          {[...integrity.missing, ...integrity.corrupted].length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-danger">
              {integrity.missing.map((m) => (
                <li key={m.fileId}>Ausente: {m.originalName}</li>
              ))}
              {integrity.corrupted.map((m) => (
                <li key={m.fileId}>Corrompido: {m.originalName}</li>
              ))}
            </ul>
          )}
          {(integrity.missing.length > 0 || integrity.corrupted.length > 0) && (
            <p className="mt-1 text-xs text-muted">
              Restaure um backup recente para recuperar esses arquivos.
            </p>
          )}
        </div>
      )}
    </Section>
  )
}

function AboutSection() {
  const { data } = useCam('app.info')
  return (
    <Section title="Sobre">
      <dl className="grid grid-cols-[160px_1fr] gap-y-1 text-sm">
        <dt className="text-muted">Versão</dt>
        <dd>{data?.version}</dd>
        <dt className="text-muted">Esquema do banco</dt>
        <dd>{data?.schemaVersion}</dd>
        <dt className="text-muted">Pasta de dados</dt>
        <dd className="flex items-center gap-2">
          <span className="truncate">{data?.dataDir}</span>
          <Button size="sm" onClick={() => void call('app.openDataFolder')}>
            Abrir
          </Button>
        </dd>
      </dl>
      <p className="mt-3 text-xs text-muted">
        Tudo fica no seu computador. O app não faz nenhuma chamada de rede e não envia telemetria.
      </p>
    </Section>
  )
}
