import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { criarVerificadorAcesso } from '../../../shared/src/auth.js';
import {
  obterDadosSensiveis, salvarDadosSensiveis,
  obterDadosBancarios, salvarDadosBancarios,
  listarDocumentos, inserirDocumento, validarDocumento, rejeitarDocumento,
  removerDocumento, obterDocumento,
  obterDescontos, salvarDescontos,
  listarAlertas, criarAlerta, marcarAlertaLido, marcarTodosLidos,
  registrarAuditoria, listarAuditoria,
  listarQualificacoesCatalogo, criarQualificacaoCatalogo,
  obterQualificacoesCandidato, salvarQualificacoesCandidato,
  listarCotasMensais, criarCotaMensal, atualizarCotaMensal, removerCotaMensal,
  processarFechamentoMensal, obterDadosCompletosPortal, aceitarVagaPortal,
  desligarCooperado,
} from '../repositories/beneficiosRepository.js';
import { buscarCandidatoPorId } from '../repositories/candidatosRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Em produção serverless (Vercel) o filesystem é read-only — usa /tmp como fallback temporário
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const UPLOADS_DIR = IS_SERVERLESS
  ? '/tmp/beneficios-uploads'
  : path.join(__dirname, '../../uploads');
if (!IS_SERVERLESS && !fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const router = Router();
const verificarAcesso = criarVerificadorAcesso(
  ['administrador', 'ra', 'beneficios', 'supervisao', 'faturamento', 'financeiro'],
  'Benefícios',
  'beneficios'
);

// ── Multer (Armazena em memória para persistência direta no banco de dados MySQL) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido.'));
  },
});

const ROTULO_TIPO_DOC = {
  foto_3x4: 'Foto 3x4', rg_frente: 'RG (frente)', rg_verso: 'RG (verso)', cpf: 'CPF',
  comprovante_residencia: 'Comprovante de Residência', comprovante_bancario: 'Comprovante Bancário',
  cnh: 'CNH', certificado: 'Certificado/Diploma', contrato: 'Contrato', outro: 'Outro',
};

// ── Dados Sensíveis ───────────────────────────────────────────────────────────
router.get('/candidatos/:id/dados-sensiveis', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { res.json(await obterDadosSensiveis(req.params.id) ?? {}); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter dados sensíveis.' }); }
});

router.put('/candidatos/:id/dados-sensiveis', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const c = await buscarCandidatoPorId(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const ant = await obterDadosSensiveis(req.params.id);
    await salvarDadosSensiveis(req.params.id, req.body ?? {});
    await criarAlerta(req.params.id, 'dados_sensiveis', `Dados pessoais atualizados por ${u.nome}.`);
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_dados_sensiveis', acao: ant ? 'edicao' : 'criacao', observacao: `Dados pessoais salvos por ${u.nome}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar dados sensíveis.' }); }
});

// ── Dados Bancários ───────────────────────────────────────────────────────────
router.get('/candidatos/:id/dados-bancarios', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { res.json(await obterDadosBancarios(req.params.id) ?? {}); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter dados bancários.' }); }
});

router.put('/candidatos/:id/dados-bancarios', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const c = await buscarCandidatoPorId(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const ant = await obterDadosBancarios(req.params.id);
    await salvarDadosBancarios(req.params.id, req.body ?? {});
    await criarAlerta(req.params.id, 'dados_bancarios', `Dados bancários atualizados por ${u.nome}.`);
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_dados_bancarios', campo: 'banco', acao: ant ? 'edicao' : 'criacao', valorAnterior: ant?.banco ?? null, valorNovo: req.body?.banco ?? null, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar dados bancários.' }); }
});

// ── Documentos ────────────────────────────────────────────────────────────────
router.get('/candidatos/:id/documentos', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { res.json(await listarDocumentos(req.params.id)); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao listar documentos.' }); }
});

