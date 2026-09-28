import { pool } from '../config/database.js';

// ── Feriados nacionais brasileiros (2025-2026) ─────────────────────────────────
const FERIADOS = new Set([
  // 2025
  '2025-01-01','2025-04-18','2025-04-19','2025-04-20','2025-04-21',
  '2025-05-01','2025-06-19','2025-09-07','2025-10-12',
  '2025-11-02','2025-11-15','2025-11-20','2025-12-25',
  // 2026
  '2026-01-01','2026-04-03','2026-04-04','2026-04-21',
  '2026-05-01','2026-06-04','2026-09-07','2026-10-12',
  '2026-11-02','2026-11-15','2026-11-20','2026-12-25',
]);

/**
 * Gera datas de operação de acordo com a escala para os próximos 3 meses a partir de dataInicio.
 */
export function gerarDatasAgenda(tipoEscala = 'plantao', dataInicio) {
  if (!dataInicio) return [];
  const soData = String(dataInicio).substring(0, 10);
  const [anoInicio, mesInicio, diaInicio] = soData.split('-').map(Number);
  const inicio = new Date(anoInicio, mesInicio - 1, diaInicio, 12, 0, 0);
  const fim = new Date(anoInicio, mesInicio - 1 + 3, diaInicio, 12, 0, 0);

  const datas = [];
  const cur = new Date(inicio);

  const escala = String(tipoEscala || 'plantao').toLowerCase();

  let turno = 0; // para escala 12x36 / plantão
  while (cur <= fim) {
    const a = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const iso = `${a}-${m}-${d}`;
    const dayOfWeek = cur.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const isFeriado = FERIADOS.has(iso);

    let trabalha = false;

    if (escala === '12x36' || escala === 'plantao') {
      trabalha = (turno === 0);
      turno = 1 - turno;
    } else if (escala === '5x2' || escala === 'mensal') {
      // Segunda a Sexta
      trabalha = (dayOfWeek >= 1 && dayOfWeek <= 5);
    } else if (escala === '6x1') {
      // Segunda a Sábado
      trabalha = (dayOfWeek >= 1 && dayOfWeek <= 6);
    } else {
      // Padrão: dias úteis
      trabalha = (dayOfWeek >= 1 && dayOfWeek <= 5);
    }

    if (trabalha || isFeriado) {
      datas.push({
        data: iso,
        status: isFeriado ? 'feriado' : 'previsto',
        feriado: isFeriado,
      });
    }

    cur.setDate(cur.getDate() + 1);
  }

  return datas;
}

export const CBO_PADRAO = {
  'AUXILIAR DE ENFERMAGEM': '3222-30',
  'AUXILIAR DE FARMACIA': '5211-30',
  'CLINICO GERAL': '2251-25',
  'CUIDADOR': '5162-10',
  'CUIDADOR DE IDOSOS': '5162-10',
  'ENFERMEIRO(A)': '2235-05',
  'ENFERMEIRO(A) ADMINSTRATIVO': '2235-05',
  'ENFERMEIRO VISITADOR': '2235-05',
  'FISIOTERAPEUTA': '2236-05',
  'FONOAUDIOLOGO': '2238-10',
  'INSTRUMENTADOR CIRURGICO': '3222-25',
  'MAQUEIRO': '5152-25',
  'NUTRICIONISTA': '2237-10',
  'PSICOLOGO': '2515-10',
  'TECNICO DE ENFERMAGEM': '3222-05',
  'TECNICO NUTRICAO': '3252-10',
  'TERAPEUTA OCUPACIONAL': '2239-05',
  'AUXILIAR DE METODOS GRAFICOS': '3241-15',
  'TECNOLOGO OFTALMICO': '3223-05',
  'TECNICO DE ENFERMAGEM - NOTURNO': '3222-05',
};

