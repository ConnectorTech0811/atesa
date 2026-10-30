import { formatarCNPJ, formatarCPF, formatarTelefone, validarCNPJ, validarCPF } from '../../../utils/formatters';
import type { CampoFormulario, ValoresFormulario } from './ModalFormulario';

const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
export const soDigitos = (max: number) => (v: string) => digitos(v).slice(0, max);

export const mascaraDocumento = (v: string) => {
  const d = digitos(v).slice(0, 14);
  if (!d) return '';
  return d.length <= 11 ? formatarCPF(d) : formatarCNPJ(d);
};
export const mascaraTelefone = (v: string) => {
  const d = digitos(v).replace(/^55(?=\d{10})/, '').slice(0, 11);
  return d ? formatarTelefone(d) : '';
};

export const validarDocumento = (v: unknown) => {
  const d = digitos(v);
  if (!d) return null;
  if (d.length === 11) return validarCPF(d) ? null : 'CPF inválido: confira os dígitos.';
  if (d.length === 14) return validarCNPJ(d) ? null : 'CNPJ inválido: confira os dígitos.';
  return 'Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).';
};
export const validarTelefone = (v: unknown) => {
  const d = digitos(v);
  return !d || /^[1-9]{2}\d{8,9}$/.test(d) ? null : 'Telefone inválido: informe DDD + número.';
};
export const validarEmail = (v: unknown) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) ? null : 'E-mail inválido.');

const preenchido = (v: unknown) => String(v ?? '').trim() !== '';
const contaIniciada = (x: ValoresFormulario) => ['codigoBanco', 'agencia', 'conta', 'digito'].some((c) => preenchido(x[c]));
const exigeConta = (validar: (v: string) => string | null) => (v: unknown, x: ValoresFormulario) => {
  if (!preenchido(v)) return contaIniciada(x) ? 'Obrigatório para cadastrar a conta.' : null;
  return validar(String(v));
};

function validarChavePix(v: unknown, x: ValoresFormulario, documentoTitular?: string | null) {
  const k = String(v ?? '').trim();
  if (!k) return preenchido(x.tipoPix) ? 'Informe a chave ou deixe o tipo em branco.' : null;
  switch (x.tipoPix) {
    case 'cpf':
      if (!validarCPF(k)) return 'CPF inválido.';
      return documentoTitular && digitos(k) !== digitos(documentoTitular) ? 'A chave CPF deve ser o CPF do próprio cooperado.' : null;
    case 'cnpj': return validarCNPJ(k) && digitos(k).length === 14 ? null : 'CNPJ inválido.';
    case 'email': return validarEmail(k) || (k.length > 77 ? 'E-mail longo demais para chave PIX.' : null);
    case 'telefone': return validarTelefone(k);
    case 'aleatoria': return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k) ? null : 'Chave aleatória inválida (formato 00000000-0000-0000-0000-000000000000).';
    default: return 'Selecione o tipo da chave.';
  }
}

function formatarChavePix(v: string, x: ValoresFormulario) {
  switch (x.tipoPix) {
    case 'cpf': { const d = digitos(v).slice(0, 11); return d ? formatarCPF(d) : ''; }
    case 'cnpj': { const d = digitos(v).slice(0, 14); return d ? formatarCNPJ(d) : ''; }
    case 'telefone': return mascaraTelefone(v);
    case 'aleatoria': return v.replace(/[^0-9a-fA-F-]/g, '').slice(0, 36);
    default: return v.trim().slice(0, 77);
  }
}

/** Campos de conta e PIX usados por fornecedores e cooperados, com máscara e validação iguais às do servidor. */
export function camposBancarios({ tiposPix, documentoTitular }: { tiposPix: string[]; documentoTitular?: string | null }): CampoFormulario[] {
  const ROTULOS_PIX: Record<string, string> = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Telefone', aleatoria: 'Chave aleatória' };
  return [
    { nome: 'codigoBanco', rotulo: 'Banco (código)', largura: 'metade', numerico: true, placeholder: 'Ex: 341', formatar: soDigitos(3), validar: exigeConta((v) => (v.length === 3 ? null : 'O código do banco tem 3 dígitos.')) },
    { nome: 'agencia', rotulo: 'Agência', largura: 'metade', numerico: true, placeholder: 'Sem dígito', formatar: soDigitos(5), validar: exigeConta(() => null) },
    { nome: 'conta', rotulo: 'Conta', largura: 'metade', numerico: true, placeholder: 'Sem dígito', formatar: soDigitos(12), validar: exigeConta(() => null) },
    { nome: 'digito', rotulo: 'Dígito', largura: 'metade', formatar: (v) => v.replace(/[^0-9xX]/g, '').toUpperCase().slice(0, 2), validar: exigeConta(() => null) },
    {
      nome: 'tipoConta', rotulo: 'Tipo de conta', tipo: 'select', largura: 'metade', opcoes: [{ valor: 'corrente', rotulo: 'Corrente' }, { valor: 'poupanca', rotulo: 'Poupança' }],
      validar: (v, x) => (contaIniciada(x) && !preenchido(v) ? 'Selecione o tipo de conta.' : null),
    },
    {
      nome: 'tipoPix', rotulo: 'Tipo da chave PIX', tipo: 'select', largura: 'metade', opcoes: tiposPix.map((t) => ({ valor: t, rotulo: ROTULOS_PIX[t] })),
      validar: (v, x) => (preenchido(x.chavePix) && !preenchido(v) ? 'Selecione o tipo da chave.' : null),
    },
    { nome: 'chavePix', rotulo: 'Chave PIX', placeholder: 'Selecione o tipo acima', formatar: formatarChavePix, validar: (v, x) => validarChavePix(v, x, documentoTitular) },
  ];
}
