import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function hasValidCronSecret(req: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization');
  const providedSecret = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!configuredSecret || !providedSecret) return false;

  const configuredBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(providedSecret);

  return configuredBuffer.length === providedBuffer.length
    && timingSafeEqual(configuredBuffer, providedBuffer);
}

// Rota de Cron Job (Para ser chamada diariamente 1x ao dia)
// Exemplo de URL: http://localhost:3000/api/cron/reminders
export async function GET(req: Request) {
  try {
    if (!hasValidCronSecret(req)) {
      return NextResponse.json({ error: 'Rota indisponível.' }, { status: 404 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials missing for Cron.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // 1. Busca todas as tarefas que estão pendentes
    const { data: tasks, error } = await supabaseAdmin
      .from('environmental_tasks')
      .select('*, profiles(email, name), properties(name)')
      .eq('status', 'Pendente');

    if (error) throw new Error(error.message);
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ message: 'Nenhuma tarefa pendente para notificar hoje.' });
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    
    let emailsSent = 0;
    let whatsappsSent = 0;

    for (const task of tasks) {
      // Forçar fuso local para evitar que 00:00 UTC vire 21:00 do dia anterior no Brasil
      const [y, m, d] = task.due_date.split('-');
      const dueDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      dueDate.setHours(0,0,0,0);
      
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Regra de Disparo: Avisa quando faltar 7 dias, 3 dias e no dia exato (0 dias).
      if (diffDays === 7 || diffDays === 3 || diffDays === 0) {
        
        const clientEmail = task.profiles?.email;
        const clientName = task.profiles?.name;
        const propName = task.properties?.name;

        const warningLevel = diffDays === 0 ? '🚨 URGENTE: VENCE HOJE!' : `⏳ Faltam ${diffDays} dias para o vencimento.`;
        const msg = `Olá ${clientName},\n\nO AgroLex informa: A obrigação ambiental "${task.title}" da propriedade ${propName} exige sua atenção.\n${warningLevel}\n\nAcesse seu painel para mais detalhes.`;

        // [SIMULAÇÃO DE DISPARO DE WHATSAPP]
        console.log(`\n==========================================`);
        console.log(`📱 [WHATSAPP DISPARADO] Para: Cliente AgroLex`);
        console.log(`Mensagem:\n${msg}`);
        console.log(`==========================================\n`);
        whatsappsSent++;

        // [DISPARO DE E-MAIL]
        if (process.env.RESEND_API_KEY) {
           const { Resend } = require('resend');
           const resend = new Resend(process.env.RESEND_API_KEY);
           await resend.emails.send({
             from: 'AgroLex Alertas <onboarding@resend.dev>',
             to: clientEmail || 'comprador@teste.com',
             subject: `Alerta de Condicionante - ${task.title}`,
             text: msg
           });
           emailsSent++;
        } else {
           console.log(`✉️ [E-MAIL SIMULADO] Para: ${clientEmail}`);
           console.log(`Assunto: Alerta de Condicionante - ${task.title}`);
           console.log(`Corpo:\n${msg}`);
           emailsSent++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Varredura de Calendário concluída.',
      stats: { emails: emailsSent, whatsapps: whatsappsSent }
    });

  } catch (err: any) {
    console.error('Erro no Cron de Calendário:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
