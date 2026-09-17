import { SuporteCooperadoDetalhe } from '../api/raApi';
import { formatarCPF, formatarDataBR } from './formatters';

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

// 10 Itens Estatutários da Seção 05
const ITENS_ESTATUTARIOS = [
  { id: 'item1', num: 1, texto: 'Que recebi as informações legais e estatutárias sobre o Sistema Cooperativista' },
  { id: 'item2', num: 2, texto: 'Que tenho ciência que a Assembléia Geral Ordinária (AGO) ocorrerá uma vez ao ano, no mês de março' },
  { id: 'item3', num: 3, texto: 'Que tenho ciência que as Assembléias Gerais têm competência para decidir sobre todos os interesses da cooperativa' },
  { id: 'item4', num: 4, texto: 'Que tenho ciência da obrigatoriedade de participação nas Assembléias Gerais' },
  { id: 'item5', num: 5, texto: 'Que tenho ciência do desconto de 3% em minha remuneração referente a rateio de custos da cooperativa' },
  { id: 'item6', num: 6, texto: 'Que efetuarei a integralização da quota parte, no valor de R$ 50,00, em 05 parcelas de R$ 10,00' },
  { id: 'item7', num: 7, texto: 'Que tenho ciência que o Seguro de Vida em grupo é obrigatório, conforme aprovação em AGO' },
  { id: 'item8', num: 8, texto: 'Que a devolução de quotas partes só poderão ser solicitadas caso venha a se desligar da Cooperativa' },
  { id: 'item9', num: 9, texto: 'Que a restituição das quotas partes se dará após solicitação por escrito e aprovação em AGO do exercício' },
  { id: 'item10', num: 10, texto: 'Que o valor da remuneração pela execução dos serviços será creditada em conta bancária indicada por escrito' },
];

// 12 Perguntas do Questionário da Seção 06
const PERGUNTAS_QUESTIONARIO = [
  { id: 'q1', num: 1, texto: 'Na Cooperativa, você é?', tipo: 'papel' },
  { id: 'q2', num: 2, texto: 'O que significa Integralização de Capital?', tipo: 'capital' },
  { id: 'q3', num: 3, texto: 'Você terá vínculo empregatício?' },
  { id: 'q4', num: 4, texto: 'Você terá vínculo empregatício com as tomadoras de serviço, nas quais irá exercer as atividades?' },
  { id: 'q5', num: 5, texto: 'Como associado, você terá direito a 13º, FGTS e Seguro Desemprego?' },
  { id: 'q6', num: 6, texto: 'Você terá seu INSS recolhido enquanto estiver em atividade?' },
  { id: 'q7', num: 7, texto: 'A sua Adesão foi de livre vontade e poderá desligar-se assim que desejar?' },
  { id: 'q8', num: 8, texto: 'Você tem o direito de votar e ser votado?' },
  { id: 'q9', num: 9, texto: 'As decisões são sempre tomadas pela maioria dos associados?' },
  { id: 'q10', num: 10, texto: 'Você terá direito a Descanso Anual Remunerado?' },
  { id: 'q11', num: 11, texto: 'Na cooperativa todos são iguais e não há qualquer discriminação?' },
  { id: 'q12', num: 12, texto: 'Um dos princípios cooperativistas é a educação permanente aos seus associados?' },
];

