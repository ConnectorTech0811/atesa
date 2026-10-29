import { ApontamentoDetalhado } from '../../../api/monitoramentoApi';
import { dataLocalISO, parseDataHoraServidor } from '../../../utils/formatters';

// ── Uma linha por jornada ───────────────────────────────────────────────────
// As batidas do App são agrupadas por cooperado na ordem do horário: o deslocamento abre o
// caminho, a entrada abre a jornada, refeição e pausa entram nela e a saída a fecha (mesma
// lógica da apuração: o plantão que vira a noite fica na data da entrada).

export interface Intervalo { ini: ApontamentoDetalhado | null; fim: ApontamentoDetalhado | null }
export interface LinhaJornada {
  chave: string;
  candidatoId: number;
  data: string; // AAAA-MM-DD da entrada (ou do primeiro evento)
  referencia: ApontamentoDetalhado; // fornece cooperado, cliente e vaga
  deslocamento: ApontamentoDetalhado | null;
  entrada: ApontamentoDetalhado | null;
  refeicoes: Intervalo[];
  pausas: Intervalo[];
  saida: ApontamentoDetalhado | null;
  batidas: ApontamentoDetalhado[];
}

const JORNADA_MAXIMA_MS = 26 * 3600 * 1000;
const DESLOCAMENTO_MAXIMO_MS = 6 * 3600 * 1000;
export const msDe = (ap: ApontamentoDetalhado) => parseDataHoraServidor(ap.timestamp_dispositivo).getTime();
export const dataDe = (ap: ApontamentoDetalhado) => dataLocalISO(parseDataHoraServidor(ap.timestamp_dispositivo));
export const horaDe = (ap: ApontamentoDetalhado) => {
  const d = parseDataHoraServidor(ap.timestamp_dispositivo);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const addDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};
export const ehAjustado = (ap: ApontamentoDetalhado) => ap.ajustado === 1 || String(ap.status || '').toLowerCase() === 'ajustado';

export const ROTULO_EVENTO: Record<string, string> = {
  deslocamento_inicio: 'Deslocamento',
  jornada_inicio: 'Entrada',
  refeicao_inicio: 'Início refeição',
  refeicao_fim: 'Fim refeição',
  pausa_inicio: 'Início pausa',
  pausa_fim: 'Fim pausa',
  jornada_fim: 'Saída',
};

export function agruparJornadas(apontamentos: ApontamentoDetalhado[]): LinhaJornada[] {
  const porCooperado = new Map<number, ApontamentoDetalhado[]>();
  for (const ap of apontamentos) {
    if (!porCooperado.has(ap.candidato_id)) porCooperado.set(ap.candidato_id, []);
    porCooperado.get(ap.candidato_id)!.push(ap);
  }
  const linhas: LinhaJornada[] = [];
  for (const [candidatoId, lista] of porCooperado) {
    lista.sort((a, b) => msDe(a) - msDe(b));
    let aberta: LinhaJornada | null = null;
    let deslocamento: ApontamentoDetalhado | null = null;

    const nova = (ref: ApontamentoDetalhado): LinhaJornada => ({
      chave: `${candidatoId}-${ref.id}`, candidatoId, data: dataDe(ref), referencia: ref,
      deslocamento: null, entrada: null, refeicoes: [], pausas: [], saida: null, batidas: [],
    });
    const fechar = () => { if (aberta) linhas.push(aberta); aberta = null; };
    const soltarDeslocamento = () => {
      if (deslocamento) { const l = nova(deslocamento); l.deslocamento = deslocamento; l.batidas.push(deslocamento); linhas.push(l); }
      deslocamento = null;
    };
    const garantirAberta = (ap: ApontamentoDetalhado): LinhaJornada => {
      if (!aberta) aberta = nova(ap);
      return aberta;
    };
    const intervalo = (l: LinhaJornada, campo: 'refeicoes' | 'pausas', ap: ApontamentoDetalhado, inicio: boolean) => {
      const sem = [...l[campo]].reverse().find((i) => !i.fim && i.ini);
      if (inicio) l[campo].push({ ini: ap, fim: null });
      else if (sem) sem.fim = ap;
      else l[campo].push({ ini: null, fim: ap });
    };

    for (const ap of lista) {
      const ms = msDe(ap);
      if (aberta && aberta.entrada && ms - msDe(aberta.entrada) > JORNADA_MAXIMA_MS) fechar();
      switch (ap.tipo_evento) {
        case 'deslocamento_inicio':
          soltarDeslocamento();
          deslocamento = ap;
          continue;
        case 'jornada_inicio': {
          fechar();
          const l = nova(ap);
          l.entrada = ap;
          if (deslocamento && ms - msDe(deslocamento) <= DESLOCAMENTO_MAXIMO_MS) { l.deslocamento = deslocamento; l.batidas.push(deslocamento); deslocamento = null; }
          else soltarDeslocamento();
          aberta = l;
          break;
        }
        case 'refeicao_inicio': case 'refeicao_fim':
          intervalo(garantirAberta(ap), 'refeicoes', ap, ap.tipo_evento === 'refeicao_inicio');
          break;
        case 'pausa_inicio': case 'pausa_fim':
          intervalo(garantirAberta(ap), 'pausas', ap, ap.tipo_evento === 'pausa_inicio');
          break;
        case 'jornada_fim':
          garantirAberta(ap).saida = ap;
          aberta!.batidas.push(ap);
          fechar();
          continue;
        default:
          garantirAberta(ap);
      }
      aberta!.batidas.push(ap);
    }
    fechar();
    soltarDeslocamento();
  }
  return linhas.sort((a, b) => {
    const ta = msDe(a.entrada ?? a.batidas[0]);
    const tb = msDe(b.entrada ?? b.batidas[0]);
    return tb - ta;
  });
}
