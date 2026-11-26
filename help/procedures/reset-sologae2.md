# Procedimiento: reinicio de datos para SoloGae 2

> Operación destructiva. Leer completo antes de empezar. Nada de esto se ejecuta desde
> la aplicación: no existe (ni debe existir) un endpoint de reset.

## 0. Conceptos clave

- **Periodo del torneo**: `NEXT_PUBLIC_EVENT_NAME`, `NEXT_PUBLIC_EVENT_START`,
  `NEXT_PUBLIC_EVENT_END` (ver `.env.example`). Intervalo semiabierto `[START, END)`.
  La UI muestra el término como el último instante incluido (`END - 1 s`, p. ej.
  "30 nov. 2026 23:59:59"). Formato obligatorio ISO 8601 con offset explícito; si faltan
  o son inválidas, `next build` falla con un mensaje claro (no hay fechas por defecto).
- **Se inyectan en el build**: son `NEXT_PUBLIC_*`, así que servidor y cliente usan
  exactamente el mismo valor. **Cambiar las fechas exige redeploy** (cambiar la variable
  en Vercel sin redeploy no tiene efecto).
- **Zona horaria**: todo se formatea en `America/Santiago`. Chile está en horario de
  verano (UTC-3) en noviembre, diciembre y enero, por eso los offsets son `-03:00`.
  Si algún día se usa una fecha en invierno (UTC-4), el offset debe ser `-04:00`.
- **Periodo de pruebas**: `2026-11-23T00:00:00-03:00` → `2026-12-01T00:00:00-03:00`.
- **Periodo oficial provisional**: `2027-01-01T00:00:00-03:00` → `2027-02-01T00:00:00-03:00`.

## 1. Identificar el entorno correcto

1. En Neon Console: proyecto → **Branches**. Anota la branch que usa producción (la de
   la `DATABASE_URL` configurada en Vercel > Settings > Environment Variables >
   Production). El host del connection string (`ep-xxxx...neon.tech`) identifica el
   endpoint de la branch: debe coincidir con el que abras en el SQL Editor.
2. En el SQL Editor de Neon, selecciona esa branch y la base, y ejecuta solo el
   **PASO 1** de `scripts/sql/reset-sologae2.sql`. Anota `current_database()`.
3. Confirma con los conteos y el rango de fechas (PASO 1.3–1.5) que es la base con los
   datos antiguos que quieres borrar.
4. Revisa el PASO 1.2 y 1.6: deberían existir solo `participants`, `rank_snapshots` y
   `match_participants`, con dos FKs hijas → `participants`. Si aparece otra tabla o FK,
   **detente** y revisa antes de continuar (el script abortará igualmente).

## 2. Orden de ejecución

1. **Pausar automatizaciones** (sección 3): cron de Vercel y tareas del Programador de
   tareas de Windows. Evita que una ingesta o snapshot escriba durante el reset.
