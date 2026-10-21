#!/usr/bin/env bash
# ลูกหนัง อารีน่า · เริ่มทั้งระบบด้วยคำสั่งเดียว (Linux / macOS / Git Bash)  ใช้: ./start.sh
# เช็ก Docker -> docker compose up -d --build -> รอ healthy -> พิมพ์ URL + ที่อยู่บัญชีทดลอง
# ตัวแปรที่ใช้ได้: FB_NAME WEB_PORT DB_PORT FB_PGDATA FB_NETWORK COMPOSE_PROJECT_NAME START_TIMEOUT (วินาที ค่าเริ่ม 420)
# Starts db + migrations + web with one command. Needs only Docker Desktop. Never runs `down -v`.
set -u
cd "$(dirname "$0")"

NAME="${FB_NAME:-football}"
PROJECT="${COMPOSE_PROJECT_NAME:-football}"
PORT="${WEB_PORT:-3000}"
TIMEOUT="${START_TIMEOUT:-420}"
WEB="${NAME}-web"
DB="${NAME}-db"

if ! command -v docker >/dev/null 2>&1; then
  echo "ไม่พบคำสั่ง docker · ติดตั้ง Docker Desktop ก่อน (https://www.docker.com/products/docker-desktop/)"
  echo "docker not found - install Docker Desktop first."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker ยังไม่ทำงาน · เปิด Docker Desktop รอจนไอคอนขึ้นว่า running แล้วรันใหม่"
  echo "Docker is not running - start Docker Desktop, wait until it is running, then run this again."
  exit 1
fi

# ระบบเดิมที่เปิดแยกด้วย db/compose.yaml + web/compose.yaml (คนละโปรเจกต์ compose) ใช้ชื่อ container เดียวกัน -> ชนกัน
for c in "$DB" "$WEB"; do
  owner="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$c" 2>/dev/null || true)"
  if [ -n "$owner" ] && [ "$owner" != "$PROJECT" ]; then
    echo "พบ container '$c' ที่เปิดไว้โดยโปรเจกต์ '$owner' (ไม่ใช่ '$PROJECT') -> compose ที่รากสร้างชื่อเดียวกันซ้ำไม่ได้"
    echo "ถ้าระบบนั้นใช้งานอยู่ ไม่ต้องรันสคริปต์นี้ (เปิดอยู่แล้ว: http://localhost:${PORT}) · ถ้าจะย้ายมาใช้คำสั่งเดียว (ข้อมูลใน volume อยู่ต่อ):"
    echo "    docker compose -f web/compose.yaml down"
    echo "    docker compose -f db/compose.yaml down        # ห้ามใส่ -v"
    echo "แล้วรัน ./start.sh ใหม่   |   Found '$c' owned by project '$owner'; stop it first (commands above, never with -v) or keep using it."
    exit 1
  fi
done

echo "== docker compose up -d --build (ครั้งแรกใช้เวลาหลายนาที: ดึง image + build เว็บ) =="
if ! docker compose up -d --build; then
  echo "docker compose up ล้มเหลว · ดู log: docker compose logs --tail 50 migrate db web"
  echo "docker compose up failed - see the logs above (migration / db / web)."
  exit 1
fi

echo "== รอ $WEB healthy (สูงสุด ${TIMEOUT} วินาที) =="
start=$(date +%s)
while true; do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$WEB" 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then break; fi
  now=$(date +%s)
  if [ $((now - start)) -ge "$TIMEOUT" ]; then
    echo "หมดเวลา ${TIMEOUT} วินาที: $WEB สถานะ '$status' (ยังไม่ healthy)"
    echo "Timed out after ${TIMEOUT}s waiting for $WEB (status: $status). Last logs:"
    docker compose logs --tail 30 migrate db web
    exit 1
  fi
  printf '.'
  sleep 3
done
echo

echo "พร้อมใช้งานแล้ว / Ready"
echo "  เว็บ / Web      : http://localhost:${PORT}"
echo "  ตรวจเวอร์ชัน    : http://localhost:${PORT}/api/version"
echo "  บัญชีทดลอง      : web/SPEC.md (ข้อมูลทดลองในเครื่องเท่านั้น) · คู่มือ docs/RUNBOOK.md"
echo "  ปิด             : docker compose stop   (ห้ามใช้ down -v = ลบข้อมูล)"
echo "  ตรวจเร็ว        : docker compose --profile test run --rm smoke"