router.post('/candidatos/:id/documentos', upload.single('arquivo'), async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
  const { tipo } = req.body;
  if (!tipo) return res.status(400).json({ erro: 'Campo "tipo" é obrigatório.' });
  try {
    const c = await buscarCandidatoPorId(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const ext = path.extname(req.file.originalname);
    const nomeArquivo = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const { docId, eraSubstituicao } = await inserirDocumento({
      candidatoId: req.params.id,
      tipo,
      nomeOriginal: req.file.originalname,
      nomeArquivo,
      mimeType: req.file.mimetype,
      tamanhoBytes: req.file.size,
      conteudoBlob: req.file.buffer,
      enviadoPorNome: u.nome,
    });
    const rotulo = ROTULO_TIPO_DOC[tipo] ?? tipo;
    const msg = eraSubstituicao
      ? `Documento "${rotulo}" atualizado/substituído por ${u.nome} (Cooperado: ${c.nome}). Requer nova validação.`
      : `Documento "${rotulo}" enviado por ${u.nome} (Cooperado: ${c.nome}). Requer validação.`;
    await criarAlerta(req.params.id, 'documento_enviado', msg);
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_documentos', campo: 'arquivo', acao: 'upload', valorNovo: `${rotulo} — ${req.file.originalname}`, observacao: eraSubstituicao ? 'Substituição de documento existente' : 'Primeiro envio', usuarioId: u.id, usuarioNome: u.nome });
    res.status(201).json({ id: docId, nomeArquivo });
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'Erro ao salvar documento.' });
  }
});

router.get(['/documentos/:id/download', '/api/beneficios/documentos/:id/download', '/portal/documentos/:id/download'], async (req, res) => {
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    if (doc.conteudo_blob) {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nome_original)}"`);
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      return res.send(doc.conteudo_blob);
    }
    const filePath = path.join(UPLOADS_DIR, doc.nome_arquivo);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nome_original)}"`);
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      return res.sendFile(filePath);
    }
    return res.status(404).json({ erro: 'Arquivo não encontrado.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao baixar documento.' });
  }
});

router.patch('/documentos/:id/validar', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    const c = await buscarCandidatoPorId(doc.candidato_id);
    await validarDocumento(req.params.id, u.nome);
    const r = ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo;
    const nomeC = c ? ` (Cooperado: ${c.nome})` : '';
    await criarAlerta(doc.candidato_id, 'documento_validado', `Documento "${r}" validado por ${u.nome}${nomeC}.`);
    await registrarAuditoria({ candidatoId: doc.candidato_id, tabela: 'ra_documentos', campo: 'validado', acao: 'validacao', valorAnterior: '0', valorNovo: '1', observacao: `"${r}" validado por ${u.nome}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao validar documento.' }); }
});

router.patch('/documentos/:id/rejeitar', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  const { motivo } = req.body;
  if (!motivo) return res.status(400).json({ erro: 'Motivo da rejeição é obrigatório.' });
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    const c = await buscarCandidatoPorId(doc.candidato_id);
    await rejeitarDocumento(req.params.id, motivo, u.nome);
    const r = ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo;
    const nomeC = c ? ` (Cooperado: ${c.nome})` : '';
    await criarAlerta(doc.candidato_id, 'documento_rejeitado', `Documento "${r}" rejeitado por ${u.nome}${nomeC}. Motivo: ${motivo}`);
    await registrarAuditoria({ candidatoId: doc.candidato_id, tabela: 'ra_documentos', campo: 'rejeitado', acao: 'rejeicao', valorNovo: motivo, observacao: `"${r}" rejeitado por ${u.nome}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao rejeitar documento.' }); }
});

router.delete('/documentos/:id', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    const c = await buscarCandidatoPorId(doc.candidato_id);
    const nomeArq = await removerDocumento(req.params.id);
    if (nomeArq) fs.unlink(path.join(UPLOADS_DIR, nomeArq), () => {});
    const r = ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo;
    const nomeC = c ? ` (Cooperado: ${c.nome})` : '';
    await criarAlerta(doc.candidato_id, 'documento_removido', `Documento "${r}" removido por ${u.nome}${nomeC}.`);
    await registrarAuditoria({ candidatoId: doc.candidato_id, tabela: 'ra_documentos', campo: 'arquivo', acao: 'exclusao', valorAnterior: `${r} — ${doc.nome_original}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao remover documento.' }); }
});

// ── Descontos ─────────────────────────────────────────────────────────────────
router.get('/candidatos/:id/descontos', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { res.json(await obterDescontos(req.params.id) ?? {}); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter descontos.' }); }
});

router.put('/candidatos/:id/descontos', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const ant = await obterDescontos(req.params.id);
    await salvarDescontos(req.params.id, req.body ?? {});
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_descontos', acao: ant ? 'edicao' : 'criacao', observacao: `Descontos salvos por ${u.nome}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar descontos.' }); }
});

router.get('/alertas', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const filtro = {};
    if (req.query.lido !== undefined) filtro.lido = req.query.lido === '1' || req.query.lido === 'true';
    if (req.query.tipo) filtro.tipo = req.query.tipo;
    if (req.query.busca) filtro.busca = req.query.busca;
    if (req.query.limite) filtro.limite = parseInt(req.query.limite, 10);
    res.json(await listarAlertas(filtro));
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao listar alertas.' }); }
});

router.patch('/alertas/:id/lido', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { await marcarAlertaLido(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ erro: 'Erro ao marcar alerta.' }); }
});