export function obterCboPorCargo(cargo) {
  if (!cargo) return null;
  const upper = cargo.toUpperCase().trim();
  if (CBO_PADRAO[upper]) return CBO_PADRAO[upper];
  for (const [k, v] of Object.entries(CBO_PADRAO)) {
    if (upper.includes(k) || k.includes(upper)) return v;
  }
  return null;
}

// Garante colunas de CBO, Faturamento, Fechamento, Perfil e RA no banco
async function inicializarColunas() {
  try { await pool.query(`ALTER TABLE parametro_vagas ADD COLUMN cbo VARCHAR(20) NULL`); } catch {}
  try { await pool.query(`ALTER TABLE cargos_referencia ADD COLUMN cbo VARCHAR(20) NULL`); } catch {}

  // Colunas de Faturamento e Fechamento nas Unidades (Fichas)
  const colsUnidades = [
    'taxa_servico VARCHAR(100) NULL',
    'periodo_apuracao VARCHAR(100) NULL',
    'apresentacao_cliente VARCHAR(100) NULL',
    'data_envio_boleto VARCHAR(100) NULL',
    'apresentacao_faturamento VARCHAR(100) NULL',
    'vencimento VARCHAR(100) NULL',
    'repasse_cooperado VARCHAR(100) NULL',
    'obs_fechamento TEXT NULL',
    'obs_faturamento TEXT NULL',
    'obs_financeiro TEXT NULL',
    'resp_comercial VARCHAR(150) NULL',
    'resp_comercial_telefone VARCHAR(50) NULL',
    'resp_comercial_celular VARCHAR(50) NULL',
    'resp_comercial_email VARCHAR(150) NULL',
    'resp_administrativo VARCHAR(150) NULL',
    'resp_adm_telefone VARCHAR(50) NULL',
    'resp_adm_celular VARCHAR(50) NULL',
    'resp_adm_email VARCHAR(150) NULL',
  ];
  for (const col of colsUnidades) {
    try { await pool.query(`ALTER TABLE parametro_unidades ADD COLUMN ${col}`); } catch {}
  }

  // Colunas de Ocupação e Recursos Associativos nas Vagas
  const colsVagas = [
    'perfil_ocupacao TEXT NULL',
    'recursos_associativos TEXT NULL',
    'tipo_atividade VARCHAR(150) NULL',
    'horario VARCHAR(100) NULL',
    'intervalo VARCHAR(100) NULL',
  ];
  for (const col of colsVagas) {
    try { await pool.query(`ALTER TABLE parametro_vagas ADD COLUMN ${col}`); } catch {}
  }
}
inicializarColunas().catch(() => {});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registrarLog(conexaoOuDados, dadosSeHouver = null) {
  let conexao = pool;
  let dados = conexaoOuDados;
  if (dadosSeHouver) {
    conexao = conexaoOuDados;
    dados = dadosSeHouver;
  }
  const { empresaId, unidadeId = null, vagaId = null, usuarioId, usuarioNome, acao, descricao, dadosAnteriores = null, dadosNovos = null } = dados;
  try {
    await conexao.query(
      `INSERT INTO parametro_log_acoes
         (empresa_id, unidade_id, vaga_id, usuario_id, usuario_nome, acao, descricao, dados_anteriores, dados_novos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        unidadeId,
        vagaId,
        usuarioId,
        usuarioNome,
        acao,
        descricao,
        dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
        dadosNovos ? JSON.stringify(dadosNovos) : null,
      ]
    );
  } catch (err) {
    console.warn('[parametroLog] Não foi possível gravar log:', err.message);
  }
}

// ── Empresas (listagem para o módulo parâmetro) ───────────────────────────────

export async function listarEmpresasParametro() {
  const [linhas] = await pool.query(
    `SELECT e.id, e.nome_empresa, e.cnpj, e.cpf, e.status, e.executivo_nome, e.representante,
            e.regiao_nome, e.criado_em,
            COUNT(DISTINCT pu.id) AS total_unidades,
            SUM(CASE WHEN pu.ativa = 1 THEN 1 ELSE 0 END) AS unidades_ativas
     FROM empresas e
     LEFT JOIN parametro_unidades pu ON pu.empresa_id = e.id
     GROUP BY e.id
     ORDER BY e.nome_empresa ASC`
  );
  return linhas;
}

// ── Unidades ──────────────────────────────────────────────────────────────────

export async function listarUnidadesPorEmpresa(empresaId) {
  const [unidades] = await pool.query(
    `SELECT * FROM parametro_unidades WHERE empresa_id = ? ORDER BY criado_em ASC`,
    [empresaId]
  );

  if (unidades.length === 0) return [];

  const ids = unidades.map((u) => u.id);
  const [vagas] = await pool.query(
    `SELECT * FROM parametro_vagas WHERE unidade_id IN (?) ORDER BY criado_em ASC`,
    [ids]
  );

  const vagasPorUnidade = {};
  for (const v of vagas) {
    if (!vagasPorUnidade[v.unidade_id]) vagasPorUnidade[v.unidade_id] = [];
    vagasPorUnidade[v.unidade_id].push(v);
  }

  return unidades.map((u) => ({ ...u, vagas: vagasPorUnidade[u.id] ?? [] }));
}

export async function criarUnidade(empresaId, dados, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [res] = await conexao.query(
      `INSERT INTO parametro_unidades
         (empresa_id, nome_unidade, endereco, contato_responsavel, observacoes,
          taxa_servico, periodo_apuracao, apresentacao_cliente, data_envio_boleto,
          apresentacao_faturamento, vencimento, repasse_cooperado,
          obs_fechamento, obs_faturamento, obs_financeiro,
          resp_comercial, resp_comercial_telefone, resp_comercial_celular, resp_comercial_email,
          resp_administrativo, resp_adm_telefone, resp_adm_celular, resp_adm_email,
          criado_por_id, criado_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        dados.nomeUnidade,
        dados.endereco ?? null,
        dados.contatoResponsavel ?? null,
        dados.observacoes ?? null,
        dados.taxaServico ?? dados.taxa_servico ?? null,
        dados.periodoApuracao ?? dados.periodo_apuracao ?? null,
        dados.apresentacaoCliente ?? dados.apresentacao_cliente ?? null,
        dados.dataEnvioBoleto ?? dados.data_envio_boleto ?? null,
        dados.apresentacaoFaturamento ?? dados.apresentacao_faturamento ?? null,
        dados.vencimento ?? null,
        dados.repasseCooperado ?? dados.repasse_cooperado ?? null,
        dados.obsFechamento ?? dados.obs_fechamento ?? null,
        dados.obsFaturamento ?? dados.obs_faturamento ?? null,
        dados.obsFinanceiro ?? dados.obs_financeiro ?? null,
        dados.respComercial ?? dados.resp_comercial ?? null,
        dados.respComercialTelefone ?? dados.resp_comercial_telefone ?? null,
        dados.respComercialCelular ?? dados.resp_comercial_celular ?? null,
        dados.respComercialEmail ?? dados.resp_comercial_email ?? null,
        dados.respAdministrativo ?? dados.resp_administrativo ?? null,
        dados.respAdmTelefone ?? dados.resp_adm_telefone ?? null,
        dados.respAdmCelular ?? dados.resp_adm_celular ?? null,
        dados.respAdmEmail ?? dados.resp_adm_email ?? null,
        usuarioId,
        usuarioNome,
      ]
    );

    await registrarLog(conexao, {
      empresaId, unidadeId: res.insertId, usuarioId, usuarioNome,
      acao: 'criar_unidade',
      descricao: `Criou a unidade "${dados.nomeUnidade}"`,
      dadosNovos: dados,
    });

    await conexao.commit();
    return res.insertId;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function atualizarUnidade(unidadeId, dados, empresaId, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[anterior]] = await conexao.query('SELECT * FROM parametro_unidades WHERE id = ?', [unidadeId]);

    await conexao.query(
      `UPDATE parametro_unidades
       SET nome_unidade = ?, endereco = ?, contato_responsavel = ?, observacoes = ?,
           taxa_servico = ?, periodo_apuracao = ?, apresentacao_cliente = ?, data_envio_boleto = ?,
           apresentacao_faturamento = ?, vencimento = ?, repasse_cooperado = ?,
           obs_fechamento = ?, obs_faturamento = ?, obs_financeiro = ?,
           resp_comercial = ?, resp_comercial_telefone = ?, resp_comercial_celular = ?, resp_comercial_email = ?,
           resp_administrativo = ?, resp_adm_telefone = ?, resp_adm_celular = ?, resp_adm_email = ?
       WHERE id = ?`,
      [
        dados.nomeUnidade,
        dados.endereco ?? null,
        dados.contatoResponsavel ?? null,
        dados.observacoes ?? null,
        dados.taxaServico !== undefined ? dados.taxaServico : (dados.taxa_servico !== undefined ? dados.taxa_servico : (anterior?.taxa_servico ?? null)),
        dados.periodoApuracao !== undefined ? dados.periodoApuracao : (dados.periodo_apuracao !== undefined ? dados.periodo_apuracao : (anterior?.periodo_apuracao ?? null)),
        dados.apresentacaoCliente !== undefined ? dados.apresentacaoCliente : (dados.apresentacao_cliente !== undefined ? dados.apresentacao_cliente : (anterior?.apresentacao_cliente ?? null)),
        dados.dataEnvioBoleto !== undefined ? dados.dataEnvioBoleto : (dados.data_envio_boleto !== undefined ? dados.data_envio_boleto : (anterior?.data_envio_boleto ?? null)),
        dados.apresentacaoFaturamento !== undefined ? dados.apresentacaoFaturamento : (dados.apresentacao_faturamento !== undefined ? dados.apresentacao_faturamento : (anterior?.apresentacao_faturamento ?? null)),
        dados.vencimento !== undefined ? dados.vencimento : (anterior?.vencimento ?? null),
        dados.repasseCooperado !== undefined ? dados.repasseCooperado : (dados.repasse_cooperado !== undefined ? dados.repasse_cooperado : (anterior?.repasse_cooperado ?? null)),
        dados.obsFechamento !== undefined ? dados.obsFechamento : (dados.obs_fechamento !== undefined ? dados.obs_fechamento : (anterior?.obs_fechamento ?? null)),
        dados.obsFaturamento !== undefined ? dados.obsFaturamento : (dados.obs_faturamento !== undefined ? dados.obs_faturamento : (anterior?.obs_faturamento ?? null)),
        dados.obsFinanceiro !== undefined ? dados.obsFinanceiro : (dados.obs_financeiro !== undefined ? dados.obs_financeiro : (anterior?.obs_financeiro ?? null)),
        dados.respComercial !== undefined ? dados.respComercial : (dados.resp_comercial !== undefined ? dados.resp_comercial : (anterior?.resp_comercial ?? null)),
        dados.respComercialTelefone !== undefined ? dados.respComercialTelefone : (dados.resp_comercial_telefone !== undefined ? dados.resp_comercial_telefone : (anterior?.resp_comercial_telefone ?? null)),
        dados.respComercialCelular !== undefined ? dados.respComercialCelular : (dados.resp_comercial_celular !== undefined ? dados.resp_comercial_celular : (anterior?.resp_comercial_celular ?? null)),
        dados.respComercialEmail !== undefined ? dados.respComercialEmail : (dados.resp_comercial_email !== undefined ? dados.resp_comercial_email : (anterior?.resp_comercial_email ?? null)),
        dados.respAdministrativo !== undefined ? dados.respAdministrativo : (dados.resp_administrativo !== undefined ? dados.resp_administrativo : (anterior?.resp_administrativo ?? null)),
        dados.respAdmTelefone !== undefined ? dados.respAdmTelefone : (dados.resp_adm_telefone !== undefined ? dados.resp_adm_telefone : (anterior?.resp_adm_telefone ?? null)),
        dados.respAdmCelular !== undefined ? dados.respAdmCelular : (dados.resp_adm_celular !== undefined ? dados.resp_adm_celular : (anterior?.resp_adm_celular ?? null)),
        dados.respAdmEmail !== undefined ? dados.respAdmEmail : (dados.resp_adm_email !== undefined ? dados.resp_adm_email : (anterior?.resp_adm_email ?? null)),
        unidadeId,
      ]
    );

    await registrarLog(conexao, {
      empresaId, unidadeId, usuarioId, usuarioNome,
      acao: 'editar_unidade',
      descricao: `Editou a unidade "${dados.nomeUnidade}"`,
      dadosAnteriores: anterior,
      dadosNovos: dados,
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function alternarAtivacaoUnidade(unidadeId, ativa, empresaId, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[unidade]] = await conexao.query('SELECT nome_unidade FROM parametro_unidades WHERE id = ?', [unidadeId]);

    await conexao.query('UPDATE parametro_unidades SET ativa = ? WHERE id = ?', [ativa, unidadeId]);

    await registrarLog(conexao, {
      empresaId, unidadeId, usuarioId, usuarioNome,
      acao: ativa ? 'ativar_unidade' : 'inativar_unidade',
      descricao: `${ativa ? 'Ativou' : 'Inativou'} a unidade "${unidade.nome_unidade}"`,
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Vagas ─────────────────────────────────────────────────────────────────────

export async function criarVaga(unidadeId, empresaId, dados, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const tipoEscala = dados.tipoEscala ?? 'plantao';
    const cbo = dados.cbo || obterCboPorCargo(dados.cargo);

    const [res] = await conexao.query(
      `INSERT INTO parametro_vagas
         (unidade_id, cargo, cbo, quantidade, salario_base, tipo_escala,
          adicional_noturno, periculosidade, insalubridade, premio_incentivo,
          valor_vr_dia, valor_vt_dia, dsr_percentual, periodicidade,
          tempo_pausa, tempo_refeicao, desconta_pausa, desconta_refeicao, recebe_por, data_inicio,
          perfil_ocupacao, recursos_associativos, tipo_atividade, horario, intervalo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unidadeId,
        dados.cargo,
        cbo || null,
        dados.quantidade ?? 1,
        dados.salarioBase ?? null,
        tipoEscala,
        dados.adicionalNoturno ? 1 : 0,
        dados.periculosidade ? 1 : 0,
        dados.insalubridade ?? 'sem_risco',
        dados.premioIncentivo ?? 0,
        dados.valorVrDia ?? 0,
        dados.valorVtDia ?? 0,
        dados.dsrPercentual ?? 16.67,
        dados.periodicidade ?? 'mensal',
        dados.tempoPausa ?? null,
        dados.tempoRefeicao ?? null,
        dados.descontaPausa ? 1 : 0,
        dados.descontaRefeicao ? 1 : 0,
        dados.recebePor ?? 'mes',
        dados.dataInicio ?? null,
        dados.perfilOcupacao ?? dados.perfil_ocupacao ?? null,
        dados.recursosAssociativos ?? dados.recursos_associativos ?? null,
        dados.tipoAtividade ?? dados.tipo_atividade ?? null,
        dados.horario ?? null,
        dados.intervalo ?? null,
      ]
    );

    const vagaId = res.insertId;

    // Gera agenda automática se houver data de início
    if (dados.dataInicio) {
      const datasAgenda = gerarDatasAgenda(tipoEscala, dados.dataInicio);
      if (datasAgenda.length > 0) {
        const valores = datasAgenda.map((d) => [vagaId, unidadeId, empresaId, d.data, d.status]);
        await conexao.query(
          `INSERT INTO parametro_agenda (vaga_id, unidade_id, empresa_id, data_operacao, status) VALUES ?`,
          [valores]
        );
      }
    }

    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId, usuarioId, usuarioNome,
      acao: 'criar_vaga',
      descricao: `Criou a vaga "${dados.cargo}" (${dados.quantidade ?? 1} vaga${(dados.quantidade ?? 1) > 1 ? 's' : ''})${cbo ? ` - CBO ${cbo}` : ''}`,
      dadosNovos: { ...dados, cbo },
    });

    await conexao.commit();
    return vagaId;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function atualizarVaga(vagaId, unidadeId, empresaId, dados, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[anterior]] = await conexao.query('SELECT * FROM parametro_vagas WHERE id = ?', [vagaId]);
    const cbo = dados.cbo !== undefined ? dados.cbo : (anterior?.cbo || obterCboPorCargo(dados.cargo));

    await conexao.query(
      `UPDATE parametro_vagas
       SET cargo = ?, cbo = ?, quantidade = ?, salario_base = ?, tipo_escala = ?,
           adicional_noturno = ?, periculosidade = ?, insalubridade = ?,
           premio_incentivo = ?, valor_vr_dia = ?, valor_vt_dia = ?,
           dsr_percentual = ?, periodicidade = ?,
           tempo_pausa = ?, tempo_refeicao = ?, desconta_pausa = ?, desconta_refeicao = ?, recebe_por = ?,
           data_inicio = COALESCE(?, data_inicio),
           perfil_ocupacao = ?, recursos_associativos = ?, tipo_atividade = ?, horario = ?, intervalo = ?
       WHERE id = ?`,
      [
        dados.cargo,
        cbo || null,
        dados.quantidade ?? 1,
        dados.salarioBase ?? null,
        dados.tipoEscala ?? 'plantao',
        dados.adicionalNoturno ? 1 : 0,
        dados.periculosidade ? 1 : 0,
        dados.insalubridade ?? 'sem_risco',
        dados.premioIncentivo ?? 0,
        dados.valorVrDia ?? 0,
        dados.valorVtDia ?? 0,
        dados.dsrPercentual ?? 16.67,
        dados.periodicidade ?? 'mensal',
        dados.tempoPausa ?? null,
        dados.tempoRefeicao ?? null,
        dados.descontaPausa ? 1 : 0,
        dados.descontaRefeicao ? 1 : 0,
        dados.recebePor ?? 'mes',
        dados.dataInicio || null,
        dados.perfilOcupacao !== undefined ? dados.perfilOcupacao : (dados.perfil_ocupacao !== undefined ? dados.perfil_ocupacao : (anterior?.perfil_ocupacao ?? null)),
        dados.recursosAssociativos !== undefined ? dados.recursosAssociativos : (dados.recursos_associativos !== undefined ? dados.recursos_associativos : (anterior?.recursos_associativos ?? null)),
        dados.tipoAtividade !== undefined ? dados.tipoAtividade : (dados.tipo_atividade !== undefined ? dados.tipo_atividade : (anterior?.tipo_atividade ?? null)),
        dados.horario !== undefined ? dados.horario : (anterior?.horario ?? null),
        dados.intervalo !== undefined ? dados.intervalo : (anterior?.intervalo ?? null),
        vagaId,
      ]
    );

    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId, usuarioId, usuarioNome,
      acao: 'editar_vaga',
      descricao: `Editou a vaga "${dados.cargo}"${cbo ? ` - CBO ${cbo}` : ''}`,
      dadosAnteriores: anterior,
      dadosNovos: { ...dados, cbo },
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function registrarIncremento(vagaId, unidadeId, empresaId, dados, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[vaga]] = await conexao.query('SELECT cargo, quantidade FROM parametro_vagas WHERE id = ?', [vagaId]);
    const qtdAnterior = vaga.quantidade;
    const qtdNova = qtdAnterior + dados.delta;

    if (qtdNova < 0) throw new Error('Quantidade não pode ser negativa.');

    await conexao.query('UPDATE parametro_vagas SET quantidade = ? WHERE id = ?', [qtdNova, vagaId]);

    await conexao.query(
      `INSERT INTO parametro_incrementos
         (vaga_id, quantidade_anterior, quantidade_nova, motivo, registrado_por_id, registrado_por_nome, data_incremento)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vagaId, qtdAnterior, qtdNova, dados.motivo ?? null, usuarioId, usuarioNome, dados.dataIncremento]
    );

    const sinal = dados.delta >= 0 ? `+${dados.delta}` : String(dados.delta);
    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId, usuarioId, usuarioNome,
      acao: 'incremento_vaga',
      descricao: `Alterou quantidade da vaga "${vaga.cargo}": ${qtdAnterior} → ${qtdNova} (${sinal})`,
      dadosNovos: { delta: dados.delta, motivo: dados.motivo, dataIncremento: dados.dataIncremento },
    });

    await conexao.commit();
    return { quantidadeAnterior: qtdAnterior, quantidadeNova: qtdNova };
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function alternarAtivacaoVaga(vagaId, ativa, unidadeId, empresaId, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[vaga]] = await conexao.query('SELECT cargo FROM parametro_vagas WHERE id = ?', [vagaId]);
    await conexao.query('UPDATE parametro_vagas SET ativa = ? WHERE id = ?', [ativa, vagaId]);

    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId, usuarioId, usuarioNome,
      acao: ativa ? 'ativar_vaga' : 'inativar_vaga',
      descricao: `${ativa ? 'Ativou' : 'Inativou'} a vaga "${vaga.cargo}"`,
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function listarIncrementosPorVaga(vagaId) {
  const [linhas] = await pool.query(
    `SELECT * FROM parametro_incrementos WHERE vaga_id = ? ORDER BY criado_em DESC`,
    [vagaId]
  );
  return linhas;
}

// ── Status empresa ─────────────────────────────────────────────────────────────

export async function alterarStatusEmpresa(empresaId, novoStatus, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[empresa]] = await conexao.query('SELECT nome_empresa, status FROM empresas WHERE id = ?', [empresaId]);
    const statusAnterior = empresa.status;

    await conexao.query('UPDATE empresas SET status = ? WHERE id = ?', [novoStatus, empresaId]);

    await registrarLog(conexao, {
      empresaId, usuarioId, usuarioNome,
      acao: 'alterar_status_empresa',
      descricao: `Alterou status de "${statusAnterior}" para "${novoStatus}" — empresa "${empresa.nome_empresa}"`,
      dadosAnteriores: { status: statusAnterior },
      dadosNovos: { status: novoStatus },
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Log ───────────────────────────────────────────────────────────────────────

export async function listarLog(empresaId, limit = 100) {
  const [linhas] = await pool.query(
    `SELECT * FROM parametro_log_acoes
     WHERE empresa_id = ?
     ORDER BY criado_em DESC
     LIMIT ?`,
    [empresaId, limit]
  );
  return linhas;
}

// ── Agenda de operação ────────────────────────────────────────────────────────

export async function listarAgendaVaga(vagaId) {
  const [linhas] = await pool.query(
    `SELECT id, vaga_id, unidade_id, empresa_id,
            DATE_FORMAT(data_operacao, '%Y-%m-%d') AS data_operacao,
            status, observacoes, validado_por_id, validado_por_nome, validado_em, criado_em
     FROM parametro_agenda
     WHERE vaga_id = ?
     ORDER BY data_operacao ASC`,
    [vagaId]
  );
  return linhas;
}

export async function atualizarStatusAgenda(agendaId, status, observacoes, usuarioId, usuarioNome) {
  await pool.query(
    `UPDATE parametro_agenda
     SET status = ?, observacoes = ?, validado_por_id = ?, validado_por_nome = ?, validado_em = NOW()
     WHERE id = ?`,
    [status, observacoes ?? null, usuarioId, usuarioNome, agendaId]
  );
}

export async function regerarAgendaVaga(vagaId, unidadeId, empresaId, tipoEscala, dataInicio, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // Remove agenda existente (apenas 'previsto' — mantém confirmados/cancelados)
    await conexao.query(
      `DELETE FROM parametro_agenda WHERE vaga_id = ? AND status = 'previsto'`,
      [vagaId]
    );

    const datasAgenda = gerarDatasAgenda(tipoEscala, dataInicio);
    if (datasAgenda.length > 0) {
      const valores = datasAgenda.map((d) => [vagaId, unidadeId, empresaId, d.data, d.status]);
      await conexao.query(
        `INSERT INTO parametro_agenda (vaga_id, unidade_id, empresa_id, data_operacao, status) VALUES ?`,
        [valores]
      );
    }

    await conexao.commit();
    return datasAgenda.length;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Cadastro primário (atividades da proposta) ────────────────────────────────

export async function listarAtividadesPrimarias(empresaId) {
  const [linhas] = await pool.query(
    `SELECT pa.id, pa.cargo, pa.quantidade, pa.salario_base, pa.tipo_escala,
            pa.adicional_noturno, pa.periculosidade, pa.insalubridade,
            pa.premio_incentivo, pa.vr_dias, pa.vt_dias,
            t.id AS trabalho_id, t.titulo AS trabalho_titulo
     FROM proposta_atividades pa
     JOIN trabalhos t ON t.id = pa.trabalho_id
     WHERE t.empresa_id = ?
     ORDER BY t.criado_em DESC, pa.ordem ASC`,
    [empresaId]
  );
  return linhas;
}

// ── Alteração Exclusiva do Executivo de Contas ─────────────────────────────────

export async function alterarExecutivoEmpresa(empresaId, executivoId, executivoNome, usuarioId, usuarioNome) {
  const [empresaRows] = await pool.query('SELECT executivo_id, executivo_nome FROM empresas WHERE id = ?', [empresaId]);
  const anterior = empresaRows[0] ?? {};

  await pool.query(
    'UPDATE empresas SET executivo_id = ?, executivo_nome = ?, atualizado_em = NOW() WHERE id = ?',
    [executivoId ?? null, executivoNome ?? null, empresaId]
  );

  await registrarLog(pool, {
    empresaId,
    usuarioId,
    usuarioNome,
    acao: 'alterar_executivo',
    descricao: `Executivo de contas alterado de "${anterior.executivo_nome || 'Nenhum'}" para "${executivoNome || 'Nenhum'}"`,
    dadosAnteriores: { executivo_id: anterior.executivo_id, executivo_nome: anterior.executivo_nome },
    dadosNovos: { executivo_id: executivoId, executivo_nome: executivoNome },
  });
}

// ── Alteração Exclusiva do Representante da Empresa ───────────────────────────

export async function alterarRepresentanteEmpresa(empresaId, representante, usuarioId, usuarioNome) {
  const [empresaRows] = await pool.query('SELECT representante FROM empresas WHERE id = ?', [empresaId]);
  const anterior = empresaRows[0] ?? {};

  await pool.query(
    'UPDATE empresas SET representante = ?, atualizado_em = NOW() WHERE id = ?',
    [representante ?? null, empresaId]
  );

  await registrarLog(pool, {
    empresaId,
    usuarioId,
    usuarioNome,
    acao: 'alterar_representante',
    descricao: `Representante da empresa alterado de "${anterior.representante || 'Nenhum'}" para "${representante || 'Nenhum'}"`,
    dadosAnteriores: { representante: anterior.representante },
    dadosNovos: { representante },
  });
}


