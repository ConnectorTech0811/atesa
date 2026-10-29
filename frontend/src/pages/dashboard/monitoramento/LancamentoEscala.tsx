import React, { useEffect, useMemo, useState } from 'react';
import './LancamentoEscala.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataBR, parseDataHoraServidor } from '../../../utils/formatters';
import { rotuloTipoUsuario, TipoUsuario } from '../../../api/usuariosApi';
import {
  DadosEscala,
  Escala,
  OpcoesEscala,
  Paciente,
  StatusEscala,
  VagaParametrizada,
  atualizarEscala,
  criarEscala,
  excluirEscala,
  listarEscalas,
} from '../../../api/escalaFaturamentoApi';
import ModalSubstituicaoCooperado from './ModalSubstituicaoCooperado';
import { ApontamentoDetalhado, listarTodosApontamentos } from '../../../api/monitoramentoApi';
import ModalEdicaoApontamento from './ModalEdicaoApontamento';
import { agruparJornadas, dataDe, ehAjustado, horaDe, LinhaJornada, msDe, ROTULO_EVENTO } from './jornadaApontamentos';

// ── Helpers ─────────────────────────────────────────────────────────────────
export const fmtHoras = (min: number) => {
  const sinal = min < 0 ? '-' : '';
  const m = Math.abs(Math.round(min));
  return `${sinal}${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// Mesma regra do backend: diurno se o plantão começa entre 07:00 e 18:59
export const turnoDaHora = (h: string) => {
  const hh = Number(String(h).slice(0, 2));
  if (!h || Number.isNaN(hh)) return null;
  return hh >= 7 && hh < 19 ? 'diurno' : 'noturno';
};

export const BadgeTurno: React.FC<{ turno: string }> = ({ turno }) => (
  <span className={`esc-badge ${turno === 'noturno' ? 'esc-badge-noturno' : 'esc-badge-diurno'}`}>
    {turno === 'noturno' ? '🌙 Noturno' : '☀️ Diurno'}
  </span>
);

const rotuloPerfil = (perfil: string) => rotuloTipoUsuario(perfil as TipoUsuario).replace(/ \(.*\)$/, '');

const ROTULO_STATUS: Record<StatusEscala, string> = { prevista: 'Prevista', realizada: 'Realizada', cancelada: 'Cancelada' };

const hojeISO = dataLocalISO();
const primeiroDiaMes = `${hojeISO.slice(0, 8)}01`;
const ultimoDiaMes = (() => {
  const [a, m] = hojeISO.split('-').map(Number);
  return `${hojeISO.slice(0, 8)}${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
})();

