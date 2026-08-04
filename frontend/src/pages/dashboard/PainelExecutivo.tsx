import React, { useEffect, useState } from 'react';
import { IonButton, IonModal, useIonViewWillEnter } from '@ionic/react';
import { useAuth } from '../../auth/AuthContext';
import { Empresa } from '../../api/empresasApi';
import {
  AtividadeProposta,
  ContatoTrabalho,
  MetricasExecutivo,
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
  obterMetricasExecutivo,
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
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

const STATUS_PERMITE_EDICAO_PROPOSTA: StatusTrabalho[] = ['em_aberto', 'em_andamento', 'fechado'];

const ROTULO_STATUS_REUNIAO: Record<StatusReuniao, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  pos_venda: 'Pós-venda',
  alinhamento: 'Alinhamento',
  fechamento: 'Fechamento',
};

function formatarMoeda(valor?: number | null) {
  if (valor == null) return '-';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(v?: number | null, def = 0) { return (v ?? def) / 100; }

// Salário mínimo legal — base de cálculo para insalubridade (Art. 7º, XXIII CF / Lei 12.690/12)
const SALARIO_MINIMO = 1621;

// Calcula o custo detalhado de uma atividade conforme a lógica da planilha Excel
function calcularDetalheAtividade(a: AtividadeProposta, p: ParametrosTrabalho) {
  const salario = a.salario_base ?? 0;
  const vrTotal = (a.vr_dias ?? 0) * (p.valor_vr_dia ?? 0);
  const vtTotal = (a.vt_dias ?? 0) * (p.valor_vt_dia ?? 0);
  const adicNoturno = a.adicional_noturno ? salario * 0.30 : 0;
  const pericVal = a.periculosidade ? salario * 0.30 : 0;

  // Insalubridade incide sobre salário mínimo (R$1.621), não sobre salário base
  const insolPct = a.insalubridade === 'pre' ? pct(p.insalubridade_pre_pct, 8)
    : a.insalubridade === 'media' ? pct(p.insalubridade_media_pct, 9)
    : a.insalubridade === 'maxima' ? pct(p.insalubridade_maxima_pct, 11)
    : 0;
  const insolVal = SALARIO_MINIMO * insolPct;

  const premioIncentivo = a.premio_incentivo ?? 0;
  const dar = salario * pct(p.dar_percentual, 10);
  const seguroVida = salario * pct(p.seguro_vida_percentual, 1.5);
  const inss = salario * pct(p.inss_percentual, 20);

  const remuneracaoTotal = salario + vrTotal + vtTotal + adicNoturno + pericVal + insolVal + premioIncentivo + dar + seguroVida + inss;

  // Grossing up: PIS/COFINS/ISS/taxa adm/margem incidem sobre o total que já inclui elas mesmas
  const pisPct = pct(p.pis_percentual, 0.65);
  const cofinsPct = pct(p.cofins_percentual, 1.65);
  const issPct = pct(p.iss_percentual, 2.5);
  const taxaAdmPct = pct(p.taxa_administrativa, 5);
  const margemPct = pct(p.margem_lucro, 10);
  const totalTaxas = pisPct + cofinsPct + issPct + taxaAdmPct + margemPct;
  const totalVaga = remuneracaoTotal / (1 - totalTaxas);
  const pis = totalVaga * pisPct;
  const cofins = totalVaga * cofinsPct;
  const iss = totalVaga * issPct;
  const taxaAdm = totalVaga * taxaAdmPct;
  const margem = totalVaga * margemPct;

  return { salario, vrTotal, vtTotal, adicNoturno, pericVal, insolVal, premioIncentivo, dar, seguroVida, inss, remuneracaoTotal, pis, cofins, iss, taxaAdm, margem, totalVaga };
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

const TEXTO_PADRAO_QUEM_SOMOS = `Fundada em 2007, a Atesa é uma Cooperativa de Trabalho formada por profissionais da área da saúde, dedicada a oferecer ao mercado especialistas altamente capacitados, credenciados e treinados para atender tanto pessoas físicas quanto jurídicas. Com um modelo de atuação diferenciado, a Atesa se destaca no setor pela excelência na prestação de serviços, compromisso com as necessidades dos clientes, transparência e eficiência, consolidando sua reputação como referência no mercado.`;

const TEXTO_PADRAO_COOPERATIVISMO = `É um modelo socioeconômico baseado na cooperação e autogestão, onde pessoas se unem para alcançar objetivos comuns de forma colaborativa. Diferente das empresas tradicionais, prioriza o bem-estar coletivo dos cooperados, promovendo valores como democracia, solidariedade e participação ativa nas decisões, sempre com foco no desenvolvimento sustentável e na justiça social.`;

const TEXTO_PADRAO_NOSSOS_VALORES = `Oferecer serviço de alta qualidade, profissionais aptos e bem treinados, para satisfazer as necessidades dos clientes, colaboradores e sociedade. Ser referência em cooperativa de saúde, reconhecida por inovação por ser parceira dos clientes. Capazes de forma colaborativa, trazendo confiança e mudanças significativas no setor que atuamos. Ética e Responsabilidade, Comprometimento, Transparência, Cooperação e Trabalho em equipe.`;

// ── Dashboard de métricas ─────────────────────────────────────────────────
const ROTULO_NEGOCIO: Record<string, string> = {
  primeiro_contato: 'Primeiro Contato',
  em_negociacao: 'Em Negociação',
  proposta_enviada: 'Proposta Enviada',
  negocio_fechado: 'Fechado',
  negocio_frustrado: 'Frustrado',
};

const COR_NEGOCIO: Record<string, string> = {
  primeiro_contato: '#90a4ae',
  em_negociacao: '#42a5f5',
  proposta_enviada: '#1976d2',
  negocio_fechado: '#388e3c',
  negocio_frustrado: '#cf3c4f',
};

type FiltroKpi =
  | { tipo: 'todos' }
  | { tipo: 'alertas' }
  | { tipo: 'reunioes' }
  | { tipo: 'negocio_fechado' }
  | { tipo: 'status_empresa'; status: string }
  | { tipo: 'funil'; status_negocio: string }
  | { tipo: 'trabalho_status'; status: string };

const DashboardMetricas: React.FC<{
  metricas: MetricasExecutivo;
  filtro: FiltroKpi;
  onFiltrar: (f: FiltroKpi) => void;
}> = ({ metricas, filtro, onFiltrar }) => {
  const totalFunil = metricas.funil.reduce((s, f) => s + Number(f.total), 0) || 1;
  const fechados = metricas.funil.find((f) => f.status_negocio === 'negocio_fechado')?.total ?? 0;

  const kpiFiltroAtivo = (tipo: string) => filtro.tipo === tipo;
  const kpiEstilo = (tipo: string, cor: string, bg: string) => ({
    background: kpiFiltroAtivo(tipo) ? cor : bg,
    borderRadius: 10, padding: '14px 16px',
    border: `2px solid ${kpiFiltroAtivo(tipo) ? cor : cor + '33'}`,
    cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div style={{ marginBottom: 28 }}>
      {/* KPI cards clicáveis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de clientes', valor: metricas.total_empresas, cor: '#2e6b32', bg: '#f0f7f0', tipo: 'todos' },
          { label: 'Alertas ativos', valor: metricas.total_alertas, cor: '#e65100', bg: '#fff3e0', tipo: 'alertas' },
          { label: 'Reuniões (7 dias)', valor: metricas.reunioes_proximas, cor: '#1565c0', bg: '#e3f2fd', tipo: 'reunioes' },
          { label: 'Negócios fechados', valor: fechados, cor: '#388e3c', bg: '#e8f5e9', tipo: 'negocio_fechado' },
        ].map((k) => {
          const ativo = kpiFiltroAtivo(k.tipo);
          return (
            <div
              key={k.label}
              style={kpiEstilo(k.tipo, k.cor, k.bg)}
              onClick={() => onFiltrar(filtro.tipo === k.tipo ? { tipo: 'todos' } : { tipo: k.tipo } as FiltroKpi)}
              title={ativo ? 'Clique para limpar o filtro' : `Filtrar por ${k.label.toLowerCase()}`}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: ativo ? '#fff' : k.cor, lineHeight: 1 }}>{Number(k.valor)}</div>
              <div style={{ fontSize: 11, color: ativo ? '#ffffffcc' : '#555', marginTop: 4, fontWeight: 500 }}>{k.label}</div>
              {ativo && <div style={{ fontSize: 10, color: '#ffffffaa', marginTop: 2 }}>● filtro ativo</div>}
            </div>
          );
        })}
      </div>

      {/* Funil + distribuição de trabalhos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Funil de negócios */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Funil de negócios</div>
          {metricas.funil.length === 0 && <div style={{ fontSize: 12, color: '#aaa' }}>Nenhum contato registrado.</div>}
          {metricas.funil.map((f) => {
            const pct = Math.round((Number(f.total) / totalFunil) * 100);
            const cor = COR_NEGOCIO[f.status_negocio] ?? '#888';
            const ativo = filtro.tipo === 'funil' && (filtro as any).status_negocio === f.status_negocio;
            return (
              <div
                key={f.status_negocio}
                style={{ marginBottom: 8, cursor: 'pointer', borderRadius: 6, padding: '4px 6px', background: ativo ? '#f0f7f0' : 'transparent', border: ativo ? '1px solid #4a9e4f' : '1px solid transparent' }}
                onClick={() => onFiltrar(ativo ? { tipo: 'todos' } : { tipo: 'funil', status_negocio: f.status_negocio })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: '#444', fontWeight: ativo ? 700 : 500 }}>{ROTULO_NEGOCIO[f.status_negocio] ?? f.status_negocio}</span>
                  <span style={{ color: '#888', fontVariantNumeric: 'tabular-nums' }}>{Number(f.total)} ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 3, transition: 'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Trabalhos por status */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Trabalhos por status</div>
          {metricas.statusTrabalhos.length === 0 && <div style={{ fontSize: 12, color: '#aaa' }}>Nenhum trabalho ainda.</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {metricas.statusTrabalhos.map((t) => {
              const ativo = filtro.tipo === 'trabalho_status' && (filtro as any).status === t.status;
              return (
                <div
                  key={t.status}
                  onClick={() => onFiltrar(ativo ? { tipo: 'todos' } : { tipo: 'trabalho_status', status: t.status })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    background: ativo ? (STATUS_CORES[t.status as StatusTrabalho] ?? '#888') : '#f5f5f5',
                    borderRadius: 20, padding: '5px 12px',
                    border: `1px solid ${STATUS_CORES[t.status as StatusTrabalho] ?? '#ccc'}${ativo ? 'ff' : '44'}`,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ativo ? '#fff' : (STATUS_CORES[t.status as StatusTrabalho] ?? '#999'), flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: ativo ? '#fff' : '#444' }}>{ROTULO_STATUS_TRABALHO[t.status as StatusTrabalho] ?? t.status}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ativo ? '#ffffffcc' : (STATUS_CORES[t.status as StatusTrabalho] ?? '#666') }}>{Number(t.total)}</span>
                </div>
              );
            })}
          </div>

          {/* Empresas por status clicável */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 10px' }}>Clientes por status</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {metricas.statusEmpresas.map((e) => {
              const ativo = filtro.tipo === 'status_empresa' && (filtro as any).status === e.status;
              return (
                <div
                  key={e.status}
                  onClick={() => onFiltrar(ativo ? { tipo: 'todos' } : { tipo: 'status_empresa', status: e.status })}
                  style={{
                    background: ativo ? '#2e6b32' : '#f0f7f0', borderRadius: 16, padding: '4px 10px',
                    fontSize: 11, color: ativo ? '#fff' : '#2e6b32',
                    border: `1px solid ${ativo ? '#2e6b32' : '#c8e6c9'}`, cursor: 'pointer',
                  }}
                >
                  {e.status} <strong style={{ marginLeft: 4 }}>{Number(e.total)}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {filtro.tipo !== 'todos' && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#1976d2' }}>
          <span>● Filtro ativo:</span>
          <strong>
            {filtro.tipo === 'alertas' ? 'Alertas ativos' :
             filtro.tipo === 'reunioes' ? 'Reuniões (7 dias)' :
             filtro.tipo === 'negocio_fechado' ? 'Negócios fechados' :
             filtro.tipo === 'status_empresa' ? `Status: ${(filtro as any).status}` :
             filtro.tipo === 'funil' ? `Funil: ${ROTULO_NEGOCIO[(filtro as any).status_negocio] ?? (filtro as any).status_negocio}` :
             filtro.tipo === 'trabalho_status' ? `Trabalho: ${ROTULO_STATUS_TRABALHO[(filtro as any).status as StatusTrabalho] ?? (filtro as any).status}` : ''}
          </strong>
          <button onClick={() => onFiltrar({ tipo: 'todos' })} style={{ fontSize: 11, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Limpar filtro</button>
        </div>
      )}
    </div>
  );
};

// ── Geração do HTML da proposta para impressão ─────────────────────────────
function gerarHtmlProposta(empresa: Empresa | null, trabalho: Trabalho | null, params: ParametrosTrabalho, atividades: AtividadeProposta[], cooperativaNome: string, executivoNome: string) {
  const hoje = new Date();
  const validade = new Date(hoje);
  validade.setDate(validade.getDate() + 30);
  const fmtData = (d: Date) => d.toLocaleDateString('pt-BR');
  const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalGeral = atividades.reduce((acc, a) => acc + calcularCustoAtividade(a, params), 0);

  const secaoCusto = atividades.map((a) => {
    const d = calcularDetalheAtividade(a, params);
    const rateioPercentual = pct(params.rateio_percentual, 3);
    const rateio = d.salario * rateioPercentual;
    const cooperadoBruto = d.salario + d.vrTotal + d.vtTotal + d.adicNoturno + d.pericVal + d.insolVal + d.premioIncentivo + d.seguroVida;
    const cooperadoLiquido = cooperadoBruto - rateio - d.inss;
    const li = (label: string, val: number, pct = '') => val > 0.001
      ? `<tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">${label}${pct ? `<span style="color:#888;font-size:9px;margin-left:4px">${pct}</span>` : ''}</td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee">${fmtMoeda(val)}</td></tr>`
      : `<tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">${label}${pct ? `<span style="color:#888;font-size:9px;margin-left:4px">${pct}</span>` : ''}</td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee;color:#bbb">—</td></tr>`;
    const liCoop = (label: string, val: number, pct = '') => val > 0.001
      ? `<tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">${label}${pct ? `<span style="color:#888;font-size:9px;margin-left:4px">${pct}</span>` : ''}</td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee">${fmtMoeda(val)}</td></tr>`
      : `<tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">${label}${pct ? `<span style="color:#888;font-size:9px;margin-left:4px">${pct}</span>` : ''}</td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee;color:#bbb">—</td></tr>`;
    return `
    <div style="page-break-inside:avoid;margin-bottom:24px">
      <div style="background:#2e6b32;color:#fff;padding:8px 12px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">${a.cargo}</div>
      <div style="display:flex;gap:0;border:1px solid #ddd;border-top:none">
        <!-- CLIENTE -->
        <div style="flex:1;border-right:1px solid #ddd">
          <div style="background:#4a9e4f;color:#fff;padding:5px 8px;font-size:10px;font-weight:700;text-transform:uppercase;display:flex;justify-content:space-between">
            <span>CLIENTE</span><span>${fmtMoeda(d.totalVaga)}</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">REMUNERAÇÃO<span style="color:#888;font-size:9px;margin-left:4px">${ROTULO_ESCALA[a.tipo_escala ?? 'plantao']}</span></td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee">${fmtMoeda(d.salario)}</td></tr>
            ${li('AJUDA DE CUSTO (VR)', d.vrTotal)}
            ${li('AUXÍLIO TRANSPORTE (VT)', d.vtTotal)}
            ${li('ADICIONAL NOTURNO', d.adicNoturno, a.adicional_noturno ? '30%' : 'Não')}
            ${li('INSALUBRIDADE', d.insolVal, a.insalubridade !== 'sem_risco' ? ROTULO_INSALUBRIDADE[a.insalubridade ?? 'sem_risco'] : 'Sem risco')}
            ${li('PERICULOSIDADE', d.pericVal, a.periculosidade ? '30%' : 'Não')}
            ${li('PRÊMIO INCENTIVO', d.premioIncentivo)}
            ${li('D.A.R.', d.dar, `${params.dar_percentual ?? 10}%`)}
            ${li('SEGURO DE VIDA', d.seguroVida, `${params.seguro_vida_percentual ?? 1.5}%`)}
            ${li('INSS PATRONAL', d.inss, `${params.inss_percentual ?? 20}%`)}
            <tr style="background:#f0f7f0;font-weight:600"><td style="padding:5px 8px;font-size:10.5px;border-bottom:1px solid #ccc">REMUNERAÇÃO TOTAL</td><td style="padding:5px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #ccc">${fmtMoeda(d.remuneracaoTotal)}</td></tr>
            ${li('PIS', d.pis, `${params.pis_percentual ?? 0.65}%`)}
            ${li('COFINS', d.cofins, `${params.cofins_percentual ?? 1.65}%`)}
            ${li('ISS', d.iss, `${params.iss_percentual ?? 2.5}%`)}
            ${li('TAXA ADMINISTRATIVA', d.taxaAdm, `${params.taxa_administrativa ?? 5}%`)}
            ${li('MARGEM DE LUCRO', d.margem, `${params.margem_lucro ?? 10}%`)}
            <tr style="background:#2e6b32"><td style="color:#fff;font-weight:700;padding:5px 8px;font-size:11px">TOTAL / VAGA</td><td style="color:#fff;font-weight:700;text-align:right;padding:5px 8px;font-size:11px">${fmtMoeda(d.totalVaga)}</td></tr>
          </table>
        </div>
        <!-- COOPERADO -->
        <div style="flex:1">
          <div style="background:#1a5c1e;color:#fff;padding:5px 8px;font-size:10px;font-weight:700;text-transform:uppercase;display:flex;justify-content:space-between">
            <span>COOPERADO (LÍQUIDO)</span><span>${fmtMoeda(cooperadoLiquido)}</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">REMUNERAÇÃO BRUTA</td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee">${fmtMoeda(d.salario)}</td></tr>
            ${liCoop('AJUDA DE CUSTO', d.vrTotal)}
            ${liCoop('AUXÍLIO TRANSPORTE', d.vtTotal)}
            ${liCoop('PERICULOSIDADE', d.pericVal, a.periculosidade ? '30%' : '')}
            ${liCoop('INSALUBRIDADE', d.insolVal, a.insalubridade !== 'sem_risco' ? ROTULO_INSALUBRIDADE[a.insalubridade ?? 'sem_risco'] : '')}
            ${liCoop('ADICIONAL NOTURNO', d.adicNoturno, a.adicional_noturno ? '30%' : '')}
            ${liCoop('PRÊMIO INCENTIVO', d.premioIncentivo)}
            ${liCoop('SEGURO DE VIDA', d.seguroVida, `${params.seguro_vida_percentual ?? 1.5}%`)}
            <tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">RATEIO<span style="color:#888;font-size:9px;margin-left:4px">${((params.rateio_percentual ?? 3)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%</span></td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee">${fmtMoeda(rateio)}</td></tr>
            <tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">INSS<span style="color:#888;font-size:9px;margin-left:4px">${params.inss_percentual ?? 20}%</span></td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee">${fmtMoeda(d.inss)}</td></tr>
            <tr><td style="padding:4px 8px;font-size:10.5px;border-bottom:1px solid #eee">INTEGRAÇÃO COTA PARTE</td><td style="padding:4px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #eee">1/5</td></tr>
            <tr style="background:#1a5c1e"><td style="color:#fff;font-weight:700;padding:5px 8px;font-size:11px">TOTAL COOPERADO (LÍQUIDO)</td><td style="color:#fff;font-weight:700;text-align:right;padding:5px 8px;font-size:11px">${fmtMoeda(cooperadoLiquido)}</td></tr>
          </table>
        </div>
      </div>
      <div style="background:#eee;padding:4px 8px;font-size:10px;color:#555;text-align:right">Quantidade: ${a.quantidade} vaga${(a.quantidade ?? 1) > 1 ? 's' : ''} — Total cliente: <strong>${fmtMoeda(d.totalVaga * (a.quantidade ?? 1))}</strong></div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Proposta Comercial — ${empresa?.nome_empresa ?? ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; background: #fff; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 0; background: #fff; }
    @page { size: A4; margin: 0; }
    @media print {
      html, body { width: 210mm; }
      .page { page-break-after: always; margin: 0; padding: 0; width: 210mm; min-height: 297mm; }
      .page:last-child { page-break-after: auto; }
    }
    h2 { font-size: 18px; color: #2e6b32; text-align: center; margin: 20px 0 12px; }
    h3 { font-size: 13px; color: #2e6b32; text-align: center; margin: 16px 0 8px; }
    p { margin-bottom: 8px; line-height: 1.7; font-size: 11px; }
    .inner { padding: 32px 40px; }
  </style>
</head>
<body>

<!-- ══ PÁGINA 1: CAPA ══ -->
<div class="page" style="position:relative;overflow:hidden;background:#f5f5f5;display:flex;flex-direction:column;justify-content:space-between">
  <!-- ondas verdes topo -->
  <div style="position:absolute;top:0;left:0;right:0;height:220px;overflow:hidden">
    <svg viewBox="0 0 800 220" preserveAspectRatio="none" style="width:100%;height:100%">
      <ellipse cx="200" cy="-30" rx="280" ry="220" fill="#2e6b32"/>
      <ellipse cx="120" cy="20" rx="180" ry="160" fill="#4a9e4f" opacity="0.7"/>
    </svg>
  </div>
  <!-- ondas verdes base -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:200px;overflow:hidden">
    <svg viewBox="0 0 800 200" preserveAspectRatio="none" style="width:100%;height:100%">
      <ellipse cx="600" cy="230" rx="350" ry="200" fill="#2e6b32"/>
      <ellipse cx="700" cy="210" rx="200" ry="160" fill="#4a9e4f" opacity="0.7"/>
    </svg>
  </div>
  <!-- conteúdo capa -->
  <div style="position:relative;z-index:1;padding:50px 60px">
    <div style="color:#fff;font-size:32px;font-weight:900;letter-spacing:8px;margin-bottom:4px">ATESA</div>
    <div style="color:#a5d6a7;font-size:11px;letter-spacing:4px;text-transform:uppercase">NOVO CONCEITO EM SAÚDE</div>
  </div>
  <div style="position:relative;z-index:1;text-align:center;padding:40px">
    <div style="font-size:36px;font-weight:900;color:#2e6b32;letter-spacing:2px;text-transform:uppercase">PROPOSTA</div>
    <div style="font-size:28px;font-weight:700;color:#4a9e4f;letter-spacing:2px;text-transform:uppercase">COMERCIAL</div>
  </div>
  <div style="position:relative;z-index:1;padding:50px 60px;margin-bottom:40px"></div>
</div>

<!-- ══ PÁGINA 2: DADOS DA EMPRESA ══ -->
<div class="page">
  <div class="inner" style="display:flex;flex-direction:column;height:100%;justify-content:space-between">
    <div>
      <!-- Logo área -->
      <div style="text-align:center;padding:40px 0 20px">
        <div style="font-size:28px;font-weight:900;color:#2e6b32;letter-spacing:6px">ATESA</div>
        <div style="font-size:10px;color:#888;letter-spacing:4px;text-transform:uppercase">NOVO CONCEITO EM SAÚDE</div>
      </div>
      <div style="text-align:center;margin:60px 0 80px">
        <div style="font-size:22px;font-weight:700;color:#2e6b32">Proposta Comercial</div>
      </div>
      <!-- Dados -->
      <div style="max-width:320px;margin:0 auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <tr><td style="color:#4a9e4f;font-weight:600;padding:4px 0;width:140px">Empresa:</td><td style="padding:4px 0;font-weight:600">${empresa?.nome_empresa ?? ''}</td></tr>
          ${empresa?.representante ? `<tr><td style="color:#4a9e4f;font-weight:600;padding:4px 0">Responsável:</td><td style="padding:4px 0">${empresa.representante}</td></tr>` : ''}
          ${empresa?.email_empresa ? `<tr><td style="color:#4a9e4f;font-weight:600;padding:4px 0">E-mail:</td><td style="padding:4px 0">${empresa.email_empresa}</td></tr>` : ''}
          ${empresa?.telefone_empresa ? `<tr><td style="color:#4a9e4f;font-weight:600;padding:4px 0">Telefone:</td><td style="padding:4px 0">${empresa.telefone_empresa}</td></tr>` : ''}
          <tr><td style="color:#4a9e4f;font-weight:600;padding:4px 0">Data de emissão:</td><td style="color:#4a9e4f;padding:4px 0">${fmtData(hoje)}</td></tr>
          <tr><td style="color:#4a9e4f;font-weight:600;padding:4px 0">Data de Validade:</td><td style="color:#4a9e4f;padding:4px 0">${fmtData(validade)}</td></tr>
        </table>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;color:#bbb;padding-bottom:16px">${cooperativaNome} — ${empresa?.cidade ?? ''}${empresa?.uf ? '/' + empresa.uf : ''}</div>
  </div>
</div>

<!-- ══ PÁGINA 3: INSTITUCIONAL ══ -->
<div class="page">
  <div class="inner">
    <div style="height:8px;background:#2e6b32;border-radius:2px;margin-bottom:24px"></div>

    <h2>Quem Somos</h2>
    <p style="text-align:justify">${(params.quem_somos ?? TEXTO_PADRAO_QUEM_SOMOS).replace(/\n/g, '<br/>')}</p>

    <h2 style="margin-top:20px">Cooperativismo</h2>
    <p style="text-align:justify">${(params.cooperativismo ?? TEXTO_PADRAO_COOPERATIVISMO).replace(/\n/g, '<br/>')}</p>

    <h3>Quais leis amparam o Cooperativismo?</h3>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:16px">
      <tr style="background:#f5f5f5"><td style="padding:6px 10px;font-weight:700;width:120px;color:#2e6b32;border:1px solid #ddd">Lei 5.764/1971</td><td style="padding:6px 10px;border:1px solid #ddd">Define os direitos e deveres dos associados e as características do cooperativismo, como a adesão voluntária, a neutralidade política e a assistência aos associados.</td></tr>
      <tr><td style="padding:6px 10px;font-weight:700;color:#2e6b32;border:1px solid #ddd">Lei 12.690/2012</td><td style="padding:6px 10px;border:1px solid #ddd">Define a cooperativa de trabalho como uma coletividade de trabalhadores que exercem atividades de interesse comum.</td></tr>
    </table>

    <h2>Nossos Valores</h2>
    <p style="text-align:justify">${(params.nossos_valores ?? TEXTO_PADRAO_NOSSOS_VALORES).replace(/\n/g, '<br/>')}</p>

    <div style="display:flex;gap:24px;margin-top:20px">
      <div style="flex:1;border:1px solid #2e6b32;border-radius:6px;padding:12px">
        <div style="font-weight:700;color:#2e6b32;font-size:12px;margin-bottom:8px;text-align:center">Nossos Profissionais</div>
        <ul style="padding-left:16px;font-size:10.5px;line-height:1.8">
          <li>Enfermeiros</li><li>Auxiliar de Enfermagem</li><li>Técnico de Enfermagem</li>
          <li>Cuidadores</li><li>Fonoaudiólogos</li><li>Fisioterapeutas</li>
          <li>Psicólogos</li><li>Terapeuta Ocupacional</li><li>Etc.</li>
        </ul>
      </div>
      <div style="flex:1;border:1px solid #4a9e4f;border-radius:6px;padding:12px;background:#f9fdf9">
        <div style="font-weight:700;color:#2e6b32;font-size:12px;margin-bottom:8px;text-align:center">Nossas Vantagens</div>
        <ul style="padding-left:16px;font-size:10.5px;line-height:1.8">
          <li>Gestão do Profissional</li><li>Eficiência na mão de obra Profissional</li>
          <li>Garantia de 100% escalas assumidas</li><li>Monitoramento Diurno e Noturno</li>
          <li>Cobertura Ágil de Furos e Faltas</li><li>Redução de Custo</li>
          <li>Suporte Jurídico</li><li>Educação Continuada</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- ══ PÁGINA 4+: CUSTO POR FUNÇÃO ══ -->
<div class="page">
  <div class="inner">
    <div style="height:8px;background:#2e6b32;border-radius:2px;margin-bottom:20px"></div>
    <div style="font-size:14px;font-weight:700;color:#2e6b32;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">Custo por Função</div>
    ${secaoCusto}
    <!-- Resumo total -->
    <div style="margin-top:16px;border:2px solid #2e6b32;border-radius:6px;overflow:hidden">
      <div style="background:#2e6b32;color:#fff;padding:8px 14px;font-weight:700;font-size:12px">RESUMO — VALOR TOTAL DA PROPOSTA</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <tr style="background:#f0f0f0"><th style="padding:6px 10px;text-align:left">Cargo</th><th style="text-align:right;padding:6px 10px">Qtd.</th><th style="text-align:right;padding:6px 10px">Valor/Vaga</th><th style="text-align:right;padding:6px 10px">Total</th></tr>
        ${atividades.map(a => { const d = calcularDetalheAtividade(a, params); return `<tr style="border-bottom:1px solid #eee"><td style="padding:5px 10px">${a.cargo}</td><td style="text-align:right;padding:5px 10px">${a.quantidade}</td><td style="text-align:right;padding:5px 10px">${fmtMoeda(d.totalVaga)}</td><td style="text-align:right;padding:5px 10px;font-weight:600">${fmtMoeda(d.totalVaga * (a.quantidade ?? 1))}</td></tr>`; }).join('')}
        <tr style="background:#2e6b32"><td colspan="3" style="color:#fff;font-weight:700;padding:7px 10px">TOTAL GERAL</td><td style="color:#fff;font-weight:700;text-align:right;padding:7px 10px;font-size:13px">${fmtMoeda(totalGeral)}</td></tr>
      </table>
    </div>
    ${params.cobranca ? `<div style="margin-top:16px;background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:12px 16px"><div style="font-weight:700;color:#e65100;font-size:11px;margin-bottom:6px">CONDIÇÕES DE COBRANÇA</div><p style="font-size:11px">${params.cobranca.replace(/\n/g, '<br/>')}</p></div>` : ''}
  </div>
</div>

<!-- ══ PÁGINA 5: OBSERVAÇÕES ══ -->
<div class="page">
  <div class="inner">
    <div style="height:8px;background:#2e6b32;border-radius:2px;margin-bottom:24px"></div>
    <h2 style="text-transform:uppercase">Observações</h2>
    <ul style="padding-left:18px;font-size:10.5px;line-height:2;color:#333">
      <li>A duração do trabalho normal não poderá ser superior a 8 (oito) horas diárias e 44 (quarenta e quatro) horas semanais, exceto quando a atividade, por sua natureza, demandar a prestação de serviços por meio de plantões ou escalas, facultada a compensação de horários. (Art. 7º da Lei 12.690/12). Observação: quando a duração do trabalho for superior ao limite supramencionado, as horas adicionais serão cobradas na forma de Horas Excedentes, conforme os valores estabelecidos.</li>
      <li>O cooperado que exercer atividade em horário noturno deverá receber remuneração superior àquela praticada no período diurno. (Art. 7º da Lei 12.690/12)</li>
      <li>O cooperado terá direito ao Repouso Semanal Remunerado (RSR), preferencialmente aos domingos. (Art. 7º da Lei 12.690/12)</li>
      <li>O cooperado que atuar por um período mínimo de 12 (doze) meses terá direito ao Repouso Anual Remunerado (RAR). Durante este período, o cooperado em descanso terá direito à remuneração integral, paga normalmente pelo cliente. Havendo necessidade de cobertura do cooperado em gozo do RAR, será enviada nova proposta contemplando os valores correspondentes à substituição.</li>
      <li>É direito do cooperado receber adicional de insalubridade ou periculosidade, quando aplicável. (Art. 7º da Lei 12.690/12)</li>
      <li>O cooperado terá direito ao Seguro de Acidente de Trabalho Obrigatório, conforme previsto no (Art. 7º da Lei 12.690/12).</li>
      <li>O cliente poderá oferecer gratificações e/ou bonificações aos cooperados. Nesses casos, os valores deverão ser negociados diretamente com a cooperativa, para posterior repasse ao associado.</li>
      <li><strong>Forma de cobrança:</strong> será emitida uma única fatura ou boleto bancário.</li>
    </ul>
  </div>
</div>

<!-- ══ PÁGINA 6: ACEITE ══ -->
<div class="page">
  <div class="inner">
    <div style="height:8px;background:#2e6b32;border-radius:2px;margin-bottom:24px"></div>
    <div style="font-size:16px;font-weight:700;color:#2e6b32;margin-bottom:20px">ACEITE</div>

    <p style="margin-bottom:4px">À</p>
    <p style="font-weight:700;margin-bottom:4px">${cooperativaNome}</p>
    <p style="margin-bottom:16px">Gerente Comercial</p>
    <p style="margin-bottom:16px"><strong>Ref.: ACEITE DA PROPOSTA COMERCIAL</strong></p>
    <p style="text-align:justify;font-size:11px;margin-bottom:20px">
      Pelo presente instrumento, na qualidade de <strong>CONTRATANTE</strong> da empresa abaixo descrita, afirmo que estou <strong>DE ACORDO</strong> com as condições da <strong>PROPOSTA COMERCIAL</strong> da ${cooperativaNome}, referente à <strong>PRESTAÇÃO DE SERVIÇOS POR MEIO DE COOPERATIVA DE TRABALHO PELO SISTEMA COOPERATIVO</strong>.
    </p>

    <div style="font-weight:700;font-size:11px;border-bottom:2px solid #2e6b32;padding-bottom:4px;margin-bottom:12px">DADOS DO CONTRATANTE ("Cliente"):</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px">
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;width:160px;color:#555">Razão Social:</td><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600">${empresa?.nome_empresa ?? ''}</td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">Nome Fantasia:</td><td style="padding:6px 0;border-bottom:1px solid #eee"></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">Logradouro:</td><td style="padding:6px 0;border-bottom:1px solid #eee">${empresa?.rua ? `${empresa.rua}${empresa.numero ? ', ' + empresa.numero : ''}` : ''}</td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">Cidade:</td><td style="padding:6px 0;border-bottom:1px solid #eee">${empresa?.cidade ?? ''}</td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">Estado:</td><td style="padding:6px 0;border-bottom:1px solid #eee">${empresa?.uf ?? ''}</td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">CEP:</td><td style="padding:6px 0;border-bottom:1px solid #eee">${empresa?.cep ?? ''}</td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">CNPJ / CPF:</td><td style="padding:6px 0;border-bottom:1px solid #eee">${empresa?.cnpj ?? ''}</td></tr>
    </table>

    <div style="font-weight:700;font-size:11px;border-bottom:2px solid #2e6b32;padding-bottom:4px;margin-bottom:12px">ENDEREÇO DE COBRANÇA</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px">
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;width:160px;color:#555">Logradouro:</td><td style="padding:6px 0;border-bottom:1px solid #eee"></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">Cidade:</td><td style="padding:6px 0;border-bottom:1px solid #eee"></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">Estado:</td><td style="padding:6px 0;border-bottom:1px solid #eee"></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">CEP:</td><td style="padding:6px 0;border-bottom:1px solid #eee"></td></tr>
    </table>

    <div style="font-weight:700;font-size:11px;border-bottom:2px solid #2e6b32;padding-bottom:4px;margin-bottom:12px">Contato:</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:32px">
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;width:160px;color:#555">Nome:</td><td style="padding:6px 0;border-bottom:1px solid #eee">${empresa?.representante ?? ''}</td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">Telefone:</td><td style="padding:6px 0;border-bottom:1px solid #eee">${empresa?.telefone_empresa ?? ''}</td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#555">E-mail:</td><td style="padding:6px 0;border-bottom:1px solid #eee">${empresa?.email_empresa ?? ''}</td></tr>
    </table>

    <p style="text-align:right;font-size:11px;margin-bottom:48px">${empresa?.cidade ?? 'São Paulo'}, _______ de _________________ de ${hoje.getFullYear()}.</p>

    <div style="display:flex;gap:60px;margin-top:20px">
      <div style="flex:1;text-align:center">
        <div style="border-top:1px solid #333;padding-top:8px;font-size:10.5px">
          <div style="font-weight:600">${empresa?.representante ?? '_______________________________'}</div>
          <div style="color:#777">Representante — ${empresa?.nome_empresa ?? ''}</div>
        </div>
      </div>
      <div style="flex:1;text-align:center">
        <div style="border-top:1px solid #333;padding-top:8px;font-size:10.5px">
          <div style="font-weight:600">${executivoNome}</div>
          <div style="color:#777">Executivo de Contas — ${cooperativaNome}</div>
        </div>
      </div>
    </div>

    <div style="margin-top:32px;border-top:2px solid #2e6b32;padding-top:12px">
      <div style="font-weight:700;font-size:11px;margin-bottom:8px;color:#2e6b32">DOCUMENTAÇÃO</div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:10.5px">
        <div>☑ Cartão do CNPJ</div>
        <div>☑ Contrato Social da Empresa e Alterações ou Estatuto Social</div>
        <div>☑ Cópia do RG e CPF (somente para contrato de pessoa física)</div>
        <div>☑ Comprovante de endereço (somente para contrato de pessoa física)</div>
      </div>
    </div>
  </div>
</div>

<script>window.print();</script>
</body>
</html>`;
}

function parseCurrency(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const s = v.trim();
  let normalized: string;
  if (s.includes(',') && s.includes('.')) {
    normalized = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    normalized = s.replace(',', '.');
  } else {
    normalized = s;
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? undefined : n;
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
  const [sucessoDados, setSucessoDados] = useState(false);

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
  const [parametros, setParametros] = useState<ParametrosTrabalho>({ quem_somos: TEXTO_PADRAO_QUEM_SOMOS, cooperativismo: TEXTO_PADRAO_COOPERATIVISMO, nossos_valores: TEXTO_PADRAO_NOSSOS_VALORES });
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
  const [novaReuniao, setNovaReuniao] = useState({ titulo: '', data: '', horaH: '', horaM: '', localReuniao: '', observacoes: '', trabalhoId: '' });
  const [mostrarFormReuniao, setMostrarFormReuniao] = useState(false);

  const [metricas, setMetricas] = useState<MetricasExecutivo | null>(null);
  const [filtroKpi, setFiltroKpi] = useState<FiltroKpi>({ tipo: 'todos' });
  const [qtdNovasAtividades, setQtdNovasAtividades] = useState(1);

  const carregarEmpresas = async () => {
    setCarregando(true);
    setErroCarregamento('');
    try {
      const [lista, m] = await Promise.all([listarEmpresasExecutivo(), obterMetricasExecutivo().catch(() => null)]);
      setEmpresas(lista);
      setMetricas(m);
    } catch (e) {
      setErroCarregamento(e instanceof Error ? e.message : 'Erro ao carregar empresas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarEmpresas(); }, []);
  useIonViewWillEnter(() => { carregarEmpresas(); });

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
    setNovaReuniao({ titulo: '', data: '', horaH: '', horaM: '', localReuniao: '', observacoes: '', trabalhoId: '' });
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
    const nomeEmpresa = dadosEmpresa.nome_empresa ?? empresaSelecionada.nome_empresa;
    const emailEmpresa = dadosEmpresa.email_empresa ?? empresaSelecionada.email_empresa;
    const telefoneEmpresa = dadosEmpresa.telefone_empresa ?? empresaSelecionada.telefone_empresa;
    if (!nomeEmpresa || !emailEmpresa || !telefoneEmpresa) {
      setErro('Nome da empresa, e-mail e telefone são obrigatórios.');
      return;
    }
    setSalvandoDados(true);
    setSucessoDados(false);
    setErro('');
    try {
      const payload = {
        nomeEmpresa,
        emailEmpresa,
        telefoneEmpresa,
        cnpj: dadosEmpresa.cnpj ?? undefined,
        cep: dadosEmpresa.cep ?? undefined,
        rua: dadosEmpresa.rua ?? undefined,
        numero: dadosEmpresa.numero ?? undefined,
        complemento: dadosEmpresa.complemento ?? undefined,
        bairro: dadosEmpresa.bairro ?? undefined,
        cidade: dadosEmpresa.cidade ?? undefined,
        uf: dadosEmpresa.uf ?? undefined,
        representante: dadosEmpresa.representante ?? undefined,
        status: dadosEmpresa.status,
        dataPrimeiroContato: dadosEmpresa.data_primeiro_contato ?? undefined,
      };
      const atualizada = await atualizarDadosEmpresa(empresaSelecionada.id, payload);
      setEmpresaSelecionada(atualizada);
      setEmpresas((prev) => prev.map((e) => (e.id === atualizada.id ? atualizada : e)));
      setSucessoDados(true);
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
    setParametros({ quem_somos: TEXTO_PADRAO_QUEM_SOMOS, cooperativismo: TEXTO_PADRAO_COOPERATIVISMO, nossos_valores: TEXTO_PADRAO_NOSSOS_VALORES, ...(ps ?? {}) });
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
    rateioPercentual: parametros.rateio_percentual,
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
    setParametros({ quem_somos: TEXTO_PADRAO_QUEM_SOMOS, cooperativismo: TEXTO_PADRAO_COOPERATIVISMO, nossos_valores: TEXTO_PADRAO_NOSSOS_VALORES, ...(ps ?? {}) });
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
    const html = gerarHtmlProposta(empresaSelecionada, trabalho, parametros, atividades, getAppName(), usuario?.nome ?? '');
    const janela = window.open('', '_blank');
    if (!janela) { alert('Permita pop-ups para gerar o PDF.'); return; }
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
  };

  // ── Aba Reuniões ─────────────────────────────────────────────────────────────
  const handleAgendarReuniao = async () => {
    if (!empresaSelecionada || !novaReuniao.titulo || !novaReuniao.data || !novaReuniao.horaH || !novaReuniao.horaM) {
      setErro('Informe o título, data e hora da reunião.');
      return;
    }
    try {
      const dataHora = `${novaReuniao.data}T${novaReuniao.horaH}:${novaReuniao.horaM}`;
      await agendarReuniao({
        empresaId: empresaSelecionada.id,
        titulo: novaReuniao.titulo,
        dataHora,
        localReuniao: novaReuniao.localReuniao || undefined,
        observacoes: novaReuniao.observacoes || undefined,
        trabalhoId: novaReuniao.trabalhoId ? Number(novaReuniao.trabalhoId) : undefined,
      });
      const rs = await listarReunioesPorEmpresa(empresaSelecionada.id);
      setReunioes(rs);
      setNovaReuniao({ titulo: '', data: '', horaH: '', horaM: '', localReuniao: '', observacoes: '', trabalhoId: '' });
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
    <div key={idx} style={{ position: 'relative', background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
      {novasAtividades.length > 1 && (
        <button
          style={{ position: 'absolute', top: 8, right: 8, background: '#fce4ec', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#cf3c4f', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => removerLinhaAtividade(idx)}
          title="Remover esta função"
        >✕</button>
      )}
      <div className="form-row" style={{ alignItems: 'flex-end', gap: 8, marginBottom: 4, paddingRight: novasAtividades.length > 1 ? 36 : 0 }}>
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
          <select className="form-input" value={a.tipoEscala ?? 'plantao'} onChange={(e) => atualizarLinhaAtividade(idx, 'tipoEscala', e.target.value as TipoEscala)}>
            <option value="plantao">Plantão 12x36</option>
          </select>
        </div>
      </div>
      <div className="form-row" style={{ gap: 8, marginBottom: 0 }}>
        <div className="form-field form-field-small" style={{ marginBottom: 0 }}>
          <label>Salário Base (R$)</label>
          <input
            className="form-input"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={a.salarioBase != null ? String(a.salarioBase).replace('.', ',') : ''}
            key={`salario-${idx}`}
            onBlur={(e) => atualizarLinhaAtividade(idx, 'salarioBase', parseCurrency(e.target.value))}
          />
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
          <input
            className="form-input"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={a.premioIncentivo ? String(a.premioIncentivo).replace('.', ',') : ''}
            key={`premio-${idx}`}
            onBlur={(e) => atualizarLinhaAtividade(idx, 'premioIncentivo', parseCurrency(e.target.value) ?? 0)}
          />
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

      {/* ── Dashboard consolidado de atendimentos ── */}
      {metricas && (
        <DashboardMetricas metricas={metricas} filtro={filtroKpi} onFiltrar={setFiltroKpi} />
      )}

      {erroCarregamento && (
        <div className="painel-vazio">
          {erroCarregamento}
          <div style={{ marginTop: 12 }}>
            <IonButton size="small" fill="outline" onClick={carregarEmpresas}>Tentar novamente</IonButton>
          </div>
        </div>
      )}

      {!erroCarregamento && (() => {
        const empresasFiltradas = empresas.filter((e) => {
          if (filtroKpi.tipo === 'todos') return true;
          if (filtroKpi.tipo === 'alertas') return !!e.tem_alerta;
          if (filtroKpi.tipo === 'reunioes') return metricas?.reunioesEmpresaIds?.includes(e.id) ?? false;
          if (filtroKpi.tipo === 'negocio_fechado') return metricas?.negocioFechadoEmpresaIds?.includes(e.id) ?? false;
          if (filtroKpi.tipo === 'status_empresa') return e.status === (filtroKpi as any).status;
          if (filtroKpi.tipo === 'funil') return (metricas?.funilEmpresaIdsPorStatus?.[(filtroKpi as any).status_negocio] ?? []).includes(e.id);
          if (filtroKpi.tipo === 'trabalho_status') return (metricas?.trabalhoEmpresaIdsPorStatus?.[(filtroKpi as any).status] ?? []).includes(e.id);
          return true;
        });
        return (
        <div className="painel-lista">
          {!carregando && empresas.length === 0 && (
            <div className="painel-vazio">Nenhuma empresa atribuída a você ainda.</div>
          )}
          {!carregando && empresas.length > 0 && empresasFiltradas.length === 0 && filtroKpi.tipo !== 'todos' && (
            <div className="painel-vazio">Nenhuma empresa corresponde ao filtro selecionado.</div>
          )}
          {empresasFiltradas.map((empresa) => (
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
        );
      })()}

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
          {!erro && sucessoDados && abaAtiva === 'dados' && (
            <p style={{ fontSize: 12, marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#e8f5e9', color: '#2e6b32', border: '1px solid #a5d6a7' }}>
              Dados salvos com sucesso!
            </p>
          )}

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
                    <option value="">Selecione...</option>
                    {['Primeiro Contato', 'Em negociação', 'Proposta enviada', 'Cliente ativo', 'Inativo'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    {dadosEmpresa.status && !['', 'Primeiro Contato', 'Em negociação', 'Proposta enviada', 'Cliente ativo', 'Inativo'].includes(dadosEmpresa.status) && (
                      <option value={dadosEmpresa.status}>{dadosEmpresa.status}</option>
                    )}
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
                <span className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Processos</span>
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
                        <button className={`exec-aba${abaTrabalho === 'propostas' ? ' exec-aba-ativa' : ''}`} onClick={() => { setAbaTrabalho('propostas'); carregarProposta(trabalho); }}>Proposta</button>
                        <button className={`exec-aba${abaTrabalho === 'parametros' ? ' exec-aba-ativa' : ''}`} onClick={() => setAbaTrabalho('parametros')}>Parâmetros</button>
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
                          {/* Resumo das funções preenchidas pelo executivo */}
                          <div className="form-section-title">Funções da Proposta</div>
                          {atividades.length === 0 ? (
                            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>Nenhuma função adicionada ainda na aba Proposta.</p>
                          ) : (
                            <div style={{ marginBottom: 20 }}>
                              {atividades.map((a) => {
                                const d = calcularDetalheAtividade(a, parametros);
                                return (
                                  <div key={a.id} style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <strong style={{ fontSize: 13 }}>{a.cargo}</strong>
                                      <span style={{ fontSize: 12, color: '#777', marginLeft: 10 }}>{a.quantidade} vaga{(a.quantidade ?? 1) > 1 ? 's' : ''} · {ROTULO_ESCALA[a.tipo_escala ?? 'plantao']} · {formatarMoeda(a.salario_base ?? 0)}/mês</span>
                                      {a.adicional_noturno && <span style={{ marginLeft: 8, fontSize: 11, color: '#555' }}>· Noturno</span>}
                                      {a.periculosidade && <span style={{ marginLeft: 4, fontSize: 11, color: '#555' }}>· Periculosidade</span>}
                                      {a.insalubridade !== 'sem_risco' && <span style={{ marginLeft: 4, fontSize: 11, color: '#555' }}>· Insalub. {ROTULO_INSALUBRIDADE[a.insalubridade ?? 'sem_risco']}</span>}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: '#2e6b32' }}>{formatarMoeda(d.totalVaga)}/vaga</span>
                                      <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>Total: {formatarMoeda(d.totalVaga * (a.quantidade ?? 1))}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              <div style={{ background: '#f0f7f0', border: '1px solid #4a9e4f', borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between' }}>
                                <strong style={{ color: '#2e6b32' }}>Total Geral</strong>
                                <strong style={{ color: '#2e6b32' }}>{formatarMoeda(atividades.reduce((acc, a) => acc + calcularCustoAtividade(a, parametros), 0))}</strong>
                              </div>
                            </div>
                          )}

                          {/* Taxas */}
                          <div className="form-section-title">
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

                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {!STATUS_PERMITE_EDICAO_PROPOSTA.includes(trabalho.status) && (
                                <span style={{ fontSize: 11, background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: 8, border: '1px solid #ffb74d' }}>
                                  Somente leitura — status: {ROTULO_STATUS_TRABALHO[trabalho.status]}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {STATUS_PERMITE_EDICAO_PROPOSTA.includes(trabalho.status) && (
                                <IonButton size="small" shape="round" color="secondary" onClick={handleSalvarProposta} disabled={salvandoProposta}>
                                  {salvandoProposta ? 'Salvando...' : 'Salvar'}
                                </IonButton>
                              )}
                              <IonButton size="small" shape="round" fill="outline" color="secondary" onClick={() => handleImprimirProposta(trabalho)}>
                                🖨️ Imprimir / PDF
                              </IonButton>
                            </div>
                          </div>

                          {/* Seção Executivo */}
                          <div style={{ background: '#f0f7f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#4a9e4f', textTransform: 'uppercase' as const, letterSpacing: 1 }}>Preenchimento — Executivo de Contas</span>
                          </div>

                          {/* Texto institucional */}
                          <div className="form-section-title">Texto Institucional</div>
                          <div style={{ marginBottom: 10 }}>
                            <div className="form-section-title" style={{ fontSize: 12, color: '#555', fontWeight: 600, border: 'none', marginBottom: 4, paddingBottom: 0 }}>Quem Somos</div>
                            <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{parametros.quem_somos ?? TEXTO_PADRAO_QUEM_SOMOS}</p>
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <div className="form-section-title" style={{ fontSize: 12, color: '#555', fontWeight: 600, border: 'none', marginBottom: 4, paddingBottom: 0 }}>Cooperativismo</div>
                            <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{parametros.cooperativismo ?? TEXTO_PADRAO_COOPERATIVISMO}</p>
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <div className="form-section-title" style={{ fontSize: 12, color: '#555', fontWeight: 600, border: 'none', marginBottom: 4, paddingBottom: 0 }}>Nossos Valores</div>
                            <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{parametros.nossos_valores ?? TEXTO_PADRAO_NOSSOS_VALORES}</p>
                          </div>

                          {/* Custo por função */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
                            <div className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Custo por Função</div>
                            {STATUS_PERMITE_EDICAO_PROPOSTA.includes(trabalho.status) && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <select
                                  className="form-input"
                                  style={{ width: 56, height: 32, fontSize: 13, padding: '0 6px', textAlign: 'center' }}
                                  value={qtdNovasAtividades}
                                  onChange={(e) => setQtdNovasAtividades(Number(e.target.value))}
                                  title="Quantidade de funções para adicionar"
                                >
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <button className="btn-secundario" onClick={() => { setMostrarFormAtividade(true); setNovasAtividades(Array.from({ length: qtdNovasAtividades }, () => novaAtividadeVazia())); }}>+ Adicionar</button>
                              </div>
                            )}
                          </div>

                          {mostrarFormAtividade && (
                            <div className="form-alerta" style={{ marginBottom: 16 }}>
                              {novasAtividades.map((a, idx) => renderFormNovaAtividade(a, idx))}
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <IonButton size="small" shape="round" color="secondary" onClick={handleAdicionarAtividades}>Confirmar</IonButton>
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
                                          <select className="form-input" value={editandoAtividade.tipo_escala ?? 'plantao'} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, tipo_escala: e.target.value as TipoEscala } : p)}>
                                            <option value="plantao">Plantão 12x36</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="form-row" style={{ gap: 8, marginBottom: 4 }}>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}><label>Salário Base (R$)</label><input className="form-input" type="text" inputMode="decimal" placeholder="0,00" defaultValue={editandoAtividade.salario_base != null ? String(editandoAtividade.salario_base).replace('.', ',') : ''} key={`edit-salario-${editandoAtividade.id}`} onBlur={(e) => setEditandoAtividade((p) => p ? { ...p, salario_base: parseCurrency(e.target.value) } : p)} /></div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}><label>Dias VR</label><input className="form-input" type="number" step="0.5" min={0} value={editandoAtividade.vr_dias ?? 0} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, vr_dias: Number(e.target.value) } : p)} /></div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}><label>Dias VT</label><input className="form-input" type="number" step="0.5" min={0} value={editandoAtividade.vt_dias ?? 0} onChange={(e) => setEditandoAtividade((p) => p ? { ...p, vt_dias: Number(e.target.value) } : p)} /></div>
                                        <div className="form-field form-field-small" style={{ marginBottom: 0 }}><label>Prêmio Incentivo</label><input className="form-input" type="text" inputMode="decimal" placeholder="0,00" defaultValue={editandoAtividade.premio_incentivo ? String(editandoAtividade.premio_incentivo).replace('.', ',') : ''} key={`edit-premio-${editandoAtividade.id}`} onBlur={(e) => setEditandoAtividade((p) => p ? { ...p, premio_incentivo: parseCurrency(e.target.value) ?? 0 } : p)} /></div>
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
                                        <span style={{ fontSize: 11, background: '#e8f0fe', color: '#1565c0', padding: '1px 8px', borderRadius: 8 }}>{ROTULO_ESCALA[a.tipo_escala ?? 'plantao']}</span>
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
                                    {STATUS_PERMITE_EDICAO_PROPOSTA.includes(trabalho.status) && (
                                      <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                                        <button style={{ background: '#e8f0fe', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#1565c0' }} onClick={() => setEditandoAtividade({ ...a })}>Editar</button>
                                        <button style={{ background: '#fce4ec', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#c62828' }} onClick={() => handleRemoverAtividade(a.id)}>Remover</button>
                                      </div>
                                    )}
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
                      <label>Data *</label>
                      <input className="form-input" type="date" value={novaReuniao.data} onChange={(e) => setNovaReuniao((p) => ({ ...p, data: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label>Hora *</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select className="form-input" style={{ flex: 1 }} value={novaReuniao.horaH} onChange={(e) => setNovaReuniao((p) => ({ ...p, horaH: e.target.value }))}>
                          <option value="">hh</option>
                          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <select className="form-input" style={{ flex: 1 }} value={novaReuniao.horaM} onChange={(e) => setNovaReuniao((p) => ({ ...p, horaM: e.target.value }))}>
                          <option value="">mm</option>
                          {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
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
                      {(Object.keys(ROTULO_STATUS_REUNIAO) as StatusReuniao[]).map((s) => (
                        <option key={s} value={s}>{ROTULO_STATUS_REUNIAO[s]}</option>
                      ))}
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
