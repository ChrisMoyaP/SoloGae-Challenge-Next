-- =====================================================================
-- reset-sologae2.sql — Vacía los datos de SoloGae para iniciar SoloGae 2
-- =====================================================================
--
-- ADVERTENCIA: OPERACIÓN DESTRUCTIVA E IRREVERSIBLE.
-- Borra TODAS las filas de: match_participants, rank_snapshots, participants.
-- No borra tablas ni columnas (el esquema se conserva; /api/setup lo verifica).
--
-- NO se ejecuta desde la aplicación (no existe endpoint de reset). Ejecutarlo a mano
-- en el SQL Editor de Neon (o psql) siguiendo help/procedures/reset-sologae2.md.
--
-- Estructura:
--   PASO 1  Verificaciones previas (solo lectura). Revisar los resultados.
--   PASO 2  Limpieza protegida por DOS guardas que el operador debe editar a mano:
--             expected_db  := nombre exacto de la base (ver resultado de current_database())
--             confirmation := 'BORRAR SOLOGAE'
--           Con los valores por defecto el bloque ABORTA sin borrar nada.
--           Además aborta si existen otras tablas con FKs hacia estas tablas
--           (TRUNCATE sin CASCADE: nunca borra datos de tablas no previstas).
--           Todo ocurre en una transacción: si algo falla, no se borra nada.
--   PASO 3  Verificación posterior (conteos = 0).
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 — Verificaciones previas (solo lectura)
-- ---------------------------------------------------------------------

-- 1.1 Entorno: base, usuario, servidor y zona horaria de la sesión
SELECT current_database() AS base,
       current_user       AS usuario,
       inet_server_addr() AS servidor,
       version()          AS version_pg;
SHOW timezone;

-- 1.2 Tablas existentes en el esquema public (deberían ser solo las 3 de SoloGae)
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;

-- 1.3 Conteos actuales
SELECT 'participants'       AS tabla, COUNT(*) AS filas FROM public.participants
UNION ALL
SELECT 'rank_snapshots',              COUNT(*)          FROM public.rank_snapshots
UNION ALL
SELECT 'match_participants',          COUNT(*)          FROM public.match_participants;

-- 1.4 Rango de fechas de partidas guardadas (UTC y America/Santiago)
SELECT MIN(to_timestamp(game_start_timestamp / 1000.0)) AS primera_partida_utc,
       MAX(to_timestamp(game_start_timestamp / 1000.0)) AS ultima_partida_utc,
       MIN(to_timestamp(game_start_timestamp / 1000.0) AT TIME ZONE 'America/Santiago') AS primera_partida_santiago,
       MAX(to_timestamp(game_start_timestamp / 1000.0) AT TIME ZONE 'America/Santiago') AS ultima_partida_santiago
FROM public.match_participants;

-- 1.5 Rango de fechas de snapshots
SELECT MIN(snapshot_date) AS primer_snapshot, MAX(snapshot_date) AS ultimo_snapshot
FROM public.rank_snapshots;

-- 1.6 Todas las FKs que apuntan a estas tablas (solo deberían aparecer
--     rank_snapshots -> participants y match_participants -> participants)
SELECT con.conname                 AS constraint_fk,
       con.conrelid::regclass      AS tabla_hija,
       con.confrelid::regclass     AS tabla_padre,
       pg_get_constraintdef(con.oid) AS definicion
FROM pg_constraint con
WHERE con.contype = 'f'
  AND con.confrelid IN ('public.participants'::regclass,
                        'public.rank_snapshots'::regclass,
                        'public.match_participants'::regclass)
ORDER BY tabla_hija::text;


-- ---------------------------------------------------------------------
-- PASO 2 — Limpieza (protegida). EDITAR LAS DOS GUARDAS ANTES DE EJECUTAR.
-- ---------------------------------------------------------------------

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $reset$
DECLARE
  -- >>> GUARDA 1: escribe a mano el nombre EXACTO de la base (resultado de 1.1) <<<
  expected_db  text := 'ESCRIBE_AQUI_EL_NOMBRE_DE_LA_BASE';
  -- >>> GUARDA 2: cambia a 'BORRAR SOLOGAE' para confirmar <<<
  confirmation text := 'NO';

  foreign_refs integer;
  remaining    bigint;
BEGIN
  IF confirmation IS DISTINCT FROM 'BORRAR SOLOGAE' THEN
    RAISE EXCEPTION 'Reset abortado: confirmación no escrita (confirmation debe ser ''BORRAR SOLOGAE'').';
  END IF;

  IF current_database() IS DISTINCT FROM expected_db THEN
    RAISE EXCEPTION 'Reset abortado: la base actual es "%" y se esperaba "%".', current_database(), expected_db;
  END IF;

  -- Ninguna tabla AJENA a estas tres puede tener FKs hacia ellas.
  SELECT COUNT(*) INTO foreign_refs
  FROM pg_constraint con
  WHERE con.contype = 'f'
    AND con.confrelid IN ('public.participants'::regclass,
                          'public.rank_snapshots'::regclass,
                          'public.match_participants'::regclass)
    AND con.conrelid NOT IN ('public.participants'::regclass,
                             'public.rank_snapshots'::regclass,
                             'public.match_participants'::regclass);
  IF foreign_refs > 0 THEN
    RAISE EXCEPTION 'Reset abortado: % FK(s) de otras tablas apuntan a las tablas de SoloGae. Revisar el PASO 1.6.', foreign_refs;
  END IF;

  -- Las tres tablas en una sola sentencia (respeta las FKs entre ellas).
  -- Sin CASCADE: si existiera otra dependencia, falla en vez de borrar de más.
  TRUNCATE TABLE public.match_participants, public.rank_snapshots, public.participants;

  SELECT (SELECT COUNT(*) FROM public.match_participants)
       + (SELECT COUNT(*) FROM public.rank_snapshots)
       + (SELECT COUNT(*) FROM public.participants)
    INTO remaining;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'Reset abortado: quedaron % filas tras el TRUNCATE.', remaining;
  END IF;

  RAISE NOTICE 'Reset completado en la base "%": 3 tablas vacías.', current_database();
END
$reset$;

COMMIT;
-- Si el bloque DO lanzó una excepción, la transacción queda abortada y el COMMIT
-- equivale a ROLLBACK: no se borró nada.


-- ---------------------------------------------------------------------
-- PASO 3 — Verificación posterior (deben ser 0)
-- ---------------------------------------------------------------------

SELECT 'participants'       AS tabla, COUNT(*) AS filas FROM public.participants
UNION ALL
SELECT 'rank_snapshots',              COUNT(*)          FROM public.rank_snapshots
UNION ALL
SELECT 'match_participants',          COUNT(*)          FROM public.match_participants;
