# ============================================================
# ingest-matches.ps1  —  Ingiere el historial de partidas SoloQ del torneo
# SoloGae Challenge
# ============================================================
#
# USO MANUAL:
#   $env:SNAPSHOT_SECRET = "<valor real, NO lo escribas en este archivo>"
#   $env:SOLOGAE_BASE_URL = "https://tu-dominio.vercel.app"   # opcional (default: http://localhost:3000)
#   powershell -ExecutionPolicy Bypass -File ".\scripts\ingest-matches.ps1"
#
# CONFIGURAR EN WINDOWS TASK SCHEDULER:
#   Mismo procedimiento que snapshot.ps1 (variables de entorno de usuario, nunca el
#   secreto en el archivo). Para pausarla: Deshabilitar la tarea en taskschd.msc.
#
# Si la respuesta trae incomplete = True, quedaron partidas pendientes por el
# presupuesto de tiempo: vuelve a ejecutar el script (retoma sin perder partidas).
# ============================================================

$baseUrl = if ($env:SOLOGAE_BASE_URL) { $env:SOLOGAE_BASE_URL.TrimEnd("/") } else { "http://localhost:3000" }
$url     = "$baseUrl/api/ingest-matches"
$secret  = $env:SNAPSHOT_SECRET

if (-not $secret) {
    Write-Host "Falta la variable de entorno SNAPSHOT_SECRET. Abortando."
    exit 1
}

Write-Host "Ejecutando ingesta de partidas..."
Write-Host "URL: $url"
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri        $url `
        -Method     POST `
        -Headers    @{ Authorization = "Bearer $secret" } `
        -TimeoutSec 330 `
        -ErrorAction Stop

    if ($response.status -eq "skipped") {
        Write-Host "Ingesta omitida: $($response.message)"
        exit 0
    }

    $m = $response.matches
    $p = $response.participants
    Write-Host "Ingesta completada (fase: $($response.phase)):"
    Write-Host "  Participantes           : $($p.processed) / $($p.total) (fallidos: $($p.failed))"
    Write-Host "  Partidas listadas       : $($m.listed)"
    Write-Host "  Ya guardadas            : $($m.alreadyStored)"
    Write-Host "  Nuevas insertadas       : $($m.inserted)"
    Write-Host "  Duplicados omitidos     : $($m.duplicatesSkipped)"
    Write-Host "  Rechazadas              : cola=$($m.rejected.wrong_queue) fuera_de_rango=$($m.rejected.out_of_window) estructura=$($m.rejected.invalid_structure) sin_participante=$($m.rejected.participant_missing)"
    Write-Host "  Fallos recuperables     : $($m.recoverableFailures)"
    Write-Host "  Pendientes (deadline)   : $($m.pending)"
    Write-Host "  Incompleta              : $($response.incomplete)"

    if ($response.errors) {
        Write-Host ""
        Write-Host "Errores:"
        foreach ($err in $response.errors) {
            Write-Host "  - $err"
        }
    }
} catch {
    Write-Host "Error al ejecutar la ingesta:"
    Write-Host "  $($_.Exception.Message)"
    exit 1
}
