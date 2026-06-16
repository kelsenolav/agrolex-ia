import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getUserSubscription } from '@/lib/subscriptions';

export interface AuthGateOk {
  ok: true;
  user: { id: string; email?: string };
  supabase: SupabaseClient;
}
export interface AuthGateFail {
  ok: false;
  response: NextResponse;
}

/**
 * Autentica o usuário via header Authorization e aplica o gate comercial:
 * o módulo de Crédito Rural está incluído nos planos ativos. Bloqueia apenas
 * quem não tem acesso (trial esgotado ou assinatura expirada/cancelada),
 * espelhando o comportamento do restante do app.
 *
 * Fail-safe: se a checagem de assinatura falhar por erro técnico, NÃO bloqueia
 * (evita travar usuário pagante por bug de infraestrutura).
 */
export async function authGate(req: NextRequest): Promise<AuthGateOk | AuthGateFail> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { ok: false, response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Sessão inválida' }, { status: 401 }) };
  }

  // Gate comercial (fail-safe)
  try {
    const sub = await getUserSubscription(user.id);
    const semAcesso =
      sub.status !== 'active' ||
      (sub.plan_type === 'trial' && sub.credits_available <= 0);
    if (semAcesso) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'plan_required',
            message: 'O módulo de Crédito Rural requer um plano ativo. Faça upgrade para continuar.',
          },
          { status: 402 },
        ),
      };
    }
  } catch (e) {
    console.warn('[credito-rural authGate] checagem de assinatura falhou (fail-safe, liberando):', e);
  }

  return { ok: true, user: { id: user.id, email: user.email }, supabase };
}

interface PersistInput {
  user_id: string;
  property_id?: string | null;
  tipo: 'elegibilidade' | 'defesa' | 'ambiental';
  score?: number | null;
  faixa?: string | null;
  input: unknown;
  resultado: unknown;
  parametros_vigencia?: string | null;
}

/**
 * Persiste a análise de crédito rural. Falha de persistência NÃO derruba a
 * resposta ao usuário (o cálculo é determinístico e já está pronto) — apenas
 * registra o aviso.
 */
export async function persistAnalise(supabase: SupabaseClient, data: PersistInput): Promise<string | null> {
  try {
    const { data: row, error } = await supabase
      .from('credito_rural_analises')
      .insert({
        user_id: data.user_id,
        property_id: data.property_id ?? null,
        tipo: data.tipo,
        score: data.score ?? null,
        faixa: data.faixa ?? null,
        input: data.input ?? {},
        resultado: data.resultado ?? {},
        parametros_vigencia: data.parametros_vigencia ?? null,
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[credito-rural persistAnalise] falha ao persistir:', error.message);
      return null;
    }
    return row?.id ?? null;
  } catch (e) {
    console.warn('[credito-rural persistAnalise] exceção ao persistir:', e);
    return null;
  }
}
