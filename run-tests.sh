#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-all}"

case "$MODE" in
  unit)
    echo "🧪 Ejecutando Pruebas Unitarias (Backend + Frontend)..."
    npm --prefix "$ROOT_DIR/server" run test:unit
    npm --prefix "$ROOT_DIR/client" run test
    ;;
  integration)
    echo "🔌 Ejecutando Pruebas de Integración HTTP (Supertest)..."
    npm --prefix "$ROOT_DIR/server" run test:integration
    ;;
  integration:db)
    echo "🐘 Ejecutando Pruebas de Integración contra PostgreSQL Real..."
    DATABASE_URL="${DATABASE_URL_TEST:-postgresql://postgres:postgres@localhost:5433/novapalma?schema=public}" \
      npm --prefix "$ROOT_DIR/server" run test:integration:db
    ;;
  cov)
    echo "📊 Ejecutando Suite Completa con Code Coverage (Quality Gate >= 60%)..."
    npm --prefix "$ROOT_DIR/server" run test:cov
    npm --prefix "$ROOT_DIR/client" run test:cov
    echo ""
    echo "✅ Reportes HTML generados en:"
    echo "   - Backend:  $ROOT_DIR/server/coverage/index.html"
    echo "   - Frontend: $ROOT_DIR/client/coverage/index.html"
    ;;
  e2e)
    echo "🌐 Ejecutando Pruebas E2E (Selenium WebDriver)..."
    node "$ROOT_DIR/tests/test-quality.js"
    ;;
  all)
    echo "🚀 Ejecutando Pirámide Completa (Unitarias + Integración + Coverage)..."
    npm --prefix "$ROOT_DIR/server" run test:cov
    npm --prefix "$ROOT_DIR/client" run test:cov
    ;;
  *)
    echo "Uso: ./run-tests.sh [unit | integration | integration:db | cov | e2e | all]"
    exit 1
    ;;
esac
