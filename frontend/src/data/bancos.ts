export interface BancoItem {
  codigo: string;
  nome: string;
  apelido?: string;
  sinonimos?: string[];
  parceiro?: boolean;
}

// Dicionário de nomes populares e sinônimos de busca para instituições financeiras brasileiras
export const APELIDOS_BANCOS: Record<string, { apelido: string; sinonimos: string[] }> = {
  '341': { apelido: 'Itaú', sinonimos: ['itau', 'itaucard', 'iti', 'banco itau', 'unibanco'] },
  '237': { apelido: 'Bradesco', sinonimos: ['bradesco', 'next', 'banco bradesco', 'bradesco cartoes'] },
  '033': { apelido: 'Santander', sinonimos: ['santander', 'banco santander', 'santander brasil'] },
  '260': { apelido: 'Nubank', sinonimos: ['nubank', 'nu bank', 'nu', 'nu pagamentos', 'nu financeira'] },
  '001': { apelido: 'Banco do Brasil', sinonimos: ['bb', 'banco do brasil', 'bancodobrasil'] },
  '104': { apelido: 'Caixa Econômica', sinonimos: ['caixa', 'cef', 'caixa economica federal', 'caixa tem'] },
  '077': { apelido: 'Banco Inter', sinonimos: ['inter', 'banco inter', 'intermedium', 'inter bank'] },
  '336': { apelido: 'C6 Bank', sinonimos: ['c6', 'c6 bank', 'banco c6'] },
  '290': { apelido: 'PagBank / PagSeguro', sinonimos: ['pagbank', 'pagseguro', 'pag seguro', 'pag bank'] },
  '380': { apelido: 'PicPay', sinonimos: ['picpay', 'pic pay', 'picpay pagamentos'] },
  '323': { apelido: 'Mercado Pago', sinonimos: ['mercado pago', 'mercadopago', 'mp'] },
  '655': { apelido: 'Banco Neon', sinonimos: ['neon', 'banco neon', 'votorantim', 'banco votorantim'] },
  '748': { apelido: 'Sicredi', sinonimos: ['sicredi', 'banco sicredi', 'cooperativa sicredi'] },
  '756': { apelido: 'Sicoob', sinonimos: ['sicoob', 'bancoob', 'banco sicoob', 'banco cooperativo do brasil'] },
  '085': { apelido: 'Viacredi / Ailos', sinonimos: ['ailos', 'viacredi', 'cecred', 'cooperativa ailos'] },
  '136': { apelido: 'Unicred', sinonimos: ['unicred', 'banco unicred', 'unicred do brasil'] },
  '212': { apelido: 'Banco Original', sinonimos: ['original', 'banco original'] },
  '623': { apelido: 'Banco PAN', sinonimos: ['pan', 'banco pan', 'panamericano'] },
  '318': { apelido: 'Banco BMG', sinonimos: ['bmg', 'banco bmg'] },
  '069': { apelido: 'Crefisa', sinonimos: ['crefisa', 'banco crefisa'] },
  '218': { apelido: 'Banco BS2', sinonimos: ['bs2', 'banco bs2', 'bonsucesso'] },
  '654': { apelido: 'Banco Digimais', sinonimos: ['digimais', 'banco digimais', 'renner'] },
  '041': { apelido: 'Banrisul', sinonimos: ['banrisul', 'banco banrisul', 'rio grande do sul'] },
  '070': { apelido: 'BRB', sinonimos: ['brb', 'banco de brasilia', 'brasilia'] },
  '047': { apelido: 'Banese', sinonimos: ['banese', 'banco banese', 'sergipe'] },
  '021': { apelido: 'Banestes', sinonimos: ['banestes', 'banco banestes', 'espirito santo'] },
  '422': { apelido: 'Safra', sinonimos: ['safra', 'banco safra'] },
  '074': { apelido: 'J. Safra', sinonimos: ['j safra', 'banco j safra'] },
  '208': { apelido: 'BTG Pactual', sinonimos: ['btg', 'btg pactual', 'banco btg'] },
  '403': { apelido: 'Cora', sinonimos: ['cora', 'banco cora', 'cora scd'] },
  '280': { apelido: 'Will Bank', sinonimos: ['will', 'will bank', 'willbank', 'avista'] },
  '335': { apelido: 'Digio', sinonimos: ['digio', 'banco digio'] },
  '197': { apelido: 'Stone / Ton', sinonimos: ['stone', 'ton', 'stone pagamentos'] },
  '348': { apelido: 'Banco XP', sinonimos: ['xp', 'banco xp', 'xp investimentos'] },
  '102': { apelido: 'XP Investimentos', sinonimos: ['xp', 'xp corretora', 'xp investimentos'] },
  '745': { apelido: 'Citibank', sinonimos: ['citibank', 'citi', 'banco citibank'] },
  '389': { apelido: 'Mercantil do Brasil', sinonimos: ['mercantil', 'banco mercantil', 'mercantil do brasil'] },
  '637': { apelido: 'Sofisa', sinonimos: ['sofisa', 'banco sofisa', 'sofisa direto'] },
  '707': { apelido: 'Daycoval', sinonimos: ['daycoval', 'banco daycoval'] },
  '643': { apelido: 'Pine', sinonimos: ['pine', 'banco pine'] },
};

