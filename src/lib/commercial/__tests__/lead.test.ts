import {
  validarNome,
  validarEmail,
  validarWhatsApp,
  validarCidade,
  validarEstado,
  montarLeadPayload,
} from '../lead';

describe('lead.ts — Helpers de lead', () => {
  describe('validarNome()', () => {
    it('deve aceitar nome válido', () => {
      const result = validarNome('João Silva');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deve rejeitar nome vazio', () => {
      const result = validarNome('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Nome é obrigatório.');
    });

    it('deve rejeitar nome com 1 caractere', () => {
      const result = validarNome('A');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Nome deve ter no mínimo 2 caracteres.');
    });

    it('deve rejeitar nome com mais de 120 caracteres', () => {
      const result = validarNome('A'.repeat(121));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Nome deve ter no máximo 120 caracteres.');
    });
  });

  describe('validarEmail()', () => {
    it('deve aceitar email válido', () => {
      const result = validarEmail('joao@exemplo.com');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar email vazio', () => {
      const result = validarEmail('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('E-mail é obrigatório.');
    });

    it('deve rejeitar email sem @', () => {
      const result = validarEmail('joaoexemplo.com');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('E-mail inválido.');
    });

    it('deve rejeitar email sem domínio', () => {
      const result = validarEmail('joao@');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('E-mail inválido.');
    });

    it('deve rejeitar email com mais de 254 caracteres', () => {
      const local = 'a'.repeat(250);
      const result = validarEmail(`${local}@b.com`);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('E-mail deve ter no máximo 254 caracteres.');
    });
  });

  describe('validarWhatsApp()', () => {
    it('deve aceitar WhatsApp vazio (opcional)', () => {
      const result = validarWhatsApp('');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar WhatsApp undefined (opcional)', () => {
      const result = validarWhatsApp(undefined);
      expect(result.valid).toBe(true);
    });

    it('deve aceitar WhatsApp null (opcional)', () => {
      const result = validarWhatsApp(null);
      expect(result.valid).toBe(true);
    });

    it('deve aceitar WhatsApp com 10 dígitos', () => {
      const result = validarWhatsApp('11912345678');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar WhatsApp formatado com parênteses e traço', () => {
      const result = validarWhatsApp('(11) 91234-5678');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar WhatsApp com menos de 10 dígitos', () => {
      const result = validarWhatsApp('119123456'); // 9 dígitos
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('WhatsApp deve ter no mínimo 10 dígitos (incluindo DDD).');
    });
  });

  describe('validarCidade()', () => {
    it('deve aceitar cidade vazia (opcional)', () => {
      const result = validarCidade('');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar cidade válida', () => {
      const result = validarCidade('São Paulo');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar cidade com 1 caractere', () => {
      const result = validarCidade('S');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cidade deve ter no mínimo 2 caracteres.');
    });
  });

  describe('validarEstado()', () => {
    it('deve aceitar estado vazio (opcional)', () => {
      const result = validarEstado('');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar UF válida', () => {
      const result = validarEstado('SP');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar UF em minúsculo', () => {
      const result = validarEstado('sp');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar UF com 1 caractere', () => {
      const result = validarEstado('S');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Estado deve ter exatamente 2 caracteres (UF).');
    });

    it('deve rejeitar UF inválida', () => {
      const result = validarEstado('XX');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('não é uma UF brasileira válida');
    });
  });

  describe('montarLeadPayload()', () => {
    it('deve montar payload com dados válidos', () => {
      const { payload, errors } = montarLeadPayload({
        nome: 'João Silva',
        email: 'joao@exemplo.com',
        telefone: '(11) 91234-5678',
        cidade: 'São Paulo',
        estado: 'SP',
        origem: 'landing',
      });
      expect(payload).not.toBeNull();
      expect(payload?.nome).toBe('João Silva');
      expect(payload?.email).toBe('joao@exemplo.com');
      expect(payload?.telefone).toBe('(11) 91234-5678');
      expect(payload?.cidade).toBe('São Paulo');
      expect(payload?.estado).toBe('SP');
      expect(payload?.origem).toBe('landing');
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('deve montar payload com campos opcionais vazios', () => {
      const { payload } = montarLeadPayload({
        nome: 'Maria',
        email: 'maria@exemplo.com',
      });
      expect(payload).not.toBeNull();
      expect(payload?.telefone).toBeUndefined();
      expect(payload?.cidade).toBeUndefined();
      expect(payload?.estado).toBeUndefined();
      expect(payload?.origem).toBe('trial'); // default
    });

    it('deve retornar erros quando nome e email são inválidos', () => {
      const { payload, errors } = montarLeadPayload({
        nome: '',
        email: 'invalido',
      });
      expect(payload).toBeNull();
      expect(errors).toHaveProperty('nome');
      expect(errors).toHaveProperty('email');
    });

    it('deve retornar erro de telefone quando inválido', () => {
      const { payload, errors } = montarLeadPayload({
        nome: 'João',
        email: 'joao@exemplo.com',
        telefone: '123',
      });
      expect(payload).toBeNull();
      expect(errors).toHaveProperty('telefone');
    });

    it('deve normalizar email para lowercase', () => {
      const { payload } = montarLeadPayload({
        nome: 'João',
        email: 'Joao@Exemplo.COM',
      });
      expect(payload?.email).toBe('joao@exemplo.com');
    });

    it('deve normalizar estado para uppercase', () => {
      const { payload } = montarLeadPayload({
        nome: 'João',
        email: 'joao@exemplo.com',
        estado: 'sp',
      });
      expect(payload?.estado).toBe('SP');
    });
  });
});