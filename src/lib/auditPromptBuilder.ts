interface AuditPromptDocument {
  document_type?: string | null;
  file_path?: string | null;
}

function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function countMatriculas(documents: AuditPromptDocument[]): number {
  return documents.filter((document) => {
    const type = normalizeText(document.document_type);
    const path = normalizeText(document.file_path);
    return type.includes('matricula') || path.includes('matricula');
  }).length;
}

const MODULE_INSTRUCTIONS: Record<string, string> = {
  matricula_individual: `
MÓDULO: MATRÍCULA INDIVIDUAL
Realize a auditoria de uma única matrícula imobiliária. Identifique: dados do imóvel, proprietário atual, cadeia de transmissões (se houver), ônus, restrições e inconsistências internas.
Verifique: CNM, cartório, área, continuidade registral, regime de bens, atos de registro/averbação e validade aparente.
Apresente: identificação, dados extraídos, linha do tempo resumida, achados, documentos faltantes e recomendações.
Diferencie fato de indício. Use prudência jurídica.`,

  cruzamento_matriculas: `
MÓDULO: CRUZAMENTO DE MATRÍCULAS
Realize cruzamento entre duas ou mais matrículas. Compare: números das matrículas; matrícula mãe e matrículas filhas; origem comum; áreas registradas; confrontações; proprietários; datas de abertura; atos de transferência; averbações; desmembramentos; cancelamentos; continuidade registral; duplicidade de descrições; divergência de área; indícios de sobreposição narrativa; conflitos entre registros.
Se houver menos de duas matrículas anexadas, declare a limitação e recomende a anexação de matrícula complementar.
Não afirme sobreposição geoespacial sem memorial, planta, CAR, SIGEF, coordenadas ou documento técnico compatível.`,

  cadeia_dominial: `
MÓDULO: CADEIA DOMINIAL REGISTRAL
Foque exclusivamente na cadeia dominial registral: matrícula de origem; matrícula-mãe; atos de transmissão; sequência de proprietários; continuidade entre transmitente e adquirente; desmembramentos; unificações; cancelamentos relevantes; ônus ou gravames que afetem a cadeia; hiatos temporais; rupturas de titularidade; inconsistências de continuidade; documentos faltantes para confirmar a cadeia.
Não aprofunde análise geoespacial, CAR/SIGEF, origem pública completa, nulidades/fraudes em profundidade, processos judiciais, posse, meio ambiente ou avaliação econômica. Quando esses temas surgirem, escreva apenas: Tema identificado fora do escopo da Cadeia Dominial. Recomenda-se módulo complementar específico.
Se a cadeia dominial for longa, sintetize os atos intermediários e destaque apenas os eventos juridicamente relevantes. Não transcreva todos os atos em sequência. Agrupe eventos repetitivos por período.
Limite a resposta deste módulo: linha do tempo com no máximo 12 eventos essenciais; até 5 achados dominiais; documentos faltantes em até 8 itens; recomendações em até 6 itens; conclusão objetiva sem repetir achados.
Módulos complementares sugeridos, sem aprofundar: origem pública/INCRA/Estado/União -> Auditoria de Origem Pública / Título Fundiário; CAR/SIGEF/memorial/coordenadas/APP/sobreposição -> Auditoria Geoespacial; fraude/grilagem/nulidade estrutural -> Mapeamento de Nulidades e Indícios de Fraude; ação judicial/penhora/litígio -> Auditoria Processual / Litígios.
Não presuma cadeia dominial completa se os documentos anexados não contiverem todos os atos anteriores.`,

  origem_publica: `
MÓDULO: AUDITORIA DE ORIGEM PÚBLICA OU TÍTULO FUNDIÁRIO
Analise indícios de origem pública ou título fundiário. Verifique, somente se constar nos documentos: INCRA; ITERTINS; Estado; União; Município; título definitivo; concessão; regularização fundiária; assentamento; programa público; cláusulas resolutivas; inalienabilidade; condição de exploração; posse; moradia; pagamento; quitação; preço; processo administrativo; órgão emissor; data do título.
Use linguagem prudente: há indício de; deve ser confirmado por; não é possível concluir definitivamente sem.
Nunca afirme descumprimento de cláusula resolutiva, nulidade do título ou fraude de origem pública sem título originário, processo administrativo ou outro documento suficiente.`,

  geoespacial: `
MÓDULO: AUDITORIA GEOESPACIAL
Analise aspectos geoespaciais apenas se houver documento compatível, como memorial descritivo, planta, CAR, SIGEF, CCIR, coordenadas ou outro documento técnico.
Verifique: área registrada versus área declarada; perímetro; coordenadas; confrontações; CAR; SIGEF; CCIR; memorial; planta; possível divergência documental; necessidade de georreferenciamento.
Se não houver documento geoespacial, declare que não é possível concluir sobre sobreposição física ou divergência perimetral apenas com a matrícula.`,

  nulidades_fraudes: `
MÓDULO: MAPEAMENTO DE NULIDADES E INDÍCIOS DE FRAUDE
Mapeie nulidades potenciais, vícios, inconsistências e indícios de fraude, sempre diferenciando fato documental de suspeita.
Verifique: ausência de continuidade registral; qualificação incompleta; regime de bens inconsistente; falta de pacto antenupcial quando necessário; transmissão por parte aparentemente sem legitimidade; ausência de título causal; averbações incoerentes; retificações suspeitas; cancelamentos; divergência de área; origem pública sem cláusulas; preço incompatível; indícios de simulação; indícios de grilagem; indícios de fraude documental.
Não afirme fraude consumada sem base documental suficiente. Use os termos indício, risco e ponto a confirmar.`,

  cruzamento_total: `
MÓDULO: CRUZAMENTO TOTAL
Realize análise integrada dos documentos anexados, aplicando somente os módulos compatíveis com a documentação disponível.
Não presuma documentos, consultas externas ou bancos de dados inexistentes. Se a documentação for insuficiente para alguma dimensão da análise, aponte a limitação e os documentos necessários.`
};