const paraMin = (h: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const deMin = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const duracao = (ini: string, fim: string) => {
  const a = paraMin(ini);
  const b = paraMin(fim);
  if (a === null || b === null) return null;
  return b <= a ? b + 1440 - a : b - a;
};

/**
 * Lê o horário parametrizado (texto livre, ex.: "07:00 às 19:00", "19h - 07h").
 * Horas no formato HH:MM têm prioridade, para que um texto como "Plantão 12h: 07:00 às 19:00"
 * não confunda a duração com o horário. Sem dois horários reconhecíveis, o lançamento fica manual.
 */
function horarioDoParametro(texto: string | null): { ini: string; fim: string } | null {
  const ler = (re: RegExp) => [...String(texto || '').matchAll(re)]
    .map((m) => ({ hh: Number(m[1]), mm: Number(m[2] || 0) }))
    .filter((h) => h.hh <= 23 && h.mm <= 59);
  let horas = ler(/(\d{1,2})\s*:\s*(\d{2})/g);
  if (horas.length < 2) horas = ler(/(\d{1,2})\s*(?::|h)\s*(\d{2})?/gi);
  if (horas.length < 2) return null;
  const fmt = (h: { hh: number; mm: number }) => `${String(h.hh).padStart(2, '0')}:${String(h.mm).padStart(2, '0')}`;
  return { ini: fmt(horas[0]), fim: fmt(horas[1]) };
}

const addDias = (isoData: string, n: number) => {
  const [a, m, d] = isoData.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};
/** Início do plantão (data + hora) em ms, no fuso local — mesma base das batidas do App. */
const inicioEscalaMs = (e: Escala) => {
  const [a, m, d] = e.data.slice(0, 10).split('-').map(Number);
  const min = paraMin(e.hora_inicio) ?? 0;
  return new Date(a, m - 1, d, Math.floor(min / 60), min % 60).getTime();
};
const DISTANCIA_MAXIMA_JORNADA_MS = 12 * 3600 * 1000;

/**
 * Liga cada plantão da escala à jornada apontada no App pelo mesmo cooperado: a de entrada mais
 * próxima do início previsto (até 12h). Cada jornada vale para um plantão só (dobras ficam separadas).
 */
function vincularJornadas(escalas: Escala[], jornadas: LinhaJornada[]): Map<number, LinhaJornada> {
  const porCooperado = new Map<number, LinhaJornada[]>();
  jornadas.forEach((j) => {
    if (!porCooperado.has(j.candidatoId)) porCooperado.set(j.candidatoId, []);
    porCooperado.get(j.candidatoId)!.push(j);
  });
  const usadas = new Set<string>();
  const out = new Map<number, LinhaJornada>();
  [...escalas].sort((a, b) => inicioEscalaMs(a) - inicioEscalaMs(b)).forEach((e) => {
    const ini = inicioEscalaMs(e);
    let melhor: LinhaJornada | null = null;
    let menor = DISTANCIA_MAXIMA_JORNADA_MS;
    for (const j of porCooperado.get(e.candidato_id) ?? []) {
      if (usadas.has(j.chave)) continue;
      const dist = Math.abs(msDe(j.entrada ?? j.batidas[0]) - ini);
      if (dist <= menor) { menor = dist; melhor = j; }
    }
    if (melhor) { usadas.add(melhor.chave); out.set(e.id, melhor); }
  });
  return out;
}

const diaSemana = (isoData: string) => {
  const [a, m, d] = isoData.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
};

type TipoLancamento = 'todos' | 'semana' | '12x36' | '5x2' | '6x1';
const DIAS_TIPO: Record<TipoLancamento, number[]> = {
  todos: [0, 1, 2, 3, 4, 5, 6],
  semana: [],
  '12x36': [0, 1, 2, 3, 4, 5, 6],
  '5x2': [1, 2, 3, 4, 5],
  '6x1': [1, 2, 3, 4, 5, 6],
};
const DIAS = [
  { n: 1, rotulo: 'Segunda-feira' }, { n: 5, rotulo: 'Sexta-feira' },
  { n: 2, rotulo: 'Terça-feira' }, { n: 6, rotulo: 'Sábado' },
  { n: 3, rotulo: 'Quarta-feira' }, { n: 0, rotulo: 'Domingo' },
  { n: 4, rotulo: 'Quinta-feira' },
];
const ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const tipoDaEscalaParametrizada = (t: string | null): TipoLancamento | null => {
  const v = String(t || '').toLowerCase();
  if (v === '12x36') return '12x36';
  if (v === '5x2' || v === 'mensal') return '5x2';
  if (v === '6x1') return '6x1';
  return null;
};

const DURACOES = [4, 6, 8, 12, 24];
const POR_PAGINA = 10;

interface Pendente {
  chave: string;
  dados: DadosEscala;
  profissional: string;
  cliente: string;
  local: string;
  atividade: string;
  horario: string;
  periodo: string;
  total: number;
}

// Ícones (stroke = currentColor)
const Ico: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IcoBusca = <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>;
const IcoCliente = <><rect x="4" y="3" width="16" height="18" rx="1" /><line x1="9" y1="7" x2="9" y2="7.01" /><line x1="15" y1="7" x2="15" y2="7.01" /><line x1="9" y1="11" x2="9" y2="11.01" /><line x1="15" y1="11" x2="15" y2="11.01" /><path d="M10 21v-4h4v4" /></>;
const IcoPessoa = <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>;
const IcoAtividade = <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="15" y2="14" /></>;
const IcoCalendario = <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>;
const IcoLista = <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></>;
const IcoLixeira = <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></>;
const IcoLapis = <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></>;
const IcoCheck = <polyline points="20 6 9 17 4 12" />;
const IcoTroca = <><circle cx="9" cy="7" r="4" /><path d="M2 21v-1a6 6 0 0 1 6-6h2" /><polyline points="16 13 19 16 16 19" /><line x1="13" y1="16" x2="22" y2="16" /></>;
const IcoRelogio = <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>;
const IcoMais =<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>;
const IcoDownload = <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>;

// ── Componente ──────────────────────────────────────────────────────────────
export const LancamentoEscala: React.FC<{
  opcoes: OpcoesEscala;
  pacientes: Paciente[];
  onNovoPaciente: (empresaId: number | null) => void;
}> = ({ opcoes, pacientes, onNovoPaciente }) => {
  const { showToast } = useToast();

  // Período e horário
  const [tipo, setTipo] = useState<TipoLancamento>('todos');
  const [dias, setDias] = useState<number[]>(DIAS_TIPO.todos);
  const [dataIni, setDataIni] = useState(hojeISO);
  const [dataFim, setDataFim] = useState(hojeISO);
  const [quantidade, setQuantidade] = useState(1);
  const [horaIni, setHoraIni] = useState('');
  const [horaFim, setHoraFim] = useState('');

  // Profissional / cliente / local / atividade
  const [buscaProf, setBuscaProf] = useState('');
  const [profId, setProfId] = useState<number | ''>('');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [local, setLocal] = useState(''); // "p:<paciente>" ou "u:<unidade>"
  const [vagaId, setVagaId] = useState<number | ''>('');
  const [atividadeLivre, setAtividadeLivre] = useState('');
  const [status, setStatus] = useState<StatusEscala>('prevista');
  const [editando, setEditando] = useState<Escala | null>(null);
  const [substituindo, setSubstituindo] = useState<Escala | null>(null);

  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Lista de lançamentos
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [listaIni, setListaIni] = useState(primeiroDiaMes);
  const [listaFim, setListaFim] = useState(ultimoDiaMes);
  const [filtroTurno, setFiltroTurno] = useState<'' | 'diurno' | 'noturno'>('');
  const [buscaLista, setBuscaLista] = useState('');
  const [pagina, setPagina] = useState(1);

  // Apontamentos do App no período (mesmas colunas da Supervisão); a observação fica só na Supervisão
  const [apontamentos, setApontamentos] = useState<ApontamentoDetalhado[]>([]);
  const [edicaoJornada, setEdicaoJornada] = useState<{ jornada: LinhaJornada; focoId: number | null } | null>(null);

  const carregarApontamentos = async () => {
    try {
      // Um dia a mais em cada ponta para completar plantões que viram a noite
      const LIMITE = 5000;
      const todos: ApontamentoDetalhado[] = [];
      for (let pag = 1; pag <= 20; pag++) {
        const lote = await listarTodosApontamentos({ dataInicio: addDias(listaIni, -1), dataFim: addDias(listaFim, 1), limite: LIMITE, pagina: pag });
        todos.push(...lote);
        if (lote.length < LIMITE) break;
      }
      setApontamentos(todos);
    } catch (e: any) {
      setApontamentos([]);
      showToast(e?.message || 'Erro ao carregar os apontamentos.', 'error');
    }
  };

  const carregarLista = async () => {
    setCarregando(true);
    try {
      setEscalas(await listarEscalas({ dataInicio: listaIni, dataFim: listaFim, turno: filtroTurno }));
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar os lançamentos.', 'error');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregarLista(); }, [listaIni, listaFim, filtroTurno]);
  useEffect(() => { if (listaIni && listaFim) carregarApontamentos(); }, [listaIni, listaFim]);

  const jornadaPorEscala = useMemo(
    () => vincularJornadas(escalas.filter((e) => e.status !== 'cancelada'), agruparJornadas(apontamentos)),
    [escalas, apontamentos],
  );

  // ── Derivados ──
  const profissional = opcoes.cooperados.find((c) => c.id === profId);
  const cliente = opcoes.empresas.find((e) => e.id === clienteId);
  const empresasComParametro = useMemo(() => new Set(opcoes.vagas.map((v) => v.empresa_id)), [opcoes.vagas]);
  const vagasCliente = useMemo(() => opcoes.vagas.filter((v) => v.empresa_id === clienteId), [opcoes.vagas, clienteId]);
  const unidadesCliente = useMemo(() => {
    const m = new Map<number, VagaParametrizada>();
    vagasCliente.forEach((v) => { if (!m.has(v.unidade_id)) m.set(v.unidade_id, v); });
    return [...m.values()];
  }, [vagasCliente]);
  const pacientesCliente = pacientes.filter((p) => p.empresa_id === clienteId || (editando && p.id === editando.paciente_id));
  const pacientesSemCliente = pacientes.filter((p) => !p.empresa_id && !pacientesCliente.includes(p));
  const unidadeLocal = local.startsWith('u:') ? Number(local.slice(2)) : null;
  const pacienteLocal = local.startsWith('p:') ? Number(local.slice(2)) : null;
  const pacienteSel = pacientes.find((p) => p.id === pacienteLocal);
  const vagasDisponiveis = unidadeLocal ? vagasCliente.filter((v) => v.unidade_id === unidadeLocal) : vagasCliente;
  const vaga = opcoes.vagas.find((v) => v.id === vagaId);
  const horarioParam = vaga ? horarioDoParametro(vaga.horario) : null;
  const durMin = duracao(horaIni, horaFim);
  const turno = turnoDaHora(horaIni);

  const profsFiltrados = useMemo(() => {
    const b = buscaProf.trim().toLowerCase();
    const lista = b
      ? opcoes.cooperados.filter((c) => c.nome.toLowerCase().includes(b) || String(c.matricula || '').toLowerCase().includes(b))
      : opcoes.cooperados;
    return lista.slice(0, 100);
  }, [buscaProf, opcoes.cooperados]);

  const clientesFiltrados = useMemo(() => {
    const b = buscaCliente.trim().toLowerCase();
    const lista = b ? opcoes.empresas.filter((e) => e.nome_empresa.toLowerCase().includes(b)) : opcoes.empresas;
    return lista.slice(0, 150);
  }, [buscaCliente, opcoes.empresas]);

  /** Datas geradas pelo período + tipo de lançamento + dias da semana. */
  const datasGeradas = useMemo(() => {
    if (!dataIni || !dataFim || dataFim < dataIni) return [];
    const out: string[] = [];
    let i = 0;
    for (let d = dataIni; d <= dataFim && out.length <= 400; d = addDias(d, 1), i++) {
      if (tipo === '12x36') { if (i % 2 === 0) out.push(d); }
      else if (dias.includes(diaSemana(d))) out.push(d);
    }
    return out;
  }, [dataIni, dataFim, tipo, dias]);

  /** Plantões a lançar: cada data recebe "quantidade" plantões seguidos (ex.: 2 × 12h = dobra). */
  const plantoesGerados = useMemo(() => {
    const ini = paraMin(horaIni);
    if (ini === null || !durMin) return [];
    return datasGeradas.flatMap((data) => Array.from({ length: quantidade }, (_, k) => {
      const inicio = ini + k * durMin;
      return {
        data: addDias(data, Math.floor(inicio / 1440)),
        horaInicio: deMin(inicio),
        horaFim: deMin(inicio + durMin),
      };
    }));
  }, [datasGeradas, quantidade, horaIni, durMin]);

  // ── Ações do formulário ──
  const escolherTipo = (t: TipoLancamento) => {
    setTipo(t);
    if (t !== 'semana') setDias(DIAS_TIPO[t]);
  };
  const alternarDia = (n: number) => {
    setTipo('semana');
    setDias((l) => (l.includes(n) ? l.filter((x) => x !== n) : [...l, n]));
  };

  /**
   * Alocação feita pelo RA: cliente, local e atividade vêm dela e, pela atividade, o horário,
   * o turno e o tipo de escala do Parâmetro. Quem lança só precisa informar as datas.
   * Com mais de uma alocação ativa, nada é presumido.
   */
  const escolherProfissional = (id: number) => {
    setProfId(id);
    if (editando) return;
    const ativas = opcoes.alocacoes.filter((a) => a.candidato_id === id && a.status === 'ativa');
    if (ativas.length !== 1 || !ativas[0].empresa_id) return;
    const aloc = ativas[0];
    escolherCliente(aloc.empresa_id);
    const vagaAloc = aloc.vaga_id ? opcoes.vagas.find((v) => v.id === aloc.vaga_id) : undefined;
    const unidade = aloc.unidade_id ?? vagaAloc?.unidade_id ?? null;
    if (unidade) setLocal(`u:${unidade}`);
    if (vagaAloc) aplicarVaga(vagaAloc);
  };

  /** Sem horário no Parâmetro, o plantão padrão é de 12 horas a partir da hora inicial. */
  const mudarHoraInicial = (valor: string) => {
    setHoraIni(valor);
    const ini = paraMin(valor);
    if (ini !== null && !horaFim) setHoraFim(deMin(ini + 12 * 60));
  };

  const escolherCliente = (id: number) => {
    if (id === clienteId) return;
    setClienteId(id);
    setLocal('');
    setVagaId('');
    setAtividadeLivre('');
    // Cliente com um único local parametrizado e sem pacientes cadastrados: já seleciona o local
    const vagas = opcoes.vagas.filter((v) => v.empresa_id === id);
    const unidades = [...new Set(vagas.map((v) => v.unidade_id))];
    if (unidades.length === 1 && !pacientes.some((p) => p.empresa_id === id)) setLocal(`u:${unidades[0]}`);
    if (vagas.length === 1) aplicarVaga(vagas[0]);
  };

  const escolherLocal = (valor: string) => {
    setLocal(valor);
    if (valor.startsWith('u:') && vaga && vaga.unidade_id !== Number(valor.slice(2))) setVagaId('');
  };

  const aplicarVaga = (v: VagaParametrizada | undefined) => {
    setVagaId(v ? v.id : '');
    if (!v) return;
    const h = horarioDoParametro(v.horario);
    if (h) { setHoraIni(h.ini); setHoraFim(h.fim); }
    const t = tipoDaEscalaParametrizada(v.tipo_escala);
    if (t && !editando) escolherTipo(t);
  };

  const mudarPlantao = (horas: number) => {
    const ini = paraMin(horaIni);
    if (ini === null) { setErro('Informe a hora inicial antes de escolher o plantão.'); return; }
    setHoraFim(deMin(ini + horas * 60));
  };

  const limparFormulario = () => {
    setProfId('');
    setBuscaProf('');
    setLocal('');
    setVagaId('');
    setAtividadeLivre('');
    setStatus('prevista');
    setEditando(null);
    setErro('');
  };

  const atividadeTexto = vaga ? vaga.cargo : atividadeLivre.trim();
  const localTexto = pacienteSel?.nome
    ?? unidadesCliente.find((u) => u.unidade_id === unidadeLocal)?.nome_unidade
    ?? (editando && unidadeLocal === editando.unidade_id ? editando.nome_unidade : null)
    ?? '';

  /** Valida o formulário e monta o lançamento (ou devolve null com a mensagem de erro). */
  const montarLancamento = (): Pendente | null => {
    const faltas: string[] = [];
    if (!profId) faltas.push('profissional');
    if (!clienteId) faltas.push('cliente');
    if (!local) faltas.push('paciente / local');
    if (!atividadeTexto) faltas.push('atividade');
    if (!horaIni || !horaFim) faltas.push('hora inicial e final');
    if (faltas.length) { setErro(`Preencha: ${faltas.join(', ')}.`); return null; }
    if (!durMin) { setErro('Hora inicial e final não podem ser iguais.'); return null; }
    if (!editando) {
      if (dataFim < dataIni) { setErro('A data final deve ser igual ou posterior à data inicial.'); return null; }
      if (plantoesGerados.length === 0) { setErro('Nenhuma data do período corresponde aos dias da semana selecionados.'); return null; }
      if (plantoesGerados.length > 400) { setErro('Limite de 400 plantões por lançamento. Reduza o período.'); return null; }
    }
    const diasTexto = tipo === 'todos' ? 'todos os dias'
      : tipo === '12x36' ? 'dia sim, dia não (12x36)'
        : [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => ABREV[d]).join(', ');
    setErro('');
    return {
      chave: `${Date.now()}-${Math.random()}`,
      dados: {
        candidatoId: Number(profId),
        empresaId: Number(clienteId),
        pacienteId: pacienteLocal,
        unidadeId: unidadeLocal ?? vaga?.unidade_id ?? null,
        vagaId: vagaId ? Number(vagaId) : null,
        atividade: atividadeTexto,
        horaInicio: horaIni,
        horaFim: horaFim,
        status,
        plantoes: plantoesGerados,
      },
      profissional: `${profissional?.nome ?? ''} — Mat. ${profissional?.matricula ?? ''}`,
      cliente: cliente?.nome_empresa ?? '',
      local: localTexto,
      atividade: atividadeTexto,
      horario: `${horaIni} – ${horaFim}${quantidade > 1 ? ` (× ${quantidade} seguidos)` : ''}`,
      periodo: `${formatarDataBR(dataIni)} a ${formatarDataBR(dataFim)} · ${diasTexto}`,
      total: plantoesGerados.length,
    };
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    const l = montarLancamento();
    if (!l) return;
    setSalvando(true);
    try {
      await atualizarEscala(editando.id, { ...l.dados, plantoes: undefined, data: dataIni, observacao: editando.observacao ?? '' });
      showToast('Lançamento atualizado.', 'success');
      limparFormulario();
      carregarLista();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar a alteração.');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarPendente = () => {
    if (editando) { salvarEdicao(); return; }
    const l = montarLancamento();
    if (!l) return;
    setPendentes((p) => [...p, l]);
    // Mantém cliente, período e horário para facilitar lançar o próximo profissional
    setProfId('');
    setBuscaProf('');
  };

  const lancar = async () => {
    const usouFormulario = pendentes.length === 0;
    let fila = pendentes;
    if (usouFormulario) {
      const l = montarLancamento();
      if (!l) return;
      fila = [l];
    }
    setSalvando(true);
    let total = 0;
    try {
      for (const p of fila) {
        const r = await criarEscala(p.dados);
        total += r.ids.length;
        setPendentes((l) => l.filter((x) => x.chave !== p.chave));
      }
      showToast(total > 1 ? `${total} plantões lançados na escala.` : 'Plantão lançado na escala.', 'success');
      if (usouFormulario) limparFormulario();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao lançar a escala.');
    } finally {
      setSalvando(false);
      if (total > 0) carregarLista();
    }
  };

  const editar = (e: Escala) => {
    setEditando(e);
    setErro('');
    setProfId(e.candidato_id);
    setClienteId(e.empresa_id_efetiva ?? '');
    setLocal(e.paciente_id ? `p:${e.paciente_id}` : e.unidade_id ? `u:${e.unidade_id}` : '');
    setVagaId(e.vaga_id ?? '');
    setAtividadeLivre(e.vaga_id ? '' : (e.atividade ?? ''));
    setHoraIni(e.hora_inicio.slice(0, 5));
    setHoraFim(e.hora_fim.slice(0, 5));
    setDataIni(e.data.slice(0, 10));
    setDataFim(e.data.slice(0, 10));
    setTipo('todos');
    setDias(DIAS_TIPO.todos);
    setQuantidade(1);
    setStatus(e.status);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluir = async (e: Escala) => {
    if (!window.confirm(`Excluir o plantão de ${e.cooperado_nome} em ${formatarDataBR(e.data)} (${e.hora_inicio.slice(0, 5)}–${e.hora_fim.slice(0, 5)})?`)) return;
    try {
      await excluirEscala(e.id);
      showToast('Plantão excluído.', 'success');
      if (editando?.id === e.id) limparFormulario();
      carregarLista();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir.', 'error');
    }
  };

  // ── Lista ──
  const listaFiltrada = useMemo(() => {
    const b = buscaLista.trim().toLowerCase();
    if (!b) return escalas;
    return escalas.filter((e) => [e.cooperado_nome, e.matricula, e.nome_empresa, e.paciente_nome, e.nome_unidade, e.atividade, formatarDataBR(e.data)]
      .some((v) => String(v || '').toLowerCase().includes(b)));
  }, [escalas, buscaLista]);
  useEffect(() => { setPagina(1); }, [buscaLista, escalas]);
  const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const linhas = listaFiltrada.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const resumo = useMemo(() => {
    const validas = escalas.filter((e) => e.status !== 'cancelada');
    const soma = (t: string) => validas.filter((e) => e.turno === t).reduce((s, e) => s + e.duracao_minutos, 0);
    return {
      diurnos: validas.filter((e) => e.turno === 'diurno').length,
      noturnos: validas.filter((e) => e.turno === 'noturno').length,
      minDiurnos: soma('diurno'),
      minNoturnos: soma('noturno'),
    };
  }, [escalas]);

  const exportar = async () => {
    const XLSX = await import('xlsx');
    const hora = (ap: ApontamentoDetalhado | null) => (ap ? horaDe(ap) : '');
    const intervalos = (lista: LinhaJornada['refeicoes']) => lista.map((i) => `${hora(i.ini) || '?'} → ${hora(i.fim) || '?'}`).join(' | ');
    const dados = listaFiltrada.map((e) => {
      const j = jornadaPorEscala.get(e.id);
      const ultima = j ? ultimaAlteracaoDe(j) : undefined;
      return {
      'Data': formatarDataBR(e.data),
      'Hora Inicial': e.hora_inicio.slice(0, 5),
      'Hora Final': e.hora_fim.slice(0, 5),
      'Tipo Plantão (h)': Math.round((e.duracao_minutos / 60) * 100) / 100,
      'Turno': e.turno === 'noturno' ? 'Noturno' : 'Diurno',
      'Profissional': e.cooperado_nome,
      'Matrícula': e.matricula,
      'Cliente': e.nome_empresa || '',
      'Atividade Exercida': e.atividade || '',
      'Paciente / Local': e.paciente_nome || e.nome_unidade || '',
      'Situação': ROTULO_STATUS[e.status],
      'Substituição': e.cobre_nome ? `Cobertura de ${e.cobre_nome}` : e.substituido_por_nome ? `Substituído por ${e.substituido_por_nome}` : '',
      'Substituição registrada por': e.substituicao_autor
        ? `${e.substituicao_autor}${e.substituicao_autor_perfil ? ` (${rotuloPerfil(e.substituicao_autor_perfil)})` : ''}${e.substituicao_em ? ` em ${parseDataHoraServidor(e.substituicao_em).toLocaleString('pt-BR')}` : ''}`
        : '',
      'Deslocamento': j ? hora(j.deslocamento) : '',
      'Entrada': j ? hora(j.entrada) : '',
      'Refeição': j ? intervalos(j.refeicoes) : '',
      'Pausa': j ? intervalos(j.pausas) : '',
      'Saída': j ? hora(j.saida) : '',
      'Status': statusJornada(j),
      'Última Alteração': ultima
        ? `${ultima.ajustado_por_nome || 'Supervisão'} em ${parseDataHoraServidor(ultima.ajustado_em!).toLocaleString('pt-BR')}`
        : j ? 'Registro App' : '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Escalas');
    XLSX.writeFile(wb, `ESCALAS ${formatarDataBR(listaIni).replace(/\//g, '-')} A ${formatarDataBR(listaFim).replace(/\//g, '-')}.xlsx`);
  };

  /** Horário de uma batida (igual à Supervisão, sem a observação): clique edita a jornada. */
  const Batida: React.FC<{ ap: ApontamentoDetalhado | null; linha: LinhaJornada }> = ({ ap, linha }) => {
    if (!ap) return <span style={{ color: '#cbd5e1' }}>—</span>;
    const ajustada = ehAjustado(ap);
    const outroDia = dataDe(ap) !== linha.data;
    const dica = [
      ajustada ? `Ajustado por ${ap.ajustado_por_nome || 'Supervisão'}${ap.ajustado_em ? ` em ${parseDataHoraServidor(ap.ajustado_em).toLocaleString('pt-BR')}` : ''}` : 'Registro do App',
      ap.motivo_ajuste ? `Motivo: ${ap.motivo_ajuste}` : '',
      'Clique para editar o horário',
    ].filter(Boolean).join('\n');
    return (
      <button type="button" onClick={() => setEdicaoJornada({ jornada: linha, focoId: ap.id })} title={dica}
        style={{
          border: `1px solid ${ajustada ? '#f59e0b' : ap.status === 'divergente' ? '#fca5a5' : '#e2e8f0'}`,
          background: ajustada ? '#fffbeb' : ap.status === 'divergente' ? '#fef2f2' : '#f8fafc',
          borderRadius: 6, padding: '2px 6px', fontWeight: 700, fontSize: 13, color: '#0f172a', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        {horaDe(ap)}
        {outroDia && <span style={{ fontWeight: 500, fontSize: 10.5, color: '#64748b', marginLeft: 3 }}>{formatarDataBR(dataDe(ap)).slice(0, 5)}</span>}
      </button>
    );
  };

  const Intervalos: React.FC<{ lista: LinhaJornada['refeicoes']; linha: LinhaJornada }> = ({ lista, linha }) => (
    lista.length === 0 ? <span style={{ color: '#cbd5e1' }}>—</span> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {lista.map((i, k) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <Batida ap={i.ini} linha={linha} /><span style={{ color: '#94a3b8' }}>→</span><Batida ap={i.fim} linha={linha} />
          </span>
        ))}
      </div>
    )
  );

  const ultimaAlteracaoDe = (l: LinhaJornada) => l.batidas
    .filter((b) => b.ajustado_em)
    .sort((a, b) => parseDataHoraServidor(b.ajustado_em!).getTime() - parseDataHoraServidor(a.ajustado_em!).getTime())[0];

  const statusJornada = (l: LinhaJornada | undefined) => {
    if (!l) return 'Sem apontamento';
    if (l.batidas.some(ehAjustado)) return 'Ajustado';
    if (l.batidas.some((b) => b.status === 'divergente')) return 'Divergente';
    if (!l.entrada || !l.saida) return 'Incompleta';
    return 'Normal';
  };

  const plantaoHoras = durMin ? durMin / 60 : null;
  const travarHorario = !!horarioParam;

  return (
    <div className="esc-lanc">
      {/* ── Período, dias e horário ── */}
      <section className="esc-card esc-topo">
        <div className="esc-bloco">
          <label className="esc-rotulo" htmlFor="esc-tipo">Tipo de Lançamento</label>
          <select id="esc-tipo" className="esc-input" value={tipo} onChange={(e) => escolherTipo(e.target.value as TipoLancamento)} disabled={!!editando}>
            <option value="todos">Todos os dias</option>
            <option value="semana">Dias selecionados</option>
            <option value="12x36">12x36 (dia sim, dia não)</option>
            <option value="5x2">5x2 (segunda a sexta)</option>
            <option value="6x1">6x1 (segunda a sábado)</option>
          </select>
        </div>

        <div className="esc-bloco esc-dias">
          <span className="esc-rotulo">Dias da semana</span>
          <div className="esc-dias-grade">
            {DIAS.map((d) => (
              <label key={d.n} className="esc-check">
                <input type="checkbox" checked={tipo === '12x36' ? false : dias.includes(d.n)} disabled={!!editando || tipo === '12x36'} onChange={() => alternarDia(d.n)} />
                {d.rotulo}
              </label>
            ))}
          </div>
        </div>

        <div className="esc-bloco">
          <label className="esc-rotulo" htmlFor="esc-dini">{editando ? 'Data' : 'Data Inicial'}</label>
          <input id="esc-dini" type="date" className="esc-input esc-input-data" value={dataIni}
            onChange={(e) => { setDataIni(e.target.value); if (editando || dataFim < e.target.value) setDataFim(e.target.value); }} />
        </div>
        {!editando && (
          <div className="esc-bloco">
            <label className="esc-rotulo" htmlFor="esc-dfim">Data Final</label>
            <input id="esc-dfim" type="date" className="esc-input esc-input-data" value={dataFim} min={dataIni} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        )}

        {!editando && (
          <div className="esc-bloco">
            <span className="esc-rotulo" title="Plantões seguidos por dia (ex.: 2 × 12h = dobra de 24h)">Quantidade</span>
            <div className="esc-qtd">
              <button type="button" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} aria-label="Diminuir">−</button>
              <span>{quantidade}</span>
              <button type="button" onClick={() => setQuantidade((q) => Math.min(3, q + 1))} aria-label="Aumentar">+</button>
            </div>
          </div>
        )}

        <div className="esc-bloco">
          <span className="esc-rotulo">
            Hora Inicial | Final
            {travarHorario && <span className="esc-tag-param" title={`Parametrizado: ${vaga?.horario}`}>Parâmetro</span>}
          </span>
          <div className="esc-horas">
            <input type="time" className="esc-input" value={horaIni} readOnly={travarHorario} onChange={(e) => mudarHoraInicial(e.target.value)} aria-label="Hora inicial" />
            <input type="time" className="esc-input" value={horaFim} readOnly={travarHorario} onChange={(e) => setHoraFim(e.target.value)} aria-label="Hora final" />
          </div>
          {turno && durMin ? <div className="esc-ajuda"><BadgeTurno turno={turno} /> {fmtHoras(durMin)}h</div> : null}
        </div>

        {!editando && (
          <div className="esc-bloco esc-bloco-acao">
            <button type="button" className="esc-btn esc-btn-primario" onClick={lancar} disabled={salvando}>
              <Ico d={IcoCheck} /> {salvando ? 'Lançando...' : pendentes.length ? `Lançar (${pendentes.reduce((s, p) => s + p.total, 0)})` : 'Lançar'}
            </button>
            {plantoesGerados.length > 0 && <div className="esc-ajuda">{plantoesGerados.length} plantão(ões) no período</div>}
          </div>
        )}
      </section>

      {/* ── Profissional, cliente, paciente, atividade ── */}
      <section className="esc-card esc-meio">
        <div className="esc-col">
          <h4 className="esc-titulo"><Ico d={IcoBusca} size={20} /> Buscar Profissional</h4>
          <div className="esc-busca">
            <Ico d={IcoBusca} size={16} />
            <input placeholder="Nome ou matrícula..." value={buscaProf} onChange={(e) => setBuscaProf(e.target.value)} />
            {buscaProf && <button type="button" onClick={() => setBuscaProf('')} aria-label="Limpar busca">✕</button>}
          </div>
          <div className="esc-lista" role="listbox" aria-label="Profissionais">
            {profsFiltrados.length === 0 ? <div className="esc-vazio">Nenhum profissional encontrado.</div>
              : profsFiltrados.map((c) => (
                <button type="button" key={c.id} role="option" aria-selected={c.id === profId}
                  className={`esc-item esc-item-prof ${c.id === profId ? 'ativo' : ''}`} onClick={() => escolherProfissional(c.id)}>
                  <strong>{c.nome}</strong>
                  <span>Mat. {c.matricula}</span>
                </button>
              ))}
          </div>
        </div>

        <div className="esc-col">
          <h4 className="esc-titulo"><Ico d={IcoCliente} size={20} /> Cliente</h4>
          <div className="esc-busca">
            <Ico d={IcoBusca} size={16} />
            <input placeholder="Digite para buscar o cliente..." value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} />
            {buscaCliente && <button type="button" onClick={() => setBuscaCliente('')} aria-label="Limpar busca">✕</button>}
          </div>
          <div className="esc-lista" role="listbox" aria-label="Clientes">
            {clientesFiltrados.length === 0 ? <div className="esc-vazio">Nenhum cliente encontrado.</div>
              : clientesFiltrados.map((e) => (
                <button type="button" key={e.id} role="option" aria-selected={e.id === clienteId}
                  className={`esc-item ${e.id === clienteId ? 'ativo' : ''}`} onClick={() => escolherCliente(e.id)} title={e.nome_empresa}>
                  <span className="esc-item-texto">{e.nome_empresa}</span>
                  {empresasComParametro.has(e.id) && <span className="esc-tag-param" title="Possui atividades e horários parametrizados">Parâmetro</span>}
                </button>
              ))}
          </div>
        </div>

        <div className="esc-col esc-col-detalhe">
          <div className="esc-campo">
            <h4 className="esc-titulo">
              <Ico d={IcoPessoa} size={20} /> Paciente / Local
              {clienteId && <button type="button" className="esc-link" onClick={() => onNovoPaciente(Number(clienteId))}>+ Novo paciente</button>}
            </h4>
            <select className="esc-input" value={local} onChange={(e) => escolherLocal(e.target.value)} disabled={!clienteId}>
              <option value="">{clienteId ? 'Selecione o paciente ou local...' : 'Selecione o cliente primeiro'}</option>
              {pacientesCliente.length > 0 && (
                <optgroup label="Pacientes">
                  {pacientesCliente.map((p) => <option key={`p${p.id}`} value={`p:${p.id}`}>{p.nome}</option>)}
                </optgroup>
              )}
              {pacientesSemCliente.length > 0 && (
                <optgroup label="Pacientes sem cliente vinculado">
                  {pacientesSemCliente.map((p) => <option key={`p${p.id}`} value={`p:${p.id}`}>{p.nome}</option>)}
                </optgroup>
              )}
              {unidadesCliente.length > 0 && (
                <optgroup label="Locais parametrizados">
                  {unidadesCliente.map((u) => <option key={`u${u.unidade_id}`} value={`u:${u.unidade_id}`}>{u.nome_unidade}</option>)}
                </optgroup>
              )}
              {editando?.unidade_id && !unidadesCliente.some((u) => u.unidade_id === editando.unidade_id) && (
                <option value={`u:${editando.unidade_id}`}>{editando.nome_unidade}</option>
              )}
            </select>
            {pacienteSel && (pacienteSel.endereco || pacienteSel.patologia || pacienteSel.cuidados) && (
              <div className="esc-info">
                {pacienteSel.endereco && <div><strong>Endereço:</strong> {pacienteSel.endereco}</div>}
                {pacienteSel.patologia && <div><strong>Patologia:</strong> {pacienteSel.patologia}</div>}
                {pacienteSel.cuidados && <div><strong>Cuidados:</strong> {pacienteSel.cuidados}</div>}
              </div>
            )}
          </div>

          <div className="esc-linha">
            <div className="esc-campo esc-campo-grow">
              <h4 className="esc-titulo"><Ico d={IcoAtividade} size={20} /> Atividade</h4>
              {clienteId && vagasCliente.length === 0 ? (
                <>
                  <textarea className="esc-input esc-textarea" placeholder="Informe a atividade..." value={atividadeLivre} onChange={(e) => setAtividadeLivre(e.target.value)} />
                  <div className="esc-aviso">Cliente sem atividades parametrizadas no Parâmetro — informe manualmente.</div>
                </>
              ) : (
                <>
                  <select className="esc-input" value={vagaId} disabled={!clienteId}
                    onChange={(e) => aplicarVaga(opcoes.vagas.find((v) => v.id === Number(e.target.value)))}>
                    <option value="">{clienteId ? 'Selecione a atividade...' : 'Selecione o cliente primeiro'}</option>
                    {vagasDisponiveis.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.cargo}{v.horario ? ` · ${v.horario}` : ''}{!unidadeLocal && unidadesCliente.length > 1 ? ` · ${v.nome_unidade}` : ''}
                      </option>
                    ))}
                  </select>
                  {vaga && (
                    <div className="esc-info">
                      <div><strong>Local:</strong> {vaga.nome_unidade}</div>
                      {vaga.tipo_atividade && <div><strong>Tipo:</strong> {vaga.tipo_atividade}</div>}
                      <div><strong>Horário:</strong> {vaga.horario || <em>não parametrizado — informe a hora inicial e final</em>}</div>
                      {vaga.intervalo && <div><strong>Intervalo:</strong> {vaga.intervalo}</div>}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="esc-campo esc-campo-plantao">
              <h4 className="esc-titulo"><Ico d={IcoCalendario} size={20} /> Plantão</h4>
              <select className="esc-input" value={plantaoHoras ?? ''} disabled={travarHorario} onChange={(e) => mudarPlantao(Number(e.target.value))}>
                <option value="" disabled>—</option>
                {plantaoHoras && !DURACOES.includes(plantaoHoras) && <option value={plantaoHoras}>{fmtHoras(durMin!)}h</option>}
                {DURACOES.map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
              {editando && (
                <>
                  <h4 className="esc-titulo esc-titulo-sub">Situação</h4>
                  <select className="esc-input" value={status} onChange={(e) => setStatus(e.target.value as StatusEscala)}>
                    <option value="prevista">Prevista</option>
                    <option value="realizada">Realizada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {erro && <div className="esc-erro" role="alert">{erro}</div>}

          <div className="esc-acoes">
            <button type="button" className="esc-btn esc-btn-secundario" onClick={limparFormulario} disabled={salvando}>
              <Ico d={IcoLixeira} /> {editando ? 'Cancelar edição' : 'Limpar'}
            </button>
            <button type="button" className="esc-btn esc-btn-primario" onClick={adicionarPendente} disabled={salvando}>
              <Ico d={editando ? IcoLapis : IcoMais} /> {editando ? (salvando ? 'Salvando...' : 'Salvar Alteração') : 'Adicionar Lançamento'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Lançamentos aguardando confirmação ── */}
      {pendentes.length > 0 && (
        <section className="esc-card">
          <div className="esc-cab">
            <h4 className="esc-titulo"><Ico d={IcoLista} size={20} /> Lançamentos a confirmar <span className="esc-contador">{pendentes.length}</span></h4>
            <span className="esc-ajuda">Confira e clique em <strong>Lançar</strong> para gravar na escala.</span>
          </div>
          <div className="esc-tabela-wrap">
            <table className="esc-tabela">
              <thead>
                <tr><th>Profissional</th><th>Cliente</th><th>Paciente / Local</th><th>Atividade</th><th>Horário</th><th>Período</th><th>Plantões</th><th /></tr>
              </thead>
              <tbody>
                {pendentes.map((p) => (
                  <tr key={p.chave}>
                    <td>{p.profissional}</td><td>{p.cliente}</td><td>{p.local}</td><td>{p.atividade}</td>
                    <td>{p.horario}</td><td>{p.periodo}</td><td style={{ textAlign: 'center' }}>{p.total}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" className="esc-icone esc-icone-excluir" title="Remover" onClick={() => setPendentes((l) => l.filter((x) => x.chave !== p.chave))}><Ico d={IcoLixeira} size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Lançamentos registrados ── */}
      <section className="esc-card">
        <div className="esc-cab">
          <h4 className="esc-titulo"><Ico d={IcoLista} size={20} /> Lançamentos Registrados</h4>
          <div className="esc-cab-filtros">
            <input type="date" className="esc-input esc-input-sm" value={listaIni} onChange={(e) => setListaIni(e.target.value)} aria-label="Data início da lista" />
            <input type="date" className="esc-input esc-input-sm" value={listaFim} onChange={(e) => setListaFim(e.target.value)} aria-label="Data fim da lista" />
            <select className="esc-input esc-input-sm" value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value as any)} aria-label="Turno">
              <option value="">Todos os turnos</option>
              <option value="diurno">Diurno</option>
              <option value="noturno">Noturno</option>
            </select>
            <div className="esc-busca esc-busca-sm">
              <Ico d={IcoBusca} size={15} />
              <input placeholder="Buscar na lista..." value={buscaLista} onChange={(e) => setBuscaLista(e.target.value)} />
            </div>
            <button type="button" className="esc-btn esc-btn-secundario esc-btn-sm" onClick={exportar} disabled={listaFiltrada.length === 0}>
              <Ico d={IcoDownload} size={16} /> Exportar
            </button>
          </div>
        </div>
        <div className="esc-resumo">
          <span><BadgeTurno turno="diurno" /> {resumo.diurnos} plantão(ões) · {fmtHoras(resumo.minDiurnos)}h</span>
          <span><BadgeTurno turno="noturno" /> {resumo.noturnos} plantão(ões) · {fmtHoras(resumo.minNoturnos)}h</span>
        </div>
        <div className="esc-tabela-wrap">
          <table className="esc-tabela">
            <thead>
              <tr>
                <th>Data</th><th>Horário</th><th>Profissional</th><th>Nome do Cliente</th><th>Atividade Exercida</th>
                <th>Tipo Plantão</th><th>Paciente / Local</th><th>Situação</th>
                <th>Deslocamento</th><th>Entrada</th><th>Refeição</th><th>Pausa</th><th>Saída</th><th>Status</th><th>Última Alteração</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando && escalas.length === 0 ? (
                <tr><td colSpan={16} className="esc-vazio">Carregando...</td></tr>
              ) : linhas.length === 0 ? (
                <tr><td colSpan={16} className="esc-vazio">Nenhum plantão lançado no período.</td></tr>
              ) : linhas.map((e) => {
                const j = jornadaPorEscala.get(e.id);
                const st = statusJornada(j);
                const ultima = j ? ultimaAlteracaoDe(j) : undefined;
                return (
                <tr key={e.id} className={`${editando?.id === e.id ? 'esc-linha-ativa' : ''} ${e.status === 'cancelada' ? 'esc-linha-cancelada' : ''}`}>
                  <td>{formatarDataBR(e.data)}</td>
                  <td>{e.hora_inicio.slice(0, 5)} – {e.hora_fim.slice(0, 5)}</td>
                  <td>{e.cooperado_nome}<div className="esc-sub">Mat. {e.matricula}</div></td>
                  <td>{e.nome_empresa || '—'}</td>
                  <td>{e.atividade || '—'}</td>
                  <td>{fmtHoras(e.duracao_minutos).replace(/:00$/, '')}h <BadgeTurno turno={e.turno} /></td>
                  <td>{e.paciente_nome || e.nome_unidade || '—'}</td>
                  <td>
                    {ROTULO_STATUS[e.status]}
                    {e.cobre_nome && <div className="esc-sub esc-sub-cobertura" title={e.observacao ?? ''}>Cobrindo {e.cobre_nome}</div>}
                    {e.substituido_por_nome && <div className="esc-sub" title={e.observacao ?? ''}>Substituído por {e.substituido_por_nome}</div>}
                    {e.substituicao_autor && (
                      <div className="esc-sub" title={e.observacao ?? ''}>
                        por {e.substituicao_autor}{e.substituicao_autor_perfil ? ` (${rotuloPerfil(e.substituicao_autor_perfil)})` : ''}
                        {e.substituicao_em ? ` em ${parseDataHoraServidor(e.substituicao_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </div>
                    )}
                  </td>
                  <td>{j ? <Batida ap={j.deslocamento} linha={j} /> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td>{j ? <Batida ap={j.entrada} linha={j} /> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td>{j ? <Intervalos lista={j.refeicoes} linha={j} /> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td>{j ? <Intervalos lista={j.pausas} linha={j} /> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td>{j ? <Batida ap={j.saida} linha={j} /> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td style={{ textTransform: 'none' }}>
                    {st === 'Ajustado' ? <span className="badge-status badge-ajustado">Ajustado</span>
                      : st === 'Divergente' ? <span className="badge-status badge-divergente">Divergente</span>
                        : st === 'Incompleta' ? <span className="badge-status badge-pendente" title={!j?.entrada ? 'Sem registro de entrada' : 'Sem registro de saída'}>Incompleta</span>
                          : st === 'Normal' ? <span className="badge-status badge-ativo">Normal</span>
                            : <span className="esc-sub">Sem apontamento</span>}
                  </td>
                  <td style={{ textTransform: 'none' }}>
                    {ultima ? (
                      <div className="esc-sub">
                        Por <strong>{ultima.ajustado_por_nome || 'Supervisão'}</strong> em {parseDataHoraServidor(ultima.ajustado_em!).toLocaleDateString('pt-BR')} às {parseDataHoraServidor(ultima.ajustado_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        <div>({ROTULO_EVENTO[ultima.tipo_evento] ?? ultima.tipo_evento})</div>
                      </div>
                    ) : j ? <div className="esc-sub">Registro App</div> : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button type="button" className="esc-icone esc-icone-editar" title="Editar" onClick={() => editar(e)}><Ico d={IcoLapis} size={16} /></button>
                    {j && (
                      <button type="button" className="esc-icone esc-icone-editar" title="Editar os horários dos apontamentos desta jornada"
                        onClick={() => setEdicaoJornada({ jornada: j, focoId: null })}><Ico d={IcoRelogio} size={16} /></button>
                    )}
                    {e.status === 'prevista' && (
                      <button type="button" className="esc-icone esc-icone-substituir" title={`Substituir ${e.cooperado_nome} (cobertura de falta ou troca de vaga)`}
                        onClick={() => setSubstituindo(e)}><Ico d={IcoTroca} size={16} /></button>
                    )}
                    <button type="button" className="esc-icone esc-icone-excluir" title="Excluir" onClick={() => excluir(e)}><Ico d={IcoLixeira} size={16} /></button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="esc-rodape">
          <span>Total de {listaFiltrada.length} registro(s)</span>
          {totalPaginas > 1 && (
            <div className="esc-paginacao">
              <button type="button" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} aria-label="Página anterior">‹</button>
              <span className="ativo">{paginaAtual}</span>
              <span className="esc-sub">de {totalPaginas}</span>
              <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)} aria-label="Próxima página">›</button>
            </div>
          )}
        </div>
      </section>

      {substituindo && (
        <ModalSubstituicaoCooperado
          origem={{ escalaId: substituindo.id }}
          titularNome={substituindo.cooperado_nome}
          plantaoTexto={`${formatarDataBR(substituindo.data)} · ${substituindo.hora_inicio.slice(0, 5)}–${substituindo.hora_fim.slice(0, 5)}`}
          opcoes={opcoes}
          onClose={() => setSubstituindo(null)}
          onSuccess={carregarLista}
        />
      )}

      {edicaoJornada && (
        <ModalEdicaoApontamento
          jornada={edicaoJornada.jornada}
          focoId={edicaoJornada.focoId}
          onClose={() => setEdicaoJornada(null)}
          onSuccess={carregarApontamentos}
        />
      )}
    </div>
  );
};

export default LancamentoEscala;
