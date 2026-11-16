import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import type { ChannelInput, ChannelName, ChannelOutput } from '@shared/contracts'
import { useToast } from '../components/ui'
import { call, errorMessage } from './api'

/** Query over an IPC channel. The key is [channel, input]. */
export function useCam<C extends ChannelName>(
  channel: C,
  input?: ChannelInput<C>,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: [channel, input ?? null],
    queryFn: () => (call as (c: C, i?: ChannelInput<C>) => Promise<ChannelOutput<C>>)(channel, input),
    enabled: options.enabled
  })
}

/**
 * Mutation over an IPC channel. Every successful write invalidates all
 * queries: the data is local and small, so refetching is cheap and always correct.
 */
export function useCamMutation<C extends ChannelName>(
  channel: C,
  options: { success?: string | ((data: ChannelOutput<C>) => string | null); silentError?: boolean } = {}
) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: ChannelInput<C>) =>
      (call as (c: C, i?: ChannelInput<C>) => Promise<ChannelOutput<C>>)(channel, input),
    onSuccess: (data) => {
      void qc.invalidateQueries()
      const msg = typeof options.success === 'function' ? options.success(data) : options.success
      if (msg) toast({ message: msg, tone: 'success' })
    },
    onError: (e) => {
      if (!options.silentError) toast({ message: errorMessage(e), tone: 'error' })
    }
  })
}

export function useInvalidateAll() {
  const qc = useQueryClient()
  return useCallback(() => void qc.invalidateQueries(), [qc])
}

// --------------------------------------------------------- Undo (Ctrl+Z, 10 s)

export interface UndoApi {
  offer(label: string, undo: () => Promise<void> | void): void
}
export const UndoContext = createContext<UndoApi>({ offer: () => undefined })

/** Registers an undo for 10 seconds: shown as a toast action and bound to Ctrl+Z. */
export function useUndoController(): UndoApi {
  const toast = useToast()
  const current = useRef<{ undo: () => Promise<void> | void; until: number } | null>(null)
  const invalidate = useInvalidateAll()

  const run = useCallback(async () => {
    const c = current.current
    current.current = null
    if (!c || Date.now() > c.until) return
    try {
      await c.undo()
      invalidate()
      toast({ message: 'Ação desfeita' })
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' })
    }
  }, [invalidate, toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable=true]')) return
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z' && current.current) {
        e.preventDefault()
        void run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run])

  return {
    offer(label, undo) {
      current.current = { undo, until: Date.now() + 10_000 }
      toast({ message: label, action: { label: 'Desfazer', onClick: () => void run() }, duration: 10_000 })
    }
  }
}

export const useUndo = () => useContext(UndoContext)
