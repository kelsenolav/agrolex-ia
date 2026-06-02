import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { PublicReportPrintButton } from '@/components/PublicReportPrintButton';
import { getPublicReport } from '@/lib/publicReports';

export const dynamic = 'force-dynamic';

function getFormattedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR');
}

function getRiskStyles(riskLevel: string) {
  const risk = riskLevel.toLowerCase();
  if (risk === 'alto') return 'border-red-200 bg-red-50 text-red-700';
  if (risk === 'medio' || risk === 'médio') return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  return 'border-green-200 bg-green-50 text-green-700';
}

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await getPublicReport(token);

  if (!report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <section className="w-full max-w-lg rounded-2xl border border-gray-200 border-t-4 border-t-brand-green bg-white p-8 text-center shadow-xl">
          <ShieldCheck className="mx-auto mb-4 text-brand-green" size={48} />
          <h1 className="mb-3 text-2xl font-bold text-gray-800">Link indisponível</h1>
          <p className="text-gray-600">Link inválido, expirado ou revogado.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <header className="bg-brand-green text-white shadow-md print:hidden">
        <div className="container mx-auto flex max-w-4xl items-center gap-2 px-4 py-4">
          <ShieldCheck className="text-brand-gold" size={30} />
          <span className="text-xl font-bold">AgroLex</span>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8 print:px-0 print:py-0">
        <div className="mb-6 hidden items-center justify-between border-b-2 border-brand-green pb-6 print:flex">
          <div className="flex items-center gap-2 text-brand-green">
            <ShieldCheck size={36} />
            <span className="text-3xl font-bold text-gray-900">AgroLex</span>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Laudo Pericial Oficial - IA</p>
            <p>Emitido em: {getFormattedDate(report.createdAt)}</p>
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg print:rounded-none print:border-none print:shadow-none">
          <section className="border-b border-gray-100 p-8">
            <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-green">Parecer compartilhado com acesso seguro</p>
                <h1 className="text-3xl font-extrabold text-gray-800">PARECER TÉCNICO FORENSE DE AUDITORIA REGISTRAL-FUNDIÁRIA</h1>
              </div>
              <div className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3 ${getRiskStyles(report.riskLevel)}`}>
                <AlertTriangle size={22} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Grau de risco</p>
                  <p className="font-black uppercase">{report.riskLevel}</p>
                </div>
              </div>
            </div>
            <p className="text-lg font-medium text-gray-600">{report.propertyName} • {report.propertyLocation}</p>
            <p className="mt-2 text-sm text-gray-500">Parecer emitido em {getFormattedDate(report.createdAt)}</p>
          </section>

          <section className="p-8">
            <h2 className="mb-4 border-b-2 border-gray-100 pb-3 text-2xl font-bold text-brand-dark">Parecer Executivo</h2>
            <div className="whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-6 text-justify text-lg leading-relaxed text-gray-700 print:bg-white">
              {report.resumo}
            </div>
          </section>
        </article>

        <div className="mt-6 flex justify-end">
          <PublicReportPrintButton />
        </div>
      </main>
    </div>
  );
}