router.patch('/alertas/marcar-todos-lidos', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { await marcarTodosLidos(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ erro: 'Erro ao marcar alertas.' }); }
});

// ── Auditoria ─────────────────────────────────────────────────────────────────
router.get('/candidatos/:id/auditoria', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const limite = Math.min(Number(req.query.limite ?? 100), 500);
    res.json(await listarAuditoria(req.params.id, { limite }));
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter auditoria.' }); }
});

// ── Qualificações — Catálogo ──────────────────────────────────────────────────
router.get('/qualificacoes', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { res.json(await listarQualificacoesCatalogo()); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao listar qualificações.' }); }
});

router.post('/qualificacoes', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  const { nome, categoria } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const id = await criarQualificacaoCatalogo(nome, categoria);
    res.status(201).json({ id });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Qualificação já existe.' });
    console.error(e); res.status(500).json({ erro: 'Erro ao criar qualificação.' });
  }
});

// ── Qualificações — Por Candidato ─────────────────────────────────────────────
router.get('/candidatos/:id/qualificacoes', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { res.json(await obterQualificacoesCandidato(req.params.id)); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter qualificações.' }); }
});

router.put('/candidatos/:id/qualificacoes', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  try {
    await salvarQualificacoesCandidato(req.params.id, ids);
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_candidato_qualificacoes', acao: 'edicao', observacao: `${ids.length} qualificação(ões) salva(s) por ${u.nome}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar qualificações.' }); }
});

// ── Cotas Mensais ─────────────────────────────────────────────────────────────
router.get('/candidatos/:id/cotas-mensais', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { res.json(await listarCotasMensais(req.params.id)); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao listar cotas.' }); }
});

router.post('/candidatos/:id/cotas-mensais', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  const { descricao, tipo, valor, totalParcelas, recorrente, observacao } = req.body;
  if (!descricao || valor === undefined) return res.status(400).json({ erro: 'descricao e valor são obrigatórios.' });
  try {
    const id = await criarCotaMensal({ candidatoId: req.params.id, descricao, tipo, valor, totalParcelas, recorrente, observacao });
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_cotas_mensais', acao: 'criacao', valorNovo: `${descricao} — R$ ${Number(valor).toFixed(2)}`, usuarioId: u.id, usuarioNome: u.nome });
    res.status(201).json({ id });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao criar cota.' }); }
});

router.put('/cotas-mensais/:id', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { await atualizarCotaMensal(req.params.id, req.body); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao atualizar cota.' }); }
});

router.delete('/cotas-mensais/:id', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try { await removerCotaMensal(req.params.id); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao remover cota.' }); }
});

