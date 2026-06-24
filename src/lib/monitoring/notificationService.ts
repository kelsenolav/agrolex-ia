import type { ExternalCheckAlert } from './externalDataProviders';

export interface NotificationPayload {
  user_email: string;
  user_name?: string;
  property_name: string;
  alerts: ExternalCheckAlert[];
  radar_url: string;
}

function buildEmailHtml(payload: NotificationPayload): string {
  const { user_name, property_name, alerts, radar_url } = payload;
  const nome = user_name || 'Proprietário';
  const criticals = alerts.filter(a => a.severity === 'critical');
  const warnings = alerts.filter(a => a.severity === 'warning');

  const alertRows = alerts.map(a => {
    const color = a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#d97706' : '#2563eb';
    const label = a.severity === 'critical' ? 'CRÍTICO' : a.severity === 'warning' ? 'ATENÇÃO' : 'INFO';
    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;color:#fff;background:${color};margin-bottom:4px;">${label}</span>
          <div style="font-weight:600;color:#111827;margin-top:4px;">${a.title}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:2px;">${a.description}</div>
        </td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#064e3b;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;color:#fff;font-size:18px;">🛡️ AgrolexI — Radar Fundiário</h1>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
      <p style="margin:0 0 16px;color:#374151;">Olá, ${nome}.</p>
      <p style="margin:0 0 16px;color:#374151;">
        A varredura automática do <strong>Radar de Monitoramento Fundiário</strong> detectou
        <strong style="color:#dc2626;">${criticals.length} alerta${criticals.length !== 1 ? 's' : ''} crítico${criticals.length !== 1 ? 's' : ''}</strong> e
        <strong style="color:#d97706;">${warnings.length} alerta${warnings.length !== 1 ? 's' : ''} de atenção</strong>
        para a propriedade <strong>"${property_name}"</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tbody>${alertRows}</tbody>
      </table>
      <div style="text-align:center;margin-top:24px;">
        <a href="${radar_url}" style="display:inline-block;padding:12px 32px;background:#059669;color:#fff;font-weight:700;text-decoration:none;border-radius:8px;font-size:14px;">
          Abrir Radar Fundiário →
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
        Este alerta foi gerado automaticamente pelo AgrolexI. Para desativar, acesse o Radar e desmarque o monitoramento da propriedade.
      </p>
    </div>
    <div style="padding:12px 24px;text-align:center;border-radius:0 0 12px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} AgrolexI — Inteligência Fundiária</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendRadarNotification(payload: NotificationPayload): Promise<{ sent: boolean; method: string; error?: string }> {
  if (payload.alerts.length === 0) {
    return { sent: false, method: 'skip', error: 'Nenhum alerta para notificar' };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'AgrolexI Radar <radar@agrolex.dev>',
          to: [payload.user_email],
          subject: `🛡️ Radar AgrolexI — ${payload.alerts.length} alerta(s) para "${payload.property_name}"`,
          html: buildEmailHtml(payload),
        }),
      });

      if (res.ok) {
        return { sent: true, method: 'resend' };
      }
      const errBody = await res.text();
      return { sent: false, method: 'resend', error: `HTTP ${res.status}: ${errBody}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { sent: false, method: 'resend', error: msg };
    }
  }

  console.log(`[Radar Notification] E-mail não enviado (RESEND_API_KEY não configurada). ${payload.alerts.length} alertas para ${payload.user_email} — propriedade "${payload.property_name}"`);
  return { sent: false, method: 'log_only', error: 'RESEND_API_KEY não configurada' };
}

// ─── Lembrete de renovação do Radar (Eixo 2 / 2.1) ───────────────────────────

export interface RenewalReminderPayload {
  user_email: string;
  user_name?: string;
  /** Dias até expirar (negativo = já expirou). */
  days_until_expiry: number;
  renew_url: string;
}

function buildRenewalEmailHtml(p: RenewalReminderPayload): string {
  const nome = p.user_name || 'Proprietário';
  const expirou = p.days_until_expiry < 0;
  const titulo = expirou
    ? 'Sua proteção do Radar expirou'
    : p.days_until_expiry === 0
      ? 'Sua proteção do Radar expira hoje'
      : `Sua proteção do Radar expira em ${p.days_until_expiry} dia${p.days_until_expiry !== 1 ? 's' : ''}`;
  const corpo = expirou
    ? 'O monitoramento contínuo das suas propriedades foi <strong>interrompido</strong>. Sem o Radar ativo, você deixa de ser avisado sobre novos gravames, penhoras, ações judiciais e mudanças registrais.'
    : 'Para manter a vigilância contínua das suas propriedades — alertas de gravames, penhoras, ações e mudanças registrais — renove antes do vencimento e não deixe nenhuma janela descoberta.';
  const cta = expirou ? 'Reativar o Radar →' : 'Renovar o Radar →';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#064e3b;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;color:#fff;font-size:18px;">🛡️ AgrolexI — Radar Fundiário</h1>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
      <p style="margin:0 0 8px;color:#111827;font-size:17px;font-weight:700;">${titulo}</p>
      <p style="margin:0 0 16px;color:#374151;">Olá, ${nome}.</p>
      <p style="margin:0 0 16px;color:#374151;">${corpo}</p>
      <div style="text-align:center;margin-top:24px;">
        <a href="${p.renew_url}" style="display:inline-block;padding:12px 32px;background:${expirou ? '#dc2626' : '#059669'};color:#fff;font-weight:700;text-decoration:none;border-radius:8px;font-size:14px;">
          ${cta}
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
        A partir de R$ 49,90/propriedade ao mês. Cancele quando quiser.
      </p>
    </div>
    <div style="padding:12px 24px;text-align:center;border-radius:0 0 12px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} AgrolexI — Inteligência Fundiária</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendRadarRenewalReminder(
  payload: RenewalReminderPayload,
): Promise<{ sent: boolean; method: string; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  const expirou = payload.days_until_expiry < 0;
  const subject = expirou
    ? '🛡️ Seu Radar AgrolexI expirou — reative a proteção'
    : `🛡️ Seu Radar AgrolexI expira em ${Math.max(0, payload.days_until_expiry)} dia(s) — renove`;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'AgrolexI Radar <radar@agrolex.dev>',
          to: [payload.user_email],
          subject,
          html: buildRenewalEmailHtml(payload),
        }),
      });
      if (res.ok) return { sent: true, method: 'resend' };
      return { sent: false, method: 'resend', error: `HTTP ${res.status}: ${await res.text()}` };
    } catch (err: unknown) {
      return { sent: false, method: 'resend', error: err instanceof Error ? err.message : String(err) };
    }
  }
  console.log(`[Radar Renewal] E-mail não enviado (sem RESEND_API_KEY) — ${payload.user_email}, expira em ${payload.days_until_expiry}d`);
  return { sent: false, method: 'log_only', error: 'RESEND_API_KEY não configurada' };
}
