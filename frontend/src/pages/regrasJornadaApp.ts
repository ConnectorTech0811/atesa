// Regras de marcação do App de apontamentos (cooperado).
//  - Sem escala lançada: marcações bloqueadas.
//  - Entrada: no máximo 15 minutos antes do horário previsto de início do plantão.
//  - Finalizar jornada: só depois de 1 hora de trabalho desde a entrada.

export const ANTECEDENCIA_MAXIMA_ENTRADA_MIN = 15;
export const PERMANENCIA_MINIMA_JORNADA_MIN = 60;

/** Plantão lançado nas Escalas (data AAAA-MM-DD e horas HH:MM, horário local). */
export interface EscalaPrevistaApp {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos?: number | null;
}

interface Turno { inicio: Date; fim: Date }

const MIN = 60 * 1000;

function criarTurno(data: string, horaInicio: string, horaFim: string, duracaoMin?: number | null): Turno | null {
  const [a, m, d] = data.split('-').map(Number);
  const [hi, mi] = horaInicio.split(':').map(Number);
  if (!a || !m || !d || isNaN(hi) || isNaN(mi)) return null;
  const inicio = new Date(a, m - 1, d, hi, mi);
  let fim: Date;
  if (duracaoMin && duracaoMin > 0) {
    fim = new Date(inicio.getTime() + duracaoMin * MIN);
  } else {
    const [hf, mf] = horaFim.split(':').map(Number);
    fim = new Date(a, m - 1, d, isNaN(hf) ? hi : hf, isNaN(mf) ? mi : mf);
    if (fim.getTime() <= inicio.getTime()) fim = new Date(fim.getTime() + 24 * 60 * MIN);
  }
  return { inicio, fim };
}

/** Lê "07:00 às 19:00" (ou "7h às 19h") do horário da vaga no Parâmetro. */
export function horarioDaVaga(horario?: string | null): { inicio: string; fim: string } | null {
  const ler = (re: RegExp) => [...String(horario || '').matchAll(re)]
    .map((m) => ({ hh: Number(m[1]), mm: Number(m[2] || 0) }))
    .filter((h) => h.hh <= 23 && h.mm <= 59);
  let horas = ler(/(\d{1,2})\s*:\s*(\d{2})/g);
  if (horas.length < 2) horas = ler(/(\d{1,2})\s*(?::|h)\s*(\d{2})?/gi);
  if (horas.length < 2) return null;
  const hhmm = (h: { hh: number; mm: number }) => `${String(h.hh).padStart(2, '0')}:${String(h.mm).padStart(2, '0')}`;
  return { inicio: hhmm(horas[0]), fim: hhmm(horas[1]) };
}

const dataISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface JanelaEntrada {
  /** true = pode marcar a entrada agora. */
  permitido: boolean;
  /** Início previsto do plantão considerado (null = sem horário previsto: entrada livre). */
  inicioPrevisto: Date | null;
  /** A partir de quando a entrada fica liberada (início previsto − 15 min). */
  liberadaEm: Date | null;
  /** true = nenhuma escala lançada para o cooperado no período (marcações bloqueadas). */
  semEscala?: boolean;
}

/**
 * Janela de entrada: liberada de 15 min antes do início previsto até o fim do plantão.
 * O horário previsto vem das escalas lançadas para o cooperado; sem escala, do horário da vaga.
 * Sem nenhum horário previsto, a entrada não é restringida.
 */
export function janelaEntrada(
  agora: Date,
  escalas: EscalaPrevistaApp[] = [],
  horarioVagaTexto?: string | null,
  { exigirEscala = false }: { exigirEscala?: boolean } = {}
): JanelaEntrada {
  const semEscala: JanelaEntrada = { permitido: false, inicioPrevisto: null, liberadaEm: null, semEscala: true };
  if (exigirEscala && escalas.length === 0) return semEscala;
  let turnos = escalas
    .map((e) => criarTurno(String(e.data).slice(0, 10), String(e.hora_inicio).slice(0, 5), String(e.hora_fim ?? '').slice(0, 5), e.duracao_minutos))
    .filter((t): t is Turno => t !== null);

  if (turnos.length === 0) {
    const h = horarioDaVaga(horarioVagaTexto);
    if (h) {
      turnos = [-1, 0, 1]
        .map((desloc) => criarTurno(dataISO(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + desloc)), h.inicio, h.fim))
        .filter((t): t is Turno => t !== null);
    }
  }
  if (turnos.length === 0) return { permitido: true, inicioPrevisto: null, liberadaEm: null };

  const antecedencia = ANTECEDENCIA_MAXIMA_ENTRADA_MIN * MIN;
  const t = agora.getTime();
  const atual = turnos
    .filter((x) => t >= x.inicio.getTime() - antecedencia && t < x.fim.getTime())
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0];
  if (atual) return { permitido: true, inicioPrevisto: atual.inicio, liberadaEm: new Date(atual.inicio.getTime() - antecedencia) };

  const proximo = turnos
    .filter((x) => x.inicio.getTime() > t)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0];
  if (proximo) return { permitido: false, inicioPrevisto: proximo.inicio, liberadaEm: new Date(proximo.inicio.getTime() - antecedencia) };

  // Todos os plantões previstos já terminaram
  if (exigirEscala) return semEscala;
  return { permitido: true, inicioPrevisto: null, liberadaEm: null };
}

/** Milissegundos que faltam para liberar "Finalizar Jornada" (0 = liberado). */
export function msParaLiberarFimJornada(inicioJornadaIso: string, agora: Date = new Date()): number {
  const inicio = new Date(inicioJornadaIso).getTime();
  if (isNaN(inicio)) return 0;
  return Math.max(0, inicio + PERMANENCIA_MINIMA_JORNADA_MIN * MIN - agora.getTime());
}

export const formatarHoraMin = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function formatarContagem(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface BatidaBasica { tipoEvento: string; timestampDispositivo: string; dataReferencia: string; localId?: string }

/**
 * Batidas que valem para o estado do App: as de hoje e, se a jornada de ontem ainda estiver aberta
 * (plantão noturno que vira o dia), a entrada de ontem e o que veio depois dela.
 */
export function batidasDoPlantao<T extends BatidaBasica>(lista: T[], hojeISO: string): T[] {
  const ordenadas = [...lista].sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));
  const ultimaEntrada = [...ordenadas].reverse().find((b) => b.tipoEvento === 'jornada_inicio');
  const abertaDesde = ultimaEntrada && ultimaEntrada.dataReferencia < hojeISO
    && !ordenadas.some((b) => b.tipoEvento === 'jornada_fim' && b.timestampDispositivo >= ultimaEntrada.timestampDispositivo)
    ? ultimaEntrada.timestampDispositivo
    : null;
  return ordenadas.filter((b) => b.dataReferencia >= hojeISO || (abertaDesde !== null && b.timestampDispositivo >= abertaDesde));
}

/** true = já existe entrada sem saída na lista (impede uma segunda entrada no mesmo plantão). */
export function temJornadaAberta(lista: BatidaBasica[]): boolean {
  const ordenadas = [...lista].sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));
  const ultimaEntrada = [...ordenadas].reverse().find((b) => b.tipoEvento === 'jornada_inicio');
  return Boolean(ultimaEntrada && !ordenadas.some((b) => b.tipoEvento === 'jornada_fim' && b.timestampDispositivo >= ultimaEntrada.timestampDispositivo));
}
