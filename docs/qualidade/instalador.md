# Instalador Windows

| Configuração (`electron-builder.yml`) | Efeito |
| --- | --- |
| `target: nsis`, `arch: x64` | Instalador `CAM-Setup-1.0.0.exe` |
| `perMachine: false`, `allowElevation: false` | Instalação por usuário, sem administrador |
| `oneClick: false`, `allowToChangeInstallationDirectory: true` | Assistente com escolha de pasta |
| Atalhos na área de trabalho e no menu Iniciar | Nome “Career Application Manager” |
| `deleteAppDataOnUninstall: false` | Desinstalar nunca apaga `%APPDATA%\CAM` |
| `asarUnpack` de `better-sqlite3`, `bindings`, `file-uri-to-path` | O `.node` nativo fica fora do asar para poder ser carregado |
| `npmRebuild: true` + `postinstall: electron-builder install-app-deps` | Módulo nativo compilado para o ABI do Electron 38 |
| `appId: com.nataliatobias.cam` = `setAppUserModelId` | Necessário para notificações nativas (V1.1) |

## Como obter

- **CI**: aba Actions → run verde → artefato `installer`.
- **Local** numa máquina Windows: `pnpm dist`, saída em `dist/`.

## Pendências

::: info Sem assinatura de código
O instalador não é assinado. Na primeira execução o SmartScreen mostra “Editor desconhecido”: clique em **Mais informações → Executar assim mesmo**. O app também ainda não tem ícone próprio.
:::

## Pacote

```mermaid
flowchart LR
  S[src/*] -->|electron-vite build| O["out/main · out/preload · out/renderer"]
  O -->|electron-builder| A["app.asar"]
  N["better-sqlite3.node<br/>(ABI Electron)"] -->|asarUnpack| U["app.asar.unpacked"]
  A --> X["CAM-Setup-1.0.0.exe<br/>NSIS por usuário"]
  U --> X
```