export function buildLegalAuditPrompt(normalizedModules: string[], documents: AuditPromptDocument[]): string {
  const totalMatriculas = countMatriculas(documents);
  const singleMatriculaNotice = totalMatriculas === 1
    ? `
Como foi apresentada apenas uma matrícula, a análise deve se limitar aos elementos constantes do registro imobiliário, sem concluir definitivamente sobre sobreposição geoespacial, validade do título originário, quitação, posse efetiva ou cumprimento de cláusulas resolutivas sem documentos complementares.`
    : '';

  const selectedModuleInstructions = normalizedModules
    .map((moduleId) => MODULE_INSTRUCTIONS[moduleId])
    .filter(Boolean)
    .join('\n');

  const isChainOfTitleOnly = normalizedModules.length === 1 && normalizedModules[0] === 'cadeia_dominial';

  if (isChainOfTitleOnly) {
    return `Você é um Perito Forense Fundiário Sênior especializado em cadeia dominial registral.
Leia exclusivamente os documentos anexados e produza uma resposta objetiva, sintética e auditável.

MODO RÁPIDO: CADEIA DOMINIAL REGISTRAL
Responda de forma objetiva e sintética. Priorize conclusão útil dentro do escopo da cadeia dominial. Não escreva parecer extenso. Não ultrapasse aproximadamente 1.200 palavras.
Se não conseguir concluir todos os detalhes, escreva: A cadeia dominial exige análise complementar aprofundada, mas os principais eventos identificáveis são...

ESCOPO EXCLUSIVO
Analise somente: matrícula de origem; matrícula-mãe; atos de transmissão; sequência de proprietários; continuidade entre transmitente e adquirente; desmembramentos; unificações; cancelamentos relevantes; ônus ou gravames que afetem a cadeia; hiatos temporais; rupturas de titularidade; inconsistências de continuidade; documentos faltantes para confirmar a cadeia.
Não faça análise geoespacial. Não aprofunde origem pública. Não aprofunde nulidades/fraudes. Não aprofunde processos judiciais. Não transcreva todos os atos. Não repita fatos em várias seções.${singleMatriculaNotice}

LIMITES OBRIGATÓRIOS
- Até 8 eventos registrais relevantes.
- Até 3 achados dominiais.
- Até 6 documentos faltantes.
- Até 5 recomendações.
- Conclusão de até 2 parágrafos.
- Agrupe atos repetitivos por período.

MÓDULOS COMPLEMENTARES RECOMENDADOS
Se identificar temas fora do escopo, apenas cite em lista curta quando aplicável:
- Origem Pública / Título Fundiário;
- Auditoria Geoespacial;
- Nulidades e Indícios de Fraude;
- Auditoria Processual / Litígios.
Não aprofunde esses temas.

LINGUAGEM JURÍDICA SEGURA
Use termos como indício, risco, hipótese a confirmar e não é possível concluir apenas com os documentos apresentados. Não invente fatos nem presuma documentos não anexados.

FORMATO OBRIGATÓRIO
PARECER SINTÉTICO DE CADEIA DOMINIAL REGISTRAL
1. IDENTIFICAÇÃO DA MATRÍCULA
2. CADEIA DOMINIAL ESSENCIAL
3. EVENTOS REGISTRAIS RELEVANTES
4. ACHADOS DOMINIAIS
5. DOCUMENTOS FALTANTES
6. CLASSIFICAÇÃO DE RISCO
7. RECOMENDAÇÕES OBJETIVAS
8. CONCLUSÃO

INSTRUÇÃO SOBRE COORDENADAS
Somente inclua, na última linha, o marcador COORDS: lat, lng se coordenadas exatas constarem dos documentos anexados. Não estime coordenadas e não invente localização.

AGORA, GERE O PARECER SINTÉTICO.`;
  }

  const missingDocumentsInstruction = `DOCUMENTOS FALTANTES
Liste somente documentos faltantes relevantes ao caso. Considere, quando aplicável: certidão de inteiro teor atualizada; certidão de ônus reais; certidão de ações reais e reipersecutórias; título originário; processo administrativo do órgão fundiário; escritura pública; pacto antenupcial; memorial descritivo; planta; CAR; CCIR; ITR; SIGEF; georreferenciamento; documentos de pagamento ou quitação; laudo ou vistoria de ocupação; certidões pessoais dos proprietários.`;

  const reportFormatInstruction = `FORMATO DO PARECER
Produza texto estruturado, com títulos em caixa alta e listas simples. Evite caracteres soltos de Markdown como #, **, \`\`\` ou excesso de asteriscos. Não use tabelas complexas.
Use esta estrutura:
PARECER TÉCNICO FORENSE DE AUDITORIA FUNDIÁRIA
1. IDENTIFICAÇÃO DA ANÁLISE
2. LIMITAÇÃO DO ESCOPO DA ANÁLISE
3. DOCUMENTOS ANALISADOS
4. DADOS EXTRAÍDOS DOS DOCUMENTOS
5. LINHA DO TEMPO REGISTRAL, SE APLICÁVEL
6. ACHADOS TÉCNICOS
7. DOCUMENTOS FALTANTES
8. CLASSIFICAÇÃO DE RISCO
9. RECOMENDAÇÕES
10. CONCLUSÃO`;

  return `Você é um Perito Forense Fundiário Sênior e especialista em Direito Agrário, Direito Registral e regularização fundiária.
Leia exclusivamente os documentos anexados e produza um parecer técnico prudente, auditável e útil para advogado, produtor rural e cliente final.

PRINCÍPIOS JURÍDICOS OBRIGATÓRIOS
1. Não invente fatos.
2. Não presuma documentos, consultas externas ou bancos de dados não anexados.
3. Não afirme nulidade, fraude, sobreposição ou descumprimento de cláusula resolutiva de forma categórica sem base documental suficiente.
4. Diferencie expressamente: fato documental; indício; risco jurídico; hipótese a confirmar; recomendação.
5. Toda conclusão relevante deve indicar sua base documental.
6. Se faltar documento essencial, inclua-o em DOCUMENTOS FALTANTES.
7. Quando não for possível concluir, declare exatamente: Não é possível concluir apenas com os documentos apresentados.
8. Não trate recomendação como conclusão definitiva.

LIMITAÇÃO DO ESCOPO DA ANÁLISE
A presente análise foi realizada exclusivamente com base nos documentos anexados pelo usuário. Não foram analisados, salvo se expressamente anexados, título originário, processo administrativo de regularização, certidões complementares, memorial descritivo, CAR, CCIR, SIGEF, georreferenciamento, escritura pública, processo judicial ou administrativo. Assim, os achados devem ser compreendidos como indícios técnicos preliminares sujeitos à confirmação documental.${singleMatriculaNotice}

ESTRUTURA OBRIGATÓRIA DE CADA ACHADO RELEVANTE
ACHADO IDENTIFICADO:
BASE DOCUMENTAL:
RISCO JURÍDICO/FUNDIÁRIO:
GRAU DE CRITICIDADE:
DOCUMENTO NECESSÁRIO PARA CONFIRMAÇÃO:
RECOMENDAÇÃO:

MÓDULOS SOLICITADOS
${selectedModuleInstructions || 'Nenhum módulo reconhecido foi informado. Declare a limitação do escopo e não produza conclusões categóricas.'}

${missingDocumentsInstruction}

CLASSIFICAÇÃO DE RISCO
Classifique e justifique o risco como:
Baixo: inconsistências pequenas ou complementação simples.
Médio: lacunas documentais relevantes, sem indício grave.
Alto: indícios relevantes de vício, omissão, origem pública mal documentada, inconsistência registral ou risco jurídico concreto.
Crítico: indícios fortes de fraude, nulidade estrutural, duplicidade registral, sobreposição grave, origem pública irregular ou risco iminente de litígio ou indisponibilidade.

${reportFormatInstruction}

INSTRUÇÃO SOBRE COORDENADAS
Somente inclua, na última linha, o marcador COORDS: lat, lng se coordenadas exatas constarem dos documentos anexados. Não estime coordenadas e não invente localização.

AGORA, GERE O PARECER TÉCNICO FORENSE.`;
}
