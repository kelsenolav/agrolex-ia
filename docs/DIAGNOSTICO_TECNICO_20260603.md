# Diagnóstico Técnico — AgroLex
**Data:** 03/06/2026
**Autor:** Análise automatizada (engenharia sênior)
**Contexto:** Blocos 8.2.2 / 8.2.3 / 8.2.2.1 / 8.2.3.1 concluídos

---

## Resumo Executivo

O sistema está funcional e a lógica de negócio está correta. Foram implementados:
- Limite de retry por timeout de IA (3 tentativas)
- Parser de laudo com remoção de marcadores e extração de documento necessário
- Mensagem de etapas recomendadas quando retry esgota

**Porém, o código acumulou dívida técnica típica de MVP que precisa ser endereçada antes de escalar.**

---

## 10 Achados Técnicos

### 🔴 1. `any` em todo lugar — TypeScript não está sendo usado
**Arquivos:** `dashboard/page.tsx`, `resultado/page.tsx`
```typescript
const [analises, setAnalises] = useState<any[]>([]);
findings.problemas.map((prob: any, i) => ...)
```
**Risco:** Se a estrutura do `findings` mudar no backend, o frontend quebra silenciosamente. Zero contrato entre API e UI.
**Impacto:** Alto — manutenção cega, regressão frequente.

### 🔴 2. `dangerouslySetInnerHTML` sem sanitização
**Arquivo:** `resultado/page.tsx`, linha 244
```typescript
dangerouslySetInnerHTML={{ __html: findings.resumo }}
```
**Risco:** XSS se a IA produzir HTML malicioso ou mal formatado.
**Impacto:** Alto — segurança do usuário.

### 🔴 3. Testes ausentes no `reportExtractors.ts`
**Arquivo:** `reportExtractors.ts` — 232 linhas de parsing de texto não estruturado com regex.
**Risco:** Cada mudança no prompt da IA pode quebrar o parser sem ninguém perceber.
**Impacto:** Alto — falha silenciosa em produção.

### 🟡 4. `alert()` como mecanismo de feedback UX
**Arquivos:** `dashboard/page.tsx`, `resultado/page.tsx`
**Problema:** Bloqueia a thread, sem estilo, some em mobile, não escala.
**Impacto:** Médio — experiência amadora para SaaS jurídico.

### 🟡 5. `window.location.reload()` — reset de estado
**Arquivo:** `dashboard/page.tsx`
**Problema:** Após ações (liberar, reprocessar), a página recarrega completamente. Usuário perde scroll e estado.
**Impacto:** Médio — UX degradada.

### 🟡 6. Polling infinito sem teto
**Arquivo:** `resultado/page.tsx`, linha 67-79
**Problema:** Se a IA nunca completar, o cliente faz requisições para sempre.
**Impacto:** Médio — custo de banda e leituras no Supabase.

### 🟡 7. Normalização de status duplicada
**Arquivos:** `dashboard/page.tsx` (linhas 260-284), `resultado/page.tsx` (linhas 106-109)
**Problema:** Mesma lógica de `if/else` copiada em dois lugares.
**Impacto:** Médio — manutenção dobrada, risco de divergência.

### 🟡 8. Contrato `findings` não documentado
**Arquivo:** Schema do banco (`jsonb`), múltiplos consumidores.
**Problema:** Não há validação do que é salvo (Zod, tipos, migração de schema).
**Impacto:** Médio — drift inevitável entre backend e frontend.

### 🟡 9. Campos críticos sem documentação de relacionamento
**Exemplo:** `retry_exhausted` e `retry_available` são mutuamente exclusivos por lógica, mas isso não está documentado em lugar nenhum.
**Impacto:** Médio — bug potencial se ambos vierem true.

### 🟢 10. Componentes muito grandes (SRP violado)
**Arquivos:** `DashboardPage` (385 linhas), `ResultadoContent` (471 linhas)
**Problema:** Misturam data fetching, lógica de negócio e UI.
**Impacto:** Baixo — legibilidade, mas não funcionalidade.

---

## Recomendação de Prioridades

| Prioridade | Item | Esforço | Impacto |
|-----------|------|---------|---------|
| 1º | **Tipar findings + ReportProblem** | ~2h | Impede quebra silenciosa |
| 2º | **Sanitizar HTML (DOMPurify)** | ~30min | Segurança |
| 3º | **Testes no reportExtractors.ts** | ~3h | Prevenção de regressão |
| 4º | **Polling com teto** | ~30min | Custo/performance |
| 5º | **Toast em vez de alert()** | ~2h | UX profissional |
| 6º | **Normalização de status única** | ~1h | Manutenção |
| 7º | **Componentes menores** | ~4h | Organização |

---

## Recomendação Final

**Implementar agora (neste bloco):** Itens 1 + 2 + 4
- Tipar `findings` + `ReportProblem` (eliminar `any`)
- Adicionar DOMPurify para sanitizar HTML
- Adicionar teto de retry no polling

**Motivo:** São as únicas mudanças que previnem quebra silenciosa e vulnerabilidade de segurança. As demais podem ficar para sprints seguintes sem risco imediato.

**Fora de escopo (não mexer):** Checkout, preço, Supabase, migrations, RLS, Gemini, timeout, prompts, deploy.