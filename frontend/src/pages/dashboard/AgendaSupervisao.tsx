import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Reuniao,
  ROTULO_STATUS_REUNIAO,
  STATUS_COR_REUNIAO,
  StatusReuniao,
  agendarReuniao,
  atualizarReuniao,
  atualizarStatusReuniao,
  excluirReuniao,
  listarEmpresasExecutivo,
  listarTodasReunioes,
} from '../../api/executivoApi';
import { Empresa, listarEmpresas } from '../../api/empresasApi';
import { useAuth } from '../../auth/AuthContext';
import { usePermissoes } from '../../auth/PermissoesContext';
import { formatarDataBR } from '../../utils/formatters';
import {
  IconSearch, IconCalendar, IconCheck, IconAlert, IconTrash,
  IconEdit, IconMapPin, IconBuilding, IconUser, IconClock, IconX
} from '../../components/Icons';
import './AgendaSupervisao.css';

// ── Status de Reunião ────────────────────────────────────────────────────────
const STATUS_VALIDOS_LISTA: StatusReuniao[] = ['agendada', 'realizada', 'cancelada', 'pos_venda', 'alinhamento', 'fechamento'];

// Status nulo, vazio ou fora da lista (legado) é sempre tratado como 'agendada'
function normalizarStatusReuniao(status?: string | null): StatusReuniao {
  const st = (status ?? '').trim().toLowerCase();
  return STATUS_VALIDOS_LISTA.includes(st as StatusReuniao) ? (st as StatusReuniao) : 'agendada';
}

// ── Feriados Nacionais e Datas Comemorativas ─────────────────────────────────
interface Feriado {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: 'nacional' | 'comemorativo';
}

function obterFeriados(ano: number): Feriado[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fixos = [
    { m: 1, d: 1, nome: 'Confraternização Universal', tipo: 'nacional' },
    { m: 4, d: 21, nome: 'Tiradentes', tipo: 'nacional' },
    { m: 5, d: 1, nome: 'Dia do Trabalhador', tipo: 'nacional' },
    { m: 9, d: 7, nome: 'Independência do Brasil', tipo: 'nacional' },
    { m: 10, d: 12, nome: 'Nossa Senhora de Aparecida', tipo: 'nacional' },
    { m: 10, d: 15, nome: 'Dia do Professor', tipo: 'comemorativo' },
    { m: 10, d: 28, nome: 'Dia do Servidor Público', tipo: 'comemorativo' },
    { m: 11, d: 2, nome: 'Finados', tipo: 'nacional' },
    { m: 11, d: 15, nome: 'Proclamação da República', tipo: 'nacional' },
    { m: 11, d: 20, nome: 'Dia da Consciência Negra', tipo: 'nacional' },
    { m: 12, d: 25, nome: 'Natal', tipo: 'nacional' },
  ];

  return fixos.map(f => ({
    data: `${ano}-${pad(f.m)}-${pad(f.d)}`,
    nome: f.nome,
    tipo: f.tipo as 'nacional' | 'comemorativo',
  }));
}

// Formatação de hora em estilo Google (ex: 3pm, 4:30pm, 10am ou 15:00)
function formatarHoraGoogle(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    let h = d.getHours();
    const m = d.getMinutes();
    const sufixo = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    if (m === 0) return `${h}${sufixo}`;
    return `${h}:${String(m).padStart(2, '0')}${sufixo}`;
  } catch {
    return '';
  }
}

// Converte string de data ISO ou SQL para objeto Date seguro (evita desvios de fuso horário UTC)
function parseDataEvento(dataHoraStr?: string | null): Date | null {
  if (!dataHoraStr) return null;
  const limpo = dataHoraStr.replace('T', ' ');
  const partes = limpo.split(' ');
  const datePart = partes[0]; // YYYY-MM-DD
  const [ano, mes, dia] = datePart.split('-').map(Number);
  if (!ano || !mes || !dia) {
    const d = new Date(dataHoraStr);
    return isNaN(d.getTime()) ? null : d;
  }
  let hora = 9;
  let min = 0;
  if (partes[1]) {
    const [h, m] = partes[1].split(':').map(Number);
    if (!isNaN(h)) hora = h;
    if (!isNaN(m)) min = m;
  }
  return new Date(ano, mes - 1, dia, hora, min);
}

