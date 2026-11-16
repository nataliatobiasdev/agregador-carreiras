import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    const details = `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack ?? ''}`
    return (
      <div className="mx-auto mt-24 max-w-lg space-y-3 p-6">
        <h1 className="text-lg font-semibold">Algo deu errado</h1>
        <p className="text-sm text-muted">
          A tela encontrou um erro inesperado. Seus dados estão salvos. Copie os detalhes abaixo se quiser
          relatar o problema.
        </p>
        <pre className="max-h-48 overflow-auto rounded bg-subtle p-3 text-xs">{details}</pre>
        <div className="flex gap-2">
          <button
            className="rounded border border-border px-3 py-1.5"
            onClick={() => void navigator.clipboard.writeText(details)}
          >
            Copiar detalhes
          </button>
          <button className="rounded bg-accent px-3 py-1.5 text-accent-fg" onClick={() => location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
