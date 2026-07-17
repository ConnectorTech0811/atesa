import React, { useEffect, useState } from 'react';
import { IonButton, IonModal } from '@ionic/react';
import { useAuth } from '../../auth/AuthContext';
import { Empresa } from '../../api/empresasApi';
import {
  AtividadeProposta,
  ContatoTrabalho,
  NovaAtividadeProposta,
  ParametrosTrabalho,
  Reuniao,
  ROTULO_STATUS_NEGOCIO,
  ROTULO_STATUS_TRABALHO,
  ROTULO_TIPO_CONTATO,
  StatusNegocio,
  StatusReuniao,
  StatusTrabalho,
  TipoInsalubridade,
  TipoEscala,
  Trabalho,
  TipoContato,
  adicionarAtividades,
  adicionarContato,
  agendarReuniao,
  atualizarDadosEmpresa,
  atualizarStatusReuniao,
  atualizarTrabalho,
  criarTrabalho,
  deletarAtividade,
  editarAtividade,
  listarAtividades,
  listarContatos,
  listarEmpresasExecutivo,
  listarReunioesPorEmpresa,
  listarTrabalhos,
  obterParametros,
  salvarParametros,
} from '../../api/executivoApi';
import { formatarCEP, formatarCNPJ, formatarDataBR, formatarTelefone } from '../../utils/formatters';
import { getAppName } from '../../theme/applyTheme';

type Aba = 'dados' | 'trabalhos' | 'reunioes';
type AbaTrabalho = 'contatos' | 'parametros' | 'propostas';

const STATUS_CORES: Record<StatusTrabalho, string> = {
  em_aberto: '#888',
  em_andamento: '#4a9e4f',
  proposta_enviada: '#1976d2',
  proposta_aceita: '#388e3c',
  fechado: '#555',
  cancelado: '#cf3c4f',
};

function dataHoje() {
  return new Date().toISOString().substring(0, 10);
}

