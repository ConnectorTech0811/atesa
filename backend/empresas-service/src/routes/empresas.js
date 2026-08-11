import { Router } from 'express';
import { pool } from '../config/database.js';
import {
  atualizarEmpresa,
  atualizarTelefoneEmpresa,
  buscarEmpresaCompletaPorId,
  buscarEmpresaPorId,
  buscarEmpresasPorDominioEmail,
  buscarEmpresasPorNomeParecido,
  inserirEmpresa,
  listarEmpresas,
  listarEmpresasPorExecutivo,
  obterMetricasExecutivo,
  verificarEmailDuplicado,
  verificarTelefoneDuplicado,
} from '../repositories/empresasRepository.js';
import { adicionarHistorico, listarHistoricoPorEmpresa } from '../repositories/historicoRepository.js';
import { escolherExecutivo } from '../repositories/rodizioRepository.js';
import { buscarRegiao } from '../clients/regioesServiceClient.js';
import { listarExecutivosPorRegiao } from '../clients/usuariosServiceClient.js';
import { validarCnpj } from '../utils/validarCnpj.js';
import { validarCpf } from '../utils/validarCpf.js';

const STATUS_HISTORICO_CONSULTOR = [
  'apresentacao_enviada',
  'ligacao',
  'visita_agendada',
  'visita_cancelada',
];

const router = Router();

/** Lê a identidade do usuário autenticado a partir dos cabeçalhos confiáveis
 * injetados pelo gateway (com base no token JWT já verificado). O corpo da
 * requisição nunca é usado para isso, então o usuário não pode forjar quem
 * fez o registro. */
function obterUsuarioAutenticado(req) {
  const id = req.headers['x-usuario-id'];
  const nomeCodificado = req.headers['x-usuario-nome'];
  if (!id || !nomeCodificado) return null;
  return { id: Number(id), nome: decodeURIComponent(nomeCodificado) };
}

