# ARCHON — Segurança, Terminal e Qualidade de Código

## SEGURANÇA DE TERMINAL — COMANDOS DESTRUTIVOS

NUNCA execute sem confirmação explícita do usuário:
```
- rm -rf, rmdir recursivo, exclusão em massa
- git reset --hard, git push --force, git clean -fd
- DROP TABLE, DROP DATABASE, TRUNCATE, DELETE sem WHERE
- Sobrescrita de .env, configs de produção, secrets
- Qualquer comando que apague dados ou histórico irreversivelmente
```

Após rodar QUALQUER comando: leia a saída COMPLETA antes de prosseguir.
Não ignore warnings. Se o build falha, leia o erro todo antes de agir.

## SEGURANÇA DE CÓDIGO — VERIFICAR EM TODA EDIÇÃO

```
□ Sem secrets / senhas / tokens hardcoded
□ SQL injection protegido (parameterized queries — nunca concatenar SQL)
□ XSS protegido (sanitização de input/output)
□ Autenticação em rotas protegidas
□ Autorização (não basta estar logado — tem permissão?)
□ Rate limiting em endpoints públicos
□ Validação de input (tamanho, tipo, formato)
□ CORS configurado corretamente (nunca Allow-Origin: * em produção)
□ .env NUNCA no git → ALERTA CRÍTICO se detectado
```

## REGRAS DE CÓDIGO — GERAL

- Seguir estilo existente (indentação, quotes, ponto-e-vírgula, naming)
- DRY: extrair funções quando há repetição
- Nunca hardcode valores que devem ser configuráveis
- Tratar TODOS os erros (nunca `catch(e) {}` vazio)
- Logs com contexto (qual operação, quais parâmetros)
- Sem `console.log` em produção

## BANCO DE DADOS

- Queries parametrizadas (nunca concatenar SQL)
- Migrations reversíveis
- Índices para campos usados em WHERE / JOIN
- Transações para operações múltiplas

## API / ROTAS

- Validação de input em TODA rota
- Status codes corretos (200, 201, 400, 401, 403, 404, 500)
- Respostas padronizadas: `{ success, data, error, message }`
- Rate limiting e autenticação quando aplicável

## FRONTEND

- Componentes pequenos e reutilizáveis
- Sem prop drilling excessivo (Context / Store)
- Loading states e error states em toda chamada assíncrona
- Acessibilidade básica (aria labels, semântica HTML)
- Responsividade

## TYPESCRIPT

- NUNCA use `any` — sempre tipar explicitamente
- Interfaces para shapes de dados
- Enums para conjuntos fixos de valores
- Generics quando há reuso de lógica tipada

## PERFORMANCE — CONSIDERAR SEMPRE

- Queries: select apenas campos necessários, índices adequados
- Lazy loading de componentes pesados
- Debounce em inputs de busca
- Paginação em listas longas
- Cache com invalidação correta
- Imports específicos, não `import * from`

## DETECTOR DE ANTI-PADRÕES (silencioso)

Ao ler código, identificar silenciosamente e reportar só quando relevante:
- Funções com mais de 50 linhas → candidata a refactoring
- Duplicação de lógica → candidata a extração
- `TODO` / `FIXME` → reportar ao usuário
- Dependências não usadas → reportar
- Arquivos mortos (não importados) → reportar
- `.env` no git → ALERTA CRÍTICO imediato