// Converte URL de imagem para Base64 Data URL
async function urlParaBase64(url: string, token?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn('[PDF] Erro ao carregar imagem para base64:', res.status, url);
      return null;
    }
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
  } catch (err) {
    console.warn('[PDF] Falha ao converter imagem para base64:', url, err);
    return null;
  }
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

      // Configurações de texto padrão
      ctx.fillStyle = '#111827';
      ctx.textBaseline = 'middle';

      // ── Linha 1: Nome do Segurado e CPF ───────────────────────────────────
      ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
      const nomeCooperado = (candidato.nome || '').toUpperCase();
      ctx.fillText(nomeCooperado, 160, 266);

      const cpfStr = formatarCPF(candidato.cpf);
      ctx.fillText(cpfStr, 960, 266);

      // ── Linha 2: Estipulante / Subestipulante ──────────────────────────────
      ctx.font = '600 20px "Segoe UI", Arial, sans-serif';
      const estipulante = `COOPERATIVA DE TRABALHO ATESA - CNPJ: 08.528.917/0001-00`;
      ctx.fillText(estipulante, 440, 336);

      // ── Linha 3: Nº de Apólice ─────────────────────────────────────────────
      ctx.fillText('01.093.581', 270, 404);

      // ── Tabela de Beneficiários (Linhas 1 a 4) ─────────────────────────────
      const beneficiarios = dadosJson.beneficiariosSeguro || [];
      const linhaYInicial = 538;
      const alturaLinha = 50;

      ctx.font = '600 19px "Segoe UI", Arial, sans-serif';
      for (let i = 0; i < 4; i++) {
        const ben = beneficiarios[i];
        const y = linhaYInicial + i * alturaLinha;
        if (ben && (ben.nome || ben.parentesco)) {
          // Nome Completo
          ctx.fillText((ben.nome || '').toUpperCase(), 80, y);
          // % de Participação
          const pct = ben.percentual ? `${ben.percentual}%` : '100%';
          ctx.fillText(pct, 760, y);
          // Grau de Parentesco
          ctx.fillText(ben.parentesco || '', 970, y);
        }
      }

      // ── Local e Data de Preenchimento da Seção 12 ──────────────────────────
      const ds = dadosJson.dadosSensiveis || candidato.dadosSensiveis || {};
      const cidade = ds.cidade || candidato.cidade || 'São Paulo';
      const uf = ds.uf || candidato.uf || 'SP';

      // Data de preenchimento da Seção 12 ou data atual
      const dataSecao12Raw = dadosJson.secao12_preenchida_em || candidato.adesao_atualizado_em || candidato.data_inicio || new Date().toISOString();
      let dataFormatada = 'São Paulo - SP';
      try {
        const d = new Date(dataSecao12Raw);
        if (!isNaN(d.getTime())) {
          const dia = String(d.getDate()).padStart(2, '0');
          const mesExtenso = d.toLocaleString('pt-BR', { month: 'long' });
          const ano = d.getFullYear();
          dataFormatada = `${cidade} - ${uf}, ${dia} de ${mesExtenso} de ${ano}`;
        }
      } catch {
        dataFormatada = `${cidade} - ${uf}, ${formatarDataBR(dataSecao12Raw)}`;
      }

      ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
      const xCentroLocalData = 340;
      const larguraTextoData = ctx.measureText(dataFormatada).width;
      ctx.fillText(dataFormatada, xCentroLocalData - larguraTextoData / 2, 1160);

      // ── Assinatura do Segurado ────────────────────────────────────────────
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
          desenharCarimboAssinatura(ctx, nomeCooperado, cpfStr, xCentroAssinatura);
          resolve(canvas.toDataURL('image/png', 0.95));
        };
        imgAssinatura.src = assinaturaB64;
      } else {
        desenharCarimboAssinatura(ctx, nomeCooperado, cpfStr, xCentroAssinatura);
        resolve(canvas.toDataURL('image/png', 0.95));
      }
    };

    imgFundo.onerror = () => resolve(null);
    imgFundo.src = '/documentos/termo_de_nomeacao.png';
  });
}

