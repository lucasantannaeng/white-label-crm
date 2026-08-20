# Solar Service CRM - Documentação Técnica Completa v3.2

> **Objetivo deste documento:** Fornecer contexto completo para que qualquer IA ou desenvolvedor entenda exatamente como o sistema funciona, suas regras de negócio, arquitetura, fluxos e restrições.

---

## 1. Visão Geral do Projeto

O **Solar Service CRM** é um sistema profissional e auto-configurável para gestão de empresas de energia solar no mercado brasileiro. Desenvolvido com foco em automação, inteligência artificial e customização de marca (White-Label).

**Público-alvo:** Empresas de manutenção e monitoramento de sistemas fotovoltaicos.

### 1.1 Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI/UX | Tailwind CSS + shadcn/ui + Framer Motion |
| Backend | Supabase (PostgreSQL + Edge Functions) via Lovable Cloud |
| Autenticação | Supabase Auth com JWT |
| Storage | Supabase Storage (4 buckets) |
| IA/ML | Gemini via Lovable AI Gateway |
| PWA | Vite PWA Plugin (ícones 192px e 512px) |
| PDF | jsPDF + jspdf-autotable |
| Docx | docxtemplater + PizZip |

### 1.2 Estrutura de Arquivos

```
src/
├── App.tsx                    # Router principal (/ → Index, /login → Login)
├── main.tsx                   # Entry point
├── index.css                  # Design tokens (HSL), tema dark/light
├── pages/
│   ├── Index.tsx              # Layout principal (Sidebar + página ativa)
│   ├── Login.tsx              # Tela de login/signup
│   └── NotFound.tsx           # 404
├── components/
│   ├── crm/                   # Componentes de negócio (22 arquivos)
│   │   ├── AppSidebar.tsx     # Menu lateral com controle de acesso por role
│   │   ├── DashboardPage.tsx  # KPIs e gráficos (admin only)
│   │   ├── ClientesPage.tsx   # CRUD de clientes + inversores
│   │   ├── AgendaPage.tsx     # Calendário + lista de agendamentos
│   │   ├── AgendaConflictDialog.tsx  # Resolução de conflitos de prioridade
│   │   ├── ServicosExtrasPage.tsx    # Criação de novos serviços/agendamentos
│   │   ├── ContratosPage.tsx  # Geração de contratos + confirmação de venda
│   │   ├── CalculadoraPage.tsx # Calculadora de preço de limpeza
│   │   ├── ComissoesPage.tsx  # Relatório de comissões por vendedor
│   │   ├── EquipesPage.tsx    # CRUD de equipes de serviço
│   │   ├── DocumentosPage.tsx # Galeria de documentos/fotos por cliente
│   │   ├── ConfiguracoesPage.tsx # Configurações gerais (master only)
│   │   ├── AIHubPage.tsx      # Hub de IA (voz, visão, rotas, clima)
│   │   ├── ChecklistVT.tsx    # Checklist de vistoria técnica
│   │   ├── SignaturePad.tsx   # Canvas para assinatura digital
│   │   ├── WeatherPopup.tsx   # Popup de alerta meteorológico
│   │   ├── NotificationBell.tsx # Sino de notificações em tempo real
│   │   ├── GerenciarUsuarios.tsx # CRUD de usuários (admin/master)
│   │   ├── GerenciarFaixasPreco.tsx # Editor de faixas de preço
│   │   ├── GerenciarPresetsModulos.tsx # Editor de presets de módulos
│   │   ├── MaskedInput.tsx    # Input com máscara (CPF/CNPJ/telefone)
│   │   └── SetupWizard.tsx    # Wizard de configuração inicial
│   └── ui/                    # shadcn/ui (45+ componentes)
├── hooks/
│   ├── useAuth.ts             # Auth state + role + signOut
│   ├── useConfiguracoes.ts    # Config da empresa (nome, logo, cor)
│   ├── useNotifications.ts    # Notificações em tempo real (Realtime)
│   ├── useRouteOptimizer.ts   # Trigger do otimizador de rotas IA
│   ├── useSystemCheck.ts      # Verificação de integridade do sistema
│   ├── use-mobile.tsx         # Detecção de viewport mobile
│   └── use-toast.ts           # Sistema de toasts
├── lib/
│   ├── utils.ts               # cn() helper (clsx + tailwind-merge)
│   ├── formatters.ts          # formatDate, formatCurrency, formatCPF
│   ├── contractUtils.ts       # Geração de contratos .docx
│   └── escapeHtml.ts          # Sanitização de HTML
└── integrations/supabase/
    ├── client.ts              # Cliente Supabase (auto-gerado)
    └── types.ts               # Tipos do banco (auto-gerado)

supabase/
├── config.toml                # Configuração do projeto (auto-gerado)
└── functions/                 # 7 Edge Functions
    ├── ai-image-analysis/     # Análise de fotos de placas
    ├── ai-route-optimizer/    # Designação automática de equipes
    ├── ai-voice-assistant/    # Diagnóstico de inversores por voz
    ├── ai-weather-alert/      # Alertas meteorológicos
    ├── export-backup/         # Exportação de dados
    ├── manage-users/          # CRUD de usuários (service_role)
    └── send-push-notification/ # Push notifications
```

