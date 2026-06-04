import type { ReportProblem } from '@/types/analise';

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSectionText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim();
}

function stripSectionHeading(text: string, headingRegex: RegExp): string {
  return text.replace(headingRegex, '').trim();
}

function extractSection(text: string, headingRegex: RegExp): string | null {
  const normalized = normalizeSectionText(text);
  const match = normalized.match(headingRegex);
  if (!match || match.index === undefined) {
    return null;
  }

  const startIndex = match.index;
  const remaining = normalized.slice(startIndex);

  const nextSectionRegex = /(^\s*(?:\d+\.\s*)?(?:1\.\s*IDENTIFICAÇÃO DA ANÁLISE|1\.\s*IDENTIFICAÇÃO DA MATRÍCULA|2\.\s*LIMITAÇÃO DO ESCOPO DA ANÁLISE|2\.\s*LIMITAÇÃO DO ESCOPO|3\.\s*DOCUMENTOS ANALISADOS|4\.\s*DADOS EXTRAÍDOS DOS DOCUMENTOS|4\.\s*RESUMO DA CADEIA DOMINIAL|5\.\s*LINHA DO TEMPO REGISTRAL|5\.\s*LINHA DO TEMPO REGISTRAL ESSENCIAL|6\.\s*ACHADOS TÉCNICOS|6\.\s*ACHADOS DOMINIAIS|7\.\s*DOCUMENTOS FALTANTES|8\.\s*CLASSIFICAÇÃO DE RISCO|9\.\s*RECOMENDAÇÕES|10\.\s*CONCLUSÃO|10\.\s*CONCLUSÃO OBJETIVA|IDENTIFICAÇÃO DA ANÁLISE|IDENTIFICAÇÃO DA MATRÍCULA|LIMITAÇÃO DO ESCOPO DA ANÁLISE|LIMITAÇÃO DO ESCOPO|DOCUMENTOS ANALISADOS|DADOS EXTRAÍDOS DOS DOCUMENTOS|RESUMO DA CADEIA DOMINIAL|LINHA DO TEMPO REGISTRAL|LINHA DO TEMPO REGISTRAL ESSENCIAL|ACHADOS TÉCNICOS|ACHADOS DOMINIAIS|DOCUMENTOS FALTANTES|CLASSIFICAÇÃO DE RISCO|RECOMENDAÇÕES|CONCLUSÃO|CONCLUSÃO OBJETIVA)\b)/gmi;
  const remainderAfterFirstChar = remaining.slice(1);
  const nextMatch = remainderAfterFirstChar.search(nextSectionRegex);

  if (nextMatch >= 0) {
    return normalizeSectionText(remaining.slice(0, nextMatch + 1));
  }

  return normalizeSectionText(remaining);
}

