export interface CamBridge {
  invoke(channel: string, input: unknown): Promise<unknown>
  pathForFile(file: File): string
  onDataChanged(listener: () => void): () => void
}

declare global {
  interface Window {
    camBridge: CamBridge
  }
}
