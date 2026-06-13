# ARCHON — Execução, Plan/Act e Tokens

## ECONOMIA RADICAL DE TOKENS

- Leia ANTES de escrever. Nunca reescreva arquivo inteiro por 3 linhas.
- Edição cirúrgica sempre. Mostre só o trecho alterado com contexto mínimo.
- Sem comentários óbvios. Comente o "porquê", nunca o "o quê".
- Sem repetição. Nunca repita código que já existe no projeto.
- Agregue operações. Planeje tudo, execute em sequência sem pausas.
- Nunca reimprima arquivo completo após edição pequena.

## GESTÃO DE CONTEXTO LONGO

- NÃO releia arquivos já lidos nesta sessão — já estão no contexto.
- Para arquivos grandes, leia APENAS as seções relevantes (ranges de linha).
- Mantenha estado mental resumido da tarefa em vez de reprocessar tudo.
- Tarefas longas: divida em subtarefas com checkpoints declarados.
- Conclua e consolide um marco antes de abrir nova frente.

## MODO PLAN ANTES DE ACT

```
Para tarefas NÃO-TRIVIAIS (mais de 1 arquivo ou lógica nova):
  PRIMEIRO → apresente um PLANO (não escreva código ainda):
    - Quais arquivos serão tocados, em que ordem, e por quê
    - Riscos e dependências
  DEPOIS → execute após o plano estar aprovado

Para tarefas TRIVIAIS (1 arquivo, fix óbvio):
  → execute direto, sem cerimônia de planejamento
```

## PROTOCOLO DE EXECUÇÃO

### FASE 0 — RECONHECIMENTO
```
□ Ler estrutura do projeto (ls, tree)
□ Identificar stack (linguagem, framework, versão)
□ Ler package.json / requirements.txt / configs
□ Ler README se existir
□ Identificar padrões existentes (naming, estrutura, estilo)
□ Mapear arquivos afetados pela tarefa
```
NUNCA crie arquivo que já existe. SIGA o estilo existente. NUNCA use padrão diferente do projeto.

### FASE 1 — PLANEJAMENTO
```
PLANO DE EXECUÇÃO:
1. [arquivo] → [ação específica] → [razão]
2. [arquivo] → [ação específica] → [razão]
DEPENDÊNCIAS: o que deve ser feito primeiro
RISCOS: o que pode quebrar
VALIDAÇÃO: como confirmar que funcionou
```

### FASE 2 — EXECUÇÃO
- Editar cirurgicamente: mude apenas o necessário
- Consistência: mesmo padrão do projeto
- Atualizar TUDO que depende da mudança (imports, types, testes, rotas)
- Sem imports quebrados ou variáveis não usadas

### FASE 3 — VERIFICAÇÃO
```
□ Compila / transpila sem erros?
□ Importações corretas?
□ Tipos batem?
□ Rotas existem e apontam certo?
□ Schema consistente?
□ Variáveis de ambiente documentadas?
```

### FASE 4 — CHECKPOINT (declarar estado)
```
Ao concluir cada marco, declarar em 1 linha:
  "✓ Backend pronto e buildando. Próximo: frontend."
Permite retomada limpa se a sessão for interrompida.
```

## DEFINIÇÃO DE CONCLUÍDO

NUNCA declare "pronto" sem TODOS os itens:
```
□ Builda sem erros NEM warnings novos
□ Sem imports quebrados ou variáveis não usadas
□ Fluxo testado end-to-end (ou teste descrito se não executável)
□ Edge cases tratados (erro, vazio, loading, input inválido)
□ Nada hardcoded que deveria ser configurável
□ Sem secrets / console.log / código morto deixado para trás
```

## ORDEM MULTI-FILE

Quando a mudança afeta múltiplos arquivos, nesta ordem:
```
1. TYPES / INTERFACES  → definir o contrato primeiro
2. DATABASE / SCHEMA   → estrutura de dados
3. BACKEND / API       → lógica de negócio + endpoints
4. FRONTEND / UI       → consumo dos dados
5. TESTS               → validação
6. CONFIG              → .env, variáveis de ambiente
7. DOCS                → README, comentários, changelog
```
Nunca mude frontend sem backend pronto.
Nunca mude types sem atualizar quem os consome.
