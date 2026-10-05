# CLAUDE.md — Torres Villa Grandas (sistema de expensas)

Este archivo le da contexto a Claude Code al abrir el proyecto. Leelo completo antes de tocar código.
Última actualización: 2026-10-05.

## Qué es la app

Sistema web que reemplaza el Excel de liquidación de expensas de Torres Villa Grandas (Torre Grande: 57 unidades; Torre Chica: 22 unidades; 79 unidades en total, más cocheras, bauleras y 3 quinchos: Amparo, Eva y Amado).

- **Admin**: carga los gastos del mes, el sistema prorratea entre las unidades según coeficiente, genera el PDF de cada unidad, registra pagos, envía las liquidaciones por email, gestiona reservas y reclamos.
- **Propietario**: ve su cuenta corriente, descarga el PDF, informa pagos, reserva quinchos y hace reclamos.
- **Limpieza**: rol que solo ve el calendario de quinchos.
- Producción: https://villagrandas.vercel.app

## Stack y despliegue

- Next.js 14.2.35 (App Router) + TypeScript + Prisma 5 + PostgreSQL + NextAuth + Tailwind + pdf-lib + nodemailer.
- Base de datos: Supabase (Postgres). Hosting: Vercel, conectado al repo de GitHub `batodesrets93/villagrandas`, rama `main`.
- **Cada `git push` a `main` despliega solo en Vercel.** Si un build falla, Vercel mantiene online la última versión que compiló bien.
- Usuario de trabajo en Windows (carpeta `C:\Users\Usuuario\Documents\GitHub\villagrandas` en la PC original).

## Comandos

```bash
npm install          # corre prisma generate (postinstall)
npm run dev          # local en http://localhost:3000
npm run build
npx tsc --noEmit     # typecheck rápido; usarlo siempre antes de commitear
npm run db:push      # aplica cambios de schema.prisma a la base REAL (ver "Base de datos")
npm run db:seed      # carga unidades, quinchos, admin (no borra, solo actualiza)
npx tsx scripts/<archivo>.ts   # scripts de uso único
```

## Estructura del código

- `prisma/schema.prisma` — modelo de datos (Usuario, Unidad, Cochera, Baulera, PeriodoExpensa, CargoUnidadPeriodo, Pago, PagoInformado, Reserva, Quincho, Reclamo, LecturaGas, GastoCategoria, Comprobante, etc.).
- `src/lib/calculo.ts` — prorrateo, gas/calefacción, cochera/baulera, pagos, ajustes.
- `src/lib/actions.ts` — todas las server actions (crear período, pagos, reservas, reclamos, envío de emails).
- `src/lib/bloqueo.ts` — bloqueo de períodos (`asegurarPeriodoAbierto`, `asegurarCargoAbierto`, `PeriodoBloqueadoError`).
- `src/lib/gastosPeriodo.ts` — total de gastos del período (incluye facturas de gas).
- `src/lib/planillaAdmin.ts` — importar/controlar el Excel de la administradora.
- `src/lib/dashboard.ts` — deuda, morosidad y gráficos del panel admin.
- `src/lib/pdf.ts` + `src/app/api/pdf/[cargoId]/route.ts` — PDF de liquidación por unidad.
- `src/lib/email.ts` — envío SMTP.
- `src/app/admin/...`, `src/app/propietario/...`, `src/app/limpieza/...` — páginas por rol.
- `scripts/` — scripts sueltos de uso manual (diagnósticos, correcciones puntuales). Están excluidos del type-check en `tsconfig.json`.

## Reglas de negocio (no romper)

**Deuda del panel admin**
- Deuda total = suma de `saldoActual >= 1000` (constante `MINIMO_DEUDOR`). **No se netean saldos a favor.** Es igual a la suma de la lista de deudores.
- Se **excluyen** las unidades de Costa Tranvial (`Unidad.esDesarrollador = true`, incluida la cuenta consolidada de cocheras/bauleras) de la deuda total, el gráfico y la lista de deudores. El detalle por unidad del período sí muestra su saldo. Depende de que los deptos estén marcados "Edificio" en `/admin/unidades` (el seed no los marca).
- Tarjetas del panel: solo "Deuda al cierre" (con cantidad de unidades) y Reclamos. El usuario NO quiere tarjetas de "Saldos a favor" ni "Unidades con deuda". Gráfico: Deuda al cierre vs Cobrado.
- Mismo criterio en `src/app/admin/page.tsx`, `src/app/admin/expensas/page.tsx` y `src/lib/dashboard.ts`.

