# SPRINT UX PREMIUM — RELATÓRIO CONSOLIDADO

**Data**: 05/06/2026  
**Escopo**: Diagnóstico UX Premium (Fases 1 a 5)  
**Modo**: CTO Silencioso — Diagnóstico + Roadmap + Propostas (sem implementação)

---

## SUMÁRIO EXECUTIVO

O AgroLex possui uma base técnica sólida, mas a experiência do usuário ainda carrega fortes traços de MVP. A interface comunica "ferramenta em construção" em vez de "plataforma profissional de auditoria fundiária". Há gap significativo entre a complexidade do motor de IA e a percepção de valor transmitida pela UI. O relatório a seguir mapeia cada ponto de atrito, propõe correções e prioriza por impacto em conversão/retenção.

---

# FASE 1 — DIAGNÓSTICO UX COMPLETO

## 1.1 LANDING PAGE (`src/app/page.tsx`)

### Pontos Amadores / MVP

| # | Problema | Impacto |
|---|----------|---------|
| 1.1.1 | **Headline genérica**: "Inteligência Artificial para Segurança Fundiária" — não diferencia o AgroLex de qualquer ferramenta de IA. Não vende segurança jurídica, vende tecnologia. | Reduz autoridade e taxa de conversão |
| 1.1.2 | **CTA "Começar Análise"** no header — linguagem de SaaS genérico. Profissionais do agronegócio/jurídico não "começam análise", eles "solicitam auditoria" ou "contratam dossiê". | Reduz percepção de valor |
| 1.1.3 | **Background image do hero** é foto genérica de plantação (Unsplash). Parece template de site de fazenda, não de inteligência fundiária. | Reduz autoridade profissional |
| 1.1.4 | **Features Section** tem 3 cards apenas — parece produto incompleto. Profundidade insuficiente para convencer um advogado ou pecuarista a contratar. | Reduz conversão |
| 1.1.5 | **"Agendar Demonstração"** link ancora para `#planos` mas não há seção de planos renderizada (não existe `id="planos"` no DOM). Link quebrado. | Reduz confiança |
| 1.1.6 | **FAQ** com apenas 4 perguntas — parece que o produto não tem casos de uso suficientes. | Reduz credibilidade |
| 1.1.7 | **Footer fraco**: "A tecnologia que o agronegócio brasileiro confia" sem logos de clientes, selos, certificações ou dados de contato profissional. | Reduz confiança |
| 1.1.8 | **Seção "Como Funciona em 3 Passos"** — o passo 2 menciona "Processamento e Pix". Pagamento não deveria ser protagonista do pitch de venda. | Reduz valor percebido |
| 1.1.9 | **Nenhuma prova social**: sem depoimentos, cases de sucesso, selos de confiança, dados de clientes atendidos. | Impacto crítico em conversão B2B |
| 1.1.10 | **Cores**: fundo escuro (#051F15) com texto branco cria contraste limitado. A marca usa "brand-gold" (#D4AF37) mas sem consistência dramática. | Impacto médio em percepção de qualidade |

### O que transmite falta de autoridade

- A landing parece um MVP de startup, não uma plataforma de auditoria fundiária.
- Não há selos OAB, CREA, INCRA, ou qualquer chancela institucional.
- O tom é de "ferramenta experimental", não de "parceiro de segurança jurídica".

---

## 1.2 LOGIN (`src/app/(auth)/login/page.tsx`)

### Pontos Amadores / MVP

| # | Problema | Impacto |
|---|----------|---------|
| 1.2.1 | **Design básico, sem identidade visual forte**: fundo branco/cinza genérico, sem elementos visuais que transmitam segurança. | Reduz confiança pré-login |
| 1.2.2 | **"Acesse sua conta"** — microcopy sem personalidade. Poderia reforçar o posicionamento. | Impacto baixo mas cumulativo |
| 1.2.3 | **Botão "Entrar"** usa cor verde escuro (#064E3B) em vez de ouro (brand-gold). O CTA principal perde hierarquia visual. | Impacto médio em conversão |
| 1.2.4 | **Feedback de erro genérico**: "E-mail ou senha incorretos" sem opção "Esqueci minha senha" visível na tela. | Impacto alto em retenção/cadastro |
| 1.2.5 | **Nenhum elemento de confiança** (selo SSL, "seus dados protegidos", etc.) na página de login — crítica para produto que lida com documentos jurídicos. | Impacto crítico em confiança |

---

## 1.3 CADASTRO (`src/app/(auth)/cadastro/page.tsx`)

### Pontos Amadores / MVP

| # | Problema | Impacto |
|---|----------|---------|
| 1.3.1 | **Alert() no sucesso do cadastro** — linha 39: `alert('Cadastro realizado com sucesso!...')`. Alert nativo do navegador em 2026 é inaceitável. | Impacto crítico em percepção de qualidade |
| 1.3.2 | **Formulário extenso**: 5 campos obrigatórios (nome, whatsapp, email, senha) sem progressão visual. | Impacto alto em abandono |
| 1.3.3 | **Sem verificação de força de senha** — não há feedback visual de segurança. | Impacto médio |
| 1.3.4 | **Sem login social** (Google, LinkedIn) — para público jurídico/agro, LinkedIn seria diferencial. | Impacto médio em conversão |
| 1.3.5 | **"Crie sua conta"** — microcopy sem contexto de valor. Não explica o que o usuário ganha ao se cadastrar. | Impacto médio |

---

## 1.4 DASHBOARD (`src/app/dashboard/page.tsx`)

### Pontos Amadores / MVP

| # | Problema | Impacto |
|---|----------|---------|
| 1.4.1 | **"Seu Painel"** como título principal — linguagem genérica. Não comunica "Centro de Inteligência Fundiária". | Reduz valor percebido |
| 1.4.2 | **3 cards de estatísticas pobres**: "Análises Concluídas", "Score Médio Portfólio" (valor FIXO 920/1000 — não dinâmico), "Riscos Altos Detectados". Não há dados de área (hectares), horas economizadas, ou Índice AgroLex. | Crítico — dados parecem mockados |
| 1.4.3 | **Score fixo 920/1000** — hardcoded. Se não é real, não deve aparecer. Se é real, precisa ter cálculo visível. | Impacto crítico em confiança |
| 1.4.4 | **Tabela de análises densa e amadora**: sem busca, sem filtros, sem paginação. Mais de 10 colunas de informação. | Impacto alto em usabilidade |
| 1.4.5 | **Botão "Nova Análise"** com linguagem amadora. Profissionais solicitam "Auditoria", não "Nova Análise". | Impacto médio |
| 1.4.6 | **Modal de módulos complementares com design genérico**: UX funcional mas sem refinamento visual. | Impacto médio |
| 1.4.7 | **Toast notification simples**: funcional mas sem design system consistente. | Impacto baixo |
| 1.4.8 | **Navegação mínima**: apenas logo + nome do usuário + botão "Sair". Sem menu lateral, sem atalhos para configurações, histórico, perfil. | Impacto alto em retenção |

---

## 1.5 NOVA ANÁLISE (`src/app/dashboard/nova-analise/page.tsx`)

### Pontos Amadores / MVP

| # | Problema | Impacto |
|---|----------|---------|
| 1.5.1 | **Alerta de Transição azul** (linha 319-325) — comunicação interna ("Nota de Transição"). Isso não deveria estar visível para o usuário final. | Impacto médio em confiança |
| 1.5.2 | **"Valor estimado da auditoria"** seguido de nota sobre restauração de funcionalidade (linha 537-538): "A liberação para processamento será restaurada no próximo bloco." — comunicação de desenvolvedor. | Impacto crítico em confiança |
| 1.5.3 | **Upload de arquivos funcional mas sem preview**: não há miniaturas, indicadores de progresso, ou confirmação visual de que o PDF foi processado. | Impacto médio |
| 1.5.4 | **Formulário longo em página única**: sem steps ou wizard. 8+ campos, upload, seleção de módulos — tudo em scroll infinito. | Impacto alto em abandono |
| 1.5.5 | **Toast no canto superior direito** conflita com hierarquia visual. Toasts geralmente ficam no canto inferior direito. | Impacto baixo |

---

## 1.6 RESULTADO (DOSSIÊ) (`src/app/dashboard/resultado/page.tsx`)

### Pontos Amadores / MVP

| # | Problema | Impacto |
|---|----------|---------|
| 1.6.1 | **"Auditoria Forense IA"** como título — soa amador. Profissionais do direito esperam "Parecer Técnico", "Dossiê de Análise Dominial", "Laudo Pericial". | Impacto alto em valor percebido |
| 1.6.2 | **Seção "Parecer Executivo"** — o conteúdo é markdown cru convertido para HTML com regex. A formatação visual parece relatório de estudante, não laudo profissional. | Impacto crítico |
| 1.6.3 | **Seção "Problemas / Divergências"** — cards vermelhos funcionais mas visualmente pesados, sem hierarquia clara de criticidade. | Impacto médio |
| 1.6.4 | **Seção "Solução Jurídica Gerada"** — botão "Baixar Documento Word (.doc)" parece amador. Profissionais esperam .docx formatado ou integração com sistema jurídico. | Impacto médio |
| 1.6.5 | **"Exportar PDF"** usa `window.print()` — browser print dialog, não geração de PDF profissional. | Impacto alto em percepção de qualidade |
| 1.6.6 | **Nenhum Score/Índice de Segurança Fundiária** — o laudo não tem um indicador numérico claro do nível de risco. | Impacto alto |
| 1.6.7 | **Histórico do Caso** (complementares) em seção separada sem integração visual com o fluxo principal. | Impacto baixo |
| 1.6.8 | **"Concluir" botão** com ícone ShieldCheck — leva de volta ao dashboard, nome genérico. | Impacto baixo |

---

## 1.7 GLOBAIS / DESIGN SYSTEM

| # | Problema | Impacto |
|---|----------|---------|
| 1.7.1 | **Sem design system**: cores, tipografia, spacing, componentes não seguem um sistema coeso. | Impacto estrutural |
| 1.7.2 | **Fonte Inter** padrão do Tailwind — sem identidade tipográfica própria. | Impacto baixo |
| 1.7.3 | **Print CSS** bem implementado (`src/app/globals.css` linhas 33-146) — ponto positivo raro. Profissional. | Oportunidade de destaque |
| 1.7.4 | **Paleta de cores limitada**: brand-green, brand-gold, brand-light, brand-dark. Falta paleta semântica completa (success, warning, error, info, neutral). | Impacto médio |

---

# FASE 2 — DASHBOARD EXECUTIVO PREMIUM (Proposta Visual)

## 2.1 Nova Nomenclatura

| Atual | Proposta |
|-------|----------|
| Dashboard | **Centro de Inteligência Fundiária** |
| Nova Análise | **Nova Auditoria Fundiária** |
| Resultado | **Dossiê Técnico** |
| Parecer | **Parecer Técnico Executivo** |
| Painel | **Painel de Controle** |
| Análises | **Auditorias** / **Dossiês** |
| Propriedades | **Imóveis Auditados** |

## 2.2 Cards Premium (Proposta)

### CARD 1 — Auditorias Realizadas
- Métrica: Total de dossiês emitidos
- Visual: Ícone de pasta jurídica + número grande. Tooltip: "Total de pareceres técnicos concluídos"
- Badge: "Completas" / "Em andamento"

### CARD 2 — Áreas Auditadas
- Métrica: Soma de hectares auditados (precisa ser implementado no backend se não existe)
- Visual: Ícone de mapa/globo + número formatado "XX.XXX ha"
- Subtexto: "Hectares sob análise"

### CARD 3 — Riscos Identificados
- Métrica: Total de achados críticos (soma de problemas com criticidade alta/crítica)
- Visual: Indicador vermelho com número
- Subtexto: "Não conformidades críticas"

### CARD 4 — Horas Economizadas
- Métrica: Estimativa baseada em benchmark (ex: cada laudo economiza 8h de trabalho jurídico)
- Visual: Ícone de relógio + horas estimadas
- Subtexto: "Tempo poupado para sua equipe"

### CARD 5 — Índice AgroLex
- Métrica: Média ponderada de todos os scores de segurança fundiária
- Visual: Número grande (0-100) com cor dinâmica (vermelho/amarelo/verde)
- Tooltip: "Índice de Segurança Fundiária do seu portfólio"

### Layout Proposto
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  CENTRO DE INTELIGÊNCIA FUNDIÁRIA                       │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │Auditorias│ │   Áreas  │ │  Riscos  │ │  Horas   │ │  Índice  │
│  │Realizadas│ │ Auditadas│ │Identific.│ │Economiz. │ │ AgroLex  │
│  │    12    │ │ 8.450 ha │ │    7     │ │   96h    │ │   72     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
│                                                          │
│  SUAS AUDITORIAS                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Tabela com filtros, busca, status, risco, ações   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

# FASE 3 — SCORE AGROLEX (ÍNDICE DE SEGURANÇA FUNDIÁRIA)

## 3.1 Conceito Visual

### Aparência

Componente circular (gauge) semelhante a mostrador analógico, com arco de 270 graus.

```
        ┌─────────────────────┐
        │                     │
        │    ╭──────────╮     │
        │   ╱    72     ╲    │  ← Número grande central
        │  │   Seguro    │   │  ← Faixa textual
        │   ╲          ╱    │
        │    ╰──────────╯     │
        │   ═══════════       │  ← Arco colorido
        │ 0   40   70   100  │  ← Escala
        │                     │
        │ ÍNDICE DE SEGURANÇA │
        │   FUNDIÁRIA         │
        └─────────────────────┘
```

### Faixas Dinâmicas

| Faixa | Classe | Cor | Ação Sugerida |
|-------|--------|-----|---------------|
| 0–39 | **Crítico** | Vermelho (#DC2626) | "Requer auditoria complementar urgente" |
| 40–69 | **Atenção** | Âmbar (#F59E0B) | "Recomenda-se monitoramento contínuo" |
| 70–100 | **Seguro** | Verde (#059669) | "Propriedade dentro dos padrões fundiários" |

### Posição na Tela

**No Dashboard**: Card 5 (Índice AgroLex) compacto + ao lado na seção de análises em formato badge.
**No Dossiê (Resultado)**: Seção destacada logo abaixo do cabeçalho, antes do Resumo Executivo.
**No Relatório PDF**: Topo da página 2, como indicador principal.

---

# FASE 4 — DOSSIÊ PREMIUM (Proposta de Estrutura)

## 4.1 Nova Estrutura da Página de Resultado

```
┌────────────────────────────────────────────────────────────┐
│ CABEÇALHO PROFISSIONAL                                     │
│ AgroLex | Dossiê Técnico de Auditoria Fundiária            │
│ Propriedade: Fazenda São Jorge | Palmas - TO               │
│ Data: 05/06/2026 | Ref: ALX-2026-001234                    │
│ Nível de Sigilo: CONFIDENCIAL                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 1. ÍNDICE DE SEGURANÇA FUNDIÁRIA (Score AgroLex)          │
│    ┌─────── Gauge visual 0-100 ───────┐                   │
│    │       Score: 72 — Seguro         │                   │
│    └──────────────────────────────────┘                   │
│                                                            │
│ 2. RESUMO EXECUTIVO                                        │
│    • Síntese em 3-5 parágrafos destacando achados          │
│    principais. Formatação profissional com box de          │
│    destaque.                                               │
│                                                            │
│ 3. ACHADOS CRÍTICOS                                        │
│    • Cards numerados por criticidade                       │
│    • Indicador visual (🔥 Crítico / ⚠️ Alto / ℹ️ Médio)    │
│    • Link direto para base documental                      │
│                                                            │
│ 4. MATRIZ DE RISCO                                         │
│    • Grid de probabilidade x impacto                       │
│    • Cada risco plotado como ponto na matriz               │
│    • Legenda colorida                                      │
│                                                            │
│ 5. CADEIA DOMINIAL VISUAL                                  │
│    • Mapa/fluxo de proprietários anteriores                │
│    • Timeline gráfica de transmissões                      │
│    • Alertas de quebra na cadeia                           │
│                                                            │
│ 6. TIMELINE REGISTRAL                                      │
│    • Eventos cronológicos da matrícula                     │
│    • Avanços, ônus, averbações, alienações                 │
│                                                            │
│ 7. RECOMENDAÇÕES TÉCNICAS                                  │
│    • Lista priorizada com prazos sugeridos                 │
│    • Classificação: Imediata / Curto Prazo / Médio Prazo   │
│                                                            │
│ 8. PEÇA JURÍDICA                                           │
│    • Minuta formatada para download (.docx)                │
│    • Já com formatação ABNT/NBR padrão                     │
│                                                            │
│ 9. ANEXOS                                                  │
│    • Documentos originais referenciados                    │
│    • Glossário técnico                                     │
│    • Metodologia de análise                                │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ RODAPÉ PROFISSIONAL                                        │
│ AgroLex Inteligência Fundiária | CNPJ: XX.XXX.XXX/XXXX-XX  │
│ Este documento é confidencial e de uso interno.            │
└────────────────────────────────────────────────────────────┘
```

## 4.2 Melhorias Visuais no Resultado Atual

| Item Atual | Proposta |
|------------|----------|
| Título "Auditoria Forense IA" | "Dossiê Técnico de Auditoria Fundiária" |
| Badge "Concluído" verde simples | Badge "PARECER FINAL" com design consistente |
| Resumo em markdown convertido | Template profissional com highlights, citações, boxes |
| Seção "Problemas" genérica | "Achados Críticos" com matriz de risco visual |
| Botão Exportar PDF (window.print) | Geração de PDF server-side com template A4 profissional |
| Botão "Concluir" | "Retornar ao Centro de Inteligência" |

---

# FASE 5 — LANDING PREMIUM (Proposta)

## 5.1 Nova Estrutura da Página

### HEADLINE PRINCIPAL
**"Proteção Patrimonial e Segurança Jurídica para o Agronegócio Brasileiro"**

### SUBHEADLINE
**"Auditoria fundiária automatizada com inteligência artificial especializada em direito registral imobiliário. Identifique riscos ocultos em matrículas antes de fechar qualquer negócio."**

### CTA PRINCIPAL
**"Solicitar Auditoria Gratuita"** — mudança radical de "Começar Análise" para "Solicitar Serviço Profissional"

### Seções da Landing Premium

1. **Hero**: Imagem profissional de escritório jurídico (não plantação genérica) + headline forte + CTA + selos de confiança

2. **Prova Social** (NOVA):
   - "+500 propriedades auditadas"
   - "98% de assertividade nos achados críticos"
   - "Mais de 40.000 hectares analisados"
   - Logo de clientes (se houver) ou genéricos "Escritórios parceiros"

3. **O Problema** (NOVA):
   - Vender a DOR: "Cada transação imobiliária rural esconde riscos registrais que podem custar milhões."
   - Dados sobre grilagem, sobreposições, fraudes dominiais

4. **Solução** (NOVA):
   - "Apresentamos o AgroLex: o primeiro sistema de auditoria fundiária com inteligência artificial especializada em direito registral brasileiro."

5. **Benefícios vs Características**:
   - **Em vez de** "Upload direto de PDFs": "Elimine semanas de análise documental manual"
   - **Em vez de** "Mapeamento de nulidades": "Identifique riscos ocultos que nenhum outro método detecta"
   - **Em vez de** "Parecer Executivo": "Receba dossiês técnicos prontos para embasar decisões estratégicas"

6. **Como Funciona**:
   - 1. Upload dos documentos → 2. IA analisa em camadas → 3. Dossiê técnico completo
   - (Remover menção a Pix/pagamento do fluxo principal)

7. **Diferenciais** (NOVA):
   - Especialização em direito registral brasileiro
   - Análise em camadas (profundidade progressiva)
   - Integração com bases oficiais (INCRA, SIGEF, CAR)
   - Confidencialidade e proteção de dados (LGPD)

8. **FAQ Expandida** (8-10 perguntas incluindo cases de uso específicos)

9. **CTA Final**: "Proteja seu patrimônio. Solicite sua auditoria agora."

---

# ROADMAP UX PREMIUM

## Priorização P0 (Crítico — Impacto Imediato em Conversão)

| # | Ação | Arquivo | Esforço | Ganho Esperado |
|---|------|---------|---------|----------------|
| P0.1 | Substituir `alert()` no cadastro por modal/toast profissional | `src/app/(auth)/cadastro/page.tsx` | 1h | Remove barreira de percepção amadora |
| P0.2 | Remover textos de desenvolvedor ("Nota de Transição", "será restaurada no próximo bloco") | `src/app/dashboard/nova-analise/page.tsx` | 0.5h | Impacto imediato em confiança |
| P0.3 | Adicionar "Esqueci minha senha" no login | `src/app/(auth)/login/page.tsx` | 1h | Reduz churn de login |
| P0.4 | Remover Score hardcoded 920/1000 ou implementar cálculo real | `src/app/dashboard/page.tsx` | 2h | Remove dado falso que reduz credibilidade |
| P0.5 | Trocar headline da landing de "IA para Segurança Fundiária" para proposta de valor profissional | `src/app/page.tsx` | 2h | Impacto direto em conversão de primeiro acesso |

## Priorização P1 (Alto — Impacto em Retenção e Valor Percebido)

| # | Ação | Arquivo | Esforço | Ganho Esperado |
|---|------|---------|---------|----------------|
| P1.1 | Renomear dashboard → "Centro de Inteligência Fundiária" | `src/app/dashboard/page.tsx` | 0.5h | Aumenta percepção de plataforma profissional |
| P1.2 | Renomear "Nova Análise" → "Nova Auditoria Fundiária" | `src/app/dashboard/nova-analise/page.tsx` + dashboard | 0.5h | Alinha linguagem ao público-alvo |
| P1.3 | Implementar Score AgroLex (índice 0-100) no dashboard e resultado | `src/app/dashboard/page.tsx` + `src/app/dashboard/resultado/page.tsx` + tipos | 8h | Diferencial competitivo chave |
| P1.4 | Adicionar cards executivos (áreas auditadas, horas economizadas) | `src/app/dashboard/page.tsx` | 4h | Enriquece dashboard com métricas de valor |
| P1.5 | Substituir CTA "Começar Análise" por "Solicitar Auditoria" | `src/app/page.tsx` + header | 0.5h | Melhora conversão de leads qualificados |
| P1.6 | Adicionar busca e filtros na tabela do dashboard | `src/app/dashboard/page.tsx` | 4h | Melhora UX de navegação |
| P1.7 | Transformar resultado em dossiê com resumo executivo, score, checklist visual | `src/app/dashboard/resultado/page.tsx` | 12h | Principal página de valor do produto |

## Priorização P2 (Médio — Impacto em Retenção de Longo Prazo)

| # | Ação | Arquivo | Esforço | Ganho Esperado |
|---|------|---------|---------|----------------|
| P2.1 | Redesenhar landing completa com seção de vendas + prova social | `src/app/page.tsx` | 16h | Diferenciação de mercado |
| P2.2 | Adicionar wizard multi-step no formulário de nova análise | `src/app/dashboard/nova-analise/page.tsx` | 12h | Reduz abandono de formulário |
| P2.3 | Implementar menu lateral com navegação completa no dashboard | `src/app/dashboard/page.tsx` (componente layout) | 8h | Melhora navegabilidade geral |
| P2.4 | Implementar geração de PDF server-side (remover window.print()) | `src/app/dashboard/resultado/page.tsx` + API nova | 16h | Requisito para público corporativo |
| P2.5 | Criar design system coeso (tipografia, cores semânticas, componentes) | `src/app/globals.css` + novos | 20h | Base para toda a evolução visual |
| P2.6 | Adicionar login social (Google + LinkedIn) | `src/app/(auth)/login/page.tsx` | 8h | Reduz atrito no cadastro |
| P2.7 | Implementar preview de PDFs no upload | `src/app/dashboard/nova-analise/page.tsx` | 6h | Melhora confiança no processo |

---

# GANHO ESPERADO DE CONVERSÃO

| Métrica | Estimativa Atual | Potencial Pós-UX | Ações-Chave |
|---------|-----------------|-------------------|-------------|
| **Taxa de conversão landing → cadastro** | ~2-5% (estimado) | **8-15%** | Headline profissional, CTA forte, prova social |
| **Taxa de cadastro → primeira auditoria** | ~40-60% | **65-80%** | Formulário otimizado, wizard, remoção de atritos |
| **Taxa de retorno (dashboard → nova auditoria)** | ~20-30% | **40-55%** | Dashboard executivo, score, métricas de valor |
| **NPS (Net Promoter Score) estimado** | ~30-40 | **55-70** | Dossiê premium, impressão profissional, score |
| **Tempo médio para primeira auditoria** | ~8-12 min | **4-6 min** | Upload otimizado, wizard, preview |

---

# GANHO ESPERADO DE VALOR PERCEBIDO

| Dimensão | Antes | Depois |
|----------|-------|--------|
| **Percepção de autoridade** | Startup/MVP | Plataforma profissional de auditoria |
| **Disposição a pagar (WTP)** | R$ 99-199 | R$ 199-499+ |
| **Confiança no laudo** | "Parecer de IA" | "Dossiê técnico com respaldo jurídico" |
| **Diferenciação competitiva** | "Mais uma IA" | "Única plataforma especializada em direito registral brasileiro" |
| **Percepção de segurança** | Genérica | Bancária/Profissional (LGPD, criptografia) |

---

# RISCOS

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Backend não ter dados para métricas propostas** (hectares auditados, horas economizadas) | Alta | Médio | Criar estimativas conservadoras baseadas em benchmark; adicionar cálculo progressivo |
| **Score AgroLex sem consenso metodológico** | Média | Alto | Definir metodologia clara (média ponderada de: risco, completude documental, profundidade da análise) |
| **Mudança de nomenclatura confundir usuários existentes** | Média | Baixo | Manter redirects/aliases por 30 dias; comunicar mudanças via changelog |
| **Geração de PDF server-side requer nova API e custos** | Alta | Médio | Priorizar P0-P1 antes; PDF server-side é P2 |
| **Redesign completo da landing sem testes A/B** | Média | Médio | Implementar P0 primeiro; landing completa como P2 com testes |

---

# ARQUIVOS QUE PRECISARÃO SER ALTERADOS

## P0 (Crítico - Imediato)

1. `src/app/(auth)/cadastro/page.tsx` — remover `alert()`, adicionar modal
2. `src/app/dashboard/nova-analise/page.tsx` — remover textos de desenvolvedor
3. `src/app/(auth)/login/page.tsx` — adicionar "Esqueci minha senha"
4. `src/app/dashboard/page.tsx` — remover/calcular score fixo
5. `src/app/page.tsx` — nova headline e CTAs

## P1 (Alto - Curto Prazo)

6. `src/app/dashboard/page.tsx` — renomear dashboard, adicionar cards, filtros
7. `src/app/dashboard/nova-analise/page.tsx` — renomear títulos
8. `src/app/dashboard/resultado/page.tsx` — dossiê premium + score implementado
9. `src/types/analise.ts` — adicionar campos de score, métricas
10. `src/app/globals.css` — estilos do score, dossiê

## P2 (Médio - Médio Prazo)

11. `src/app/page.tsx` — redesign completo da landing
12. `src/app/dashboard/nova-analise/page.tsx` — wizard de etapas
13. `src/app/dashboard/resultado/page.tsx` — PDF server-side
14. `src/app/(auth)/login/page.tsx` — login social
15. `src/app/globals.css` — design system completo
16. `src/app/layout.tsx` — menu lateral (se aplicável)

---

## RECOMENDAÇÃO FINAL

Iniciar pelos **P0** em uma sprint curta (1-2 dias) para eliminar os pontos mais críticos que ativamente reduzem confiança e conversão. Em paralelo, iniciar a especificação técnica do **Score AgroLex** (P1.3) por ser o ativo de maior diferencial competitivo. O redesign completo da landing (P2.1) deve ser a última etapa, após validar que o produto interno está profissionalizado.

**Ordem sugerida de execução**:
1. P0.1 + P0.2 (eliminar alert() e textos dev) — 1h
2. P0.3 (esqueci senha) — 1h
3. P0.4 + P0.5 (score + headline) — 4h
4. P1.1 + P1.2 + P1.5 (nomenclatura) — 1h
5. P1.3 (Score AgroLex) — 8h
6. P1.4 + P1.6 (cards + filtros dashboard) — 8h
7. P1.7 (dossiê premium) — 12h
8. P2.x (demais melhorias) — sprints seguintes

**Total estimado para P0+P1**: ~35h de desenvolvimento  
**Total estimado para P0+P1+P2**: ~97h  
**Impacto projetado em conversão**: +200-300% na taxa de conversão landing → auditoria paga