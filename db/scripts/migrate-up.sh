#!/bin/sh
# ลง migration ขาขึ้นที่ยังไม่มีใน schema_migrations (one-shot ของ compose.yaml ที่ราก · ADR-11)
#  - ไม่แตะ *.down.sql เด็ดขาด · ไฟล์ที่ลงแล้ว (มีแถวใน schema_migrations) ข้าม → ไม่แตะ applied_at ของ 007 ฯลฯ
#  - ไฟล์ migration เขียนให้รันซ้ำได้อยู่แล้ว (IF NOT EXISTS / ON CONFLICT DO NOTHING) · ถ้าลงกลางทางพลาด psql หยุด (ON_ERROR_STOP) → exit ไม่ใช่ 0 → เว็บไม่ขึ้น
set -eu
done_before() {
  psql -qAt -c "SELECT CASE WHEN to_regclass('public.schema_migrations') IS NULL THEN 0 ELSE (SELECT count(*) FROM schema_migrations WHERE version = '$1') END"
}
applied=0
for f in /migrations/[0-9][0-9][0-9]_*.sql; do
  case "$f" in *.down.sql) continue ;; esac
  v=$(basename "$f" | cut -c1-3)
  if [ "$(done_before "$v")" = "1" ]; then
    echo "[migrate] $v ลงแล้ว ข้าม"
    continue
  fi
  echo "[migrate] UP $f"
  psql -q -v ON_ERROR_STOP=1 -f "$f"
  applied=$((applied + 1))
done
echo "[migrate] เสร็จ: ลงใหม่ $applied ไฟล์ · schema ตอนนี้:"
psql -qAt -c "SELECT string_agg(version, ',' ORDER BY version) FROM schema_migrations"
