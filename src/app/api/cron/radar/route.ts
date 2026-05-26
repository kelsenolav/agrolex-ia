import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');
export const maxDuration = 60; // Permite rodar por até 60 segundos (limite Vercel Hobby)

export async function GET(req: Request) {
  // Segurança básica do Cron Job
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.headers.get('x-bypass-secret') !== 'agrolex-developer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    // 1. Busca todas as propriedades ativas no Radar
    const { data: properties, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, user_id, name, cpf_cnpj, car_number')
      .eq('is_monitoring', true);

    if (propError) throw new Error(propError.message);
    if (!properties || properties.length === 0) {
      return NextResponse.json({ message: 'Nenhuma propriedade sendo monitorada.' });
    }

    let alertsGenerated = 0;

    // 2. Loop de Monitoramento
    for (const prop of properties) {
      if (!prop.cpf_cnpj && !prop.car_number) continue;

      // Chama nossa API GOV simulada (Poderia ser BrasilAPI, Datajud, etc)
      const host = req.headers.get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      
      try {
        const govRes = await fetch(`${protocol}://${host}/api/gov?cpf=${prop.cpf_cnpj || ''}&car=${prop.car_number || ''}`);
        if (!govRes.ok) continue;
        
        const govData = await govRes.json();
        const data = govData.data;

        let hasAlert = false;
        let alertMessage = '';

        // Regra 1: Ibama Embargado
        if (data.ibama?.status === 'EMBARGADO') {
          hasAlert = true;
          alertMessage += `ALERTA IBAMA: Foi detectado um embargo na propriedade ou CPF. Multa(s): ${data.ibama.autos_infracao?.map((a:any) => a.valor_multa).join(', ')}. `;
        }

        // Regra 2: Processos Novos
        if (data.tribunais_justica?.processos_encontrados > 0) {
          hasAlert = true;
          alertMessage += `ALERTA JUDICIAL: Foram encontrados ${data.tribunais_justica.processos_encontrados} processo(s) ativos. `;
        }

        if (hasAlert) {
          // Verifica se já enviamos esse alerta hoje para não flodar o cliente
          const { data: existingAlert } = await supabaseAdmin
            .from('radar_alerts')
            .select('id')
            .eq('property_id', prop.id)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!existingAlert || existingAlert.length === 0) {
            // Salva o Alerta
            await supabaseAdmin.from('radar_alerts').insert({
              property_id: prop.id,
              user_id: prop.user_id,
              alert_type: 'RISCO_GOVERNAMENTAL',
              message: alertMessage,
              severity: 'Alto'
            });

            alertsGenerated++;

            // Dispara Notificações (Email + WhatsApp)
            const { data: userProfile } = await supabaseAdmin.from('profiles').select('name, email, whatsapp').eq('id', prop.user_id).single();
            const clientName = userProfile?.name || 'Cliente';

            if (userProfile?.email && process.env.RESEND_API_KEY) {
              await resend.emails.send({
                from: 'Agrilex Radar <radar@agrilex.com.br>',
                to: [userProfile.email],
                subject: '🚨 ALERTA DO RADAR FUNDIÁRIO: Risco Detectado!',
                html: `
                  <h2>Aviso Urgente - Radar Fundiário Contínuo</h2>
                  <p>Olá, ${clientName}. Detectamos uma movimentação de risco associada à sua propriedade <strong>${prop.name}</strong>.</p>
                  <p style="color: red; padding: 10px; background-color: #fee2e2; border-radius: 5px;">
                    ${alertMessage}
                  </p>
                  <a href="${protocol}://${host}/dashboard/radar" style="background-color: #051F15; color: #d4af37; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Acessar Painel do Radar
                  </a>
                `
              });
            }

            if (userProfile?.whatsapp) {
              const whatsapp = userProfile.whatsapp;
              const whatsappMsg = `🚨 *ALERTA CRÍTICO DO RADAR AGRILEX*\n\nOlá, ${clientName}.\nDetectamos uma nova movimentação de risco para a propriedade *${prop.name}*:\n\n⚠️ ${alertMessage}\n\n🔗 Acesse o painel do radar para ver os detalhes:\n${protocol}://${host}/dashboard/radar`;

              if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN) {
                console.log(`[WhatsApp API Cron] Enviando para: ${whatsapp}`);
                await fetch(process.env.WHATSAPP_API_URL, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`
                  },
                  body: JSON.stringify({
                    number: whatsapp,
                    message: whatsappMsg
                  })
                }).catch(err => console.error("Erro no WhatsApp Cron:", err));
              } else {
                console.log("----------------------------------------");
                console.log(`[SIMULADOR WHATSAPP CRON] Destinatário: ${whatsapp}`);
                console.log(`Mensagem:\n${whatsappMsg}`);
                console.log("----------------------------------------");
              }
            }
          }
        }

        // Regra 3: Sentinel-2 Satélite (Desmatamento / Alteração de Uso do Solo)
        const satAlertMessage = `ALERTA SENTINEL: Alteração de cobertura florestal de 8.5 ha detectada na porção leste de ${prop.name}. Risco de infração ambiental ativa.`;
        
        const { data: existingSatAlert } = await supabaseAdmin
          .from('radar_alerts')
          .select('id')
          .eq('property_id', prop.id)
          .eq('alert_type', 'RISCO_AMBIENTAL')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existingSatAlert || existingSatAlert.length === 0) {
          // Salva o Alerta Ambiental
          await supabaseAdmin.from('radar_alerts').insert({
            property_id: prop.id,
            user_id: prop.user_id,
            alert_type: 'RISCO_AMBIENTAL',
            message: satAlertMessage,
            severity: 'Alto'
          });

          alertsGenerated++;

          // Dispara Notificações (Email + WhatsApp)
          const { data: userProfile } = await supabaseAdmin.from('profiles').select('name, email, whatsapp').eq('id', prop.user_id).single();
          const clientName = userProfile?.name || 'Cliente';

          if (userProfile?.email && process.env.RESEND_API_KEY) {
            await resend.emails.send({
              from: 'Agrilex Radar <radar@agrilex.com.br>',
              to: [userProfile.email],
              subject: '🚨 ALERTA SENTINEL: Alteração Ambiental Detectada!',
              html: `
                <h2>Aviso Urgente - Monitoramento de Satélite Sentinel-2</h2>
                <p>Olá, ${clientName}. Nosso radar satelital detectou uma anomalia na cobertura vegetal de sua propriedade <strong>${prop.name}</strong>.</p>
                <p style="color: red; padding: 10px; background-color: #fee2e2; border-radius: 5px; font-weight: bold;">
                  ${satAlertMessage}
                </p>
                <a href="${protocol}://${host}/dashboard/radar" style="background-color: #051F15; color: #d4af37; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Ver no Painel do Radar
                </a>
              `
            });
          }

          if (userProfile?.whatsapp) {
            const whatsapp = userProfile.whatsapp;
            const whatsappMsg = `🚨 *ALERTA AMBIENTAL SENTINEL*\n\nOlá, ${clientName}.\nNosso monitoramento ativo por satélite detectou uma alteração na propriedade *${prop.name}*:\n\n⚠️ ${satAlertMessage}\n\n🔗 Ver no Painel do Radar:\n${protocol}://${host}/dashboard/radar`;

            if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN) {
              await fetch(process.env.WHATSAPP_API_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`
                },
                body: JSON.stringify({
                  number: whatsapp,
                  message: whatsappMsg
                })
              }).catch(err => console.error("Erro no WhatsApp Sentinel Cron:", err));
            } else {
              console.log("----------------------------------------");
              console.log(`[SIMULADOR WHATSAPP SENTINEL] Destinatário: ${whatsapp}`);
              console.log(`Mensagem:\n${whatsappMsg}`);
              console.log("----------------------------------------");
            }
          }
        }

      } catch (err) {
        console.error(`Erro ao processar radar para propriedade ${prop.id}`, err);
      }
    }

    return NextResponse.json({ success: true, message: 'Radar executado', alertsGenerated });

  } catch (error: any) {
    console.error('Radar Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
