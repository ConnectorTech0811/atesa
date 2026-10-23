// Rotas de Comissões, Notas Fiscais, Cobranças (tela Faturamento) e Recebimentos (tela Financeiro).
// Montadas pelo router da supervisão: mesmos prefixos /supervisao e /monitoramento.
import { Router } from 'express';
import { obterUsuarioAutenticado } from '../../../shared/src/auth.js';
import { pool } from '../config/database.js';
import { podeAcessarItemMonitoramento, podeAcessarItemFinanceiro, exigirAcesso, usuarioAuditoria } from './acesso.js';
import { listarAuditoriaFinanceira, obterConteudoDocumento } from '../repositories/financeiroComum.js';
import {
  BASES_CALCULO, REFERENCIAS_VIGENCIA, listarUsuariosComissionaveis, listarRegras, criarRegra, atualizarRegra, confirmarRegra,
  inativarRegra, sugerirResponsaveis, listarResponsaveis, vincularResponsaveisDaEmpresa, adicionarResponsavel, removerResponsavel,
  calcularComissoesProcesso, listarComissoes, informarBaseManual, conferirComissao, contestarComissao, reabrirComissao,
} from '../repositories/comissoesRepository.js';
import {
  listarMunicipios, salvarMunicipio, listarNotas, criarNota, atualizarNota, registrarEmissaoNota, emitirNotaAutomaticamente,
  cancelarNota, anexarDocumentoNota, listarCobrancas, criarCobranca, atualizarCobranca, cancelarCobranca,
} from '../repositories/notasCobrancasRepository.js';
import {
  previaLancamentos, confirmarLancamentos, criarLancamentoManual, listarLancamentos, cancelarLancamento, estornarLancamento, adiarCompensacao,
  listarBloqueios, bloquearPagamentos, encerrarBloqueio, registrarAdiantamento, extratoCooperado, listarCooperadosParaLancamento,
  montarFila, atualizarPendenciasFila, listarFila, obterPagamento, liberarPagamento, desfazerLiberacao, cancelarPagamento, confirmarPagamento,
} from '../repositories/pagamentosCooperadosRepository.js';
import { RELATORIOS, gerarRelatorio } from '../repositories/relatoriosFinanceirosRepository.js';
import { criarLote, listarLotes, obterLote, marcarLoteEnviado, cancelarLote, registrarOcorrenciaItem } from '../repositories/remessasRepository.js';
import {
  listarFornecedores, salvarFornecedor, listarCategorias, salvarCategoria, listarContas, obterConta, criarConta, atualizarConta, aprovarConta,
  rejeitarConta, programarConta, baixarConta, estornarBaixaConta, cancelarConta, anexarDocumentoConta,
} from '../repositories/contasPagarRepository.js';
import {
  modeloCsvRetorno, importarRetorno, listarRetornos, obterRetorno, processarRetorno, descartarRetorno,
  listarRecebimentos, registrarBaixaManual, vincularRecebimento, estornarRecebimento,
} from '../repositories/recebimentosRepository.js';

const router = Router();
const p3 = (sub) => [sub, `/supervisao${sub}`, `/monitoramento${sub}`];

const exigirFaturamento = exigirAcesso([[podeAcessarItemMonitoramento, 'monitoramento.faturamento']], 'Seu usuário não tem permissão para acessar o Faturamento.');
const exigirRecebimentos = exigirAcesso([[podeAcessarItemFinanceiro, 'financeiro.recebimentos']], 'Seu usuário não tem permissão para acessar os Recebimentos.');
const exigirBaixaManual = exigirAcesso([[podeAcessarItemFinanceiro, 'financeiro.baixa_manual']], 'Seu usuário não está autorizado a registrar baixa manual, vínculo ou estorno de recebimentos.');
const exigirLancamentos = exigirAcesso([[podeAcessarItemFinanceiro, 'financeiro.lancamentos']], 'Seu usuário não tem permissão para lançamentos, adiantamentos e descontos de cooperados.');
const exigirPagamentos = exigirAcesso([[podeAcessarItemFinanceiro, 'financeiro.pagamentos']], 'Seu usuário não tem permissão para a fila de pagamentos.');
const exigirContasPagar = exigirAcesso([[podeAcessarItemFinanceiro, 'financeiro.contas_pagar']], 'Seu usuário não tem permissão para contas a pagar.');
const exigirAprovarContas = exigirAcesso([[podeAcessarItemFinanceiro, 'financeiro.contas_aprovar']], 'Seu usuário não está autorizado a aprovar ou rejeitar contas a pagar.');

