const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'atesa_token';

interface ErroApi {
  erro?: string;
}

export function salvarToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function limparToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function obterCabecalhos(comJson: boolean): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  const cabecalhos: Record<string, string> = {};
  if (comJson) cabecalhos['Content-Type'] = 'application/json';
  if (token) cabecalhos['Authorization'] = `Bearer ${token}`;
  return cabecalhos;
}

async function extrairResposta<T>(resposta: Response): Promise<T> {
  const contentType = resposta.headers.get('content-type') ?? '';
  let dados: any = null;
  if (contentType.includes('application/json')) {
    try {
      dados = await resposta.json();
    } catch {
      dados = null;
    }
  } else {
    const texto = await resposta.text().catch(() => '');
    if (!resposta.ok) {
      throw new Error(texto && texto.length < 200 ? texto : `Erro no servidor (${resposta.status}). Verifique a conexão com o serviço.`);
    }
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = texto;
    }
  }
  if (!resposta.ok) {
    throw new Error((dados as ErroApi)?.erro ?? dados?.mensagem ?? `Erro na requisição (${resposta.status}).`);
  }
  return dados as T;
}

export async function apiGet<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, { headers: obterCabecalhos(false) });
  return extrairResposta<T>(resposta);
}

export async function apiPost<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'POST',
    headers: obterCabecalhos(true),
    body: JSON.stringify(corpo),
  });
  return extrairResposta<T>(resposta);
}

export async function apiPut<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'PUT',
    headers: obterCabecalhos(true),
    body: JSON.stringify(corpo),
  });
  return extrairResposta<T>(resposta);
}

export async function apiDelete<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'DELETE',
    headers: obterCabecalhos(false),
  });
  return extrairResposta<T>(resposta);
}

export async function apiPatch<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'PATCH',
    headers: obterCabecalhos(true),
    body: JSON.stringify(corpo),
  });
  return extrairResposta<T>(resposta);
}
