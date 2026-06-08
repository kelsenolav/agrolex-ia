/**
 * lead.ts — Helpers de lead comercial para o AgroLex
 *
 * Funções PURE de validação e construção de payload de lead.
 * Nenhuma persistência. Nenhuma dependência de banco ou API.
 */

export interface LeadPayload {
  nome: string;
  email: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  origem: string;
}

export interface LeadValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida nome do lead.
 * Regras:
 *   - Obrigatório
 *   - Mínimo 2 caracteres
 *   - Máximo 120 caracteres
 */
export function validarNome(nome: string): LeadValidationResult {
  const errors: string[] = [];

  if (!nome || nome.trim().length === 0) {
    errors.push('Nome é obrigatório.');
  } else if (nome.trim().length < 2) {
    errors.push('Nome deve ter no mínimo 2 caracteres.');
  } else if (nome.trim().length > 120) {
    errors.push('Nome deve ter no máximo 120 caracteres.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida email do lead.
 * Regras:
 *   - Obrigatório
 *   - Formato email válido (regex simples)
 *   - Máximo 254 caracteres
 */
export function validarEmail(email: string): LeadValidationResult {
  const errors: string[] = [];

  if (!email || email.trim().length === 0) {
    errors.push('E-mail é obrigatório.');
    return { valid: false, errors };
  }

  const trimmed = email.trim();

  if (trimmed.length > 254) {
    errors.push('E-mail deve ter no máximo 254 caracteres.');
  }

  // Regex simples de email (RFC 5322 simplificado)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    errors.push('E-mail inválido.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida telefone/WhatsApp do lead.
 * Regras:
 *   - Opcional (se vazio, válido)
 *   - Se preenchido, mínimo 10 dígitos (DDD + número)
 *   - Aceita apenas dígitos, parênteses, traços, espaços e +
 */
export function validarWhatsApp(telefone: string | undefined | null): LeadValidationResult {
  const errors: string[] = [];

  if (!telefone || telefone.trim().length === 0) {
    return { valid: true, errors: [] }; // opcional
  }

  // Remove tudo que não é dígito
  const digits = telefone.replace(/\D/g, '');

  if (digits.length < 10) {
    errors.push('WhatsApp deve ter no mínimo 10 dígitos (incluindo DDD).');
  }

  if (digits.length > 13) {
    errors.push('WhatsApp deve ter no máximo 13 dígitos (incluindo código do país).');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida cidade do lead.
 * Regras:
 *   - Opcional (se vazio, válido)
 *   - Se preenchido, mínimo 2 caracteres
 *   - Máximo 100 caracteres
 */
export function validarCidade(cidade: string | undefined | null): LeadValidationResult {
  const errors: string[] = [];

  if (!cidade || cidade.trim().length === 0) {
    return { valid: true, errors: [] }; // opcional
  }

  const trimmed = cidade.trim();
  if (trimmed.length < 2) {
    errors.push('Cidade deve ter no mínimo 2 caracteres.');
  }
  if (trimmed.length > 100) {
    errors.push('Cidade deve ter no máximo 100 caracteres.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida estado (UF) do lead.
 * Regras:
 *   - Opcional (se vazio, válido)
 *   - Se preenchido, deve ser exatamente 2 caracteres
 *   - Deve ser uma UF brasileira válida
 */
const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export function validarEstado(estado: string | undefined | null): LeadValidationResult {
  const errors: string[] = [];

  if (!estado || estado.trim().length === 0) {
    return { valid: true, errors: [] }; // opcional
  }

  const trimmed = estado.trim().toUpperCase();
  if (trimmed.length !== 2) {
    errors.push('Estado deve ter exatamente 2 caracteres (UF).');
    return { valid: false, errors };
  }

  if (!UFS_VALIDAS.includes(trimmed)) {
    errors.push(`"${trimmed}" não é uma UF brasileira válida.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Monta o payload de lead validando todos os campos.
 * Retorna o payload e os erros de validação.
 */
export function montarLeadPayload(dados: {
  nome: string;
  email: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  origem?: string;
}): {
  payload: LeadPayload | null;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  const nomeResult = validarNome(dados.nome);
  if (!nomeResult.valid) errors.nome = nomeResult.errors;

  const emailResult = validarEmail(dados.email);
  if (!emailResult.valid) errors.email = emailResult.errors;

  const telResult = validarWhatsApp(dados.telefone);
  if (!telResult.valid) errors.telefone = telResult.errors;

  const cidadeResult = validarCidade(dados.cidade);
  if (!cidadeResult.valid) errors.cidade = cidadeResult.errors;

  const estadoResult = validarEstado(dados.estado);
  if (!estadoResult.valid) errors.estado = estadoResult.errors;

  if (Object.keys(errors).length > 0) {
    return { payload: null, errors };
  }

  return {
    payload: {
      nome: dados.nome.trim(),
      email: dados.email.trim().toLowerCase(),
      telefone: dados.telefone?.trim() || undefined,
      cidade: dados.cidade?.trim() || undefined,
      estado: dados.estado?.trim().toUpperCase() || undefined,
      origem: dados.origem?.trim() || 'trial',
    },
    errors: {},
  };
}