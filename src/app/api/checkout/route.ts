import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateAuditModulesTotal, MODULE_PRICES } from '@/lib/auditModules';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Cabeçalho de autorização ausente' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do Supabase incompleta no servidor' }, { status: 500 });
    }

    // Cliente com token do usuário para validar autenticação
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 });
    }

    const body = await req.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId não informado' }, { status: 400 });
    }

    // Cliente admin para consultar e atualizar com segurança
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from('analyses')
      .select('id, user_id, status, findings')
      .eq('id', analysisId)
      .single();

    if (fetchError || !analysis) {
      return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 });
    }

    // Validação de ownership
    if (analysis.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado: a análise não pertence ao usuário' }, { status: 403 });
    }

    // Validação de status atual
    const currentStatus = (analysis.status || '').toLowerCase().trim();
    if (currentStatus !== 'payment_pending' && currentStatus !== 'pending') {
      return NextResponse.json({ error: 'Status atual inválido para liberação de processamento' }, { status: 400 });
    }

    // Validação de selected_modules em findings
    const findings = analysis.findings || {};
    const selectedModules = findings.selected_modules;
    if (!selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
      return NextResponse.json({ error: 'A análise não possui módulos de auditoria válidos' }, { status: 400 });
    }

    // Validar que todos os módulos selecionados existem e têm preço válido
    for (const moduleId of selectedModules) {
      if (typeof moduleId !== 'string' || !moduleId.trim()) {
        return NextResponse.json({ error: 'Módulo de auditoria inválido ou vazio' }, { status: 400 });
      }
      if (MODULE_PRICES[moduleId.trim()] === undefined) {
        return NextResponse.json({ error: `Módulo de auditoria desconhecido: ${moduleId}` }, { status: 400 });
      }
    }

    // Recalcular o preço no servidor (fonte da verdade)
    const serverEstimatedTotal = calculateAuditModulesTotal(selectedModules);
    
    // Capturar o preço enviado pelo cliente para auditoria/comparação
    const clientEstimatedTotal = typeof findings.estimated_total === 'number' ? findings.estimated_total : null;

    // Atualização simulada (sem Mercado Pago, sem IA iniciada)
    const updatedFindings = {
      ...findings,
      // Preço recalculado e rastreado no servidor
      estimated_total: serverEstimatedTotal,
      client_estimated_total: clientEstimatedTotal,
      price_source: "server",
      price_checked_at: new Date().toISOString(),
      // Status e fluxo de liberação
      payment_mode: "simulated",
      payment_status: "approved",
      current_step: "Análise liberada para processamento. Aguardando início da IA.",
      ready_for_processing_at: new Date().toISOString()
    };

    const { error: updateError } = await supabaseAdmin
      .from('analyses')
      .update({
        status: 'ready_for_processing',
        findings: updatedFindings
      })
      .eq('id', analysisId);

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao atualizar a análise: ' + updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      mode: "simulated",
      status: "approved",
      analysisStatus: "ready_for_processing",
      analysisId: analysis.id,
      serverEstimatedTotal: serverEstimatedTotal,
      clientEstimatedTotal: clientEstimatedTotal
    });

  } catch (error: any) {
    console.error('Erro no checkout de simulação:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
