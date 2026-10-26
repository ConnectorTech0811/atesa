// ── Prefeituras emissoras da ATESA (cadastro inicial) ──────────────────────
// Informadas pelo usuário em 24/10/2026: a ATESA emite NFS-e em São Paulo, Recife, Fortaleza e Santo André.
// Análise de integração pesquisada nessa data (fontes em docs/nfse-integracao-viabilidade.md).
// Usado uma única vez para cadastrar as emissoras (semearEmissorasAtesa); depois vale o que estiver na tela.
export const EMISSORAS_ATESA = [
  {
    municipio: 'São Paulo',
    uf: 'SP',
    codigo_ibge: '3550308',
    sistema: 'Nota Fiscal Paulistana (webservice municipal) / Emissor Nacional',
    url: 'https://prefeitura.sp.gov.br/web/fazenda/w/usoemissornacional',
    modo_integracao: 'webservice_municipal',
    situacao: 'em_analise',
    requisitos: 'Certificado A1 ICP-Brasil da ATESA (já disponível). Inscrição municipal (CCM). Webservice da NFS-e de São Paulo (manual 3.3.4, layout baseado no padrão nacional).',
    pendencias: 'Confirmar com a contabilidade se a cooperativa (não optante do Simples) continua emitindo pela Nota Fiscal Paulistana ou se migra para o Emissor Nacional: a Prefeitura tornou o Emissor Nacional obrigatório para autônomos/profissionais liberais (03/08/2026) e para o Simples Nacional (01/11/2026), sem data publicada para os demais. Obter o CCM e acesso ao ambiente de testes.',
    observacoes: 'Se a ATESA migrar para o Emissor Nacional, a integração passa a ser pela API da Sefin Nacional (a mesma de Recife). Depois da migração, o sistema municipal fica só para consultas e emissões retroativas.'
  },
  {
    municipio: 'Recife',
    uf: 'PE',
    codigo_ibge: '2611606',
    sistema: 'Emissor Nacional (NFS-e Nacional / Sefin Nacional)',
    url: 'https://recifeemdia.recife.pe.gov.br/nfsetransicao',
    modo_integracao: 'api_nacional',
    situacao: 'viavel',
    requisitos: 'Certificado A1 da ATESA (já disponível). Inscrição municipal no Recife. API REST da Sefin Nacional com a DPS assinada (permite emissão em lote).',
    pendencias: 'Implementar e homologar a integração no ambiente de produção restrita da NFS-e Nacional. Confirmar a inscrição municipal e o código de tributação do serviço.',
    observacoes: 'Desde 01/01/2026 a emissão no Recife é exclusivamente pelo Emissor Nacional (Portaria SEFIN nº 42/2025). O ISS continua sendo recolhido por DAM do sistema municipal.'
  },
  {
    municipio: 'Fortaleza',
    uf: 'CE',
    codigo_ibge: '2304400',
    sistema: 'NFS-e Fortaleza (SEFIN) — sistema próprio no layout nacional',
    url: null,
    modo_integracao: 'webservice_municipal',
    situacao: 'em_analise',
    requisitos: 'Certificado A1 da ATESA (já disponível). Inscrição municipal em Fortaleza.',
    pendencias: 'Confirmar com a SEFIN de Fortaleza se o município mantém emissor próprio (com webservice) ou se aderiu ao Emissor Nacional, e obter o manual/WSDL e o ambiente de homologação.',
    observacoes: 'Desde 30/12/2025 a NFS-e de Fortaleza está na versão compatível com o padrão nacional; os campos da Reforma Tributária são obrigatórios a partir da competência 01/2026.'
  },
  {
    municipio: 'Santo André',
    uf: 'SP',
    codigo_ibge: '3547809',
    sistema: 'Emissor Nacional (a confirmar) — antes GissOnline/Ginfes',
    url: null,
    modo_integracao: 'api_nacional',
    situacao: 'em_analise',
    requisitos: 'Certificado A1 da ATESA (já disponível). Inscrição municipal em Santo André.',
    pendencias: 'As fontes divergem: publicações de 2026 indicam adesão ao Emissor Nacional (Simples obrigado a partir de 01/11/2026), mas há menção a uma nova versão do GissOnline em julho/2026. Confirmar com a Prefeitura qual sistema a cooperativa deve usar.',
    observacoes: 'Se confirmado o Emissor Nacional, a integração é a mesma API da Sefin Nacional usada em Recife.'
  }
];
