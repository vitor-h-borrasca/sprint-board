// Tamanhos de tarefas
export const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG']

export const DEFAULT_SIZE_HRS = { PP: 10, P: 20, M: 40, G: 80, GG: 160, XG: 320 }

// Tipos de tarefa (feature removido do backlog — agora é entidade própria)
export const TYPES = ['pbi', 'tecnica', 'bughom']

export const TYPE_LABELS = {
  feature:   'Feature',
  pbi:       'PBI',
  tecnica:   'Tech',
  bughom:    'BugHom',
  bugclient: 'Bug Client',
  servico:   'Serviço',
}

export const TYPE_COLORS = {
  feature:   'var(--blue)',
  pbi:       'var(--purple)',
  tecnica:   'var(--teal)',
  bughom:    'var(--amber)',
  bugclient: 'var(--red)',
  servico:   'var(--orange)',
}

// Prioridades
export const PRIORITIES = [
  { v: 1, label: 'Alta',  icon: 'ti-alert-circle', color: 'var(--red-tx)' },
  { v: 2, label: 'Média', icon: 'ti-minus',         color: 'var(--amber-tx)' },
  { v: 3, label: 'Baixa', icon: 'ti-arrow-down',    color: 'var(--green-tx)' },
]

// Statuses de sprint
export const STATUSES = {
  backlog:      { label: 'Backlog',             bg: 'var(--gray-bg)',   bd: 'var(--gray-bd)',   tx: 'var(--gray-tx)' },
  todo:         { label: 'A Fazer',             bg: 'var(--blue-bg)',   bd: 'var(--blue-bd)',   tx: 'var(--blue-tx)' },
  inprogress:   { label: 'Em Dev',              bg: 'var(--amber-bg)',  bd: 'var(--amber-bd)',  tx: 'var(--amber-tx)' },
  inqa:         { label: 'Em QA',               bg: 'var(--purple-bg)', bd: 'var(--purple-bd)', tx: 'var(--purple-tx)' },
  done:         { label: 'Concluído',           bg: 'var(--teal-bg)',   bd: 'var(--teal-bd)',   tx: 'var(--teal-tx)' },
  avalentrega:  { label: 'Avaliação de Entrega',bg: 'var(--orange-bg)', bd: 'var(--orange-bd)', tx: 'var(--orange-tx)' },
}

export const DELIVERY_EVAL_DEADLINE_DAYS = 60

// Statuses de PET
export const PET_STATUSES = {
  notstarted: { label: 'Não Iniciado', bg: 'var(--gray-bg)',   bd: 'var(--gray-bd)',   tx: 'var(--gray-tx)' },
  doing:      { label: 'Fazendo',      bg: 'var(--blue-bg)',   bd: 'var(--blue-bd)',   tx: 'var(--blue-tx)' },
  done:       { label: 'Concluído',    bg: 'var(--teal-bg)',   bd: 'var(--teal-bd)',   tx: 'var(--teal-tx)' },
  late:       { label: 'Atrasado',     bg: 'var(--red-bg)',    bd: 'var(--red-bd)',    tx: 'var(--red-tx)' },
}

// Quarters
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export const QUARTER_COLORS = {
  Q1: { bg: '#EFF6FF', bd: '#BFDBFE', tx: '#1D4ED8' },
  Q2: { bg: '#F0FDF4', bd: '#BBF7D0', tx: '#166534' },
  Q3: { bg: '#FFFBEB', bd: '#FDE68A', tx: '#B45309' },
  Q4: { bg: '#F5F3FF', bd: '#DDD6FE', tx: '#6D28D9' },
}

// Buckets de capacity PET
export const CAP_BUCKETS = [
  { key: 'engineering', label: 'Engenharia', icon: 'ti-code',         color: 'var(--blue)' },
  { key: 'product',     label: 'Negócio',    icon: 'ti-briefcase',    color: 'var(--purple)' },
  { key: 'bugs',        label: 'Bugs',       icon: 'ti-bug',          color: 'var(--red)' },
  { key: 'security',    label: 'Segurança',  icon: 'ti-shield-lock',  color: 'var(--amber)' },
]

// Avatar palette
export const AVATAR_PAL = [
  ['#DBEAFE', '#1D4ED8'],
  ['#CCFBF1', '#0F766E'],
  ['#FAE8FF', '#7E22CE'],
  ['#FEE2E2', '#B91C1C'],
  ['#FEF9C3', '#854D0E'],
  ['#DCFCE7', '#166534'],
  ['#FFE4E6', '#9F1239'],
]

// Limite de iniciativas por quarter
export const MAX_INITIATIVES_PER_QUARTER = 2

// LocalStorage keys
export const LS_KEY = 'sprint-board-v4'
export const CONFIG_KEY = 'sprint-board-config'
