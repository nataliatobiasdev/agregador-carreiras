import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const repo = 'https://github.com/nataliatobiasdev/agregador-carreiras'

export default withMermaid(
  defineConfig({
    lang: 'pt-BR',
    title: 'CAM Docs',
    description: 'Documentação técnica do Career Application Manager',
    base: '/agregador-carreiras/',
    cleanUrls: true,
    lastUpdated: true,
    head: [
      ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/agregador-carreiras/favicon-32.png' }],
      ['link', { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/agregador-carreiras/favicon-64.png' }],
      ['link', { rel: 'apple-touch-icon', href: '/agregador-carreiras/icon-256.png' }],
      ['meta', { name: 'theme-color', content: '#0B0E19' }]
    ],
    markdown: { lineNumbers: false },
    // Isola o site do postcss.config.js (Tailwind) do app na raiz do repositório.
    vite: { css: { postcss: { plugins: [] } } },
    themeConfig: {
      logo: '/favicon-64.png',
      siteTitle: 'CAM Docs',
      nav: [
        { text: 'Visão geral', link: '/guia/visao', activeMatch: '/guia/' },
        { text: 'Arquitetura', link: '/arquitetura/', activeMatch: '/arquitetura/' },
        { text: 'Dados', link: '/dados/modelo', activeMatch: '/dados/' },
        { text: 'Qualidade', link: '/qualidade/testes', activeMatch: '/qualidade/' },
        { text: 'Releases e deploys', link: '/entregas' },
        { text: 'Decisões', link: '/decisoes' },
        { text: 'Roadmap', link: '/roadmap', activeMatch: '/(roadmap|planejado/)' },
        { text: 'v1.0', items: [{ text: 'PR #1: V1.0', link: `${repo}/pull/1` }, { text: 'Actions', link: `${repo}/actions` }] }
      ],
      sidebar: [
        {
          text: 'Visão geral',
          items: [
            { text: 'Produto e escopo', link: '/guia/visao' },
            { text: 'Funcionalidades da V1.0', link: '/guia/funcionalidades' },
            { text: 'Identidade visual', link: '/guia/identidade-visual' },
            { text: 'Rodar e contribuir', link: '/guia/desenvolvimento' }
          ]
        },
        {
          text: 'Arquitetura',
          items: [
            { text: 'Visão da arquitetura', link: '/arquitetura/' },
            { text: 'Por que Electron + TS', link: '/arquitetura/stack' },
            { text: 'IPC tipado', link: '/arquitetura/ipc' },
            { text: 'Segurança', link: '/arquitetura/seguranca' }
          ]
        },
        {
          text: 'Dados',
          items: [
            { text: 'Modelo de dados', link: '/dados/modelo' },
            { text: 'Linha do tempo', link: '/dados/linha-do-tempo' },
            { text: 'Migrações', link: '/dados/migracoes' },
            { text: 'Anexos', link: '/dados/anexos' },
            { text: 'Backup e restauração', link: '/dados/backup' },
            { text: 'Busca', link: '/dados/busca' },
            { text: 'Lixeira e auditoria', link: '/dados/lixeira' }
          ]
        },
        {
          text: 'Qualidade e entrega',
          items: [
            { text: 'Testes', link: '/qualidade/testes' },
            { text: 'CI e incidentes', link: '/qualidade/ci' },
            { text: 'Instalador Windows', link: '/qualidade/instalador' },
            { text: 'Releases e deploys', link: '/entregas' }
          ]
        },
        {
          text: 'Decisões e futuro',
          items: [
            { text: 'Decisões (ADRs)', link: '/decisoes' },
            { text: 'Limitações e roadmap', link: '/roadmap' },
            { text: 'Rotina diária (planejado)', link: '/planejado/rotina' },
            { text: 'Jornada (planejado)', link: '/planejado/jornada' }
          ]
        }
      ],
      outline: { level: [2, 3], label: 'Nesta página' },
      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
            modal: {
              noResultsText: 'Nenhum resultado para',
              resetButtonTitle: 'Limpar busca',
              displayDetails: 'Mostrar detalhes',
              backButtonTitle: 'Fechar',
              footer: { selectText: 'abrir', navigateText: 'navegar', closeText: 'fechar' }
            }
          }
        }
      },
      socialLinks: [{ icon: 'github', link: repo }],
      editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Editar esta página no GitHub' },
      lastUpdated: { text: 'Atualizado em', formatOptions: { dateStyle: 'short' } },
      docFooter: { prev: 'Anterior', next: 'Próxima' },
      darkModeSwitchLabel: 'Tema',
      lightModeSwitchTitle: 'Mudar para o tema claro',
      darkModeSwitchTitle: 'Mudar para o tema escuro',
      sidebarMenuLabel: 'Menu',
      returnToTopLabel: 'Voltar ao topo',
      langMenuLabel: 'Idioma',
      notFound: { title: 'Página não encontrada', quote: 'Este endereço não existe na documentação.', linkText: 'Voltar ao início' },
      footer: {
        message: 'Documentação técnica do Career Application Manager · Nevora',
        copyright: 'Copyright © 2026 Natalia Tobias'
      }
    },
    mermaid: { securityLevel: 'strict' }
  })
)
