import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  try {
    const authHeader = req.headers.get('Authorization');
    
    // 1. Validar se o usuário que chamou a API está autenticado
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader || '' } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Usar o supabaseUser para checar o role do usuário logado
    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso Negado. Você não é um administrador.' }, { status: 403 });
    }

    // 3. Cliente Admin para ignorar RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // 4. Buscar usuários do Auth para ver `last_sign_in_at`
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const authUsers = authData?.users || [];
    
    // 5. Contar usuários "Online" (Ativos nas últimas 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const onlineCount = authUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) > oneDayAgo).length;

    // 6. Buscar todos os Profiles e todas as Análises
    const { data: profilesData } = await supabaseAdmin.from('profiles').select('*');
    const { data: allAnalysesList } = await supabaseAdmin.from('analyses').select('id, user_id, status, findings');
    
    const usersList = profilesData || [];
    const analysesList = allAnalysesList || [];
    let incompleteCount = 0;
    
    // 7. Enriquecer os usuários e calcular "incompletos"
    const enrichedUsers = usersList.map(p => {
      const authU = authUsers.find(u => u.id === p.id);
      const userAnalyses = analysesList.filter(a => a.user_id === p.id);
      const completedAnalyses = userAnalyses.filter(a => a.status === 'completed');
      
      const isIncomplete = completedAnalyses.length === 0;
      // Contar como abandono/incompleto apenas quem não é admin
      if (isIncomplete && p.role !== 'admin') {
        incompleteCount++;
      }
      
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        role: p.role,
        created_at: p.created_at || authU?.created_at,
        last_sign_in_at: authU?.last_sign_in_at || null,
        total_analyses: userAnalyses.length,
        completed_analyses: completedAnalyses.length,
        status: isIncomplete ? 'Incompleto' : 'Ativo'
      };
    });

    // Ordernar por mais recentes
    enrichedUsers.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    // 8. Calcular Faturamento e Ticket
    let totalRevenue = 0;
    const completedAll = analysesList.filter(a => a.status === 'completed');
    completedAll.forEach(a => {
      if (a.findings && typeof a.findings === 'object' && a.findings.amountPaid) {
        totalRevenue += Number(a.findings.amountPaid) || 0;
      }
    });
    const ticketMedio = completedAll.length > 0 ? totalRevenue / completedAll.length : 0;

    const { count: propertiesCount } = await supabaseAdmin.from('properties').select('*', { count: 'exact', head: true });

    // 9. Buscar últimas análises com os JOINS para a tabela de análises recentes
    const { data: recentAnalyses } = await supabaseAdmin
      .from('analyses')
      .select(`
        id,
        status,
        risk_level,
        created_at,
        findings,
        profiles ( name, email, whatsapp ),
        properties ( name )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      stats: {
        users: usersList.length,
        onlineUsers: onlineCount,
        incompleteUsers: incompleteCount,
        properties: propertiesCount || 0,
        analyses: analysesList.length,
        revenue: totalRevenue,
        ticketMedio: ticketMedio
      },
      usersList: enrichedUsers,
      recentAnalyses: recentAnalyses || []
    });

  } catch (error: any) {
    console.error('Erro no painel admin:', error);
    return NextResponse.json({ error: error.message || 'Falha ao buscar dados' }, { status: 500 });
  }
}
