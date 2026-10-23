// ── Notas fiscais (NFS-e) e cobranças do processo de faturamento aprovado ───
// Emissão automática (API da NFS-e Nacional, webservice municipal ou RPA) NÃO está implementada:
// a nota é emitida no portal da prefeitura e registrada aqui (número, data, código de verificação,
// PDF/XML). Nenhum valor fiscal é calculado: ISS e retenções são informados como constam na nota.
// O cadastro fiscal_municipios guarda a análise de viabilidade de integração por prefeitura.
import { pool } from '../config/database.js';
import {
  r2, erro, texto, numero, dataISO, emTransacao, garantirEstruturaFinanceira, auditarFin,
  decodificarArquivo, salvarDocumento, listarDocumentos,
} from './financeiroComum.js';

export const MODOS_INTEGRACAO = ['nao_analisado', 'manual', 'api_nacional', 'webservice_municipal', 'rpa'];
export const SITUACOES_MUNICIPIO = ['nao_analisado', 'em_analise', 'aguardando_acesso', 'viavel', 'inviavel'];
export const FORMAS_COBRANCA = ['boleto', 'pix', 'transferencia', 'deposito', 'outro'];

const CAMPOS_VALOR_NOTA = [
  'valor_servicos', 'valor_deducoes', 'valor_iss', 'valor_pis', 'valor_cofins', 'valor_csll', 'valor_irrf', 'valor_inss', 'outras_retencoes',
];
const CAMPOS_NOTA = [
  'municipio_id', 'serie', 'prestador_nome', 'prestador_cnpj', 'tomador_nome', 'tomador_documento', 'tomador_endereco',
  'tomador_municipio', 'tomador_uf', 'codigo_servico', 'discriminacao', ...CAMPOS_VALOR_NOTA, 'aliquota_iss', 'iss_retido', 'valor_liquido',
];

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

// ── Regras puras ────────────────────────────────────────────────────────────
/** Situação da cobrança a partir do total recebido (sem juros/multa presumidos). */
export function situacaoCobranca(valor, recebido) {
  const v = r2(valor);
  const r = r2(recebido);
  if (r <= 0) return 'aberta';
  if (r < v) return 'parcial';
  if (r === v) return 'paga';
  return 'divergente'; // recebido a maior: precisa de análise
}

export function chaveNossoNumero(banco, nossoNumero) {
  const nn = String(nossoNumero ?? '').trim().replace(/^0+(?=\d)/, '');
  return nn ? `${soDigitos(banco) || '000'}|${nn}` : null;
}

export function codigoCobranca(competencia, id) {
  return `COB-${String(competencia).replace('-', '')}-${String(id).padStart(6, '0')}`;
}

// ── Prefeituras (viabilidade de integração) ────────────────────────────────
const normalizarCidade = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const tituloCidade = (s) => String(s).toLowerCase().split(' ').map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');

/**
 * Agrupa as cidades dos clientes ignorando acentos, maiúsculas e espaços; clientes sem UF entram na
 * cidade de mesmo nome quando ela tem uma única UF. Nome exibido: a grafia com acentos/minúsculas do cadastro.
 */
