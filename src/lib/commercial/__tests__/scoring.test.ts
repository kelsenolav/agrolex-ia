/**
 * scoring.test.ts — Testes unitários do Lead Scoring Comercial AgroLex
 *
 * SPRINT COMERCIAL P0 — FASE 3
 * Cobertura: pontuação por evento, soma de eventos, classificação de temperatura,
 * fallback para evento desconhecido, score máximo acima de 100.
 */

import {
  getCommercialEventScore,
  calculateCommercialScore,
  getCommercialScoreLevel,
  getCommercialScoreLabel,
  getCommercialScoreBadge,
  createCommercialEvent,
  extractEventsFromMetadata,
  appendCommercialEvent,
  buildMetadataWithEvent,
  calculateLeadScore,
  getLastCommercialEvent,
  compareLeadScores,
  COMMERCIAL_EVENT_SCORES,
  type CommercialEvent,
  type CommercialEventType,
} from '../scoring';

// ─── PONTUAÇÃO POR EVENTO ─────────────────────────────────────────────────────

describe('getCommercialEventScore', () => {
  it('retorna 10 para signup', () => {
    expect(getCommercialEventScore('signup')).toBe(10);
  });

  it('retorna 20 para lead_completed', () => {
    expect(getCommercialEventScore('lead_completed')).toBe(20);
  });

  it('retorna 30 para trial_started', () => {
    expect(getCommercialEventScore('trial_started')).toBe(30);
  });

  it('retorna 40 para analysis_completed', () => {
    expect(getCommercialEventScore('analysis_completed')).toBe(40);
  });

  it('retorna 50 para result_viewed', () => {
    expect(getCommercialEventScore('result_viewed')).toBe(50);
  });

  it('retorna 70 para plan_clicked', () => {
    expect(getCommercialEventScore('plan_clicked')).toBe(70);
  });

  it('retorna 80 para blocked_pdf_clicked', () => {
    expect(getCommercialEventScore('blocked_pdf_clicked')).toBe(80);
  });

  it('retorna 90 para blocked_chain_clicked', () => {
    expect(getCommercialEventScore('blocked_chain_clicked')).toBe(90);
  });

  it('retorna 90 para blocked_premium_clicked', () => {
    expect(getCommercialEventScore('blocked_premium_clicked')).toBe(90);
  });

  it('retorna 0 para evento desconhecido (fallback seguro)', () => {
    expect(getCommercialEventScore('evento_inexistente' as CommercialEventType)).toBe(0);
  });

  it('aceita objeto CommercialEvent e retorna pontuação correta', () => {
    const event: CommercialEvent = {
      type: 'plan_clicked',
      timestamp: new Date().toISOString(),
    };
    expect(getCommercialEventScore(event)).toBe(70);
  });

  it('aceita objeto CommercialEvent com tipo desconhecido e retorna 0', () => {
    const event = {
      type: 'evento_invalido' as CommercialEventType,
      timestamp: new Date().toISOString(),
    };
    expect(getCommercialEventScore(event)).toBe(0);
  });
});

// ─── SOMA DE EVENTOS ──────────────────────────────────────────────────────────

