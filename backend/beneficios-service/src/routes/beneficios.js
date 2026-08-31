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
  ['administrador', 'ra', 'beneficios', 'executivo_contas', 'consultor', 'parametro', 'supervisao', 'faturamento', 'financeiro'],
  'Benefícios'
);

// ── Multer ────────────────────────────────────────────────────────────────────
// Em ambiente serverless usamos /tmp (por request, sem persistência entre calls)
if (IS_SERVERLESS) {
  try { if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
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
    const docId = await inserirDocumento({ candidatoId: req.params.id, tipo, nomeOriginal: req.file.originalname, nomeArquivo: req.file.filename, mimeType: req.file.mimetype, tamanhoBytes: req.file.size, enviadoPorNome: u.nome });
    await criarAlerta(req.params.id, 'documento_enviado', `Documento "${ROTULO_TIPO_DOC[tipo] ?? tipo}" enviado por ${u.nome}.`);
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_documentos', campo: 'arquivo', acao: 'upload', valorNovo: `${ROTULO_TIPO_DOC[tipo] ?? tipo} — ${req.file.originalname}`, usuarioId: u.id, usuarioNome: u.nome });
    res.status(201).json({ id: docId, nomeArquivo: req.file.filename });
  } catch (e) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error(e); res.status(500).json({ erro: 'Erro ao salvar documento.' });
  }
});

router.get('/documentos/:id/download', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    const filePath = path.join(UPLOADS_DIR, doc.nome_arquivo);
    if (!fs.existsSync(filePath)) return res.status(404).json({ erro: 'Arquivo não encontrado.' });
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nome_original)}"`);
    res.setHeader('Content-Type', doc.mime_type);
    res.sendFile(filePath);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao baixar documento.' }); }
});

router.patch('/documentos/:id/validar', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    await validarDocumento(req.params.id, u.nome);
    const r = ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo;
    await criarAlerta(doc.candidato_id, 'documento_validado', `Documento "${r}" validado por ${u.nome}.`);
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
    await rejeitarDocumento(req.params.id, motivo, u.nome);
    const r = ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo;
    await criarAlerta(doc.candidato_id, 'documento_rejeitado', `Documento "${r}" rejeitado por ${u.nome}. Motivo: ${motivo}`);
    await registrarAuditoria({ candidatoId: doc.candidato_id, tabela: 'ra_documentos', campo: 'rejeitado', acao: 'rejeicao', valorNovo: motivo, observacao: `"${r}" rejeitado por ${u.nome}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao rejeitar documento.' }); }
});

router.delete('/documentos/:id', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    const nomeArq = await removerDocumento(req.params.id);
    if (nomeArq) fs.unlink(path.join(UPLOADS_DIR, nomeArq), () => {});
    await criarAlerta(doc.candidato_id, 'documento_removido', `Documento removido por ${u.nome}.`);
    await registrarAuditoria({ candidatoId: doc.candidato_id, tabela: 'ra_documentos', campo: 'arquivo', acao: 'exclusao', valorAnterior: `${ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo} — ${doc.nome_original}`, usuarioId: u.id, usuarioNome: u.nome });
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

// ── Alertas ───────────────────────────────────────────────────────────────────
router.get('/alertas', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const { lido } = req.query;
    const filtro = lido !== undefined ? { lido: lido === '1' } : {};
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
    const baseUrl = process.env.PORTAL_COOPERADO_URL ?? 'https://portal.connectortech.com.br';
    const link = `${baseUrl}/cooperado/cadastro?token=${Buffer.from(String(c.id)).toString('base64')}`;
    const mensagem = `Olá, ${c.nome.split(' ')[0]}! 🌟\n\nSua cooperativa ATESA está finalizando seu cadastro.\n\nAcesse o link abaixo para completar seus dados, enviar documentos e baixar o aplicativo:\n\n${link}\n\nBem-vindo(a)! 💙`;
    let enviado = false; let erroEnvio = null;
    const zapiId = process.env.ZAPI_INSTANCE_ID; const zapiTok = process.env.ZAPI_TOKEN;
    if (zapiId && zapiTok) {
      try {
        const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
        const numero = telefone.startsWith('55') ? telefone : `55${telefone}`;
        const resp = await fetch(`https://api.z-api.io/instances/${zapiId}/token/${zapiTok}/send-text`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}) }, body: JSON.stringify({ phone: numero, message: mensagem }) });
        enviado = resp.ok; if (!resp.ok) erroEnvio = await resp.text();
      } catch (e) { erroEnvio = e.message; }
    }
    await criarAlerta(req.params.id, 'whatsapp', `Notificação WhatsApp ${enviado ? 'enviada' : 'registrada'} para ${c.nome} por ${u.nome}.`);
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_candidatos', acao: 'whatsapp', observacao: `Link de cadastro enviado${enviado ? '' : ' (simulado)'} por ${u.nome}. Tel: ${telefone}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true, enviado, link, telefone, erroEnvio });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao enviar notificação.' }); }
});

// ── Notificação de desligamento ───────────────────────────────────────────────
router.post('/candidatos/:id/notificar-desligamento', async (req, res) => {
  const u = verificarAcesso(req, res); if (!u) return;
  try {
    const c = await buscarCandidatoPorId(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const { motivo, data_desligamento } = req.body;
    await criarAlerta(req.params.id, 'desligamento', `⚠️ Cooperado ${c.nome} foi desligado${data_desligamento ? ` em ${data_desligamento}` : ''}.${motivo ? ` Motivo: ${motivo}` : ''} Benefícios devem ser cancelados.`);
    await registrarAuditoria({ candidatoId: req.params.id, tabela: 'ra_candidatos', acao: 'notificacao', observacao: `Desligamento registrado por ${u.nome}. ${motivo ?? ''}`, usuarioId: u.id, usuarioNome: u.nome });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao notificar desligamento.' }); }
});

export default router;