export function agruparCidadesClientes(linhas) {
  const grupos = new Map();
  const semUf = [];
  let semCidade = 0;
  for (const l of linhas) {
    const nome = String(l.cidade ?? '').trim().replace(/\s+/g, ' ');
    if (!nome) { semCidade += Number(l.clientes); continue; }
    const uf = String(l.uf ?? '').trim().toUpperCase();
    if (!uf) { semUf.push({ nome, n: Number(l.clientes) }); continue; }
    const k = `${normalizarCidade(nome)}|${uf}`;
    if (!grupos.has(k)) grupos.set(k, { chave: normalizarCidade(nome), uf, grafias: [], clientes: 0, clientes_sem_uf: 0 });
    const g = grupos.get(k);
    g.grafias.push(nome);
    g.clientes += Number(l.clientes);
  }
  const sem_uf_nao_resolvidos = [];
  for (const s of semUf) {
    const candidatos = [...grupos.values()].filter((g) => g.chave === normalizarCidade(s.nome));
    if (candidatos.length === 1) { candidatos[0].clientes += s.n; candidatos[0].clientes_sem_uf += s.n; candidatos[0].grafias.push(s.nome); }
    else sem_uf_nao_resolvidos.push({ municipio: s.nome, clientes: s.n });
  }
  const escolherGrafia = (lista) => {
    const comMinuscula = lista.filter((g) => /[a-zà-ú]/.test(g));
    const comAcento = comMinuscula.filter((g) => /[^\x00-\x7F]/.test(g));
    return comAcento[0] || comMinuscula[0] || tituloCidade(lista[0]);
  };
  const cidades = [...grupos.values()]
    .map((g) => ({ municipio: escolherGrafia(g.grafias), uf: g.uf, chave: g.chave, clientes: g.clientes, clientes_sem_uf: g.clientes_sem_uf }))
    .sort((a, b) => b.clientes - a.clientes || a.municipio.localeCompare(b.municipio));
  return { cidades, sem_uf_nao_resolvidos, sem_cidade: semCidade };
}

export async function listarMunicipios() {
  await garantirEstruturaFinanceira();
  const [rows] = await pool.query(`SELECT * FROM fiscal_municipios ORDER BY prefeitura_emissora DESC, uf, municipio`);
  const [linhas] = await pool.query(`SELECT cidade, uf, COUNT(*) AS clientes FROM empresas GROUP BY cidade, uf`);
  const { cidades, sem_uf_nao_resolvidos, sem_cidade } = agruparCidadesClientes(linhas);
  const cadastrados = new Map(rows.map((m) => [`${normalizarCidade(m.municipio)}|${m.uf}`, m]));
  const cidades_clientes = cidades.map((c) => {
    const m = cadastrados.get(`${c.chave}|${c.uf}`);
    return { ...c, municipio_id: m?.id ?? null, situacao: m?.situacao ?? null };
  });
  return {
    municipios: rows,
    emissora: rows.find((m) => Number(m.prefeitura_emissora)) ?? null,
    cidades_clientes,
    cidades_clientes_sem_analise: cidades_clientes.filter((c) => !c.municipio_id),
    clientes_sem_uf: sem_uf_nao_resolvidos,
    clientes_sem_cidade: sem_cidade,
  };
}

function montarMunicipio(dados) {
  const municipio = texto(dados.municipio, 120);
  const uf = String(dados.uf || '').trim().toUpperCase();
  if (!municipio) throw erro(400, 'Informe o município.');
  if (!/^[A-Z]{2}$/.test(uf)) throw erro(400, 'UF inválida.');
  const modo = dados.modoIntegracao || 'nao_analisado';
  const situacao = dados.situacao || 'nao_analisado';
  if (!MODOS_INTEGRACAO.includes(modo)) throw erro(400, 'Modo de integração inválido.');
  if (!SITUACOES_MUNICIPIO.includes(situacao)) throw erro(400, 'Situação inválida.');
  const ibge = dados.codigoIbge ? soDigitos(dados.codigoIbge) : null;
  if (ibge && ibge.length !== 7) throw erro(400, 'Código IBGE deve ter 7 dígitos.');
  return {
    municipio, uf, codigo_ibge: ibge, sistema: texto(dados.sistema, 150), url: texto(dados.url, 300),
    modo_integracao: modo, situacao, requisitos: texto(dados.requisitos, 5000),
    pendencias: texto(dados.pendencias, 5000), observacoes: texto(dados.observacoes, 5000),
    prefeitura_emissora: dados.prefeituraEmissora === true || dados.prefeituraEmissora === 1 || dados.prefeituraEmissora === 'true' ? 1 : 0,
  };
}