describe('calculateCommercialScore', () => {
  it('retorna 0 para lista vazia', () => {
    expect(calculateCommercialScore([])).toBe(0);
  });

  it('soma corretamente um único evento', () => {
    const events: CommercialEvent[] = [
      { type: 'signup', timestamp: '2026-06-07T00:00:00Z' },
    ];
    expect(calculateCommercialScore(events)).toBe(10);
  });

  it('soma corretamente múltiplos eventos', () => {
    const events: CommercialEvent[] = [
      { type: 'signup', timestamp: '2026-06-07T00:00:00Z' },           // 10
      { type: 'lead_completed', timestamp: '2026-06-07T01:00:00Z' },   // 20
      { type: 'trial_started', timestamp: '2026-06-07T02:00:00Z' },    // 30
    ];
    expect(calculateCommercialScore(events)).toBe(60);
  });

  it('soma corretamente eventos de alta intenção', () => {
    const events: CommercialEvent[] = [
      { type: 'blocked_chain_clicked', timestamp: '2026-06-07T00:00:00Z' },   // 90
      { type: 'blocked_premium_clicked', timestamp: '2026-06-07T01:00:00Z' }, // 90
    ];
    expect(calculateCommercialScore(events)).toBe(180);
  });

  it('ignora eventos desconhecidos (pontuação 0) sem quebrar', () => {
    const events = [
      { type: 'signup' as CommercialEventType, timestamp: '2026-06-07T00:00:00Z' },
      { type: 'evento_invalido' as CommercialEventType, timestamp: '2026-06-07T01:00:00Z' },
    ];
    expect(calculateCommercialScore(events)).toBe(10);
  });

  it('score pode ultrapassar 100 (sem teto)', () => {
    const events: CommercialEvent[] = [
      { type: 'signup', timestamp: '2026-06-07T00:00:00Z' },                   // 10
      { type: 'lead_completed', timestamp: '2026-06-07T01:00:00Z' },           // 20
      { type: 'trial_started', timestamp: '2026-06-07T02:00:00Z' },            // 30
      { type: 'analysis_completed', timestamp: '2026-06-07T03:00:00Z' },       // 40
      { type: 'result_viewed', timestamp: '2026-06-07T04:00:00Z' },            // 50
      { type: 'plan_clicked', timestamp: '2026-06-07T05:00:00Z' },             // 70
      { type: 'blocked_pdf_clicked', timestamp: '2026-06-07T06:00:00Z' },      // 80
      { type: 'blocked_chain_clicked', timestamp: '2026-06-07T07:00:00Z' },    // 90
      { type: 'blocked_premium_clicked', timestamp: '2026-06-07T08:00:00Z' },  // 90
    ];
    const score = calculateCommercialScore(events);
    expect(score).toBe(480);
    expect(score).toBeGreaterThan(100);
  });
});

// ─── CLASSIFICAÇÃO DE TEMPERATURA ────────────────────────────────────────────

describe('getCommercialScoreLevel', () => {
  it('classifica 0 como frio', () => {
    expect(getCommercialScoreLevel(0)).toBe('frio');
  });

  it('classifica 10 como frio', () => {
    expect(getCommercialScoreLevel(10)).toBe('frio');
  });

  it('classifica 30 como frio (limite superior)', () => {
    expect(getCommercialScoreLevel(30)).toBe('frio');
  });

  it('classifica 31 como morno (início da faixa)', () => {
    expect(getCommercialScoreLevel(31)).toBe('morno');
  });

  it('classifica 60 como morno (limite superior)', () => {
    expect(getCommercialScoreLevel(60)).toBe('morno');
  });

  it('classifica 61 como quente (início da faixa)', () => {
    expect(getCommercialScoreLevel(61)).toBe('quente');
  });

  it('classifica 100 como quente (limite superior)', () => {
    expect(getCommercialScoreLevel(100)).toBe('quente');
  });

  it('classifica 101 como muito_quente (início da faixa)', () => {
    expect(getCommercialScoreLevel(101)).toBe('muito_quente');
  });

  it('classifica 480 como muito_quente (score máximo de todos os eventos)', () => {
    expect(getCommercialScoreLevel(480)).toBe('muito_quente');
  });
});

describe('getCommercialScoreLabel', () => {
  it('retorna "Frio" para score 0', () => {
    expect(getCommercialScoreLabel(0)).toBe('Frio');
  });

  it('retorna "Morno" para score 50', () => {
    expect(getCommercialScoreLabel(50)).toBe('Morno');
  });

  it('retorna "Quente" para score 80', () => {
    expect(getCommercialScoreLabel(80)).toBe('Quente');
  });

  it('retorna "Muito Quente" para score 200', () => {
    expect(getCommercialScoreLabel(200)).toBe('Muito Quente');
  });
});

describe('getCommercialScoreBadge', () => {
  it('retorna badge frio com emoji 🧊', () => {
    const badge = getCommercialScoreBadge(10);
    expect(badge.level).toBe('frio');
    expect(badge.emoji).toBe('🧊');
    expect(badge.label).toBe('Frio');
    expect(badge.colorClass).toContain('blue');
  });

  it('retorna badge morno com emoji 🌤️', () => {
    const badge = getCommercialScoreBadge(50);
    expect(badge.level).toBe('morno');
    expect(badge.emoji).toBe('🌤️');
    expect(badge.label).toBe('Morno');
    expect(badge.colorClass).toContain('yellow');
  });

  it('retorna badge quente com emoji 🔥', () => {
    const badge = getCommercialScoreBadge(80);
    expect(badge.level).toBe('quente');
    expect(badge.emoji).toBe('🔥');
    expect(badge.label).toBe('Quente');
    expect(badge.colorClass).toContain('orange');
  });

  it('retorna badge muito_quente com emoji 🚀', () => {
    const badge = getCommercialScoreBadge(200);
    expect(badge.level).toBe('muito_quente');
    expect(badge.emoji).toBe('🚀');
    expect(badge.label).toBe('Muito Quente');
    expect(badge.colorClass).toContain('red');
  });
});

