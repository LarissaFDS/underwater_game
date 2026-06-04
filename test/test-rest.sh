#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# test-rest.sh — Testa todos os endpoints REST do auth-service com curl
#
# Pré-requisito: auth-service rodando em localhost:3004
# Uso:
#   chmod +x test-rest.sh
#   ./test-rest.sh
# ─────────────────────────────────────────────────────────────────────────────

AUTH="http://localhost:3004"
PASS=0
FAIL=0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "  ${GREEN}✓ PASS${NC}  $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✗ FAIL${NC}  $1"; ((FAIL++)); }
info() { echo -e "\n${YELLOW}» $1${NC}"; }

# ─── helper: faz request e compara HTTP status ───────────────────────────────
check() {
  local DESC="$1" EXPECTED="$2" METHOD="$3" URL="$4"
  shift 4
  local BODY
  local HTTP
  HTTP=$(curl -s -o /tmp/_body.json -w "%{http_code}" -X "$METHOD" "$URL" "$@")
  BODY=$(cat /tmp/_body.json)
  echo "     $BODY"
  if [ "$HTTP" = "$EXPECTED" ]; then
    pass "$DESC → HTTP $HTTP"
  else
    fail "$DESC → esperado $EXPECTED, recebeu $HTTP"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════"
echo "  auth-service — Testes REST  ($AUTH)"
echo "════════════════════════════════════════════"

# 1. Health
info "1. Health check"
check "GET /health" "200" GET "$AUTH/health"

# 2. Root
info "2. Root"
check "GET /" "200" GET "$AUTH/"

# 3. Login válido e captura de token
info "3. POST /api/login — apelido válido"
HTTP=$(curl -s -o /tmp/_body.json -w "%{http_code}" \
  -X POST "$AUTH/api/login" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Capitao_Nemo"}')
BODY=$(cat /tmp/_body.json)
TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "     $BODY"
[ "$HTTP" = "200" ] && pass "Login retornou 200" || fail "Login retornou $HTTP"
[ -n "$TOKEN" ] && pass "Token extraído: ${TOKEN:0:8}..." || fail "Token não encontrado"

# 4. Validar token válido
info "4. GET /api/validate/:token — token válido"
check "Validação com token real" "200" GET "$AUTH/api/validate/$TOKEN"

# 5. Token inválido
info "5. GET /api/validate/:token — token falso"
check "Token inexistente" "401" GET "$AUTH/api/validate/nao-existe-mesmo"

# 6. Apelido mínimo (2 chars)
info "6. POST /api/login — apelido com 2 chars (mínimo válido)"
check "Nickname 'AB'" "200" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":"AB"}'

# 7. Apelido máximo (16 chars)
info "7. POST /api/login — apelido com 16 chars (máximo válido)"
check "Nickname 'Abcdefgh12345678'" "200" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":"Abcdefgh12345678"}'

# 8. Underscore no nome
info "8. POST /api/login — underscore é permitido"
check "Nickname 'sub_nautica_99'" "200" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":"sub_nautica_99"}'

# 9. Apelido curto demais (1 char)
info "9. POST /api/login — 1 char (deve dar 400)"
check "Nickname 'X' (muito curto)" "400" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":"X"}'

# 10. Apelido longo demais (17 chars)
info "10. POST /api/login — 17 chars (deve dar 400)"
check "Nickname com 17 chars" "400" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":"Abcdefgh123456789"}'

# 11. Caractere especial
info "11. POST /api/login — ! no apelido (deve dar 400)"
check "Nickname 'jogador!'" "400" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":"jogador!"}'

# 12. Espaço no apelido
info "12. POST /api/login — espaço no apelido (deve dar 400)"
check "Nickname 'jo ga dor'" "400" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":"jo ga dor"}'

# 13. Body vazio
info "13. POST /api/login — body vazio (deve dar 400)"
check "Body {}" "400" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{}'

# 14. Nickname nulo
info "14. POST /api/login — nickname null (deve dar 400)"
check "Nickname null" "400" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":null}'

# 15. Nickname numérico (tipo errado)
info "15. POST /api/login — nickname número (deve dar 400)"
check "Nickname 42" "400" POST "$AUTH/api/login" \
  -H "Content-Type: application/json" -d '{"nickname":42}'

# ─── Resumo ──────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════"
printf "  ${GREEN}%d passaram${NC}  /  ${RED}%d falharam${NC}\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo ""
echo "Token para testes manuais:"
echo "  $TOKEN"
echo ""