export async function salvarMunicipio(id, dados, usuario) {
  await garantirEstruturaFinanceira();
  const m = montarMunicipio(dados);
  return emTransacao(async (conn) => {
    const [todos] = await conn.query(`SELECT id, municipio, uf FROM fiscal_municipios`);
    const igual = todos.find((x) => Number(x.id) !== Number(id || 0) && x.uf === m.uf && normalizarCidade(x.municipio) === normalizarCidade(m.municipio));
    if (igual) throw erro(409, `Município já cadastrado (${igual.municipio}/${igual.uf}).`);
    // Só uma prefeitura emissora: marcar uma desmarca a anterior
    if (m.prefeitura_emissora) {
      const [ant] = await conn.query(`SELECT id, municipio FROM fiscal_municipios WHERE prefeitura_emissora = 1 AND id <> ?`, [Number(id || 0)]);
      for (const x of ant) {
        await conn.query(`UPDATE fiscal_municipios SET prefeitura_emissora = 0 WHERE id = ?`, [x.id]);
        await auditarFin(conn, usuario, { entidade: 'municipio', entidadeId: x.id, acao: 'edicao', campo: 'prefeitura_emissora', anterior: 1, novo: 0 });
      }
    }
    if (!id) {
      try {
        const [res] = await conn.query(
          `INSERT INTO fiscal_municipios (municipio, uf, codigo_ibge, sistema, url, modo_integracao, situacao, requisitos, pendencias, observacoes, prefeitura_emissora, atualizado_por_nome)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.municipio, m.uf, m.codigo_ibge, m.sistema, m.url, m.modo_integracao, m.situacao, m.requisitos, m.pendencias, m.observacoes, m.prefeitura_emissora, usuario.nome ?? null]
        );
        await auditarFin(conn, usuario, { entidade: 'municipio', entidadeId: res.insertId, acao: 'criacao', novo: m });
        return { ok: true, id: res.insertId };
      } catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Município já cadastrado.');
        throw err;
      }
    }
    const [[atual]] = await conn.query(`SELECT * FROM fiscal_municipios WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!atual) throw erro(404, 'Município não encontrado.');
    const alterados = Object.keys(m).filter((c) => String(atual[c] ?? '') !== String(m[c] ?? ''));
    if (alterados.length) {
      await conn.query(
        `UPDATE fiscal_municipios SET ${alterados.map((c) => `${c} = ?`).join(', ')}, atualizado_por_nome = ? WHERE id = ?`,
        [...alterados.map((c) => m[c]), usuario.nome ?? null, atual.id]
      );
      for (const c of alterados) await auditarFin(conn, usuario, { entidade: 'municipio', entidadeId: atual.id, acao: 'edicao', campo: c, anterior: atual[c], novo: m[c] });
    }
    return { ok: true, id: atual.id };
  });
}

// ── Notas fiscais ───────────────────────────────────────────────────────────
async function carregarProcessoAprovado(conn, processoId) {
  const [[p]] = await conn.query(
    `SELECT p.*, e.nome_empresa, e.cnpj, e.cpf, e.rua, e.numero AS end_numero, e.complemento, e.bairro, e.cidade, e.uf
       FROM faturamento_processos p JOIN empresas e ON e.id = p.empresa_id WHERE p.id = ?`,
    [Number(processoId)]
  );
  if (!p) throw erro(404, 'Processo de faturamento não encontrado.');
  if (p.status !== 'aprovado') throw erro(409, 'Notas fiscais e cobranças só podem ser registradas para processos com apuração aprovada.');
  return p;
}

function montarDadosNota(dados, atual = {}) {
  const n = {};
  for (const c of CAMPOS_NOTA) {
    const chaveCamel = c.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    if (!(chaveCamel in dados) && !(c in dados)) {
      n[c] = atual[c] ?? (CAMPOS_VALOR_NOTA.includes(c) || c === 'iss_retido' ? 0 : null);
      continue;
    }
    const v = chaveCamel in dados ? dados[chaveCamel] : dados[c];
    if (CAMPOS_VALOR_NOTA.includes(c) || c === 'valor_liquido') {
      const x = numero(v);
      if (Number.isNaN(x) || (x !== null && x < 0)) throw erro(400, `Valor inválido em ${c}.`);
      n[c] = x === null ? (c === 'valor_liquido' ? null : 0) : r2(x);
    } else if (c === 'aliquota_iss') {
      const x = numero(v);
      if (Number.isNaN(x) || (x !== null && (x < 0 || x > 100))) throw erro(400, 'Alíquota de ISS inválida.');
      n[c] = x;
    } else if (c === 'iss_retido') {
      n[c] = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
    } else if (c === 'municipio_id') {
      n[c] = v ? Number(v) : null;
    } else if (c === 'prestador_cnpj' || c === 'tomador_documento') {
      const d = soDigitos(v);
      if (d && ![11, 14].includes(d.length)) throw erro(400, `Documento inválido em ${c}.`);
      n[c] = d || null;
    } else if (c === 'tomador_uf') {
      n[c] = texto(v, 2)?.toUpperCase() ?? null;
    } else {
      n[c] = texto(v, c === 'discriminacao' ? 10000 : 300);
    }
  }
  return n;
}

export async function listarNotas(processoId) {
  await garantirEstruturaFinanceira();
  const [rows] = await pool.query(
    `SELECT n.*, m.municipio AS municipio_emissor, m.uf AS uf_emissor, m.situacao AS municipio_situacao, m.modo_integracao
       FROM faturamento_notas n LEFT JOIN fiscal_municipios m ON m.id = n.municipio_id
      WHERE n.processo_id = ? ORDER BY n.criado_em`,
    [Number(processoId)]
  );
  for (const n of rows) n.documentos = await listarDocumentos('nota', n.id);
  return rows;
}

export async function criarNota(processoId, dados, usuario) {
  await garantirEstruturaFinanceira();
  return emTransacao(async (conn) => {
    const p = await carregarProcessoAprovado(conn, processoId);
    const endereco = [p.rua, p.end_numero, p.complemento, p.bairro].filter((x) => String(x || '').trim()).join(', ') || null;
    // Pré-preenchimento com os cadastros (editável); valores fiscais ficam para o usuário informar
    const base = {
      prestador_nome: p.cooperativa, tomador_nome: p.nome_empresa, tomador_documento: soDigitos(p.cnpj || p.cpf) || null,
      tomador_endereco: endereco, tomador_municipio: p.cidade || null, tomador_uf: p.uf || null,
    };
    // Campos deixados em branco no formulário mantêm o pré-preenchimento
    const informados = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== null && v !== undefined));
    const n = montarDadosNota(informados, base);
    if (n.municipio_id) {
      const [[m]] = await conn.query(`SELECT id FROM fiscal_municipios WHERE id = ?`, [n.municipio_id]);
      if (!m) throw erro(400, 'Prefeitura emissora não cadastrada.');
    }
    const cols = Object.keys(n);
    const [res] = await conn.query(
      `INSERT INTO faturamento_notas (processo_id, competencia, status, modo_emissao, ${cols.join(', ')}, criado_por_id, criado_por_nome)
       VALUES (?, ?, 'rascunho', 'manual_portal', ${cols.map(() => '?').join(', ')}, ?, ?)`,
      [p.id, p.competencia, ...cols.map((c) => n[c]), usuario.id ?? null, usuario.nome ?? null]
    );
    await auditarFin(conn, usuario, { entidade: 'nota', entidadeId: res.insertId, processoId: p.id, acao: 'criacao', novo: n });
    return { ok: true, id: res.insertId };
  });
}