---

## 2. Sistema de Autenticação e RBAC

### 2.1 Hierarquia de Papéis (4 Níveis)

O sistema implementa RBAC com **4 papéis** armazenados na tabela `user_roles` (NUNCA na tabela `profiles`):

| Papel | Enum | Quem | Permissões |
|-------|------|------|------------|
| **Master** | `master` | `admin@crm-solar.example` (configurável via env) | Acesso total + Configurações + Gerenciar Usuários |
| **Admin** | `admin` | Gestores designados pelo Master | Acesso total EXCETO Configurações |
| **Vendedor** | `vendedor` | Equipe comercial | Agenda, Clientes, Contratos, Calculadora, Hub IA |
| **Técnico** | `tecnico` | Equipe de campo | Agenda, Clientes (sem credenciais), Calculadora, Contratos (assinatura), Hub IA (Voz/Visão) |

**Regra crítica:** A função `has_role()` trata `master` como tendo **todas** as permissões de `admin`. Ou seja, `has_role(user_id, 'admin')` retorna `true` para master.

### 2.2 Páginas por Papel

| Página | Master | Admin | Vendedor | Técnico |
|--------|--------|-------|----------|---------|
| Dashboard | ✅ | ✅ | ❌ | ❌ |
| Agenda | ✅ | ✅ | ✅ | ✅ |
| Novos Serviços | ✅ | ✅ | ✅ | ✅ |
| Clientes | ✅ | ✅ | ✅ | ✅ (sem credenciais) |
| Calculadora | ✅ | ✅ | ✅ | ✅ (só valor total) |
| Contratos | ✅ | ✅ | ✅ | ✅ (assinatura) |
| Equipes | ✅ | ✅ | ❌ | ❌ |
| Comissões | ✅ | ✅ | ❌ | ❌ |
| Documentos | ✅ | ✅ | ❌ | ❌ |
| Hub IA | ✅ | ✅ | ✅ | ✅ (Voz/Visão) |
| Configurações | ✅ | ❌ | ❌ | ❌ |

### 2.3 Redirecionamento Automático

```
Login → useAuth() carrega role
  ├── master/admin → Dashboard (defaultPage)
  └── vendedor/tecnico → Agenda (defaultPage)
  
Se tentar acessar página não permitida → redireciona para defaultPage
```

### 2.4 Fluxo de Criação de Usuário (Trigger `handle_new_user`)

Quando um novo usuário é registrado no Auth, o trigger executa automaticamente:

```sql
1. INSERT INTO profiles (id, nome, email)       -- Cria perfil
2. Determina role:
   - Se é o PRIMEIRO usuário → role = 'master'
   - Caso contrário → role = 'tecnico'
3. INSERT INTO user_roles (user_id, role)        -- Atribui papel
4. INSERT INTO vendedores (nome, email, user_id) -- Cria vendedor vinculado
```

**Importante:** Todo usuário é automaticamente cadastrado como vendedor na tabela `vendedores` com `user_id` vinculado. Isso permite que qualquer usuário (incluindo admins) receba comissões de vendas.

### 2.5 Gerenciamento de Usuários (Edge Function `manage-users`)

Ações disponíveis (apenas para admin/master via service_role):

| Ação | Descrição |
|------|-----------|
| `list` | Lista todos os usuários com roles e nomes |
| `create` | Cria novo usuário (email + senha + nome + role) |
| `update_role` | Altera o papel de um usuário (não pode alterar o próprio) |
| `delete` | Remove um usuário (não pode remover a si mesmo) |

**Segurança:** A função valida que o caller é admin via JWT + consulta em `user_roles`. Usa `service_role_key` para operações admin do Auth.

---

## 3. Arquitetura de Dados

### 3.1 Diagrama de Tabelas

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    clientes      │────▶│  agendamentos   │◀────│    equipes      │
│                  │     │                 │     │                 │
│ vendedor_id ─────┼──▶  │ equipe_id ──────┼──▶  │ membros[]       │
└────────┬─────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │              ┌────────┴────────┐
         │              ▼                 ▼
         │      ┌───────────────┐ ┌────────────────┐
         ├─────▶│documentos_cliente│ │servicos_extras │
         │      └───────────────┘ └────────────────┘
         │
         └─────▶┌───────────────┐
                │  inversores    │ (1:N — múltiplos por cliente)
                └───────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ vendedores      │     │ presets_modulos  │     │  faixas_preco    │
│ user_id (unique)│     │ potencia_wp     │     │  tipo + faixas   │
└─────────────────┘     │ geracao_kwh     │     └──────────────────┘
                        └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ profiles        │     │ user_roles      │     │ configuracoes    │
