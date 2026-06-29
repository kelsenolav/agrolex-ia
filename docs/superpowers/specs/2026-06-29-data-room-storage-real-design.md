# Data Room com Supabase Storage real

> **Eixo 3 — Verticalização · Data Room**
> Data: 2026-06-29 · Branch: `stable/rebuild-beta-01-laudo-compartilhavel`

## 1. Objetivo

Transformar o protótipo honesto do Data Room (Cofre) numa feature REAL: o usuário
faz upload, lista, baixa, compartilha com segurança e exclui documentos próprios —
tudo via Supabase Storage (bucket privado `documents`, que já é usado de verdade
pela Nova Análise). Zero dependência de IA → construível e verificável agora.

## 2. Contrato existente (espelhar)

- Bucket privado `documents` (RLS: `auth.uid() = owner`). Upload: `supabase.storage.from('documents').upload(path, file)`.
- Tabela `documents` (RLS: `user_id = auth.uid()` para SELECT/INSERT/DELETE). Colunas: `id, property_id (nullable), user_id, file_path, document_type, status, is_data_room, created_at`. **Sem** `file_name/mime_type`.
- Path real (Nova Análise): `${userId}/${...}-${Date.now()}-${random}.${ext}`.

## 3. Decisões de design

- **Sem migration**: `document_type` guarda o **nome de exibição** do documento (o pipeline de análise ignora `is_data_room=true`, então não há conflito). `property_id = null` (documento avulso do data room).
- **Compartilhamento seguro = signed URL** do Storage (`createSignedUrl(file_path, expira)`), NÃO a página `/cofre/view/[id]` (a RLS bloquearia o destinatário externo). Link com prazo (7 dias), copiável — funciona para bancos/compradores sem login.
- **Download/visualizar** = `createSignedUrl(file_path, 3600)` aberto em nova aba.
- **Consolidação**: o **Cofre** (`/dashboard/cofre`) vira o Data Room REAL (já lista `is_data_room=true`). O `/dashboard/dataroom` (mock) passa a **redirecionar** para `/dashboard/cofre`.
- **Navegação**: card "Data Room" no dashboard principal linkando para `/dashboard/cofre` (a feature deixa de ser órfã).

## 4. Componentes

| Arquivo | Ação |
|---|---|
| `src/app/dashboard/cofre/page.tsx` | Modify — upload real, download (signed URL), share (signed URL 7d), delete (Storage + row), remove banner "em desenvolvimento". |
| `src/app/dashboard/dataroom/page.tsx` | Modify — vira redirect → `/dashboard/cofre` (remove o mock). |
| `src/app/dashboard/page.tsx` | Modify — card "Data Room" na navegação. |
| `scripts/check-doc.mjs` | (novo, opcional) — prova read-only de upload+signed URL no bucket via service role. |

## 5. Fluxos

- **Upload**: input file → `upload(\`${userId}/dataroom-${Date.now()}-${rand}.${ext}\`, file)` → `insert({ user_id, file_path, document_type: nome, is_data_room: true, status: 'completed' })` → refetch.
- **Download**: `createSignedUrl(file_path, 3600)` → `window.open(url)`.
- **Share**: `createSignedUrl(file_path, 604800)` → copiar para clipboard (link de 7 dias).
- **Delete**: `storage.remove([file_path])` + `documents.delete().eq('id', id)` → refetch.

## 6. Governança / validação

- Classe C/D (toca UI + Storage; sem migration, sem mudança de schema/RLS). Risco 🟢 baixo (espelha o upload já em produção).
- Validação: `tsc`, `lint`, `build`, `jest`. Homologação live recomendada (tela gated por auth).
- Sem deploy de migration. Storage e RLS já existem.

## 7. Critérios de aceite

1. Upload real grava arquivo no bucket + linha em `documents` (is_data_room=true).
2. Download e share geram signed URLs válidas (prova por script read-only).
3. Delete remove do Storage e da tabela.
4. `/dashboard/dataroom` redireciona para o Cofre real; card no dashboard.
5. Zero "fake"/mock restante no Data Room. tsc/lint/build/jest verdes.
