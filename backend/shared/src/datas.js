/**
 * Datas no fuso de Brasília.
 *
 * `new Date().toISOString().slice(0, 10)` usa UTC e, no Brasil, já devolve o dia
 * seguinte a partir das 21h. Use estas funções para "data de hoje" e afins.
 */
const FMT_DATA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** AAAA-MM-DD no horário de Brasília. */
export function dataLocalISO(d = new Date()) {
  return FMT_DATA.format(d);
}