│ id = auth.uid   │     │ user_id + role  │     │ empresa + tema   │
└─────────────────┘     └─────────────────┘     └──────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ notificacoes    │     │ comissoes       │     │ templates_contrato│
│ user_id + lida  │     │ vendedor_id     │     │ tipo + url       │
└─────────────────┘     │ mes/ano + pago  │     └──────────────────┘
                        └─────────────────┘

┌─────────────────┐
│ ai_logs         │
│ tipo + user_id  │
└─────────────────┘

┌──────────────────┐
│push_subscriptions│
│ user_id + keys   │
└──────────────────┘
```

### 3.2 Tabelas Detalhadas

#### `clientes`
| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| id | uuid (PK) | ✅ | Auto-gerado |
| nome | text | ✅ | Nome completo |
| documento | text | ✅ | CPF ou CNPJ |
| email | text | ❌ | Email de contato |
| telefone | text | ❌ | Telefone |
| rua, numero, bairro, cidade, uf, cep | text | ❌ | Endereço (obrigatório para contratos) |
| potencia_kwp | numeric | ❌ | Potência total do sistema |
| quantidade_placas | integer | ❌ | Número de módulos (default: 0) |
| kwh_mensal | numeric | ❌ | Geração mensal estimada (calculado via presets) |
| valor_mensal | numeric | ❌ | Valor do contrato de monitoramento (calculado via faixas) |
| valor_mensal_manual | numeric | ❌ | Override manual do valor mensal |
| inversor | text | ❌ | Modelo do inversor principal |
| login_inversor, senha_inversor | text | ❌ | Credenciais do inversor (oculto para técnicos) |
| login_internet, senha_internet | text | ❌ | Credenciais de internet (oculto para técnicos) |
| inicio_contrato | date | ❌ | Início do contrato (default: hoje) |
| duracao_meses | integer | ❌ | Duração do contrato (default: 12) |
| termino_contrato | date | ❌ | Calculado automaticamente (trigger) |
| vendedor_id | uuid (FK) | ❌ | Vendedor responsável (→ vendedores.id) |
| ativo | boolean | ❌ | Status (default: true) |
| observacoes | text | ❌ | Notas livres |

**Trigger `calcular_valores_cliente`:** Executa em INSERT/UPDATE. Se `valor_mensal_manual` está definido, usa ele. Senão, consulta `faixas_preco` com base no `kwh_mensal`. Também calcula `termino_contrato` a partir de `inicio_contrato + duracao_meses`.

**Trigger `criar_primeiro_agendamento`:** Em INSERT, se `inicio_contrato` existe e nenhum agendamento prévio, cria automaticamente uma "Limpeza Preventiva" para 3 meses após o início.

#### `agendamentos`
| Coluna | Tipo | Obrigatório | Default | Descrição |
|--------|------|-------------|---------|-----------|
| id | uuid (PK) | ✅ | auto | |
| cliente_id | uuid (FK) | ✅ | | → clientes.id |
| equipe_id | uuid (FK) | ❌ | null | → equipes.id (designado pela IA) |
| data_agendamento | date | ✅ | | Data do serviço |
| hora | text | ❌ | '08:00' | Horário |
| tipo | text | ✅ | 'Limpeza Preventiva' | Tipo do serviço |
| status | text | ✅ | 'Pendente' | Status atual |
| prioridade | text | ✅ | 'Normal' | Baixa/Normal/Alta/Urgente |
| tipo_contrato | text | ❌ | null | 'monitoramento' ou 'limpeza' (se veio de contrato) |
| venda_confirmada | boolean | ❌ | false | Se a venda foi confirmada |
| valor_servico | numeric | ❌ | 0 | Valor do serviço |
| data_confirmacao | date | ❌ | null | Data em que a venda foi confirmada |
| data_orcamento | date | ❌ | null | Data do orçamento |
| assinatura_digital_url | text | ❌ | null | URL da assinatura do cliente |
| observacoes | text | ❌ | null | Notas |

**Trigger `notify_agendamento_change`:** Em INSERT/UPDATE, notifica membros da equipe sobre novos agendamentos, reagendamentos ou mudanças de status.

#### `inversores` (1:N com clientes)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| cliente_id | uuid (FK) | → clientes.id |
| inversor | text | Modelo do inversor |
| potencia_kwp | numeric | Potência |
| quantidade_placas | integer | Número de módulos |
| kwh_mensal | numeric | Geração mensal |
| potencia_modulo_wp | numeric | Potência por módulo (Wp) |
| marca_modulos | text | Marca dos módulos |
| numero_serie | text | Número de série |
| login_inversor, senha_inversor | text | Credenciais |
| observacoes | text | Notas |

#### `vendedores`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid (PK) | Auto-gerado |
| nome | text | Nome do vendedor |
| email | text | Email |
| telefone | text | Telefone |
| user_id | uuid (FK, unique) | → auth.users.id (vínculo com login) |
| ativo | boolean | Status (default: true) |

**Regra:** Todo novo usuário é automaticamente cadastrado como vendedor (trigger `handle_new_user`). O `user_id` é único, garantindo vínculo 1:1 com o sistema de auth.

#### `faixas_preco`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| tipo | text | 'monitoramento' ou 'limpeza' |
| faixa_inicio | integer | Início da faixa (ex: 1, 11, 21) |
| faixa_fim | integer | Fim da faixa (null = sem limite) |
| valor | numeric | Valor por unidade/mês |
| ordem | integer | Ordem de processamento |
| label | text | Rótulo exibido |

#### `presets_modulos`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| potencia_wp | integer | Potência do módulo em Watts-pico |
| geracao_estimada_kwh | numeric | Geração mensal estimada por módulo |

**Uso:** No cadastro de clientes, o admin seleciona a potência do módulo. O sistema calcula: `kwh_mensal = geracao_estimada_kwh × quantidade_placas`. Esse valor determina a faixa de monitoramento.

### 3.3 View: `clientes_sem_credenciais`

View que expõe todos os campos de `clientes` **exceto** `login_inversor`, `senha_inversor`, `login_internet`, `senha_internet`, `valor_mensal_manual`. Usada por técnicos para consultar dados sem acesso a credenciais sensíveis.

### 3.4 RLS (Row-Level Security)

**Princípio geral:**
- Tabelas de configuração/preço: Admin gerencia, todos leem
- Tabelas de negócio (clientes, agendamentos): Admin full CRUD, técnicos só leitura
- Dados pessoais (profiles, notificações): Cada usuário vê os seus
- `has_role()` com `SECURITY DEFINER` evita recursão de RLS

**Resumo de políticas por tabela:**

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| clientes | admin + tecnico | admin | admin | admin |
| agendamentos | todos auth | todos auth | todos auth | admin |
| equipes | todos auth | admin | admin | admin |
| vendedores | todos auth | admin | admin | admin |
| comissoes | todos auth | admin | admin | admin |
| configuracoes | todos auth | admin | admin | admin |
| faixas_preco | todos auth | admin | admin | admin |
| templates_contrato | todos auth | admin | admin | admin |
| presets_modulos | todos auth | admin | admin | admin |
| profiles | próprio | próprio | próprio | ❌ |
| user_roles | próprio + admin | admin | admin | admin |
| notificacoes | próprio | admin | próprio | próprio |
| inversores | admin | admin | admin | admin |
| documentos_cliente | todos auth | todos auth | ❌ | admin |
| servicos_extras | todos auth | admin | admin | admin |
| ai_logs | próprio + admin | próprio | ❌ | ❌ |
| push_subscriptions | próprio | próprio | próprio | próprio |

---

## 4. Módulos e Funcionalidades

### 4.1 Dashboard Administrativo (Admin/Master)

**KPIs em tempo real (cards):**
- Receita Mensal Total (destaque)
- Quantidade de clientes ativos
- Agendamentos pendentes
- Serviços extras em aberto

**Gráficos:**
- Receita por Faixa de Monitoramento (eixo Y = número de clientes)
- Agendamentos por Status (pizza)
- Distribuição de Clientes por Tipo

**Alertas Meteorológicos (WeatherPopup):**
- Integração Open-Meteo (sem API key)
- Alerta proativo se probabilidade de chuva ≥ 75%
- Mostra 3 dias de previsão
- Sugestão automática de adiamento de limpezas
- Aparece apenas para admin/master

### 4.2 Gestão de Clientes (ClientesPage)

**Funcionalidades:**
- CRUD completo (admin) / Somente leitura (técnico)
- Busca por nome
- Botão "Novo Cliente" oculto para técnicos
- Formulário com abas: Dados Básicos, Endereço, Dados Técnicos, Credenciais
- Credenciais (login/senha inversor e internet) ocultas para técnicos

**Cálculo automático de kWh:**
```
1. Admin seleciona potência do módulo (preset) → ex: 550Wp
2. Sistema busca geracao_estimada_kwh do preset → ex: 68.75 kWh
3. kwh_mensal = 68.75 × quantidade_placas
4. Trigger calcular_valores_cliente → busca faixa de preço → define valor_mensal
```

**Inversores (sub-componente):**
- Múltiplos inversores por cliente
- Campos: modelo, potência, módulos, kWh, série, marca, Wp
- Edição inline na página do cliente

### 4.3 Calculadora de Limpeza (CalculadoraPage)

**Lógica de Precificação (RPC: `calcular_preco_limpeza`):**

Faixas progressivas (configuráveis via ConfiguraçõesPage):

| Faixa | Quantidade | Valor por Módulo |
|-------|------------|------------------|
| 1 | 1-10 | R$ 45,00 |
| 2 | 11-20 | R$ 40,00 |
| 3 | 21-30 | R$ 35,00 |
| 4 | 31+ | R$ 30,00 |

**Benchmark:** 31 módulos = R$ 1.385,00

```
10 × R$ 45,00 = R$ 450,00
10 × R$ 40,00 = R$ 400,00
10 × R$ 35,00 = R$ 350,00
 1 × R$ 30,00 = R$  30,00