async function carregarNota(conn, id) {
  const [[n]] = await conn.query(`SELECT * FROM faturamento_notas WHERE id = ? FOR UPDATE`, [Number(id)]);
  if (!n) throw erro(404, 'Nota fiscal não encontrada.');
  return n;
}

export async function atualizarNota(id, dados, usuario) {
  await garantirEstruturaFinanceira();
  return emTransacao(async (conn) => {
    const atual = await carregarNota(conn, id);
    if (atual.status !== 'rascunho') throw erro(409, 'Somente notas em rascunho podem ser alteradas; cancele e registre outra se necessário.');
    const n = montarDadosNota(dados, atual);
    const alterados = Object.keys(n).filter((c) => String(atual[c] ?? '') !== String(n[c] ?? '') && !(Number.isFinite(Number(atual[c])) && atual[c] !== null && n[c] !== null && Number(atual[c]) === Number(n[c])));
    if (!alterados.length) return { ok: true };
    await conn.query(`UPDATE faturamento_notas SET ${alterados.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...alterados.map((c) => n[c]), atual.id]);
    for (const c of alterados) {
      await auditarFin(conn, usuario, { entidade: 'nota', entidadeId: atual.id, processoId: atual.processo_id, acao: 'edicao', campo: c, anterior: atual[c], novo: n[c] });
    }
    return { ok: true };
  });
}

/** Registra os dados de uma nota emitida no portal da prefeitura (não emite nada). */
export async function registrarEmissaoNota(id, dados, usuario) {
  await garantirEstruturaFinanceira();
  const numeroNf = texto(dados.numero, 30);
  const dataEmissao = dataISO(dados.dataEmissao);
  if (!numeroNf) throw erro(400, 'Informe o número da nota emitida.');
  if (!dataEmissao) throw erro(400, 'Informe a data de emissão.');
  return emTransacao(async (conn) => {
    const n = await carregarNota(conn, id);
    if (n.status !== 'rascunho') throw erro(409, `A nota está "${n.status}".`);
    if (!(Number(n.valor_servicos) > 0)) throw erro(400, 'Informe o valor dos serviços antes de registrar a emissão.');
    if (!n.municipio_id) throw erro(400, 'Informe a prefeitura emissora antes de registrar a emissão.');
    const serie = texto(dados.serie, 10) ?? n.serie;
    const chave = `${n.municipio_id}|${serie || ''}|${numeroNf.replace(/^0+(?=\d)/, '')}`;
    try {
      await conn.query(
        `UPDATE faturamento_notas SET status = 'emitida', numero = ?, serie = ?, chave_numero = ?, codigo_verificacao = ?, data_emissao = ?,
                emitida_registrada_por_nome = ? WHERE id = ?`,
        [numeroNf, serie, chave, texto(dados.codigoVerificacao, 60), dataEmissao, usuario.nome ?? null, n.id]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, `A nota nº ${numeroNf} desta prefeitura/série já está registrada em outro processo.`);
      throw err;
    }
    await auditarFin(conn, usuario, {
      entidade: 'nota', entidadeId: n.id, processoId: n.processo_id, acao: 'registro_emissao',
      anterior: 'rascunho', novo: { numero: numeroNf, serie, data_emissao: dataEmissao, codigo_verificacao: dados.codigoVerificacao ?? null },
    });
    return { ok: true };
  });
}

/** Emissão automática: ainda não há integração homologada com nenhuma prefeitura. */
export async function emitirNotaAutomaticamente(id) {
  await garantirEstruturaFinanceira();
  const [[n]] = await pool.query(
    `SELECT n.id, m.municipio, m.uf, m.situacao, m.modo_integracao, m.pendencias
       FROM faturamento_notas n LEFT JOIN fiscal_municipios m ON m.id = n.municipio_id WHERE n.id = ?`,
    [Number(id)]
  );
  if (!n) throw erro(404, 'Nota fiscal não encontrada.');
  const onde = n.municipio ? `${n.municipio}/${n.uf}` : 'a prefeitura (não informada)';
  throw erro(501, `Emissão automática indisponível para ${onde}: nenhuma integração foi homologada.`
    + (n.pendencias ? ` Pendências: ${n.pendencias}` : ' Registre a nota emitida no portal da prefeitura.'), { codigo: 'INTEGRACAO_NFSE_INDISPONIVEL' });
}

export async function cancelarNota(id, { motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do cancelamento.');
  return emTransacao(async (conn) => {
    const n = await carregarNota(conn, id);
    if (n.status === 'cancelada') throw erro(409, 'Nota já cancelada.');
    const [[{ ativas }]] = await conn.query(
      `SELECT COUNT(*) AS ativas FROM faturamento_cobrancas WHERE nota_id = ? AND status <> 'cancelada'`, [n.id]
    );
    if (Number(ativas)) throw erro(409, 'Há cobranças ativas vinculadas a esta nota; cancele-as antes.');
    // chave_numero = NULL: o número volta a poder ser registrado (ex.: nota substituta)
    await conn.query(`UPDATE faturamento_notas SET status = 'cancelada', chave_numero = NULL, motivo_cancelamento = ? WHERE id = ?`, [mot, n.id]);
    await auditarFin(conn, usuario, {
      entidade: 'nota', entidadeId: n.id, processoId: n.processo_id, acao: 'cancelamento', anterior: n.status, novo: 'cancelada',
      motivo: n.status === 'emitida' ? `${mot} (o cancelamento na prefeitura deve ser feito no portal)` : mot,
    });
    return { ok: true };
  });
}

export async function anexarDocumentoNota(id, dados, usuario) {
  await garantirEstruturaFinanceira();
  const tipo = dados.tipo === 'xml' ? 'nf_xml' : 'nf_pdf';
  const arquivo = decodificarArquivo(dados, tipo === 'nf_xml' ? ['xml'] : ['pdf']);
  return emTransacao(async (conn) => {
    const n = await carregarNota(conn, id);
    if (n.status === 'cancelada') throw erro(409, 'Nota cancelada.');
    const docId = await salvarDocumento(conn, { entidade: 'nota', entidadeId: n.id, tipo, arquivo }, usuario);
    await auditarFin(conn, usuario, { entidade: 'nota', entidadeId: n.id, processoId: n.processo_id, acao: 'documento', novo: { tipo, arquivo: arquivo.nome, sha256: arquivo.sha256 } });
    return { ok: true, id: docId };
  });
}

// ── Cobranças ───────────────────────────────────────────────────────────────
function montarCobranca(dados, atual = {}) {
  const pegar = (camel, snake) => (camel in dados ? dados[camel] : snake in dados ? dados[snake] : atual[snake]);
  const valor = numero(pegar('valor', 'valor'));
  if (valor === null || Number.isNaN(valor) || valor <= 0) throw erro(400, 'Informe o valor da cobrança.');
  const vencimento = dataISO(pegar('vencimento', 'vencimento'));
  if (!vencimento) throw erro(400, 'Informe o vencimento da cobrança.');
  const forma = pegar('forma', 'forma');
  if (!FORMAS_COBRANCA.includes(forma)) throw erro(400, 'Forma de cobrança inválida.');
  const banco = soDigitos(pegar('bancoCodigo', 'banco_codigo')) || null;
  if (banco && banco.length !== 3) throw erro(400, 'Código do banco deve ter 3 dígitos.');
  const nossoNumero = texto(pegar('nossoNumero', 'nosso_numero'), 40);
  if (nossoNumero && !banco) throw erro(400, 'Informe o banco do nosso número.');
  return {
    nota_id: pegar('notaId', 'nota_id') ? Number(pegar('notaId', 'nota_id')) : null,
    valor: r2(valor), vencimento, forma, banco_codigo: banco, nosso_numero: nossoNumero,
    chave_nosso_numero: chaveNossoNumero(banco, nossoNumero),
    linha_digitavel: soDigitos(pegar('linhaDigitavel', 'linha_digitavel')) || null,
    observacao: texto(pegar('observacao', 'observacao'), 5000),
  };
}

async function validarNotaDaCobranca(conn, c, processoId) {
  if (!c.nota_id) return;
  const [[n]] = await conn.query(`SELECT id, processo_id, status FROM faturamento_notas WHERE id = ?`, [c.nota_id]);
  if (!n || Number(n.processo_id) !== Number(processoId)) throw erro(400, 'A nota fiscal informada não pertence a este processo.');
  if (n.status !== 'emitida') throw erro(400, 'A cobrança só pode ser vinculada a uma nota emitida.');
}

export async function listarCobrancas({ processoId, empresaId, status, vencidas, busca } = {}) {
  await garantirEstruturaFinanceira();
  let sql = `
    SELECT c.*, p.codigo AS processo_codigo, p.competencia, e.nome_empresa, n.numero AS nota_numero,
           (c.status IN ('aberta','parcial') AND c.vencimento < CURDATE()) AS vencida,
           c.valor - c.valor_recebido AS saldo
      FROM faturamento_cobrancas c
      JOIN faturamento_processos p ON p.id = c.processo_id
      JOIN empresas e ON e.id = c.empresa_id
      LEFT JOIN faturamento_notas n ON n.id = c.nota_id
     WHERE 1=1`;
  const params = [];
  if (processoId) { sql += ' AND c.processo_id = ?'; params.push(Number(processoId)); }
  if (empresaId) { sql += ' AND c.empresa_id = ?'; params.push(Number(empresaId)); }
  if (status) { sql += ' AND c.status IN (?)'; params.push(String(status).split(',')); }
  if (vencidas === 'true' || vencidas === true) sql += ` AND c.status IN ('aberta','parcial') AND c.vencimento < CURDATE()`;
  if (busca) {
    sql += ' AND (c.codigo LIKE ? OR c.nosso_numero LIKE ? OR e.nome_empresa LIKE ? OR n.numero = ?)';
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, String(busca));
  }
  sql += ' ORDER BY c.vencimento, c.id LIMIT 1000';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function criarCobranca(processoId, dados, usuario) {
  await garantirEstruturaFinanceira();
  const c = montarCobranca(dados);
  return emTransacao(async (conn) => {
    const p = await carregarProcessoAprovado(conn, processoId);
    await validarNotaDaCobranca(conn, c, p.id);
    let res;
    try {
      [res] = await conn.query(
        `INSERT INTO faturamento_cobrancas (processo_id, nota_id, empresa_id, valor, vencimento, forma, banco_codigo, nosso_numero, chave_nosso_numero, linha_digitavel, observacao, criado_por_id, criado_por_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, c.nota_id, p.empresa_id, c.valor, c.vencimento, c.forma, c.banco_codigo, c.nosso_numero, c.chave_nosso_numero,
          c.linha_digitavel, c.observacao, usuario.id ?? null, usuario.nome ?? null]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Este nosso número já está em outra cobrança do mesmo banco.');
      throw err;
    }
    const codigo = codigoCobranca(p.competencia, res.insertId);
    await conn.query(`UPDATE faturamento_cobrancas SET codigo = ? WHERE id = ?`, [codigo, res.insertId]);
    await auditarFin(conn, usuario, { entidade: 'cobranca', entidadeId: res.insertId, processoId: p.id, acao: 'criacao', novo: { codigo, ...c } });
    return { ok: true, id: res.insertId, codigo };
  });
}

