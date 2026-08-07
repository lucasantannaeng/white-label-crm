# 💼 White Label CRM — Sistema Multi-Tenant de Gestão de Clientes e Serviços Técnicos

[![React](https://img.shields.io/badge/React-18.3-blue.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Edge%20Functions-green.svg?logo=supabase)](https://supabase.com/)
[![DevSecOps](https://img.shields.io/badge/DevSecOps-Audited%20%26%20Sanitized-brightgreen.svg)]()

**White Label CRM** é uma plataforma CRM completa e customizável (White Label) desenvolvida para empresas de serviços técnicos, energia solar e engenharia de campo. O sistema oferece gestão unificada de leads, clientes, contratos, agendamentos, rotas operacionais, comissões de vendas, assinaturas digitais e automações inteligentes alimentadas por Edge Functions com IA.

---

## 🚀 Principais Funcionalidades

- 👥 **Gestão Completa de Clientes & Oportunidades**: Pipeline de atendimento, cadastro detalhado de clientes, histórico de serviços e documentos.
- 📄 **Contratos & Assinaturas Digitais**: Emissão de contratos operacionais e coleta de assinatura digital em campo (`SignaturePad`).
- 📅 **Agenda Operacional com Detecção de Conflitos**: Agendamento de vistorias e instalações com algoritmo automático de prevenção de choque de horários (`AgendaConflictDialog`).
- 🚗 **Otimizador de Rotas & Equipes de Campo**:
  - Organização de rotas diárias de serviços por proximidade geográfica.
  - Alertas meteorológicos automatizados em tempo real (`WeatherPopup` / `ai-weather-alert`).
  - Vistoria técnica padronizada via checklists dinâmicos (`ChecklistVT`).
- 🤖 **Recursos Avançados de Inteligência Artificial (Edge Functions)**:
  - **Análise de Imagens (`ai-image-analysis`)**: Leitura automatizada de placas fotovoltaicas e equipamentos por visão computacional.
  - **Otimizador de Rotas (`ai-route-optimizer`)**: Designação inteligente de equipes usando LLMs.
  - **Assistente de Voz (`ai-voice-assistant`)**: Comandos e registro de ocorrências operacionais por áudio.
- 💵 **Gestão Financeira & Comissões**: Cálculo automático de comissões por faixa de vendas e presets de preços configuráveis.
- ⚙️ **Personalização White Label**: Suporte a temas, logotipos e ativação modular de funcionalidades por tenant/empresa (`SetupWizard` & `GerenciarPresetsModulos`).

---

## 🛠️ Stack Tecnológica

### **Frontend & Interface**
- **Core:** React 18 + TypeScript
- **Bundler:** Vite
- **Estilização:** Tailwind CSS + Radix UI (shadcn/ui) + Lucide Icons
- **Assinatura & Formulários:** Signature Pad + React Hook Form + Zod

### **Backend & Serverless Edge Functions**
- **Banco de Dados & Autenticação:** Supabase PostgreSQL com Row Level Security (RLS)
- **Supabase Edge Functions (Deno / TypeScript):**
  - `ai-image-analysis`: Visão computacional com Gemini Vision.
  - `ai-route-optimizer`: Algoritmos de roteamento e designação de equipes.
  - `ai-weather-alert`: Integração meteorológica Open-Meteo + Gemini.
  - `manage-users`: Administração de usuários e controle RBAC.
  - `export-backup`: Exportação segura de dados corporativos.
  - `send-push-notification`: Notificações push em tempo real.

---

## ⚙️ Configuração de Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto com base no modelo fornecido no `.env.example`:

```env
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID="seu_project_id_aqui"
VITE_SUPABASE_PUBLISHABLE_KEY="sua_chave_publica_anonima_aqui"
VITE_SUPABASE_URL="https://seu_project_id.supabase.co"
```

> 🛡️ **DevSecOps Note:** O arquivo `.env` contendo credenciais reais está estritamente ignorado no `.gitignore` e não exposto no versionamento.

---

## 💻 Guia de Execução Local

### Pré-requisitos
- **Node.js** v18+
- Gerenciador de pacotes: **npm** ou **bun**

### Passo a Passo

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/lucasantannaeng/white-label-crm.git
   cd white-label-crm
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   # ou
   bun install
   ```

3. **Configurar as Variáveis de Ambiente:**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env preenchendo as variáveis correspondentes ao Supabase
   ```

4. **Executar a Aplicação:**
   ```bash
   npm run dev
   # ou
   bun dev
   ```
   Acesse a aplicação no navegador em `http://localhost:8080`.

---

## 📜 Scripts Disponíveis

- `npm run dev`: Inicia o servidor de desenvolvimento Vite.
- `npm run build`: Compila a aplicação para produção na pasta `dist/`.
- `npm run preview`: Executa a visualização do build compilado.
- `npm run lint`: Executa a verificação estática do código com ESLint.
- `npm run test`: Executa os testes automatizados com Vitest.

---

## 🔒 Conformidade DevSecOps

Este projeto cumpre integralmente os requisitos de segurança da informação:
- Isenção total de segredos ou tokens de acesso em hardcode.
- Bloqueio completo no `.gitignore` para arquivos `.env`, `node_modules` e artefatos de build.
- Arquitetura de isolamento multi-tenant baseada em Row Level Security (RLS) no PostgreSQL.