─────────────────────────
Total           = R$ 1.385,00
```

**Restrição para técnicos:** Veem apenas o valor total final, sem o detalhamento por faixa.

### 4.4 Contratos e Documentos (ContratosPage)

**Tipos de Contrato:**

1. **Monitoramento:**
   - Geração automática de agendamentos ao confirmar:
     - VT (Visita Técnica): 7 dias após início
     - Limpeza Preventiva: 3 meses após início
   - Valor mensal calculado automaticamente por faixa de kWh
   - Pode ter valor manual (override)

2. **Limpeza Avulsa:**
   - Fluxo: Proposta → Venda Confirmada → Agendado (D+15)
   - Agendamento automático para 15 dias após confirmação

**Fluxo de geração de contrato:**
```
1. Selecionar categoria (monitoramento/limpeza)
2. Selecionar cliente (com validação de dados)
3. Selecionar vendedor responsável (opcional)
4. Gerar resumo com valores
5. Gerar documento .docx (se template disponível)
6. Criar agendamento com status "Aguardando Confirmação"
7. Disparar otimizador de rotas IA
```

**Confirmação de venda (dialog com campos):**
- Data da limpeza
- Equipe responsável
- Vendedor responsável (atualiza vendedor_id no cliente)

**Tags dinâmicas para templates .docx:**
- `{cliente_nome}`, `{cliente_documento}`, `{cliente_endereco}`
- `{valor_total}`, `{valor_extenso}`
- `{data_atual}`, `{data_extenso}`
- `{quantidade_placas}`, `{potencia_kwp}`

**Assinatura digital:**
- Canvas HTML5 para coleta de assinatura (SignaturePad)
- Upload para bucket `assinaturas`
- Obrigatória para marcar agendamento como "Concluído"

### 4.5 Agenda (AgendaPage)

Aba dedicada à **visualização e gestão** dos agendamentos existentes. NÃO cria novos agendamentos (isso é feito em "Novos Serviços" ou "Contratos").

**Visualização:**
- Calendário mensal com navegação
- Lista filtrada por status e tipo
- Agendamentos de contratos só aparecem após "Venda Confirmada"
- Indicador ⏳ para itens sem equipe designada
- Cores por prioridade no calendário (🟢🔵🟠🔴)

**Edição de agendamento (dialog):**
- Data, Hora, Status, Equipe, Prioridade, Observações
- Restrições para técnicos: não podem alterar status ou datas
- Assinatura obrigatória para status "Concluído"
- Exclusão apenas por admin

**PDF diário:**
- Gera PDF da agenda do dia com: cliente, endereço, equipe, inversor, Nº placas, observações, valor
- Formato landscape A4

**Limites de Produtividade por Equipe/Dia:**

| Limpezas no dia | VTs permitidas | Total máximo |
|-----------------|----------------|--------------|
| 0 | 4 | 4 serviços |
| 1 | 2 | 3 serviços |
| 2 | 0 | 2 serviços |

### 4.6 Novos Serviços (ServicosExtrasPage)

Aba unificada para criação de **todos os tipos de agendamento**.

**Tipos disponíveis:**
- Limpeza Preventiva, Limpeza Avulsa, Vistoria Técnica, Manutenção Corretiva, Inspeção
- Troca de Inversor, Troca de Módulo, Reparo Elétrico, Extensão de Cabeamento, Instalação de Monitoramento, Outro

**Lógica condicional:**
- Tipos "extras" (Troca de Inversor, Reparo Elétrico, etc.) criam registros **tanto** em `servicos_extras` quanto em `agendamentos`
- Tipos normais (Limpeza, VT) criam apenas em `agendamentos`
- Equipe é designada automaticamente pela IA após criação

**Histórico:** Tabela com busca, filtro por status, e ações de atualização (Pendente → Em Andamento → Concluído)

### 4.7 Sistema de Prioridades (4 Níveis)

| Nível | Emoji | Cor | Peso | Comportamento |
|-------|-------|-----|------|---------------|
| 🟢 Baixa | 🟢 | emerald | 1 | Primeiro a ser deslocado em conflitos |
| 🔵 Normal | 🔵 | blue | 2 | Padrão para novos agendamentos |
| 🟠 Alta | 🟠 | orange | 3 | Pode deslocar Baixa e Normal |
| 🔴 Urgente | 🔴 | destructive | 4 | Pode deslocar tudo, NUNCA é deslocado |

**Resolução de Conflitos (AgendaConflictDialog):**

```
1. Novo agendamento excede capacidade do dia
   ├── Prioridade MAIOR que algum item existente?
   │   ├── SIM → Abre diálogo de conflito
   │   │   - Lista itens ordenados por prioridade CRESCENTE (Baixa primeiro)
   │   │   - Itens "Urgente" NUNCA aparecem na lista (não podem ser deslocados)
   │   │   - Mostra badge de prioridade de cada item
   │   │   - Legenda visual: 🟢 Baixa → 🔵 Normal → 🟠 Alta | 🔴 protegido
   │   │   - Admin seleciona item a deslocar
   │   │   - Sistema sugere próxima data disponível (até 60 dias, ignora domingos)
   │   │   - Admin confirma ou escolhe data manualmente
   │   │   - Valida se nova data tem capacidade
   │   └── NÃO → Sugere próxima data disponível para o NOVO item
   │
