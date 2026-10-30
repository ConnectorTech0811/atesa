import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalFormulario, { CampoFormulario } from './ModalFormulario';
import { camposBancarios, mascaraDocumento, validarDocumento } from './camposBancarios';
import FilaPagamentos from './FilaPagamentos';
import ContasPagar from './ContasPagar';
import RelatoriosFinanceiros from './RelatoriosFinanceiros';
import * as api from '../../../api/financeiroApi';

vi.mock('../../../components/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../../api/financeiroApi', async (orig) => {
  const real = await orig<typeof api>();
  return {
    ...real,
    listarFilaPagamentos: vi.fn(), listarLotesPagamento: vi.fn(), liberarPagamentoCooperado: vi.fn(),
    listarContasPagar: vi.fn(), listarFornecedores: vi.fn(), listarCategoriasContas: vi.fn(), criarContaPagar: vi.fn(),
    listarRelatoriosDisponiveis: vi.fn(), obterOpcoesRelatorios: vi.fn(), gerarRelatorio: vi.fn(),
  };
});

const pagamento = {
  id: 1, codigo: 'PAG-202609-000001', candidato_id: 9, cooperado_nome: 'Ana Teste', cpf: '52998224725', matricula: '10', tipo: 'repasse', valor_creditos: '100', valor_debitos: '0', valor_liquido: '100',
  situacao: 'em_preparacao', pendencias: [{ codigo: 'sem_dados_bancarios', excepcionavel: false, descricao: 'Sem dados bancários cadastrados.' }], conta: null, chave_pix: null, solicitacao_em: null,
} as unknown as api.PagamentoCooperado;
const fornecedor = {
  id: 3, nome: 'ACME Ltda', documento: '11222333000181', email: null, telefone: '11999998888', ativo: 1, observacao: 'Limpeza', contas_abertas: 2, valor_aberto: '300.50', proximo_vencimento: '2026-11-10', ultima_competencia: '2026-10',
} as unknown as api.Fornecedor;

