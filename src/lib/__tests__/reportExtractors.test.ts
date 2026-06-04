import {
  extractProblemsFromReport,
  extractMissingDocumentsFromReport,
  extractRecommendationsFromReport,
} from '../reportExtractors';

describe('reportExtractors', () => {
  const mockReport = `
1. IDENTIFICAÇÃO DA ANÁLISE
Matrícula nº 27.180
Lote 59, Palmas/TO

6. ACHADOS TÉCNICOS

ACHADO IDENTIFICADO:
Existência de demandas judiciais federais ativas envolvendo área de 32,60 hectares.
BASE DOCUMENTAL:
Escritura Pública de Permuta, fls. 048/051.
RISCO JURÍDICO/FUNDIÁRIO:
Perda judicial de posse ou propriedade sobre fração significativa do imóvel.
GRAU DE CRITICIDADE:
Crítico
DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO:
Certidões de Objeto e Pé dos processos federais.
RECOMENDAÇÃO:
Realizar auditoria processual completa.

ACHADO IDENTIFICADO:
Área de APP/UHE Lajeado de 27,21 hectares vinculada a restrição ambiental.
BASE DOCUMENTAL:
Matrícula nº 27.180, cláusula restritiva.
RISCO JURÍDICO/FUNDIÁRIO:
Impossibilidade de disposição total da área sem anuência da ANEEL.
GRAU DE CRITICIDADE:
Alto
DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO:
Parecer técnico do ITERTINS e documentação ANEEL.
RECOMENDAÇÃO:
Verificar status da anuência junto à ANEEL.

7. DOCUMENTOS FALTANTES
Certidão de inteiro teor atualizada
Certidão negativa de ônus reais
Certidão de objeto e pé dos processos federais
CCIR atualizado

8. CLASSIFICAÇÃO DE RISCO
Grau de risco estimado: Alto.
Justificativa: demandas judiciais ativas e restrição ambiental significativa.

9. RECOMENDAÇÕES
Recomenda-se realização de auditoria processual completa.
Solicitar certidões complementares junto ao cartório.
Promover atualização do CCIR.
Realizar vistoria técnica do imóvel.

10. CONCLUSÃO
A análise preliminar indica riscos relevantes que exigem atenção jurídica.
  `;

  describe('extractProblemsFromReport', () => {
    it('should extract problems from report', () => {
      const problems = extractProblemsFromReport(mockReport);
      expect(problems.length).toBeGreaterThan(0);
    });

    it('should extract titulo from ACHADO IDENTIFICADO', () => {
      const problems = extractProblemsFromReport(mockReport);
      const first = problems[0];
      expect(first.titulo).toContain('demandas judiciais');
    });

    it('should extract baseDocumental', () => {
      const problems = extractProblemsFromReport(mockReport);
      const first = problems[0];
      expect(first.baseDocumental).toContain('Escritura Pública');
    });

    it('should extract criticidade', () => {
      const problems = extractProblemsFromReport(mockReport);
      const first = problems[0];
      expect(first.criticidade).toBe('Crítico');
    });

    it('should extract recomendacao', () => {
      const problems = extractProblemsFromReport(mockReport);
      const first = problems[0];
      expect(first.recomendacao).toContain('auditoria processual');
    });

    it('should extract documentoNecessario', () => {
      const problems = extractProblemsFromReport(mockReport);
      const first = problems[0];
      expect(first.documentoNecessario).toContain('Certidões de Objeto e Pé');
    });

    it('should limit to 8 problems', () => {
      const longReport = mockReport.repeat(10);
      const problems = extractProblemsFromReport(longReport);
      expect(problems.length).toBeLessThanOrEqual(8);
    });

    it('should return empty array for report without ACHADOS', () => {
      const problems = extractProblemsFromReport('Sem seção de achados');
      expect(problems).toEqual([]);
    });
  });

  describe('extractMissingDocumentsFromReport', () => {
    it('should extract missing documents', () => {
      const docs = extractMissingDocumentsFromReport(mockReport);
      expect(docs.length).toBeGreaterThan(0);
    });

    it('should detect Certidão de inteiro teor', () => {
      const docs = extractMissingDocumentsFromReport(mockReport);
      expect(docs.some(d => d.includes('inteiro teor'))).toBe(true);
    });

    it('should detect CCIR', () => {
      const docs = extractMissingDocumentsFromReport(mockReport);
      expect(docs.some(d => d.includes('CCIR'))).toBe(true);
    });

    it('should limit to 8 items', () => {
      const docs = extractMissingDocumentsFromReport(mockReport);
      expect(docs.length).toBeLessThanOrEqual(8);
    });

    it('should return empty array for report without DOCUMENTOS FALTANTES', () => {
      const docs = extractMissingDocumentsFromReport('Sem seção de documentos');
      expect(docs).toEqual([]);
    });
  });

  describe('extractRecommendationsFromReport', () => {
    it('should extract recommendations', () => {
      const recs = extractRecommendationsFromReport(mockReport);
      expect(recs.length).toBeGreaterThan(0);
    });

    it('should detect "Recomenda-se"', () => {
      const recs = extractRecommendationsFromReport(mockReport);
      expect(recs.some(r => r.includes('Recomenda-se') || r.includes('recomenda-se') || r.includes('auditoria processual'))).toBe(true);
    });

    it('should limit to 8 items', () => {
      const recs = extractRecommendationsFromReport(mockReport);
      expect(recs.length).toBeLessThanOrEqual(8);
    });

    it('should return empty array for report without RECOMENDAÇÕES', () => {
      const recs = extractRecommendationsFromReport('Sem seção de recomendações');
      expect(recs).toEqual([]);
    });
  });
});