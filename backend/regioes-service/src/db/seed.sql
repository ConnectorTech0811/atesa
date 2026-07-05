INSERT INTO regioes (nome) VALUES
  ('São Paulo'),
  ('São José do Ribamar'),
  ('São Luís do Maranhão'),
  ('Recife'),
  ('Fortaleza')
ON DUPLICATE KEY UPDATE nome = nome;
