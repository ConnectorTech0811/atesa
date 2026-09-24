import { SuporteCooperadoDetalhe } from '../api/raApi';
import { formatarCPF, formatarDataBR, formatarDataHora } from './formatters';

// Mapeamento de títulos amigáveis para documentos
const ROTULOS_DOCS: Record<string, string> = {
  rg_frente: 'RG / CNH (Frente)',
  rg_verso: 'RG / CNH (Verso)',
  cnh: 'Carteira Nacional de Habilitação (CNH)',
  cpf: 'Cadastro de Pessoa Física (CPF)',
  foto_3x4: 'Foto 3x4 do Cooperado',
  comprovante_residencia: 'Comprovante de Residência',
  comprovante_bancario: 'Comprovante dos Dados Bancários',
  certidao_casamento: 'Certidão de Casamento / Nascimento',
  titulo_eleitor: 'Título de Eleitor',
  carteira_trabalho: 'Carteira de Trabalho (CTPS)',
  declaracao_adesao: 'Declaração Manuscrita de Livre Adesão (Pág. 1)',
  outros: 'Outro Documento Comprobatório',
};

// Converte URL de imagem para Base64 Data URL
async function urlParaBase64(url: string, token?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.startsWith('data:text/html')) {
          resolve(null);
        } else {
          resolve(result);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Formata data por extenso
function formatarDataPorExtenso(cidade: string, uf: string, dataRaw?: string): string {
  const c = cidade || 'São Paulo';
  const u = uf || 'SP';
  try {
    const d = dataRaw ? new Date(dataRaw) : new Date();
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mesExtenso = d.toLocaleString('pt-BR', { month: 'long' });
      const ano = d.getFullYear();
      return `${c} - ${u}, ${dia} de ${mesExtenso} de ${ano}`;
    }
  } catch {}
  return `${c} - ${u}, ${formatarDataBR(dataRaw || new Date().toISOString())}`;
}

// Formata data simples com partes
function formatarPartesData(dataRaw?: string) {
  try {
    const d = dataRaw ? new Date(dataRaw) : new Date();
    if (!isNaN(d.getTime())) {
      return {
        dia: String(d.getDate()).padStart(2, '0'),
        mes: d.toLocaleString('pt-BR', { month: 'long' }),
        ano: String(d.getFullYear()),
        anoCurto: String(d.getFullYear()).slice(-2),
      };
    }
  } catch {}
  const hoje = new Date();
  return {
    dia: String(hoje.getDate()).padStart(2, '0'),
    mes: hoje.toLocaleString('pt-BR', { month: 'long' }),
    ano: String(hoje.getFullYear()),
    anoCurto: String(hoje.getFullYear()).slice(-2),
  };
}

// Gera a página oficial do Termo de Nomeação MetLife desenhando com alta fidelidade sobre o PNG original
async function gerarImagemTermoMetLife(
  candidato: SuporteCooperadoDetalhe,
  dadosJson: Record<string, any>
): Promise<string | null> {
  return new Promise((resolve) => {
    const imgFundo = new Image();
    imgFundo.crossOrigin = 'anonymous';
    imgFundo.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = imgFundo.naturalWidth || 1264;
      canvas.height = imgFundo.naturalHeight || 1774;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // 1. Desenha o fundo oficial do termo MetLife
      ctx.drawImage(imgFundo, 0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#111827';
      ctx.textBaseline = 'middle';

      // Linha 1: Nome do Segurado e CPF
      ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
      const nomeCooperado = (candidato.nome || '').toUpperCase();
      ctx.fillText(nomeCooperado, 160, 266);

      const cpfStr = formatarCPF(candidato.cpf);
      ctx.fillText(cpfStr, 960, 266);

      // Linha 2: Estipulante / Subestipulante
      ctx.font = '600 20px "Segoe UI", Arial, sans-serif';
      const estipulante = `COOPERATIVA DE TRABALHO ATESA - CNPJ: 08.528.917/0001-00`;
      ctx.fillText(estipulante, 440, 336);

      // Linha 3: Nº de Apólice
      ctx.fillText('01.093.581', 270, 404);

      // Tabela de Beneficiários (Linhas 1 a 4)
      const beneficiarios = dadosJson.beneficiariosSeguro || [];
      const linhaYInicial = 538;
      const alturaLinha = 50;

      ctx.font = '600 19px "Segoe UI", Arial, sans-serif';
      for (let i = 0; i < 4; i++) {
        const ben = beneficiarios[i];
        const y = linhaYInicial + i * alturaLinha;
        if (ben && (ben.nome || ben.parentesco)) {
          ctx.fillText((ben.nome || '').toUpperCase(), 80, y);
          const pct = ben.percentual ? `${ben.percentual}%` : '100%';
          ctx.fillText(pct, 760, y);
          ctx.fillText(ben.parentesco || '', 970, y);
        }
      }

      // Local e Data
      const ds = dadosJson.dadosSensiveis || candidato.dadosSensiveis || {};
      const cidade = ds.cidade || candidato.cidade || 'São Paulo';
      const uf = ds.uf || candidato.uf || 'SP';
      const dataSecao12Raw = dadosJson.secao12_preenchida_em || candidato.adesao_atualizado_em || candidato.data_inicio || new Date().toISOString();
      const dataFormatada = formatarDataPorExtenso(cidade, uf, dataSecao12Raw);

      ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
      const xCentroLocalData = 340;
      const larguraTextoData = ctx.measureText(dataFormatada).width;
      ctx.fillText(dataFormatada, xCentroLocalData - larguraTextoData / 2, 1160);

      // Assinatura do Segurado
      const xCentroAssinatura = 880;
      const assinaturaB64 = dadosJson.assinatura_digital_base64;

      if (assinaturaB64) {
        const imgAssinatura = new Image();
        imgAssinatura.onload = () => {
          const largAssin = 260;
          const altAssin = 70;
          ctx.drawImage(imgAssinatura, xCentroAssinatura - largAssin / 2, 1100, largAssin, altAssin);

          ctx.font = '13px "Segoe UI", Arial, sans-serif';
          ctx.fillStyle = '#475569';
          const txtNomeAssin = `${nomeCooperado} · CPF ${cpfStr}`;
          const largNome = ctx.measureText(txtNomeAssin).width;
          ctx.fillText(txtNomeAssin, xCentroAssinatura - largNome / 2, 1205);

          resolve(canvas.toDataURL('image/png', 0.95));
        };
        imgAssinatura.onerror = () => {
          desenharCarimboAssinaturaCanvas(ctx, nomeCooperado, cpfStr, xCentroAssinatura);
          resolve(canvas.toDataURL('image/png', 0.95));
        };
        imgAssinatura.src = assinaturaB64;
      } else {
        desenharCarimboAssinaturaCanvas(ctx, nomeCooperado, cpfStr, xCentroAssinatura);
        resolve(canvas.toDataURL('image/png', 0.95));
      }
    };

    imgFundo.onerror = () => resolve(null);
    imgFundo.src = '/documentos/termo_de_nomeacao.png';
  });
}

function desenharCarimboAssinaturaCanvas(
  ctx: CanvasRenderingContext2D,
  nome: string,
  cpf: string,
  xCentro: number
) {
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#1b5e20';
  const l1 = `${nome}`;
  ctx.fillText(l1, xCentro - ctx.measureText(l1).width / 2, 1145);

  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  const l2 = `Assinado Digitalmente no Portal ATESA · CPF ${cpf}`;
  ctx.fillText(l2, xCentro - ctx.measureText(l2).width / 2, 1165);
}

// Helpers para marcações exatas nos formulários oficiais
const chk = (cond: boolean) => (cond ? '<span class="box-chk checked">X</span>' : '<span class="box-chk">&nbsp;</span>');
const rad = (cond: boolean) => (cond ? '<span class="box-rad checked">●</span>' : '<span class="box-rad">○</span>');

/**
 * Gera e abre o Dossiê Completo Original de Adesão do Cooperado em PDF (15 Páginas Oficiais Idênticas à Matriz Física)
 */
