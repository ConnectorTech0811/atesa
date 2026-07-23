#!/bin/sh
# Aplica a migration de grupos/permissões no banco já existente.
# Execute com: bash scripts/aplicar-permissoes.sh
docker exec -i atesa-database mysql -u atesa -patesa usuarios_db < database-init/02-permissoes.sql
echo "Migration aplicada com sucesso."