router.get('/empresas', async (_req, res) => {
  try {
    const empresas = await listarEmpresas();
    res.json(empresas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar empresas.' });
  }
});

/** Lista as empresas atribuídas ao executivo logado. Admin vê todas. */
router.get('/empresas/executivo', async (req, res) => {
  const id = req.headers['x-usuario-id'];
  const tipo = req.headers['x-usuario-tipo'];
  if (!id) return res.status(401).json({ erro: 'Usuário não identificado.' });
  try {
    const empresas = tipo === 'administrador'
      ? await listarEmpresas()
      : await listarEmpresasPorExecutivo(Number(id));
    res.json(empresas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar empresas do executivo.' });
  }
});

/** Verifica se já existe empresa cadastrada com o mesmo domínio de e-mail. */
router.get('/empresas/verificar-dominio', async (req, res) => {
  const dominio = req.query.dominio;
  if (!dominio || String(dominio).trim().length < 3) return res.json([]);
  try {
    const encontradas = await buscarEmpresasPorDominioEmail(String(dominio).trim().toLowerCase());
    res.json(encontradas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao verificar domínio.' });
  }
});

/** Métricas agregadas do painel executivo: KPIs, funil, distribuição de status. */
router.get('/empresas/metricas', async (req, res) => {
  const id = req.headers['x-usuario-id'];
  const tipo = req.headers['x-usuario-tipo'];
  if (!id) return res.status(401).json({ erro: 'Usuário não identificado.' });
  try {
    const dados = await obterMetricasExecutivo(Number(id), tipo === 'administrador');
    res.json(dados);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao obter métricas.' });
  }
});

/** Busca fonética/fuzzy por nome, usada para alertar sobre possível duplicidade antes de salvar. */
router.get('/empresas/buscar', async (req, res) => {
  const nome = req.query.nome;
  if (!nome || String(nome).trim().length < 3) {
    return res.json([]);
  }
  try {
    const encontradas = await buscarEmpresasPorNomeParecido(nome);
    res.json(encontradas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar empresas parecidas.' });
  }
});

router.post('/empresas', async (req, res) => {
  const {
    cooperativa,
    consultorNome,
    nomeEmpresa,
    cnpj,
    cpf,
    cep,
    rua,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    emailEmpresa,
    telefoneEmpresa,
    whatsapp,
    representante,
    regiaoId,
    dataPrimeiroContato,
  } = req.body ?? {};

  if (!cooperativa || !nomeEmpresa || !whatsapp || !emailEmpresa) {
    return res.status(400).json({
      erro: 'Preencha os campos obrigatórios: nome da empresa, WhatsApp e e-mail.',
    });
  }

  let cnpjLimpo = null;
  if (cnpj) {
    cnpjLimpo = String(cnpj).replace(/[.\-\/\s]/g, '').toUpperCase();
    if (!validarCnpj(cnpjLimpo)) {
      return res.status(400).json({ erro: 'CNPJ inválido.' });
    }
  }

  let cpfLimpo = null;
  if (cpf) {
    cpfLimpo = String(cpf).replace(/\D/g, '');
    if (!validarCpf(cpfLimpo)) {
      return res.status(400).json({ erro: 'CPF inválido.' });
    }
  }

  // Validação de chaves únicas: e-mail e telefone não podem se repetir
  const emailExistente = await verificarEmailDuplicado(emailEmpresa);
  if (emailExistente) {
    return res.status(409).json({ erro: `E-mail já cadastrado para a empresa "${emailExistente.nome_empresa}".`, campo: 'email' });
  }
  if (telefoneEmpresa) {
    const telExistente = await verificarTelefoneDuplicado(telefoneEmpresa);
    if (telExistente) {
      return res.status(409).json({ erro: `Telefone já cadastrado para a empresa "${telExistente.nome_empresa}".`, campo: 'telefone' });
    }
  }

  let regiao = null;
  let executivosDisponiveis = [];
  if (regiaoId) {
    try {
      regiao = await buscarRegiao(regiaoId);
      if (!regiao) {
        return res.status(400).json({ erro: 'Região inválida.' });
      }
      executivosDisponiveis = await listarExecutivosPorRegiao(regiaoId);
    } catch (erro) {
      console.error(erro);
      return res.status(502).json({ erro: 'Não foi possível validar região/executivos. Tente novamente.' });
    }
  }

  // Escolha do executivo (rodízio) e inserção da empresa ocorrem na mesma
  // transação: se a empresa não puder ser criada (ex.: CNPJ duplicado), o
  // avanço do rodízio é desfeito junto, sem "queimar" a vez de um executivo.
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const executivo = regiao ? await escolherExecutivo(conexao, regiaoId, executivosDisponiveis) : null;

    const id = await inserirEmpresa(conexao, {
      cooperativa,
      consultorNome,
      nomeEmpresa,
      cnpj: cnpjLimpo,
      cpf: cpfLimpo,
      cep,
      rua,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      emailEmpresa,
      telefoneEmpresa: telefoneEmpresa || null,
      whatsapp: whatsapp || null,
      representante,
      regiaoId: regiao ? regiaoId : null,
      regiaoNome: regiao?.nome ?? null,
      dataPrimeiroContato: dataPrimeiroContato || null,
      executivoId: executivo?.id ?? null,
      executivoNome: executivo?.nome ?? null,
    });

    await conexao.commit();
    res.status(201).json({ id, executivoNome: executivo?.nome ?? null });
  } catch (erro) {
    await conexao.rollback();
    if (erro.code === 'ER_DUP_ENTRY') {
      // Determina qual campo duplicou para dar mensagem mais precisa
      const msg = /cpf/i.test(erro.sqlMessage ?? '')
        ? 'Já existe uma empresa cadastrada com este CPF.'
        : /cnpj/i.test(erro.sqlMessage ?? '')
          ? 'Já existe uma empresa cadastrada com este CNPJ.'
          : 'Já existe uma empresa com este CNPJ ou CPF.';
      return res.status(409).json({ erro: msg });
    }
    if (erro.code === 'ER_BAD_NULL_ERROR') {
      return res.status(500).json({ erro: `Campo obrigatório no banco de dados não preenchido: ${erro.sqlMessage}. Execute a migração SQL para tornar os campos opcionais.` });
    }
    if (erro.code === 'ER_NO_SUCH_TABLE' || erro.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ erro: `Estrutura do banco desatualizada: ${erro.sqlMessage}. Execute as migrações SQL pendentes.` });
    }
    console.error('[POST /empresas]', erro.code, erro.sqlMessage, erro);
    res.status(500).json({ erro: 'Erro ao cadastrar empresa.' });
  } finally {
    conexao.release();
  }
});

router.put('/empresas/:id', async (req, res) => {
  const { nomeEmpresa, emailEmpresa, telefoneEmpresa } = req.body ?? {};
  if (!nomeEmpresa || !emailEmpresa || !telefoneEmpresa) {
    return res.status(400).json({ erro: 'Nome da empresa, e-mail e telefone são obrigatórios.' });
  }
  try {
    const empresa = await buscarEmpresaCompletaPorId(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });

    // Verifica unicidade de e-mail/telefone excluindo a própria empresa
    const emailExistente = await verificarEmailDuplicado(emailEmpresa, req.params.id);
    if (emailExistente) {
      return res.status(409).json({ erro: `E-mail já cadastrado para a empresa "${emailExistente.nome_empresa}".`, campo: 'email' });
    }
    if (telefoneEmpresa) {
      const telExistente = await verificarTelefoneDuplicado(telefoneEmpresa, req.params.id);
      if (telExistente) {
        return res.status(409).json({ erro: `Telefone já cadastrado para a empresa "${telExistente.nome_empresa}".`, campo: 'telefone' });
      }
    }

    await atualizarEmpresa(req.params.id, { status: empresa.status, ...req.body });
    const atualizada = await buscarEmpresaCompletaPorId(req.params.id);
    res.json(atualizada);
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Já existe uma empresa com este CNPJ.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar empresa.' });
  }
});

router.patch('/empresas/:id', async (req, res) => {
  const { telefoneEmpresa } = req.body ?? {};
  if (!telefoneEmpresa) return res.status(400).json({ erro: 'Informe o telefone.' });

  try {
    const empresa = await buscarEmpresaPorId(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    await atualizarTelefoneEmpresa(req.params.id, telefoneEmpresa);
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar empresa.' });
  }
});

router.get('/empresas/:id/historico', async (req, res) => {
  try {
    const empresa = await buscarEmpresaPorId(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });

    const historico = await listarHistoricoPorEmpresa(req.params.id);
    res.json(historico);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar histórico.' });
  }
});

router.post('/empresas/:id/historico', async (req, res) => {
  const { status, dataRegistro, observacoes } = req.body ?? {};

  if (!status || !STATUS_HISTORICO_CONSULTOR.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido. Use: apresentacao_enviada, ligacao, visita_agendada ou visita_cancelada.' });
  }
  if (!dataRegistro || !observacoes) {
    return res.status(400).json({ erro: 'Informe a data e as observações.' });
  }

  const usuario = obterUsuarioAutenticado(req);
  if (!usuario) {
    return res.status(401).json({ erro: 'Usuário não identificado.' });
  }

  try {
    const empresa = await buscarEmpresaPorId(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });

    const id = await adicionarHistorico(req.params.id, {
      status,
      dataRegistro,
      observacoes,
      registradoPorId: usuario.id,
      registradoPorNome: usuario.nome,
    });
    res.status(201).json({ id });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao registrar histórico.' });
  }
});

export default router;