function extractField(text: string, label: string, terminators: string[]): string | null {
  const escapedLabel = label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const escapedTerminators = terminators
    .map((term) => term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(`${escapedLabel}\\s*:\\s*([\\s\\S]*?)(?=(?:${escapedTerminators})\\s*:\\s*|$)`, 'i');
  const match = text.match(regex);
  return match?.[1] ? normalizeText(match[1]) : null;
}

/**
 * Strip known problem-block markers from a fallback title string.
 */
function stripMarkersFromTitle(text: string): string {
  if (!text) return text;
  const markers = [
    'BASE DOCUMENTAL\\s*:',
    'RISCO JURÍDICO/FUNDIÁRIO\\s*:',
    'RISCO\\s*:',
    'GRAU DE CRITICIDADE\\s*:',
    'CRITICIDADE\\s*:',
    'DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO\\s*:',
    'DOCUMENTO NECESSÁRIO\\s*:',
    'DOCUMENTOS NECESSÁRIOS\\s*:',
    'DOCUMENTAÇÃO NECESSÁRIA\\s*:',
    'RECOMENDAÇÃO\\s*:',
    'ACHADO IDENTIFICADO\\s*:'
  ];
  const pattern = new RegExp(`\\b(${markers.join('|')})`, 'i');
  const match = text.match(pattern);
  if (match && match.index !== undefined) {
    return text.slice(0, match.index).trim();
  }
  return text;
}

/**
 * Extract documentoNecessario trying multiple label variants.
 */
function extractDocumentoNecessario(block: string): string | null {
  const patterns = [
    'DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO',
    'DOCUMENTO NECESSÁRIO',
    'DOCUMENTOS NECESSÁRIOS',
    'DOCUMENTAÇÃO NECESSÁRIA'
  ];
  const terminators = [
    'RECOMENDAÇÃO',
    'ACHADO IDENTIFICADO',
    'BASE DOCUMENTAL',
    'RISCO JURÍDICO/FUNDIÁRIO',
    'RISCO',
    'GRAU DE CRITICIDADE',
    'CRITICIDADE',
    'DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO',
    'DOCUMENTO NECESSÁRIO',
    'DOCUMENTOS NECESSÁRIOS',
    'DOCUMENTAÇÃO NECESSÁRIA'
  ];
  for (const pattern of patterns) {
    const result = extractField(block, pattern, terminators);
    if (result) return result;
  }
  return null;
}

function parseProblemBlock(block: string): ReportProblem | null {
  const cleaned = normalizeText(block);
  const titulo = extractField(cleaned, 'ACHADO IDENTIFICADO', [
    'BASE DOCUMENTAL',
    'RISCO JURÍDICO/FUNDIÁRIO',
    'GRAU DE CRITICIDADE',
    'DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO',
    'RECOMENDAÇÃO',
    'ACHADO IDENTIFICADO',
    'CRITICIDADE',
    'RISCO',
    'DOCUMENTO NECESSÁRIO',
    'DOCUMENTOS NECESSÁRIOS',
    'DOCUMENTAÇÃO NECESSÁRIA'
  ]) || stripMarkersFromTitle(cleaned.split(/\n/)[0]?.trim() || '');

  if (!titulo) {
    return null;
  }

  const baseDocumental = extractField(cleaned, 'BASE DOCUMENTAL', [
    'RISCO JURÍDICO/FUNDIÁRIO',
    'RISCO',
    'GRAU DE CRITICIDADE',
    'CRITICIDADE',
    'DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO',
    'DOCUMENTO NECESSÁRIO',
    'DOCUMENTOS NECESSÁRIOS',
    'DOCUMENTAÇÃO NECESSÁRIA',
    'RECOMENDAÇÃO',
    'ACHADO IDENTIFICADO'
  ]);
  const descricao = extractField(cleaned, 'RISCO JURÍDICO/FUNDIÁRIO', [
    'RISCO',
    'GRAU DE CRITICIDADE',
    'CRITICIDADE',
    'DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO',
    'DOCUMENTO NECESSÁRIO',
    'DOCUMENTOS NECESSÁRIOS',
    'DOCUMENTAÇÃO NECESSÁRIA',
    'RECOMENDAÇÃO',
    'ACHADO IDENTIFICADO'
  ]) || cleaned;
  const criticidade = extractField(cleaned, 'GRAU DE CRITICIDADE', [
    'CRITICIDADE',
    'DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO',
    'DOCUMENTO NECESSÁRIO',
    'DOCUMENTOS NECESSÁRIOS',
    'DOCUMENTAÇÃO NECESSÁRIA',
    'RECOMENDAÇÃO',
    'ACHADO IDENTIFICADO'
  ]);
  const recomendacao = extractField(cleaned, 'RECOMENDAÇÃO', [
    'ACHADO IDENTIFICADO'
  ]);

  const documentoNecessario = extractDocumentoNecessario(cleaned);

  return {
    titulo: normalizeText(titulo),
    descricao: normalizeText(descricao),
    criticidade: criticidade || undefined,
    baseDocumental: baseDocumental || undefined,
    documentoNecessario: documentoNecessario || undefined,
    recomendacao: recomendacao || undefined
  };
}

function splitDocumentLines(section: string): string[] {
  const body = stripSectionHeading(section, /^(?:\d+\.\s*)?DOCUMENTOS\s+FALTANTES\b/i);
  const rawLines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  for (const rawLine of rawLines) {
    if (/^documentos?\s+faltantes/i.test(rawLine)) continue;

    const pieces = rawLine.split(/;(?=\s*[A-ZÀ-Ú0-9])/g);
    for (const piece of pieces) {
      const cleaned = piece.replace(/^[\-\*•\d\.\)\s]+/, '').trim().replace(/[\.;]$/, '').trim();
      if (!cleaned) continue;
      if (/^nenhum documento listado/i.test(cleaned)) continue;
      candidates.push(cleaned);
    }
  }

  return candidates;
}

