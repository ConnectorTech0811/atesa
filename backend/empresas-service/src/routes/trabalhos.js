import { Router } from 'express';
import {
  buscarTrabalhoPorId,
  inserirTrabalho,
  listarTrabalhosPorEmpresa,
  atualizarTrabalho,
} from '../repositories/trabalhosRepository.js';
import { buscarEmpresaPorId } from '../repositories/empresasRepository.js';
import { inserirContatoTrabalho, listarContatosPorTrabalho } from '../repositories/contatosTrabalhoRepository.js';
import { obterParametrosPorTrabalho, salvarParametros } from '../repositories/parametrosRepository.js';
import {
  atualizarAtividade,
  inserirAtividades,
  listarAtividades,
  removerAtividade,
} from '../repositories/propostaAtividadesRepository.js';

const TIPOS_CONTATO = ['ligacao', 'email', 'reuniao', 'visita', 'whatsapp'];
const STATUS_VALIDOS = ['em_aberto', 'em_andamento', 'proposta_enviada', 'proposta_aceita', 'fechado', 'cancelado'];
const STATUS_NEGOCIO_EXECUTIVO = ['negocio_fechado', 'negociacao', 'negocio_frustrado', 'visita_agendada', 'visita_cancelada'];

const router = Router();

function obterUsuarioAutenticado(req) {
  const id = req.headers['x-usuario-id'];
  const nomeCodificado = req.headers['x-usuario-nome'];
  if (!id || !nomeCodificado) return null;
  return { id: Number(id), nome: decodeURIComponent(nomeCodificado) };
}

router.get('/empresas/:empresaId/trabalhos', async (req, res) => {
  try {
    const empresa = await buscarEmpresaPorId(req.params.empresaId);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    const trabalhos = await listarTrabalhosPorEmpresa(req.params.empresaId);
    res.json(trabalhos);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar trabalhos.' });
  }
});

router.post('/empresas/:empresaId/trabalhos', async (req, res) => {
  const usuario = obterUsuarioAutenticado(req);
  if (!usuario) return res.status(401).json({ erro: 'Usuário não identificado.' });

  const { titulo, observacoes } = req.body ?? {};
  if (!titulo) return res.status(400).json({ erro: 'Informe o título do trabalho.' });

  try {
    const empresa = await buscarEmpresaPorId(req.params.empresaId);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });

    const id = await inserirTrabalho({
      empresaId: req.params.empresaId,
      titulo,
      executivoId: usuario.id,
      executivoNome: usuario.nome,
      observacoes,
    });
    res.status(201).json({ id });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar trabalho.' });
  }
});

router.patch('/trabalhos/:id', async (req, res) => {
  const { titulo, status, observacoes } = req.body ?? {};
  if (status && !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }
  try {
    const trabalho = await buscarTrabalhoPorId(req.params.id);
    if (!trabalho) return res.status(404).json({ erro: 'Trabalho não encontrado.' });
    await atualizarTrabalho(req.params.id, {
      titulo: titulo ?? trabalho.titulo,
      status: status ?? trabalho.status,
      observacoes: observacoes !== undefined ? observacoes : trabalho.observacoes,
    });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar trabalho.' });
  }
});

router.get('/trabalhos/:id/contatos', async (req, res) => {
  try {
    const trabalho = await buscarTrabalhoPorId(req.params.id);
    if (!trabalho) return res.status(404).json({ erro: 'Trabalho não encontrado.' });
    const contatos = await listarContatosPorTrabalho(req.params.id);
    res.json(contatos);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar contatos.' });
  }
});