**Cocheras y bauleras**
- Cada cochera/baulera paga por m². `Cochera.excluyeDesarrollador` y `Baulera.excluyeDesarrollador` ("Sin admin." en `/admin/cocheras-bauleras`) hacen que ese espacio use la tarifa sin Honorarios de Administración (como Costa Tranvial). Lo usa `calcularComplementarios()` en `calculo.ts`.
- Cochera/baulera sin asignar de Costa Tranvial van en una fila consolidada (`esConsolidadaCocheraBaulera`) con m2=0 y coeficiente=0 por diseño; la vista admin la muestra con etiqueta "Consolidado" y "—".

**Gas y calefacción**
- Total gastos del período = categorías + facturas de gas de "Calcular gas" (`facturaGasTorreGrande/Chica`) cuando no hay categoría Gas. Si el total incluye gas, **no se suma** "Agua caliente - espacios comunes" (la pileta ya está dentro de la factura de gas) — solo en display; el prorrateo sigue usando esa categoría.
- `calcularGasPeriodo` **rechaza** el cálculo si hay consumo negativo (lectura actual < anterior). Antes esto disparó la deuda a billones en Agosto/2026 porque `sumaK` quedaba casi cero.
- La planilla de la administradora titula por mes de gastos ("AGOSTO-26" corresponde al período Septiembre).

**Ajuste manual**
- `CargoUnidadPeriodo.ajuste` (+/-) y `ajusteConcepto`: se carga después de creado el período, unidad por unidad, desde el detalle de la liquidación (`actualizarAjusteAction`, solo ADMIN). Se suma al total en `crearPeriodoYCalcular`, `actualizarCalefaccion` y `actualizarPeriodoYCalcular`. Sale en el PDF como fila "Ajuste: <concepto>" si es distinto de 0.

**Visibilidad y bloqueo de períodos**
- Los cargos nuevos nacen con `visiblePropietario = false`; pasan a `true` al enviar la liquidación por email (`enviarLiquidacionesPorEmailAction`) o a mano. Botón "Ocultar a propietarios" (`ocultarPeriodoAction`). Los períodos viejos quedaron visibles.
- `PeriodoExpensa.cerrado`/`cerradoAt` = período bloqueado. Todo cambio (pagos, calefacción, ajuste, gas, edición, eliminación, comprobantes) pasa por `bloqueo.ts`. Desbloquear exige doble confirmación.
- Si un propietario informa un pago y se confirma sobre un período bloqueado, se imputa al cargo abierto más nuevo de la unidad.

**Reservas de quincho**
- Cada reserva confirmada suma $50.000 (`MONTO_QUINCHO`) a la próxima liquidación de la unidad.
- Propietario (`crearReservaAction`): mínimo 24 hs de anticipación **contra el inicio real del turno** (Mediodía 9:00, Noche 18:30, hora Argentina UTC-3), y solo mes actual o siguiente. El formulario muestra errores de validación y un mensaje "Reserva confirmada".
- Admin (`crearReservaAdminAction`): puede imputar a cualquier depto, a cualquier fecha (incluso pasada), sin mínimo de 24 hs. El `usuarioId` guardado es el del admin.
- Regla de fechas: nunca comparar contra `new Date("YYYY-MM-DD")` (da medianoche UTC). Construir el instante real (fecha + hora + offset Argentina).

**Importar planilla de la administradora**
- Nuevo período → "Importar planilla de la administradora" lee el Excel (filas "N-CATEGORIA" con total en col. B, renglones debajo, "TOTAL GASTOS ...") y guarda las facturas de gas. En el detalle del período, "Controlar contra la planilla" compara categoría por categoría y renglón (excluye pileta). Mapeo de nombres en `NOMBRES_SISTEMA` (`planillaAdmin.ts`). Si la administradora cambia el formato, ajustar `leerPlanillaAdmin`.

## Procedimientos operativos

**Liquidar un mes**: Admin → Expensas → Nuevo período (o importar planilla) → cargar gastos → Calcular gas con lecturas → completar calefacción/ajustes por unidad → comparar con "Controlar contra la planilla" → Enviar liquidaciones por email → registrar pagos → Bloquear período al cerrar.

