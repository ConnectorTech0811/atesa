export function formatarCNPJ(valor: string): string {
  // Suporta o novo CNPJ alfanumérico: mantém letras e dígitos, converte para maiúsculas
  const v = valor.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

export function formatarTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export function formatarCPF(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatarCEP(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function formatarMoeda(valor?: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataHoje(): string {
  return new Date().toISOString().substring(0, 10);
}

export function dataSeisMesesAtras(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().substring(0, 10);
}

/** Formata ISO datetime para exibição BR (dd/mm/aaaa hh:mm). */
export function formatarDataHora(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** Valida CPF (aceita formatado ou só dígitos). Retorna true se válido. */
export function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (mod: number) => {
    let sum = 0;
    for (let i = 0; i < mod - 1; i++) sum += Number(d[i]) * (mod - i);
    const r = (sum * 10) % 11;
    return r >= 10 ? 0 : r;
  };
  return calc(10) === Number(d[9]) && calc(11) === Number(d[10]);
}

/** Valida CNPJ numérico de 14 dígitos (novo CNPJ alfanumérico não validado por dígito). */
export function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (d.length !== 14) return false;
  // Se todos alfanuméricos iguais, inválido
  if (/^(.)\1{13}$/.test(d)) return false;
  // Valida apenas se for todo numérico (CNPJ clássico)
  if (!/^\d{14}$/.test(d)) return true; // alfanumérico: aceita (não há algoritmo público)
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = (ps: number[]) => ps.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
  const dig = (s: number) => { const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dig(soma(pesos1)) === Number(d[12]) && dig(soma(pesos2)) === Number(d[13]);
}

export function formatarDataBR(dataISO: string): string {
  if (!dataISO) return '-';
  const soData = dataISO.substring(0, 10);
  const [ano, mes, dia] = soData.split('-');
  return `${dia}/${mes}/${ano}`;
}


interface EnderecoViaCep {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoViaCep | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await resp.json();
    if (data.erro) return null;
    return {
      rua: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      uf: data.uf ?? '',
    };
  } catch {
    return null;
  }
}
