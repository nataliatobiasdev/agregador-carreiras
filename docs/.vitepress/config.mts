import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'pt-BR', title: 'CAM | Arquitetura', base: '/agregador-carreiras/', cleanUrls: true,
  description: 'Arquitetura e operações do Career Application Manager',
  vite: { css: { postcss: { plugins: [] } } },
  themeConfig: {
    nav: [{ text: 'Arquitetura', link: '/architecture/' }, { text: 'ADRs', link: '/adr/' }, { text: 'Operação', link: '/operacao' }, { text: 'GitHub', link: 'https://github.com/nataliatobiasdev/agregador-carreiras' }],
    sidebar: [
      { text: 'Sistema', items: [{ text: 'Visão geral', link: '/' }, { text: 'Visões C4 e sequência', link: '/architecture/' }, { text: 'Contratos e dados', link: '/contratos' }, { text: 'Build e operação', link: '/operacao' }] },
      { text: 'Decisões arquiteturais', items: [{ text: 'Índice de ADRs', link: '/adr/' }, { text: 'ADR 001 — Processos isolados', link: '/adr/001-processos' }, { text: 'ADR 002 — Dados locais', link: '/adr/002-dados' }, { text: 'ADR 003 — Integração local', link: '/adr/003-integracao' }] }
    ],
    search: { provider: 'local' }, socialLinks: [{ icon: 'github', link: 'https://github.com/nataliatobiasdev/agregador-carreiras' }]
  }
})
