-- Usuários de teste (senha para ambos: 12345678).
-- regiao_id=1 corresponde a "São Paulo" no regioes-service.
INSERT INTO usuarios (nome, email, cpf, telefone, senha_hash, tipo_usuario, eh_executivo, regiao_id) VALUES
  ('Administrador ATESA', 'admin@atesa.com.br', '11144477735', '(11) 90000-0001',
   '$2a$10$65DnJmMDNQedMZs.gxi/vesgvG5d2vGvFt2n0RaXmtbjvY6O8zslG', 'administrador', FALSE, 1),
  ('Consultor ATESA', 'consultor@atesa.com.br', '52998224725', '(11) 90000-0002',
   '$2a$10$65DnJmMDNQedMZs.gxi/vesgvG5d2vGvFt2n0RaXmtbjvY6O8zslG', 'consultor', TRUE, 1)
ON DUPLICATE KEY UPDATE nome = nome;
