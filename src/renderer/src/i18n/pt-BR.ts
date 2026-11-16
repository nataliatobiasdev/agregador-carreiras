// Interface text in Brazilian Portuguese. Kept in one file so an English
// translation can be added later without touching components.

export const labels = {
  status: { active: 'Ativa', paused: 'Pausada', offer: 'Oferta', closed: 'Encerrada' },
  outcome: {
    rejected: 'Rejeitada',
    no_response: 'Sem resposta',
    withdrew: 'Desisti',
    position_cancelled: 'Vaga cancelada',
    offer_declined: 'Oferta recusada',
    offer_accepted: 'Oferta aceita'
  },
  stageCategory: {
    applied: 'Aplicada',
    screening: 'Triagem',
    interview: 'Entrevista',
    assessment: 'Teste',
    final: 'Final',
    offer: 'Oferta'
  },
  eventType: {
    applied: 'Candidatura enviada',
    stage_changed: 'Mudança de etapa',
    interaction: 'Interação',
    follow_up_sent: 'Follow-up enviado',
    interview_scheduled: 'Entrevista agendada',
    interview_done: 'Entrevista realizada',
    interview_cancelled: 'Entrevista cancelada',
    assessment_received: 'Teste recebido',
    assessment_submitted: 'Teste entregue',
    feedback_received: 'Feedback recebido',
    offer_received: 'Proposta recebida',
    offer_updated: 'Proposta atualizada',
    paused: 'Processo pausado',
    resumed: 'Processo retomado',
    closed: 'Processo encerrado',
    reopened: 'Processo reaberto',
    note: 'Anotação'
  },
  direction: { in: 'Recebida', out: 'Enviada' },
  medium: {
    email: 'E-mail',
    linkedin: 'LinkedIn',
    phone: 'Telefone',
    whatsapp: 'WhatsApp',
    video_call: 'Videochamada',
    in_person: 'Presencial',
    other: 'Outro'
  },
  sentiment: { positive: 'Positivo', neutral: 'Neutro', negative: 'Negativo' },
  seniority: {
    intern: 'Estagiário',
    junior: 'Júnior',
    mid: 'Pleno',
    senior: 'Sênior',
    specialist: 'Especialista',
    staff: 'Staff',
    principal: 'Principal',
    tech_lead: 'Tech lead',
    manager: 'Gerente'
  },
  workMode: { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' },
  employmentType: {
    clt: 'CLT',
    pj: 'PJ',
    contractor: 'Contractor',
    internship: 'Estágio',
    temporary: 'Temporário',
    other: 'Outro'
  },
  priority: { low: 'Baixa', medium: 'Média', high: 'Alta' },
  period: { hour: 'por hora', month: 'por mês', year: 'por ano' },
  processLanguage: { pt: 'Português', en: 'Inglês', other: 'Outro' },
  contactRole: {
    recruiter: 'Recrutador(a)',
    hiring_manager: 'Gestor(a) da vaga',
    interviewer: 'Entrevistador(a)',
    referral: 'Indicação',
    reference: 'Referência'
  },
  noteKind: {
    free: 'Livre',
    interview_prep: 'Preparação para entrevista',
    interview_debrief: 'Debrief de entrevista',
    company_insights: 'Percepções sobre a empresa',
    company_research: 'Pesquisa da empresa',
    feedback: 'Feedback recebido',
    recruiter_info: 'Informações do recrutador',
    study: 'Pontos para estudar',
    negotiation: 'Negociação e expectativas'
  },
  attachmentKind: {
    job_description: 'Descrição da vaga',
    application_proof: 'Comprovante / print',
    recruiter_document: 'Documento do recrutador',
    prep_material: 'Material de preparação',
    assessment_brief: 'Enunciado de teste',
    deliverable: 'Entregável',
    offer: 'Proposta',
    other: 'Outro'
  },
  fitScore: {
    1: '1 · Pouca aderência',
    2: '2 · Aderência parcial',
    3: '3 · Boa aderência',
    4: '4 · Muito aderente',
    5: '5 · Vaga ideal'
  },
  missingField: {
    seniority: 'Senioridade',
    area: 'Área de atuação',
    workMode: 'Modalidade',
    employmentType: 'Tipo de contratação',
    country: 'País',
    fitScore: 'Aderência pessoal',
    jobUrl: 'URL da vaga',
    jobDescription: 'Descrição da vaga'
  },
  auditAction: {
    create: 'Criado',
    update: 'Alterado',
    delete: 'Excluído',
    restore: 'Restaurado',
    void: 'Anulado',
    archive: 'Arquivado',
    unarchive: 'Desarquivado'
  },
  entityType: {
    application: 'Candidatura',
    company: 'Empresa',
    contact: 'Contato',
    note: 'Nota',
    attachment: 'Anexo',
    event: 'Evento',
    stage: 'Etapa'
  },
  field: {
    title: 'Cargo',
    companyId: 'Empresa',
    appliedAt: 'Data da candidatura',
    platform: 'Plataforma',
    channel: 'Canal',
    jobUrl: 'URL da vaga',
    seniority: 'Senioridade',
    area: 'Área',
    workMode: 'Modalidade',
    city: 'Cidade',
    country: 'País',
    employmentType: 'Contratação',
    priority: 'Prioridade',
    fitScore: 'Aderência',
    postedSalaryMin: 'Faixa mínima',
    postedSalaryMax: 'Faixa máxima',
    postedCurrency: 'Moeda da faixa',
    postedPeriod: 'Período da faixa',
    expectedSalary: 'Pretensão',
    expectedCurrency: 'Moeda da pretensão',
    expectedPeriod: 'Período da pretensão',
    jobDescription: 'Descrição da vaga',
    requirementsRequired: 'Requisitos obrigatórios',
    requirementsDesired: 'Requisitos desejáveis',
    externalRef: 'Código da candidatura',
    processLanguage: 'Idioma do processo',
    needsVisa: 'Exige patrocínio de visto',
    relocationOffered: 'Oferece realocação',
    coverLetterText: 'Carta de apresentação',
    responseDeadline: 'Prazo para resposta',
    skills: 'Competências',
    contacts: 'Contatos',
    occurredAt: 'Data do evento',
    summary: 'Resumo',
    voidReason: 'Motivo da anulação',
    kind: 'Tipo',
    caption: 'Legenda',
    bodyMd: 'Conteúdo',
    pinned: 'Fixada',
    name: 'Nome',
    website: 'Site',
    industry: 'Setor',
    size: 'Porte',
    notes: 'Notas',
    roleTitle: 'Cargo',
    email: 'E-mail',
    phone: 'Telefone',
    linkedinUrl: 'LinkedIn',
    keepInTouch: 'Manter relação',
    active: 'Ativa',
    duplicatedFromId: 'Duplicada de',
    purged: 'Excluído em definitivo'
  } as Record<string, string>,
  errors: {
    VALIDATION: 'Verifique os dados',
    NOT_FOUND: 'Não encontrado',
    CONFLICT: 'Conflito',
    FILE_MISSING: 'Arquivo ausente',
    DB_BUSY: 'Banco ocupado',
    INTEGRITY: 'Falha de integridade',
    UNEXPECTED: 'Erro inesperado'
  }
} as const

export type LabelGroup = keyof typeof labels

export function label(group: LabelGroup, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const table = labels[group] as Record<string | number, string>
  return table[value] ?? String(value)
}

export function options<G extends LabelGroup>(group: G): Array<{ value: string; label: string }> {
  return Object.entries(labels[group] as Record<string, string>).map(([value, l]) => ({ value, label: l }))
}