function formatarNomeComApelido(codigo: string, nomeOriginal: string): { nomeExibicao: string; apelido?: string; sinonimos?: string[] } {
  const info = APELIDOS_BANCOS[codigo];
  if (info) {
    const nomeLimpo = nomeOriginal.replace(/\s*\(.*?\)\s*/g, '').trim();
    return {
      nomeExibicao: `${nomeLimpo} (${info.apelido})`,
      apelido: info.apelido,
      sinonimos: info.sinonimos,
    };
  }
  return { nomeExibicao: nomeOriginal };
}

export const LISTA_BANCOS_BRASIL: BancoItem[] = [
  // Bancos Parceiros Principais ATESA
  { codigo: '341', nome: 'Itaú Unibanco S.A. (Itaú)', apelido: 'Itaú', sinonimos: ['itau', 'itaucard', 'iti', 'banco itau'], parceiro: true },
  { codigo: '237', nome: 'Banco Bradesco S.A. (Bradesco)', apelido: 'Bradesco', sinonimos: ['bradesco', 'next', 'banco bradesco'], parceiro: true },
  { codigo: '033', nome: 'Banco Santander (Brasil) S.A. (Santander)', apelido: 'Santander', sinonimos: ['santander', 'banco santander'], parceiro: true },

  // Principais Instituições do Brasil
  { codigo: '260', nome: 'Nu Pagamentos S.A. (Nubank)', apelido: 'Nubank', sinonimos: ['nubank', 'nu bank', 'nu', 'nu pagamentos'] },
  { codigo: '001', nome: 'Banco do Brasil S.A. (BB)', apelido: 'Banco do Brasil', sinonimos: ['bb', 'banco do brasil'] },
  { codigo: '104', nome: 'Caixa Econômica Federal (Caixa)', apelido: 'Caixa Econômica', sinonimos: ['caixa', 'cef', 'caixa tem'] },
  { codigo: '077', nome: 'Banco Inter S.A. (Inter)', apelido: 'Banco Inter', sinonimos: ['inter', 'banco inter'] },
  { codigo: '336', nome: 'Banco C6 S.A. (C6 Bank)', apelido: 'C6 Bank', sinonimos: ['c6', 'c6 bank', 'banco c6'] },
  { codigo: '290', nome: 'PagBank (PagSeguro)', apelido: 'PagBank / PagSeguro', sinonimos: ['pagbank', 'pagseguro', 'pag seguro'] },
  { codigo: '380', nome: 'PicPay Instituição de Pagamento S.A. (PicPay)', apelido: 'PicPay', sinonimos: ['picpay', 'pic pay'] },
  { codigo: '323', nome: 'Mercado Pago Instituição de Pagamento (Mercado Pago)', apelido: 'Mercado Pago', sinonimos: ['mercado pago', 'mercadopago'] },
  { codigo: '655', nome: 'Banco Neon / Votorantim (Neon)', apelido: 'Banco Neon', sinonimos: ['neon', 'banco neon'] },
  { codigo: '748', nome: 'Banco Cooperativo Sicredi S.A. (Sicredi)', apelido: 'Sicredi', sinonimos: ['sicredi', 'banco sicredi'] },
  { codigo: '756', nome: 'Banco Cooperativo do Brasil (Sicoob)', apelido: 'Sicoob', sinonimos: ['sicoob', 'banco sicoob'] },
  { codigo: '085', nome: 'Cooperativa Central de Crédito (Ailos / Viacredi)', apelido: 'Viacredi / Ailos', sinonimos: ['ailos', 'viacredi'] },
  { codigo: '136', nome: 'Unicred do Brasil (Unicred)', apelido: 'Unicred', sinonimos: ['unicred', 'banco unicred'] },
  { codigo: '212', nome: 'Banco Original S.A. (Original)', apelido: 'Banco Original', sinonimos: ['original', 'banco original'] },
  { codigo: '623', nome: 'Banco PAN S.A. (Banco Pan)', apelido: 'Banco PAN', sinonimos: ['pan', 'banco pan'] },
  { codigo: '318', nome: 'Banco BMG S.A. (BMG)', apelido: 'Banco BMG', sinonimos: ['bmg', 'banco bmg'] },
  { codigo: '069', nome: 'Banco Crefisa S.A. (Crefisa)', apelido: 'Crefisa', sinonimos: ['crefisa', 'banco crefisa'] },
  { codigo: '218', nome: 'Banco BS2 S.A. (BS2)', apelido: 'Banco BS2', sinonimos: ['bs2', 'banco bs2'] },
  { codigo: '654', nome: 'Banco Digimais S.A. (Digimais)', apelido: 'Banco Digimais', sinonimos: ['digimais', 'banco digimais'] },
  { codigo: '041', nome: 'Banco do Estado do Rio Grande do Sul (Banrisul)', apelido: 'Banrisul', sinonimos: ['banrisul', 'banco banrisul'] },
  { codigo: '070', nome: 'Banco de Brasília S.A. (BRB)', apelido: 'BRB', sinonimos: ['brb', 'banco de brasilia'] },
  { codigo: '047', nome: 'Banco do Estado de Sergipe (Banese)', apelido: 'Banese', sinonimos: ['banese', 'banco banese'] },
  { codigo: '021', nome: 'Banco do Estado do Espírito Santo (Banestes)', apelido: 'Banestes', sinonimos: ['banestes', 'banco banestes'] },
  { codigo: '422', nome: 'Banco Safra S.A. (Safra)', apelido: 'Safra', sinonimos: ['safra', 'banco safra'] },
  { codigo: '208', nome: 'Banco BTG Pactual S.A. (BTG Pactual)', apelido: 'BTG Pactual', sinonimos: ['btg', 'btg pactual'] },
  { codigo: '403', nome: 'Banco Cora SCD S.A. (Cora)', apelido: 'Cora', sinonimos: ['cora', 'banco cora'] },
  { codigo: '280', nome: 'Will Financeira S.A. (Will Bank)', apelido: 'Will Bank', sinonimos: ['will', 'will bank', 'willbank'] },
  { codigo: '335', nome: 'Banco Digio S.A. (Digio)', apelido: 'Digio', sinonimos: ['digio', 'banco digio'] },
  { codigo: '197', nome: 'Stone Pagamentos S.A. (Stone / Ton)', apelido: 'Stone / Ton', sinonimos: ['stone', 'ton'] },
  { codigo: '348', nome: 'Banco XP S.A. (XP)', apelido: 'Banco XP', sinonimos: ['xp', 'banco xp'] },
  { codigo: '745', nome: 'Banco Citibank S.A. (Citibank)', apelido: 'Citibank', sinonimos: ['citibank', 'citi'] },
  { codigo: '389', nome: 'Banco Mercantil do Brasil S.A. (Mercantil)', apelido: 'Mercantil do Brasil', sinonimos: ['mercantil', 'banco mercantil'] },
];

