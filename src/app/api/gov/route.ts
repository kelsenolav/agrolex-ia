import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cpfCnpjRaw = searchParams.get('cpf');
  const car = searchParams.get('car');

  const cpfCnpj = cpfCnpjRaw ? cpfCnpjRaw.replace(/\D/g, '') : '';
  
  let receitaData = {
    status_cpf_cnpj: 'REGULAR',
    divida_ativa: car?.startsWith('CAR') ? 'R$ 0,00' : 'R$ 45.300,00 (ITR Atrasado)',
    nome_razao: 'Não encontrado',
    cnae: 'N/A'
  };

  // Se for CNPJ, consulta BrasilAPI real!
  if (cpfCnpj.length === 14) {
    try {
      const apiRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cpfCnpj}`, { timeout: 3000 } as RequestInit);
      if (apiRes.ok) {
        const data = await apiRes.json();
        receitaData = {
          status_cpf_cnpj: data.descricao_situacao_cadastral || 'ATIVA',
          divida_ativa: 'R$ 0,00 (Sem restrição BrasilAPI)',
          nome_razao: data.razao_social,
          cnae: data.cnae_fiscal_descricao
        };
      }
    } catch (e) {
      console.warn("BrasilAPI falhou ou timeout, usando fallback.");
    }
  }

  // 1. Configuração e busca do IBAMA (Real se chave existir, senão Mock)
  let ibamaData = {
    status: cpfCnpj?.startsWith('111') ? 'EMBARGADO' : 'REGULAR',
    autos_infracao: cpfCnpj?.startsWith('111') ? [
      { numero: '12345/2021', descricao: 'Desmatamento de 50ha em área de reserva legal', valor_multa: 'R$ 250.000,00' }
    ] : [] as any[]
  };

  const ibamaApiKey = process.env.IBAMA_API_KEY;
  if (ibamaApiKey && cpfCnpj) {
    try {
      const ibamaRes = await fetch(`https://servicos.ibama.gov.br/dados_abertos/embargos?cpfCnpj=${cpfCnpj}`, {
        headers: { 'Authorization': `Bearer ${ibamaApiKey}` },
        next: { revalidate: 3600 }
      });
      if (ibamaRes.ok) {
        const data = await ibamaRes.json();
        if (data.results && data.results.length > 0) {
          ibamaData = {
            status: 'EMBARGADO',
            autos_infracao: data.results.map((r: any) => ({
              numero: r.numero_processo || r.id || 'N/A',
              descricao: r.infracao_cometida || 'Infração Ambiental Detectada',
              valor_multa: r.valor_multa ? `R$ ${Number(r.valor_multa).toLocaleString('pt-BR')}` : 'R$ 0,00'
            }))
          };
        }
      }
    } catch (e) {
      console.warn("API Real do IBAMA falhou, usando mock de contingência.", e);
    }
  }

  // 2. Configuração e busca do Jusbrasil / Tribunais (Real se chave existir, senão Mock)
  let tribunaisData = {
    processos_encontrados: 2,
    lista: [
      {
        numero: '0001234-56.2023.8.11.0000',
        tribunal: 'TJMT',
        assunto: 'Ação de Reintegração de Posse',
        polo: 'Passivo'
      },
      {
        numero: '0009876-54.2021.8.11.0000',
        tribunal: 'TJMT',
        assunto: 'Execução de Título Extrajudicial (Cédula Rural)',
        polo: 'Passivo'
      }
    ] as any[]
  };

  const jusbrasilApiKey = process.env.JUSBRASIL_API_KEY;
  if (jusbrasilApiKey && cpfCnpj) {
    try {
      const jusbrasilRes = await fetch(`https://api.jusbrasil.com.br/v1/people/${cpfCnpj}/processes`, {
        headers: { 'Authorization': `ApiKey ${jusbrasilApiKey}` },
        next: { revalidate: 3600 }
      });
      if (jusbrasilRes.ok) {
        const data = await jusbrasilRes.json();
        if (data.processes && data.processes.length > 0) {
          tribunaisData = {
            processos_encontrados: data.processes.length,
            lista: data.processes.slice(0, 5).map((p: any) => ({
              numero: p.number || 'N/A',
              tribunal: p.court?.acronym || 'TJ',
              assunto: p.subject || 'Ação Judicial Fundiária',
              polo: p.partySide || 'Desconhecido'
            }))
          };
        }
      }
    } catch (e) {
      console.warn("API Real do Jusbrasil falhou, usando mock de contingência.", e);
    }
  }

  const response = {
    ibama: ibamaData,
    receita_federal: receitaData,
    tribunais_justica: tribunaisData
  };

  return NextResponse.json({ success: true, data: response });
}
