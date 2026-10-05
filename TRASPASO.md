# TRASPASO — Torres Villa Grandas

Inventario de cuentas, servicios y variables que hay que tener en orden para seguir manteniendo la app desde otra cuenta de Claude. **Este archivo no contiene contraseñas ni claves**: solo dice dónde está cada cosa.

## 1. Cuentas y servicios

| Servicio | Qué es | Dónde |
|---|---|---|
| GitHub | Código fuente | https://github.com/batodesrets93/villagrandas (rama `main`) |
| Vercel | Hosting y deploy automático | Proyecto `villagrandas` — https://villagrandas.vercel.app |
| Supabase | Base de datos Postgres | Proyecto de Villa Grandas (Project Settings → Database) |
| Gmail (SMTP) | Envío de liquidaciones por email | Cuenta Gmail con "contraseña de aplicación" (ver variables SMTP) |

Todo está a nombre de la cuenta personal `batodesrets93` (GitHub) y de tu usuario en Vercel/Supabase, no de la empresa.

## 2. Variables de entorno

Viven en Vercel (Settings → Environment Variables) y en un archivo `.env` local (no se commitea).

| Variable | Para qué sirve | De dónde sacarla |
|---|---|---|
| `DATABASE_URL` | Conexión de la app a Postgres (pooler, puerto 6543, `?pgbouncer=true`) | Supabase → Project Settings → Database → Connection string |
| `DIRECT_URL` | Conexión directa (puerto 5432), solo para `db:push` | Supabase, igual que la anterior |
| `NEXTAUTH_SECRET` | Firma las sesiones de login | Vercel (si se cambia, se cierran todas las sesiones) |
| `NEXTAUTH_URL` | URL del sitio (`https://villagrandas.vercel.app` en producción, `http://localhost:3000` en local) | Fijo |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales del admin que crea el seed | Solo se usan al correr `db:seed` |
| `SMTP_HOST` / `SMTP_PORT` | Servidor de correo (`smtp.gmail.com` / `587`) | Fijo |
| `SMTP_USER` | Cuenta Gmail que envía | Ver `.env.example` |
| `SMTP_PASS` | **Contraseña de aplicación** de Gmail (no la normal) | Cuenta de Google → Seguridad → Contraseñas de aplicaciones |
| `SMTP_FROM` | Remitente que ven los propietarios | Fijo |

Cómo traerlas a una PC nueva: `npx vercel login`, `npx vercel link` dentro de la carpeta y `npx vercel env pull .env --environment=production`. La base de datos se puede resetear la contraseña en Supabase si no se tiene guardada (después hay que actualizar `DATABASE_URL` y `DIRECT_URL` en Vercel y hacer Redeploy).

## 3. Dependencias externas a confirmar

- La cuenta de Gmail del `SMTP_USER` debe seguir existiendo y con la contraseña de aplicación vigente. Si se revoca, dejan de salir los emails de liquidación.
- Si en algún momento se cierra la cuenta de la empresa en Claude, **no pasa nada con la app**: el código, el deploy y la base son independientes. Lo único que se pierde es la memoria de Claude, que ahora está reflejada en `CLAUDE.md`.

## 4. Checklist de traspaso

- [ ] `CLAUDE.md` y `TRASPASO.md` commiteados y pusheados al repo.
- [ ] Repo clonado en la PC nueva.
- [ ] Claude Code (o la app de Claude) instalado con la cuenta personal.
- [ ] `.env` local armado (Vercel + Supabase).
- [ ] `npm install` y `npm run dev` funcionan.
- [ ] Un cambio de prueba pusheado y desplegado en Vercel.
- [ ] Backup de la base descargado desde Supabase.
- [ ] Contraseñas guardadas en un gestor (Supabase DB, Gmail app password, admin del sitio).
- [ ] `.vercel/` agregado a `.gitignore`.

## 5. Quiénes piden cambios

- Administración del consorcio: Joaquín Rigueiro (pedidos funcionales, reservas, ajustes).
- Administradora externa: manda el Excel mensual de gastos (la app lo importa y lo controla).
