# 📋 PDV Simples - Offline First

## 🚀 Visão Geral
Sistema de PDV otimizado para tablets, operando em modo offline-first com sincronização automática para Supabase. Focado em agilidade de atendimento e controle de caixa.

## 🛠️ Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database (Local)**: IndexedDB (via Dexie.js para facilidade)
- **Database (Cloud)**: Supabase (Auth + PostgreSQL)
- **Offline**: PWA (next-pwa)
- **Deployment**: Vercel

## 🏗️ Arquitetura de Sincronização
1. **Local First**: Toda venda é salva primeiro no IndexedDB.
2. **Background Sync**: Um Service Worker ou Hook monitora a conexão.
3. **Supabase Ingest**: Ao detectar rede, os pedidos pendentes são enviados em lote.

## 📝 Requisitos Funcionais

### 1. Gestão de Venda
- [ ] Seleção de data (Default: Hoje).
- [ ] Carrinho dinâmico com quantidades e variações.
- [ ] Nome do cliente opcional (Default: "Cliente").
- [ ] Campo de Observação.

### 2. Pagamento & Troco
- [ ] Métodos: Crédito, Débito, Pix, Dinheiro.
- [ ] Calculadora de troco inteligente.

### 3. Controle de Caixa
- [ ] Abertura de caixa (Saldo inicial + Hora).
- [ ] Fechamento de caixa (Total acumulado + Hora).
- [ ] Identificação do número do caixa (#1, #2, etc.).

### 4. Layout Tablet (Landscape)
- [ ] **Esquerda (60%)**: Grid de Categorias -> Lista de Produtos (Grid 3-4 colunas).
- [ ] **Direita (40%)**: Carrinho de Compras + Botão Finalizar.

### 5. Numeração de Pedido
- [ ] Formato incremental por dia: `#DDMM-NN` (ex: `#2904-01`).

## 📅 Roadmap de Desenvolvimento

### Fase 1: Fundação (Setup)
- [ ] Inicializar projeto Next.js.
- [ ] Configurar Tailwind & Design System (Tokens de cores premium).
- [ ] Configurar Dexie.js (IndexedDB).

### Fase 2: UI/UX (Layout Tablet)
- [ ] Implementar Grid de Categorias/Produtos.
- [ ] Criar Side-cart persistente.
- [ ] Modais de produto (Quantidade/Variações).

### Fase 3: Lógica de Venda & Pagamento
- [ ] Fluxo de checkout com cálculo de troco.
- [ ] Sistema de numeração incremental.

### Fase 4: Offline & Sync
- [ ] Implementar PWA.
- [ ] Lógica de sincronização com Supabase.

---
*Gerado via Antigravity Kit - Project Planner*