2. Se TODOS os itens do dia são "Urgente":
   - Mensagem informativa: "Todos os agendamentos são Urgente"
   - Sugere agendar para outra data
```

**Sugestão Inteligente de Datas (`findNextAvailableDate`):**
- Varre até 60 dias a partir da data base
- Pula domingos
- Verifica limites de produtividade da equipe
- Retorna a primeira data com capacidade para o tipo de serviço

### 4.8 Comissões (ComissoesPage)

- Percentual configurável (default: 10%) em `configuracoes.comissao_percentual`
- Cálculo: `comissao = valor_mensal × percentual / 100`
- Controle mensal por vendedor (mês/ano)
- Status: Pendente / Pago
- Data de pagamento registrada

### 4.9 Equipes (EquipesPage)

- CRUD de equipes: nome, membros (array de user_ids), ativo
- Vinculação automática com agendamentos via IA
- Calendário mostra nome da equipe no tooltip

### 4.10 Documentos (DocumentosPage)

- Galeria de documentos/fotos por cliente
- Tipos: foto_vt, contrato, proposta, assinatura
- Upload para bucket `documentos-clientes`
- Filtro por cliente

### 4.11 Hub de IA (AIHubPage)

| Módulo | Edge Function | Modelo IA | Acesso |
|--------|--------------|-----------|--------|
| Assistente de Voz | `ai-voice-assistant` | Gemini | Todos |
| Visão Computacional | `ai-image-analysis` | Gemini | Todos |
| Otimização de Rotas | `ai-route-optimizer` | Gemini | Admin/Master |
| Alertas Climáticos | `ai-weather-alert` | Gemini | Admin/Master |

**Assistente de Voz:**
- Speech-to-text via Web Speech API
- Prompt enviado ao Gemini para diagnóstico de inversores
- Exemplo: "Erro 30 no inversor Goodwe" → Resposta com diagnóstico e passos

**Visão Computacional:**
- Upload de foto → análise via Gemini Vision
- Detecta sujeira, danos, enquadramento
- Compara before/after

**Otimizador de Rotas (`ai-route-optimizer`):**

Regras passadas ao Gemini:
```
1. Agrupar clientes da mesma CIDADE no mesmo dia/equipe
2. Máximo 2 limpezas por equipe/dia
3. VTs: 4 (se 0 limpezas), 2 (se 1 limpeza), 0 (se 2 limpezas)
4. Distribuir trabalho igualitariamente entre equipes
5. PRIORIDADE: Urgente > Alta > Normal > Baixa
   - Urgente DEVE ser atendido no dia agendado
   - Alta tem preferência sobre Normal/Baixa
   - Baixa pode ser redistribuído se necessário