export async function gerarPdfAdesaoCompleta(detalhe: SuporteCooperadoDetalhe) {
  let dados: Record<string, any> = {};
  try {
    if (detalhe.dados_json) {
      dados = typeof detalhe.dados_json === 'string' ? JSON.parse(detalhe.dados_json) : detalhe.dados_json;
    }
  } catch (err) {
    console.error('Erro ao interpretar dados_json para PDF:', err);
  }

  const ds = dados.dadosSensiveis || detalhe.dadosSensiveis || {};
  const db = dados.dadosBancarios || detalhe.dadosBancarios || {};
  const contatos = dados.contatosEmergencia || detalhe.contatosEmergencia || [];
  const emergencia = dados.emergencia || (Array.isArray(contatos) && contatos.length > 0 ? {
    nome_1: contatos[0]?.nome || contatos[0]?.nome_1,
    parentesco_1: contatos[0]?.parentesco || contatos[0]?.parentesco_1,
    telefone_1: contatos[0]?.telefone || contatos[0]?.telefone_1,
    nome_2: contatos[1]?.nome || contatos[1]?.nome_2,
    parentesco_2: contatos[1]?.parentesco || contatos[1]?.parentesco_2,
    telefone_2: contatos[1]?.telefone || contatos[1]?.telefone_2,
  } : (typeof contatos === 'object' && !Array.isArray(contatos) ? contatos : {}));
  const quest = dados.questionario || {};
  const estat = dados.estatutario || {};
  const aut = dados.autorizacoes || {};
  const palestra = dados.palestraAta || {};
  const docs = detalhe.documentos || [];

  const nomeCooperado = (detalhe.nome || '').trim().toUpperCase();
  const cpfStr = formatarCPF(detalhe.cpf);
  const rgStr = ds.rg || detalhe.rg || '—';
  const orgaoRg = ds.orgao_emissor ? `${ds.orgao_emissor}` : 'SSP';
  const ufRg = ds.uf_rg || ds.uf || detalhe.uf || 'SP';
  const cidade = ds.cidade || detalhe.cidade || 'São Paulo';
  const uf = ds.uf || detalhe.uf || 'SP';
  const matriculaOuProposta = detalhe.matricula ? `${detalhe.matricula}` : `${detalhe.proposta_id || detalhe.id}`;

  const dataAdesaoRaw = detalhe.adesao_atualizado_em || detalhe.data_inicio || new Date().toISOString();
  const partesData = formatarPartesData(dataAdesaoRaw);
  const assinaturaB64 = dados.assinatura_digital_base64;

  const logoBase64 = await urlParaBase64('/atesa_logo.png');
  const termoMetLifeBase64 = await gerarImagemTermoMetLife(detalhe, dados);

  const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const token = localStorage.getItem('atesa_token') || '';

  const docsComImagens = await Promise.all(
    docs.map(async (doc) => {
      const downloadUrl = `${API_BASE}/beneficios/documentos/${doc.id}/download`;
      const base64 = await urlParaBase64(downloadUrl, token);
      return { ...doc, base64 };
    })
  );

  const docFoto3x4 = docsComImagens.find(d => d.tipo === 'foto_3x4' && d.base64);
  const docDeclaracaoManuscrita = docsComImagens.find(d => d.tipo === 'declaracao_adesao' && d.base64);

  const janela = window.open('', '_blank', 'width=1150,height=920,scrollbars=yes,resizable=yes');
  if (!janela) {
    alert('Permita a abertura de pop-ups no seu navegador para visualizar e salvar o PDF.');
    return;
  }

  // Header padrão idêntico aos documentos originais
  const renderHeaderOficial = (tituloBarra: string) => `
    <div class="header-oficial-atesa">
      <div class="header-logo-container">
        ${logoBase64 ? `<img src="${logoBase64}" alt="ATESA" class="header-logo-img" />` : ''}
      </div>
      <div class="header-texto-container">
        <div class="header-titulo-empresa">ATESA</div>
        <div class="header-subtitulo-empresa">COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA SAÚDE</div>
      </div>
    </div>
    <div class="barra-titulo-secao">
      ${tituloBarra}
    </div>
  `;

  // Bloco de assinatura padrão de rodapé de formulário
  const renderAssinaturaRodape = (mostraPalestrante: boolean = false, mostraDiretoria: boolean = false) => `
    <div class="bloco-rodape-assinatura">
      <div class="linha-data-local">
        <span class="cidade-data-preenchida"><strong>${cidade} - ${uf}</strong></span>, <span class="dia-preenchido"><strong>${partesData.dia}</strong></span> de <span class="mes-preenchido"><strong>${partesData.mes}</strong></span> de <span class="ano-preenchido"><strong>${partesData.ano}</strong></span>.
      </div>
      
      <div class="area-assinatura-centralizada">
        ${assinaturaB64 ? `
          <img src="${assinaturaB64}" alt="Assinatura" class="assinatura-img-preview" />
        ` : `
          <div class="carimbo-digital-cooperado">✓ ASSINADO DIGITALMENTE NO PORTAL ATESA · CPF ${cpfStr}</div>
        `}
        <div class="linha-traco-assinatura"></div>
        <div class="nome-completo-rotulo">${nomeCooperado}</div>
        <div class="cpf-rg-subrotulo">CPF: ${cpfStr} · RG: ${rgStr} (${orgaoRg}/${ufRg})</div>
      </div>

      ${mostraPalestrante ? `
        <div class="area-assinatura-palestrante">
          <div class="linha-traco-assinatura" style="margin-top: 24px;"></div>
          <div class="nome-completo-rotulo">NOME DO PALESTRANTE DE APOIO / SUPERVISÃO ATESA</div>
        </div>
      ` : ''}

      ${mostraDiretoria ? `
        <div class="area-assinatura-palestrante">
          <div class="linha-traco-assinatura" style="margin-top: 24px;"></div>
          <div class="nome-completo-rotulo">ASSINATURA DA DIRETORIA · COOPERATIVA DE TRABALHO ATESA</div>
        </div>
      ` : ''}
    </div>
  `;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Adesão Original - ${nomeCooperado} - ATESA</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 10px;
      color: #000000;
      line-height: 1.35;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .page-a4 {
      position: relative;
      width: 100%;
      min-height: 278mm;
      max-height: 278mm;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      padding: 4px 2px;
    }
    .page-a4:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    /* Cabeçalho Oficial ATESA */
    .header-oficial-atesa {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      margin-bottom: 6px;
      min-height: 44px;
    }
    .header-logo-container {
      position: absolute;
      left: 0;
      top: 0;
    }
    .header-logo-img {
      max-height: 42px;
      width: auto;
      object-fit: contain;
    }
    .header-texto-container {
      text-align: center;
    }
    .header-titulo-empresa {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #000;
      line-height: 1.1;
    }
    .header-subtitulo-empresa {
      font-size: 10.5px;
      font-weight: 800;
      color: #000;
      letter-spacing: -0.2px;
      margin-top: 1px;
    }

    /* Barra de Título em Caixa Preta */
    .barra-titulo-secao {
      border: 1.5px solid #000;
      padding: 4px 6px;
      text-align: center;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 8px;
      background: #fff;
    }

    /* Checkbox & Radios Oficiais */
    .box-chk {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 11px;
      height: 11px;
      border: 1.2px solid #000;
      font-size: 8.5px;
      font-weight: 900;
      line-height: 1;
      margin-right: 3px;
      vertical-align: middle;
      background: #fff;
      color: #000;
    }
    .box-chk.checked {
      background: #000;
      color: #fff;
    }
    .box-rad {
      display: inline-block;
      font-size: 11px;
      line-height: 1;
      margin-right: 2px;
      vertical-align: middle;
      color: #000;
    }

    /* Grid Oficial da Proposta de Adesão (Pág. 2) */
    .tabela-proposta-adesao {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
    }
    .tabela-proposta-adesao td {
      border: 1px solid #000;
      padding: 2.5px 4px;
      vertical-align: top;
      font-size: 8.5px;
    }
    .rotulo-campo {
      font-size: 7.5px;
      font-weight: 900;
      text-transform: uppercase;
      color: #000;
      display: block;
      line-height: 1.1;
      margin-bottom: 1px;
    }
    .valor-campo {
      font-size: 9.5px;
      font-weight: 700;
      color: #000;
      line-height: 1.2;
    }

    /* Pauta da Declaração (Página 1) */
    .linhas-pautadas-declaracao {
      width: 100%;
      margin: 8px 0;
      display: flex;
      flex-direction: column;
      gap: 10.5mm;
      padding: 4px 0;
    }
    .linha-pauta-individual {
      border-bottom: 1px solid #000;
      width: 100%;
      height: 0;
    }

    /* Textos Jurídicos Justificados */
    .texto-declaratorio-paragrafos {
      font-size: 10px;
      line-height: 1.55;
      text-align: justify;
      color: #000;
      margin: 8px 0;
    }
    .texto-declaratorio-paragrafos p {
      margin: 0 0 10px;
      text-indent: 20px;
    }
    .texto-declaratorio-paragrafos p:last-child {
      margin-bottom: 0;
    }

    /* Bloco de Assinaturas e Datas */
    .bloco-rodape-assinatura {
      margin-top: 10px;
      text-align: center;
    }
    .linha-data-local {
      font-size: 10px;
      margin-bottom: 12px;
      text-align: center;
    }
    .area-assinatura-centralizada {
      display: inline-block;
      width: 360px;
      max-width: 90%;
      text-align: center;
    }
    .assinatura-img-preview {
      max-height: 48px;
      max-width: 220px;
      object-fit: contain;
      display: block;
      margin: 0 auto 2px;
    }
    .carimbo-digital-cooperado {
      font-size: 9px;
      font-weight: 800;
      color: #1b5e20;
      margin-bottom: 3px;
    }
    .linha-traco-assinatura {
      border-top: 1.2px solid #000;
      width: 100%;
      margin: 2px auto 3px;
    }
    .nome-completo-rotulo {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .cpf-rg-subrotulo {
      font-size: 8px;
      color: #333;
    }

    /* Pág 14: Ilustração Geolocalização */
    .box-ilustracao-geoloc {
      border: 1.5px solid #000;
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px 20px;
      max-width: 440px;
      margin: 12px auto;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .modal-safari-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      position: relative;
    }
    .btn-safari-permitir {
      background: #0284c7;
      color: #fff;
      font-weight: 800;
      padding: 6px 16px;
      border-radius: 6px;
      display: inline-block;
      border: 2px solid #ef4444;
      position: relative;
    }
    .seta-vermelha-indicativa {
      color: #ef4444;
      font-size: 22px;
      font-weight: 900;
      margin-left: 6px;
      vertical-align: middle;
    }
  </style>
</head>
<body>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 1: DECLARAÇÃO DE LIVRE ADESÃO (FOLHA PAUTADA ORIGINAL)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('DECLARAÇÃO DE LIVRE ADESÃO')}

      ${docDeclaracaoManuscrita ? `
        <div style="border: 1px solid #000; padding: 6px; text-align: center; margin: 6px 0; background: #fff;">
          <img src="${docDeclaracaoManuscrita.base64}" alt="Declaração Manuscrita do Cooperado" style="max-width: 100%; max-height: 190mm; height: auto; object-fit: contain; display: block; margin: 0 auto;" />
        </div>
      ` : `
        <div style="font-size: 9.5px; line-height: 1.6; padding: 4px 6px; text-align: justify;">
          Eu, <strong>${nomeCooperado}</strong>, portador(a) do RG nº <strong>${rgStr}</strong> (${orgaoRg}/${ufRg}) e CPF nº <strong>${cpfStr}</strong>, declaro por minha livre e espontânea vontade solicitar minha adesão e admissão à <strong>ATESA - COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA SAÚDE</strong>, nos termos da Lei Federal nº 5.764/71 e Lei Federal nº 12.690/12, ciente de todos os direitos e deveres estatutários.
        </div>
        <div class="linhas-pautadas-declaracao">
          ${Array.from({ length: 18 }).map(() => `<div class="linha-pauta-individual"></div>`).join('')}
        </div>
      `}
    </div>

    <div>
      <div class="bloco-rodape-assinatura">
        <div class="linha-data-local">
          ______________________________________, <span class="dia-preenchida"><strong>${partesData.dia}</strong></span> de <span class="mes-preenchida"><strong>${partesData.mes}</strong></span> de <span class="ano-preenchida"><strong>${partesData.ano}</strong></span>.
        </div>
        <div class="area-assinatura-centralizada">
          ${assinaturaB64 ? `
            <img src="${assinaturaB64}" alt="Assinatura" class="assinatura-img-preview" />
          ` : `
            <div class="carimbo-digital-cooperado">✓ ASSINADO DIGITALMENTE NO PORTAL ATESA · CPF ${cpfStr}</div>
          `}
          <div class="linha-traco-assinatura"></div>
          <div class="nome-completo-rotulo">${nomeCooperado}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 2: PROPOSTA DE ADESÃO (GRADE COMPLETA ORIGINAL)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('PROPOSTA DE ADESÃO')}

      <table class="tabela-proposta-adesao">
        <tbody>
          <!-- Linha 1: Nome Completo -->
          <tr>
            <td colspan="6">
              <span class="rotulo-campo">NOME COMPLETO</span>
              <div class="valor-campo">${nomeCooperado}</div>
            </td>
          </tr>

          <!-- Linha 2: Nome Social -->
          <tr>
            <td colspan="6">
              <span class="rotulo-campo">NOME SOCIAL</span>
              <div class="valor-campo">${(ds.nome_social || '').toUpperCase() || '—'}</div>
            </td>
          </tr>

          <!-- Linha 3: Nascimento, Gênero, Estado Civil -->
          <tr>
            <td colspan="2" style="width: 25%;">
              <span class="rotulo-campo">DATA DE NASCIMENTO</span>
              <div class="valor-campo">${formatarDataBR(detalhe.data_nascimento || ds.data_nascimento)}</div>
            </td>
            <td colspan="2" style="width: 35%;">
              <span class="rotulo-campo">GÊNERO</span>
              <div class="valor-campo">
                ${chk(ds.genero === 'Feminino')} Feminino
                ${chk(ds.genero === 'Masculino')} Masculino
                ${chk(ds.genero === 'Neutro' || ds.genero === 'Outro')} Neutro
              </div>
            </td>
            <td colspan="2" style="width: 40%;">
              <span class="rotulo-campo">ESTADO CIVIL</span>
              <div class="valor-campo">
                ${chk(ds.estado_civil === 'solteiro')} Solteiro
                ${chk(ds.estado_civil === 'casado')} Casado
                ${chk(ds.estado_civil === 'uniao_estavel')} União Estável
                ${chk(ds.estado_civil === 'divorciado')} Divorciado
                ${chk(ds.estado_civil === 'separado')} Separado
                ${chk(ds.estado_civil === 'viuvo')} Viúvo
              </div>
            </td>
          </tr>

          <!-- Linha 4: Naturalidade, UF, Nacionalidade, CPF, NIT -->
          <tr>
            <td colspan="2">
              <span class="rotulo-campo">CIDADE DE NASCIMENTO</span>
              <div class="valor-campo">${(ds.naturalidade || cidade).toUpperCase()}</div>
            </td>
            <td style="width: 8%;">
              <span class="rotulo-campo">UF</span>
              <div class="valor-campo">${uf}</div>
            </td>
            <td style="width: 20%;">
              <span class="rotulo-campo">NACIONALIDADE</span>
              <div class="valor-campo">${(ds.nacionalidade || 'Brasileiro(a)').toUpperCase()}</div>
            </td>
            <td style="width: 27%;">
              <span class="rotulo-campo">CPF</span>
              <div class="valor-campo">${cpfStr}</div>
            </td>
            <td style="width: 20%;">
              <span class="rotulo-campo">NIT / PIS</span>
              <div class="valor-campo">${ds.pis_pasep || ds.nit || '—'}</div>
            </td>
          </tr>

          <!-- Linha 5: RG, Expedição, Órgão, Título -->
          <tr>
            <td colspan="2">
              <span class="rotulo-campo">RG</span>
              <div class="valor-campo">${rgStr}</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">DATA DE EXPEDIÇÃO</span>
              <div class="valor-campo">${formatarDataBR(ds.data_expedicao_rg)}</div>
            </td>
            <td>
              <span class="rotulo-campo">ESTADO EMISSOR</span>
              <div class="valor-campo">${orgaoRg} / ${ufRg}</div>
            </td>
            <td>
              <span class="rotulo-campo">TÍTULO DE ELEITOR</span>
              <div class="valor-campo">${ds.titulo_eleitor || '—'}</div>
            </td>
          </tr>

          <!-- Linha 6: CNH, Categoria -->
          <tr>
            <td colspan="2">
              <span class="rotulo-campo">CNH</span>
              <div class="valor-campo">${ds.cnh || '—'}</div>
            </td>
            <td>
              <span class="rotulo-campo">UF</span>
              <div class="valor-campo">${ds.cnh ? uf : '—'}</div>
            </td>
            <td>
              <span class="rotulo-campo">VALIDADE</span>
              <div class="valor-campo">${ds.cnh ? formatarDataBR(ds.validade_cnh) : '—'}</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">CATEGORIA</span>
              <div class="valor-campo">
                ${['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'].map(cat => `${chk((ds.categoria_cnh || '').toUpperCase() === cat)} ${cat}`).join(' ')}
              </div>
            </td>
          </tr>

          <!-- Linha 7: Cor/Etnia & Previdência -->
          <tr>
            <td colspan="3">
              <span class="rotulo-campo">COR/ETNIA</span>
              <div class="valor-campo">
                ${chk(ds.cor_etnia === 'Branca')} Branca
                ${chk(ds.cor_etnia === 'Negra')} Negra
                ${chk(ds.cor_etnia === 'Parda')} Parda
                ${chk(ds.cor_etnia === 'Oriental')} Oriental
                ${chk(ds.cor_etnia === 'Indigena')} Indígena
              </div>
            </td>
            <td colspan="3">
              <span class="rotulo-campo">RECEBE BENEFÍCIO DA PREVIDÊNCIA?</span>
              <div class="valor-campo">
                ${chk(Boolean(ds.recebe_beneficio_previdencia))} Sim
                ${chk(!ds.recebe_beneficio_previdencia)} Não
              </div>
            </td>
          </tr>

          <!-- Linha 8: Órgãos de Classe -->
          <tr>
            <td colspan="6">
              <span class="rotulo-campo">POSSUI CERTIFICAÇÃO NESTES ÓRGÃOS?</span>
              <div class="valor-campo">
                ${chk((ds.orgaos_classe || '').toUpperCase().includes('COREN'))} COREN
                ${chk((ds.orgaos_classe || '').toUpperCase().includes('CRF'))} CRF
                ${chk((ds.orgaos_classe || '').toUpperCase().includes('CREFITO'))} CREFITO
                ${chk((ds.orgaos_classe || '').toUpperCase().includes('CRP'))} CRP
                ${chk((ds.orgaos_classe || '').toUpperCase().includes('CRFA'))} CRFA
                ${chk((ds.orgaos_classe || '').toUpperCase().includes('CRN'))} CRN
                &nbsp;&nbsp;&nbsp;Classe: <strong>${ds.orgaos_classe ? `${ds.orgaos_classe} nº ${ds.numero_classe || ''}` : '______________________'}</strong>
              </div>
            </td>
          </tr>

          <!-- Linha 9: Escalas Preferenciais -->
          <tr>
            <td colspan="6">
              <span class="rotulo-campo">ASSINALE QUANTAS ALTERNATIVAS FOREM NECESSÁRIAS</span>
              <div class="valor-campo">
                ${chk(true)} Plantão 12X36
                ${chk(false)} Plantão 24X24
                ${chk(false)} Plantão 6X1
                ${chk(true)} Diurno
                ${chk(false)} Noturno
                ${chk(true)} Plantão Par
                ${chk(false)} Plantão Ímpar
              </div>
            </td>
          </tr>

          <!-- Linha 10: Endereço -->
          <tr>
            <td colspan="4">
              <span class="rotulo-campo">ENDEREÇO</span>
              <div class="valor-campo">${ds.logradouro || detalhe.logradouro || '—'}</div>
            </td>
            <td>
              <span class="rotulo-campo">Nº</span>
              <div class="valor-campo">${ds.numero || detalhe.numero || 'S/N'}</div>
            </td>
            <td>
              <span class="rotulo-campo">COMPLEMENTO</span>
              <div class="valor-campo">${ds.complemento || '—'}</div>
            </td>
          </tr>

          <!-- Linha 11: Bairro, Cidade, Estado -->
          <tr>
            <td colspan="2">
              <span class="rotulo-campo">BAIRRO</span>
              <div class="valor-campo">${ds.bairro || detalhe.bairro || '—'}</div>
            </td>
            <td colspan="3">
              <span class="rotulo-campo">CIDADE</span>
              <div class="valor-campo">${cidade}</div>
            </td>
            <td>
              <span class="rotulo-campo">ESTADO</span>
              <div class="valor-campo">${uf}</div>
            </td>
          </tr>

          <!-- Linha 12: CEP & Zona -->
          <tr>
            <td colspan="2">
              <span class="rotulo-campo">CEP</span>
              <div class="valor-campo">${ds.cep || detalhe.cep || '—'}</div>
            </td>
            <td colspan="4">
              <span class="rotulo-campo">ZONA</span>
              <div class="valor-campo">
                ${chk(ds.zona === 'Norte')} Norte
                ${chk(ds.zona === 'Sul')} Sul
                ${chk(ds.zona === 'Centro' || !ds.zona)} Centro
                ${chk(ds.zona === 'Leste')} Leste
                ${chk(ds.zona === 'Oeste')} Oeste
              </div>
            </td>
          </tr>

          <!-- Linha 13: Telefones -->
          <tr>
            <td colspan="2">
              <span class="rotulo-campo">TELEFONE RESIDENCIAL</span>
              <div class="valor-campo">( &nbsp; ) —</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">TELEFONE CELULAR</span>
              <div class="valor-campo">${detalhe.celular || detalhe.telefone || '—'}</div>
            </td>
            <td>
              <span class="rotulo-campo">WHATSAPP</span>
              <div class="valor-campo">${detalhe.celular || detalhe.telefone || '—'}</div>
            </td>
            <td>
              <span class="rotulo-campo">TELEFONE RECADO</span>
              <div class="valor-campo">( &nbsp; ) —</div>
            </td>
          </tr>

          <!-- Linha 14: E-mail & Informações de Projetos -->
          <tr>
            <td colspan="4">
              <span class="rotulo-campo">EMAIL</span>
              <div class="valor-campo">${detalhe.email || '—'}</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">ACEITA RECEBER INFORMAÇÕES SOBRE NOVOS PROJETOS DA COOPERATIVA?</span>
              <div class="valor-campo">${chk(true)} Sim ${chk(false)} Não</div>
            </td>
          </tr>

          <!-- Linha 15: Deficiência -->
          <tr>
            <td colspan="2">
              <span class="rotulo-campo">DEFICIÊNCIA FÍSICA?</span>
              <div class="valor-campo">${chk(false)} Sim ${chk(true)} Não</div>
            </td>
            <td colspan="4">
              <span class="rotulo-campo">QUAL?</span>
              <div class="valor-campo">
                ${chk(false)} Física ${chk(false)} Visual ${chk(false)} Auditiva ${chk(false)} Mental ${chk(false)} Intelectual ${chk(false)} Reabilitado
              </div>
            </td>
          </tr>

          <!-- Linha 16 a 18: Filiação -->
          <tr>
            <td colspan="4">
              <span class="rotulo-campo">NOME DO PAI</span>
              <div class="valor-campo">${ds.nome_pai || '—'}</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">NACIONALIDADE</span>
              <div class="valor-campo">BRASILEIRA</div>
            </td>
          </tr>
          <tr>
            <td colspan="4">
              <span class="rotulo-campo">NOME DA MÃE</span>
              <div class="valor-campo">${ds.nome_mae || '—'}</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">NACIONALIDADE</span>
              <div class="valor-campo">BRASILEIRA</div>
            </td>
          </tr>
          <tr>
            <td colspan="4">
              <span class="rotulo-campo">NOME DO CÔNJUGE</span>
              <div class="valor-campo">${ds.nome_conjuge || '—'}</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">NACIONALIDADE</span>
              <div class="valor-campo">${ds.nome_conjuge ? 'BRASILEIRA' : '—'}</div>
            </td>
          </tr>

          <!-- Linha 19: Filhos / Dependentes -->
          <tr>
            <td colspan="2">
              <span class="rotulo-campo">TEM FILHOS?</span>
              <div class="valor-campo">${chk(false)} Sim ${chk(true)} Não</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">TEM DEPENDENTES?</span>
              <div class="valor-campo">${chk(false)} Sim ${chk(true)} Não</div>
            </td>
            <td colspan="2">
              <span class="rotulo-campo">DECLARA O DEPENDENTE NO IRRF?</span>
              <div class="valor-campo">${chk(false)} Sim ${chk(true)} Não</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Grau de Instrução -->
      <div style="border: 1.5px solid #000; border-top: none; padding: 4px 6px;">
        <div style="font-size: 8.5px; font-weight: 900; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
          GRAU DE INSTRUÇÃO
        </div>
        <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 3px; font-size: 8px;">
          <div>
            ${chk(ds.grau_instrucao === 'Analfabeto')} Analfabeto<br/>
            ${chk(ds.grau_instrucao === 'Ensino Fundamental Incompleto')} Até o 5º ano do Ensino Fundamental Incompleto<br/>
            ${chk(ds.grau_instrucao === 'Ensino Fundamental Completo')} 5º ano do Ensino Fundamental Completo<br/>
            ${chk(false)} Do 6º ao 9º ano do Ensino Fundamental Incompleto
          </div>
          <div>
            ${chk(false)} Ensino Fundamental Completo<br/>
            ${chk(ds.grau_instrucao === 'Ensino Médio Incompleto')} Ensino Médio Incompleto<br/>
            ${chk(ds.grau_instrucao === 'Ensino Médio Completo')} Ensino Médio Completo<br/>
            ${chk(ds.grau_instrucao === 'Educação Superior Incompleta')} Educação Superior Incompleta
          </div>
          <div>
            ${chk(ds.grau_instrucao === 'Educação Superior Completa' || !ds.grau_instrucao)} Educação Superior Completa<br/>
            ${chk(ds.grau_instrucao === 'Pós Graduação Completa')} Pós Graduação Completa<br/>
            ${chk(ds.grau_instrucao === 'Mestrado Completo')} Mestrado Completo<br/>
            ${chk(ds.grau_instrucao === 'Doutorado Completo')} Doutorado Completo
          </div>
        </div>
      </div>
    </div>

    <div style="font-size: 7.5px; text-align: right; color: #475569; padding-top: 2px;">
      Proposta de Adesão Oficial · ATESA Cooperativa de Trabalho
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 3: EXPERIÊNCIA, ESTRANGEIRO, EMERGÊNCIA, BANCO & PARECER
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('PROPOSTA DE ADESÃO (CONTINUAÇÃO)')}

      <!-- Experiência Profissional -->
      <table class="tabela-proposta-adesao" style="margin-bottom: 6px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th colspan="4" style="border: 1px solid #000; padding: 2px; font-size: 8.5px;">EXPERIÊNCIA PROFISSIONAL</th>
          </tr>
          <tr style="font-size: 8px;">
            <th style="border: 1px solid #000; width: 45%;">NOME DA EMPRESA</th>
            <th style="border: 1px solid #000; width: 30%;">FUNÇÃO</th>
            <th style="border: 1px solid #000; width: 12.5%;">INÍCIO</th>
            <th style="border: 1px solid #000; width: 12.5%;">TÉRMINO</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="height: 16px;"></td><td></td><td></td><td></td></tr>
          <tr><td style="height: 16px;"></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>

      <!-- Pessoa a ser Avisada em Caso de Emergência -->
      <table class="tabela-proposta-adesao" style="margin-bottom: 6px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th colspan="3" style="border: 1px solid #000; padding: 2px; font-size: 8.5px;">PESSOA A SER AVISADA EM CASO DE EMERGÊNCIA</th>
          </tr>
          <tr style="font-size: 8px;">
            <th style="border: 1px solid #000; width: 45%;">NOME</th>
            <th style="border: 1px solid #000; width: 30%;">GRAU DE PARENTESCO</th>
            <th style="border: 1px solid #000; width: 25%;">TELEFONE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>${(emergencia.nome_1 || contatos[0]?.nome || '—').toUpperCase()}</strong></td>
            <td>${(emergencia.parentesco_1 || contatos[0]?.parentesco || '—').toUpperCase()}</td>
            <td><strong>${emergencia.telefone_1 || contatos[0]?.telefone || '—'}</strong></td>
          </tr>
          <tr>
            <td><strong>${(emergencia.nome_2 || contatos[1]?.nome || '—').toUpperCase()}</strong></td>
            <td>${(emergencia.parentesco_2 || contatos[1]?.parentesco || '—').toUpperCase()}</td>
            <td><strong>${emergencia.telefone_2 || contatos[1]?.telefone || '—'}</strong></td>
          </tr>
        </tbody>
      </table>

      <!-- Dados Bancários -->
      <table class="tabela-proposta-adesao" style="margin-bottom: 6px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th colspan="6" style="border: 1px solid #000; padding: 2px; font-size: 8.5px;">DADOS BANCÁRIOS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="width: 30%;"><span class="rotulo-campo">BANCO</span><div class="valor-campo">${db.banco || '—'}</div></td>
            <td style="width: 15%;"><span class="rotulo-campo">AGÊNCIA</span><div class="valor-campo">${db.agencia || '—'}</div></td>
            <td style="width: 8%;"><span class="rotulo-campo">D.V.</span><div class="valor-campo">0</div></td>
            <td style="width: 25%;"><span class="rotulo-campo">CONTA CORRENTE</span><div class="valor-campo">${db.conta || '—'}</div></td>
            <td style="width: 8%;"><span class="rotulo-campo">D.V.</span><div class="valor-campo">${db.digito || '0'}</div></td>
            <td style="width: 14%;"><div class="valor-campo">${chk(true)} Corrente ${chk(false)} Poupança</div></td>
          </tr>
          <tr>
            <td colspan="6">
              <span class="rotulo-campo">PIX</span>
              <div class="valor-campo">
                <strong>${db.chave_pix || cpfStr}</strong> &nbsp;&nbsp;&nbsp;
                ${chk(db.tipo_pix === 'celular')} Celular
                ${chk(db.tipo_pix === 'cpf' || !db.tipo_pix)} CPF
                ${chk(db.tipo_pix === 'email')} E-mail
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Parecer da Diretoria -->
      <div style="border: 1.5px solid #000; margin-top: 6px; padding: 8px;">
        <div style="font-size: 9px; font-weight: 900; text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 6px;">
          PARECER DA DIRETORIA
        </div>
        <div style="font-size: 9.5px; line-height: 1.5; text-align: justify; margin-bottom: 10px;">
          A Diretoria declara que a proposta de adesão supramencionada, está de acordo com as determinações Estatutárias desta cooperativa sendo aceita e acolhida nesta data.
        </div>
        ${renderAssinaturaRodape(false, true)}
      </div>
    </div>

    <div style="font-size: 7.5px; text-align: right; color: #475569; padding-top: 2px;">
      Página 03 · Homologação e Parecer da Diretoria
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 4: FICHA DE MATRÍCULA & CONTROLE DE COTA-PARTE
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('FICHA DE MATRÍCULA')}

      <table class="tabela-proposta-adesao">
        <tbody>
          <tr>
            <td colspan="4"><span class="rotulo-campo">NOME COMPLETO</span><div class="valor-campo">${nomeCooperado}</div></td>
            <td colspan="2"><span class="rotulo-campo">MATRÍCULA</span><div class="valor-campo">#${matriculaOuProposta}</div></td>
          </tr>
          <tr>
            <td colspan="2"><span class="rotulo-campo">DATA DE NASCIMENTO</span><div class="valor-campo">${formatarDataBR(detalhe.data_nascimento || ds.data_nascimento)}</div></td>
            <td colspan="3">
              <span class="rotulo-campo">ESTADO CIVIL</span>
              <div class="valor-campo">
                ${chk(ds.estado_civil === 'solteiro')} Solteiro
                ${chk(ds.estado_civil === 'casado')} Casado
                ${chk(ds.estado_civil === 'uniao_estavel')} União Estável
                ${chk(ds.estado_civil === 'divorciado')} Divorciado
                ${chk(ds.estado_civil === 'separado')} Separado
                ${chk(ds.estado_civil === 'viuvo')} Viúvo
              </div>
            </td>
            <td rowspan="4" style="width: 80px; text-align: center; vertical-align: middle; border-left: 1.5px solid #000;">
              ${docFoto3x4 ? `
                <img src="${docFoto3x4.base64}" alt="Foto 3x4" style="max-width: 75px; max-height: 95px; object-fit: cover; display: block; margin: 0 auto;" />
              ` : `
                <div style="font-size: 8px; font-weight: 800; color: #64748b; padding: 20px 4px;">FOTO 3X4</div>
              `}
            </td>
          </tr>
          <tr>
            <td colspan="2"><span class="rotulo-campo">NATURAL DE</span><div class="valor-campo">${(ds.naturalidade || cidade).toUpperCase()}</div></td>
            <td colspan="2"><span class="rotulo-campo">NACIONALIDADE</span><div class="valor-campo">BRASILEIRA</div></td>
            <td><span class="rotulo-campo">CPF</span><div class="valor-campo">${cpfStr}</div></td>
          </tr>
          <tr>
            <td colspan="2"><span class="rotulo-campo">NÚMERO RG</span><div class="valor-campo">${rgStr}</div></td>
            <td><span class="rotulo-campo">UF</span><div class="valor-campo">${ufRg}</div></td>
            <td colspan="2"><span class="rotulo-campo">DATA EXPEDIÇÃO</span><div class="valor-campo">${formatarDataBR(ds.data_expedicao_rg)}</div></td>
          </tr>
          <tr>
            <td colspan="3"><span class="rotulo-campo">ENDEREÇO</span><div class="valor-campo">${ds.logradouro || detalhe.logradouro || '—'}</div></td>
            <td colspan="2"><span class="rotulo-campo">Nº:</span><div class="valor-campo">${ds.numero || detalhe.numero || 'S/N'}</div></td>
          </tr>
          <tr>
            <td><span class="rotulo-campo">COMPLEMENTO</span><div class="valor-campo">${ds.complemento || '—'}</div></td>
            <td colspan="2"><span class="rotulo-campo">BAIRRO</span><div class="valor-campo">${ds.bairro || detalhe.bairro || '—'}</div></td>
            <td colspan="3"><span class="rotulo-campo">CIDADE / ESTADO / CEP</span><div class="valor-campo">${cidade} / ${uf} - CEP: ${ds.cep || detalhe.cep || '—'}</div></td>
          </tr>
          <tr>
            <td colspan="3"><span class="rotulo-campo">TELEFONE CELULAR</span><div class="valor-campo">${detalhe.celular || detalhe.telefone || '—'}</div></td>
            <td colspan="3"><span class="rotulo-campo">E-MAIL</span><div class="valor-campo">${detalhe.email || '—'}</div></td>
          </tr>
          <tr>
            <td colspan="3"><span class="rotulo-campo">PROFISSÃO</span><div class="valor-campo">PROFISSIONAL DA SAÚDE</div></td>
            <td colspan="3"><span class="rotulo-campo">DATA DA ADMISSÃO</span><div class="valor-campo">${formatarDataBR(detalhe.data_inicio || dataAdesaoRaw)}</div></td>
          </tr>
        </tbody>
      </table>

      <!-- Controle de Cota Parte -->
      <div style="border: 1.5px solid #000; margin-top: 6px; padding: 4px;">
        <div style="font-size: 8.5px; font-weight: 900; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2px;">
          USO DA COOPERATIVA — CONTROLE DA INTEGRALIZAÇÃO DA COTA PARTE
        </div>
        <div style="font-size: 8px; font-weight: 800; text-align: center; padding: 3px 0; border-bottom: 1px solid #000;">
          VALOR DA QUOTA PARTE: 50 QUOTAS PARTES NO VALOR DE R$1,00, SENDO O TOTAL DE R$50,00
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8px; margin-top: 2px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th colspan="3" style="border: 1px solid #000;">DATA</th>
              <th rowspan="2" style="border: 1px solid #000;">OPERAÇÕES (HISTÓRICO)</th>
              <th colspan="3" style="border: 1px solid #000;">CAPITAL</th>
            </tr>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #000; width: 6%;">DIA</th>
              <th style="border: 1px solid #000; width: 6%;">MÊS</th>
              <th style="border: 1px solid #000; width: 6%;">ANO</th>
              <th style="border: 1px solid #000; width: 14%;">SUBSCRITO</th>
              <th style="border: 1px solid #000; width: 14%;">INTEGRALIZAÇÃO</th>
              <th style="border: 1px solid #000; width: 14%;">A INTEGRALIZAR</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000; text-align: center;">${partesData.dia}</td>
              <td style="border: 1px solid #000; text-align: center;">${partesData.mes.slice(0, 3)}</td>
              <td style="border: 1px solid #000; text-align: center;">${partesData.ano}</td>
              <td style="border: 1px solid #000; padding-left: 4px;">SUBSCRIÇÃO DE 50 QUOTAS-PARTES NO VALOR DE R$ 1,00 CADA</td>
              <td style="border: 1px solid #000; text-align: center;">R$ 50,00</td>
              <td style="border: 1px solid #000; text-align: center;">—</td>
              <td style="border: 1px solid #000; text-align: center;">R$ 50,00</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; text-align: center;">${partesData.dia}</td>
              <td style="border: 1px solid #000; text-align: center;">${partesData.mes.slice(0, 3)}</td>
              <td style="border: 1px solid #000; text-align: center;">${partesData.ano}</td>
              <td style="border: 1px solid #000; padding-left: 4px;">INTEGRALIZAÇÃO DE 50 QUOTAS-PARTES NO VALOR DE R$ 1,00 CADA</td>
              <td style="border: 1px solid #000; text-align: center;">R$ 50,00</td>
              <td style="border: 1px solid #000; text-align: center;">R$ 50,00</td>
              <td style="border: 1px solid #000; text-align: center;">R$ 0,00</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Termo de Demissão, Exclusão ou Eliminação -->
      <div style="border: 1.5px solid #000; margin-top: 6px; padding: 4px; font-size: 8px;">
        <div style="font-weight: 900; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
          TERMO DE DEMISSÃO, EXCLUSÃO OU ELIMINAÇÃO
        </div>
        <div style="text-align: center; margin-bottom: 4px;">
          ( ) Demissão &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ( ) Exclusão &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ( ) Eliminação
        </div>
        <div>MOTIVO: ______________________________________________________________________________________________________</div>
        <div>OBSERVAÇÕES: _________________________________________________________________________________________________</div>
        <div>DATA DA SAÍDA: _____ / _____ / _________</div>
      </div>
    </div>

    <div>
      ${renderAssinaturaRodape(false, true)}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 5: ATA DE PALESTRA COOPERATIVISTA
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('ATA DE PALESTRA COOPERATIVISTA')}

      <div class="texto-declaratorio-paragrafos">
        <p>
          Eu <strong>${nomeCooperado}</strong>, declaro ter assistido a palestra da Atesa Cooperativa de Trabalho dos Profissionais da Saúde, sobre esclarecimento do Sistema Cooperativista, no formato ${chk(palestra.formato === 'presencial')} <strong>presencial</strong> ou ${chk(palestra.formato === 'online' || !palestra.formato)} <strong>online</strong>.
        </p>
        <p>
          O palestrante explicou sobre o modelo de cooperativa de trabalho de acordo com as Leis Federais 5764/1971 e 12690/2012, sobre os Fundos de Reserva, do Estatuto Social, da Integralização da Quota Parte, da participação nas Assembleias Gerais, da destinação das sobras líquidas e das perdas, se houver, e dos benefícios que a Cooperativa oferece a custos acessíveis.
        </p>
        <p>
          O interessado declara que entendeu as explicações sobre o Sistema de Cooperativa de Trabalho, e manifesta de livre e expontânea vontade, sem interferência de qualquer pessoa, fazer parte da cooperativa, estando ciente que o trabalhador cooperado não é caracterizado como empregado, conforme o parágrafo único, do artigo 442 da CLT <em>"Qualquer que seja o ramo de atividade da sociedade cooperativa, não existe vínculo empregatício entre ela e seus associados, nem entre estes e os tomadores de serviços daquela"</em>, bem como o artigo 90 da lei 5764/1971.
        </p>
        <p>
          Neste ato, aceito plenamente participar das atividades propostas pela cooperativa, concordando com a forma de distribuição dos serviços oferecidos por esta junto aos seus tomadores de serviços e/ou pessoas físicas.
        </p>
      </div>
    </div>

    <div>
      ${renderAssinaturaRodape(true, false)}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 6: DECLARAÇÃO QUE RECEBEU INFORMAÇÕES ESTATUTÁRIAS (10 ITENS)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('DECLARAÇÃO QUE RECEBEU INFORMAÇÕES ESTATUTÁRIAS')}

      <div style="font-size: 9.5px; margin-bottom: 8px;">
        Eu, <strong>${nomeCooperado}</strong>, matriculado(a) sob o nº <strong>#${matriculaOuProposta}</strong>, venho por meio desta prestar as seguintes declarações :
      </div>

      <div style="display: flex; flex-direction: column; gap: 7px; font-size: 9px;">
        <div>
          1. Que recebi as informações legais e estatutárias sobre o Sistema Cooperativista:<br/>
          ${chk(estat.item1 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item1 === 'nao')} NÃO
        </div>
        <div>
          2. Que tenho ciência que a Assembléia Geral Ordinária ocorrerá uma vez ao ano, ou seja, no mês de março:<br/>
          ${chk(estat.item2 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item2 === 'nao')} NÃO
        </div>
        <div>
          3. Que tenho ciência que as Assembléias Gerais têm competência para decidir sobre todos os interesses da cooperativa, respeitados os limites da lei e do Estatuto Social:<br/>
          ${chk(estat.item3 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item3 === 'nao')} NÃO
        </div>
        <div>
          4. Que tenho ciência da obrigatoriedade de participação nas Assembléias Gerais:<br/>
          ${chk(estat.item4 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item4 === 'nao')} NÃO
        </div>
        <div>
          5. Que tenho ciência do desconto de 3% (três por cento) em minha remuneração, referente a rateio de custos da cooperativa:<br/>
          ${chk(estat.item5 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item5 === 'nao')} NÃO
        </div>
        <div>
          6. Que efetuarei a integralização da quota parte, no valor de R$ 50,00 (cinquenta reais), em 05 parcelas:<br/>
          ${chk(estat.item6 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item6 === 'nao')} NÃO
        </div>
        <div>
          7. Que tenho ciência que o Seguro de Vida em grupo é obrigatório, conforme aprovação da Assembléia Geral Ordinária:<br/>
          ${chk(estat.item7 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item7 === 'nao')} NÃO
        </div>
        <div>
          8. Que a devolução de quotas partes só poderão ser solicitadas caso o associado venha a se desligar da Cooperativa:<br/>
          ${chk(estat.item8 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item8 === 'nao')} NÃO
        </div>
        <div>
          9. Que a restituição das quotas partes se dará após solicitação, por escrito, e aprovação pela Assembléia Geral Ordinária do Balanço e Contas do Exercício em que o desligamento tenha ocorrido:<br/>
          ${chk(estat.item9 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item9 === 'nao')} NÃO
        </div>
        <div>
          10. Que o valor da remuneração pela execução dos serviços, será creditada em conta bancária indicada por escrito:<br/>
          ${chk(estat.item10 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp; ${chk(estat.item10 === 'nao')} NÃO
        </div>
      </div>

      <div style="font-size: 9.5px; margin-top: 8px;">
        Por serem verdadeiras as informações firmo a presente declaração.
      </div>
    </div>

    <div>
      ${renderAssinaturaRodape(false, false)}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 7: QUESTIONÁRIO DIRIGIDO AOS ASSOCIADOS (12 PERGUNTAS)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('QUESTIONÁRIO DIRIGIDO AOS ASSOCIADOS')}

      <div style="font-size: 9.5px; margin-bottom: 8px;">
        Eu, <strong>${nomeCooperado}</strong>, matriculado(a) sob o nº <strong>#${matriculaOuProposta}</strong>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px; font-size: 8.8px;">
        <div>
          1. Na Cooperativa, você é ?<br/>
          ${chk(quest.q1 === 'associado' || !quest.q1)} ASSOCIADO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q1 === 'empregado')} EMPREGADO
        </div>
        <div>
          2. O que significa Integralização de Capital?<br/>
          ${chk(quest.q2 === 'quota_parte' || !quest.q2)} VALOR DA QUOTA PARTE &nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q2 === 'outras_taxas')} OUTRAS TAXAS
        </div>
        <div>
          3. Você terá vínculo empregatício?<br/>
          ${chk(quest.q3 === 'sim')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q3 !== 'sim')} NÃO
        </div>
        <div>
          4. Você terá vínculo empregatício com as tomadoras de serviço, nas quais irá exercer as atividades, quando designado pela cooperativa?<br/>
          ${chk(quest.q4 === 'sim')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q4 !== 'sim')} NÃO
        </div>
        <div>
          5. Como associado, você terá direito a 13º, FGTS e Seguro Desemprego ?<br/>
          ${chk(quest.q5 === 'sim')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q5 !== 'sim')} NÃO
        </div>
        <div>
          6. Você terá seu INSS recolhido enquanto estiver em atividade?<br/>
          ${chk(quest.q6 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q6 === 'nao')} NÃO
        </div>
        <div>
          7. A sua Adesão foi de livre vontade e poderá desligar-se assim que desejar?<br/>
          ${chk(quest.q7 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q7 === 'nao')} NÃO
        </div>
        <div>
          8. Você tem o direito de votar e ser votado ?<br/>
          ${chk(quest.q8 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q8 === 'nao')} NÃO
        </div>
        <div>
          9. As decisões são sempre tomadas pela maioria dos associados ?<br/>
          ${chk(quest.q9 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q9 === 'nao')} NÃO
        </div>
        <div>
          10. Você terá direito a Descanso Anual Remunerado ?<br/>
          ${chk(quest.q10 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q10 === 'nao')} NÃO
        </div>
        <div>
          11. Na cooperativa todos são iguais e não há qualquer discriminação?<br/>
          ${chk(quest.q11 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q11 === 'nao')} NÃO
        </div>
        <div>
          12. Um dos princípios cooperativistas é a educação permanente aos seus associados?<br/>
          ${chk(quest.q12 !== 'nao')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${chk(quest.q12 === 'nao')} NÃO
        </div>
      </div>
    </div>

    <div>
      ${renderAssinaturaRodape(false, false)}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 8: AUTORIZAÇÃO DE DESCONTOS
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('AUTORIZAÇÃO DE DESCONTOS')}

      <div style="font-size: 9.5px; margin-bottom: 6px;">
        Eu, <strong>${nomeCooperado}</strong>, matriculado(a) sob o nº <strong>#${matriculaOuProposta}</strong>
      </div>

      <div style="font-size: 9.5px; margin-bottom: 6px;">
        Autorizo os descontos, obrigatórios em minha remuneração:
      </div>

      <div style="font-size: 9px; line-height: 1.6; margin-bottom: 8px;">
        ✓ R$ 4,15 Seguro de Vida em Grupo – (De 18 a 65 anos);<br/>
        ✓ Quota parte R$ 50,00, sendo 05 parcelas de R$10,00 (conforme Estatuto Social);<br/>
        ✓ 3% (três por cento) para cobertura de rateio de custos da Cooperativa (conforme aprovado em Assembleia);<br/>
        ✓ Recolhimento de INSS de 20% (vinte por cento) sobre a produtividade, (conforme Ato Declaratório Interpretativo nº 05/2015);
      </div>

      <div style="font-size: 10px; font-weight: 800; text-align: center; text-decoration: underline; margin-bottom: 6px;">
        BENEFÍCIOS EM FORMA DE PARCERIAS
      </div>

      <div style="font-size: 8.5px; margin-bottom: 6px;">
        <strong>Benefícios opcionais com desconto na produtividade, disponíveis após 60 dias da adesão:</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Convênio Médico - Amil (SP/RJ)'))} Convênio Médico - Amil &nbsp;&nbsp;&nbsp;&nbsp; <strong>(SP/RJ)</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Convênio Médico - Biovida (SP)'))} Convênio Médico - Biovida &nbsp;&nbsp;&nbsp;&nbsp; <strong>(SP)</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Convênio Odontológico – Odontoprev (SP/RJ/PE/CE/MA)'))} Convênio Odontológico – Odontoprev &nbsp;&nbsp;&nbsp;&nbsp; <strong>(SP/RJ/PE/CE/MA)</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Convênio Academia Total Pass (SP/RJ/PE/CE/MA)'))} Convênio com Academia Total Pass &nbsp;&nbsp;&nbsp;&nbsp; <strong>(SP/RJ/PE/CE/MA)</strong>
      </div>

      <div style="font-size: 8.5px; margin-bottom: 6px;">
        <strong>Benefícios opcionais com desconto direto na mensalidade:</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Faculdade Estácio (SP/RJ/PE/CE/MA)'))} Faculdade Estácio <strong>(SP/RJ/PE/CE/MA)</strong> &nbsp;&nbsp;&nbsp;&nbsp; ${chk((aut.convenios_opcionais || []).includes('Faculdade Sumaré (SP/RJ/PE/CE/MA)'))} Faculdade Sumaré <strong>(SP/RJ/PE/CE/MA)</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Faculdade Unip Polo Anália Franco (SP/RJ/PE/CE/MA)'))} Faculdade Unip Polo Anália Franco <strong>(SP/RJ/PE/CE/MA)</strong> &nbsp;&nbsp;&nbsp;&nbsp; ${chk((aut.convenios_opcionais || []).includes('Faculdade Uninove (SP/RJ/PE/CE/MA)'))} Faculdade Uninove <strong>(SP/RJ/PE/CE/MA)</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Faculdade Unissuam (SP/RJ/PE/CE/MA)'))} Faculdade Unissuam <strong>(SP/RJ/PE/CE/MA)</strong> &nbsp;&nbsp;&nbsp;&nbsp; ${chk((aut.convenios_opcionais || []).includes('Fisk (SP/RJ/PE/CE/MA)'))} Fisk <strong>(SP/RJ/PE/CE/MA)</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Instituto Carreira e Saúde (SP/RJ/PE/CE/MA)'))} Instituto Carreira e Saúde <strong>(SP/RJ/PE/CE/MA)</strong> &nbsp;&nbsp;&nbsp;&nbsp; ${chk((aut.convenios_opcionais || []).includes('Pós Graduação Mackenzie (SP/RJ/PE/CE/MA)'))} Pós Graduação Mackenzie <strong>(SP/RJ/PE/CE/MA)</strong>
      </div>

      <div style="font-size: 8.5px; margin-bottom: 6px;">
        <strong>Benefícios opcionais com desconto direto nos ingressos:</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Arajara Park (CE)'))} Arajara Park <strong>(CE)</strong> &nbsp;&nbsp;&nbsp;&nbsp;
        ${chk((aut.convenios_opcionais || []).includes('Castelo Park Aquático (SP)'))} Castelo Park Aquático <strong>(SP)</strong> &nbsp;&nbsp;&nbsp;&nbsp;
        ${chk((aut.convenios_opcionais || []).includes('Parque Magic City (SP)'))} Parque Magic City <strong>(SP)</strong>
      </div>

      <div style="font-size: 8.5px; margin-bottom: 8px;">
        <strong>Benefícios opcionais com desconto em produtos e medicamentos:</strong><br/>
        ${chk((aut.convenios_opcionais || []).includes('Extra Farma - Pague Menos (SP/RJ/PE/CE/MA)'))} Extra Farma - Pague Menos <strong>(SP/RJ/PE/CE/MA)</strong>
      </div>

      <div style="font-size: 9px; line-height: 1.45; text-align: justify;">
        Ademais, comprometo-me a comparecer à sede da Cooperativa para quitar débitos, se houver, em virtude de falta de produtividade, devolver equipamentos ou uniformes, que estejam em meu poder.
      </div>
    </div>

    <div>
      ${renderAssinaturaRodape(false, false)}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 9: TERMO DE ADESÃO DE COOPERADO A CONTRATO
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('TERMO DE ADESÃO DE COOPERADO A CONTRATO')}

      <div class="texto-declaratorio-paragrafos">
        <p>
          Eu, <strong>${nomeCooperado}</strong> matriculado sob o número <strong>#${matriculaOuProposta}</strong>, associado com base nas Leis Federais 5764/71 a 12690/12 e do Estatuto Social, considerando minha disponibilidade pessoal e segundo as condições propostas pela cooperativa, tais como, local e forma da prestação de serviços, declaro meu interesse em executar os serviços autônomos, conforme contrato firmado entre a Atesa e a empresa tomadora de seus serviços.
        </p>
        <p>
          Declaro ainda, estar ciente das minhas atividades na qualidade de profissional autônomo atuante no tomador de serviços parceiro da cooperativa, inclusive, tendo a autonomia de comunicar à Sociedade Cooperativa, qualquer infringência relacionada ao trabalho.
        </p>
      </div>
    </div>

    <div>
      ${renderAssinaturaRodape(false, false)}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 10: TERMO DE CONFIDENCIALIDADE
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('TERMO DE CONFIDENCIALIDADE')}

      <div class="texto-declaratorio-paragrafos">
        <p>
          Pelo presente termo eu, <strong>${nomeCooperado}</strong> matriculado sob o número <strong>#${matriculaOuProposta}</strong>, portador(a) da cédula de identidade nº <strong>${rgStr}</strong> (${orgaoRg}/${ufRg}), inscrito(a) no CPF/MF sob nº <strong>${cpfStr}</strong>, associado à <strong>ATESA COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA SAÚDE</strong>, me comprometo a não divulgar, sob qualquer hipótese, informações de que venha a tomar conhecimento em razão dos serviços atualmente prestados.
        </p>
        <p>
          Comprometo-me a não fornecer, divulgar ou tornar disponível, sem consentimento prévio e por escrito, qualquer documento ou informação exclusiva ou confidencial da cooperativa e ou tomador de serviços, sob qualquer forma e a qualquer pretexto, seja à pessoa física ou jurídica, salvo aos seus colaboradores e/ou prestadores de serviços diretamente ligados às atividades desempenhadas, ou em razão de determinação legal ou legislação pertinente, prevalecendo esta obrigação mesmo após a extinção da prestação de serviços, independentemente do motivo que a determinar.
        </p>
        <p>
          O descumprimento da obrigação assumida no presente termo importará no pagamento de uma multa equivalente ao valor da média das 03 (três) últimas remunerações por mim auferidas, independentemente das perdas e danos.
        </p>
        <p>
          Por fim, salienta-se que incorre nas penas do art. 154 do Código Penal, abaixo transcrito, aquele que infringir as obrigações decorrentes deste Termo.
        </p>
      </div>

      <div style="border: 1px solid #000; padding: 6px 10px; margin: 8px 0; font-size: 9px; line-height: 1.45;">
        <div style="font-weight: 900; margin-bottom: 2px;">VIOLAÇÃO DE SEGREDO PROFISSIONAL</div>
        <strong>ART. 154</strong> - Revelar alguém, sem justa causa, segredo, de que tem ciência em razão de função, ministério, ofício ou profissão, e cuja revelação possa produzir dano a outrem.<br/>
        <strong>Pena</strong> - detenção de três meses, a um ano ou multa.
      </div>
    </div>

    <div>
      ${renderAssinaturaRodape(false, false)}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 11: TERMO DE CONSENTIMENTO LGPD (PARTE 1)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('TERMO DE FORNECIMENTO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS')}

      <div class="texto-declaratorio-paragrafos" style="font-size: 9px; line-height: 1.45;">
        <p>
          Em conformidade com o previsto na Lei nº 13.709, de 2018, Lei Geral de Proteção de Dados Pessoais, LGPD, o(a) sócio cooperado(a) Sr./Sra. <strong>${nomeCooperado}</strong>, matrícula nº <strong>#${matriculaOuProposta}</strong>, portador(a) do documento de identificação RG nº <strong>${rgStr}</strong>, estado de emissão <strong>${ufRg}</strong>, inscrito(a) no CPF sob o nº <strong>${cpfStr}</strong>, doravante denominado(a) TITULAR, registra sua manifestação livre, informada, pelo qual <strong>CONCORDA COM O TRATAMENTO DE SEUS DADOS PESSOAIS</strong>, para finalidade determinada, por <strong>ATESA COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA SAÚDE</strong>, pessoa jurídica de direito privado constituída sob a forma de Cooperativa com sede no município de São Paulo, SP, na Rua Alfredo Pujol, nº 369, Santana, CEP 02017-010, devidamente inscrita no CNPJ/MF sob o n° 08.930.337/0001-00, neste ato representada pela Diretora Presidente em exercício IONARA SANTOS ARAÚJO, brasileira, casada, inscrita no CPF/MF sob o nº 013.246.985-51, doravante denominada CONTROLADORA, para que esta tome as decisões referentes ao tratamento de seus dados pessoais, bem como, para que realize o tratamento de tais dados, envolvendo operações como as que se referem a coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração.
        </p>
        
        <p>
          <strong>Cláusula 1ª. Identificação e informações de contato da CONTROLADORA:</strong><br/>
          1.1. A ATESA COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA SAÚDE, é a pessoa jurídica de direito privado a quem compete as decisões referentes ao tratamento dos dados pessoais do(a) TITULAR.<br/>
          1.2. A CONTROLADORA poderá ser contatada por meio do telefone nº (11) 3083-0050 ou 3083-0053, e pelo correio eletrônico (e-mail) ouvidoria@atesa.com.br.
        </p>

        <p>
          <strong>Cláusula 2ª. Dados pessoais do(a) TITULAR que serão tratados pela CONTROLADORA:</strong><br/>
          2.1. A CONTROLADORA fica autorizada a tomar decisões referentes ao tratamento dos seguintes dados pessoais do(a) TITULAR:<br/>
          • Nome completo, estado civil, data de nascimento;<br/>
          • Número e imagem do documento de identificação;<br/>
          • Número e imagem do Cadastro de Pessoas Físicas;<br/>
          • Número e imagem da Carteira Nacional de Habilitação (CNH);<br/>
          • Fotografia 3x4;<br/>
          • Tipo sanguíneo e fator Rh;<br/>
          • Nível de instrução ou de escolaridade;<br/>
          • Endereço completo;<br/>
          • Número de telefone, WhatsApp, e endereço de correio eletrônico (e-mail);<br/>
          • Nome dos filhos, inclusive as datas de nascimento e informações dos atestados de vacinação;<br/>
          • Filiação a sindicato;<br/>
          • Nome dos genitores;<br/>
          • Dados bancários, como banco, agência e número de contas correntes;<br/>
          • Nome de usuário e senha específicos para uso dos serviços da CONTROLADORA;<br/>
          • Comunicação mantida entre o(a) TITULAR e a CONTROLADORA;<br/>
          • Atestados médicos;<br/>
          • Situações conjugais que possam ter reflexos nas relações de trabalho, como pagamento de pensão alimentícia e inclusão de dependente no plano de saúde;<br/>
          • Término do contrato de associação cooperativa, abrangendo ou não o motivo do desligamento.
        </p>
      </div>
    </div>

    <div style="font-size: 7.5px; text-align: right; color: #475569; padding-top: 2px;">
      Página 11 · Termo de Consentimento LGPD (Parte 1 de 3)
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 12: TERMO DE CONSENTIMENTO LGPD (PARTE 2)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('TERMO DE FORNECIMENTO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS (CONT.)')}

      <div class="texto-declaratorio-paragrafos" style="font-size: 8.8px; line-height: 1.42;">
        <p>
          <strong>Cláusula 3ª. Finalidades específicas do tratamento dos dados pessoais do(a) TITULAR:</strong><br/>
          3.1. O tratamento dos dados pessoais, listados no presente termo, tem as seguintes finalidades específicas abaixo:<br/>
          a) Possibilitar que a cooperativa possa fazer a formalização de contrato de associação cooperativista com base nas legislações vigentes;<br/>
          b) Possibilitar que a cooperativa possa utilizar os dados para cumprir com as exigências legais de registros obrigatórios;<br/>
          c) Possibilitar que a cooperativa possa utilizar os dados para fazer os registros relativos à manutenção do contrato de associação e execução deste em livros, fichas ou arquivos eletrônicos;<br/>
          d) Possibilitar que a cooperativa possa utilizar os dados para fins de pagamento de verba-família;<br/>
          e) Possibilitar que a cooperativa possa utilizar os dados para fins de inclusão em empresas de parceria de descontos, tais como faculdade, farmácia, academia, clube de campo;<br/>
          f) Possibilitar que a cooperativa possa utilizar os dados para emissão de recibos de pagamento de produtividade, DAR’s e demais verbas advindas da produtividade do sócio cooperado;<br/>
          g) Possibilitar que a cooperativa possa cumprir com as exigências legais relativas à saúde do sócio cooperado;<br/>
          h) Possibilitar que a cooperativa possa utilizar os dados para encaminhar correspondências e mensagens por meios físicos e digitais, abrangendo correio eletrônico (e-mail) e WhatsApp, inclusive para fazer a inclusão em grupos de WhatsApp da cooperativa;<br/>
          i) Possibilitar que a cooperativa possa utilizar os dados para compartilhamento com seguradoras, planos de saúde, operadores de benefícios e demandas judiciais;<br/>
          j) Permitir que a cooperativa possa utilizar os dados pessoais para compartilhamento com o Contratante dos serviços;
        </p>

        <p>
          <strong>Cláusula 4.ª Forma de armazenamento dos dados pessoais:</strong><br/>
          4.1. Os dados pessoais coletados serão armazenados pela CONTROLADORA, com as finalidades acima, exclusivamente nas seguintes hipóteses:<br/>
          • Enquanto perdurar a relação de associação cooperativista;<br/>
          • Até que o presente termo seja revogado pelo(a) TITULAR;<br/>
          • Enquanto necessário para atender prazos legais ou regulatórios.
        </p>

        <p>
          <strong>Cláusula 5.ª Compartilhamento de dados:</strong><br/>
          5.1. A CONTROLADORA fica autorizada a compartilhar os dados pessoais do(a) TITULAR com outros agentes de tratamento de dados, inclusive órgãos públicos, caso seja necessário para as finalidades listadas no presente termo, observados os princípios e as garantias estabelecidas pela Lei nº 13.709, de 2018.<br/>
          5.2. A CONTROLADORA fica autorizada, também, a compartilhar os dados pessoais do(a) nas situações que envolverem convênios médicos, planos de saúde, vale-refeição, vale-alimentação, consultorias contratadas e envio de informações alusivas às obrigações fiscais e previdenciárias.
        </p>

        <p>
          <strong>Cláusula 6ª. Segurança dos dados:</strong><br/>
          6.1. A CONTROLADORA se responsabiliza pela adoção de medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados, e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito.<br/>
          6.2. Em conformidade ao art. 48 da Lei nº 13.709, de 2018, a CONTROLADORA comunicará ao(à) TITULAR e à Autoridade Nacional de Proteção de Dados (ANPD) a ocorrência de incidente de segurança que possa acarretar risco ou dano relevante ao(à) TITULAR.
        </p>
      </div>
    </div>

    <div style="font-size: 7.5px; text-align: right; color: #475569; padding-top: 2px;">
      Página 12 · Termo de Consentimento LGPD (Parte 2 de 3)
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 13: TERMO DE CONSENTIMENTO LGPD (PARTE 3 - CONCLUSÃO)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('TERMO DE FORNECIMENTO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS (CONCLUSÃO)')}

      <div class="texto-declaratorio-paragrafos" style="font-size: 9px; line-height: 1.48;">
        <p>
          <strong>Cláusula 7ª. Término do tratamento dos dados:</strong><br/>
          7.1. A CONTROLADORA poderá manter e tratar os dados pessoais do(a) TITULAR durante todo o período em que os mesmos forem pertinentes ao alcance das finalidades listadas no presente termo, sendo que os dados pessoais anonimizados, sem possibilidade de associação ao(à) TITULAR, poderão ser mantidos por período indefinido.<br/>
          7.2. O(A) TITULAR poderá solicitar à CONTROLADORA, a qualquer momento, por meio de correio eletrônico (e-mail) ou por correspondência, que sejam eliminados seus dados pessoais não anonimizados. Desde já, o(a) TITULAR se declara ciente de que poderá ser inviável à CONTROLADORA continuar lhe mantendo contato, ou lhe encaminhar mensagens e correspondências a partir da eliminação dos dados pessoais.
        </p>

        <p>
          <strong>Cláusula 8ª. Direitos do(a) TITULAR:</strong><br/>
          8.1. O(A) TITULAR tem direito a obter da CONTROLADORA, em relação aos dados por ele tratados, a qualquer momento, e mediante requisição:<br/>
          a) Confirmação da existência de tratamento;<br/>
          b) Acesso aos dados;<br/>
          c) Correção de dados incompletos, inexatos ou desatualizados;<br/>
          d) Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com o disposto na Lei nº 13.709, de 2018;<br/>
          e) Informação das entidades públicas e privadas com as quais a CONTROLADORA realizou uso compartilhado de dados;<br/>
          f) Revogação do consentimento, nos termos do § 5º do art. 8º da Lei nº 13.709, de 2018.
        </p>

        <p>
          <strong>Cláusula 9ª. Direito de revogação do consentimento:</strong><br/>
          9.1. O presente consentimento poderá ser revogado a qualquer momento pelo(a) TITULAR, mediante sua manifestação expressa, por meio de solicitação via correio eletrônico (e-mail) ou por correspondência encaminhada à CONTROLADORA, ratificados os tratamentos realizados sob amparo do presente consentimento, nos termos do inciso VI do “caput” do art. 18 da Lei nº 13.709, de 2018.
        </p>
      </div>
    </div>

    <div>
      ${renderAssinaturaRodape(false, false)}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 14: TERMO DE CONSENTIMENTO DE DADOS SENSÍVEIS E GEOLOCALIZAÇÃO
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4">
    <div>
      ${renderHeaderOficial('TERMO DE CONSENTIMENTO DE DADOS SENSÍVEIS PARA PREENCHIMENTO DE APONTAMENTO')}

      <div class="texto-declaratorio-paragrafos" style="font-size: 9.5px; line-height: 1.55;">
        <p>
          Através do presente instrumento eu <strong>${nomeCooperado}</strong>, residente e domiciliado(a) <strong>${ds.logradouro || detalhe.logradouro || '—'}</strong>, nº <strong>${ds.numero || detalhe.numero || 'S/N'}</strong>, Bairro <strong>${ds.bairro || detalhe.bairro || '—'}</strong>, Cidade: <strong>${cidade}</strong> CEP: <strong>${ds.cep || detalhe.cep || '—'}</strong>, inscrito(a) no CPF/MF sob o nº <strong>${cpfStr}</strong>, aqui denominado(a) como TITULAR, venho por meio deste, autorizar à <strong>ATESA COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA SAÚDE</strong>, inscrita no CNPJ/ MF sob nº 08.930.337/0001-00, em razão da minha associação como sócio(a) cooperado(a) para exercer atividades por meio desta entidade, disponha de meus dados pessoais e dados pessoais sensíveis, de acordo com os artigos 7º e 11º da Lei 13.709/2018.
        </p>
        <p>
          Estou ciente que o apontamento eletrônico deve ser efetuado de maneira correta no APP da Cooperativa, bem como da importância para apuração da minha produtividade.
        </p>
        <p>
          Estou ciente que preciso <strong>SEMPRE apertar o botão PERMITIR</strong> do meu aplicativo liberando a “geolocalização” para efetuar dentro do local da realização dos serviços.
        </p>
      </div>

      <!-- Ilustração Oficial da Permissão do Safari/App -->
      <div class="box-ilustracao-geoloc">
        <div style="font-size: 14px; font-weight: 900; color: #15803d; margin-bottom: 6px;">ATESA · NOVO CONCEITO EM SAÚDE</div>
        <div class="modal-safari-box">
          <div style="font-size: 11px; font-weight: 800; color: #000; margin-bottom: 4px;">
            "jm-sas.ddns.net" deseja usar a sua localização atual.
          </div>
          <div style="font-size: 9px; color: #475569; margin-bottom: 10px;">
            Este site usará a sua localização precisa porque o "Safari" tem acesso à sua localização precisa no momento.
          </div>
          <div style="display: flex; justify-content: center; gap: 12px; align-items: center;">
            <span style="font-size: 10px; color: #0284c7; padding: 4px 10px; border: 1px solid #cbd5e1; border-radius: 4px;">Não Permitir</span>
            <span class="btn-safari-permitir">
              Permitir
              <span class="seta-vermelha-indicativa">←</span>
            </span>
          </div>
        </div>
      </div>

      <div style="font-size: 9.5px; line-height: 1.5; text-align: justify; margin-top: 6px;">
        Por esta ser a expressão da minha vontade, declaro e autorizo o uso descrito, sem que haja nada a ser reclamado a título de contraprestação em caráter irrevogável e irretratável.
      </div>
    </div>

    <div>
      <div class="bloco-rodape-assinatura">
        <div class="linha-data-local">
          ______________________________________, <span class="dia-preenchida"><strong>${partesData.dia}</strong></span> de <span class="mes-preenchida"><strong>${partesData.mes}</strong></span> de 20<span class="ano-preenchida"><strong>${partesData.anoCurto}</strong></span>.
        </div>
        <div class="area-assinatura-centralizada">
          ${assinaturaB64 ? `
            <img src="${assinaturaB64}" alt="Assinatura" class="assinatura-img-preview" />
          ` : `
            <div class="carimbo-digital-cooperado">✓ ASSINADO DIGITALMENTE NO PORTAL ATESA · CPF ${cpfStr}</div>
          `}
          <div class="linha-traco-assinatura"></div>
          <div class="nome-completo-rotulo">Assinatura do Sócio Cooperado: ${nomeCooperado}</div>
        </div>
      </div>

      <!-- Rodapé com endereço institucional exato da ATESA -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 4px; margin-top: 8px; font-size: 8px; color: #475569; text-align: center; line-height: 1.35;">
        Rua Alfredo Pujol, nº 369 – Santana – São Paulo - CEP 02017-010 PABX (11) 3083-0050 ou 3083-0053<br/>
        São Paulo (SP) – Fortaleza (CE) – Rio de Janeiro (RJ)<br/>
        <strong>www.atesa.com.br</strong>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINA 15: TERMO OFICIAL METLIFE (SEGURO DE VIDA EM GRUPO)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="page-a4" style="padding: 0;">
    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
      ${termoMetLifeBase64 ? `
        <img src="${termoMetLifeBase64}" alt="Termo de Nomeação MetLife Oficial Preenchido" style="width: 100%; max-height: 276mm; height: auto; object-fit: contain; display: block; margin: 0 auto;" />
      ` : `
        <div style="padding: 20px; text-align: center;">
          <h2>DOCUMENTO OFICIAL METLIFE — TERMO DE NOMEAÇÃO DE BENEFICIÁRIOS</h2>
          <p>Apólice nº 01.093.581 · Segurado: ${nomeCooperado} · CPF: ${cpfStr}</p>
        </div>
      `}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PÁGINAS ANEXAS: DOSSIÊ DE DOCUMENTOS DIGITALIZADOS ENVIADOS
       ══════════════════════════════════════════════════════════════════════════ -->
  ${docsComImagens.length > 0 ? `
    <div class="page-a4" style="min-height: auto; max-height: none;">
      <div>
        ${renderHeaderOficial('ANEXOS · DOCUMENTOS COMPROBATÓRIOS DIGITALIZADOS')}

        <div style="display: flex; flex-direction: column; gap: 24px; margin-top: 10px;">
          ${docsComImagens.map((doc: any) => {
            const rotulo = ROTULOS_DOCS[doc.tipo] || doc.tipo;
            if (doc.base64) {
              return `
                <div style="page-break-inside: avoid; text-align: center; margin-bottom: 16px; border: 1.5px solid #000; padding: 8px; background: #fff;">
                  <div style="font-size: 11px; font-weight: 900; color: #000; text-transform: uppercase; margin-bottom: 2px;">
                    ${rotulo}
                  </div>
                  <div style="font-size: 8.5px; color: #475569; margin-bottom: 6px;">
                    Arquivo Original: ${doc.nome_original || 'Documento Anexado'}
                  </div>
                  <div style="display: inline-block; max-width: 100%;">
                    <img src="${doc.base64}" alt="${rotulo}" style="max-width: 100%; max-height: 220mm; height: auto; object-fit: contain; display: block; margin: 0 auto; border: 1px solid #cbd5e1;" />
                  </div>
                </div>
              `;
            } else {
              return `
                <div style="page-break-inside: avoid; text-align: center; padding: 14px; border: 1.5px dashed #000; background: #f8fafc; margin-bottom: 10px;">
                  <div style="font-size: 10px; font-weight: 800; color: #000;">
                    ${rotulo}
                  </div>
                  <div style="font-size: 9px; color: #475569; margin-top: 3px;">
                    📄 Arquivo Anexado: <strong>${doc.nome_original}</strong> (Documento em formato PDF ou não rasterizável)
                  </div>
                </div>
              `;
            }
          }).join('')}
        </div>
      </div>
    </div>
  ` : ''}

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
  `;

  janela.document.open();
  janela.document.write(html);
  janela.document.close();
}
