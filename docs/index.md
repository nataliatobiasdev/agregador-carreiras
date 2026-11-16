---
layout: home
title: Início
hero:
  name: Career Application Manager
  text: Documentação técnica da V1.0
  tagline: App desktop Windows, local e offline, para registrar candidaturas e acompanhar cada processo seletivo até o desfecho.
  image:
    src: /logo.svg
    alt: Logo do CAM
  actions:
    - theme: brand
      text: Começar pela visão geral
      link: /guia/visao
    - theme: alt
      text: Arquitetura
      link: /arquitetura/
    - theme: alt
      text: Ver no GitHub
      link: https://github.com/nataliatobiasdev/agregador-carreiras
features:
  - icon: 🧭
    title: Escopo deliberado
    details: Registro manual de candidaturas. Sem scraping, sem importação de vagas, sem eventos presumidos.
    link: /guia/visao
  - icon: 🏗️
    title: Electron + TypeScript
    details: Três processos com fronteira rígida, IPC tipado com Zod e services transacionais testáveis fora do Electron.
    link: /arquitetura/
  - icon: 🗂️
    title: Linha do tempo como verdade
    details: Status e etapa são derivados por uma função pura a partir de eventos datados, inclusive retroativos.
    link: /dados/linha-do-tempo
  - icon: 🛡️
    title: Integridade no banco
    details: CHECKs, FKs, índices parciais e triggers garantem as regras mesmo com bug no código.
    link: /dados/modelo
  - icon: 💾
    title: Backup verificável
    details: Zip com manifesto de hashes, integrity_check e restauração atômica com volta automática.
    link: /dados/backup
  - icon: ✅
    title: 78 testes e CI no Windows
    details: Unidade, integração com SQLite real e ponta a ponta com Playwright no app empacotado.
    link: /qualidade/testes
---