```

Fluxo:
```
1. Busca agendamentos sem equipe (status Pendente/Confirmado, equipe_id IS NULL)
2. Busca equipes ativas
3. Busca agendamentos já designados nas mesmas datas (para respeitar limites)
4. Envia tudo ao Gemini com tool_call "assign_teams"
5. Recebe array de {agendamento_id, equipe_id, motivo}
6. Valida IDs e aplica updates
7. Loga em ai_logs
```

Disparado automaticamente por `triggerRouteOptimizer()` após:
- Criação de contrato
- Confirmação de venda
- Criação de novo serviço

### 4.12 Configurações (ConfiguracoesPage) — Master Only

| Seção | Componente | Descrição |
|-------|-----------|-----------|
| Dados da Empresa | inline | Nome, logo (upload), cor primária (White-Label) |
| Faixas de Preço | GerenciarFaixasPreco | Tabelas editáveis para limpeza e monitoramento |
| Presets de Módulos | GerenciarPresetsModulos | Tabela de potências (Wp) × gerações (kWh) |
| Comissão | inline | Percentual de comissão para vendedores |
| Gerenciar Usuários | GerenciarUsuarios | CRUD de usuários com seletor de role |

### 4.13 Notificações (NotificationBell + useNotifications)

- Sino no header com badge de contagem
- Realtime via Supabase Realtime (canal postgres_changes)
- Trigger `notify_agendamento_change` gera notificações para membros da equipe
- Tipos: agendamento, info
- Ações: marcar como lida, excluir

---

## 5. Fluxos de Status

### 5.1 Limpeza Avulsa (via Contratos)

```
Proposta (Cinza) — Contrato gerado, aguardando confirmação
    ↓ [Admin clica "Confirmar Venda" + seleciona equipe + vendedor]
Venda Confirmada (Verde) — Agendamento automático D+15
    ↓ [Após serviço + assinatura digital coletada]
Concluído (Azul)
```

### 5.2 Agendamentos

```
Pendente → Confirmado → Concluído
    ↓          ↓
Cancelado  Reagendado
    