router.post('/trabalhos/:id/contatos', async (req, res) => {
  const usuario = obterUsuarioAutenticado(req);
  if (!usuario) return res.status(401).json({ erro: 'Usuário não identificado.' });

  const { tipo, dataContato, observacoes, statusNegocio } = req.body ?? {};
  if (!tipo || !TIPOS_CONTATO.includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo de contato inválido.' });
  }
  if (!dataContato || !observacoes) {
    return res.status(400).json({ erro: 'Informe a data e as observações.' });
  }
  if (statusNegocio && !STATUS_NEGOCIO_EXECUTIVO.includes(statusNegocio)) {
    return res.status(400).json({ erro: 'Status de negócio inválido.' });
  }

  // Calcular alerta para negócio frustrado (2 meses a partir de hoje)
  let alertaEm = null;
  if (statusNegocio === 'negocio_frustrado') {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    alertaEm = d.toISOString().substring(0, 10);
  }

  try {
    const trabalho = await buscarTrabalhoPorId(req.params.id);
    if (!trabalho) return res.status(404).json({ erro: 'Trabalho não encontrado.' });

    const id = await inserirContatoTrabalho(req.params.id, {
      tipo, dataContato, observacoes, statusNegocio, alertaEm,
      registradoPorId: usuario.id, registradoPorNome: usuario.nome,
    });

    // Negócio fechado → atualizar status do trabalho automaticamente
    if (statusNegocio === 'negocio_fechado') {
      await atualizarTrabalho(req.params.id, { titulo: trabalho.titulo, status: 'fechado', observacoes: trabalho.observacoes });
    }

    res.status(201).json({ id, negocioFechado: statusNegocio === 'negocio_fechado', negocioFrustrado: statusNegocio === 'negocio_frustrado', alertaEm });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao registrar contato.' });
  }
});

router.get('/trabalhos/:id/parametros', async (req, res) => {
  try {
    const trabalho = await buscarTrabalhoPorId(req.params.id);
    if (!trabalho) return res.status(404).json({ erro: 'Trabalho não encontrado.' });
    const parametros = await obterParametrosPorTrabalho(req.params.id);
    res.json(parametros ?? {});
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao obter parâmetros.' });
  }
});

router.put('/trabalhos/:id/parametros', async (req, res) => {
  try {
    const trabalho = await buscarTrabalhoPorId(req.params.id);
    if (!trabalho) return res.status(404).json({ erro: 'Trabalho não encontrado.' });
    await salvarParametros(req.params.id, req.body ?? {});
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao salvar parâmetros.' });
  }
});

// ── Atividades da proposta ────────────────────────────────────────────────────

router.get('/trabalhos/:id/atividades', async (req, res) => {
  try {
    const trabalho = await buscarTrabalhoPorId(req.params.id);
    if (!trabalho) return res.status(404).json({ erro: 'Trabalho não encontrado.' });
    const atividades = await listarAtividades(req.params.id);
    res.json(atividades);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar atividades.' });
  }
});

// Adiciona 1 a 6 atividades de uma vez
router.post('/trabalhos/:id/atividades', async (req, res) => {
  const { atividades } = req.body ?? {};
  if (!Array.isArray(atividades) || atividades.length === 0 || atividades.length > 6) {
    return res.status(400).json({ erro: 'Envie de 1 a 6 atividades por vez.' });
  }
  for (const a of atividades) {
    if (!a.cargo) return res.status(400).json({ erro: 'Informe o cargo de cada atividade.' });
  }
  try {
    const trabalho = await buscarTrabalhoPorId(req.params.id);
    if (!trabalho) return res.status(404).json({ erro: 'Trabalho não encontrado.' });
    const ids = await inserirAtividades(req.params.id, atividades);
    res.status(201).json({ ids });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao adicionar atividades.' });
  }
});

router.put('/trabalhos/:trabalhoId/atividades/:id', async (req, res) => {
  const { cargo, descricao, quantidade, salarioBase, vrDias, vtDias, adicionalNoturno, periculosidade, insalubridade, premioIncentivo, tipoEscala } = req.body ?? {};
  if (!cargo) return res.status(400).json({ erro: 'Informe o cargo.' });
  try {
    await atualizarAtividade(req.params.id, { cargo, descricao, quantidade, salarioBase, vrDias, vtDias, adicionalNoturno, periculosidade, insalubridade, premioIncentivo, tipoEscala });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar atividade.' });
  }
});

router.delete('/trabalhos/:trabalhoId/atividades/:id', async (req, res) => {
  try {
    await removerAtividade(req.params.id);
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover atividade.' });
  }
});

export default router;