2. **Red de seguridad (opcional)**: aunque no se quieren conservar datos, crear una
   branch de Neon desde la branch de producción (Branches → Create branch, "from
   current data") permite deshacer un error de entorno. Bórrala cuando ya no la necesites.
3. **Desplegar el código con las fechas**: configurar en Vercel (Production)
   `NEXT_PUBLIC_EVENT_NAME`, `NEXT_PUBLIC_EVENT_START`, `NEXT_PUBLIC_EVENT_END`,
   `SNAPSHOT_SECRET` y `CRON_SECRET`, y hacer **Redeploy** (sin build cache si cambiaste
   fechas). El build falla si faltan las fechas.
4. **Ejecutar el script SQL**: editar en el PASO 2 las dos guardas
   (`expected_db` = nombre anotado; `confirmation` = `'BORRAR SOLOGAE'`), ejecutar el
   PASO 2 y luego el PASO 3 (los tres conteos deben ser 0). Después, vuelve a dejar las
   guardas con sus valores por defecto en tu copia local (no las commitees editadas).
5. **Esquema**: `GET /api/setup` con `Authorization: Bearer <SNAPSHOT_SECRET>`. Solo
   crea/migra el esquema de forma idempotente; ya no inserta participantes.
   ```powershell
   Invoke-RestMethod -Uri "$env:SOLOGAE_BASE_URL/api/setup" -Headers @{ Authorization = "Bearer $env:SNAPSHOT_SECRET" }
   ```
6. **Cargar participantes**: pendiente (requerimiento futuro de importación CSV). Hasta
   entonces no hay mecanismo en la app; cualquier carga manual es decisión del operador.
7. **Snapshot inicial (línea base)**: ejecutar `scripts/snapshot.ps1` lo antes posible
   después de `EVENT_START` (p. ej. 00:05 del primer día). Ver sección 4.
8. **Ingesta**: ejecutar `scripts/ingest-matches.ps1`. Si responde `incomplete: True`,
   repetir hasta que sea `False`.
9. **Reactivar automatizaciones** (sección 3).
10. **Cachés**: tras el reset las instancias de Vercel pueden tener datos viejos en
    memoria (`withServerCache`, 60–600 s) y la CDN (`s-maxage` + `stale-while-revalidate`,
    hasta ~20 min). Hacer un **redeploy** después del reset (instancias nuevas y caché de
    CDN invalidada por deployment) o esperar TTL + SWR. Las claves de caché del servidor,
    de React Query y de sessionStorage incluyen el periodo (nombre + inicio + fin), por lo
    que cambiar de periodo nunca mezcla datos; los navegadores descartan la clave antigua
    `sologae:query:snapshots` automáticamente.

## 3. Pausar y reactivar procesos automáticos

### Vercel Cron (`vercel.json`: `/api/ingest-matches`, diario `0 9 * * *` UTC)
- **Pausar**: Vercel → Project → Settings → **Cron Jobs** → *Disable Cron Jobs*. No
  requiere cambiar código ni redeploy.
- **Reactivar**: mismo lugar → *Enable Cron Jobs*.
- Vercel envía `Authorization: Bearer $CRON_SECRET` solo si `CRON_SECRET` está definido;
  si no lo está, el endpoint responde 401 (falla cerrado).
- Nota: un cron diario puede no alcanzar a ingerir todo un día de muchas partidas en
  una ejecución; la ingesta es reanudable (ver sección 5), pero conviene complementar
  con `ingest-matches.ps1` o una frecuencia mayor si el plan de Vercel lo permite.

### Programador de tareas de Windows (`snapshot.ps1`, `ingest-matches.ps1`)
- **Pausar**: `taskschd.msc` → clic derecho en la tarea → **Deshabilitar**.
  (PowerShell: `Disable-ScheduledTask -TaskName "SoloGae Snapshot Diario"`).
- **Reactivar**: **Habilitar** (`Enable-ScheduledTask -TaskName "..."`).
- Los scripts ya no contienen el secreto: leen `$env:SNAPSHOT_SECRET` y la URL de
  `$env:SOLOGAE_BASE_URL` (default `http://localhost:3000`). Definirlas como variables de
  entorno de usuario de Windows.
- **Rotar el secreto**: el valor anterior de `SNAPSHOT_SECRET` quedó en el historial de
  git (versiones antiguas de `scripts/*.ps1`). Generar uno nuevo, actualizarlo en Vercel
  (y `.env.local`), redeploy, y considerar el antiguo comprometido.

## 4. Snapshots y línea base

- `snapshot_date` se calcula en código con la fecha de `America/Santiago` (no
  `CURRENT_DATE` de la base, que suele estar en UTC).
- `/api/snapshot` solo registra dentro de `[START, END)`; fuera responde `skipped`.
- **Línea base** = snapshot del primer día del periodo (`snapshot_date` = fecha de
  `START`). Ese día el snapshot **no se sobrescribe** (`ON CONFLICT DO NOTHING`), para
  conservar el estado capturado justo después del inicio. Desde el segundo día, cada
  ejecución actualiza el snapshot del día.
- **Ejecutar la captura inicial** inmediatamente después de `START`. Si se toma tarde,
  la línea base ya incluye el LP ganado/perdido antes de la captura (no es recuperable:
  Riot no entrega LP histórico). Si un jugador no tiene línea base, la UI muestra
  "Sin línea base" en vez de inventar datos.
- Consecuencia: el estado al cierre del primer día no queda registrado por separado; el
  delta del segundo día abarca desde la línea base.
- `lpToday`, días de subida/bajada, mejores días y gráficos usan solo snapshots del
  periodo.

## 5. Ingesta de partidas (cómo evita perder partidas)

- Consulta `match-v5 ids` con `queue=420`, `startTime = START` y
  `endTime = min(ahora, END)`; antes del inicio responde `skipped` sin llamar a Riot.
  Después del fin sigue recuperando partidas de `[START, END)`, nunca posteriores.
- Recorre **toda** la paginación (100 por página) y resta los ids ya guardados: no corta
  en el primer existente, así los huecos de ejecuciones interrumpidas se rellenan.
- Nada se inserta sin un detalle válido (matchId, `gameStartTimestamp` numérico,
  `queueId === 420`, participante presente, campos numéricos) y dentro de
  `[START, END)`. Un error temporal (5xx, 429 agotado, red) se reintenta en la siguiente
  ejecución. Rechazos permanentes (otra cola, fuera de rango) se cuentan y no bloquean.
- Orden: participantes más atrasados primero (última partida guardada más antigua) y
  partidas faltantes de más antigua a más reciente; el detalle de una partida compartida
  se pide una sola vez.
- Ritmo: 1,3 s entre llamadas, reintentos ante 429 con `Retry-After` (máx. 3).
  `maxDuration = 300` y un presupuesto interno de 270 s: al agotarse responde
  `incomplete: true` con pendientes; la siguiente ejecución retoma.
- Costo: cada ejecución vuelve a listar todo el periodo (≈1 llamada por cada 100
  partidas por participante). Con un mes y ~12 participantes es aceptable con la dev key.

## 6. Limitaciones conocidas (LP por partida)

- Riot match-v5 **no entrega LP ganado/perdido por partida**; solo existe el rank actual
  (league-v4), que capturamos en snapshots diarios.
- La diferencia entre dos snapshots no se puede atribuir de forma exacta a partidas o
  campeones si hubo varias partidas entre ellos (ganancias variables por MMR,
  promociones, decay, remakes). No se implementan estimaciones.
- `match_participants` conserva lo necesario para rachas (`win`,
  `game_start_timestamp`) y estadísticas por campeón (`champion_name`, KDA, CS, ítems,
  runa principal, equipo y `participants_json`).
