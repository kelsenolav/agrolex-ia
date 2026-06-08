import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'analysisId não informado' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: analysis, error } = await supabaseAdmin
      .from('analyses')
      .select('status, findings')
      .eq('id', id)
      .single();

    if (error || !analysis) {
      return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 });
    }

    const status = analysis.status;
    const findings = analysis.findings || {};
    const currentStep = findings.current_step || '';
    const errorMessage = findings.error_message || '';
    const technicalErrorType = findings.technical_error_type || '';

    // If it requires another stage to be triggered by the client
    const needsNextStage = status === 'ready_for_processing' && findings.current_step?.includes('Aguardando processamento da próxima etapa');

    return NextResponse.json({
      status: needsNextStage ? 'processing_stage_completed' : status,
      currentStep,
      errorMessage,
      technicalErrorType,
      findings
    });
  } catch (error: any) {
    console.error('Erro no polling de status:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