let cacheBancosBrasilApi: BancoItem[] | null = null;

/**
 * Busca a lista completa de bancos da BrasilAPI (com enriquecimento de apelidos populares e sinônimos de busca)
 */
export async function obterTodosOsBancos(): Promise<BancoItem[]> {
  if (cacheBancosBrasilApi && cacheBancosBrasilApi.length > 0) {
    return cacheBancosBrasilApi;
  }

  try {
    const res = await fetch('https://brasilapi.com.br/api/banks/v1');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const bancosFormatados: BancoItem[] = data
          .filter((b: any) => b.code !== null && (b.name || b.fullName))
          .map((b: any) => {
            const codStr = String(b.code).padStart(3, '0');
            const ehParceiro = ['341', '237', '033'].includes(codStr);
            const nomeBase = b.fullName || b.name;
            const { nomeExibicao, apelido, sinonimos } = formatarNomeComApelido(codStr, nomeBase);

            return {
              codigo: codStr,
              nome: nomeExibicao,
              apelido,
              sinonimos,
              parceiro: ehParceiro,
            };
          });

        // Adiciona da lista local os bancos que porventura não vieram na API
        for (const local of LISTA_BANCOS_BRASIL) {
          if (!bancosFormatados.some(b => b.codigo === local.codigo)) {
            bancosFormatados.push(local);
          }
        }

        // Ordena colocando os parceiros primeiro e depois alfabético por nome exibido
        bancosFormatados.sort((a, b) => {
          if (a.parceiro && !b.parceiro) return -1;
          if (!a.parceiro && b.parceiro) return 1;
          return a.nome.localeCompare(b.nome);
        });

        cacheBancosBrasilApi = bancosFormatados;
        return bancosFormatados;
      }
    }
  } catch (err) {
    console.warn('BrasilAPI Banks indisponível, usando lista local enriquecida.', err);
  }

  cacheBancosBrasilApi = LISTA_BANCOS_BRASIL;
  return LISTA_BANCOS_BRASIL;
}
