# ARCHON — Diagnóstico e Resolução de Erros

## REGRA ABSOLUTA: ZERO TRIAL-AND-ERROR

NUNCA tente soluções aleatórias. Antes de qualquer correção:

```
1. REPRODUZIR → Qual o erro exato? (mensagem, stack, linha)
2. RASTREAR  → De onde vem? (arquivo → função → linha → variável)
3. CONTEXTO  → O que depende disso? (imports, rotas, tipos, estado)
4. RAIZ      → Causa-raiz, não sintoma
5. IMPACTO   → A correção quebra algo em outro lugar?
6. EXECUTAR  → Uma correção cirúrgica única
```

Se não sabe a causa-raiz: NÃO edite. Leia, trace, mapeie, só então corrija.

## TRAVA ANTI-LOOP (crítico para DeepSeek)

- Falhou numa abordagem? NUNCA repita a mesma abordagem.
- Pare, reavalie a causa-raiz do ZERO, mude a estratégia.
- Falhou 2x no mesmo ponto: PARE. Declare o bloqueio, explique o que tentou,
  peça direção. Não entre em ciclo infinito.
- Nunca "ajuste e tente de novo" mais de uma vez sem novo diagnóstico.

## FLUXOGRAMAS DE DIAGNÓSTICO

### Erro de compilação / build
```
1. Ler a mensagem COMPLETA do erro
2. Identificar ARQUIVO e LINHA exatos
3. Ler contexto (10 linhas antes e depois)
4. É sintaxe? tipo? import? variável indefinida?
5. A dependência existe no package.json / requirements?
6. Corrigir a CAUSA, não o sintoma
```

### Erro de runtime / crash
```
1. Ler stack trace COMPLETO (de baixo para cima)
2. Identificar a PRIMEIRA linha do código do projeto no stack
3. Trace backwards: de onde veio o dado que causou o erro?
4. É null? tipo errado? async não awaited? falta validação?
5. Corrigir na ORIGEM do dado, não onde ele crashou
```

### Erro de rota / 404 / conexão
```
1. A rota está definida no backend?
2. O path está correto? (case-sensitive, barras, parâmetros)
3. O método HTTP está correto? (GET vs POST vs PUT vs DELETE)
4. O middleware está na ordem certa? (auth antes de handler)
5. CORS configurado? (se frontend ≠ backend)
6. Server na porta certa? Proxy redirecionando corretamente?
```

### Erro de estado / dados inconsistentes
```
1. De onde vem o dado? (API? DB? state? props? cache?)
2. Quando fica inconsistente? (antes/depois de qual operação?)
3. É race condition? (duas operações async competindo?)
4. É stale data? (cache desatualizado?)
5. O schema do banco bate com o tipo no código?
```

## ANTI-PADRÕES — RESOLUÇÃO RÁPIDA

| Problema | NÃO faça | Faça |
|----------|----------|------|
| Import circular | Mover código aleatoriamente | Extrair shared types/utils |
| Prop drilling | Passar 10 props | Context / Store / Composable |
| N+1 queries | Ignorar | Eager loading / JOIN / batch |
| Memory leak | Ignorar | Cleanup / unsubscribe / WeakRef |
| Race condition | setTimeout hack | Mutex / debounce / abort controller |
| Env var missing | Hardcode | .env.example + validação na inicialização |
| CORS em produção | Allow-Origin: * | Origins específicas |
| TypeScript `any` | Deixar | Tipar corretamente |
