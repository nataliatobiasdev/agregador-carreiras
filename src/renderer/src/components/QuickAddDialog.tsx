import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { call } from '../lib/api'
import { useCamMutation, useUndo } from '../lib/hooks'
import {
  emptyForm,
  formToInput,
  MoreFields,
  RequiredFields,
  type ApplicationFormState,
  type FormErrors
} from './ApplicationForm'
import { Button, Modal } from './ui'

/**
 * Quick registration (Ctrl+N): 4 required fields, Enter saves, Ctrl+Enter
 * saves and opens the detail. "Mais detalhes" expands the full form.
 */
export function QuickAddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const undo = useUndo()
  const [form, setForm] = useState<ApplicationFormState>(emptyForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [more, setMore] = useState(false)
  const create = useCamMutation('applications.create')

  useEffect(() => {
    if (!open) return
    setErrors({})
    setMore(false)
    void call('applications.lastPlatform').then((p) => setForm(emptyForm(p ?? '')))
  }, [open])

  const set = (patch: Partial<ApplicationFormState>) => setForm((f) => ({ ...f, ...patch }))

  const submit = async (openAfter: boolean) => {
    const { fields, errors: errs } = formToInput(form)
    if (!form.company.trim()) errs.company = 'Informe a empresa'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    const res = await create.mutateAsync({
      ...fields,
      company: { name: form.company.trim() },
      recruiter: form.recruiter.trim() ? { name: form.recruiter.trim() } : null,
      initialNote: form.initialNote || null
    })
    onClose()
    undo.offer(`Candidatura registrada: ${fields.title} — ${form.company.trim()}`, async () => {
      await call('applications.undoCreate', { id: res.id })
      navigate('/candidaturas')
    })
    if (openAfter) navigate(`/candidaturas/${res.id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova candidatura"
      width={more ? 'max-w-2xl' : 'max-w-xl'}
      footer={
        <>
          {!more && (
            <Button variant="ghost" className="mr-auto" onClick={() => setMore(true)}>
              Mais detalhes
            </Button>
          )}
          <Button onClick={() => void submit(true)} disabled={create.isPending}>
            Salvar e abrir <kbd className="text-[10px] opacity-60">Ctrl+Enter</kbd>
          </Button>
          <Button variant="primary" onClick={() => void submit(false)} disabled={create.isPending}>
            Salvar <kbd className="text-[10px] opacity-70">Enter</kbd>
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault()
            void submit(true)
          }
        }}
      >
        <RequiredFields form={form} set={set} errors={errors} autoFocus />
        {more && <MoreFields form={form} set={set} errors={errors} showCreateOnly />}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
