import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MODULE_PRICES, calculateAuditModulesTotal } from '@/lib/auditModules';
import type { CaseFile } from '@/lib/caseFile';

/**
 * POST /api/recommendations/accept
 *
 * Cria uma análise filha (complementar) a partir de uma análise concluída,
 * herdando o case_file e vinculando via parent_analysis_id.
 *
 * Body: { analysisId: string, moduleIds: string[] }
 *   - analysisId: ID da análise pai (concluída)
 *   - moduleIds: lista de módulos complementares a contratar
 *
 * Retorno: { success: true, newAnalysisId: string }
 */
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseServiceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' },
      { status: 500 }
    );
  }

  try {
    // 1. Autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Cabeçalho de autorização ausente' }, { status: 401 });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 });
    }

    // 2. Validar body
    const body = await req.json();
    const { analysisId, moduleIds } = body;

    if (!analysisId || typeof analysisId !== 'string') {
      return NextResponse.json({ error: 'analysisId é obrigatório' }, { status: 400 });
    }

    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
      return NextResponse.json({ error: 'moduleIds deve ser uma lista não vazia de módulos' }, { status: 400 });
    }

    // Validar que todos os moduleIds existem no catálogo
    for (const modId of moduleIds) {
      if (!MODULE_PRICES[modId]) {
        return NextResponse.json(
          { error: `Módulo "${modId}" não encontrado no catálogo de preços` },
          { status: 400 }
        );
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // 3. Buscar análise pai
    const { data: parentAnalysis, error: fetchError } = await supabaseAdmin
      .from('analyses')
      .select('id, user_id, status, findings, property_id, document_id') // Adicionado document_id
      .eq('id', analysisId)
      .single();

    if (fetchError || !parentAnalysis) {
      return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 });
    }

    const parentDocumentId = parentAnalysis.document_id; // Extrair document_id
    console.error('Valor de parentDocumentId antes da validação:', parentDocumentId); // Adicionar este log

    // 4. Validação de ownership
    if (parentAnalysis.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado: a análise não pertence ao usuário' }, { status: 403 });
    }

    // 5. Validação de status (só pode complementar análises concluídas)
    const parentStatus = (parentAnalysis.status || '').toLowerCase().trim();
    if (parentStatus !== 'completed') {
      return NextResponse.json(
        { error: 'A análise pai precisa estar concluída para receber módulos complementares' },
        { status: 400 }
      );
    }

    if (!parentAnalysis.property_id) {
      return NextResponse.json({ error: 'Propriedade não associada à análise pai' }, { status: 400 });
    }

    if (!parentDocumentId) { // Usar a variável extraída para validação
      console.error('Erro crítico: Documento não associado à análise pai (ID:', analysisId, '). Campos existentes:', {
        property_id: parentAnalysis.property_id,
        document_id: parentAnalysis.document_id,
        status: parentAnalysis.status
      });
      return NextResponse.json({ 
        error: 'Documento não associado à análise pai. Não é possível criar análise complementar.',
        details: 'A análise pai deve ter um documento vinculado para criar análises complementares.',
        analysisId: analysisId,
        requiredField: 'document_id'
      }, { status: 400 });
    }

    // 6. HOTFIX P0 — Verificar módulos já processados no pai E em filhos existentes
    const parentFindings = parentAnalysis.findings || {};
    const parentCaseFile: CaseFile | null = parentFindings.case_file || null;

    // Módulos já concluídos no pai (module_results)
    const existingModuleResults = parentCaseFile?.module_results || {};
    const parentCompletedModules = Object.keys(existingModuleResults).filter(
      (modId) => existingModuleResults[modId]?.status === 'completed'
    );

    // Módulos já contratados em análises filhas existentes (complementary_children)
    const existingComplementaryChildren = Array.isArray(parentFindings.complementary_children)
      ? parentFindings.complementary_children
      : [];
    const childContractedModules = new Set<string>();
    for (const child of existingComplementaryChildren) {
      if (Array.isArray(child.modules)) {
        for (const modId of child.modules) {
          childContractedModules.add(modId);
        }
      }
    }

    // Módulos já processados no pai (module_results completed)
    const alreadyProcessedModules = new Set<string>([...parentCompletedModules]);

    // Filtrar módulos: remover os já processados no pai E os já contratados em filhos
    const newModuleIds = moduleIds.filter(
      (modId) => !alreadyProcessedModules.has(modId) && !childContractedModules.has(modId)
    );

    if (newModuleIds.length === 0) {
      // HOTFIX P0 — Todos os módulos já foram processados ou contratados
      return NextResponse.json({
        status: 'modules_already_processed',
        message: 'Todos os módulos selecionados já foram processados ou contratados anteriormente. Acesse o dossiê existente.',
        parentAnalysisId: analysisId,
        alreadyProcessedModules: Array.from(alreadyProcessedModules),
        childContractedModules: Array.from(childContractedModules)
      });
    }

    // Calcular profundidade
    const parentDepth = parentFindings.analysis_depth || 1;
    const newDepth = parentDepth + 1;

    // Calcular preço server-side (apenas módulos novos)
    const serverTotal = calculateAuditModulesTotal(newModuleIds);

    // 7. Criar findings para a nova análise
    const now = new Date().toISOString();

    // Montar o case_file da análise filha: cópia profunda do pai
    const childFindings: Record<string, unknown> = {
      selected_modules: newModuleIds,
      parent_analysis_id: analysisId,
      analysis_depth: newDepth,
      complementary_modules: newModuleIds,
      estimated_total: serverTotal,
      price_source: 'server',
      price_checked_at: now,
      current_step: 'Aguardando liberação para processamento complementar.',
      case_file: parentCaseFile ? JSON.parse(JSON.stringify(parentCaseFile)) : null,
      parent_findings_summary: {
        completed_at: parentFindings.completed_at || null,
        risk_level: parentFindings.risk_level || null,
        original_modules: parentFindings.selected_modules || []
      }
    };

    // Atualizar case_file: remover recommended_modules da análise pai
    // (a filha vai gerar suas próprias recomendações)
    if (childFindings.case_file && typeof childFindings.case_file === 'object') {
      const cf = childFindings.case_file as Record<string, unknown>;
      cf.recommended_modules = [];
      cf.status = 'created';
      cf.updated_at = now;
    }

    // 8. Inserir nova análise
    const { data: newAnalysis, error: insertError } = await supabaseAdmin
      .from('analyses')
      .insert({
        user_id: user.id,
        property_id: parentAnalysis.property_id,
        document_id: parentDocumentId, // Usar a variável extraída
        status: 'payment_pending',
        findings: childFindings
      })
      .select('id')
      .single();

    if (insertError || !newAnalysis) {
      return NextResponse.json(
        { error: 'Erro ao criar análise complementar: ' + (insertError?.message || 'desconhecido') },
        { status: 500 }
      );
    }

    // 9. Registrar no findings da análise pai que ela gerou uma complementar
    const complementaryChildren = Array.isArray(parentFindings.complementary_children)
      ? parentFindings.complementary_children
      : [];
    
    complementaryChildren.push({
      child_analysis_id: newAnalysis.id,
      created_at: now,
      modules: newModuleIds,
      total: serverTotal
    });

    await supabaseAdmin
      .from('analyses')
      .update({
        findings: {
          ...parentFindings,
          complementary_children: complementaryChildren
        }
      })
      .eq('id', analysisId);

    return NextResponse.json({
      success: true,
      newAnalysisId: newAnalysis.id,
      parentAnalysisId: analysisId,
      estimatedTotal: serverTotal,
      modules: moduleIds,
      status: 'payment_pending'
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('[Recommendations/Accept] Erro:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
