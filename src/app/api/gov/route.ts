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

  // Mantemos o mock do IBAMA e TJs
  const response = {
    ibama: {
      status: cpfCnpj?.startsWith('111') ? 'EMBARGADO' : 'REGULAR',
      autos_infracao: cpfCnpj?.startsWith('111') ? [
        { numero: '12345/2021', descricao: 'Desmatamento de 50ha em área de reserva legal', valor_multa: 'R$ 250.000,00' }
      ] : []
    },
    receita_federal: receitaData,
    tribunais_justica: {
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
      ]
    }
  };

  return NextResponse.json({ success: true, data: response });
}