// ── WhatsApp ──────────────────────────────────────────────────────────────────
router.post('/candidatos/:id/notificar-whatsapp', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const c = await buscarCandidatoPorId(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const telefone = (c.telefone ?? '').replace(/\D/g, '');
    if (!telefone) return res.status(400).json({ erro: 'Candidato sem telefone cadastrado.' });

    let baseUrl = req.body?.origem || req.headers['origin'] || req.headers['x-forwarded-host'] || req.headers['referer'];
    if (baseUrl && typeof baseUrl === 'string') {
      try {
        if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
          const parsed = new URL(baseUrl);
          baseUrl = `${parsed.protocol}//${parsed.host}`;
        } else {
          const proto = req.headers['x-forwarded-proto'] || 'https';
          baseUrl = `${proto}://${baseUrl}`;
        }
      } catch {
        baseUrl = null;
      }
    }
    if (!baseUrl) {
      baseUrl = (
        process.env.PORTAL_COOPERADO_URL ||
        process.env.APP_URL ||
        process.env.FRONTEND_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
        (process.env.NODE_ENV === 'production' ? 'https://atesa.connectortech.com.br' : 'http://localhost:8100')
      ).replace(/\/+$/, '');
    }

    const tokenParam = Buffer.from(String(c.id)).toString('base64');
    const link = `${baseUrl}/cooperado/cadastro?token=${tokenParam}`;
    const mensagem = `Olá, ${c.nome.split(' ')[0]}! 🌟\n\nSua cooperativa ATESA está finalizando seu cadastro.\n\nAcesse o link abaixo para completar seus dados, enviar documentos e baixar o aplicativo:\n\n${link}\n\nBem-vindo(a)! 💙`;
    const numero = telefone.startsWith('55') ? telefone : `55${telefone}`;
    const whatsappWebUrl = `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(mensagem)}`;

    let enviado = false;
    let erroEnvio = null;
    const zapiId = process.env.ZAPI_INSTANCE_ID;
    const zapiTok = process.env.ZAPI_TOKEN;
    if (zapiId && zapiTok) {
      try {
        const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
        const resp = await fetch(`https://api.z-api.io/instances/${zapiId}/token/${zapiTok}/send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}) },
          body: JSON.stringify({ phone: numero, message: mensagem })
        });
        enviado = resp.ok;
        if (!resp.ok) erroEnvio = await resp.text();
      } catch (e) { erroEnvio = e.message; }
    }

    await criarAlerta(req.params.id, 'whatsapp', `Notificação WhatsApp ${enviado ? 'enviada automaticamente' : 'gerada para envio'} para ${c.nome} por ${u.nome}.`);
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_candidatos', acao: 'whatsapp', observacao: `Link de cadastro ${enviado ? 'enviado via Z-API' : 'preparado para envio via WhatsApp Web'} por ${u.nome}. Tel: ${telefone}`, usuarioId: u.id, usuarioNome: u.nome });

    res.json({ ok: true, enviado, link, telefone, mensagem, whatsappWebUrl, erroEnvio });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao gerar notificação WhatsApp.' }); }
});

// ── Desligamento ─────────────────────────────────────────────────────────────
router.post('/candidatos/:id/desligar', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const c = await buscarCandidatoPorId(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const { motivo, data_desligamento } = req.body;
    await desligarCooperado(req.params.id, {
      usuarioId: u.id,
      usuarioNome: u.nome,
      motivo,
      dataDesligamento: data_desligamento,
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao notificar desligamento.' }); }
});

// ── Portal do Cooperado (Rotas Públicas autenticadas por Token) ───────────────

function decodificarTokenPortal(token) {
  if (!token) return null;
  const str = String(token).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  try {
    const raw = Buffer.from(str, 'base64').toString('utf8');
    const id = parseInt(raw.split(':')[0], 10);
    if (!isNaN(id) && id > 0) return id;
  } catch {}
  return null;
}

const ROTAS_PORTAL_GET = [
  '/portal/cooperado/:token',
  '/api/beneficios/portal/cooperado/:token',
  '/beneficios/portal/cooperado/:token'
];

router.get(ROTAS_PORTAL_GET, async (req, res) => {
  const candidatoId = decodificarTokenPortal(req.params.token);
  if (!candidatoId) return res.status(400).json({ erro: 'Token inválido ou expirado.' });
  try {
    const dados = await obterDadosCompletosPortal(candidatoId);
    if (!dados) return res.status(404).json({ erro: 'Cooperado não encontrado.' });
    res.json(dados);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao carregar dados do portal.' }); }
});

const ROTAS_PORTAL_ACEITAR = [
  '/portal/cooperado/:token/aceitar-vaga',
  '/api/beneficios/portal/cooperado/:token/aceitar-vaga',
  '/beneficios/portal/cooperado/:token/aceitar-vaga'
];

router.post(ROTAS_PORTAL_ACEITAR, async (req, res) => {
  const candidatoId = decodificarTokenPortal(req.params.token);
  if (!candidatoId) return res.status(400).json({ erro: 'Token inválido.' });
  try {
    const resultado = await aceitarVagaPortal(candidatoId, req.body ?? {});
    res.json(resultado);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao aceitar vaga.' }); }
});

const ROTAS_PORTAL_DADOS = [
  '/portal/cooperado/:token/dados',
  '/api/beneficios/portal/cooperado/:token/dados',
  '/beneficios/portal/cooperado/:token/dados'
];

router.post(ROTAS_PORTAL_DADOS, async (req, res) => {
  const candidatoId = decodificarTokenPortal(req.params.token);
  if (!candidatoId) return res.status(400).json({ erro: 'Token inválido.' });
  try {
    const { dadosSensiveis, dadosBancarios } = req.body ?? {};
    if (dadosSensiveis) await salvarDadosSensiveis(candidatoId, dadosSensiveis);
    if (dadosBancarios) await salvarDadosBancarios(candidatoId, dadosBancarios);
    await criarAlerta(candidatoId, 'dados_portal', 'Dados cadastrais atualizados pelo cooperado através do Portal Web.');
    await registrarAuditoria({ candidatoId, tabela: 'ra_candidatos', acao: 'edicao', observacao: 'Atualização de cadastro via Portal Web.', usuarioNome: 'Cooperado (Portal)' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar dados pelo portal.' }); }
});

const ROTAS_PORTAL_DOCS = [
  '/portal/cooperado/:token/documentos',
  '/api/beneficios/portal/cooperado/:token/documentos',
  '/beneficios/portal/cooperado/:token/documentos'
];

router.post(ROTAS_PORTAL_DOCS, upload.single('arquivo'), async (req, res) => {
  const candidatoId = decodificarTokenPortal(req.params.token);
  if (!candidatoId) return res.status(400).json({ erro: 'Token inválido.' });
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
  const { tipo } = req.body;
  if (!tipo) return res.status(400).json({ erro: 'Campo "tipo" é obrigatório.' });
  try {
    const c = await buscarCandidatoPorId(candidatoId);
    const ext = path.extname(req.file.originalname);
    const nomeArquivo = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const { docId, eraSubstituicao } = await inserirDocumento({
      candidatoId,
      tipo,
      nomeOriginal: req.file.originalname,
      nomeArquivo,
      mimeType: req.file.mimetype,
      tamanhoBytes: req.file.size,
      conteudoBlob: req.file.buffer,
      enviadoPorNome: 'Cooperado (Portal)',
    });
    const rotulo = ROTULO_TIPO_DOC[tipo] ?? tipo;
    const nomeC = c ? c.nome : 'Cooperado';
    const msg = eraSubstituicao
      ? `Documento "${rotulo}" atualizado/substituído pelo cooperado ${nomeC} via Portal Web. Requer validação.`
      : `Documento "${rotulo}" enviado pelo cooperado ${nomeC} via Portal Web. Requer validação.`;
    await criarAlerta(candidatoId, 'documento_enviado', msg);
    await registrarAuditoria({ candidatoId, tabela: 'ra_documentos', campo: 'arquivo', acao: 'upload', valorNovo: `${rotulo} — ${req.file.originalname}`, observacao: eraSubstituicao ? 'Substituição via Portal' : 'Envio via Portal', usuarioNome: `Cooperado (${nomeC})` });
    res.status(201).json({ id: docId, nomeArquivo });
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'Erro ao enviar documento pelo portal.' });
  }
});

export default router;