**Cambio de titular de una unidad** (ejemplo real: TG 1ºC, de Costa Tranvial a Borras Graciela, posesión 11/9/2026): se hace desde la web como admin. Cambiar titular en `/admin/unidades`, destildar "Edificio" si corresponde, recalcular el período, asignar cochera/baulera, y cargar un **ajuste único** que absorba el saldo anterior y los días previos a la posesión prorrateando el total (calefacción y cochera/baulera incluidas). El ajuste es un importe fijo: si después cambian gastos o asignaciones, hay que recalcularlo.

**Dar acceso a un propietario**: Admin → Unidades → "Crear acceso" (email + contraseña).

## Base de datos (cuidado)

- `npm run db:push` actúa sobre la base real si el `.env` apunta a Supabase. Antes de un cambio de schema, hacer backup desde Supabase. Preferir agregar columnas con default; no borrar ni renombrar sin plan.
- Dos cadenas: `DATABASE_URL` (pooler, puerto 6543, `?pgbouncer=true`) para la app y `DIRECT_URL` (puerto 5432) para `db:push`.
- Para armar un `.env` local: `npx vercel env pull .env --environment=production` (la CLI sí trae variables "Secret"). `DATABASE_URL`/`DIRECT_URL` se sacan de Supabase → Project Settings → Database → Connection string. Supabase no muestra la contraseña de nuevo: si hace falta, se resetea y **hay que actualizar ambas variables en Vercel**.
- **Incidente 2026-09-04**: al editar a mano `DATABASE_URL` en Vercel se coló un carácter al principio (`apostgresql://...`) y se cayó todo el login, con el síntoma engañoso "email o contraseña incorrectos". Diagnóstico: Vercel → Logs (Runtime Logs) filtrando `/api/auth/callback/credentials`. Al editar variables sensibles: seleccionar todo el campo (triple clic), pegar, verificar que no sobre nada, guardar y hacer **Redeploy**.

## Trampas conocidas

- **Fines de línea CRLF/LF**: hay ruido de diffs en casi todos los archivos. Al commitear, agregar solo los archivos tocados a propósito (`git add <archivo>`), nunca `git add -A` ni `git add .`.
- **Scripts sueltos**: están en `scripts/` y excluidos del type-check (`"exclude"` en `tsconfig.json`) porque un error de tipos en uno rompió un deploy (7/9/2026). Mantener esa exclusión.
- **Next.js**: se actualizó a 14.2.35 por una vulnerabilidad de seguridad. Revisar `npm audit` de vez en cuando.
- **Archivos sin trackear que no deben subirse**: `.vercel/`, `nul`, `tsconfig.tsbuildinfo`, `check_admin_tmp.js`, `_to_delete/`. `.vercel/` conviene agregarlo a `.gitignore`.
- Si `git` falla con `index.lock` o `HEAD.lock`, cerrar procesos de git abiertos y borrar ese archivo en `.git/`.
- El `.env` y `.env.local` nunca se commitean (ya están en `.gitignore`).

## Pendientes abiertos (verificar con el usuario)

1. **Cochera/baulera "Sin admin."**: confirmar que se corrió `db:push` con las columnas `excluyeDesarrollador`, que se tildaron los espacios de Troyano (cochera Nº2), Manuela Rigueiro (cochera Nº6 y baulera E) y Daniel Rigueiro (cochera Nº29), y que se recalculó Agosto/2026. Delfino Graciela (TC 11-B) no es bug de la app: la planilla de la administradora referencia una cochera/baulera distinta de la suya.
2. **Septiembre/2026**: quedaron $19.640 sin ubicar entre el total del sistema y la planilla de la administradora (afecta el prorrateo).
3. **Gas de Agosto/2026**: se dejó un parche con consumo 0 (lectura actual = anterior). Cuando haya lecturas reales hay que recalcular.
4. **TG 1ºC**: el ajuste de Septiembre es un importe fijo; recalcular si cambian gastos o asignaciones.

## Cómo trabajar con el usuario

- Hablar en español rioplatense, directo, paso a paso y confirmando cada etapa, sobre todo antes de tocar la base real.
- Antes de commitear: `npx tsc --noEmit`. Mensajes de commit en español, estilo `feat(...)`/`fix(...)`.
- Pedidos de cambio suelen venir de la administración del consorcio (Joaquín Rigueiro y la administradora externa). Las reglas de arriba salen de esos pedidos: si algo parece contradecirlas, preguntar antes de cambiarlo.
- Para tareas nuevas por período, agregar las acciones al menú `AccionesPeriodoMenu` (prop `enMenu`) en vez de botones sueltos en `/admin/expensas`.