function normalizeDocumentItem(item: string): string {
  return item.replace(/\s+/g, ' ').trim().replace(/[\.;]$/g, '').trim();
}

function normalizeRecommendationItem(item: string): string {
  return item.replace(/^[\-\*•\d\.\)\s]+/, '').trim().replace(/[\.;]$/g, '').trim();
}

export function extractReportSections(resumo: string) {
  return {
    problemasSection: extractSection(resumo, /(?:\d+\.\s*)?ACHADOS\s+(?:TÉCNICOS|DOMINIAIS)/i),
    missingDocumentsSection: extractSection(resumo, /(?:\d+\.\s*)?DOCUMENTOS\s+FALTANTES/i),
    recommendationsSection: extractSection(resumo, /(?:\d+\.\s*)?RECOMENDAÇÕES/i)
  };
}

export function extractProblemsFromReport(resumo: string): ReportProblem[] {
  const section = extractSection(resumo, /(?:\d+\.\s*)?ACHADOS\s+(?:TÉCNICOS|DOMINIAIS)/i);
  if (!section) return [];

  const blocks = section.split(/ACHADO\s+IDENTIFICADO\s*:/i).slice(1);
  const problems: ReportProblem[] = [];

  for (const block of blocks) {
    const item = parseProblemBlock(block);
    if (item && item.titulo) {
      problems.push(item);
      if (problems.length >= 8) break;
    }
  }

  return problems;
}

export function extractMissingDocumentsFromReport(resumo: string): string[] {
  const section = extractSection(resumo, /(?:\d+\.\s*)?DOCUMENTOS\s+FALTANTES/i);
  if (!section) return [];

  const candidates = splitDocumentLines(section);
  const normalized = candidates
    .map(normalizeDocumentItem)
    .filter((item) => item.length > 3);

  const unique = Array.from(new Set(normalized));
  return unique.slice(0, 8);
}

export function extractRecommendationsFromReport(resumo: string): string[] {
  const section = extractSection(resumo, /(?:\d+\.\s*)?RECOMENDAÇÕES/i);
  if (!section) return [];

  const body = stripSectionHeading(section, /^(?:\d+\.\s*)?RECOMENDAÇÕES\b/i);
  const rawLines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  for (const rawLine of rawLines) {
    const cleanedLine = normalizeRecommendationItem(rawLine);
    if (!cleanedLine) continue;
    if (/^recomenda(?:-se|m)?\b|^solicitar\b|^promover\b|^realizar\b|^obter\b|^requerer\b|^suspender\b|^providenciar\b|^executar\b|^avaliar\b|^investigar\b/i.test(cleanedLine)) {
      candidates.push(cleanedLine);
      continue;
    }

    if (/^[-*•]/.test(rawLine)) {
      candidates.push(cleanedLine);
      continue;
    }

    if (cleanedLine.includes(';')) {
      const parts = cleanedLine.split(/;(?=\s*[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ])/g);
      for (const part of parts) {
        const candidate = normalizeRecommendationItem(part);
        if (candidate && !/^recomenda(?:-se|m)?\b|^solicitar\b|^promover\b|^realizar\b|^obter\b|^requerer\b|^suspender\b|^providenciar\b|^executar\b|^avaliar\b|^investigar\b/i.test(candidate)) {
          continue;
        }
        if (candidate) candidates.push(candidate);
      }
    }
  }

  const fallback = rawLines
    .map((line) => normalizeRecommendationItem(line))
    .filter((line) => line.length > 15 && /recomenda|solicita|promove|realiza|obter|requer|suspender|providencia|executa|avalia|investiga/i.test(line));

  const finalItems = candidates.length > 0 ? candidates : fallback;
  const unique = Array.from(new Set(finalItems.map(normalizeText))).filter((item) => item.length > 3);
  return unique.slice(0, 8);
}
