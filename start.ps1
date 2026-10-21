# ลูกหนัง อารีน่า · เริ่มทั้งระบบด้วยคำสั่งเดียว (Windows PowerShell 5.1 ขึ้นไป)   ใช้:  .\start.ps1
# เช็ก Docker -> docker compose up -d --build -> รอ healthy -> พิมพ์ URL + ที่อยู่บัญชีทดลอง
# ตัวแปรที่ใช้ได้ ($env:...): FB_NAME WEB_PORT DB_PORT FB_PGDATA FB_NETWORK COMPOSE_PROJECT_NAME START_TIMEOUT (วินาที ค่าเริ่ม 420)
# Starts db + migrations + web with one command. Needs only Docker Desktop. Never runs `down -v`.
# (ไม่ตั้ง $ErrorActionPreference='Stop': PowerShell 5.1 ตีข้อความ stderr ของ docker เป็น error)
Set-Location -LiteralPath $PSScriptRoot
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }   # ให้ภาษาไทยแสดงถูกบน PowerShell 5.1

function Pick($v, $d) { if ([string]::IsNullOrEmpty($v)) { $d } else { $v } }
$name    = Pick $env:FB_NAME 'football'
$project = Pick $env:COMPOSE_PROJECT_NAME 'football'
$port    = Pick $env:WEB_PORT '3000'
$timeout = [int](Pick $env:START_TIMEOUT '420')
$web = "$name-web"
$db  = "$name-db"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ไม่พบคำสั่ง docker · ติดตั้ง Docker Desktop ก่อน (https://www.docker.com/products/docker-desktop/)"
    Write-Host "docker not found - install Docker Desktop first."
    exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker ยังไม่ทำงาน · เปิด Docker Desktop รอจนขึ้นว่า running แล้วรันใหม่"
    Write-Host "Docker is not running - start Docker Desktop, wait until it is running, then run this again."
    exit 1
}

# ระบบเดิมที่เปิดแยกด้วย db/compose.yaml + web/compose.yaml (คนละโปรเจกต์ compose) ใช้ชื่อ container เดียวกัน -> ชนกัน
foreach ($c in @($db, $web)) {
    $owner = (docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' $c 2>$null)
    if ($LASTEXITCODE -eq 0 -and $owner -and $owner -ne $project) {
        Write-Host "พบ container '$c' ที่เปิดไว้โดยโปรเจกต์ '$owner' (ไม่ใช่ '$project') -> compose ที่รากสร้างชื่อเดียวกันซ้ำไม่ได้"
        Write-Host "ถ้าระบบนั้นใช้งานอยู่ ไม่ต้องรันสคริปต์นี้ (เปิดอยู่แล้ว: http://localhost:$port) · ถ้าจะย้ายมาใช้คำสั่งเดียว (ข้อมูลใน volume อยู่ต่อ):"
        Write-Host "    docker compose -f web/compose.yaml down"
        Write-Host "    docker compose -f db/compose.yaml down        # ห้ามใส่ -v"
        Write-Host "แล้วรัน .\start.ps1 ใหม่   |   Found '$c' owned by project '$owner'; stop it first (commands above, never with -v) or keep using it."
        exit 1
    }
}

Write-Host "== docker compose up -d --build (ครั้งแรกใช้เวลาหลายนาที: ดึง image + build เว็บ) =="
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "docker compose up ล้มเหลว · ดู log: docker compose logs --tail 50 migrate db web"
    Write-Host "docker compose up failed - see the output above (migration / db / web)."
    exit 1
}

Write-Host "== รอ $web healthy (สูงสุด $timeout วินาที) =="
$sw = [Diagnostics.Stopwatch]::StartNew()
$status = ''
while ($true) {
    $status = (docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $web 2>$null)
    if ($status -eq 'healthy') { break }
    if ($sw.Elapsed.TotalSeconds -ge $timeout) {
        Write-Host "หมดเวลา $timeout วินาที: $web สถานะ '$status' (ยังไม่ healthy)"
        Write-Host "Timed out after ${timeout}s waiting for $web (status: $status). Last logs:"
        docker compose logs --tail 30 migrate db web
        exit 1
    }
    Write-Host -NoNewline '.'
    Start-Sleep -Seconds 3
}
Write-Host ''

Write-Host "พร้อมใช้งานแล้ว / Ready"
Write-Host "  เว็บ / Web      : http://localhost:$port"
Write-Host "  ตรวจเวอร์ชัน    : http://localhost:$port/api/version"
Write-Host "  บัญชีทดลอง      : web/SPEC.md (ข้อมูลทดลองในเครื่องเท่านั้น) · คู่มือ docs/RUNBOOK.md"
Write-Host "  ปิด             : docker compose stop   (ห้ามใช้ down -v = ลบข้อมูล)"
Write-Host "  ตรวจเร็ว        : docker compose --profile test run --rm smoke"
exit 0
