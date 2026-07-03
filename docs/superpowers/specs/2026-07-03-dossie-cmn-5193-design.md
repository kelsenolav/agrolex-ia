# Dossiê de Conformidade CMN 5.193 (aposta 2)

> **Valor agregado — cauda longa regulatória** (Res. CMN 5.193/2024, 5.267/2025 e
> 5.268/2025 em vigor pleno desde abr/2026; bureaus atendem bancos grandes,
> cooperativas singulares e advogados de produtor estão descobertos)
> Data: 2026-07-03 · Branch: `stable/rebuild-beta-01-laudo-compartilhavel`

## 1. Objetivo

Relatório por **propriedade/operação de crédito** que consolida as verificações
já existentes num **veredito determinístico de conformidade** (`apto`,
`apto_com_ressalvas`, `impedido`) à luz das Resoluções CMN, com **plano de
saneamento** por impedimento — a camada jurídica que bureau nenhum entrega.

## 2. Decisões fechadas com o usuário

1. Conteúdo v1: sobreposição (aposta 1) + ambiental ao vivo (DETER/CAR) +
   embargo georreferenciado + veredito + plano de saneamento.
2. Gate comercial: dentro do plano ativo (mesmo `authGate` do Crédito Rural).
   Cobrança por operação vira produto quando houver cooperativa compradora.
3. UI: nova aba "Dossiê 5.193" no módulo Crédito Rural, export PDF via print.

## 3. Componentes (quase tudo reuso)

| Arquivo | Papel |
|---|---|
| `src/lib/creditoRural/dossieEngine.ts` | **Novo, puro** — `computeDossieVerdict(input)`: aplica as regras CMN de forma determinística e monta plano de saneamento por impedimento. |
| `src/app/api/credito-rural/dossie/route.ts` | **Novo** — `authGate` + orquestra em paralelo (`Promise.allSettled`): `fetchCarPolygon`→sobreposições (funções da aposta 1), `consultarDesmatamentoTerraBrasilis`, `consultarCAR`; roda o motor; persiste `tipo:'dossie'` em `credito_rural_analises`. |
| `src/app/dashboard/credito-rural/page.tsx` | Modify — aba nova com seleção de propriedade, veredito em destaque, tabela de verificações com proveniência, achados resumidos, saneamento, PDF. |
| `supabase/migrations/20260703_credito_rural_dossie_tipo.sql` | CHECK de `tipo` ganha `'dossie'` (**já aplicada em prod** via Management API). |

## 4. Regras do veredito (determinísticas)

- **Embargo IBAMA ativo intersectando o imóvel** → `impedido` (vedação direta Res. 5.268).
- **Sobreposição crítica** (TI qualquer %; UC proteção integral) → `impedido`.
- **CAR cancelado/suspenso** → `impedido`; CAR pendente → ressalva.
- **Alerta DETER no imóvel/município pós-datas de corte** → ressalva (documentar
  autorização de supressão) — não bloqueia sozinho sem confirmação em nível de imóvel.
- **Sobreposição alta não-crítica** (vizinho >50%, UC uso sustentável >10%) → ressalva.
- **Fonte indisponível/falha** → NUNCA `apto` pleno: rebaixa para
  `apto_com_ressalvas` com a lacuna explícita (honestidade > conveniência).
- `apto` só quando TODAS as verificações consultadas e limpas.
- Saneamento: template determinístico por tipo de impedimento (mesmo padrão da
  leitura jurídica da sobreposição; mérito sujeito à revisão do usuário-advogado).

## 5. Testes

Motor puro: embargo→impedido; tudo limpo→apto; fonte fora do ar→ressalva
nunca-apto; TI→impedido; DETER→ressalva; CAR cancelado→impedido; plano de
saneamento presente para cada impedimento.

## 6. Risco

Aditivo; não toca ISF/`/api/analyze`. Migration mínima já aplicada. Rollback = revert.
