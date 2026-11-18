import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CarteiraSupervisores from './CarteiraSupervisores';
import * as api from '../../../api/carteiraSupervisoresApi';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ usuario: { id: 7, nome: 'Sup', perfil: 'supervisao' } }) }));
vi.mock('../../../api/carteiraSupervisoresApi', () => ({ obterCarteiraSupervisores: vi.fn() }));
const obter = vi.mocked(api.obterCarteiraSupervisores);

const cliente = { id: 1, nome_empresa: 'Hospital Alfa', cnpj: '11222333000181', cpf: null, status: 'Ativo', cidade: 'São Paulo', uf: 'SP', regiao_nome: 'SP', telefone_empresa: '11999998888', representante: 'Rita', executivo_nome: null, supervisor_id: 7, proxima_visita: '2026-12-01 10:00:00', ultima_visita: null };

describe('Carteira de Supervisores', () => {
  beforeEach(() => obter.mockReset());

  it('mostra o card do supervisor com os clientes', async () => {
    obter.mockResolvedValue({
      supervisores: [{ id: 7, nome: 'Carla Souza', email: 'c@x.com', telefone: null, regiao_id: 1, regiao_nome: 'SP', ativo: true, clientes: [cliente] }],
      semSupervisor: [],
    });
    render(<CarteiraSupervisores />);
    expect(await screen.findByText('Carla Souza', { exact: false })).toBeTruthy();
    expect(screen.getByText('Hospital Alfa')).toBeTruthy();
  });

  it('não fica em branco quando o serviço responde algo inesperado', async () => {
    obter.mockResolvedValue('<!doctype html><html></html>' as unknown as api.CarteiraSupervisores);
    render(<CarteiraSupervisores />);
    expect(await screen.findByText(/não respondeu a Carteira de Supervisores/)).toBeTruthy();
  });

  it('aceita campos nulos vindos do banco', async () => {
    obter.mockResolvedValue({
      supervisores: [{ id: 7, nome: null, email: null, telefone: null, regiao_id: null, regiao_nome: null, ativo: 1, clientes: null }],
      semSupervisor: null,
    } as unknown as api.CarteiraSupervisores);
    render(<CarteiraSupervisores />);
    expect(await screen.findByText(/Sem nome/)).toBeTruthy();
  });
});