Nota: "Concluído" exige assinatura_digital_url preenchida
```

### 5.3 Serviços Extras

```
Pendente → Em Andamento → Concluído
    ↓
Cancelado
```

---

## 6. Storage e Arquivos

### 6.1 Buckets Configurados

| Bucket | Propósito | Público | Conteúdo |
|--------|-----------|---------|----------|
| `contratos` | Templates .docx | ✅ | Modelos de contrato editáveis |
| `documentos-clientes` | Fotos e documentos | ✅ | Fotos de VT, relatórios |
| `assinaturas` | Assinaturas digitais | ✅ | PNG gerados pelo SignaturePad |
| `assets` | Recursos de marca | ✅ | Logo da empresa |

### 6.2 Fluxo de Upload

```
1. Usuário seleciona arquivo / desenha assinatura
2. Validação de tipo (jpg, png, pdf, docx)
3. Upload para Supabase Storage (bucket específico)
4. URL pública salva no banco (documentos_cliente.url ou agendamentos.assinatura_digital_url)
5. Registro em documentos_cliente (se aplicável)
```

---

## 7. Hooks Customizados

| Hook | Propósito | Retorno |
|------|-----------|---------|
| `useAuth()` | Estado de autenticação | `{ user, role, nome, loading, signOut, isAdmin, isMaster }` |
| `useConfiguracoes()` | Config da empresa | `{ config: { nome_empresa, logo_url, cor_primaria, comissao_percentual } }` |
| `useNotifications(userId)` | Notificações realtime | `{ notifications, unreadCount, markAsRead, deleteNotification }` |
| `useRouteOptimizer()` | Trigger da IA de rotas | `{ triggerRouteOptimizer }` |
| `useSystemCheck()` | Verifica integridade | `{ isReady, loading }` |
| `useIsMobile()` | Viewport mobile | `boolean` |

---

## 8. Database Functions (RPC)

| Função | Tipo | Descrição |
|--------|------|-----------|
| `calcular_preco_limpeza(p_quantidade_modulos)` | STABLE | Calcula preço total de limpeza por faixas progressivas |
| `has_role(_user_id, _role)` | STABLE, SECURITY DEFINER | Verifica se usuário tem determinado papel. Master retorna true para 'admin' |
| `is_master(_user_id)` | STABLE, SECURITY DEFINER | Verifica se é master |
| `handle_new_user()` | TRIGGER (auth.users INSERT) | Cria profile + role + vendedor |
| `calcular_valores_cliente()` | TRIGGER (clientes INSERT/UPDATE) | Calcula valor_mensal e termino_contrato |
| `criar_primeiro_agendamento()` | TRIGGER (clientes INSERT) | Cria limpeza preventiva D+90 |
| `notify_agendamento_change()` | TRIGGER (agendamentos INSERT/UPDATE) | Notifica equipe |
| `update_updated_at_column()` | TRIGGER (várias tabelas) | Atualiza timestamp |

---

## 9. Edge Functions

| Função | Auth | Descrição |
|--------|------|-----------|
| `ai-voice-assistant` | JWT | Diagnóstico de inversores via voz (Gemini) |
| `ai-image-analysis` | JWT | Análise de fotos de placas (Gemini Vision) |
| `ai-route-optimizer` | JWT | Designação automática de equipes (Gemini + tool_call) |
| `ai-weather-alert` | JWT | Previsão meteorológica (Open-Meteo + Gemini) |
| `export-backup` | JWT | Exportação de dados em JSON |
| `manage-users` | JWT + admin check | CRUD de usuários via service_role |
| `send-push-notification` | JWT | Envio de push notifications |

**Secrets configurados:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY` (gateway de IA)

---

## 10. Regras de Negócio Críticas

### 10.1 Validações

```typescript
// Contratos — validação obrigatória antes de gerar
validarCliente(cliente): boolean {
  return cliente.rua && cliente.numero && cliente.cidade && 
         cliente.uf && cliente.cep &&              // Endereço completo
         cliente.documento &&                       // CPF/CNPJ
         cliente.quantidade_placas > 0;             // Dados técnicos
}

// Agendamentos — limite de capacidade por equipe/dia
validarLimiteEquipe(equipeId, data): boolean {
  const limpezas = countByTipo(equipeId, data, 'limpeza');
  const vts = countByTipo(equipeId, data, 'vt');
  if (limpezas >= 2) return false;
  if (limpezas === 0 && vts >= 4) return false;
  if (limpezas === 1 && vts >= 2) return false;
  return true;
}

// Conclusão — assinatura obrigatória
finalizarServico(agendamento): boolean {
  return !!agendamento.assinatura_digital_url;
}
```

### 10.2 Regras de Prioridade na IA

O `ai-route-optimizer` recebe a prioridade de cada agendamento e aplica:
- 🔴 Urgente: DEVE ser atendido no dia. Melhor equipe disponível.
- 🟠 Alta: Atender no dia sempre que possível. Equipes com menos carga.
- 🔵 Normal: Distribuição padrão.
- 🟢 Baixa: Pode ser redistribuído para acomodar prioridades maiores.

