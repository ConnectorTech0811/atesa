const API_URL = import.meta.env.VITE_API_URL;
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

export async function apiGet<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, { headers: obterCabecalhos(false) });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error((dados as ErroApi).erro ?? 'Erro na requisição.');
  }
  return dados as T;
}

export async function apiPost<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'POST',
    headers: obterCabecalhos(true),
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error((dados as ErroApi).erro ?? 'Erro na requisição.');
  }
  return dados as T;
}

export async function apiPut<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'PUT',
    headers: obterCabecalhos(true),
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error((dados as ErroApi).erro ?? 'Erro na requisição.');
  }
  return dados as T;
}

export async function apiDelete<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'DELETE',
    headers: obterCabecalhos(false),
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error((dados as ErroApi).erro ?? 'Erro na requisição.');
  }
  return dados as T;
}

export async function apiPatch<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'PATCH',
    headers: obterCabecalhos(true),
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error((dados as ErroApi).erro ?? 'Erro na requisição.');
  }
  return dados as T;
}