describe('ModalFormulario', () => {
  const opcoes = [{ valor: 1, rotulo: 'Fornecedor A' }, { valor: 2, rotulo: 'Fornecedor B' }];
  const campos: CampoFormulario[] = [{ nome: 'fornecedorId', rotulo: 'Fornecedor', tipo: 'select', obrigatorio: true, opcoes }];

  it('não mostra fornecedor como escolhido antes da seleção e envia o escolhido', async () => {
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    render(<ModalFormulario titulo="t" campos={campos} onConfirmar={onConfirmar} onClose={() => {}} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
    await userEvent.selectOptions(select, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith({ fornecedorId: '2' }));
  });

  it('aplica máscara, limita dígitos e recusa CNPJ inválido', async () => {
    const onConfirmar = vi.fn();
    const c: CampoFormulario[] = [{ nome: 'documento', rotulo: 'CPF/CNPJ', formatar: mascaraDocumento, validar: validarDocumento }];
    render(<ModalFormulario titulo="t" campos={c} onConfirmar={onConfirmar} onClose={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await userEvent.type(input, 'abc11222333000199999');
    expect(input.value).toBe('11.222.333/0001-99');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('CNPJ inválido: confira os dígitos.')).toBeTruthy();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('exige conta completa e chave PIX coerente com o tipo', async () => {
    const onConfirmar = vi.fn();
    render(<ModalFormulario titulo="t" campos={camposBancarios({ tiposPix: ['cpf', 'email'] })} valoresIniciais={{ tipoPix: 'cpf' }} onConfirmar={onConfirmar} onClose={() => {}} />);
    const [banco, , , , chave] = screen.getAllByRole('textbox') as HTMLInputElement[];
    await userEvent.type(banco, 'x3412');
    expect(banco.value).toBe('341');
    await userEvent.type(chave, '111.111.111-11');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('CPF inválido.')).toBeTruthy();
    expect(screen.getAllByText('Obrigatório para cadastrar a conta.').length).toBe(3);
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});

describe('telas do Financeiro', () => {
  beforeEach(() => {
    vi.mocked(api.listarFilaPagamentos).mockResolvedValue([pagamento]);
    vi.mocked(api.listarLotesPagamento).mockResolvedValue([]);
    vi.mocked(api.listarContasPagar).mockResolvedValue([]);
    vi.mocked(api.listarFornecedores).mockResolvedValue([fornecedor]);
    vi.mocked(api.listarCategoriasContas).mockResolvedValue([]);
  });

  it('liberar sem dados bancários abre o guia com correção e solicitação ao setor', async () => {
    vi.mocked(api.liberarPagamentoCooperado).mockRejectedValue(Object.assign(new Error('x'), { codigo: 'PENDENCIAS_BLOQUEANTES', pendencias: pagamento.pendencias }));
    render(<FilaPagamentos podeExcecao={false} abasVisiveis={[]} onIrPara={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Liberar' }));
    expect(await screen.findByRole('button', { name: 'Corrigir dados bancários' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solicitar ao setor responsável' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Liberar por exceção' })).toBeNull();
  });

  it('fornecedor aparece nas colunas da lista', async () => {
    render(<ContasPagar podeAprovar={false} />);
    await userEvent.click(await screen.findByRole('button', { name: /^Fornecedores/ }));
    expect(screen.getByText('FOR-000003')).toBeTruthy();
    expect(screen.getByText('ACME Ltda')).toBeTruthy();
    expect(screen.getByText('11.222.333/0001-81')).toBeTruthy();
    expect(screen.getByText('2026-10')).toBeTruthy();
    expect(screen.getByText('2 conta(s) em aberto')).toBeTruthy();
    for (const col of ['Código', 'Descrição / categoria', 'Documento', 'Competência', 'Vencimento', 'Valor', 'Situação']) expect(screen.getByRole('columnheader', { name: col })).toBeTruthy();
  });

  it('nova conta sem categoria leva ao cadastro em vez de ficar desabilitada', async () => {
    render(<ContasPagar podeAprovar={false} />);
    const botao = await screen.findByRole('button', { name: '+ Nova conta' }) as HTMLButtonElement;
    await waitFor(() => expect(screen.getByRole('button', { name: /^Fornecedores \(1\)/ })).toBeTruthy());
    expect(botao.disabled).toBe(false);
    await userEvent.click(botao);
    expect(await screen.findByRole('button', { name: '+ Categoria' })).toBeTruthy();
  });
});

describe('Relatórios Financeiros', () => {
  const relatorio = (linhas: Record<string, unknown>[]) => ({
    tipo: 'recebimentos', titulo: 'Recebimentos', gerado_em: '2026-10-30T12:00:00Z', filtros: {}, resumo: [], divergencias: [], avisos: [],
    secoes: [{ titulo: 'Recebimentos', colunas: [{ chave: 'id', titulo: '#', tipo: 'numero' }], linhas }],
  }) as unknown as api.Relatorio;

  beforeEach(() => {
    vi.mocked(api.gerarRelatorio).mockReset();
    vi.mocked(api.listarRelatoriosDisponiveis).mockResolvedValue([{ tipo: 'recebimentos', titulo: 'Recebimentos' }]);
    vi.mocked(api.obterOpcoesRelatorios).mockResolvedValue({ empresas: [], categorias: [] });
  });

  it('refiltra ao trocar situação e origem e avisa quando não há registros', async () => {
    vi.mocked(api.gerarRelatorio).mockResolvedValueOnce(relatorio([{ id: 1 }])).mockResolvedValue(relatorio([]));
    render(<RelatoriosFinanceiros />);
    const [, situacao, origem] = await screen.findAllByRole('combobox');
    await waitFor(() => expect(api.gerarRelatorio).toHaveBeenCalledTimes(1));
    await screen.findByText('Recebimentos (1)');

    await userEvent.selectOptions(situacao, 'estornado');
    await userEvent.selectOptions(origem, 'manual');
    await waitFor(() => expect(api.gerarRelatorio).toHaveBeenLastCalledWith('recebimentos', expect.objectContaining({ situacao: 'estornado', origem: 'manual' })));
    expect(await screen.findByText('Nenhum registro encontrado para os filtros selecionados.')).toBeTruthy();
    expect(screen.getByText(/Situação: Estornado · Origem: Baixa manual/)).toBeTruthy();
    expect(screen.queryByText('Recebimentos (1)')).toBeNull();
  });

  it('mostra o erro do servidor e não mantém o resultado anterior', async () => {
    vi.mocked(api.gerarRelatorio).mockResolvedValueOnce(relatorio([{ id: 1 }])).mockRejectedValue(new Error('A data inicial é posterior à final.'));
    render(<RelatoriosFinanceiros />);
    const [, situacao] = await screen.findAllByRole('combobox');
    await screen.findByText('Recebimentos (1)');
    await userEvent.selectOptions(situacao, 'ativo');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Recebimentos (1)')).toBeNull();
  });
});