### 10.3 White-Label

O sistema é personalizável via `configuracoes`:
- `nome_empresa` → aparece no sidebar, PDF, rodapé
- `logo_url` → logo no sidebar (fallback: ícone solar)
- `cor_primaria` → HSL aplicado como CSS custom property `--primary`

---

## 11. Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| "Should have a queue" | useAuth chamado múltiplas vezes | Passar isAdmin como prop |
| "RLS violation" | user_id nulo em ai_logs | Incluir user_id no insert |
| "Data um dia atrasada" | Timezone UTC vs local | Usar formatDate refatorado |
| Contrato não gera | Endereço incompleto | Validar todos os campos |
| kWh não calcula | Preset não selecionado | Selecionar potência do módulo |
| Vendedor não aparece | Usuário criado antes do trigger | Executar INSERT manual em vendedores |
| Equipe não designada | Nenhuma equipe ativa | Cadastrar equipe com ativo=true |

---

## 12. Configuração Inicial (Deploy)

```sql
-- 1. Faixas de preço padrão
INSERT INTO faixas_preco (tipo, faixa_inicio, faixa_fim, valor, ordem, label) VALUES
('limpeza', 1, 10, 45.00, 1, 'Até 10 módulos'),
('limpeza', 11, 20, 40.00, 2, '11-20 módulos'),
('limpeza', 21, 30, 35.00, 3, '21-30 módulos'),
('limpeza', 31, NULL, 30.00, 4, 'Acima de 30 módulos');

-- 2. Configurações padrão
INSERT INTO configuracoes (nome_empresa, cor_primaria, comissao_percentual) 
VALUES ('Solar Service', '25 95% 53%', 10);

-- 3. Presets de módulos (inseridos via migration)
-- 330Wp a 900Wp com gerações estimadas
```

**Checklist de Go-Live:**
- [x] Faixas de preço cadastradas
- [x] Presets de módulos cadastrados
- [x] Buckets de storage configurados
- [x] Edge Functions deployadas
- [x] Primeiro usuário master criado (admin@crm-solar.example)
- [ ] Templates de contrato .docx uploadados
- [ ] Configurações de marca personalizadas
- [ ] Equipes de serviço cadastradas
- [ ] Teste de assinatura digital

---

## 13. Responsividade e Otimização por Dispositivo

### 13.1 Estratégia de Layout

| Breakpoint | Dispositivo | Comportamento |
|------------|------------|---------------|
| `< 640px` (sm) | Mobile/PWA | Cards em vez de tabelas, calendário com dots, padding reduzido |
| `640px–1024px` (md) | Tablet | Tabelas com colunas ocultas seletivamente |
| `> 1024px` (lg) | Desktop | Layout completo com sidebar expandida |

### 13.2 Padrões Implementados

**Tabelas → Cards no Mobile:**
Todas as tabelas de dados (Agenda, Clientes, Contratos, Serviços, Comissões, Documentos) usam `hidden sm:table` para desktop e `sm:hidden` para cards mobile. Cards mostram informações essenciais com layout compacto.

**Calendário Adaptativo (AgendaPage):**
- Desktop: dias da semana por extenso, texto dos agendamentos nos dias
- Mobile: dias abreviados (1 letra), dots coloridos por prioridade nos dias, texto omitido

**Touch-Friendly (CSS `@media (pointer: coarse)`):**
- `min-height: 44px` em botões e inputs (guideline Apple HIG)
- `font-size: 16px !important` em inputs (previne zoom automático no iOS)

**PWA Safe Areas:**
- `viewport-fit=cover` no meta tag
- `padding-bottom: env(safe-area-inset-bottom)` para área segura

**Scrollbar Mobile:**
- `-webkit-overflow-scrolling: touch` para scroll suave
- Scrollbars ocultas em mobile para limpeza visual

### 13.3 Classes Utilitárias Customizadas

```css
.mobile-card       — glass-card com padding e spacing para cards mobile
.mobile-card-row   — flex row para label/valor em cards
.mobile-card-label — texto xs muted para labels
.mobile-card-value — texto sm bold para valores
.safe-bottom       — padding-bottom com safe-area-inset
```

### 13.4 Sidebar Responsiva

- Desktop: sidebar colapsável com mini-modo (ícones)
- Mobile/PWA: overlay com backdrop, fecha ao navegar
- Botão flutuante `<Menu>` para reabrir em mobile

---

## 14. Roadmap Futuro

- [ ] Integração com gateways de pagamento (Stripe/Pagar.me)
- [ ] App mobile nativo (React Native)
- [ ] Dashboard de performance individual por vendedor/técnico
- [ ] Integração com inversores via API (SMA, Growatt, Goodwe)
- [ ] Módulo de estoque e peças
- [ ] Relatórios automatizados por email
- [ ] Agenda com drag-and-drop para reagendamento
- [ ] Chat interno entre equipes

---

**Documento atualizado em:** 13/03/2026  
**Versão do sistema:** 3.1  
**Status:** Pronto para produção ✅
