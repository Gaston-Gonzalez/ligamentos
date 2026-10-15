# Ligamentos Cruzeiro

Sitio del plantel **Ligamentos Cruzeiro** (Serie 4 · Liga Pro): estadísticas por campeonato, partido y jugador, fotos vía links de [ligapro.uy](https://www.ligapro.uy), videos del canal [YouTube](https://www.youtube.com/@LigamentosCruzeiro), y un panel admin.

Pensado para deploy en **Vercel Hobby** + **Neon Free**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Datos: JSON local (`data/seed.json`) o Neon Postgres (Drizzle)
- Fotos: URLs de `r2.ligapro.uy` (sin Vercel Blob)
- Videos: embeds de YouTube

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # opcional; sin DATABASE_URL usa JSON
npm run seed:parse           # Excel → data/seed.json
npm run scrape:ligapro       # fotos Ligamentos desde Liga Pro
npm run dev
```

Admin local: `/admin` — contraseña por defecto `ligamentos` (o `ADMIN_PASSWORD`).

Sin `DATABASE_URL`, el admin escribe en `data/seed.json` y `data/ligapro-photos.json` (útil en local; en Vercel hace falta Neon porque el filesystem no persiste).

## Import de datos

### 1. Excel de asistencia

```bash
npm run seed:parse
# o: npx tsx scripts/parse-excel.ts "E:\Downloads\Asistencia de Jugadores.xlsx"
```

Genera `data/seed.json` con jugadores, partidos, asistencia y goles.

### 2. Scraper Liga Pro

```bash
npm run scrape:ligapro
```

Fotos de la Final 25 (Google Drive):

```bash
npm run import:drive-final25
```


- Recorre galerías de **Serie 4** (y torneos asociados) desde Clausura 2024
- Lista **todos** los partidos de cada campeonato
- Importa **solo** álbumes de **Ligamentos Cruzeiro**
- Escribe `data/ligapro-photos.json` y actualiza `ligaproAlbumUrl` en los partidos matcheados
- Reporte: `data/ligapro-scrape-report.json`

### 3. Neon (producción)

1. Creá un proyecto Neon Free desde el Marketplace de Vercel
2. Copiá `DATABASE_URL` a las env vars del proyecto
3. Localmente:

```bash
npm run db:push
npm run seed:db
```

## Deploy en Vercel

1. Push del repo a GitHub
2. Importá el proyecto en Vercel (Hobby)
3. Variables:
   - `DATABASE_URL`
   - `ADMIN_PASSWORD`
   - `AUTH_SECRET`
4. Deploy
5. Corré `db:push` + `seed:db` una vez (desde tu máquina con la misma `DATABASE_URL`)

## Reconocimiento facial (local)

Auto-tag de jugadores en fotos con `@vladmandic/face-api` (WASM, corre en tu PC — no en Vercel).

### Setup

```bash
npm install
npm run faces:models    # copia pesos a data/face-models/
```

En Windows no hace falta Visual C++: usamos el backend WASM de TensorFlow (sin `tfjs-node`).

### Flujo

1. En `/admin/fotos` o la galería, tageá a mano **2–4 fotos claras de cerca** por jugador (cara visible).
2. Enrolá descriptores:

```bash
npm run faces:enroll
```

Escribe `data/face-descriptors.json`.

3. Reconocé el resto (merge de tags; no borra tags manuales):

```bash
# Preferí npx (npm en Windows se come flags como --force / --limit):
npx tsx scripts/faces-recognize.ts --max=20            # prueba
npx tsx scripts/faces-recognize.ts                     # full run
npx tsx scripts/faces-recognize.ts --rerun             # reprocesar
npx tsx scripts/faces-recognize.ts --threshold=0.5     # más estricto
npx tsx scripts/faces-recognize.ts --untagged-only     # solo fotos sin tags

# Vía npm (usá forma --clave=valor):
npm run faces:recognize -- --max=20 --rerun
```

Estado incremental: `data/face-recognition-state.json`. Con `DATABASE_URL` escribe también en Neon (`photo_tags`).

4. Corregí errores a mano en galería / admin.

### Próximos pasos (post-v1)

- **v2** — Cola admin de revisión (confianza, origen `manual` / `face-auto`, filtros).
- **v3** — Enrolamiento visual: click en caras detectadas en la foto.
- **v4** — Recognize automático al scrapear álbumes nuevos (job local).
- **v5** — Más precisión: K refs por jugador, filtros de calidad, `faces:eval`.

## Rutas

| Ruta | Descripción |
| --- | --- |
| `/` | Inicio |
| `/campeonatos` | Torneos y detalle |
| `/jugadores` | Plantel y perfiles |
| `/partidos` | Partidos y ficha |
| `/galeria` | Fotos Liga Pro |
| `/videos` | Videos YouTube |
| `/admin` | Panel (contraseña) |

## Definiciones de stats

- **Jugados** = asistencia `present`
- **Habilitados** = no `not_registered`
- **% habilitados** = jugados / habilitados
- **Justificadas** = (present + injury + travel) / habilitados
- **Récord / win rate** = solo partidos en los que estuvo presente
