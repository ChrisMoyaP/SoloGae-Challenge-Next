# ============================================================
# snapshot.ps1  —  Dispara el snapshot diario de ranks
# SoloGae Challenge
# ============================================================
#
# USO MANUAL:
#   $env:SNAPSHOT_SECRET = "<valor real, NO lo escribas en este archivo>"
#   $env:SOLOGAE_BASE_URL = "https://tu-dominio.vercel.app"   # opcional (default: http://localhost:3000)
#   powershell -ExecutionPolicy Bypass -File ".\scripts\snapshot.ps1"
#
# CONFIGURAR EN WINDOWS TASK SCHEDULER (para ejecución automática):
#   1. Define SNAPSHOT_SECRET (y opcionalmente SOLOGAE_BASE_URL) como variables de
#      entorno de USUARIO de Windows (Configuración > Variables de entorno), no aquí.
#   2. Abre el Programador de tareas (taskschd.msc) > "Crear tarea básica..."
#   3. Nombre: "SoloGae Snapshot Diario"
#   4. Desencadenador: Diariamente → hora que prefieras
#   5. Acción: Iniciar un programa
#        Programa:   powershell.exe
#        Argumentos: -ExecutionPolicy Bypass -File "C:\ruta\completa\scripts\snapshot.ps1"
#        Iniciar en: C:\ruta\completa\   (la raíz del proyecto)
#   6. Finalizar y activar la tarea.
#   Para pausarla: clic derecho sobre la tarea > Deshabilitar (Habilitar para reactivar).
#
# El endpoint solo registra dentro del periodo [EVENT_START, EVENT_END); fuera de él
# responde status=skipped. El snapshot del primer día del torneo es la línea base y no
# se sobrescribe. Ver help/procedures/reset-sologae2.md.
# ============================================================

$baseUrl = if ($env:SOLOGAE_BASE_URL) { $env:SOLOGAE_BASE_URL.TrimEnd("/") } else { "http://localhost:3000" }
$url     = "$baseUrl/api/snapshot"
$secret  = $env:SNAPSHOT_SECRET

if (-not $secret) {
    Write-Host "Falta la variable de entorno SNAPSHOT_SECRET. Abortando."
    exit 1
}

Write-Host "Ejecutando snapshot de ranks..."
Write-Host "URL: $url"
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri     $url `
        -Method  POST `
        -Headers @{ Authorization = "Bearer $secret" } `
        -ErrorAction Stop

    if ($response.status -eq "skipped") {
        Write-Host "Snapshot omitido: $($response.message)"
        exit 0
    }

    Write-Host "Snapshot completado:"
    Write-Host "  Fecha (America/Santiago) : $($response.snapshotDate)"
    Write-Host "  Dia de linea base        : $($response.baselineDay)"
    Write-Host "  Total participantes      : $($response.total)"
    Write-Host "  Guardados                : $($response.saved)"
    Write-Host "  Linea base conservada    : $($response.keptBaseline)"
    Write-Host "  Fallidos                 : $($response.failed)"

    if ($response.errors) {
        Write-Host ""
        Write-Host "Errores:"
        foreach ($err in $response.errors) {
            Write-Host "  - $err"
        }
    }
} catch {
    Write-Host "Error al ejecutar el snapshot:"
    Write-Host "  $($_.Exception.Message)"
    exit 1
}
