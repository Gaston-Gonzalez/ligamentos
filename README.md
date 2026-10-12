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
