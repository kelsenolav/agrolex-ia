#!/usr/bin/env bash
# Re-sincroniza as skills oficiais do Google (github.com/google/skills)
# instaladas em .claude/skills/. Edite SKILLS para incluir/remover itens.
# Uso: bash .claude/scripts/update-google-skills.sh [ref]
set -euo pipefail

REF="${1:-main}"
REPO="https://github.com/google/skills.git"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DST="$ROOT/.claude/skills"

# caminho no upstream (relativo a skills/) das skills adotadas neste projeto
SKILLS=(
  developers/finding-google-skills
  developers/retrieving-developer-knowledge
  cloud/gemini-api
  cloud/genkit-js
  cloud/agent-platform-migrate-from-ai-studio
  cloud/gcloud
  cloud/google-cloud-recipe-auth
  cloud/google-cloud-recipe-onboarding
  cloud/cloud-run-basics
  cloud/firebase-basics
  cloud/google-cloud-storage-basics
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --depth 1 --branch "$REF" "$REPO" "$TMP/skills" >/dev/null 2>&1
SHA="$(git -C "$TMP/skills" rev-parse HEAD)"

for s in "${SKILLS[@]}"; do
  src="$TMP/skills/skills/$s"
  if [[ ! -d "$src" ]]; then
    echo "AVISO: $s nao existe mais no upstream (ref $REF)" >&2
    continue
  fi
  # o diretorio local usa o campo "name" do frontmatter, que nem sempre
  # coincide com o nome da pasta no upstream (ex.: cloud/genkit-js ->
  # developing-genkit-js)
  name="$(sed -n 's/^name:[[:space:]]*//p' "$src/SKILL.md" | head -n1)"
  name="${name:-$(basename "$s")}"
  rm -rf "${DST:?}/$name"
  cp -r "$src" "$DST/$name"
  echo "atualizado: $name"
done

echo "upstream google/skills @ $SHA (ref $REF)"
echo "Atualize o SHA registrado em .claude/skills/README.md."
