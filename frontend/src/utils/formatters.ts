export function formatarCNPJ(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
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

export function formatarDataBR(dataISO: string): string {
  if (!dataISO) return '-';
  const soData = dataISO.substring(0, 10);
  const [ano, mes, dia] = soData.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHoraBrasilia(dataISO: string): string {
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