// ─── HELPERS DE PERSISTÊNCIA ──────────────────────────────────────────────────

describe('createCommercialEvent', () => {
  it('cria evento com timestamp ISO 8601', () => {
    const event = createCommercialEvent('signup');
    expect(event.type).toBe('signup');
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(event.meta).toBeUndefined();
  });

  it('cria evento com meta quando fornecido', () => {
    const event = createCommercialEvent('plan_clicked', { plan: 'profissional' });
    expect(event.meta).toEqual({ plan: 'profissional' });
  });
});

describe('extractEventsFromMetadata', () => {
  it('retorna array vazio para metadata null', () => {
    expect(extractEventsFromMetadata(null)).toEqual([]);
  });

  it('retorna array vazio para metadata undefined', () => {
    expect(extractEventsFromMetadata(undefined)).toEqual([]);
  });

  it('retorna array vazio para metadata sem commercial_events', () => {
    expect(extractEventsFromMetadata({ outro_campo: 'valor' })).toEqual([]);
  });

  it('retorna eventos quando commercial_events existe', () => {
    const events: CommercialEvent[] = [
      { type: 'signup', timestamp: '2026-06-07T00:00:00Z' },
    ];
    const metadata = { commercial_events: events };
    expect(extractEventsFromMetadata(metadata)).toEqual(events);
  });

  it('retorna array vazio quando commercial_events não é array', () => {
    const metadata = { commercial_events: 'invalido' };
    expect(extractEventsFromMetadata(metadata)).toEqual([]);
  });
});

describe('appendCommercialEvent', () => {
  it('adiciona evento ao array existente sem mutar o original', () => {
    const existing: CommercialEvent[] = [
      { type: 'signup', timestamp: '2026-06-07T00:00:00Z' },
    ];
    const newEvent: CommercialEvent = { type: 'lead_completed', timestamp: '2026-06-07T01:00:00Z' };
    const result = appendCommercialEvent(existing, newEvent);
    expect(result).toHaveLength(2);
    expect(result[1].type).toBe('lead_completed');
    // Original não foi mutado
    expect(existing).toHaveLength(1);
  });

  it('adiciona evento a array vazio', () => {
    const newEvent: CommercialEvent = { type: 'signup', timestamp: '2026-06-07T00:00:00Z' };
    const result = appendCommercialEvent([], newEvent);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('signup');
  });
});

describe('buildMetadataWithEvent', () => {
  it('cria metadata com commercial_events a partir de null', () => {
    const event: CommercialEvent = { type: 'signup', timestamp: '2026-06-07T00:00:00Z' };
    const result = buildMetadataWithEvent(null, event);
    expect(result.commercial_events).toHaveLength(1);
  });

  it('preserva campos existentes do metadata', () => {
    const event: CommercialEvent = { type: 'plan_clicked', timestamp: '2026-06-07T00:00:00Z' };
    const currentMetadata = { origem: 'trial', outro: 'valor' };
    const result = buildMetadataWithEvent(currentMetadata, event);
    expect(result.origem).toBe('trial');
    expect(result.outro).toBe('valor');
    expect((result.commercial_events as CommercialEvent[])).toHaveLength(1);
  });

  it('acumula eventos em metadata existente', () => {
    const existingEvent: CommercialEvent = { type: 'signup', timestamp: '2026-06-07T00:00:00Z' };
    const currentMetadata = { commercial_events: [existingEvent] };
    const newEvent: CommercialEvent = { type: 'lead_completed', timestamp: '2026-06-07T01:00:00Z' };
    const result = buildMetadataWithEvent(currentMetadata, newEvent);
    expect((result.commercial_events as CommercialEvent[])).toHaveLength(2);
  });
});