function desenharCarimboAssinatura(
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

/**
 * Gera e abre o Dossiê Completo de Adesão do Cooperado em PDF (Pronto para impressão/salvamento)
 */
export async function gerarPdfAdesaoCompleta(detalhe: SuporteCooperadoDetalhe) {
  // Parse dos dados brutos em JSON
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
  const quest = dados.questionario || {};
  const estat = dados.estatutario || {};
  const aut = dados.autorizacoes || {};
  const palestra = dados.palestraAta || {};
  const termoContrato = dados.termoAdesaoContrato || {};
  const termoSigilo = dados.termoConfidencialidade || {};
  const termoLgpd = dados.termoLgpd || {};
  const termoGeo = dados.termoGeolocalizacao || {};
  const docs = detalhe.documentos || [];

  // Carrega a logo oficial da ATESA em Base64
  const logoBase64 = await urlParaBase64('/atesa_logo.png');

  // Gera a imagem do Termo MetLife preenchida
  const termoMetLifeBase64 = await gerarImagemTermoMetLife(detalhe, dados);

  // Carrega as imagens dos documentos enviados pelo cooperado em Base64
  const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const token = localStorage.getItem('atesa_token') || '';

  const docsComImagens = await Promise.all(
    docs.map(async (doc) => {
      const downloadUrl = `${API_BASE}/beneficios/documentos/${doc.id}/download`;
      const base64 = await urlParaBase64(downloadUrl, token);
      return { ...doc, base64 };
    })
  );

  // Cria a janela de impressão
  const janela = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes,resizable=yes');
  if (!janela) {
    alert('Permita a abertura de pop-ups no seu navegador para visualizar e salvar o PDF.');
    return;
  }

  const dataEmissao = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const ipAuditoria = detalhe.ip_registro || detalhe.ultimo_ip_doc || '—';
  const geoAudit = (detalhe.latitude && detalhe.longitude) ? `${detalhe.latitude}, ${detalhe.longitude}` : 'Coordenadas não registradas';

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="ATESA" style="max-height: 40px; width: auto; object-fit: contain; display: block;" />`
    : `<span style="font-size: 20px; font-weight: 800; color: #1e3a5f; letter-spacing: -0.5px;">ATESA</span>`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Dossiê de Adesão - ${detalhe.nome} - ATESA</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11.5px;
      color: #1e293b;
      line-height: 1.45;
      margin: 0;
      padding: 10px;
      background: #fff;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #1b5e20;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-audit {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .header-audit strong {
      color: #0f172a;
    }
    .doc-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .doc-subtitle {
      font-size: 11px;
      color: #475569;
      margin: 0 0 14px;
    }
    .section-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .section-header {
      background: #f1f5f9;
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: 800;
      color: #1e293b;
      border-bottom: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-body {
      padding: 8px 10px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 12px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px 12px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px 12px;
    }
    .field-item {
      font-size: 11px;
    }
    .field-label {
      font-weight: 700;
      color: #475569;
      display: block;
      font-size: 10px;
      text-transform: uppercase;
    }
    .field-value {
      color: #0f172a;
      font-weight: 500;
      word-break: break-word;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-top: 4px;
    }
    .table-custom th {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      text-align: left;
      font-weight: 700;
      color: #334155;
    }
    .table-custom td {
      border: 1px solid #e2e8f0;
      padding: 5px 8px;
      color: #1e293b;
    }
    .badge-resp-sim {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      background: #dcfce7;
      color: #166534;
      font-weight: 800;
      font-size: 10px;
      border: 1px solid #86efac;
    }
    .badge-resp-nao {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      background: #fee2e2;
      color: #991b1b;
      font-weight: 800;
      font-size: 10px;
      border: 1px solid #fca5a5;
    }
    .badge-resp-text {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 800;
      font-size: 10px;
      border: 1px solid #bae6fd;
    }
    .check-yes {
      color: #16a34a;
      font-weight: 700;
    }
    .check-no {
      color: #dc2626;
      font-weight: 700;
    }
    .metlife-container {
      width: 100%;
      max-width: 100%;
      text-align: center;
      page-break-before: always;
      page-break-after: always;
      break-inside: avoid;
    }
    .metlife-img {
      width: 100%;
      max-width: 794px;
      height: auto;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: block;
      margin: 0 auto;
    }
    .signature-box {
      margin-top: 14px;
      padding: 10px;
      border: 1.5px dashed #1b5e20;
      background: #f0fdf4;
      border-radius: 6px;
      text-align: center;
      page-break-inside: avoid;
    }
    .footer-audit {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      margin-top: 20px;
      font-size: 9.5px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <!-- Cabeçalho Oficial -->
  <div class="header-box">
    <div class="header-logo">
      ${logoHtml}
      <span style="font-size: 13px; font-weight: 700; color: #1e3a5f; margin-left: 4px;">· Cooperativa de Trabalho</span>
    </div>
    <div class="header-audit">
      <div>Processo de Adesão e Admissão de Cooperado</div>
      <div>Emissão: <strong>${dataEmissao}</strong></div>
      <div>Protocolo Proposta: <strong>#${detalhe.proposta_id || detalhe.id}</strong></div>
    </div>
  </div>

  <h1 class="doc-title">Dossiê de Adesão Completa do Cooperado</h1>
  <p class="doc-subtitle">Auditoria de ponta a ponta, dados cadastrais, bancários, estatutários e termos legais.</p>

  <!-- 01. Identificação & Dados Cadastrais -->
  <div class="section-card">
    <div class="section-header">01. Identificação & Dados Cadastrais</div>
    <div class="section-body">
      <div class="grid-3">
        <div class="field-item">
          <span class="field-label">Nome Completo</span>
          <span class="field-value">${detalhe.nome || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">CPF</span>
          <span class="field-value">${formatarCPF(detalhe.cpf)}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Data de Nascimento</span>
          <span class="field-value">${formatarDataBR(detalhe.data_nascimento || ds.data_nascimento)}</span>
        </div>
      </div>

      <div class="grid-4" style="margin-top: 8px;">
        <div class="field-item">
          <span class="field-label">RG / Órgão / UF</span>
          <span class="field-value">${detalhe.rg || ds.rg || '—'} ${ds.orgao_emissor ? `(${ds.orgao_emissor}/${ds.uf_rg || ''})` : ''}</span>
        </div>
        <div class="field-item">
          <span class="field-label">PIS / PASEP / NIS / NIT</span>
          <span class="field-value">${ds.pis_pasep || ds.nit || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Estado Civil</span>
          <span class="field-value">${ds.estado_civil || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Gênero</span>
          <span class="field-value">${ds.genero || '—'}</span>
        </div>
      </div>

      <div class="grid-3" style="margin-top: 8px;">
        <div class="field-item">
          <span class="field-label">Nome da Mãe</span>
          <span class="field-value">${ds.nome_mae || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Nome do Pai</span>
          <span class="field-value">${ds.nome_pai || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Naturalidade</span>
          <span class="field-value">${ds.naturalidade || '—'}</span>
        </div>
      </div>

      <div class="grid-3" style="margin-top: 8px;">
        <div class="field-item">
          <span class="field-label">Título de Eleitor</span>
          <span class="field-value">${ds.titulo_eleitor || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Matrícula ATESA</span>
          <span class="field-value">${detalhe.matricula ? `#${detalhe.matricula}` : 'Aguardando validação final'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Telefone / WhatsApp</span>
          <span class="field-value">${detalhe.celular || detalhe.telefone || '—'}</span>
        </div>
      </div>

      <div class="grid-2" style="margin-top: 8px;">
        <div class="field-item">
          <span class="field-label">E-mail</span>
          <span class="field-value">${detalhe.email || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Grau de Instrução</span>
          <span class="field-value">${ds.grau_instrucao || '—'}</span>
        </div>
      </div>

      <div style="margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
        <div class="grid-4">
          <div class="field-item" style="grid-column: span 2;">
            <span class="field-label">Endereço Residencial</span>
            <span class="field-value">${ds.logradouro || detalhe.logradouro || '—'}, ${ds.numero || detalhe.numero || 'S/N'} ${ds.complemento ? `(${ds.complemento})` : ''}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Bairro / Cidade / UF</span>
            <span class="field-value">${ds.bairro || detalhe.bairro || '—'} · ${ds.cidade || detalhe.cidade || '—'}/${ds.uf || detalhe.uf || '—'}</span>
          </div>
          <div class="field-item">
            <span class="field-label">CEP</span>
            <span class="field-value">${ds.cep || detalhe.cep || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 02. Contatos de Emergência -->
  <div class="section-card">
    <div class="section-header">02. Contatos de Emergência</div>
    <div class="section-body">
      ${contatos.length > 0 ? `
        <table class="table-custom">
          <thead>
            <tr>
              <th>Contato</th>
              <th>Nome Completo</th>
              <th>Parentesco</th>
              <th>Telefone</th>
            </tr>
          </thead>
          <tbody>
            ${contatos.map((c: any, i: number) => `
              <tr>
                <td>#${i + 1}</td>
                <td><strong>${c.nome || c.nome_1 || '—'}</strong></td>
                <td>${c.parentesco || c.parentesco_1 || '—'}</td>
                <td>${c.telefone || c.telefone_1 || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div style="color:#64748b;font-size:11px;">Nenhum contato adicional informado.</div>'}
    </div>
  </div>

  <!-- 03. Cota-Parte & Dados Bancários -->
  <div class="section-card">
    <div class="section-header">03. Cota-Parte & Dados Bancários</div>
    <div class="section-body">
      <div class="grid-4">
        <div class="field-item">
          <span class="field-label">Instituição Bancária</span>
          <span class="field-value">${db.banco || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Agência</span>
          <span class="field-value">${db.agencia || '—'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Conta com Dígito</span>
          <span class="field-value">${db.conta || '—'}${db.digito ? `-${db.digito}` : ''} (${db.tipo_conta || 'Corrente'})</span>
        </div>
        <div class="field-item">
          <span class="field-label">Chave PIX</span>
          <span class="field-value">${db.chave_pix || '—'} ${db.tipo_pix ? `(${db.tipo_pix})` : ''}</span>
        </div>
      </div>
      <div style="margin-top: 8px; font-size: 10px; color: #475569; background: #f8fafc; padding: 6px 8px; border-radius: 4px;">
        ℹ️ <strong>Tarifas de Repasse:</strong> Trabalhamos com Itaú, Bradesco e Santander (isentos de tarifas de repasse). Para as demais instituições bancárias, haverá cobrança de taxa de DOC/TED no valor de R$ 12,00 por repasse. Quota-parte integralizada: 50 quotas (R$ 50,00 em 5 parcelas de R$ 10,00).
      </div>
    </div>
  </div>

  <!-- 04. Ata de Palestra Cooperativista -->
  <div class="section-card">
    <div class="section-header">04. Ata de Palestra Cooperativista</div>
    <div class="section-body">
      <div class="grid-2">
        <div class="field-item">
          <span class="field-label">Formato de Participação na Palestra</span>
          <span class="field-value">${palestra.formato === 'presencial' ? '🏢 Presencial na Sede / Polo' : '💻 Online (Vídeo / Plataforma)'}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Manifestação & Concordância com a Ata</span>
          <span class="field-value">
            ${palestra.concorda
              ? '<span class="badge-resp-sim">✓ SIM — Concordou e Aceitou os Termos da Ata</span>'
              : '<span class="badge-resp-nao">✗ NÃO CONCORDOU / PENDENTE</span>'}
          </span>
        </div>
      </div>
      <div style="margin-top: 6px; font-size: 10px; color: #475569; background: #f8fafc; padding: 6px 8px; border-radius: 4px; line-height: 1.4;">
        O interessado declara ter assistido a palestra sobre esclarecimento do Sistema Cooperativista com base nas <strong>Leis Federais 5.764/1971 e 12.690/2012</strong>, ciente da inexistência de vínculo empregatício conforme o <strong>parágrafo único do art. 442 da CLT</strong> e <strong>art. 90 da Lei 5.764/1971</strong>.
      </div>
    </div>
  </div>

  <!-- 05. Declaração de Informações Estatutárias -->
  <div class="section-card">
    <div class="section-header">05. Declaração de Informações Estatutárias (10 Itens)</div>
    <div class="section-body">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">Item</th>
            <th>Declaração Estatutária</th>
            <th style="width: 70px; text-align: center;">Resposta</th>
          </tr>
        </thead>
        <tbody>
          ${ITENS_ESTATUTARIOS.map((item) => {
            const resp = (estat[item.id] || '').toLowerCase();
            const badge = resp === 'sim'
              ? '<span class="badge-resp-sim">SIM</span>'
              : (resp === 'nao' ? '<span class="badge-resp-nao">NÃO</span>' : '<span style="color:#94a3b8;">—</span>');
            return `
              <tr>
                <td style="text-align: center; font-weight: 700;">#${item.num}</td>
                <td>${item.texto}</td>
                <td style="text-align: center;">${badge}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 06. Questionário Dirigido aos Associados -->
  <div class="section-card">
    <div class="section-header">06. Questionário Dirigido aos Associados (12 Perguntas)</div>
    <div class="section-body">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">Nº</th>
            <th>Pergunta do Questionário</th>
            <th style="width: 140px; text-align: center;">Resposta do Cooperado</th>
          </tr>
        </thead>
        <tbody>
          ${PERGUNTAS_QUESTIONARIO.map((q) => {
            const val = quest[q.id];
            let respHtml = '<span style="color:#94a3b8;">—</span>';
            if (q.tipo === 'papel') {
              respHtml = val === 'associado'
                ? '<span class="badge-resp-sim">ASSOCIADO</span>'
                : (val === 'empregado' ? '<span class="badge-resp-nao">EMPREGADO</span>' : '<span style="color:#94a3b8;">—</span>');
            } else if (q.tipo === 'capital') {
              respHtml = val === 'quota_parte'
                ? '<span class="badge-resp-sim">VALOR DA QUOTA PARTE</span>'
                : (val === 'outras_taxas' ? '<span class="badge-resp-nao">OUTRAS TAXAS</span>' : '<span style="color:#94a3b8;">—</span>');
            } else {
              const resp = String(val || '').toLowerCase();
              respHtml = resp === 'sim'
                ? '<span class="badge-resp-sim">SIM</span>'
                : (resp === 'nao' ? '<span class="badge-resp-nao">NÃO</span>' : '<span style="color:#94a3b8;">—</span>');
            }
            return `
              <tr>
                <td style="text-align: center; font-weight: 700;">${q.num}</td>
                <td>${q.texto}</td>
                <td style="text-align: center;">${respHtml}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 07. Autorização de Descontos & Convênios -->
  <div class="section-card">
    <div class="section-header">07. Autorização de Descontos & Convênios</div>
    <div class="section-body">
      <div class="grid-2">
        <div>
          <span class="field-label">Descontos Obrigatórios Estatutários</span>
          <div style="font-size: 10.5px; color: #334155; margin-top: 4px; line-height: 1.4;">
            • Quota-Parte: R$ 50,00 (05 parcelas de R$ 10,00)<br />
            • Rateio de Custos da Cooperativa: 3% sobre remuneração<br />
            • INSS: 20% recolhido sobre produtividade
          </div>
        </div>
        <div>
          <span class="field-label">Manifestação de Autorização</span>
          <div style="margin-top: 4px;">
            ${aut.concorda_descontos
              ? '<span class="badge-resp-sim">✓ SIM — Descontos Autorizados</span>'
              : '<span class="badge-resp-nao">✗ NÃO AUTORIZADO</span>'}
          </div>
        </div>
      </div>

      <div style="margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
        <span class="field-label">Convênios Opcionais Selecionados pelo Cooperado</span>
        <div style="font-size: 11px; color: #0f172a; margin-top: 4px;">
          ${(aut.convenios_opcionais && aut.convenios_opcionais.length > 0)
            ? aut.convenios_opcionais.map((c: string) => `<span class="badge-resp-text" style="margin-right: 4px; margin-bottom: 4px; display: inline-block;">✓ ${c}</span>`).join(' ')
            : '<span style="color:#64748b; font-style: italic;">Nenhum convênio opcional selecionado nesta etapa.</span>'}
        </div>
      </div>
    </div>
  </div>

  <!-- 08. Termo de Adesão a Contrato -->
  <div class="section-card">
    <div class="section-header">08. Termo de Adesão de Cooperado a Contrato</div>
    <div class="section-body">
      <div class="grid-2">
        <div class="field-item">
          <span class="field-label">Objeto do Termo</span>
          <span class="field-value">Manifestação de interesse para execução de serviços autônomos com tomadores parceiros</span>
        </div>
        <div class="field-item">
          <span class="field-label">Assinatura / Aceite do Cooperado</span>
          <span class="field-value">
            ${termoContrato.concorda
              ? '<span class="badge-resp-sim">✓ SIM — Termo de Adesão Aceito e Assinado</span>'
              : '<span class="badge-resp-nao">✗ NÃO ASSINADO</span>'}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- 09. Termo de Confidencialidade e Sigilo Ético -->
  <div class="section-card">
    <div class="section-header">09. Termo de Confidencialidade e Sigilo Ético</div>
    <div class="section-body">
      <div class="grid-2">
        <div class="field-item">
          <span class="field-label">Compromisso Ético & Legal</span>
          <span class="field-value">Sigilo absoluto sobre prontuários, dados clínicos e segredos profissionais (Art. 154 Código Penal)</span>
        </div>
        <div class="field-item">
          <span class="field-label">Assinatura / Aceite do Cooperado</span>
          <span class="field-value">
            ${termoSigilo.concorda
              ? '<span class="badge-resp-sim">✓ SIM — Assinado e Ciente das Responsabilidades</span>'
              : '<span class="badge-resp-nao">✗ NÃO ASSINADO</span>'}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- 10. Termo de Consentimento LGPD -->
  <div class="section-card">
    <div class="section-header">10. Termo de Consentimento LGPD (Lei nº 13.709/2018)</div>
    <div class="section-body">
      <div class="grid-2">
        <div class="field-item">
          <span class="field-label">Finalidade do Tratamento</span>
          <span class="field-value">Formalização de associação, recolhimento fiscal, seguros e escalas de trabalho</span>
        </div>
        <div class="field-item">
          <span class="field-label">Consentimento Expresso do Titular</span>
          <span class="field-value">
            ${termoLgpd.concorda
              ? '<span class="badge-resp-sim">✓ SIM — Consentimento Expresso Concedido</span>'
              : '<span class="badge-resp-nao">✗ NÃO CONCEDIDO</span>'}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- 11. Termo de Geolocalização & Apontamento no App -->
  <div class="section-card">
    <div class="section-header">11. Termo de Geolocalização & Apontamento no App</div>
    <div class="section-body">
      <div class="grid-3">
        <div class="field-item">
          <span class="field-label">Autorização GPS no App</span>
          <span class="field-value">
            ${termoGeo.concorda
              ? '<span class="badge-resp-sim">✓ SIM — Autorizado</span>'
              : '<span class="badge-resp-nao">✗ NÃO AUTORIZADO</span>'}
          </span>
        </div>
        <div class="field-item">
          <span class="field-label">IP de Auditoria</span>
          <span class="field-value font-mono">${ipAuditoria}</span>
        </div>
        <div class="field-item">
          <span class="field-label">Geolocalização Registrada</span>
          <span class="field-value">${geoAudit}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Assinatura Digital do Cooperado -->
  <div class="signature-box">
    <div style="font-size: 11px; font-weight: 800; color: #1b5e20; text-transform: uppercase;">
      Assinatura Digital de Próprio Punho do Cooperado
    </div>
    ${dados.assinatura_digital_base64 ? `
      <img src="${dados.assinatura_digital_base64}" alt="Assinatura" style="max-height: 55px; margin: 6px auto; display: block;" />
    ` : ''}
    <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${detalhe.nome}</div>
    <div style="font-size: 10px; color: #64748b;">
      CPF: ${formatarCPF(detalhe.cpf)} · Registrado digitalmente no Portal ATESA · IP: ${ipAuditoria}
    </div>
  </div>

  <!-- ══ PÁGINA 2: Termo de Nomeação MetLife Oficial ══ -->
  ${termoMetLifeBase64 ? `
    <div class="metlife-container">
      <div style="margin-bottom: 8px; font-weight: 800; font-size: 12px; color: #1e3a8a; text-align: left; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 4px;">
        DOCUMENTO OFICIAL METLIFE — TERMO DE NOMEAÇÃO E ALTERAÇÃO DE BENEFICIÁRIOS (SEGURO DE VIDA)
      </div>
      <img class="metlife-img" src="${termoMetLifeBase64}" alt="Termo de Nomeação MetLife Preenchido" />
    </div>
  ` : ''}

  <!-- ══ PÁGINA 3: Documentos Enviados pelo Cooperado ══ -->
  ${docsComImagens.length > 0 ? `
    <div class="page-break"></div>
    <div class="header-box">
      <div class="header-logo">
        ${logoHtml}
        <span style="font-size: 13px; font-weight: 700; color: #1e3a5f; margin-left: 4px;">· Documentos Anexados</span>
      </div>
      <div class="header-audit">
        <div>Cooperado: <strong>${detalhe.nome}</strong></div>
        <div>CPF: <strong>${formatarCPF(detalhe.cpf)}</strong></div>
      </div>
    </div>

    <h2 class="doc-title" style="font-size: 14px; margin-top: 14px; margin-bottom: 4px;">Documentos Enviados pelo Cooperado</h2>
    <p class="doc-subtitle" style="margin-bottom: 24px;">Digitalização oficial dos documentos anexados pelo cooperado durante a proposta de adesão.</p>

    <div style="display: flex; flex-direction: column; gap: 28px;">
      ${docsComImagens.map((doc: any) => {
        const rotulo = ROTULOS_DOCS[doc.tipo] || doc.tipo;
        if (doc.base64) {
          return `
            <div style="page-break-inside: avoid; text-align: center; margin-bottom: 20px;">
              <div style="display: inline-block; max-width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background: #ffffff;">
                <img src="${doc.base64}" alt="${rotulo}" style="max-width: 100%; max-height: 240mm; height: auto; object-fit: contain; display: block; margin: 0 auto;" />
              </div>
              <div style="margin-top: 8px; font-size: 13px; font-weight: 700; color: #1e293b;">
                ${rotulo}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                ${doc.nome_original}
              </div>
            </div>
          `;
        } else {
          return `
            <div style="page-break-inside: avoid; text-align: center; padding: 20px; border: 1px dashed #cbd5e1; border-radius: 6px; background: #f8fafc; margin-bottom: 16px;">
              <div style="font-size: 13px; font-weight: 700; color: #1e293b;">
                ${rotulo}
              </div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;">
                📄 Arquivo Anexado: <strong>${doc.nome_original}</strong> (Formato PDF / Documento não rasterizável)
              </div>
            </div>
          `;
        }
      }).join('')}
    </div>
  ` : ''}

  <!-- Rodapé Geral de Auditoria -->
  <div class="footer-audit">
    <div>Dossiê gerado automaticamente pelo Sistema Integrado ATESA Cooperativa.</div>
    <div>Página de Auditoria e Conformidade · Autenticidade garantida por carimbo eletrônico.</div>
  </div>

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
