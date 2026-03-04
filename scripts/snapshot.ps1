# ============================================================
# snapshot.ps1  —  Dispara el snapshot diario de ranks
# SoloGae Challenge
# ============================================================
#
# USO MANUAL:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\snapshot.ps1"
#
# CONFIGURAR EN WINDOWS TASK SCHEDULER (para ejecución automática):
#   1. Abre el Programador de tareas (taskschd.msc)
#   2. Clic en "Crear tarea básica..."
#   3. Nombre: "SoloGae Snapshot Diario"
#   4. Desencadenador: Diariamente → hora que prefieras (ej. 23:59)
#   5. Acción: Iniciar un programa
#        Programa:   powershell.exe
#        Argumentos: -ExecutionPolicy Bypass -File "C:\ruta\completa\scripts\snapshot.ps1"
#        Iniciar en: C:\ruta\completa\   (la raíz del proyecto)
#   6. Finalizar y activar la tarea.
#
# PARA PRODUCCIÓN EN VERCEL:
#   Cambia la línea $url a tu dominio desplegado:
#     $url = "https://tu-sologae.vercel.app/api/snapshot"
#
# CONFIGURACIÓN:
#   $secret debe coincidir con SNAPSHOT_SECRET en tu .env.local (y en Vercel)
# ============================================================

$url    = "http://localhost:3000/api/snapshot"
$secret = "sologae-snapshot-2025-moya1234"   # <-- Cambiar por el valor real de SNAPSHOT_SECRET

Write-Host "Ejecutando snapshot de ranks..."
Write-Host "URL: $url"
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri     $url `
        -Method  POST `
        -Headers @{ Authorization = "Bearer $secret" } `
        -ErrorAction Stop

    Write-Host "Snapshot completado exitosamente:"
    Write-Host "  Total participantes : $($response.total)"
    Write-Host "  Guardados           : $($response.saved)"
    Write-Host "  Fallidos            : $($response.failed)"

    if ($response.errors) {
        Write-Host ""
        Write-Host "Errores:"
        foreach ($err in $response.errors) {
            Write-Host "  - $err"
        }
    }
} catch {
    Write-Host "Error al ejecutar el snapshot:"
    Write-Host "  $_"
    exit 1
}