describe('calculateLeadScore', () => {
  it('retorna 0 para metadata null', () => {
    expect(calculateLeadScore(null)).toBe(0);
  });

  it('retorna 0 para metadata sem eventos', () => {
    expect(calculateLeadScore({ outro: 'campo' })).toBe(0);
  });

  it('calcula score corretamente a partir do metadata', () => {
    const metadata = {
      commercial_events: [
        { type: 'signup', timestamp: '2026-06-07T00:00:00Z' },
        { type: 'lead_completed', timestamp: '2026-06-07T01:00:00Z' },
      ],
    };
    expect(calculateLeadScore(metadata)).toBe(30);
  });
});

describe('getLastCommercialEvent', () => {
  it('retorna null para metadata null', () => {
    expect(getLastCommercialEvent(null)).toBeNull();
  });

  it('retorna null para metadata sem eventos', () => {
    expect(getLastCommercialEvent({})).toBeNull();
  });

  it('retorna o último evento da lista', () => {
    const metadata = {
      commercial_events: [
        { type: 'signup', timestamp: '2026-06-07T00:00:00Z' },
        { type: 'plan_clicked', timestamp: '2026-06-07T01:00:00Z' },
      ],
    };
    const last = getLastCommercialEvent(metadata);
    expect(last?.type).toBe('plan_clicked');
  });
});

// ─── ORDENAÇÃO DE LEADS ───────────────────────────────────────────────────────

describe('compareLeadScores', () => {
  it('ordena muito_quente antes de quente', () => {
    expect(compareLeadScores(200, 80)).toBeLessThan(0);
  });

  it('ordena quente antes de morno', () => {
    expect(compareLeadScores(80, 50)).toBeLessThan(0);
  });

  it('ordena morno antes de frio', () => {
    expect(compareLeadScores(50, 10)).toBeLessThan(0);
  });

  it('dentro do mesmo nível, ordena por score decrescente', () => {
    // Ambos são "quente" (61-100)
    expect(compareLeadScores(90, 70)).toBeLessThan(0);
    expect(compareLeadScores(70, 90)).toBeGreaterThan(0);
  });

  it('scores iguais retornam 0', () => {
    expect(compareLeadScores(50, 50)).toBe(0);
  });

  it('ordena array de scores corretamente', () => {
    const scores = [10, 200, 50, 80, 30];
    const sorted = [...scores].sort(compareLeadScores);
    // Esperado: muito_quente(200), quente(80), morno(50), frio(30), frio(10)
    expect(sorted[0]).toBe(200);
    expect(sorted[1]).toBe(80);
    expect(sorted[2]).toBe(50);
    expect(sorted[3]).toBe(30);
    expect(sorted[4]).toBe(10);
  });
});

// ─── CONSTANTE COMMERCIAL_EVENT_SCORES ───────────────────────────────────────

describe('COMMERCIAL_EVENT_SCORES', () => {
  it('contém todos os 9 tipos de eventos', () => {
    const expectedEvents: CommercialEventType[] = [
      'signup',
      'lead_completed',
      'trial_started',
      'analysis_completed',
      'result_viewed',
      'plan_clicked',
      'blocked_pdf_clicked',
      'blocked_chain_clicked',
      'blocked_premium_clicked',
    ];
    expectedEvents.forEach(event => {
      expect(COMMERCIAL_EVENT_SCORES).toHaveProperty(event);
    });
  });

  it('todos os scores são números positivos', () => {
    Object.values(COMMERCIAL_EVENT_SCORES).forEach(score => {
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });
  });
});

// ─── PONTUAÇÃO DE INTERESSE (FASE 6) ─────────────────────────────────────────

import { calculateInterestScore } from '../scoring';

describe('calculateInterestScore', () => {
  it('retorna 100 para Empresarial + Mais de 100 análises', () => {
    expect(calculateInterestScore('Empresarial', 'Mais de 100 análises/mês')).toBe(100);
  });

  it('retorna 70 para Profissional + Até 25 análises', () => {
    expect(calculateInterestScore('Profissional', 'Até 25 análises/mês')).toBe(70);
  });

  it('retorna 30 para Usuário Ocasional + Até 5 análises', () => {
    expect(calculateInterestScore('Usuário Ocasional', 'Até 5 análises/mês')).toBe(30);
  });

  it('retorna 10 de fallback para outras combinações', () => {
    expect(calculateInterestScore('Trial', 'Até 5 análises/mês')).toBe(10);
    expect(calculateInterestScore(null, null)).toBe(10);
  });
});

