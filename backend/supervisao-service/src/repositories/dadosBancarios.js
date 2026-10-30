// ── Validação de dados bancários (regras gerais, sem leiaute de banco) ──────
// Valida formato de banco/agência/conta e da chave PIX conforme o tipo. Não verifica
// existência da conta nem titularidade junto ao banco (isso só o retorno do banco confirma).

const digitos = (v) => String(v ?? '').replace(/\D/g, '');

export function cpfValido(v) {
  const c = digitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9)) === Number(c[9]) && dv(c.slice(0, 10)) === Number(c[10]);
}

export function cnpjValido(v) {
  const c = digitos(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13]);
}

/** Problemas da chave PIX (lista vazia = válida). `documentoTitular` sinaliza chave CPF/CNPJ de outra pessoa. */
export function problemasChavePix(chave, tipo, documentoTitular = null) {
  const k = String(chave ?? '').trim();
  if (!k) return ['Chave PIX não informada.'];
  switch (tipo) {
    case 'cpf':
      if (!cpfValido(k)) return ['Chave PIX do tipo CPF inválida.'];
      if (documentoTitular && digitos(k) !== digitos(documentoTitular)) return ['Chave PIX (CPF) diferente do CPF do titular.'];
      return [];
    case 'cnpj':
      if (!cnpjValido(k)) return ['Chave PIX do tipo CNPJ inválida.'];
      if (documentoTitular && digitos(k) !== digitos(documentoTitular)) return ['Chave PIX (CNPJ) diferente do documento do titular.'];
      return [];
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k) && k.length <= 77 ? [] : ['Chave PIX do tipo e-mail inválida.'];
    case 'telefone': {
      const d = digitos(k);
      const nacional = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
      return /^[1-9]{2}9?\d{8}$/.test(nacional) ? [] : ['Chave PIX do tipo telefone inválida (DDD + número).'];
    }
    case 'aleatoria':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k) ? [] : ['Chave PIX aleatória inválida.'];
    default:
      return ['Tipo da chave PIX não informado.'];
  }
}

/** Chaves numéricas (CPF, CNPJ, telefone) são gravadas só com dígitos, sem máscara. */
export function normalizarChavePix(chave, tipo) {
  const k = String(chave ?? '').trim();
  return ['cpf', 'cnpj', 'telefone'].includes(tipo) ? digitos(k) : k;
}

export function problemasConta(d) {
  const p = [];
  if (!/^\d{3}$/.test(digitos(d.codigo_banco))) p.push('Código do banco deve ter 3 dígitos.');
  const ag = digitos(d.agencia);
  if (!ag || ag.length > 5) p.push('Agência inválida.');
  const conta = digitos(d.conta);
  if (!conta || conta.length > 12) p.push('Conta inválida.');
  if (!/^[0-9xX]{1,2}$/.test(String(d.digito ?? '').trim())) p.push('Dígito da conta inválido.');
  if (!['corrente', 'poupanca'].includes(d.tipo_conta)) p.push('Tipo de conta não informado.');
  return p;
}

/**
 * Valida os dados para a modalidade: credito_conta / ted exigem conta; pix exige chave.
 * Sem modalidade: aceita se houver conta válida OU chave PIX válida.
 */
export function validarDadosBancarios(d, modalidade = null, documentoTitular = null) {
  if (!d) return { valido: false, problemas: ['Dados bancários não cadastrados.'] };
  const conta = problemasConta(d);
  const pix = problemasChavePix(d.chave_pix, d.tipo_pix, documentoTitular);
  if (modalidade === 'pix') return { valido: pix.length === 0, problemas: pix };
  if (modalidade === 'credito_conta' || modalidade === 'ted') return { valido: conta.length === 0, problemas: conta };
  if (conta.length === 0 || pix.length === 0) return { valido: true, problemas: [] };
  return { valido: false, problemas: [...conta.map((x) => `Conta: ${x}`), ...pix.map((x) => `PIX: ${x}`)] };
}

/** Cópia dos dados bancários no momento da liberação (rastreabilidade). */
export function fotoDadosBancarios(d, titular) {
  if (!d) return null;
  return {
    titular_nome: titular?.nome ?? null,
    titular_documento: titular?.documento ?? null,
    banco: d.banco ?? null,
    codigo_banco: digitos(d.codigo_banco) || null,
    agencia: digitos(d.agencia) || null,
    conta: digitos(d.conta) || null,
    digito: d.digito ? String(d.digito).trim().toUpperCase() : null,
    tipo_conta: d.tipo_conta ?? null,
    chave_pix: d.chave_pix ?? null,
    tipo_pix: d.tipo_pix ?? null,
  };
}
