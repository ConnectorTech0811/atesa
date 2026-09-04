import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { criarVerificadorAcesso } from '../../../shared/src/auth.js';
import {
  obterDadosSensiveis, salvarDadosSensiveis,
  obterDadosBancarios, salvarDadosBancarios,
  listarDocumentos, inserirDocumento, validarDocumento, rejeitarDocumento, removerDocumento, obterDocumento,
  obterDescontos, salvarDescontos,
  listarAlertas, criarAlerta, marcarAlertaLido, marcarTodosLidos,
  registrarAuditoria, listarAuditoria,
  listarQualificacoesCatalogo, criarQualificacaoCatalogo,
  obterQualificacoesCandidato, salvarQualificacoesCandidato,
  listarCotasMensais, criarCotaMensal, atualizarCotaMensal, removerCotaMensal,
} from '../repositories/beneficiosRepository.js';
import { buscarCandidatoPorId } from '../repositories/raRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const verificarAcesso = criarVerificadorAcesso(
  ['administrador', 'ra', 'beneficios', 'executivo_contas', 'consultor', 'parametro', 'supervisao', 'faturamento', 'financeiro'],
  'Benefícios'
);

// ── Multer ────────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
// ── Multer (Armazena em memória para persistência direta no banco de dados MySQL) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou PDF.'));
  },
});

const ROTULO_TIPO_DOC = {
  foto_3x4: 'Foto 3x4',
  rg_frente: 'RG (frente)',
  rg_verso: 'RG (verso)',
  cpf: 'CPF',
  comprovante_residencia: 'Comprovante de Residência',
  comprovante_bancario: 'Comprovante Bancário',
  cnh: 'CNH',
  certificado: 'Certificado/Diploma',
  contrato: 'Contrato',
  outro: 'Outro',
};

// ── Dados Sensíveis ───────────────────────────────────────────────────────────

router.get('/ra/candidatos/:id/dados-sensiveis', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    res.json(await obterDadosSensiveis(req.params.id) ?? {});
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter dados sensíveis.' }); }
});

router.put('/ra/candidatos/:id/dados-sensiveis', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const candidato = await buscarCandidatoPorId(req.params.id);
    if (!candidato) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const anterior = await obterDadosSensiveis(req.params.id);
    await salvarDadosSensiveis(req.params.id, req.body ?? {});
    await criarAlerta(req.params.id, 'dados_sensiveis', `Dados pessoais atualizados por ${usuario.nome}.`);
    await registrarAuditoria({
      candidatoId: req.params.id,
      tabela: 'ra_dados_sensiveis',
      acao: anterior ? 'edicao' : 'criacao',
      observacao: `Dados pessoais salvos por ${usuario.nome}`,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar dados sensíveis.' }); }
});

// ── Dados Bancários ───────────────────────────────────────────────────────────

router.get('/ra/candidatos/:id/dados-bancarios', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    res.json(await obterDadosBancarios(req.params.id) ?? {});
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter dados bancários.' }); }
});

router.put('/ra/candidatos/:id/dados-bancarios', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const candidato = await buscarCandidatoPorId(req.params.id);
    if (!candidato) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const anterior = await obterDadosBancarios(req.params.id);
    const antBanco = anterior?.banco ?? null;
    await salvarDadosBancarios(req.params.id, req.body ?? {});
    await criarAlerta(req.params.id, 'dados_bancarios', `Dados bancários atualizados por ${usuario.nome}.`);
    await registrarAuditoria({
      candidatoId: req.params.id,
      tabela: 'ra_dados_bancarios',
      campo: 'banco',
      acao: anterior ? 'edicao' : 'criacao',
      valorAnterior: antBanco,
      valorNovo: req.body?.banco ?? null,
      observacao: `Dados bancários salvos por ${usuario.nome}`,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar dados bancários.' }); }
});

// ── Documentos ────────────────────────────────────────────────────────────────

router.get('/ra/candidatos/:id/documentos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    res.json(await listarDocumentos(req.params.id));
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao listar documentos.' }); }
});

router.post('/ra/candidatos/:id/documentos', upload.single('arquivo'), async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
  const { tipo } = req.body;
  if (!tipo) return res.status(400).json({ erro: 'Campo "tipo" é obrigatório.' });
  try {
    const candidato = await buscarCandidatoPorId(req.params.id);
    if (!candidato) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const ext = path.extname(req.file.originalname);
    const nomeArquivo = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const docId = await inserirDocumento({
      candidatoId: req.params.id,
      tipo,
      nomeOriginal: req.file.originalname,
      nomeArquivo,
      mimeType: req.file.mimetype,
      tamanhoBytes: req.file.size,
      conteudoBlob: req.file.buffer,
      enviadoPorNome: usuario.nome,
    });
    await criarAlerta(req.params.id, 'documento_enviado', `Documento "${ROTULO_TIPO_DOC[tipo] ?? tipo}" enviado por ${usuario.nome}.`);
    await registrarAuditoria({
      candidatoId: req.params.id,
      tabela: 'ra_documentos',
      campo: 'arquivo',
      acao: 'upload',
      valorNovo: `${ROTULO_TIPO_DOC[tipo] ?? tipo} — ${req.file.originalname}`,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
    });
    res.status(201).json({ id: docId, nomeArquivo });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao salvar documento.' });
  }
});

