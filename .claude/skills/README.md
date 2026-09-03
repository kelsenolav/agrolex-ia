# Skills oficiais do Google

Skills oficiais mantidas pelo Google em [github.com/google/skills](https://github.com/google/skills)
(Apache-2.0), instaladas neste repositório para uso por agentes de código
(Claude Code, Codex, Gemini CLI, Cursor — todos leem o formato `SKILL.md`).

- **Upstream:** `google/skills`
- **Commit de referência:** `f234cfba096987f3dee291ce6e7c80b048fb20b3` (2026-09-02)
- **Licença:** Apache-2.0 (ver `LICENSE` no upstream)

## Por que só 11 das 133

O repositório oficial traz 133 skills (GKE, BigQuery, Ads, Analytics, Airflow,
Spanner...). Toda skill instalada tem sua descrição carregada no contexto de
cada sessão, então espelhar as 133 custa contexto em toda tarefa sem retorno
para um app Next.js + Supabase. Instalamos o subconjunto aderente ao stack do
agrolex-ia mais o **localizador**, que busca qualquer uma das outras 122 sob
demanda no catálogo remoto.

## Instaladas

### Localizador e documentação (porta de entrada para o resto do catálogo)
- **finding-google-skills** — localiza e carrega a skill certa do catálogo
  remoto do Google sob demanda, sem pré-carregar as 133.
- **retrieving-developer-knowledge** — busca documentação oficial do Google
  (Cloud, Gemini, Firebase, Android, Web) via MCP Developer Knowledge ou
  fallback REST.

### Gemini / IA (o projeto usa `@google/generative-ai`)
- **gemini-api** — Gemini API no Agent Platform (ex-Vertex AI) com o Google
  Gen AI SDK: multimodal, tools, caching, batch, Live API.
- **agent-platform-migrate-from-ai-studio** — migração de chave do AI Studio
  para o Agent Platform (autenticação, endpoints, quotas).
- **developing-genkit-js** — Genkit em Node.js/TypeScript: flows, tools, agentes.

### Infra Google Cloud
- **gcloud** — validação e guardrails para comandos `gcloud` (evita comandos
  destrutivos e mal formados).
- **google-cloud-recipe-auth** — autenticação e autorização (ADC, service
  accounts, workload identity).
- **google-cloud-recipe-onboarding** — primeiros passos: conta, billing,
  projeto, primeiro recurso.
- **cloud-run-basics** — deploy de serviços, jobs e worker pools no Cloud Run.
- **firebase-basics** — CLI do Firebase, login, init, deploy.
- **google-cloud-storage-basics** — buckets e objetos no Cloud Storage.

## Usar uma skill que não está aqui

Peça normalmente ao agente (ex.: "como configuro alertas no GKE?"). A skill
`finding-google-skills` consulta
`https://raw.githubusercontent.com/google/skills/main/index.json` e carrega a
skill certa na hora — não é preciso instalar nada.

Para fixar uma skill adicional no repositório, acrescente o caminho dela ao
array `SKILLS` em `.claude/scripts/update-google-skills.sh` e rode o script.

## Atualizar

```bash
bash .claude/scripts/update-google-skills.sh          # segue o branch main
bash .claude/scripts/update-google-skills.sh v1.2.3   # ou uma tag/ref fixa
```

O script reclona o upstream, reescreve os diretórios listados e imprime o novo
SHA — atualize o "Commit de referência" acima ao aplicar.

## Observações

- Nenhuma das skills instaladas exige servidor MCP: `retrieving-developer-knowledge`
  cai para a API REST pública quando o MCP não está disponível.
- Nada aqui carrega credenciais. As skills de Cloud descrevem fluxos de
  autenticação, mas as chaves continuam em variáveis de ambiente fora do repo.