// Documento: a permissão depende de onde ele está anexado
const PERMISSAO_DOCUMENTO = {
  nota: [[podeAcessarItemMonitoramento, 'monitoramento.faturamento'], [podeAcessarItemFinanceiro, 'financeiro.recebimentos']],
  retorno: [[podeAcessarItemFinanceiro, 'financeiro.recebimentos']],
  recebimento: [[podeAcessarItemFinanceiro, 'financeiro.recebimentos']],
  pagamento: [[podeAcessarItemFinanceiro, 'financeiro.pagamentos']],
  lote: [[podeAcessarItemFinanceiro, 'financeiro.pagamentos']],
  conta_pagar: [[podeAcessarItemFinanceiro, 'financeiro.contas_pagar']],
};
const exigirAlgumDocumento = exigirAcesso(
  [...new Map(Object.values(PERMISSAO_DOCUMENTO).flat().map((v) => [v[1], v])).values()],
  'Seu usuário não tem permissão para acessar este documento.'
);

const responder = (fn, padrao, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await fn(req));
  } catch (err) {
    if (!err.status || (err.status >= 500 && err.status !== 501)) console.error(padrao, err);
    const corpo = { erro: err.message || padrao };
    if (err.detalhes) corpo.detalhes = err.detalhes;
    if (err.codigo) corpo.codigo = err.codigo;
    res.status(err.status || 500).json(corpo);
  }
};
const u = usuarioAuditoria;

// ── Comissões ───────────────────────────────────────────────────────────────
router.get(p3('/faturamento/comissoes/opcoes'), exigirFaturamento, responder(async () => ({
  usuarios: await listarUsuariosComissionaveis(), bases: BASES_CALCULO, referencias: REFERENCIAS_VIGENCIA,
}), 'Erro ao carregar opções de comissão.'));
router.get(p3('/faturamento/comissoes/regras'), exigirFaturamento, responder((req) => listarRegras(req.query), 'Erro ao listar regras de comissão.'));
router.post(p3('/faturamento/comissoes/regras'), exigirFaturamento, responder((req) => criarRegra(req.body ?? {}, u(req)), 'Erro ao cadastrar regra de comissão.', 201));
router.put(p3('/faturamento/comissoes/regras/:id'), exigirFaturamento, responder((req) => atualizarRegra(req.params.id, req.body ?? {}, u(req)), 'Erro ao alterar regra de comissão.'));
router.post(p3('/faturamento/comissoes/regras/:id/confirmar'), exigirFaturamento, responder((req) => confirmarRegra(req.params.id, req.body ?? {}, u(req)), 'Erro ao confirmar regra.'));
router.post(p3('/faturamento/comissoes/regras/:id/inativar'), exigirFaturamento, responder((req) => inativarRegra(req.params.id, req.body ?? {}, u(req)), 'Erro ao inativar regra.'));
router.get(p3('/faturamento/comissoes'), exigirFaturamento, responder((req) => listarComissoes(req.query), 'Erro ao listar comissões.'));
router.post(p3('/faturamento/comissoes/:id/base-manual'), exigirFaturamento, responder((req) => informarBaseManual(req.params.id, req.body ?? {}, u(req)), 'Erro ao informar base.'));
router.post(p3('/faturamento/comissoes/:id/conferir'), exigirFaturamento, responder((req) => conferirComissao(req.params.id, u(req)), 'Erro ao conferir comissão.'));
router.post(p3('/faturamento/comissoes/:id/contestar'), exigirFaturamento, responder((req) => contestarComissao(req.params.id, req.body ?? {}, u(req)), 'Erro ao contestar comissão.'));
router.post(p3('/faturamento/comissoes/:id/reabrir'), exigirFaturamento, responder((req) => reabrirComissao(req.params.id, req.body ?? {}, u(req)), 'Erro ao reabrir comissão.'));

