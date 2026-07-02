# Análise de Sobreposição Georreferenciada (aposta 1)

> **Valor agregado — lacuna de mercado validada** (nenhum player BR oferece em self-service)
> Data: 2026-07-02 · Branch: `stable/rebuild-beta-01-laudo-compartilhavel`

## 1. Objetivo

Cruzar o polígono do imóvel rural (obtido pelo **código CAR**) contra camadas
públicas oficiais — Terras Indígenas (FUNAI), UCs federais (ICMBio/INDE),
embargos IBAMA georreferenciados e CARs vizinhos — devolvendo mapa, hectares/%
de sobreposição por achado e **leitura jurídica determinística** por classe.
Aposta 2 (Dossiê CMN 5.193) reusa este motor.

## 2. Fontes validadas AO VIVO (2026-07-02 — nada suposto)

| Camada | Endpoint | Prova |
|---|---|---|
| Polígono do imóvel (CAR) | PAMGIA ArcGIS `CAR_NACIONAL/Cadastro_Ambiental_Rural__Área_Imóvel_/MapServer/{idx-por-UF}` | query `cod_imovel='TO-1706001-…'` devolveu geometria GeoJSON |
| Embargos IBAMA (ativos) | PAMGIA `SISCOM/publico/MapServer/3` (`ibama_embargos_a`; desembargos=4, cancelados=5 em camadas separadas) | envelope PA devolveu feature completa (embargado, CPF/CNPJ, TAD, bioma) |
| Terras Indígenas | `geoserver.funai.gov.br/geoserver/ows` WFS `Funai:tis_poligonais` | GetCapabilities 200 (**exige User-Agent de browser** — 403 com UA padrão) |
| UCs federais | `geoservicos.inde.gov.br/geoserver/ICMBio/ows` WFS `ICMBio:limiteucsfederais_a` | GetCapabilities 200 |
| INCRA/SIGEF + assentamentos | `acervofundiario.incra.gov.br` | ❌ FORA DO AR em todos os testes → **fora da v1**, rotulado "não verificado" |

Notas: espelho CAR do PAMGIA pode atrasar vs SICAR (rotular vintage);
ArcGIS REST aceita `f=geojson` e filtro espacial por polígono; SRs em
SIRGAS 2000 (4674) ≈ WGS84 para fins de intersecção.

## 3. Decisões fechadas com o usuário

1. **Posicionamento v1**: botão na propriedade (Radar) + página de resultado
   compartilhável via export PDF (print). NÃO entra no motor ISF nesta versão.
2. **Sem CAR cadastrado**: formulário aceita código na hora; fallback = clicar
   no mapa e escolher o polígono CAR daquele ponto.
3. **Escopo**: TI + UC + embargo + **CAR-vs-CAR vizinho** (conflito de limites).
4. **Leitura jurídica**: template determinístico por classe (TI→STF/CAR
   suspenso; UC→regime da categoria; embargo→Res. CMN 5.193 + propter rem;
   vizinho→conflito de limites/CAR declaratório). Textos redigidos e
   **revisados pelo founder (advogado)**. Sem IA nessa camada.

## 4. Componentes

| Arquivo | Papel |
|---|---|
| `src/lib/geo/geoProviders.ts` | Fetchers por fonte (UA de browser, timeout, proveniência `consultada/falhou`). `fetchCarPolygon(codigo)` resolve a camada pela UF do código. |
| `src/lib/geo/overlapEngine.ts` | **Puro**: polígono + candidatos → interseção turf (`area`/`intersect`) → ha, %, severidade por faixa. |
| `src/lib/geo/overlapLegalReading.ts` | **Puro**: templates jurídicos por classe+severidade. |
| `src/app/api/geo/sobreposicao/route.ts` | POST autenticado (mesmo `authGate` do Crédito Rural). Orquestra `Promise.allSettled`, persiste, devolve. Também `GET ?id=` para reabrir relatório. |
| `supabase/migrations/20260702_geo_overlap_reports.sql` | `geo_overlap_reports (id, user_id, property_id?, car_code, result jsonb, created_at)` + RLS. |
| `src/app/dashboard/sobreposicao/page.tsx` | Entrada (escolhe propriedade c/ CAR ou digita código; fallback mapa) + resultado com mapa Leaflet e achados; export PDF via print. |
| `src/app/dashboard/radar/page.tsx` | Botão "Sobreposições" no card da propriedade → rota acima. |

Dependências novas: `@turf/area @turf/intersect @turf/bbox @turf/boolean-intersects`, `leaflet react-leaflet @types/leaflet` (mapa client-only via dynamic import).

## 5. Regras do motor

- Interseção < 0,1 ha → reportada como "marginal" (não silenciada — honestidade).
- Severidade: crítica (TI/UC proteção integral OU >10% do imóvel), alta
  (embargo ativo qualquer %), média (UC uso sustentável, vizinho >5%),
  baixa (vizinho ≤5%, marginais).
- Embargo: camada 3 (ativos). Desembargados/cancelados NÃO acusam.
- Cada camada com `status: consultada | falhou`; INCRA sempre `indisponivel`
  na v1 com texto explícito. Falha de camada nunca derruba o relatório.

## 6. Testes

Motor puro com fixtures geométricas de área conhecida (quadrados 1×1 grau
deslocados → % determinístico); leitura jurídica por classe; providers com
fetch mockado (200/403/timeout); bordas: CAR inexistente, UF sem camada,
de minimis.

## 7. Risco / rollback

Não toca ISF, `/api/analyze` nem baseline crítico. Migration aditiva.
Instabilidade dos geoserviços mitigada por proveniência + timeouts.
Rollback = revert do commit.
