#!/usr/bin/env bash
# Sobe o backend do E2E em ambiente ISOLADO e fica em primeiro plano (o `webServer`
# do Playwright o inicia e o encerra). A cada subida o ambiente de teste é recriado do zero:
#
#   backend  -> porta 8090                 (desenvolvimento: 8080)
#   Postgres -> banco  shottrack_test      (desenvolvimento: shottrack)
#   RabbitMQ -> vhost  shottrack_test      (desenvolvimento: /)
#   Mailpit  -> próprio, SMTP 1026 / web 8026 (desenvolvimento: 1025 / 8025)
#
# Só mexe nesses recursos de teste; o banco e o vhost de desenvolvimento não são tocados.
# Pré-requisito: `docker compose up -d` no shottrack-backend (Postgres e RabbitMQ no ar).
set -euo pipefail

BACKEND_DIR="${SHOTTRACK_BACKEND_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/shottrack-backend}"
PORT=8090
DB=shottrack_test
VHOST=shottrack_test
MAILPIT=shottrack-e2e-mailpit

[ -x "$BACKEND_DIR/mvnw" ] || { echo "Backend não encontrado em $BACKEND_DIR (use SHOTTRACK_BACKEND_DIR)" >&2; exit 1; }

PG=$(docker ps --filter "publish=5432" --format "{{.ID}}" | head -n1)
RMQ=$(docker ps --filter "publish=5672" --format "{{.ID}}" | head -n1)
[ -n "$PG" ] && [ -n "$RMQ" ] || { echo "Postgres/RabbitMQ não estão no ar: rode 'docker compose up -d' no shottrack-backend" >&2; exit 1; }

echo "[e2e] recriando o banco $DB"
docker exec "$PG" psql -U shottrack -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB" >/dev/null

echo "[e2e] recriando o vhost $VHOST no RabbitMQ"
docker exec "$RMQ" rabbitmqctl delete_vhost "$VHOST" >/dev/null 2>&1 || true
docker exec "$RMQ" rabbitmqctl add_vhost "$VHOST" >/dev/null
docker exec "$RMQ" rabbitmqctl set_permissions -p "$VHOST" shottrack ".*" ".*" ".*" >/dev/null

echo "[e2e] Mailpit de teste (SMTP 1026, web 8026)"
docker rm -f "$MAILPIT" >/dev/null 2>&1 || true
docker run -d --name "$MAILPIT" -p 1026:1025 -p 8026:8025 axllent/mailpit >/dev/null

# JWT de uso exclusivo dos testes (não reaproveita o do desenvolvimento)
export JWT_SECRET="$(openssl rand -base64 32)"
export SENTRY_DSN=""
export SERVER_PORT="$PORT"
export SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/$DB"
export SPRING_RABBITMQ_VIRTUAL_HOST="$VHOST"
export SPRING_MAIL_PORT=1026
# Limites por IP altos (a suíte cria milhares de contas do mesmo IP); os limites por e-mail/usuário
# seguem os reais, que é o que os testes de 429 exercitam.
export SPRING_APPLICATION_JSON='{"app":{"rate-limit":{"registration":{"per-ip":1000000},"password-reset-request":{"per-ip":1000000}}}}'

echo "[e2e] backend de teste na porta $PORT (banco $DB)"
cd "$BACKEND_DIR"
exec ./mvnw -q spring-boot:run
