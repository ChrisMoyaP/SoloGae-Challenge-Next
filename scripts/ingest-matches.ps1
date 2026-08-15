# ============================================================
# ingest-matches.ps1  —  Ingiere el historial de partidas SoloQ
# SoloGae Challenge
# ============================================================
#
# USO MANUAL:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\ingest-matches.ps1"
#
# CONFIGURAR EN WINDOWS TASK SCHEDULER (para ejecución automática):
#   Mismo procedimiento que snapshot.ps1 (ver ese archivo para el detalle
#   paso a paso). Se recomienda correrlo justo después del snapshot diario,
#   o con mayor frecuencia si se quiere que Tops/Coincidencias estén más al día.
#
# PARA PRODUCCIÓN EN VERCEL:
#   Cambia la línea $url a tu dominio desplegado:
#     $url = "https://tu-sologae.vercel.app/api/ingest-matches"
#
# CONFIGURACIÓN:
#   $secret debe coincidir con SNAPSHOT_SECRET en tu .env.local (y en Vercel)
# ============================================================

$url    = "http://localhost:3000/api/ingest-matches"
$secret = "sologae-snapshot-2025-moya1234"   # <-- Cambiar por el valor real de SNAPSHOT_SECRET

Write-Host "Ejecutando ingesta de partidas..."
Write-Host "URL: $url"
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri     $url `
        -Method  POST `
        -Headers @{ Authorization = "Bearer $secret" } `
        -ErrorAction Stop

    Write-Host "Ingesta completada exitosamente:"
    Write-Host "  Total participantes : $($response.total)"
    Write-Host "  Procesados          : $($response.participantsProcessed)"
    Write-Host "  Partidas nuevas     : $($response.matchesIngested)"
    Write-Host "  Fallidos            : $($response.failed)"

    if ($response.errors) {
        Write-Host ""
        Write-Host "Errores:"
        foreach ($err in $response.errors) {
            Write-Host "  - $err"
        }
    }
} catch {
    Write-Host "Error al ejecutar la ingesta:"
    Write-Host "  $_"
    exit 1
}