router.get(p3('/faturamento/processos/:id/responsaveis'), exigirFaturamento, responder(async (req) => ({
  responsaveis: await listarResponsaveis(req.params.id), ...(await sugerirResponsaveis(req.params.id)),
}), 'Erro ao listar responsáveis.'));
router.post(p3('/faturamento/processos/:id/responsaveis'), exigirFaturamento, responder((req) => adicionarResponsavel(req.params.id, req.body ?? {}, u(req)), 'Erro ao vincular responsável.', 201));
router.post(p3('/faturamento/processos/:id/responsaveis/da-empresa'), exigirFaturamento, responder((req) => vincularResponsaveisDaEmpresa(req.params.id, u(req)), 'Erro ao vincular responsáveis.'));
router.delete(p3('/faturamento/processos/:id/responsaveis/:responsavelId'), exigirFaturamento, responder((req) => removerResponsavel(req.params.id, req.params.responsavelId, req.query ?? {}, u(req)), 'Erro ao remover responsável.'));
router.post(p3('/faturamento/processos/:id/comissoes/calcular'), exigirFaturamento, responder((req) => calcularComissoesProcesso(req.params.id, u(req)), 'Erro ao calcular comissões.'));

// ── Prefeituras / notas fiscais / cobranças ─────────────────────────────────
router.get(p3('/faturamento/municipios'), exigirFaturamento, responder(() => listarMunicipios(), 'Erro ao listar prefeituras.'));
router.post(p3('/faturamento/municipios'), exigirFaturamento, responder((req) => salvarMunicipio(null, req.body ?? {}, u(req)), 'Erro ao cadastrar prefeitura.', 201));
router.put(p3('/faturamento/municipios/:id'), exigirFaturamento, responder((req) => salvarMunicipio(req.params.id, req.body ?? {}, u(req)), 'Erro ao alterar prefeitura.'));

router.get(p3('/faturamento/processos/:id/notas'), exigirFaturamento, responder((req) => listarNotas(req.params.id), 'Erro ao listar notas fiscais.'));
router.post(p3('/faturamento/processos/:id/notas'), exigirFaturamento, responder((req) => criarNota(req.params.id, req.body ?? {}, u(req)), 'Erro ao criar nota fiscal.', 201));
router.put(p3('/faturamento/notas/:id'), exigirFaturamento, responder((req) => atualizarNota(req.params.id, req.body ?? {}, u(req)), 'Erro ao alterar nota fiscal.'));
router.post(p3('/faturamento/notas/:id/registrar-emissao'), exigirFaturamento, responder((req) => registrarEmissaoNota(req.params.id, req.body ?? {}, u(req)), 'Erro ao registrar emissão.'));
router.post(p3('/faturamento/notas/:id/emitir-automatico'), exigirFaturamento, responder((req) => emitirNotaAutomaticamente(req.params.id), 'Emissão automática indisponível.'));
router.post(p3('/faturamento/notas/:id/cancelar'), exigirFaturamento, responder((req) => cancelarNota(req.params.id, req.body ?? {}, u(req)), 'Erro ao cancelar nota fiscal.'));
router.post(p3('/faturamento/notas/:id/documentos'), exigirFaturamento, responder((req) => anexarDocumentoNota(req.params.id, req.body ?? {}, u(req)), 'Erro ao anexar documento.', 201));