router.get('/ra/documentos/:id/download', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
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
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao baixar documento.' }); }
});

router.patch('/ra/documentos/:id/validar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    await validarDocumento(req.params.id, usuario.nome);
    await criarAlerta(doc.candidato_id, 'documento_validado', `Documento "${ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo}" validado por ${usuario.nome}.`);
    await registrarAuditoria({
      candidatoId: doc.candidato_id, tabela: 'ra_documentos', campo: 'validado',
      acao: 'validacao', valorAnterior: '0', valorNovo: '1',
      observacao: `"${ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo}" validado por ${usuario.nome}`,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao validar documento.' }); }
});

// NOVO: Rejeitar documento com justificativa
router.patch('/ra/documentos/:id/rejeitar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { motivo } = req.body;
  if (!motivo) return res.status(400).json({ erro: 'Motivo da rejeição é obrigatório.' });
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    await rejeitarDocumento(req.params.id, motivo, usuario.nome);
    const rotulo = ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo;
    await criarAlerta(doc.candidato_id, 'documento_rejeitado', `Documento "${rotulo}" rejeitado por ${usuario.nome}. Motivo: ${motivo}`);
    await registrarAuditoria({
      candidatoId: doc.candidato_id, tabela: 'ra_documentos', campo: 'rejeitado',
      acao: 'rejeicao', valorNovo: motivo,
      observacao: `"${rotulo}" rejeitado por ${usuario.nome}`,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao rejeitar documento.' }); }
});

router.delete('/ra/documentos/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const doc = await obterDocumento(req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    const nomeArquivo = await removerDocumento(req.params.id);
    if (nomeArquivo) fs.unlink(path.join(UPLOADS_DIR, nomeArquivo), () => {});
    await criarAlerta(doc.candidato_id, 'documento_removido', `Documento removido por ${usuario.nome}.`);
    await registrarAuditoria({
      candidatoId: doc.candidato_id, tabela: 'ra_documentos', campo: 'arquivo',
      acao: 'exclusao', valorAnterior: `${ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo} — ${doc.nome_original}`,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao remover documento.' }); }
});

// ── Descontos ─────────────────────────────────────────────────────────────────

router.get('/ra/candidatos/:id/descontos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    res.json(await obterDescontos(req.params.id) ?? {});
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter descontos.' }); }
});

router.put('/ra/candidatos/:id/descontos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const anterior = await obterDescontos(req.params.id);
    await salvarDescontos(req.params.id, req.body ?? {});
    await registrarAuditoria({
      candidatoId: req.params.id, tabela: 'ra_descontos',
      acao: anterior ? 'edicao' : 'criacao',
      observacao: `Descontos salvos por ${usuario.nome}`,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar descontos.' }); }
});

// ── Alertas ───────────────────────────────────────────────────────────────────

router.get('/ra/alertas', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const { lido } = req.query;
    const filtro = lido !== undefined ? { lido: lido === '1' } : {};
    res.json(await listarAlertas(filtro));
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao listar alertas.' }); }
});

router.patch('/ra/alertas/:id/lido', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try { await marcarAlertaLido(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ erro: 'Erro ao marcar alerta.' }); }
});

router.patch('/ra/alertas/marcar-todos-lidos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try { await marcarTodosLidos(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ erro: 'Erro ao marcar alertas.' }); }
});

// ── Auditoria ─────────────────────────────────────────────────────────────────

router.get('/ra/candidatos/:id/auditoria', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const limite = Math.min(Number(req.query.limite ?? 100), 500);
    res.json(await listarAuditoria(req.params.id, { limite }));
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter auditoria.' }); }
});

// ── Qualificações — Catálogo ──────────────────────────────────────────────────

router.get('/ra/qualificacoes', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try { res.json(await listarQualificacoesCatalogo()); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao listar qualificações.' }); }
});