function formatarDataHora(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

function formatarMoeda(valor?: number | null) {
  if (valor == null) return '-';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(v?: number | null, def = 0) { return (v ?? def) / 100; }

// Calcula o custo detalhado de uma atividade conforme a lógica da planilha Excel
function calcularDetalheAtividade(a: AtividadeProposta, p: ParametrosTrabalho) {
  const salario = a.salario_base ?? 0;
  const vrTotal = (a.vr_dias ?? 0) * (p.valor_vr_dia ?? 0);
  const vtTotal = (a.vt_dias ?? 0) * (p.valor_vt_dia ?? 0);
  const adicNoturno = a.adicional_noturno ? salario * 0.30 : 0;
  const pericVal = a.periculosidade ? salario * 0.30 : 0;
  const insolPct = a.insalubridade === 'pre' ? pct(p.insalubridade_pre_pct, 8)
    : a.insalubridade === 'media' ? pct(p.insalubridade_media_pct, 9)
    : a.insalubridade === 'maxima' ? pct(p.insalubridade_maxima_pct, 11)
    : 0;
  const insolVal = salario * insolPct;
  const premioIncentivo = a.premio_incentivo ?? 0;
  const dar = salario * pct(p.dar_percentual, 10);
  const seguroVida = salario * pct(p.seguro_vida_percentual, 1.5);
  const inss = salario * pct(p.inss_percentual, 20);
  const remuneracaoTotal = salario + vrTotal + vtTotal + adicNoturno + pericVal + insolVal + premioIncentivo + dar + seguroVida + inss;
  const pis = remuneracaoTotal * pct(p.pis_percentual, 0.65);
  const cofins = remuneracaoTotal * pct(p.cofins_percentual, 1.65);
  const iss = remuneracaoTotal * pct(p.iss_percentual, 2.5);
  const taxaAdm = remuneracaoTotal * pct(p.taxa_administrativa, 5);
  const totalVaga = remuneracaoTotal + pis + cofins + iss + taxaAdm;
  return { salario, vrTotal, vtTotal, adicNoturno, pericVal, insolVal, premioIncentivo, dar, seguroVida, inss, remuneracaoTotal, pis, cofins, iss, taxaAdm, totalVaga };
}

function calcularCustoAtividade(a: AtividadeProposta, p: ParametrosTrabalho) {
  return calcularDetalheAtividade(a, p).totalVaga * (a.quantidade ?? 1);
}

const ROTULO_INSALUBRIDADE: Record<TipoInsalubridade, string> = {
  sem_risco: 'Sem risco',
  pre: 'Pré (8%)',
  media: 'Média (9%)',
  maxima: 'Máxima (11%)',
};

const ROTULO_ESCALA: Record<TipoEscala, string> = {
  mensal: 'Mensal 12x36',
  plantao: 'Plantão 12x36',
};

// ── Geração do HTML da proposta para impressão ─────────────────────────────
function gerarHtmlProposta(empresa: Empresa | null, trabalho: Trabalho | null, params: ParametrosTrabalho, atividades: AtividadeProposta[], cooperativaNome: string) {
  const totalGeral = atividades.reduce((acc, a) => acc + calcularCustoAtividade(a, params), 0);

  const secaoCustoPorFuncao = atividades.map((a) => {
    const d = calcularDetalheAtividade(a, params);
    const linhaItem = (label: string, valor: number | null, pctStr?: string) => valor != null && valor !== 0
      ? `<tr><td>${label}${pctStr ? ` <span style="color:#888;font-size:10px">(${pctStr})</span>` : ''}</td><td style="text-align:right">${formatarMoeda(valor)}</td><td style="text-align:right">${formatarMoeda(valor * (a.quantidade ?? 1))}</td></tr>`
      : '';
    return `
      <div style="margin-bottom:28px;page-break-inside:avoid">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#2e6b32">
              <th style="color:#fff;padding:7px 10px;text-align:left;font-size:12px" colspan="3">
                ${a.cargo} — ${ROTULO_ESCALA[a.tipo_escala ?? 'mensal']}
              </th>
            </tr>
            <tr style="background:#f0f7f0">
              <th style="padding:5px 10px;text-align:left;font-size:11px">Item</th>
              <th style="padding:5px 10px;text-align:right;font-size:11px">Por vaga</th>
              <th style="padding:5px 10px;text-align:right;font-size:11px">Total (${a.quantidade} vaga${(a.quantidade ?? 1) > 1 ? 's' : ''})</th>
            </tr>
          </thead>
          <tbody style="font-size:11px">
            <tr><td style="padding:5px 10px">Remuneração Bruta</td><td style="text-align:right;padding:5px 10px">${formatarMoeda(d.salario)}</td><td style="text-align:right;padding:5px 10px">${formatarMoeda(d.salario * (a.quantidade ?? 1))}</td></tr>
            ${linhaItem('Auxílio Refeição (VR)', d.vrTotal)}
            ${linhaItem('Auxílio Transporte (VT)', d.vtTotal)}
            ${linhaItem('Adicional Noturno', d.adicNoturno, '30%')}
            ${linhaItem('Periculosidade', d.pericVal, '30%')}
            ${linhaItem('Insalubridade', d.insolVal, a.insalubridade !== 'sem_risco' ? ROTULO_INSALUBRIDADE[a.insalubridade ?? 'sem_risco'] : '')}
            ${linhaItem('Prêmio Incentivo', d.premioIncentivo)}
            ${linhaItem('D.A.R.', d.dar, `${params.dar_percentual ?? 10}%`)}
            ${linhaItem('Seguro de Vida', d.seguroVida, `${params.seguro_vida_percentual ?? 1.5}%`)}
            ${linhaItem('INSS', d.inss, `${params.inss_percentual ?? 20}%`)}
            <tr style="background:#f9f9f9;font-weight:600"><td style="padding:5px 10px">Remuneração Total</td><td style="text-align:right;padding:5px 10px">${formatarMoeda(d.remuneracaoTotal)}</td><td style="text-align:right;padding:5px 10px">${formatarMoeda(d.remuneracaoTotal * (a.quantidade ?? 1))}</td></tr>
            ${linhaItem('PIS', d.pis, `${params.pis_percentual ?? 0.65}%`)}
            ${linhaItem('COFINS', d.cofins, `${params.cofins_percentual ?? 1.65}%`)}
            ${linhaItem('ISS', d.iss, `${params.iss_percentual ?? 2.5}%`)}
            ${linhaItem('Taxa Administrativa', d.taxaAdm, `${params.taxa_administrativa ?? 5}%`)}
            <tr style="background:#2e6b32"><td style="color:#fff;font-weight:700;padding:6px 10px">TOTAL POR VAGA / TOTAL</td><td style="color:#fff;font-weight:700;text-align:right;padding:6px 10px">${formatarMoeda(d.totalVaga)}</td><td style="color:#fff;font-weight:700;text-align:right;padding:6px 10px">${formatarMoeda(d.totalVaga * (a.quantidade ?? 1))}</td></tr>
          </tbody>
        </table>
      </div>`;
  }).join('');

  const linhasValorTotal = atividades.map((a) => {
    const d = calcularDetalheAtividade(a, params);
    return `<tr>
      <td style="padding:6px 10px">${a.quantidade}</td>
      <td style="padding:6px 10px">${a.cargo}</td>
      <td style="text-align:right;padding:6px 10px">${formatarMoeda(d.salario)}</td>
      <td style="text-align:right;padding:6px 10px">${formatarMoeda(d.vrTotal + d.vtTotal)}</td>
      <td style="text-align:right;padding:6px 10px">${formatarMoeda(d.adicNoturno + d.pericVal + d.insolVal)}</td>
      <td style="text-align:right;padding:6px 10px">${formatarMoeda(d.premioIncentivo)}</td>
      <td style="text-align:right;padding:6px 10px">${formatarMoeda(d.remuneracaoTotal)}</td>
      <td style="text-align:right;padding:6px 10px">${formatarMoeda(d.dar + d.seguroVida + d.inss)}</td>
      <td style="text-align:right;padding:6px 10px">${formatarMoeda(d.taxaAdm)}</td>
      <td style="text-align:right;padding:6px 10px;font-weight:700;color:#2e6b32">${formatarMoeda(d.totalVaga * (a.quantidade ?? 1))}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Proposta Comercial — ${empresa?.nome_empresa ?? ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; background: #fff; padding: 40px 48px; }
    h1 { font-size: 22px; color: #2e6b32; margin-bottom: 4px; }
    h2 { font-size: 15px; color: #2e6b32; margin: 28px 0 8px; border-bottom: 2px solid #2e6b32; padding-bottom: 4px; }
    p { margin-bottom: 8px; line-height: 1.6; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 32px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #2e6b32; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .total-row td { font-weight: bold; border-top: 2px solid #2e6b32; background: #f0f7f0; }
    .assinatura { margin-top: 60px; display: flex; gap: 80px; }
    .assinatura-campo { flex: 1; border-top: 1px solid #333; padding-top: 6px; font-size: 11px; color: #555; }
    .cobranca-box { background: #fff8e1; border: 1px solid #ffc107; border-radius: 8px; padding: 14px 18px; margin-top: 12px; }
    @media print {
      body { padding: 20px 28px; }
      h2 { page-break-after: avoid; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Proposta Comercial</h1>
  <p class="subtitle">${cooperativaNome} — ${new Date().toLocaleDateString('pt-BR')}</p>

  <h2>Empresa</h2>
  <p><strong>${empresa?.nome_empresa ?? ''}</strong>${empresa?.cnpj ? ' — CNPJ: ' + empresa.cnpj : ''}</p>
  ${empresa?.representante ? `<p>Representante: ${empresa.representante}</p>` : ''}
  ${empresa?.email_empresa ? `<p>E-mail: ${empresa.email_empresa} | Tel.: ${empresa?.telefone_empresa ?? ''}</p>` : ''}

  ${params.quem_somos ? `<h2>Quem Somos</h2><p>${params.quem_somos.replace(/\n/g, '<br/>')}</p>` : ''}
  ${params.cooperativismo ? `<h2>Cooperativismo</h2><p>${params.cooperativismo.replace(/\n/g, '<br/>')}</p>` : ''}
  ${params.nossos_valores ? `<h2>Nossos Valores</h2><p>${params.nossos_valores.replace(/\n/g, '<br/>')}</p>` : ''}

  <h2>Custo por Função</h2>
  ${secaoCustoPorFuncao}

  <h2>Valor Total</h2>
  <div style="overflow-x:auto">
  <table>
    <thead>
      <tr>
        <th>Qtd.</th><th>Função</th><th style="text-align:right">Rem. Bruta</th>
        <th style="text-align:right">VR + VT</th><th style="text-align:right">Adic./Peric./Insalub.</th>
        <th style="text-align:right">Bônus</th><th style="text-align:right">Rem. Total</th>
        <th style="text-align:right">DAR+INSS+Seguro</th><th style="text-align:right">Taxa Adm.</th>
        <th style="text-align:right">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${linhasValorTotal}
      <tr class="total-row">
        <td colspan="9" style="padding:8px 10px">TOTAL GERAL</td>
        <td style="text-align:right;padding:8px 10px">${formatarMoeda(totalGeral)}</td>
      </tr>
    </tbody>
  </table>
  </div>

  ${params.cobranca ? `<h2>Condições de Cobrança</h2><div class="cobranca-box">${params.cobranca.replace(/\n/g, '<br/>')}</div>` : ''}

  <h2>Assinatura e Aprovação</h2>
  <div class="assinatura">
    <div class="assinatura-campo">Representante da empresa<br/><br/><br/>_______________________________<br/>${empresa?.representante ?? '_______________________________'}</div>
    <div class="assinatura-campo">Executivo de Contas — ${cooperativaNome}<br/><br/><br/>_______________________________<br/>Assinatura e carimbo</div>
  </div>
  <p style="margin-top: 16px; font-size: 10px; color: #aaa;">Proposta válida por 30 dias a partir da data de emissão.</p>

  <script>window.print();</script>
</body>
</html>`;
}

function novaAtividadeVazia(): NovaAtividadeProposta {
  return { cargo: '', quantidade: 1, salarioBase: undefined, vrDias: 0, vtDias: 0, adicionalNoturno: false, periculosidade: false, insalubridade: 'sem_risco', premioIncentivo: 0, tipoEscala: 'mensal' };
}

const PainelExecutivo: React.FC = () => {
  const { usuario } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');

  // Modal de ações
  const [showModal, setShowModal] = useState(false);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<Aba>('dados');
  const [erro, setErro] = useState('');

  // Aba Dados
  const [dadosEmpresa, setDadosEmpresa] = useState<Partial<Empresa>>({});
  const [salvandoDados, setSalvandoDados] = useState(false);

  // Aba Trabalhos
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [trabalhoExpandido, setTrabalhoExpandido] = useState<number | null>(null);
  const [trabalhoAtivo, setTrabalhoAtivo] = useState<Trabalho | null>(null);
  const [abaTrabalho, setAbaTrabalho] = useState<AbaTrabalho>('contatos');
  const [novoTituloTrabalho, setNovoTituloTrabalho] = useState('');
  const [mostrarFormTrabalho, setMostrarFormTrabalho] = useState(false);

  // Contatos do trabalho
  const [contatos, setContatos] = useState<ContatoTrabalho[]>([]);
  const [novoContato, setNovoContato] = useState({ tipo: '' as TipoContato | '', dataContato: '', observacoes: '', statusNegocio: '' as StatusNegocio | '' });
  const [alertaNegocioFechado, setAlertaNegocioFechado] = useState(false);
  const [showConfirmFechado, setShowConfirmFechado] = useState(false);

  // Parâmetros do trabalho
  const [parametros, setParametros] = useState<ParametrosTrabalho>({});
  const [salvandoParam, setSalvandoParam] = useState(false);

  // Proposta comercial
  const [atividades, setAtividades] = useState<AtividadeProposta[]>([]);
  const [novasAtividades, setNovasAtividades] = useState<NovaAtividadeProposta[]>([novaAtividadeVazia()]);
  const [editandoAtividade, setEditandoAtividade] = useState<AtividadeProposta | null>(null);
  const [mostrarFormAtividade, setMostrarFormAtividade] = useState(false);
  const [salvandoProposta, setSalvandoProposta] = useState(false);
  const [mostrarTaxasDetalhadas, setMostrarTaxasDetalhadas] = useState(false);
  const [propostaCarregada, setPropostaCarregada] = useState(false);

  // Aba Reuniões
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [novaReuniao, setNovaReuniao] = useState({ titulo: '', dataHora: '', localReuniao: '', observacoes: '', trabalhoId: '' });
  const [mostrarFormReuniao, setMostrarFormReuniao] = useState(false);

  const carregarEmpresas = async () => {
    setCarregando(true);
    setErroCarregamento('');
    try {
      const lista = await listarEmpresasExecutivo();
      setEmpresas(lista);
    } catch (e) {
      setErroCarregamento(e instanceof Error ? e.message : 'Erro ao carregar empresas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarEmpresas();
  }, []);

  // ── Abrir modal ──────────────────────────────────────────────────────────────
  const abrirAcoes = async (empresa: Empresa) => {
    setEmpresaSelecionada(empresa);
    setAbaAtiva('dados');
    setErro('');
    setDadosEmpresa({ ...empresa });
    setTrabalhos([]);
    setTrabalhoExpandido(null);
    setTrabalhoAtivo(null);
    setMostrarFormTrabalho(false);
    setMostrarFormReuniao(false);
    setShowModal(true);

    const [ts, rs] = await Promise.all([
      listarTrabalhos(empresa.id).catch(() => []),
      listarReunioesPorEmpresa(empresa.id).catch(() => []),
    ]);
    setTrabalhos(ts);
    setReunioes(rs);
  };

  // ── Aba Dados ────────────────────────────────────────────────────────────────
  const handleSalvarDados = async () => {
    if (!empresaSelecionada) return;
    setSalvandoDados(true);
    setErro('');
    try {
      const atualizada = await atualizarDadosEmpresa(empresaSelecionada.id, dadosEmpresa);
      setEmpresaSelecionada(atualizada);
      setEmpresas((prev) => prev.map((e) => (e.id === atualizada.id ? atualizada : e)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar dados.');
    } finally {
      setSalvandoDados(false);
    }
  };

  // ── Aba Trabalhos ────────────────────────────────────────────────────────────
  const handleCriarTrabalho = async () => {
    if (!empresaSelecionada || !novoTituloTrabalho.trim()) return;
    try {
      await criarTrabalho(empresaSelecionada.id, novoTituloTrabalho.trim());
      const lista = await listarTrabalhos(empresaSelecionada.id);
      setTrabalhos(lista);
      setNovoTituloTrabalho('');
      setMostrarFormTrabalho(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar trabalho.');
    }
  };

  const expandirTrabalho = async (trabalho: Trabalho) => {
    if (trabalhoExpandido === trabalho.id) {
      setTrabalhoExpandido(null);
      setTrabalhoAtivo(null);
      return;
    }
    setTrabalhoExpandido(trabalho.id);
    setTrabalhoAtivo(trabalho);
    setAbaTrabalho('contatos');
    const [cs, ps] = await Promise.all([
      listarContatos(trabalho.id).catch(() => []),
      obterParametros(trabalho.id).catch(() => ({})),
    ]);
    setContatos(cs);
    setParametros(ps ?? {});
    setNovoContato({ tipo: '', dataContato: '', observacoes: '', statusNegocio: '' });
    setAlertaNegocioFechado(false);
    setAtividades([]);
    setPropostaCarregada(false);
  };

  const handleAlterarStatusTrabalho = async (trabalho: Trabalho, status: StatusTrabalho) => {
    try {
      await atualizarTrabalho(trabalho.id, { status });
      setTrabalhos((prev) => prev.map((t) => (t.id === trabalho.id ? { ...t, status } : t)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar status.');
    }
  };

  const confirmarAdicionarContato = () => {
    if (!novoContato.tipo || !novoContato.dataContato || !novoContato.observacoes) {
      setErro('Preencha tipo, data e observações do contato.');
      return;
    }
    if (novoContato.statusNegocio === 'negocio_fechado') {
      setShowConfirmFechado(true);
      return;
    }
    executarAdicionarContato();
  };

  const executarAdicionarContato = async () => {
    const trabalhoId = trabalhoExpandido;
    if (!trabalhoId) return;
    setShowConfirmFechado(false);
    try {
      const resultado = await adicionarContato(trabalhoId, {
        tipo: novoContato.tipo as TipoContato,
        dataContato: novoContato.dataContato,
        observacoes: novoContato.observacoes,
        statusNegocio: (novoContato.statusNegocio as StatusNegocio) || undefined,
      });
      const cs = await listarContatos(trabalhoId);
      setContatos(cs);
      setNovoContato({ tipo: '', dataContato: '', observacoes: '', statusNegocio: '' });
      setErro('');

      if (resultado.negocioFechado) {
        setTrabalhos((prev) => prev.map((t) => t.id === trabalhoId ? { ...t, status: 'fechado' } : t));
        setTrabalhoAtivo((prev) => prev ? { ...prev, status: 'fechado' } : prev);
        setAbaTrabalho('parametros');
        setAlertaNegocioFechado(true);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar contato.');
    }
  };

  const buildParamsPayload = () => ({
    ...parametros,
    taxaAdministrativa: parametros.taxa_administrativa,
    encargos: parametros.encargos_sociais,
    margemLucro: parametros.margem_lucro,
    taxaRisco: parametros.taxa_risco,
    descricaoCargo: parametros.descricao_cargo,
    localTrabalho: parametros.local_trabalho,
    quemSomos: parametros.quem_somos,
    nossosValores: parametros.nossos_valores,
    darPercentual: parametros.dar_percentual,
    seguroVidaPercentual: parametros.seguro_vida_percentual,
    inssPercentual: parametros.inss_percentual,
    pisPercentual: parametros.pis_percentual,
    cofinsPercentual: parametros.cofins_percentual,
    issPercentual: parametros.iss_percentual,
    valorVrDia: parametros.valor_vr_dia,
    valorVtDia: parametros.valor_vt_dia,
    insalubridadePrePct: parametros.insalubridade_pre_pct,
    insalubridadeMediaPct: parametros.insalubridade_media_pct,
    insalubridadeMaximaPct: parametros.insalubridade_maxima_pct,
  } as any);

  const handleSalvarParametros = async (trabalhoId: number) => {
    setSalvandoParam(true);
    try {
      await salvarParametros(trabalhoId, buildParamsPayload());
      setSalvandoParam(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar parâmetros.');
      setSalvandoParam(false);
    }
  };

  // ── Proposta Comercial ───────────────────────────────────────────────────────
  const carregarProposta = async (trabalho: Trabalho) => {
    if (propostaCarregada) return;
    const [ps, as] = await Promise.all([
      obterParametros(trabalho.id).catch(() => ({})),
      listarAtividades(trabalho.id).catch(() => []),
    ]);
    setParametros(ps ?? {});
    setAtividades(as);
    const numAtividades = as.length;
    if (numAtividades < 2) {
      setNovasAtividades(Array.from({ length: 2 - numAtividades }, () => novaAtividadeVazia()));
    } else {
      setNovasAtividades([novaAtividadeVazia()]);
    }
    setMostrarFormAtividade(numAtividades < 2);
    setEditandoAtividade(null);
    setPropostaCarregada(true);
  };

  const handleAdicionarAtividades = async () => {
    if (!trabalhoAtivo) return;
    const validas = novasAtividades.filter((a) => a.cargo.trim());
    if (validas.length === 0) return;
    try {
      await adicionarAtividades(trabalhoAtivo.id, validas);
      const lista = await listarAtividades(trabalhoAtivo.id);
      setAtividades(lista);
      setNovasAtividades([novaAtividadeVazia()]);
      setMostrarFormAtividade(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao adicionar atividades.');
    }
  };

  const adicionarLinhaAtividade = () => {
    if (novasAtividades.length >= 6) return;
    setNovasAtividades((prev) => [...prev, novaAtividadeVazia()]);
  };

  const removerLinhaAtividade = (idx: number) => {
    setNovasAtividades((prev) => prev.filter((_, i) => i !== idx));
  };

  const atualizarLinhaAtividade = (idx: number, campo: keyof NovaAtividadeProposta, valor: any) => {
    setNovasAtividades((prev) => prev.map((a, i) => i === idx ? { ...a, [campo]: valor } : a));
  };

  const handleSalvarEdicaoAtividade = async () => {
    if (!trabalhoAtivo || !editandoAtividade) return;
    try {
      await editarAtividade(trabalhoAtivo.id, editandoAtividade.id, {
        cargo: editandoAtividade.cargo,
        descricao: editandoAtividade.descricao,
        quantidade: editandoAtividade.quantidade,
        salarioBase: editandoAtividade.salario_base,
        vrDias: editandoAtividade.vr_dias,
        vtDias: editandoAtividade.vt_dias,
        adicionalNoturno: editandoAtividade.adicional_noturno,
        periculosidade: editandoAtividade.periculosidade,
        insalubridade: editandoAtividade.insalubridade,
        premioIncentivo: editandoAtividade.premio_incentivo,
        tipoEscala: editandoAtividade.tipo_escala,
      });
      const lista = await listarAtividades(trabalhoAtivo.id);
      setAtividades(lista);
      setEditandoAtividade(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao editar atividade.');
    }
  };

  const handleRemoverAtividade = async (id: number) => {
    if (!trabalhoAtivo) return;
    try {
      await deletarAtividade(trabalhoAtivo.id, id);
      setAtividades((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover atividade.');
    }
  };

  const handleSalvarProposta = async () => {
    if (!trabalhoAtivo) return;
    setSalvandoProposta(true);
    try {
      await salvarParametros(trabalhoAtivo.id, buildParamsPayload());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar proposta.');
    } finally {
      setSalvandoProposta(false);
    }
  };

  const handleImprimirProposta = (trabalho: Trabalho) => {
    const html = gerarHtmlProposta(empresaSelecionada, trabalho, parametros, atividades, getAppName());
    const janela = window.open('', '_blank');
    if (!janela) { alert('Permita pop-ups para gerar o PDF.'); return; }
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
  };

  // ── Aba Reuniões ─────────────────────────────────────────────────────────────
  const handleAgendarReuniao = async () => {
    if (!empresaSelecionada || !novaReuniao.titulo || !novaReuniao.dataHora) {
      setErro('Informe o título e a data/hora da reunião.');
      return;
    }
    try {
      await agendarReuniao({
        empresaId: empresaSelecionada.id,
        titulo: novaReuniao.titulo,
        dataHora: novaReuniao.dataHora,
        localReuniao: novaReuniao.localReuniao || undefined,
        observacoes: novaReuniao.observacoes || undefined,
        trabalhoId: novaReuniao.trabalhoId ? Number(novaReuniao.trabalhoId) : undefined,
      });
      const rs = await listarReunioesPorEmpresa(empresaSelecionada.id);
      setReunioes(rs);
      setNovaReuniao({ titulo: '', dataHora: '', localReuniao: '', observacoes: '', trabalhoId: '' });
      setMostrarFormReuniao(false);
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao agendar reunião.');
    }
  };

  const handleAlterarStatusReuniao = async (id: number, status: StatusReuniao) => {
    try {
      await atualizarStatusReuniao(id, status);
      setReunioes((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar reunião.');
    }
  };

  // Formulário de nova atividade — campos detalhados
  const renderFormNovaAtividade = (a: NovaAtividadeProposta, idx: number) => (
    <div key={idx} style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
      <div className="form-row" style={{ alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
        <div className="form-field" style={{ flex: 2, marginBottom: 0 }}>
          <label>Cargo / Função *</label>
          <input className="form-input" placeholder="Ex: Auxiliar de Produção" value={a.cargo} onChange={(e) => atualizarLinhaAtividade(idx, 'cargo', e.target.value)} />
        </div>
        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
          <label>Qtd.</label>
          <input className="form-input" type="number" min={1} value={a.quantidade} onChange={(e) => atualizarLinhaAtividade(idx, 'quantidade', Number(e.target.value) || 1)} />
        </div>
        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
          <label>Tipo de escala</label>
          <select className="form-input" value={a.tipoEscala ?? 'mensal'} onChange={(e) => atualizarLinhaAtividade(idx, 'tipoEscala', e.target.value as TipoEscala)}>
            <option value="mensal">Mensal 12x36</option>
            <option value="plantao">Plantão 12x36</option>
          </select>
        </div>
        <div style={{ paddingBottom: 2, display: 'flex', gap: 4 }}>
          {novasAtividades.length > 1 && (
            <button style={{ background: '#f5f5f5', border: 'none', borderRadius: 6, padding: '0 8px', height: 36, cursor: 'pointer', color: '#cf3c4f', fontSize: 14 }} onClick={() => removerLinhaAtividade(idx)}>✕</button>
          )}
        </div>
      </div>
      <div className="form-row" style={{ gap: 8, marginBottom: 0 }}>
        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
          <label>Salário Base (R$)</label>
          <input className="form-input" type="number" step="0.01" min={0} placeholder="0,00" value={a.salarioBase ?? ''} onChange={(e) => atualizarLinhaAtividade(idx, 'salarioBase', Number(e.target.value) || undefined)} />
        </div>
        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
          <label>Dias VR/mês</label>
          <input className="form-input" type="number" step="0.5" min={0} value={a.vrDias ?? 0} onChange={(e) => atualizarLinhaAtividade(idx, 'vrDias', Number(e.target.value))} />
        </div>
        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
          <label>Dias VT/mês</label>
          <input className="form-input" type="number" step="0.5" min={0} value={a.vtDias ?? 0} onChange={(e) => atualizarLinhaAtividade(idx, 'vtDias', Number(e.target.value))} />
        </div>
        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
          <label>Prêmio Incentivo</label>
          <input className="form-input" type="number" step="0.01" min={0} value={a.premioIncentivo ?? 0} onChange={(e) => atualizarLinhaAtividade(idx, 'premioIncentivo', Number(e.target.value))} />
        </div>
        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
          <label>Insalubridade</label>
          <select className="form-input" value={a.insalubridade ?? 'sem_risco'} onChange={(e) => atualizarLinhaAtividade(idx, 'insalubridade', e.target.value as TipoInsalubridade)}>
            <option value="sem_risco">Sem risco</option>
            <option value="pre">Pré (8%)</option>
            <option value="media">Média (9%)</option>
            <option value="maxima">Máxima (11%)</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
        <label className="form-checkbox-row" style={{ margin: 0 }}>
          <input type="checkbox" checked={!!a.adicionalNoturno} onChange={(e) => atualizarLinhaAtividade(idx, 'adicionalNoturno', e.target.checked)} />
          Adicional Noturno (30%)
        </label>
        <label className="form-checkbox-row" style={{ margin: 0 }}>
          <input type="checkbox" checked={!!a.periculosidade} onChange={(e) => atualizarLinhaAtividade(idx, 'periculosidade', e.target.checked)} />
          Periculosidade (30%)
        </label>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Meus Clientes</h1>
          <p className="painel-subtitle">Empresas atribuídas a {usuario?.nome}</p>
        </div>
        <IonButton className="btn-acao" shape="round" color="secondary" onClick={carregarEmpresas}>
          Atualizar
        </IonButton>
      </div>

      {erroCarregamento && (
        <div className="painel-vazio">
          {erroCarregamento}
          <div style={{ marginTop: 12 }}>
            <IonButton size="small" fill="outline" onClick={carregarEmpresas}>Tentar novamente</IonButton>
          </div>
        </div>
      )}

      {!erroCarregamento && (
        <div className="painel-lista">
          {!carregando && empresas.length === 0 && (
            <div className="painel-vazio">Nenhuma empresa atribuída a você ainda.</div>
          )}
          {empresas.map((empresa) => (
            <div key={empresa.id} className="painel-card">
              <div className="painel-card-info">
                <div className="painel-card-titulo">
                  <h3>{empresa.nome_empresa}</h3>
                  {empresa.regiao_nome && <span className="painel-tag">{empresa.regiao_nome}</span>}
                  <span className="painel-tag" style={{ background: '#e8f0fe', color: '#1976d2' }}>{empresa.status}</span>
                  {!!empresa.tem_alerta && (
                    <span title="Negócio frustrado há mais de 2 meses — hora de retomar o contato" style={{ background: '#fff3e0', color: '#e65100', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, border: '1px solid #ffb74d' }}>
                      ⚠ Retomar contato
                    </span>
                  )}
                </div>
                <p className="painel-detalhe">Consultor: {empresa.consultor_nome || '-'}</p>
                <p className="painel-detalhe">Telefone: {empresa.telefone_empresa}</p>
                <p className="painel-detalhe">E-mail: {empresa.email_empresa}</p>
                {empresa.data_primeiro_contato && (
                  <p className="painel-detalhe">1º Contato: {formatarDataBR(empresa.data_primeiro_contato)}</p>
                )}
              </div>
              <div className="painel-card-acoes">
                <button className="btn-secundario" onClick={() => abrirAcoes(empresa)}>Ações</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de confirmação: negócio fechado ── */}
      <IonModal className="modal-pequeno" isOpen={showConfirmFechado} onDidDismiss={() => setShowConfirmFechado(false)}>
        <div className="modal-form" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
          <h2 style={{ marginBottom: 8 }}>Confirmar negócio fechado?</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
            Esta ação marcará o trabalho como <strong>FECHADO</strong>. O sistema irá gerar a aprovação do contrato e abrir a aba de Parâmetros para você completar os dados do processo.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <IonButton fill="outline" shape="round" onClick={() => setShowConfirmFechado(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={executarAdicionarContato}>Confirmar e fechar negócio</IonButton>
          </div>
        </div>
      </IonModal>

      {/* ── Modal principal de ações ── */}
      <IonModal className="modal-grande" isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <div className="modal-form" style={{ padding: '24px 28px' }}>
          <h2 style={{ marginBottom: 4 }}>{empresaSelecionada?.nome_empresa}</h2>
          <p className="painel-subtitle" style={{ marginBottom: 16 }}>{empresaSelecionada?.status}</p>

          <div className="exec-abas">
            {(['dados', 'trabalhos', 'reunioes'] as Aba[]).map((aba) => (
              <button
                key={aba}
                className={`exec-aba${abaAtiva === aba ? ' exec-aba-ativa' : ''}`}
                onClick={() => { setAbaAtiva(aba); setErro(''); }}
              >
                {aba === 'dados' ? 'Dados' : aba === 'trabalhos' ? 'Trabalhos' : 'Reuniões'}
              </button>
            ))}
          </div>

          {erro && <p className="form-erro" style={{ marginTop: 8 }}>{erro}</p>}

          {/* ── Aba Dados ── */}
          {abaAtiva === 'dados' && (
            <div style={{ marginTop: 16 }}>
              <div className="form-row">
                <div className="form-field">
                  <label>Nome da empresa *</label>
                  <input className="form-input" value={dadosEmpresa.nome_empresa ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, nome_empresa: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Telefone *</label>
                  <input className="form-input" value={dadosEmpresa.telefone_empresa ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, telefone_empresa: formatarTelefone(e.target.value) }))} />
                </div>
                <div className="form-field">
                  <label>E-mail *</label>
                  <input className="form-input" type="email" value={dadosEmpresa.email_empresa ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, email_empresa: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>CNPJ</label>
                  <input className="form-input" value={dadosEmpresa.cnpj ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, cnpj: formatarCNPJ(e.target.value) }))} />
                </div>
                <div className="form-field">
                  <label>Representante</label>
                  <input className="form-input" value={dadosEmpresa.representante ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, representante: e.target.value }))} />
                </div>
              </div>
              <div className="form-section-title">Endereço</div>
              <div className="form-row">
                <div className="form-field form-field-small">
                  <label>CEP</label>
                  <input className="form-input" value={dadosEmpresa.cep ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, cep: formatarCEP(e.target.value) }))} />
                </div>
                <div className="form-field"><label>Rua</label><input className="form-input" value={dadosEmpresa.rua ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, rua: e.target.value }))} /></div>
                <div className="form-field form-field-small"><label>Número</label><input className="form-input" value={dadosEmpresa.numero ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, numero: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>Bairro</label><input className="form-input" value={dadosEmpresa.bairro ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, bairro: e.target.value }))} /></div>
                <div className="form-field"><label>Cidade</label><input className="form-input" value={dadosEmpresa.cidade ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, cidade: e.target.value }))} /></div>
                <div className="form-field form-field-small"><label>UF</label><input className="form-input" maxLength={2} value={dadosEmpresa.uf ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, uf: e.target.value.toUpperCase() }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Status</label>
                  <select className="form-input" value={dadosEmpresa.status ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, status: e.target.value }))}>
                    {['Primeiro Contato', 'Em negociação', 'Proposta enviada', 'Cliente ativo', 'Inativo'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Data 1º Contato</label>
                  <input className="form-input" type="date" max={dataHoje()} value={dadosEmpresa.data_primeiro_contato?.substring(0, 10) ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, data_primeiro_contato: e.target.value }))} />
                </div>
              </div>
              <div className="modal-acoes">
                <IonButton fill="outline" shape="round" onClick={() => setShowModal(false)}>Fechar</IonButton>
                <IonButton shape="round" color="secondary" onClick={handleSalvarDados} disabled={salvandoDados}>
                  {salvandoDados ? 'Salvando...' : 'Salvar dados'}
                </IonButton>
              </div>
            </div>
          )}

          {/* ── Aba Trabalhos ── */}
          {abaAtiva === 'trabalhos' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Jobs / Processos</span>
                <button className="btn-secundario" onClick={() => setMostrarFormTrabalho((v) => !v)}>+ Novo</button>
              </div>

              {mostrarFormTrabalho && (
                <div className="form-alerta" style={{ marginBottom: 12 }}>
                  <div className="form-field" style={{ marginBottom: 8 }}>
                    <label>Título do trabalho</label>
                    <input className="form-input" value={novoTituloTrabalho} onChange={(e) => setNovoTituloTrabalho(e.target.value)} placeholder="Ex: Contratação de 5 cooperados — Produção" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <IonButton size="small" shape="round" color="secondary" onClick={handleCriarTrabalho}>Criar</IonButton>
                    <IonButton size="small" shape="round" fill="outline" onClick={() => setMostrarFormTrabalho(false)}>Cancelar</IonButton>
                  </div>
                </div>
              )}

              {trabalhos.length === 0 && <p className="painel-vazio">Nenhum trabalho ainda.</p>}

              {trabalhos.map((trabalho) => (
                <div key={trabalho.id} className="exec-trabalho-card">
                  <div className="exec-trabalho-header" onClick={() => expandirTrabalho(trabalho)}>
                    <div>
                      <strong>{trabalho.titulo}</strong>
                      <span className="exec-status-badge" style={{ background: STATUS_CORES[trabalho.status] + '22', color: STATUS_CORES[trabalho.status], border: `1px solid ${STATUS_CORES[trabalho.status]}` }}>
                        {ROTULO_STATUS_TRABALHO[trabalho.status]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        className="form-input"
                        style={{ width: 'auto', height: 32, fontSize: 12, padding: '0 8px' }}
                        value={trabalho.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleAlterarStatusTrabalho(trabalho, e.target.value as StatusTrabalho)}
                      >
                        {(Object.keys(ROTULO_STATUS_TRABALHO) as StatusTrabalho[]).map((s) => (
                          <option key={s} value={s}>{ROTULO_STATUS_TRABALHO[s]}</option>
                        ))}
                      </select>
                      <span style={{ color: '#4a9e4f', fontSize: 18 }}>{trabalhoExpandido === trabalho.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {trabalhoExpandido === trabalho.id && (
                    <div className="exec-trabalho-body">
                      <div className="exec-abas" style={{ marginBottom: 12 }}>
                        <button className={`exec-aba${abaTrabalho === 'contatos' ? ' exec-aba-ativa' : ''}`} onClick={() => setAbaTrabalho('contatos')}>Contatos</button>
                        <button className={`exec-aba${abaTrabalho === 'parametros' ? ' exec-aba-ativa' : ''}`} onClick={() => setAbaTrabalho('parametros')}>Parâmetros</button>
                        <button className={`exec-aba${abaTrabalho === 'propostas' ? ' exec-aba-ativa' : ''}`} onClick={() => { setAbaTrabalho('propostas'); carregarProposta(trabalho); }}>Proposta</button>
                      </div>

                      {/* Contatos do trabalho */}
                      {abaTrabalho === 'contatos' && (
                        <div>
                          <div className="form-row">
                            <div className="form-field">
                              <label>Tipo</label>
                              <select className="form-input" value={novoContato.tipo} onChange={(e) => setNovoContato((p) => ({ ...p, tipo: e.target.value as TipoContato }))}>
                                <option value="">Selecione</option>
                                {(Object.keys(ROTULO_TIPO_CONTATO) as TipoContato[]).map((t) => (
                                  <option key={t} value={t}>{ROTULO_TIPO_CONTATO[t]}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-field">
                              <label>Data</label>
                              <input className="form-input" type="date" max={dataHoje()} value={novoContato.dataContato} onChange={(e) => setNovoContato((p) => ({ ...p, dataContato: e.target.value }))} />
                            </div>
                            <div className="form-field">
                              <label>Status do negócio</label>
                              <select className="form-input" value={novoContato.statusNegocio} onChange={(e) => setNovoContato((p) => ({ ...p, statusNegocio: e.target.value as StatusNegocio | '' }))}>
                                <option value="">Selecione</option>
                                {(Object.keys(ROTULO_STATUS_NEGOCIO) as StatusNegocio[]).map((s) => (
                                  <option key={s} value={s}>{ROTULO_STATUS_NEGOCIO[s]}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="form-field">
                            <label>Observações</label>
                            <textarea className="form-input form-textarea" rows={2} value={novoContato.observacoes} onChange={(e) => setNovoContato((p) => ({ ...p, observacoes: e.target.value }))} />
                          </div>
                          <IonButton size="small" shape="round" color="secondary" onClick={confirmarAdicionarContato}>Registrar</IonButton>

                          {alertaNegocioFechado && (
                            <div style={{ background: '#e8f5e9', border: '1px solid #4a9e4f', borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 13, color: '#2e7d32' }}>
                              ✅ <strong>Negócio fechado!</strong> O trabalho foi marcado como fechado. Acesse a aba <strong>Parâmetros</strong> para revisar e completar os dados do processo.
                              <button style={{ marginLeft: 12, fontSize: 11, color: '#4a9e4f', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }} onClick={() => setAlertaNegocioFechado(false)}>✕</button>
                            </div>
                          )}

                          <div className="historico-lista" style={{ marginTop: 12 }}>
                            {contatos.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Nenhum contato registrado.</p>}
                            {contatos.map((c) => (
                              <div key={c.id} className="historico-item">
                                <span className="historico-data">{ROTULO_TIPO_CONTATO[c.tipo]} — {formatarDataBR(c.data_contato)}</span>
                                {c.status_negocio && (
                                  <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 8, padding: '1px 8px', borderRadius: 8, background: c.status_negocio === 'negocio_fechado' ? '#e8f5e9' : c.status_negocio === 'negocio_frustrado' ? '#fff3e0' : '#e8f0fe', color: c.status_negocio === 'negocio_fechado' ? '#2e7d32' : c.status_negocio === 'negocio_frustrado' ? '#e65100' : '#1565c0' }}>
                                    {ROTULO_STATUS_NEGOCIO[c.status_negocio] ?? c.status_negocio}
                                  </span>
                                )}
                                {c.alerta_em && <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>Alerta: {formatarDataBR(c.alerta_em)}</span>}
                                <p>{c.observacoes}</p>
                                <p className="historico-autor">Registrado por: {c.registrado_por_nome}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Parâmetros do trabalho */}
                      {abaTrabalho === 'parametros' && (
                        <div>
                          <div className="form-row">
                            <div className="form-field">
                              <label>Cargo / Função</label>
                              <input className="form-input" value={parametros.cargo ?? ''} onChange={(e) => setParametros((p) => ({ ...p, cargo: e.target.value }))} />
                            </div>
                            <div className="form-field form-field-small">
                              <label>Quantidade de vagas</label>
                              <input className="form-input" type="number" min={1} value={parametros.quantidade ?? ''} onChange={(e) => setParametros((p) => ({ ...p, quantidade: Number(e.target.value) || undefined }))} />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-field">
                              <label>Salário (R$)</label>
                              <input className="form-input" type="number" step="0.01" value={parametros.salario ?? ''} onChange={(e) => setParametros((p) => ({ ...p, salario: Number(e.target.value) || undefined }))} />
                            </div>
                            <div className="form-field">
                              <label>Local de trabalho</label>
                              <input className="form-input" value={parametros.local_trabalho ?? ''} onChange={(e) => setParametros((p) => ({ ...p, local_trabalho: e.target.value }))} />
                            </div>
                            <div className="form-field">
                              <label>Horário</label>
                              <input className="form-input" value={parametros.horario ?? ''} placeholder="Ex: 08:00-17:00" onChange={(e) => setParametros((p) => ({ ...p, horario: e.target.value }))} />
                            </div>
                          </div>
                          <div className="form-field">
                            <label>Descrição do cargo</label>
                            <textarea className="form-input form-textarea" rows={3} value={parametros.descricao_cargo ?? ''} onChange={(e) => setParametros((p) => ({ ...p, descricao_cargo: e.target.value }))} />
                          </div>
                          <div className="form-field">
                            <label>Requisitos</label>
                            <textarea className="form-input form-textarea" rows={2} value={parametros.requisitos ?? ''} onChange={(e) => setParametros((p) => ({ ...p, requisitos: e.target.value }))} />
                          </div>
                          <div className="form-field">
                            <label>Benefícios</label>
                            <textarea className="form-input form-textarea" rows={2} value={parametros.beneficios ?? ''} onChange={(e) => setParametros((p) => ({ ...p, beneficios: e.target.value }))} />
                          </div>
                          <div className="form-field">
                            <label>Observações internas</label>
                            <textarea className="form-input form-textarea" rows={2} value={parametros.observacoes ?? ''} onChange={(e) => setParametros((p) => ({ ...p, observacoes: e.target.value }))} />
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                            <IonButton size="small" shape="round" color="secondary" onClick={() => handleSalvarParametros(trabalho.id)} disabled={salvandoParam}>
                              {salvandoParam ? 'Salvando...' : 'Salvar parâmetros'}
                            </IonButton>
                          </div>
                        </div>
                      )}

                      {/* ── Aba Propostas ── */}
                      {abaTrabalho === 'propostas' && (
                        <div>
                          {/* Cabeçalho com ações */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span style={{ fontSize: 13, color: '#888' }}>{empresaSelecionada?.nome_empresa} — {trabalho.titulo}</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <IonButton size="small" shape="round" color="secondary" onClick={handleSalvarProposta} disabled={salvandoProposta}>
                                {salvandoProposta ? 'Salvando...' : 'Salvar'}
                              </IonButton>
                              <IonButton size="small" shape="round" fill="outline" color="secondary" onClick={() => handleImprimirProposta(trabalho)}>
                                🖨️ Imprimir / PDF
                              </IonButton>
                            </div>
                          </div>

                          {/* Texto institucional */}
                          <div className="form-section-title">Texto Institucional</div>
                          <div className="form-field">
                            <label>Quem Somos</label>
                            <textarea className="form-input form-textarea" rows={3} placeholder="Descreva a cooperativa..." value={parametros.quem_somos ?? ''} onChange={(e) => setParametros((p) => ({ ...p, quem_somos: e.target.value }))} />
                          </div>
                          <div className="form-field">
                            <label>Cooperativismo</label>
                            <textarea className="form-input form-textarea" rows={3} placeholder="O que é cooperativismo..." value={parametros.cooperativismo ?? ''} onChange={(e) => setParametros((p) => ({ ...p, cooperativismo: e.target.value }))} />
                          </div>
                          <div className="form-field">
                            <label>Nossos Valores</label>
                            <textarea className="form-input form-textarea" rows={3} placeholder="Valores da cooperativa..." value={parametros.nossos_valores ?? ''} onChange={(e) => setParametros((p) => ({ ...p, nossos_valores: e.target.value }))} />
                          </div>

                          {/* Parâmetros da planilha */}
                          <div className="form-section-title" style={{ marginTop: 20 }}>
                            Parâmetros da Planilha (Taxas)
                            <button style={{ marginLeft: 12, fontSize: 11, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textTransform: 'none' as const, letterSpacing: 0 }} onClick={() => setMostrarTaxasDetalhadas((v) => !v)}>
                              {mostrarTaxasDetalhadas ? '▲ Ocultar' : '▼ Ver todas as taxas'}
                            </button>
                          </div>
                          <div className="form-row">
                            <div className="form-field form-field-small">
                              <label>Taxa Administrativa (%)</label>
                              <input className="form-input" type="number" step="0.01" min={0} max={100} value={parametros.taxa_administrativa ?? 5} onChange={(e) => setParametros((p) => ({ ...p, taxa_administrativa: Number(e.target.value) }))} />
                            </div>
                            <div className="form-field form-field-small">
                              <label>Valor VR/dia (R$)</label>
                              <input className="form-input" type="number" step="0.01" min={0} value={parametros.valor_vr_dia ?? 0} onChange={(e) => setParametros((p) => ({ ...p, valor_vr_dia: Number(e.target.value) }))} />
                            </div>
                            <div className="form-field form-field-small">
                              <label>Valor VT/dia (R$)</label>
                              <input className="form-input" type="number" step="0.01" min={0} value={parametros.valor_vt_dia ?? 0} onChange={(e) => setParametros((p) => ({ ...p, valor_vt_dia: Number(e.target.value) }))} />
                            </div>
                          </div>
                          {mostrarTaxasDetalhadas && (
                            <>
                              <div className="form-row">
                                <div className="form-field form-field-small"><label>D.A.R. (%)</label><input className="form-input" type="number" step="0.01" min={0} value={parametros.dar_percentual ?? 10} onChange={(e) => setParametros((p) => ({ ...p, dar_percentual: Number(e.target.value) }))} /></div>
                                <div className="form-field form-field-small"><label>Seguro de Vida (%)</label><input className="form-input" type="number" step="0.01" min={0} value={parametros.seguro_vida_percentual ?? 1.5} onChange={(e) => setParametros((p) => ({ ...p, seguro_vida_percentual: Number(e.target.value) }))} /></div>
                                <div className="form-field form-field-small"><label>INSS Patronal (%)</label><input className="form-input" type="number" step="0.01" min={0} value={parametros.inss_percentual ?? 20} onChange={(e) => setParametros((p) => ({ ...p, inss_percentual: Number(e.target.value) }))} /></div>
                                <div className="form-field form-field-small"><label>PIS (%)</label><input className="form-input" type="number" step="0.001" min={0} value={parametros.pis_percentual ?? 0.65} onChange={(e) => setParametros((p) => ({ ...p, pis_percentual: Number(e.target.value) }))} /></div>
                                <div className="form-field form-field-small"><label>COFINS (%)</label><input className="form-input" type="number" step="0.001" min={0} value={parametros.cofins_percentual ?? 1.65} onChange={(e) => setParametros((p) => ({ ...p, cofins_percentual: Number(e.target.value) }))} /></div>
                                <div className="form-field form-field-small"><label>ISS (%)</label><input className="form-input" type="number" step="0.01" min={0} value={parametros.iss_percentual ?? 2.5} onChange={(e) => setParametros((p) => ({ ...p, iss_percentual: Number(e.target.value) }))} /></div>
                              </div>
                              <div className="form-row">
                                <div className="form-field form-field-small"><label>Insalub. Pré (%)</label><input className="form-input" type="number" step="0.01" min={0} value={parametros.insalubridade_pre_pct ?? 8} onChange={(e) => setParametros((p) => ({ ...p, insalubridade_pre_pct: Number(e.target.value) }))} /></div>
                                <div className="form-field form-field-small"><label>Insalub. Média (%)</label><input className="form-input" type="number" step="0.01" min={0} value={parametros.insalubridade_media_pct ?? 9} onChange={(e) => setParametros((p) => ({ ...p, insalubridade_media_pct: Number(e.target.value) }))} /></div>
                                <div className="form-field form-field-small"><label>Insalub. Máxima (%)</label><input className="form-input" type="number" step="0.01" min={0} value={parametros.insalubridade_maxima_pct ?? 11} onChange={(e) => setParametros((p) => ({ ...p, insalubridade_maxima_pct: Number(e.target.value) }))} /></div>
                              </div>
                            </>
                          )}

                          {/* Custo por função */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
                            <div className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Custo por Função</div>
                            <button className="btn-secundario" onClick={() => { setMostrarFormAtividade(true); setNovasAtividades([novaAtividadeVazia()]); }}>+ Adicionar</button>
                          </div>

                          {mostrarFormAtividade && (
                            <div className="form-alerta" style={{ marginBottom: 16 }}>
                              <p style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>Adicione de 1 a 6 funções de uma vez:</p>
                              {novasAtividades.map((a, idx) => renderFormNovaAtividade(a, idx))}
                              {novasAtividades.length < 6 && (
                                <button style={{ background: '#e8f5e9', border: '1px dashed #4a9e4f', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#2e7d32', width: '100%', marginBottom: 10 }} onClick={adicionarLinhaAtividade}>
                                  + Adicionar outra função
                                </button>
                              )}
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <IonButton size="small" shape="round" color="secondary" onClick={handleAdicionarAtividades}>Adicionar</IonButton>
                                <IonButton size="small" shape="round" fill="outline" onClick={() => setMostrarFormAtividade(false)}>Cancelar</IonButton>
                              </div>
                            </div>
                          )}

                          {/* Lista de funções */}
                          {atividades.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              {atividades.map((a) => {
                                const d = calcularDetalheAtividade(a, parametros);
                                const isEditing = editandoAtividade?.id === a.id;
                                if (isEditing && editandoAtividade) {
                                  return (
                                    <div key={a.id} style={{ background: '#f0f7f0', border: '1px solid #4a9e4f', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                                      <div className="form-row" style={{ gap: 8, marginBottom: 4 }}>
                                        <div className="form-field" style={{ flex: 2, marginBottom: 0 }}>
                                          <label>Cargo *</label>
                                          <input className="form-input" value={editandoAtividade.cargo} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, cargo: e.target.value } : p)} />
                                        </div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
                                          <label>Qtd.</label>
                                          <input className="form-input" type="number" min={1} value={editandoAtividade.quantidade} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, quantidade: Number(e.target.value) || 1 } : p)} />
                                        </div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
                                          <label>Escala</label>
                                          <select className="form-input" value={editandoAtividade.tipo_escala ?? 'mensal'} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, tipo_escala: e.target.value as TipoEscala } : p)}>
                                            <option value="mensal">Mensal 12x36</option>
                                            <option value="plantao">Plantão 12x36</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="form-row" style={{ gap: 8, marginBottom: 4 }}>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}><label>Salário Base (R$)</label><input className="form-input" type="number" step="0.01" value={editandoAtividade.salario_base ?? ''} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, salario_base: Number(e.target.value) || undefined } : p)} /></div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}><label>Dias VR</label><input className="form-input" type="number" step="0.5" min={0} value={editandoAtividade.vr_dias ?? 0} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, vr_dias: Number(e.target.value) } : p)} /></div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}><label>Dias VT</label><input className="form-input" type="number" step="0.5" min={0} value={editandoAtividade.vt_dias ?? 0} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, vt_dias: Number(e.target.value) } : p)} /></div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}><label>Prêmio Incentivo</label><input className="form-input" type="number" step="0.01" min={0} value={editandoAtividade.premio_incentivo ?? 0} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, premio_incentivo: Number(e.target.value) } : p)} /></div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
                                          <label>Insalubridade</label>
                                          <select className="form-input" value={editandoAtividade.insalubridade ?? 'sem_risco'} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, insalubridade: e.target.value as TipoInsalubridade } : p)}>
                                            <option value="sem_risco">Sem risco</option>
                                            <option value="pre">Pré (8%)</option>
                                            <option value="media">Média (9%)</option>
                                            <option value="maxima">Máxima (11%)</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                                        <label className="form-checkbox-row" style={{ margin: 0 }}><input type="checkbox" checked={!!editandoAtividade.adicional_noturno} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, adicional_noturno: e.target.checked } : p)} />Adicional Noturno (30%)</label>
                                        <label className="form-checkbox-row" style={{ margin: 0 }}><input type="checkbox" checked={!!editandoAtividade.periculosidade} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, periculosidade: e.target.checked } : p)} />Periculosidade (30%)</label>
                                      </div>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <IonButton size="small" shape="round" color="secondary" onClick={handleSalvarEdicaoAtividade}>Salvar</IonButton>
                                        <IonButton size="small" shape="round" fill="outline" onClick={() => setEditandoAtividade(null)}>Cancelar</IonButton>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={a.id} style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                                        <strong style={{ fontSize: 14 }}>{a.cargo}</strong>
                                        <span style={{ fontSize: 11, background: '#e8f0fe', color: '#1565c0', padding: '1px 8px', borderRadius: 8 }}>{ROTULO_ESCALA[a.tipo_escala ?? 'mensal']}</span>
                                        <span style={{ fontSize: 11, color: '#666' }}>× {a.quantidade}</span>
                                      </div>
                                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#777' }}>
                                        <span>Salário: <strong>{formatarMoeda(a.salario_base)}</strong></span>
                                        {!!a.adicional_noturno && <span style={{ color: '#e65100' }}>+ Noturno</span>}
                                        {!!a.periculosidade && <span style={{ color: '#c62828' }}>+ Periculosidade</span>}
                                        {a.insalubridade !== 'sem_risco' && <span style={{ color: '#6a1b9a' }}>+ Insalub. {ROTULO_INSALUBRIDADE[a.insalubridade ?? 'sem_risco']}</span>}
                                        {(a.vr_dias ?? 0) > 0 && <span>VR: {a.vr_dias}d</span>}
                                        {(a.vt_dias ?? 0) > 0 && <span>VT: {a.vt_dias}d</span>}
                                      </div>
                                      <div style={{ marginTop: 4, fontSize: 13, color: '#2e6b32', fontWeight: 600 }}>
                                        Custo total: {formatarMoeda(d.totalVaga * (a.quantidade ?? 1))}
                                        <span style={{ fontSize: 11, color: '#888', fontWeight: 400, marginLeft: 8 }}>(R$ {d.totalVaga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/vaga)</span>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                                      <button style={{ background: '#e8f0fe', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#1565c0' }} onClick={() => setEditandoAtividade({ ...a })}>Editar</button>
                                      <button style={{ background: '#fce4ec', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#c62828' }} onClick={() => handleRemoverAtividade(a.id)}>Remover</button>
                                    </div>
                                  </div>
                                );
                              })}
                              <div style={{ background: '#f0f7f0', border: '2px solid #4a9e4f', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: 14, color: '#2e6b32' }}>Total Geral da Proposta</strong>
                                <strong style={{ fontSize: 18, color: '#2e6b32' }}>{formatarMoeda(atividades.reduce((acc, a) => acc + calcularCustoAtividade(a, parametros), 0))}</strong>
                              </div>
                            </div>
                          )}

                          {atividades.length === 0 && !mostrarFormAtividade && (
                            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>Nenhuma função adicionada. Use "+ Adicionar" para incluir os cargos da proposta.</p>
                          )}

                          {/* Cobrança */}
                          <div className="form-section-title" style={{ marginTop: 20 }}>Condições de Cobrança</div>
                          <div className="form-field">
                            <textarea className="form-input form-textarea" rows={4} placeholder="Descreva as condições de cobrança, forma de pagamento, prazo..." value={parametros.cobranca ?? ''} onChange={(e) => setParametros((p) => ({ ...p, cobranca: e.target.value }))} />
                          </div>

                          {/* Assinatura */}
                          <div className="form-section-title" style={{ marginTop: 20 }}>Assinatura</div>
                          <div style={{ display: 'flex', gap: 40, marginTop: 12 }}>
                            <div style={{ flex: 1, borderTop: '1px solid #ccc', paddingTop: 8, fontSize: 12, color: '#666' }}>
                              Representante da empresa<br />
                              <span style={{ color: '#aaa' }}>(Assinar após impressão)</span>
                            </div>
                            <div style={{ flex: 1, borderTop: '1px solid #ccc', paddingTop: 8, fontSize: 12, color: '#666' }}>
                              Executivo de Contas — {getAppName()}<br />
                              <span style={{ color: '#aaa' }}>(Assinar após impressão)</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="modal-acoes">
                <IonButton fill="outline" shape="round" onClick={() => setShowModal(false)}>Fechar</IonButton>
              </div>
            </div>
          )}

          {/* ── Aba Reuniões ── */}
          {abaAtiva === 'reunioes' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Reuniões agendadas</span>
                <button className="btn-secundario" onClick={() => setMostrarFormReuniao((v) => !v)}>+ Agendar</button>
              </div>

              {mostrarFormReuniao && (
                <div className="form-alerta" style={{ marginBottom: 16 }}>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Título *</label>
                      <input className="form-input" value={novaReuniao.titulo} onChange={(e) => setNovaReuniao((p) => ({ ...p, titulo: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label>Data e hora *</label>
                      <input className="form-input" type="datetime-local" value={novaReuniao.dataHora} onChange={(e) => setNovaReuniao((p) => ({ ...p, dataHora: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Local</label>
                      <input className="form-input" value={novaReuniao.localReuniao} onChange={(e) => setNovaReuniao((p) => ({ ...p, localReuniao: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label>Trabalho relacionado</label>
                      <select className="form-input" value={novaReuniao.trabalhoId} onChange={(e) => setNovaReuniao((p) => ({ ...p, trabalhoId: e.target.value }))}>
                        <option value="">Nenhum</option>
                        {trabalhos.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Observações</label>
                    <textarea className="form-input form-textarea" rows={2} value={novaReuniao.observacoes} onChange={(e) => setNovaReuniao((p) => ({ ...p, observacoes: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <IonButton size="small" shape="round" color="secondary" onClick={handleAgendarReuniao}>Agendar</IonButton>
                    <IonButton size="small" shape="round" fill="outline" onClick={() => setMostrarFormReuniao(false)}>Cancelar</IonButton>
                  </div>
                </div>
              )}

              {reunioes.length === 0 && <p className="painel-vazio">Nenhuma reunião agendada.</p>}
              {reunioes.map((r) => (
                <div key={r.id} className="historico-item" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="historico-data">{r.titulo}</span>
                      <p style={{ margin: '4px 0 2px', fontSize: 13, color: '#555' }}>{formatarDataHora(r.data_hora)}{r.local_reuniao ? ` — ${r.local_reuniao}` : ''}</p>
                      {r.observacoes && <p style={{ margin: 0, fontSize: 13 }}>{r.observacoes}</p>}
                    </div>
                    <select
                      className="form-input"
                      style={{ width: 'auto', height: 30, fontSize: 12, padding: '0 6px' }}
                      value={r.status}
                      onChange={(e) => handleAlterarStatusReuniao(r.id, e.target.value as StatusReuniao)}
                    >
                      <option value="agendada">Agendada</option>
                      <option value="realizada">Realizada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>
              ))}

              <div className="modal-acoes">
                <IonButton fill="outline" shape="round" onClick={() => setShowModal(false)}>Fechar</IonButton>
              </div>
            </div>
          )}
        </div>
      </IonModal>

    </div>
  );
};

export default PainelExecutivo;