router.get(p3('/faturamento/processos/:id/cobrancas'), exigirFaturamento, responder((req) => listarCobrancas({ processoId: req.params.id }), 'Erro ao listar cobranças.'));
router.post(p3('/faturamento/processos/:id/cobrancas'), exigirFaturamento, responder((req) => criarCobranca(req.params.id, req.body ?? {}, u(req)), 'Erro ao registrar cobrança.', 201));
router.put(p3('/faturamento/cobrancas/:id'), exigirFaturamento, responder((req) => atualizarCobranca(req.params.id, req.body ?? {}, u(req)), 'Erro ao alterar cobrança.'));
router.post(p3('/faturamento/cobrancas/:id/cancelar'), exigirFaturamento, responder((req) => cancelarCobranca(req.params.id, req.body ?? {}, u(req)), 'Erro ao cancelar cobrança.'));
router.get(p3('/faturamento/auditoria-financeira'), exigirFaturamento, responder((req) => listarAuditoriaFinanceira(req.query), 'Erro ao consultar histórico.'));

// Documentos (PDF/XML da nota, comprovantes, arquivos de retorno): sem link público
router.get(p3('/financeiro/documentos/:id'), exigirAlgumDocumento, async (req, res) => {
  try {
    const doc = await obterConteudoDocumento(req.params.id);
    if (!(PERMISSAO_DOCUMENTO[doc.entidade] ?? []).some(([fn, item]) => fn(req, item))) {
      return res.status(403).json({ erro: 'Seu usuário não tem permissão para acessar este documento.' });
    }
    const nome = String(doc.nome_arquivo).replace(/[^\w.\- ]+/g, '_');
    res.setHeader('Content-Type', doc.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(doc.conteudo);
  } catch (err) {
    if (!err.status || err.status >= 500) console.error('Erro ao baixar documento.', err);
    res.status(err.status || 500).json({ erro: err.message || 'Erro ao baixar documento.' });
  }
});

// ── Financeiro: cobranças, retorno bancário e recebimentos ──────────────────
router.get(p3('/financeiro/cobrancas'), exigirRecebimentos, responder((req) => listarCobrancas(req.query), 'Erro ao listar cobranças.'));
router.get(p3('/financeiro/recebimentos'), exigirRecebimentos, responder((req) => listarRecebimentos(req.query), 'Erro ao listar recebimentos.'));
router.get(p3('/financeiro/retornos/modelo-csv'), exigirRecebimentos, (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo-retorno-recebimentos.csv"');
  res.send(`﻿${modeloCsvRetorno()}`);
});
router.get(p3('/financeiro/retornos'), exigirRecebimentos, responder(() => listarRetornos(), 'Erro ao listar retornos.'));
router.post(p3('/financeiro/retornos'), exigirRecebimentos, responder((req) => importarRetorno(req.body ?? {}, u(req)), 'Erro ao importar retorno.', 201));
router.get(p3('/financeiro/retornos/:id'), exigirRecebimentos, responder((req) => obterRetorno(req.params.id), 'Erro ao carregar retorno.'));
router.post(p3('/financeiro/retornos/:id/processar'), exigirRecebimentos, responder((req) => processarRetorno(req.params.id, u(req)), 'Erro ao processar retorno.'));
router.post(p3('/financeiro/retornos/:id/descartar'), exigirRecebimentos, responder((req) => descartarRetorno(req.params.id, req.body ?? {}, u(req)), 'Erro ao descartar retorno.'));
router.get(p3('/financeiro/auditoria'), exigirRecebimentos, responder((req) => listarAuditoriaFinanceira(req.query), 'Erro ao consultar auditoria.'));

router.post(p3('/financeiro/cobrancas/:id/baixa-manual'), exigirRecebimentos, exigirBaixaManual, responder((req) => registrarBaixaManual(req.params.id, req.body ?? {}, u(req)), 'Erro ao registrar baixa manual.', 201));
router.post(p3('/financeiro/recebimentos/:id/vincular'), exigirRecebimentos, exigirBaixaManual, responder((req) => vincularRecebimento(req.params.id, req.body ?? {}, u(req)), 'Erro ao vincular recebimento.'));
router.post(p3('/financeiro/recebimentos/:id/estornar'), exigirRecebimentos, exigirBaixaManual, responder((req) => estornarRecebimento(req.params.id, req.body ?? {}, u(req)), 'Erro ao estornar recebimento.'));

// ── Lançamentos de cooperados: remuneração, descontos, adiantamentos, compensações ─
router.get(p3('/financeiro/cooperados'), exigirLancamentos, responder((req) => listarCooperadosParaLancamento(req.query.busca), 'Erro ao buscar cooperados.'));
router.get(p3('/financeiro/cooperados/:id/extrato'), exigirLancamentos, responder((req) => extratoCooperado(req.params.id), 'Erro ao carregar extrato.'));
router.get(p3('/financeiro/lancamentos/previa'), exigirLancamentos, responder((req) => previaLancamentos(req.query.competencia), 'Erro ao montar a prévia.'));
router.post(p3('/financeiro/lancamentos/gerar'), exigirLancamentos, responder((req) => confirmarLancamentos(req.body?.competencia, req.body ?? {}, u(req)), 'Erro ao gerar lançamentos.', 201));
router.get(p3('/financeiro/lancamentos'), exigirLancamentos, responder((req) => listarLancamentos(req.query), 'Erro ao listar lançamentos.'));
router.post(p3('/financeiro/lancamentos'), exigirLancamentos, responder((req) => criarLancamentoManual(req.body ?? {}, u(req)), 'Erro ao registrar lançamento.', 201));
router.post(p3('/financeiro/lancamentos/:id/cancelar'), exigirLancamentos, responder((req) => cancelarLancamento(req.params.id, req.body ?? {}, u(req)), 'Erro ao cancelar lançamento.'));
router.post(p3('/financeiro/lancamentos/:id/estornar'), exigirLancamentos, responder((req) => estornarLancamento(req.params.id, req.body ?? {}, u(req)), 'Erro ao estornar lançamento.', 201));
router.post(p3('/financeiro/lancamentos/:id/adiar'), exigirLancamentos, responder((req) => adiarCompensacao(req.params.id, req.body ?? {}, u(req)), 'Erro ao adiar compensação.'));
router.post(p3('/financeiro/adiantamentos'), exigirLancamentos, responder((req) => registrarAdiantamento(req.body ?? {}, u(req)), 'Erro ao registrar adiantamento.', 201));
router.get(p3('/financeiro/bloqueios'), exigirLancamentos, responder((req) => listarBloqueios(req.query), 'Erro ao listar bloqueios.'));
router.post(p3('/financeiro/bloqueios'), exigirLancamentos, responder((req) => bloquearPagamentos(req.body ?? {}, u(req)), 'Erro ao bloquear pagamentos.', 201));
router.post(p3('/financeiro/bloqueios/:id/encerrar'), exigirLancamentos, responder((req) => encerrarBloqueio(req.params.id, req.body ?? {}, u(req)), 'Erro ao encerrar bloqueio.'));

// ── Fila de pagamentos e lotes ──────────────────────────────────────────────
router.post(p3('/financeiro/pagamentos/montar'), exigirPagamentos, responder((req) => montarFila(req.body?.competencia, u(req)), 'Erro ao montar a fila.'));
router.post(p3('/financeiro/pagamentos/atualizar-pendencias'), exigirPagamentos, responder((req) => atualizarPendenciasFila(req.body?.competencia, u(req)), 'Erro ao atualizar pendências.'));
router.get(p3('/financeiro/pagamentos'), exigirPagamentos, responder((req) => listarFila(req.query), 'Erro ao listar pagamentos.'));
router.get(p3('/financeiro/pagamentos/:id'), exigirPagamentos, responder((req) => obterPagamento(req.params.id), 'Erro ao carregar pagamento.'));
router.post(p3('/financeiro/pagamentos/:id/liberar'), exigirPagamentos, responder((req) => liberarPagamento(req.params.id, req.body ?? {}, u(req), {
  podeExcecao: podeAcessarItemFinanceiro(req, 'financeiro.excecao_pagamento'),
}), 'Erro ao liberar pagamento.'));
router.post(p3('/financeiro/pagamentos/:id/desfazer-liberacao'), exigirPagamentos, responder((req) => desfazerLiberacao(req.params.id, req.body ?? {}, u(req)), 'Erro ao desfazer liberação.'));
router.post(p3('/financeiro/pagamentos/:id/cancelar'), exigirPagamentos, responder((req) => cancelarPagamento(req.params.id, req.body ?? {}, u(req)), 'Erro ao cancelar pagamento.'));
router.post(p3('/financeiro/pagamentos/:id/confirmar'), exigirPagamentos, responder((req) => confirmarPagamento(req.params.id, req.body ?? {}, u(req)), 'Erro ao confirmar pagamento.'));
router.get(p3('/financeiro/lotes'), exigirPagamentos, responder(() => listarLotes(), 'Erro ao listar lotes.'));
router.post(p3('/financeiro/lotes'), exigirPagamentos, responder((req) => criarLote(req.body ?? {}, u(req)), 'Erro ao gerar lote.', 201));
router.get(p3('/financeiro/lotes/:id'), exigirPagamentos, responder((req) => obterLote(req.params.id), 'Erro ao carregar lote.'));
router.post(p3('/financeiro/lotes/:id/enviado'), exigirPagamentos, responder((req) => marcarLoteEnviado(req.params.id, u(req)), 'Erro ao registrar envio.'));
router.post(p3('/financeiro/lotes/:id/cancelar'), exigirPagamentos, responder((req) => cancelarLote(req.params.id, req.body ?? {}, u(req)), 'Erro ao cancelar lote.'));
router.post(p3('/financeiro/lotes/itens/:itemId/ocorrencia'), exigirPagamentos, responder((req) => registrarOcorrenciaItem(req.params.itemId, req.body ?? {}, u(req)), 'Erro ao registrar ocorrência.'));

// ── Contas a pagar ──────────────────────────────────────────────────────────
router.get(p3('/financeiro/fornecedores'), exigirContasPagar, responder((req) => listarFornecedores(req.query), 'Erro ao listar fornecedores.'));
router.post(p3('/financeiro/fornecedores'), exigirContasPagar, responder((req) => salvarFornecedor(null, req.body ?? {}, u(req)), 'Erro ao cadastrar fornecedor.', 201));
router.put(p3('/financeiro/fornecedores/:id'), exigirContasPagar, responder((req) => salvarFornecedor(req.params.id, req.body ?? {}, u(req)), 'Erro ao alterar fornecedor.'));
router.get(p3('/financeiro/categorias-contas'), exigirContasPagar, responder((req) => listarCategorias(req.query), 'Erro ao listar categorias.'));
router.post(p3('/financeiro/categorias-contas'), exigirContasPagar, responder((req) => salvarCategoria(null, req.body ?? {}, u(req)), 'Erro ao cadastrar categoria.', 201));
router.put(p3('/financeiro/categorias-contas/:id'), exigirContasPagar, responder((req) => salvarCategoria(req.params.id, req.body ?? {}, u(req)), 'Erro ao alterar categoria.'));
router.get(p3('/financeiro/contas-pagar'), exigirContasPagar, responder((req) => listarContas(req.query), 'Erro ao listar contas a pagar.'));
router.post(p3('/financeiro/contas-pagar'), exigirContasPagar, responder((req) => criarConta(req.body ?? {}, u(req)), 'Erro ao cadastrar conta.', 201));
router.get(p3('/financeiro/contas-pagar/:id'), exigirContasPagar, responder((req) => obterConta(req.params.id), 'Erro ao carregar conta.'));
router.put(p3('/financeiro/contas-pagar/:id'), exigirContasPagar, responder((req) => atualizarConta(req.params.id, req.body ?? {}, u(req)), 'Erro ao alterar conta.'));
router.post(p3('/financeiro/contas-pagar/:id/aprovar'), exigirContasPagar, exigirAprovarContas, responder((req) => aprovarConta(req.params.id, u(req)), 'Erro ao aprovar conta.'));
router.post(p3('/financeiro/contas-pagar/:id/rejeitar'), exigirContasPagar, exigirAprovarContas, responder((req) => rejeitarConta(req.params.id, req.body ?? {}, u(req)), 'Erro ao rejeitar conta.'));
router.post(p3('/financeiro/contas-pagar/:id/programar'), exigirContasPagar, responder((req) => programarConta(req.params.id, req.body ?? {}, u(req)), 'Erro ao programar pagamento.'));
router.post(p3('/financeiro/contas-pagar/:id/baixar'), exigirContasPagar, responder((req) => baixarConta(req.params.id, req.body ?? {}, u(req)), 'Erro ao dar baixa.'));
router.post(p3('/financeiro/contas-pagar/:id/estornar-baixa'), exigirContasPagar, exigirAprovarContas, responder((req) => estornarBaixaConta(req.params.id, req.body ?? {}, u(req)), 'Erro ao estornar baixa.'));
router.post(p3('/financeiro/contas-pagar/:id/cancelar'), exigirContasPagar, responder((req) => cancelarConta(req.params.id, req.body ?? {}, u(req)), 'Erro ao cancelar conta.'));
router.post(p3('/financeiro/contas-pagar/:id/anexos'), exigirContasPagar, responder((req) => anexarDocumentoConta(req.params.id, req.body ?? {}, u(req)), 'Erro ao anexar documento.', 201));

// ── Relatórios (somente leitura; permissão por relatório) ───────────────────
const FAT = [podeAcessarItemMonitoramento, 'monitoramento.faturamento'];
const REC = [podeAcessarItemFinanceiro, 'financeiro.recebimentos'];
const PERMISSAO_RELATORIO = {
  faturamento: [FAT, REC],
  notas: [FAT, REC],
  cobrancas: [FAT, REC],
  inadimplencia: [FAT, REC],
  recebimentos: [REC],
  conciliacao: [REC],
  pagamentos_cooperados: [[podeAcessarItemFinanceiro, 'financeiro.pagamentos']],
  contas_pagar: [[podeAcessarItemFinanceiro, 'financeiro.contas_pagar']],
  consolidacao: [[podeAcessarItemFinanceiro, 'financeiro.consolidacao']],
};
const relatoriosPermitidos = (req) => Object.keys(RELATORIOS).filter((t) => PERMISSAO_RELATORIO[t].some(([fn, item]) => fn(req, item)));
const exigirAlgumRelatorio = (req, res, next) => {
  if (!obterUsuarioAutenticado(req)) return res.status(401).json({ erro: 'Usuário não identificado.' });
  if (!relatoriosPermitidos(req).length) return res.status(403).json({ erro: 'Seu usuário não tem acesso a relatórios financeiros.' });
  next();
};
router.get(p3('/financeiro/relatorios'), exigirAlgumRelatorio, (req, res) => {
  res.json(relatoriosPermitidos(req).map((tipo) => ({ tipo, titulo: RELATORIOS[tipo] })));
});
router.get(p3('/financeiro/relatorios-opcoes'), exigirAlgumRelatorio, responder(async () => {
  const [empresas] = await pool.query(`SELECT id, nome_empresa FROM empresas ORDER BY nome_empresa`);
  const [categorias] = await pool.query(`SELECT id, nome FROM contas_pagar_categorias ORDER BY nome`).catch(() => [[]]);
  return { empresas, categorias };
}, 'Erro ao carregar opções dos relatórios.'));
router.get(p3('/financeiro/relatorios/:tipo'), exigirAlgumRelatorio, (req, res, next) => {
  if (!(req.params.tipo in RELATORIOS)) return res.status(404).json({ erro: 'Relatório inexistente.' });
  if (!relatoriosPermitidos(req).includes(req.params.tipo)) return res.status(403).json({ erro: 'Seu usuário não tem acesso a este relatório.' });
  next();
}, responder((req) => gerarRelatorio(req.params.tipo, req.query), 'Erro ao gerar relatório.'));

export default router;