async function carregarCobranca(conn, id) {
  const [[c]] = await conn.query(`SELECT * FROM faturamento_cobrancas WHERE id = ? FOR UPDATE`, [Number(id)]);
  if (!c) throw erro(404, 'Cobrança não encontrada.');
  return c;
}

export async function atualizarCobranca(id, dados, usuario) {
  await garantirEstruturaFinanceira();
  return emTransacao(async (conn) => {
    const atual = await carregarCobranca(conn, id);
    if (atual.status === 'cancelada') throw erro(409, 'Cobrança cancelada.');
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM financeiro_recebimentos WHERE cobranca_id = ? AND situacao = 'ativo'`, [atual.id]);
    if (Number(n)) throw erro(409, 'A cobrança já tem recebimentos; estorne-os antes de alterar.');
    const c = montarCobranca(dados, { ...atual, vencimento: String(atual.vencimento).slice(0, 10) });
    await validarNotaDaCobranca(conn, c, atual.processo_id);
    const alterados = Object.keys(c).filter((k) => String(atual[k] ?? '') !== String(c[k] ?? '') && !(k === 'valor' && Number(atual[k]) === c[k])
      && !(k === 'vencimento' && String(atual[k]).slice(0, 10) === c[k]));
    if (!alterados.length) return { ok: true };
    try {
      await conn.query(`UPDATE faturamento_cobrancas SET ${alterados.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...alterados.map((k) => c[k]), atual.id]);
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Este nosso número já está em outra cobrança do mesmo banco.');
      throw err;
    }
    for (const k of alterados.filter((x) => x !== 'chave_nosso_numero')) {
      await auditarFin(conn, usuario, { entidade: 'cobranca', entidadeId: atual.id, processoId: atual.processo_id, acao: 'edicao', campo: k, anterior: atual[k], novo: c[k] });
    }
    return { ok: true };
  });
}

