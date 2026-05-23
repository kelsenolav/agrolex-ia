import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials missing.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // 1. Pegar o primeiro usuário existente para atrelar os dados
    const { data: users, error: userErr } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (userErr || !users || users.length === 0) {
       return NextResponse.json({ error: "Nenhum usuário encontrado no sistema para atrelar os dados. Crie uma conta primeiro." });
    }
    const userId = users[0].id;

    // ==========================================
    // 2. INJETAR PROPRIEDADES (FAZENDAS)
    // ==========================================
    const propertiesToInsert = [
      { user_id: userId, name: 'Fazenda Rio Grande (Seed)', city: 'Sorriso', state: 'MT', area: 15000, is_monitoring: true, cpf_cnpj: '11.222.333/0001-44', risk_score: 850 },
      { user_id: userId, name: 'Sítio Esperança (Seed)', city: 'Uberaba', state: 'MG', area: 250, is_monitoring: false, cpf_cnpj: '444.555.666-77', risk_score: 980 }
    ];
    
    const { data: insertedProps, error: propErr } = await supabaseAdmin.from('properties').insert(propertiesToInsert).select();
    if (propErr) throw propErr;

    const propId1 = insertedProps[0].id; // Rio Grande
    const propId2 = insertedProps[1].id; // Esperança

    // ==========================================
    // 3. INJETAR FORNECEDORES
    // ==========================================
    const suppliersToInsert = [
      { user_id: userId, name: 'Agropecuária Boi Gordo SA', document: '55.666.777/0001-88', status: 'Liberado', last_check: new Date().toISOString() },
      { user_id: userId, name: 'Madeireira Ilegal (Fictícia)', document: '111.222.333-44', status: 'Bloqueado', last_check: new Date().toISOString() },
      { user_id: userId, name: 'Sementes do Sul LTDA', document: '99.888.777/0001-66', status: 'Pendente', last_check: null }
    ];
    await supabaseAdmin.from('suppliers').insert(suppliersToInsert);

    // ==========================================
    // 4. INJETAR TAREFAS FINANCEIRAS NO CALENDÁRIO
    // ==========================================
    const today = new Date();
    
    const d3 = new Date(today); d3.setDate(today.getDate() + 3);
    const d7 = new Date(today); d7.setDate(today.getDate() + 7);
    const dMinus = new Date(today); dMinus.setDate(today.getDate() - 5);

    const tasksToInsert = [
      { user_id: userId, property_id: propId1, title: 'Renovar Outorga de Água', amount: 3500.00, status: 'Pendente', due_date: d3.toISOString().split('T')[0] },
      { user_id: userId, property_id: propId1, title: 'Pagamento ITR 2026', amount: 12500.00, status: 'Pendente', due_date: d7.toISOString().split('T')[0] },
      { user_id: userId, property_id: propId2, title: 'Taxa de Licença Prévia', amount: 450.00, status: 'Concluído', due_date: dMinus.toISOString().split('T')[0] },
      { user_id: userId, property_id: propId2, title: 'Multa IBAMA (Parcela 1)', amount: 1500.00, status: 'Pendente', due_date: today.toISOString().split('T')[0] }
    ];
    await supabaseAdmin.from('environmental_tasks').insert(tasksToInsert);

    // ==========================================
    // 5. INJETAR ARQUIVOS NO DATA ROOM
    // ==========================================
    const docsToInsert = [
      { user_id: userId, property_id: propId1, document_type: 'CAR - Certificado de Cadastro', file_path: '/fake/car.pdf', status: 'completed', is_data_room: true },
      { user_id: userId, property_id: propId1, document_type: 'Matrícula de Imóvel Atualizada', file_path: '/fake/matricula.pdf', status: 'completed', is_data_room: true }
    ];
    await supabaseAdmin.from('documents').insert(docsToInsert);

    // ==========================================
    // 6. INJETAR ALERTA NO RADAR
    // ==========================================
    await supabaseAdmin.from('radar_alerts').insert({
      user_id: userId, property_id: propId1, alert_type: 'Desmatamento', severity: 'Alto', message: 'Alerta simulado de desmatamento detectado próximo ao CAR da propriedade.'
    });

    return NextResponse.json({ success: true, message: '🚀 Banco de dados preenchido com sucesso com dados realistas B2B!' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
