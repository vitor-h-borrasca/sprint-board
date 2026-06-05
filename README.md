# Sprint Board — ANYMARKET

Ferramenta interna de planejamento de sprint com sincronização via Google Apps Script.

## Setup

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/
```

## Configuração do Google Apps Script

Os dados são persistidos em uma planilha Google via Apps Script.

**Onde configurar:** aba **Configuração** → sub-aba **Integrações** → campo URL do Script.

**Como obter o URL:**
1. Acesse [script.google.com](https://script.google.com) e abra o projeto
2. Clique em **Implantar** → **Gerenciar implantações**
3. Copie o **URL da Web App** e cole no campo acima

**URL do script:**
```
<!-- cole aqui o URL da Web App -->
```

---

## Estrutura

```
src/
├── domain/              ← lógica pura, zero UI, zero React
│   ├── constants.js     ← todas as constantes (SIZES, STATUSES, etc.)
│   ├── utils.js         ← genId, fmtHrs, calcWorkingDays, etc.
│   ├── capacity.js      ← cálculos de capacity (testável isolado)
│   ├── initiatives.js   ← regras do PET (limite de iniciativas, etc.)
│   ├── board.js         ← factories, migração de schema, localStorage
│   └── sync.js          ← cloud save/load, exportCSV, exportJSON
│
├── store/
│   └── useBoardStore.js ← estado global (Zustand) — único source of truth
│
├── hooks/
│   ├── usePET.js        ← lógica do PET (form, validação, actions)
│   └── useSprint.js     ← lógica da sprint ativa
│
├── components/
│   ├── shared/          ← Badge, Card, Avatar, Field, SyncBadge, etc.
│   ├── pet/
│   │   ├── PETTab.jsx         ← orquestrador (~80 linhas)
│   │   ├── InitiativeForm.jsx ← formulário isolado
│   │   └── InitiativeCard.jsx ← card isolado
│   ├── sprint/          ← BacklogTab, SprintTab (a migrar)
│   ├── board/           ← BoardTab, KanbanView, GanttView (a migrar)
│   ├── setup/           ← SetupTab (a migrar)
│   └── storage/         ← StorageTab (a migrar)
│
└── styles/
    ├── tokens.css       ← CSS variables (design tokens)
    └── globals.css      ← reset, base styles
```

## Princípios da arquitetura

### domain/ — lógica de negócio pura
- Zero imports de React
- Zero side effects
- Todas as funções recebem dados, retornam dados
- Testável sem browser

```js
// ✅ Correto — função pura
export function validateInitiativeLimit(initiatives, quarter, excludeId) {
  const count = countInitiativesInQuarter(initiatives, quarter, excludeId)
  if (count >= MAX_INITIATIVES_PER_QUARTER) return `Limite de 2...`
  return null
}

// ❌ Errado — lógica de negócio dentro do componente
function PETTab() {
  function submit() {
    const count = initiatives.filter(i => i.isInitiative && i.quarter === form.quarter).length
    if (count >= 2) { alert(...); return }  // ← isso pertence em domain/
  }
}
```

### store/ — estado global
- Única fonte de verdade para board data
- Toda mutation persiste automaticamente (localStorage + cloud)
- Componentes leem só o que precisam via seletores

```js
// Componente subscreve só o necessário — re-render eficiente
const sprintTasks = useBoardStore(s => s.sprintTasks)
const patchTask   = useBoardStore(s => s.patchTask)
```

### hooks/ — ponte entre domain e UI
- Encapsulam estado de form, validação, actions
- Componente chama `submit()`, hook chama `validateInitiativeLimit()` + `store.upsertInitiative()`
- Componente não sabe qual validação existe

### components/ — pura renderização
- Props puras quando possível (InitiativeCard recebe dados, não busca no store)
- Sem lógica de negócio no JSX
- Arquivos pequenos (< 150 linhas)

---

## Plano de migração incremental

O HTML original continua funcionando durante a migração. Migre um componente por vez:

### Fase 1 — já feita ✅
- [x] `domain/constants.js`
- [x] `domain/utils.js`
- [x] `domain/capacity.js`
- [x] `domain/initiatives.js`
- [x] `domain/board.js`
- [x] `domain/sync.js`
- [x] `store/useBoardStore.js`
- [x] `hooks/usePET.js`
- [x] `hooks/useSprint.js`
- [x] `components/shared/index.jsx`
- [x] `components/pet/InitiativeForm.jsx`
- [x] `components/pet/InitiativeCard.jsx`
- [x] `components/pet/PETTab.jsx`

### Fase 2 — próximos
- [ ] `components/setup/SetupTab.jsx`
- [ ] `components/sprint/BacklogTab.jsx`
- [ ] `components/sprint/SprintTab.jsx`

### Fase 3
- [ ] `components/board/KanbanView.jsx`
- [ ] `components/board/GanttView.jsx`
- [ ] `components/board/PETOverview.jsx`
- [ ] `components/board/BoardTab.jsx`
- [ ] `components/storage/StorageTab.jsx`
- [ ] Seletores/selectors com sprints e PET no Navbar

### Fase 4 — polimento
- [ ] Extrair `PETRoadmap` para componente próprio
- [ ] `SprintSelector` e `QuarterSelector` para `components/shared/`
- [ ] Separar `hooks/useBacklog.js`

---

## Como adicionar uma nova feature (exemplo: campo novo em Initiative)

**Antes (HTML monolítico):**
1. Caçar `efInit()` no meio de 2100 linhas
2. Caçar `submitInit()` — validar se não tem outra cópia
3. Caçar `startEdit()` — popular o campo
4. Caçar o form no JSX
5. Caçar o card no JSX
6. Risco de quebrar qualquer coisa sem ver

**Agora:**
1. `domain/initiatives.js` → adicionar ao `newInitiativeDefaults()`
2. `hooks/usePET.js` → adicionar ao `openEdit()` se necessário
3. `components/pet/InitiativeForm.jsx` → adicionar campo no form
4. `components/pet/InitiativeCard.jsx` → adicionar badge/display no card
5. Cada arquivo tem < 150 linhas, escopo claro

## Adicionando testes (futuro)

```bash
npm install -D vitest @testing-library/react

# domain/ é 100% testável sem setup
import { validateInitiativeLimit } from '@/domain/initiatives'

test('bloqueia 3ª iniciativa no mesmo quarter', () => {
  const initiatives = [
    { id: '1', isInitiative: true, quarter: 'Q1' },
    { id: '2', isInitiative: true, quarter: 'Q1' },
  ]
  expect(validateInitiativeLimit(initiatives, 'Q1')).toContain('Limite')
  expect(validateInitiativeLimit(initiatives, 'Q2')).toBeNull()
})
```