export async function cancelarCobranca(id, { motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do cancelamento.');
  return emTransacao(async (conn) => {
    const c = await carregarCobranca(conn, id);
    if (c.status === 'cancelada') throw erro(409, 'Cobrança já cancelada.');
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM financeiro_recebimentos WHERE cobranca_id = ? AND situacao = 'ativo'`, [c.id]);
    if (Number(n)) throw erro(409, 'A cobrança tem recebimentos ativos; estorne-os antes de cancelar.');
    // Libera o nosso número (chave) para eventual nova cobrança
    await conn.query(`UPDATE faturamento_cobrancas SET status = 'cancelada', chave_nosso_numero = NULL, motivo_cancelamento = ? WHERE id = ?`, [mot, c.id]);
    await auditarFin(conn, usuario, { entidade: 'cobranca', entidadeId: c.id, processoId: c.processo_id, acao: 'cancelamento', anterior: c.status, novo: 'cancelada', motivo: mot });
    return { ok: true };
  });
}

/** Recalcula valor recebido e situação da cobrança a partir dos recebimentos ativos. */
export async function atualizarSituacaoCobranca(conn, cobrancaId, usuario, motivo) {
  const c = await carregarCobranca(conn, cobrancaId);
  if (c.status === 'cancelada') return c;
  const [[{ total }]] = await conn.query(
    `SELECT COALESCE(SUM(valor), 0) AS total FROM financeiro_recebimentos WHERE cobranca_id = ? AND situacao = 'ativo'`, [c.id]
  );
  const status = situacaoCobranca(c.valor, total);
  if (status !== c.status || r2(total) !== r2(c.valor_recebido)) {
    await conn.query(`UPDATE faturamento_cobrancas SET status = ?, valor_recebido = ? WHERE id = ?`, [status, r2(total), c.id]);
    await auditarFin(conn, usuario, {
      entidade: 'cobranca', entidadeId: c.id, processoId: c.processo_id, acao: 'situacao',
      anterior: { status: c.status, recebido: r2(c.valor_recebido) }, novo: { status, recebido: r2(total) }, motivo,
    });
  }
  return { ...c, status, valor_recebido: r2(total) };
}