// Formatação completa e amigável da data para o card lateral (ex: QUA, 30/09 às 17:05)
function formatarDataCompletaEvento(dataHoraStr?: string | null): string {
  const d = parseDataEvento(dataHoraStr);
  if (!d) return 'Data não definida';
  const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' });
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${diaSemana.toUpperCase()}, ${dia}/${mes}/${ano} às ${hora}:${min}`;
}

// Formatação simples (ex: 30/09/2026)
function formatarDataSimplesEvento(dataHoraStr?: string | null): string {
  const d = parseDataEvento(dataHoraStr);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

type TipoVisualizacao = 'mes' | 'semana' | 'dia' | 'programacao';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const NOMES_MESES_ABREV = [
  'jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
  'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'
];

const DIAS_SEMANA_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const AgendaSupervisao: React.FC = () => {
  const { usuario } = useAuth();
  const { temPermissao } = usePermissoes();

  // Estados principais
  const [dataAtual, setDataAtual] = useState(new Date());
  const [visualizacao, setVisualizacao] = useState<TipoVisualizacao>('mes');
  const [menuVisualizacaoAberto, setMenuVisualizacaoAberto] = useState(false);
  const [mostrarFinsDeSemana, setMostrarFinsDeSemana] = useState(true);
  const [mostrarFeriados, setMostrarFeriados] = useState(true);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(true);

  // Dados
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusReuniao | ''>('');
  const [alertaSucesso, setAlertaSucesso] = useState('');
  const [erro, setErro] = useState('');

  // Modais de Criação e Detalhe
  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState<Reuniao | null>(null);
  const [editandoReuniao, setEditandoReuniao] = useState(false);

  // Formulário de evento
  const [form, setForm] = useState({
    empresaId: '',
    titulo: '',
    data: '',
    horaInicio: '09:00',
    horaFim: '10:00',
    localReuniao: 'Google Meet',
    observacoes: '',
    status: 'agendada' as StatusReuniao,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const mesAnoRef = useRef<HTMLDivElement>(null);
  const [menuMesAnoAberto, setMenuMesAnoAberto] = useState(false);
  const [anoSelecionadoPicker, setAnoSelecionadoPicker] = useState(dataAtual.getFullYear());

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuVisualizacaoAberto(false);
      }
      if (mesAnoRef.current && !mesAnoRef.current.contains(e.target as Node)) {
        setMenuMesAnoAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selecionarMesAno = (mesIndex: number, ano: number) => {
    const nova = new Date(dataAtual);
    nova.setDate(1);
    nova.setFullYear(ano);
    nova.setMonth(mesIndex);
    setDataAtual(nova);
    setMenuMesAnoAberto(false);
  };

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [rs, es] = await Promise.all([
        listarTodasReunioes(),
        listarEmpresas().catch(() => listarEmpresasExecutivo()),
      ]);
      setReunioes(rs.map((r) => ({ ...r, status: normalizarStatusReuniao(r.status) })));
      setEmpresas(es);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados da agenda.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Navegação
  const irParaHoje = () => setDataAtual(new Date());

  const navegarAnterior = () => {
    const nova = new Date(dataAtual);
    if (visualizacao === 'mes') {
      nova.setMonth(nova.getMonth() - 1);
    } else if (visualizacao === 'semana') {
      nova.setDate(nova.getDate() - 7);
    } else if (visualizacao === 'dia') {
      nova.setDate(nova.getDate() - 1);
    }
    setDataAtual(nova);
  };

  const navegarProximo = () => {
    const nova = new Date(dataAtual);
    if (visualizacao === 'mes') {
      nova.setMonth(nova.getMonth() + 1);
    } else if (visualizacao === 'semana') {
      nova.setDate(nova.getDate() + 7);
    } else if (visualizacao === 'dia') {
      nova.setDate(nova.getDate() + 1);
    }
    setDataAtual(nova);
  };

  const anoAtual = dataAtual.getFullYear();
  const mesAtual = dataAtual.getMonth();

  // Feriados do ano em exibição
  const feriadosMap = useMemo(() => {
    const lista = obterFeriados(anoAtual);
    const map = new Map<string, Feriado>();
    for (const f of lista) {
      map.set(f.data, f);
    }
    return map;
  }, [anoAtual]);

  // Contagem de eventos por status para os filtros laterais
  const contagensPorStatus = useMemo(() => {
    const counts = Object.fromEntries(STATUS_VALIDOS_LISTA.map((st) => [st, 0])) as Record<StatusReuniao, number>;
    for (const r of reunioes) {
      counts[normalizarStatusReuniao(r.status)]++;
    }
    // "Todos" é a soma exata dos status, garantindo consistência com os botões
    const todos = STATUS_VALIDOS_LISTA.reduce((soma, st) => soma + counts[st], 0);
    return { ...counts, todos };
  }, [reunioes]);

  // Filtragem de reuniões
  const reunioesFiltradas = useMemo(() => {
    return reunioes.filter(r => {
      const st = normalizarStatusReuniao(r.status);
      if (filtroStatus && st !== filtroStatus) return false;
      if (!mostrarCanceladas && st === 'cancelada' && filtroStatus !== 'cancelada') return false;
      if (termoBusca) {
        const t = termoBusca.toLowerCase();
        const titulo = (r.titulo || '').toLowerCase();
        const empresa = (r.nome_empresa || '').toLowerCase();
        const local = (r.local_reuniao || '').toLowerCase();
        const obs = (r.observacoes || '').toLowerCase();
        if (!titulo.includes(t) && !empresa.includes(t) && !local.includes(t) && !obs.includes(t)) {
          return false;
        }
      }
      return true;
    });
  }, [reunioes, filtroStatus, mostrarCanceladas, termoBusca]);

  // Agrupamento por data (YYYY-MM-DD)
  const reunioesPorData = useMemo(() => {
    const map = new Map<string, Reuniao[]>();
    for (const r of reunioesFiltradas) {
      if (!r.data_hora) continue;
      const dataStr = r.data_hora.slice(0, 10);
      const list = map.get(dataStr) || [];
      list.push(r);
      map.set(dataStr, list);
    }
    return map;
  }, [reunioesFiltradas]);

  // Limpar filtro e retornar imediatamente para a data e mês de hoje
  const limparFiltro = () => {
    setFiltroStatus('');
    setDataAtual(new Date());
  };

  // Ação ao selecionar um filtro: filtra e navega automaticamente para a data do evento
  const selecionarFiltro = (status: StatusReuniao | '') => {
    if (filtroStatus === status || status === '') {
      limparFiltro();
      return;
    }
    setFiltroStatus(status);

    if (status) {
      // Procura eventos com esse status e navega o calendário para o mês/dia correspondente
      const evs = reunioes
        .filter(r => normalizarStatusReuniao(r.status) === status && r.data_hora)
        .sort((a, b) => {
          const da = parseDataEvento(a.data_hora)?.getTime() || 0;
          const db = parseDataEvento(b.data_hora)?.getTime() || 0;
          return da - db;
        });

      if (evs.length > 0) {
        const dataAlvo = parseDataEvento(evs[0].data_hora);
        if (dataAlvo) {
          setDataAtual(dataAlvo);
        }
      }
    }
  };

  // Navegar diretamente para a data de um evento específico e exibir detalhes
  const navegarParaEvento = (r: Reuniao) => {
    const dataAlvo = parseDataEvento(r.data_hora);
    if (dataAlvo) {
      setDataAtual(dataAlvo);
    }
    setReuniaoSelecionada(r);
  };

  // Montagem da grade do mês
  const diasGradeMes = useMemo(() => {
    const primeiroDiaMes = new Date(anoAtual, mesAtual, 1);
    const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0);

    const diaSemanaPrimeiro = primeiroDiaMes.getDay(); // 0 (Dom) a 6 (Sáb)
    const totalDiasMes = ultimoDiaMes.getDate();

    const dias = [];

    // Dias do mês anterior para completar a primeira semana
    const mesAnteriorUltimoDia = new Date(anoAtual, mesAtual, 0).getDate();
    for (let i = diaSemanaPrimeiro - 1; i >= 0; i--) {
      const d = mesAnteriorUltimoDia - i;
      const dataObj = new Date(anoAtual, mesAtual - 1, d);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dataIso = `${dataObj.getFullYear()}-${pad(dataObj.getMonth() + 1)}-${pad(d)}`;
      dias.push({
        dataObj,
        diaNumero: d,
        dataIso,
        ehMesAtual: false,
        ehPrimeiroDia: d === 1,
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDiasMes; d++) {
      const dataObj = new Date(anoAtual, mesAtual, d);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dataIso = `${anoAtual}-${pad(mesAtual + 1)}-${pad(d)}`;
      dias.push({
        dataObj,
        diaNumero: d,
        dataIso,
        ehMesAtual: true,
        ehPrimeiroDia: d === 1,
      });
    }

    // Dias do próximo mês para completar 35 ou 42 células
    const totalRestante = 42 - dias.length;
    if (totalRestante > 0 && totalRestante < 7) {
      for (let d = 1; d <= totalRestante; d++) {
        const dataObj = new Date(anoAtual, mesAtual + 1, d);
        const pad = (n: number) => String(n).padStart(2, '0');
        const dataIso = `${dataObj.getFullYear()}-${pad(dataObj.getMonth() + 1)}-${pad(d)}`;
        dias.push({
          dataObj,
          diaNumero: d,
          dataIso,
          ehMesAtual: false,
          ehPrimeiroDia: d === 1,
        });
      }
    }

    return dias;
  }, [anoAtual, mesAtual]);

  // Ações do formulário de criação/edição
  const abrirCriacaoData = (dataIso?: string) => {
    const dataFinal = dataIso || new Date().toISOString().slice(0, 10);
    setForm({
      empresaId: empresas[0]?.id ? String(empresas[0].id) : '',
      titulo: '',
      data: dataFinal,
      horaInicio: '09:00',
      horaFim: '10:00',
      localReuniao: 'Google Meet',
      observacoes: '',
      status: 'agendada',
    });
    setEditandoReuniao(false);
    setReuniaoSelecionada(null);
    setModalCriarAberto(true);
  };

  const abrirEdicaoReuniao = (r: Reuniao) => {
    const dataStr = r.data_hora ? r.data_hora.slice(0, 10) : '';
    const horaStr = r.data_hora ? r.data_hora.slice(11, 16) : '09:00';
    setForm({
      empresaId: String(r.empresa_id || ''),
      titulo: r.titulo || '',
      data: dataStr,
      horaInicio: horaStr,
      horaFim: '10:00',
      localReuniao: r.local_reuniao || 'Google Meet',
      observacoes: r.observacoes || '',
      status: r.status || 'agendada',
    });
    setReuniaoSelecionada(r);
    setEditandoReuniao(true);
    setModalCriarAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.titulo || !form.data || !form.horaInicio) {
      setErro('Informe o título, data e horário do evento.');
      return;
    }
    const dataHora = `${form.data}T${form.horaInicio}:00`;
    try {
      if (editandoReuniao && reuniaoSelecionada) {
        await atualizarReuniao(reuniaoSelecionada.id, {
          empresaId: form.empresaId ? Number(form.empresaId) : undefined,
          titulo: form.titulo,
          dataHora,
          localReuniao: form.localReuniao,
          observacoes: form.observacoes,
          status: form.status,
        });
        setAlertaSucesso('Evento atualizado com sucesso!');
      } else {
        await agendarReuniao({
          empresaId: Number(form.empresaId || empresas[0]?.id || 1),
          titulo: form.titulo,
          dataHora,
          localReuniao: form.localReuniao,
          observacoes: form.observacoes,
        });
        setAlertaSucesso('Evento agendado com sucesso!');
      }
      setModalCriarAberto(false);
      setErro('');
      await carregarDados();
      setTimeout(() => setAlertaSucesso(''), 3000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar compromisso.');
    }
  };

  const handleExcluir = async (id: number) => {
    if (!window.confirm('Deseja realmente remover este compromisso da agenda?')) return;
    try {
      await excluirReuniao(id);
      setModalCriarAberto(false);
      setReuniaoSelecionada(null);
      setAlertaSucesso('Evento excluído com sucesso.');
      await carregarDados();
      setTimeout(() => setAlertaSucesso(''), 3000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir compromisso.');
    }
  };

  const handleStatusChange = async (id: number, status: StatusReuniao) => {
    try {
      await atualizarStatusReuniao(id, status);
      await carregarDados();
      if (reuniaoSelecionada && reuniaoSelecionada.id === id) {
        setReuniaoSelecionada(prev => prev ? { ...prev, status } : null);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar status.');
    }
  };

  const hojeIso = new Date().toISOString().slice(0, 10);
  const diaHojeNum = new Date().getDate();

  return (
    <div className="google-calendar-container">
      {/* ── Top Toolbar (Estilo Google Calendar) ── */}
      <header className="gcal-toolbar">
        <div className="gcal-toolbar-left">
          <div className="gcal-logo-badge">
            {diaHojeNum}
          </div>
          <h1 className="gcal-title">Agenda</h1>

          <button className="gcal-btn-hoje" onClick={irParaHoje}>
            Hoje
          </button>

          <div style={{ display: 'flex', gap: 2 }}>
            <button className="gcal-nav-btn" onClick={navegarAnterior} title="Anterior">
              ‹
            </button>
            <button className="gcal-nav-btn" onClick={navegarProximo} title="Próximo">
              ›
            </button>
          </div>

          <div style={{ position: 'relative' }} ref={mesAnoRef}>
            <button
              type="button"
              className="gcal-current-period-btn"
              onClick={() => {
                setAnoSelecionadoPicker(dataAtual.getFullYear());
                setMenuMesAnoAberto((v) => !v);
              }}
              title="Clique para escolher mês e ano"
            >
              <span>{NOMES_MESES[mesAtual]} de {anoAtual}</span>
              <span style={{ fontSize: 11, marginLeft: 4 }}>▾</span>
            </button>

            {menuMesAnoAberto && (
              <div className="gcal-month-year-picker-popup">
                <div className="gcal-picker-year-header">
                  <button
                    type="button"
                    className="gcal-picker-nav-btn"
                    onClick={() => setAnoSelecionadoPicker((a) => a - 1)}
                    title="Ano anterior"
                  >
                    ‹
                  </button>
                  <span className="gcal-picker-year-title">{anoSelecionadoPicker}</span>
                  <button
                    type="button"
                    className="gcal-picker-nav-btn"
                    onClick={() => setAnoSelecionadoPicker((a) => a + 1)}
                    title="Próximo ano"
                  >
                    ›
                  </button>
                </div>

                <div className="gcal-picker-months-grid">
                  {NOMES_MESES.map((nome, idx) => {
                    const isMesAtualVisualizado = mesAtual === idx && anoAtual === anoSelecionadoPicker;
                    const isMesRealHoje =
                      new Date().getMonth() === idx && new Date().getFullYear() === anoSelecionadoPicker;
                    return (
                      <button
                        key={nome}
                        type="button"
                        className={`gcal-picker-month-cell ${isMesAtualVisualizado ? 'active' : ''} ${isMesRealHoje ? 'hoje' : ''}`}
                        onClick={() => selecionarMesAno(idx, anoSelecionadoPicker)}
                      >
                        {nome.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>

                <div className="gcal-picker-footer">
                  <button
                    type="button"
                    className="gcal-picker-hoje-btn"
                    onClick={() => {
                      irParaHoje();
                      setMenuMesAnoAberto(false);
                    }}
                  >
                    Ir para Mês Atual ({NOMES_MESES[new Date().getMonth()].slice(0, 3)} {new Date().getFullYear()})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="gcal-toolbar-center">
          <div className="gcal-search-box">
            <IconSearch size={16} style={{ color: '#5f6368' }} />
            <input
              type="text"
              placeholder="Pesquisar reuniões, clientes, postos..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
            />
            {termoBusca && (
              <button
                onClick={() => setTermoBusca('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="gcal-toolbar-right">
          {/* Botão + Criar do Google Calendar */}
          <button className="gcal-create-pill-btn" onClick={() => abrirCriacaoData()}>
            <svg className="gcal-create-plus-icon" viewBox="0 0 36 36">
              <path fill="#4285F4" d="M16 16v14h4V20z" />
              <path fill="#34A853" d="M30 16H20l-4 4h14z" />
              <path fill="#FBBC05" d="M6 16h10l4-4H6z" />
              <path fill="#EA4335" d="M20 16V6h-4v10z" />
              <path fill="none" d="M0 0h36v36H0z" />
            </svg>
            <span>Criar</span>
          </button>

          {/* Seletor de Visualização Dropdown */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              className="gcal-view-selector-btn"
              onClick={() => setMenuVisualizacaoAberto(v => !v)}
            >
              {visualizacao === 'mes' ? 'Mês' : visualizacao === 'semana' ? 'Semana' : visualizacao === 'dia' ? 'Dia' : 'Programação'} ▾
            </button>

            {menuVisualizacaoAberto && (
              <div className="gcal-dropdown-menu">
                <div
                  className={`gcal-dropdown-item ${visualizacao === 'dia' ? 'active' : ''}`}
                  onClick={() => { setVisualizacao('dia'); setMenuVisualizacaoAberto(false); }}
                >
                  <span>Dia</span> <span style={{ fontSize: 11, color: '#888' }}>D</span>
                </div>
                <div
                  className={`gcal-dropdown-item ${visualizacao === 'semana' ? 'active' : ''}`}
                  onClick={() => { setVisualizacao('semana'); setMenuVisualizacaoAberto(false); }}
                >
                  <span>Semana</span> <span style={{ fontSize: 11, color: '#888' }}>W</span>
                </div>
                <div
                  className={`gcal-dropdown-item ${visualizacao === 'mes' ? 'active' : ''}`}
                  onClick={() => { setVisualizacao('mes'); setMenuVisualizacaoAberto(false); }}
                >
                  <span>Mês</span> <span style={{ fontSize: 11, color: '#888' }}>M</span>
                </div>
                <div
                  className={`gcal-dropdown-item ${visualizacao === 'programacao' ? 'active' : ''}`}
                  onClick={() => { setVisualizacao('programacao'); setMenuVisualizacaoAberto(false); }}
                >
                  <span>Programação</span> <span style={{ fontSize: 11, color: '#888' }}>A</span>
                </div>

                <div className="gcal-dropdown-divider" />

                <label className="gcal-dropdown-item" style={{ cursor: 'pointer' }}>
                  <span style={{ fontSize: 13 }}>Mostrar fins de semana</span>
                  <input
                    type="checkbox"
                    checked={mostrarFinsDeSemana}
                    onChange={(e) => setMostrarFinsDeSemana(e.target.checked)}
                  />
                </label>

                <label className="gcal-dropdown-item" style={{ cursor: 'pointer' }}>
                  <span style={{ fontSize: 13 }}>Mostrar feriados nacionais</span>
                  <input
                    type="checkbox"
                    checked={mostrarFeriados}
                    onChange={(e) => setMostrarFeriados(e.target.checked)}
                  />
                </label>

                <label className="gcal-dropdown-item" style={{ cursor: 'pointer' }}>
                  <span style={{ fontSize: 13 }}>Mostrar cancelados</span>
                  <input
                    type="checkbox"
                    checked={mostrarCanceladas}
                    onChange={(e) => setMostrarCanceladas(e.target.checked)}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Alertas de feedback */}
      {alertaSucesso && (
        <div style={{ background: '#e6f4ea', color: '#137333', padding: '8px 16px', fontSize: 13, borderBottom: '1px solid #ceead6', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCheck size={16} /> {alertaSucesso}
        </div>
      )}
      {erro && (
        <div style={{ background: '#fce8e6', color: '#c5221f', padding: '8px 16px', fontSize: 13, borderBottom: '1px solid #fad2cf', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconAlert size={16} /> {erro}
          <button onClick={() => setErro('')} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── Corpo Principal: Conteúdo do Calendário + Card Lateral de Filtros ── */}
      <div className="gcal-main-body">
        <div className="gcal-view-content">
          {/* ── Banner Informativo de Filtro Ativo ── */}
          {filtroStatus && (
            <div className="gcal-filter-banner">
              <div className="gcal-filter-banner-content">
                <span
                  className="gcal-filter-banner-dot"
                  style={{ background: STATUS_COR_REUNIAO[filtroStatus]?.color || '#1976d2' }}
                />
                <span>
                  Filtro: <strong>{ROTULO_STATUS_REUNIAO[filtroStatus]}</strong> ({reunioesFiltradas.length} evento{reunioesFiltradas.length !== 1 ? 's' : ''})
                </span>
                {reunioesFiltradas.length > 0 && (
                  <span className="gcal-filter-banner-dates">
                    · Datas: {reunioesFiltradas.map(r => formatarDataSimplesEvento(r.data_hora)).join(', ')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {reunioesFiltradas.length > 0 && (
                  <button
                    type="button"
                    className="gcal-filter-banner-jump-btn"
                    onClick={() => {
                      const d = parseDataEvento(reunioesFiltradas[0].data_hora);
                      if (d) setDataAtual(d);
                    }}
                    title="Navegar no calendário até a data do evento"
                  >
                    Ir para a data ({NOMES_MESES[parseDataEvento(reunioesFiltradas[0].data_hora)?.getMonth() || 0]}) →
                  </button>
                )}
                <button
                  type="button"
                  className="gcal-filter-banner-clear-btn"
                  onClick={limparFiltro}
                  title="Remover filtro e voltar para a data de hoje"
                >
                  ✕ Limpar filtro
                </button>
              </div>
            </div>
          )}

          {/* ── Visualização: MÊS (Padrão Google Calendar) ── */}
          {visualizacao === 'mes' && (
        <div className="gcal-month-view">
          {/* Cabeçalho dos dias da semana */}
          <div className="gcal-weekday-header-row">
            {DIAS_SEMANA_ABREV.map((dow, idx) => (
              <div key={dow} className="gcal-weekday-cell">
                {dow}
              </div>
            ))}
          </div>

          {/* Grade de dias do mês */}
          <div className="gcal-month-grid">
            {diasGradeMes.map((dia, idx) => {
              const feriado = mostrarFeriados ? feriadosMap.get(dia.dataIso) : null;
              const eventos = reunioesPorData.get(dia.dataIso) || [];
              const ehHoje = dia.dataIso === hojeIso;

              return (
                <div
                  key={dia.dataIso + '_' + idx}
                  className={`gcal-day-cell ${!dia.ehMesAtual ? 'other-month' : ''}`}
                  onClick={() => abrirCriacaoData(dia.dataIso)}
                >
                  <div className="gcal-day-header">
                    <span className={`gcal-day-number ${ehHoje ? 'today' : ''}`}>
                      {dia.diaNumero}
                    </span>
                    {dia.ehPrimeiroDia && (
                      <span className="gcal-first-of-month">
                        {NOMES_MESES_ABREV[dia.dataObj.getMonth()]}
                      </span>
                    )}
                  </div>

                  <div className="gcal-events-list" onClick={(e) => e.stopPropagation()}>
                    {/* Feriado em destaque estilo Google Calendar */}
                    {feriado && (
                      <div className="gcal-event-pill feriado" title={feriado.nome}>
                        {feriado.nome}
                      </div>
                    )}

                    {/* Reuniões e apontamentos agendados */}
                    {eventos.slice(0, 4).map((r) => {
                      const horaFormatada = formatarHoraGoogle(r.data_hora);
                      const statusClass =
                        r.status === 'realizada' ? 'timed-green'
                        : r.status === 'cancelada' ? 'timed-gray'
                        : r.status === 'fechamento' ? 'timed-purple'
                        : r.status === 'pos_venda' ? 'timed-orange'
                        : 'timed-blue';

                      return (
                        <div
                          key={r.id}
                          className={`gcal-event-pill ${statusClass}`}
                          title={`${r.titulo} · ${r.nome_empresa || ''} · ${r.local_reuniao || ''}`}
                          onClick={() => setReuniaoSelecionada(r)}
                        >
                          <span
                            className="gcal-event-dot"
                            style={{ background: STATUS_COR_REUNIAO[r.status]?.color || '#1a73e8' }}
                          />
                          <span style={{ fontWeight: 600 }}>{horaFormatada}</span>
                          <span>{r.titulo}</span>
                        </div>
                      );
                    })}

                    {eventos.length > 4 && (
                      <div
                        className="gcal-more-events"
                        onClick={() => {
                          setDataAtual(new Date(dia.dataObj));
                          setVisualizacao('dia');
                        }}
                      >
                        +{eventos.length - 4} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Visualização: SEMANA ── */}
      {visualizacao === 'semana' && (() => {
        const diaSemanaAtual = dataAtual.getDay();
        const inicioSemana = new Date(dataAtual);
        inicioSemana.setDate(dataAtual.getDate() - diaSemanaAtual);

        const diasSemana = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(inicioSemana);
          d.setDate(inicioSemana.getDate() + i);
          const pad = (n: number) => String(n).padStart(2, '0');
          const dataIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          return { dataObj: d, diaNumero: d.getDate(), dataIso, dow: DIAS_SEMANA_ABREV[i] };
        });

        const horas = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 às 21:00

        return (
          <div className="gcal-week-view">
            <div className="gcal-week-header-row">
              <div style={{ borderRight: '1px solid #dadce0', padding: 8 }} />
              {diasSemana.map((d) => {
                const ehHoje = d.dataIso === hojeIso;
                return (
                  <div key={d.dataIso} className="gcal-week-header-cell">
                    <div className="gcal-week-dow">{d.dow}</div>
                    <div className={`gcal-week-daynum ${ehHoje ? 'today' : ''}`}>{d.diaNumero}</div>
                  </div>
                );
              })}
            </div>

            {/* Feriados / All Day */}
            <div className="gcal-week-allday-row">
              <div className="gcal-allday-label">Dia todo</div>
              {diasSemana.map((d) => {
                const feriado = mostrarFeriados ? feriadosMap.get(d.dataIso) : null;
                return (
                  <div key={d.dataIso} style={{ padding: '4px 6px', borderRight: '1px solid #dadce0' }}>
                    {feriado && (
                      <div className="gcal-event-pill feriado" style={{ fontSize: 11 }}>
                        {feriado.nome}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grade de Horas */}
            <div className="gcal-week-grid">
              <div className="gcal-time-col">
                {horas.map((h) => (
                  <div key={h} className="gcal-time-slot-label">
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {diasSemana.map((d) => {
                const eventos = reunioesPorData.get(d.dataIso) || [];
                return (
                  <div
                    key={d.dataIso}
                    className="gcal-day-col"
                    onClick={() => abrirCriacaoData(d.dataIso)}
                  >
                    {horas.map((h) => (
                      <div key={h} className="gcal-hour-grid-line" />
                    ))}

                    {eventos.map((r) => {
                      const horaH = r.data_hora ? new Date(r.data_hora).getHours() : 9;
                      const horaM = r.data_hora ? new Date(r.data_hora).getMinutes() : 0;
                      if (horaH < 7 || horaH > 21) return null;

                      const topPx = (horaH - 7) * 52 + (horaM / 60) * 52;
                      const cor = STATUS_COR_REUNIAO[r.status] || { bg: '#e8f0fe', color: '#1a73e8' };

                      return (
                        <div
                          key={r.id}
                          className="gcal-week-event-card"
                          style={{
                            top: `${topPx}px`,
                            height: '46px',
                            background: cor.bg,
                            borderLeft: `4px solid ${cor.color}`,
                            color: cor.color,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReuniaoSelecionada(r);
                          }}
                        >
                          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.titulo}
                          </div>
                          <div style={{ fontSize: 10, opacity: 0.85 }}>
                            {formatarHoraGoogle(r.data_hora)} · {r.nome_empresa || 'Sem empresa'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Visualização: DIA ── */}
      {visualizacao === 'dia' && (() => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const dataIso = `${anoAtual}-${pad(mesAtual + 1)}-${pad(dataAtual.getDate())}`;
        const feriado = mostrarFeriados ? feriadosMap.get(dataIso) : null;
        const eventos = reunioesPorData.get(dataIso) || [];
        const horas = Array.from({ length: 15 }, (_, i) => i + 7);

        return (
          <div className="gcal-week-view" style={{ padding: '0 16px' }}>
            <div style={{ padding: '16px 0', borderBottom: '1px solid #dadce0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="gcal-week-daynum today" style={{ width: 44, height: 44, fontSize: 22 }}>
                {dataAtual.getDate()}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: '#202124' }}>
                  {dataAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                {feriado && <span style={{ fontSize: 13, color: '#0b8043', fontWeight: 600 }}>★ {feriado.nome}</span>}
              </div>
            </div>

            <div className="gcal-week-grid" style={{ gridTemplateColumns: '60px 1fr', marginTop: 12 }}>
              <div className="gcal-time-col">
                {horas.map((h) => (
                  <div key={h} className="gcal-time-slot-label">
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              <div className="gcal-day-col" onClick={() => abrirCriacaoData(dataIso)}>
                {horas.map((h) => (
                  <div key={h} className="gcal-hour-grid-line" />
                ))}

                {eventos.map((r) => {
                  const horaH = r.data_hora ? new Date(r.data_hora).getHours() : 9;
                  const horaM = r.data_hora ? new Date(r.data_hora).getMinutes() : 0;
                  const topPx = (horaH - 7) * 52 + (horaM / 60) * 52;
                  const cor = STATUS_COR_REUNIAO[r.status] || { bg: '#e8f0fe', color: '#1a73e8' };

                  return (
                    <div
                      key={r.id}
                      className="gcal-week-event-card"
                      style={{
                        top: `${topPx}px`,
                        height: '50px',
                        background: cor.bg,
                        borderLeft: `4px solid ${cor.color}`,
                        color: cor.color,
                        padding: '6px 12px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setReuniaoSelecionada(r);
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.titulo}</div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        {formatarHoraGoogle(r.data_hora)} · Empresa: {r.nome_empresa || 'Geral'} · Local: {r.local_reuniao || 'Online'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

          {/* ── Visualização: PROGRAMAÇÃO ── */}
          {visualizacao === 'programacao' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {reunioesFiltradas.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#70757a', padding: 40, fontSize: 15 }}>
                  Nenhum evento agendado no período.
                </div>
              ) : (
                Array.from(reunioesPorData.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dataStr, evs]) => {
                    const [ano, mes, dia] = dataStr.split('-').map(Number);
                    const dataObj = new Date(ano, mes - 1, dia);
                    const feriado = mostrarFeriados ? feriadosMap.get(dataStr) : null;

                    return (
                      <div key={dataStr} style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a73e8', borderBottom: '2px solid #e8f0fe', paddingBottom: 6, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span>{dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                          {feriado && (
                            <span style={{ fontSize: 11, background: '#0b8043', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>
                              {feriado.nome}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {evs.map((r) => {
                            const cor = STATUS_COR_REUNIAO[r.status] || { bg: '#f1f3f4', color: '#3c4043' };
                            return (
                              <div
                                key={r.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 16px',
                                  background: '#ffffff',
                                  border: '1px solid #dadce0',
                                  borderLeft: `5px solid ${cor.color}`,
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                }}
                                onClick={() => setReuniaoSelecionada(r)}
                              >
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 15, color: '#202124' }}>{r.titulo}</div>
                                  <div style={{ fontSize: 12, color: '#5f6368', marginTop: 2 }}>
                                    🕒 {formatarHoraGoogle(r.data_hora)} · 🏢 {r.nome_empresa || 'Empresa não informada'} · 📍 {r.local_reuniao || 'Google Meet'}
                                  </div>
                                </div>
                                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 12, background: cor.bg, color: cor.color, fontWeight: 700 }}>
                                  {ROTULO_STATUS_REUNIAO[r.status] || r.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>

        {/* ── Card Lateral Direito: Filtros de Status ── */}
        <aside className="gcal-sidebar-card">
          <div className="gcal-sidebar-header">
            <h3 className="gcal-sidebar-title">Filtros da Agenda</h3>
            {filtroStatus && (
              <button
                type="button"
                className="gcal-btn-limpar-filtro"
                onClick={limparFiltro}
                title="Mostrar todos os eventos e voltar para hoje"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="gcal-status-filters-list">
            {/* 1. Todos */}
            <button
              type="button"
              className={`gcal-status-filter-item ${filtroStatus === '' ? 'active' : ''}`}
              onClick={() => selecionarFiltro('')}
            >
              <div className="gcal-status-filter-info">
                <span className="gcal-status-dot" style={{ background: '#1a73e8' }} />
                <span className="gcal-status-label">Todos</span>
              </div>
              <span className="gcal-status-count-badge">
                {contagensPorStatus.todos || 0}
              </span>
            </button>

            {/* 2 a 7. Agendada, Realizada, Cancelada, Pós-venda, Alinhamento, Fechamento */}
            {(
              [
                { key: 'agendada', label: 'Agendada', color: '#1976d2' },
                { key: 'realizada', label: 'Realizada', color: '#388e3c' },
                { key: 'cancelada', label: 'Cancelada', color: '#c62828' },
                { key: 'pos_venda', label: 'Pós-venda', color: '#7b1fa2' },
                { key: 'alinhamento', label: 'Alinhamento', color: '#f57f17' },
                { key: 'fechamento', label: 'Fechamento', color: '#00695c' },
              ] as const
            ).map((item) => {
              const ativo = filtroStatus === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`gcal-status-filter-item ${ativo ? 'active' : ''}`}
                  onClick={() => selecionarFiltro(item.key)}
                  style={ativo ? { borderColor: item.color, background: `${item.color}15` } : {}}
                >
                  <div className="gcal-status-filter-info">
                    <span className="gcal-status-dot" style={{ background: item.color }} />
                    <span
                      className="gcal-status-label"
                      style={ativo ? { color: item.color, fontWeight: 700 } : {}}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    className="gcal-status-count-badge"
                    style={ativo ? { background: item.color, color: '#ffffff', borderColor: item.color } : {}}
                  >
                    {contagensPorStatus[item.key] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Lista de Eventos com as Datas do Filtro ── */}
          {filtroStatus && (
            <div className="gcal-sidebar-events-section">
              <div className="gcal-sidebar-events-header">
                <span>Datas Encontradas ({reunioesFiltradas.length})</span>
              </div>

              {reunioesFiltradas.length === 0 ? (
                <div className="gcal-sidebar-empty-events">
                  Nenhum evento com status {ROTULO_STATUS_REUNIAO[filtroStatus]}.
                </div>
              ) : (
                <div className="gcal-sidebar-events-list">
                  {reunioesFiltradas.map((r) => {
                    const cor = STATUS_COR_REUNIAO[r.status] || { bg: '#e8f0fe', color: '#1976d2' };
                    const dataFormatada = formatarDataCompletaEvento(r.data_hora);
                    return (
                      <div
                        key={r.id}
                        className="gcal-sidebar-event-item"
                        onClick={() => navegarParaEvento(r)}
                        title="Clique para ir à data deste evento no calendário"
                      >
                        <div className="gcal-sidebar-event-date" style={{ color: cor.color }}>
                          <IconClock size={12} />
                          <span>{dataFormatada}</span>
                        </div>
                        <div className="gcal-sidebar-event-title">{r.titulo}</div>
                        {r.nome_empresa && (
                          <div className="gcal-sidebar-event-company">
                            <IconBuilding size={11} />
                            <span>{r.nome_empresa}</span>
                          </div>
                        )}
                        {r.local_reuniao && (
                          <div className="gcal-sidebar-event-location">
                            <IconMapPin size={11} />
                            <span>{r.local_reuniao}</span>
                          </div>
                        )}
                        <div className="gcal-sidebar-event-action">
                          <span>Ir para a data →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="gcal-sidebar-footer-box">
            <div style={{ fontSize: 11, fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', marginBottom: 4 }}>
              Status da Visualização
            </div>
            <div style={{ fontSize: 12, color: '#5f6368', lineHeight: 1.4 }}>
              {filtroStatus ? (
                <>Exibindo <strong>{reunioesFiltradas.length}</strong> evento(s) marcado(s) como <strong>{ROTULO_STATUS_REUNIAO[filtroStatus]}</strong>.</>
              ) : (
                <>Exibindo todos os <strong>{reunioesFiltradas.length}</strong> compromisso(s).</>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Modal Criar / Editar Evento (Google Calendar Dialog) ── */}
      {modalCriarAberto && (
        <div className="gcal-modal-backdrop" onClick={() => setModalCriarAberto(false)}>
          <div className="gcal-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="gcal-modal-header">
              <h3 style={{ margin: 0, fontSize: 16, color: '#202124' }}>
                {editandoReuniao ? 'Editar Compromisso' : 'Novo Compromisso'}
              </h3>
              <button
                onClick={() => setModalCriarAberto(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#5f6368' }}
              >
                ✕
              </button>
            </div>

            <div className="gcal-modal-body">
              <input
                className="gcal-title-input"
                placeholder="Adicionar título do compromisso *"
                value={form.titulo}
                onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))}
                autoFocus
              />

              <div className="gcal-form-row">
                <div className="gcal-form-field">
                  <label>Data *</label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm(p => ({ ...p, data: e.target.value }))}
                  />
                </div>
                <div className="gcal-form-field">
                  <label>Horário *</label>
                  <input
                    type="time"
                    value={form.horaInicio}
                    onChange={(e) => setForm(p => ({ ...p, horaInicio: e.target.value }))}
                  />
                </div>
              </div>

              <div className="gcal-form-field">
                <label>Empresa / Cliente / Tomador</label>
                <select
                  value={form.empresaId}
                  onChange={(e) => setForm(p => ({ ...p, empresaId: e.target.value }))}
                >
                  <option value="">Selecione a empresa</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome_empresa}</option>
                  ))}
                </select>
              </div>

              <div className="gcal-form-row">
                <div className="gcal-form-field">
                  <label>Local / Link da Reunião</label>
                  <input
                    type="text"
                    placeholder="Ex: Google Meet, Presencial, Posto"
                    value={form.localReuniao}
                    onChange={(e) => setForm(p => ({ ...p, localReuniao: e.target.value }))}
                  />
                </div>
                <div className="gcal-form-field">
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(p => ({ ...p, status: e.target.value as StatusReuniao }))}
                  >
                    {Object.entries(ROTULO_STATUS_REUNIAO).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="gcal-form-field">
                <label>Descrição / Pauta / Observações</label>
                <textarea
                  rows={3}
                  placeholder="Informações adicionais para os participantes..."
                  value={form.observacoes}
                  onChange={(e) => setForm(p => ({ ...p, observacoes: e.target.value }))}
                />
              </div>
            </div>

            <div className="gcal-modal-footer">
              {editandoReuniao && reuniaoSelecionada && (
                <button
                  className="gcal-btn-delete"
                  onClick={() => handleExcluir(reuniaoSelecionada.id)}
                >
                  Excluir
                </button>
              )}
              <button className="gcal-btn-cancel" onClick={() => setModalCriarAberto(false)}>
                Cancelar
              </button>
              <button className="gcal-btn-save" onClick={handleSalvar}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Detalhes do Evento ── */}
      {reuniaoSelecionada && !modalCriarAberto && (
        <div className="gcal-modal-backdrop" onClick={() => setReuniaoSelecionada(null)}>
          <div className="gcal-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="gcal-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: STATUS_COR_REUNIAO[reuniaoSelecionada.status]?.color || '#1a73e8',
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#5f6368', textTransform: 'uppercase' }}>
                  {ROTULO_STATUS_REUNIAO[reuniaoSelecionada.status] || reuniaoSelecionada.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => abrirEdicaoReuniao(reuniaoSelecionada)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#1a73e8', padding: 4 }}
                  title="Editar"
                >
                  <IconEdit size={16} />
                </button>
                <button
                  onClick={() => handleExcluir(reuniaoSelecionada.id)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#d93025', padding: 4 }}
                  title="Excluir"
                >
                  <IconTrash size={16} />
                </button>
                <button
                  onClick={() => setReuniaoSelecionada(null)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#5f6368', padding: 4 }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="gcal-modal-body">
              <h2 style={{ margin: 0, fontSize: 20, color: '#202124' }}>
                {reuniaoSelecionada.titulo}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#3c4043' }}>
                  <IconClock size={16} style={{ color: '#5f6368' }} />
                  <span>
                    {reuniaoSelecionada.data_hora ? new Date(reuniaoSelecionada.data_hora).toLocaleString('pt-BR', {
                      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    }) : '—'}
                  </span>
                </div>

                {reuniaoSelecionada.nome_empresa && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#3c4043' }}>
                    <IconBuilding size={16} style={{ color: '#5f6368' }} />
                    <span><strong>Empresa:</strong> {reuniaoSelecionada.nome_empresa}</span>
                  </div>
                )}

                {reuniaoSelecionada.local_reuniao && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#3c4043' }}>
                    <IconMapPin size={16} style={{ color: '#5f6368' }} />
                    <span><strong>Local:</strong> {reuniaoSelecionada.local_reuniao}</span>
                  </div>
                )}

                {reuniaoSelecionada.agendado_por_nome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#3c4043' }}>
                    <IconUser size={16} style={{ color: '#5f6368' }} />
                    <span><strong>Agendado por:</strong> {reuniaoSelecionada.agendado_por_nome}</span>
                  </div>
                )}

                {reuniaoSelecionada.observacoes && (
                  <div style={{ marginTop: 8, padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: 13, color: '#3c4043' }}>
                    <strong>Observações:</strong>
                    <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{reuniaoSelecionada.observacoes}</p>
                  </div>
                )}
              </div>

              {/* Ações de status rápido */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #dadce0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5f6368', width: '100%' }}>Alterar Status:</span>
                {(Object.keys(ROTULO_STATUS_REUNIAO) as StatusReuniao[]).map((st) => {
                  const ativo = reuniaoSelecionada.status === st;
                  const cor = STATUS_COR_REUNIAO[st];
                  return (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(reuniaoSelecionada.id, st)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 14,
                        fontSize: 12,
                        fontWeight: ativo ? 700 : 500,
                        border: `1px solid ${cor?.color || '#dadce0'}`,
                        background: ativo ? cor?.bg : '#ffffff',
                        color: cor?.color || '#3c4043',
                        cursor: 'pointer',
                      }}
                    >
                      {ROTULO_STATUS_REUNIAO[st]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="gcal-modal-footer">
              <button className="gcal-btn-cancel" onClick={() => setReuniaoSelecionada(null)}>
                Fechar
              </button>
              <button className="gcal-btn-save" onClick={() => abrirEdicaoReuniao(reuniaoSelecionada)}>
                Editar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaSupervisao;
