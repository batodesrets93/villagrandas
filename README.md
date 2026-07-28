# Torres Villa Grandas — Sistema de administración

Reemplaza el Excel de liquidación de expensas por un sitio web con:

- **Admin**: carga los gastos del mes, el sistema prorratea automáticamente entre las 79 unidades
  según su coeficiente de participación, genera el PDF de cada unidad y registra pagos.
- **Propietarios**: cada unidad tiene su usuario y contraseña para ver su cuenta corriente, descargar
  el PDF de la expensa, reservar los quinchos (Amparo, Eva, Amado) y hacer reclamos.
- **Quinchos ↔ expensas**: cada reserva confirmada suma automáticamente $50.000 a la próxima
  liquidación de esa unidad.

Ya viene cargado con la estructura real del edificio: **Torre Grande (57 unidades, pisos 1 a 21)** y
**Torre Chica (22 unidades, pisos 1 a 11)**, con titulares, m² y coeficientes tomados del archivo de
Junio 2026.

## Stack

Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL + NextAuth + Tailwind + pdf-lib.
Pensado para subir a GitHub y desplegar gratis en **Vercel**, con la base de datos en **Supabase**
(o Neon), ambos con planes gratuitos suficientes para este uso.

## 1. Requisitos

- Node.js 18 o superior
- Una cuenta gratuita en [Supabase](https://supabase.com) (o [Neon](https://neon.tech)) para la base
  de datos Postgres
- Una cuenta en [GitHub](https://github.com) y en [Vercel](https://vercel.com) (podés loguearte en
  Vercel directamente con tu cuenta de GitHub)

## 2. Configuración local

```bash
npm install
cp .env.example .env
```

Editá `.env`:

- `DATABASE_URL`: en Supabase, entrá a tu proyecto → **Project Settings → Database → Connection
  string → URI** (usá la que dice "Connection pooling" si vas a desplegar en Vercel).
- `NEXTAUTH_SECRET`: generalo con `openssl rand -base64 32` (o cualquier cadena larga aleatoria).
- `NEXTAUTH_URL`: `http://localhost:3000` en local.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: las credenciales que va a tener el usuario administrador que crea
  el seed. Cambiá la contraseña después del primer ingreso (por ahora el cambio de clave se hace
  editando la base o volviendo a correr el seed con otra contraseña).

Crear las tablas y cargar las 79 unidades + los 3 quinchos + el usuario admin:

```bash
npm run db:push
npm run db:seed
```

Correr en local:

```bash
npm run dev
```

Entrá a `http://localhost:3000`, ingresá con el email/contraseña de admin que pusiste en `.env`.

## 3. Subir a GitHub

```bash
git init
git add .
git commit -m "Version inicial - sistema de administracion Villa Grandas"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/villa-grandas.git
git push -u origin main
```

## 4. Desplegar en Vercel (gratis)

1. Entrá a [vercel.com](https://vercel.com) → **Add New Project** → importá el repo de GitHub.
2. En **Environment Variables** cargá las mismas 5 variables del `.env` (con la `DATABASE_URL` de
   Supabase, usando la cadena de "connection pooling").
3. Deploy. Vercel te da una URL tipo `villa-grandas.vercel.app` — se la podés pasar a los propietarios.
4. La primera vez, corré el seed apuntando a la base de producción: en tu máquina, cambiá `DATABASE_URL`
   en `.env` a la de Supabase y corré `npm run db:push && npm run db:seed` una sola vez.

Cada vez que hagas cambios y los subas a GitHub (`git push`), Vercel actualiza el sitio solo.

## 5. Cómo usarlo día a día

**Dar acceso a un propietario**: Admin → *Unidades* → en la fila de su departamento, "Crear acceso",
completar email y contraseña, avisarle por WhatsApp/email.

**Liquidar el mes**: Admin → *Expensas* → *Nuevo período* → cargar fechas y el detalle de gastos
(energía, agua, gas, sueldos, etc., igual que en el Excel actual) → *Liquidar período*. El sistema:
- Prorratea el total entre las 79 unidades según su coeficiente.
- Suma cochera y baulera fijas de cada unidad.
- Suma $50.000 por cada reserva de quincho confirmada y todavía no facturada.
- Arrastra el saldo pendiente de la liquidación anterior de cada unidad.

Después, en el detalle del período podés completar la **calefacción/agua caliente** de cada unidad
(es la única variable que depende del consumo real y no se puede prorratear automáticamente), y
**registrar pagos** a medida que los propietarios transfieren. Cada unidad tiene un botón para
descargar su PDF.

**Reservas y reclamos**: los propietarios los gestionan solos desde su cuenta; el admin los ve en
*Reservas* y *Reclamos* y puede cancelar reservas o responder reclamos.

## 6. Qué queda pendiente / ideas para más adelante

- **Envío automático** del PDF por email o WhatsApp al generar la liquidación (hoy se descarga desde
  el sitio, no se envía solo).
- **Pagos online** (Mercado Pago u otro) — hoy el pago se sigue avisando por transferencia y el admin
  lo carga manualmente, como pediste.
- Editar m², coeficiente o cochera/baulera de una unidad desde la interfaz (hoy están cargados en el
  seed con los datos reales de junio 2026; para corregir algo puntual se edita `prisma/seed.ts` y se
  vuelve a correr `npm run db:seed`, que no borra nada, solo actualiza).
- Un calendario visual para las reservas de quincho (hoy se ve como lista de disponibilidad).
- Definir bien la distribución de la Torre Grande si hay pisos con más letras de las que aparecen en
  la liquidación de junio (quedó tal cual el Excel: pisos 1-10 con 4 unidades A-D, pisos 11-16 con 2
  unidades A-B, pisos 17-21 con 1 unidad A).

## 7. Estructura del proyecto

```
prisma/schema.prisma     modelo de datos (unidades, períodos, cargos, reservas, reclamos)
prisma/seed.ts           carga inicial: 79 unidades reales, 3 quinchos, usuario admin
src/lib/calculo.ts       lógica de prorrateo de expensas y registro de pagos
src/lib/pdf.ts           generación del PDF de liquidación
src/lib/actions.ts       todas las acciones (crear período, pagos, reservas, reclamos)
src/app/admin/...        páginas del administrador
src/app/propietario/...  páginas del propietario
```