router.post('/ra/qualificacoes', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
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

router.get('/ra/candidatos/:id/qualificacoes', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try { res.json(await obterQualificacoesCandidato(req.params.id)); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao obter qualificações.' }); }
});

router.put('/ra/candidatos/:id/qualificacoes', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  try {
    await salvarQualificacoesCandidato(req.params.id, ids);
    await registrarAuditoria({
      candidatoId: req.params.id, tabela: 'ra_candidato_qualificacoes',
      acao: 'edicao', observacao: `${ids.length} qualificação(ões) salva(s) por ${usuario.nome}`,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar qualificações.' }); }
});

// ── Cotas Mensais ─────────────────────────────────────────────────────────────

router.get('/ra/candidatos/:id/cotas-mensais', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try { res.json(await listarCotasMensais(req.params.id)); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao listar cotas.' }); }
});

router.post('/ra/candidatos/:id/cotas-mensais', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { descricao, tipo, valor, totalParcelas, recorrente, observacao } = req.body;
  if (!descricao || valor === undefined) return res.status(400).json({ erro: 'descricao e valor são obrigatórios.' });
  try {
    const id = await criarCotaMensal({ candidatoId: req.params.id, descricao, tipo, valor, totalParcelas, recorrente, observacao });
    await registrarAuditoria({
      candidatoId: req.params.id, tabela: 'ra_cotas_mensais', acao: 'criacao',
      valorNovo: `${descricao} — R$ ${Number(valor).toFixed(2)}`,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });
    res.status(201).json({ id });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao criar cota.' }); }
});

router.put('/ra/cotas-mensais/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    await atualizarCotaMensal(req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao atualizar cota.' }); }
});

router.delete('/ra/cotas-mensais/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    await removerCotaMensal(req.params.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao remover cota.' }); }
});

// ── Notificação WhatsApp ──────────────────────────────────────────────────────
// Envia mensagem via API configurada em .env (Z-API, Evolution, Twilio, etc.)

router.post('/ra/candidatos/:id/notificar-whatsapp', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const candidato = await buscarCandidatoPorId(req.params.id);
    if (!candidato) return res.status(404).json({ erro: 'Candidato não encontrado.' });

    const telefone = (candidato.telefone ?? '').replace(/\D/g, '');
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

    const link = `${baseUrl}/cooperado/cadastro?token=${Buffer.from(String(candidato.id)).toString('base64')}`;
    const mensagem = `Olá, ${candidato.nome.split(' ')[0]}! 🌟\n\nSua cooperativa ATESA está finalizando seu cadastro.\n\nAcesse o link abaixo para completar seus dados, enviar documentos e baixar o aplicativo:\n\n${link}\n\nQualquer dúvida, entre em contato conosco. Bem-vindo(a)! 💙`;
    const numero = telefone.startsWith('55') ? telefone : `55${telefone}`;
    const whatsappWebUrl = `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(mensagem)}`;

    // Tenta enviar via Z-API se configurado
    const zapiInstanceId = process.env.ZAPI_INSTANCE_ID;
    const zapiToken      = process.env.ZAPI_TOKEN;
    const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN;

    let enviado = false;
    let erroEnvio = null;

    if (zapiInstanceId && zapiToken) {
      try {
        const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
        const resp = await fetch(
          `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(zapiClientToken ? { 'Client-Token': zapiClientToken } : {}),
            },
            body: JSON.stringify({ phone: numero, message: mensagem }),
          }
        );
        enviado = resp.ok;
        if (!resp.ok) erroEnvio = await resp.text();
      } catch (e) {
        erroEnvio = e.message;
      }
    }

    // Registra tentativa independente do resultado
    await criarAlerta(req.params.id, 'whatsapp', `Notificação WhatsApp ${enviado ? 'enviada automaticamente' : 'gerada para envio'} para ${candidato.nome} por ${usuario.nome}.`);
    await registrarAuditoria({
      candidatoId: req.params.id, tabela: 'ra_candidatos', acao: 'whatsapp',
      observacao: `Link de cadastro ${enviado ? 'enviado via Z-API' : 'preparado para envio via WhatsApp Web'} por ${usuario.nome}. Tel: ${telefone}`,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });

    res.json({ ok: true, enviado, link, telefone, mensagem, whatsappWebUrl, erroEnvio });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao enviar notificação.' }); }
});

// ── Integração: Notificação de desligamento (chamada pela supervisão) ─────────

router.post('/ra/candidatos/:id/notificar-desligamento', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const candidato = await buscarCandidatoPorId(req.params.id);
    if (!candidato) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const { motivo, data_desligamento } = req.body;

    await criarAlerta(
      req.params.id,
      'desligamento',
      `⚠️ Cooperado ${candidato.nome} foi desligado${data_desligamento ? ` em ${data_desligamento}` : ''}.${motivo ? ` Motivo: ${motivo}` : ''} Benefícios devem ser cancelados.`
    );
    await registrarAuditoria({
      candidatoId: req.params.id, tabela: 'ra_candidatos', acao: 'notificacao',
      observacao: `Desligamento registrado por ${usuario.nome}. ${motivo ?? ''}`,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });

    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao notificar desligamento.' }); }
});

export default router;
