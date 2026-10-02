/**
 * Lee la planilla de gastos que arma la administradora externa (la hoja
 * "DETALLE DE GASTOS", ver gastos septiembre.xlsx de Septiembre/2026):
 *
 *   1-ENERGIA                 1988951.86   0.074...   <- categoria (total)
 *   EDEA N° 73446088           732194.69              <- gasto de la categoria
 *   EDEA N° 73506691          1256757.17
 *   2-HONORARIOS ADMINISTRACION ...
 *   ...
 *   TOTAL GASTOS AGOSTO-26   26831700.03              <- total de la planilla
 *
 * Se usa en dos lugares: para cargar el período nuevo sin tipear nada
 * ("Nuevo período" > Importar planilla) y para controlar un período ya
 * cargado contra la planilla (detalle del período > Controlar contra
 * planilla). Ambos del lado del navegador: el archivo no se sube al
 * servidor.
 */

export type ItemPlanilla = { detalle: string; monto: number };
export type CategoriaPlanilla = {
  /** Nombre como lo usa el sistema (ej: "Energía"). */
  nombre: string;
  /** Nombre como figura en la planilla (ej: "1-ENERGIA"). */
  nombrePlanilla: string;
  total: number;
  items: ItemPlanilla[];
};
export type Planilla = {
  titulo: string;
  categorias: CategoriaPlanilla[];
  totalPlanilla: number | null;
  facturaGasTorreGrande: number | null;
  facturaGasTorreChica: number | null;
  advertencias: string[];
};

/** Clave para comparar nombres sin importar mayusculas ni acentos. */
export function claveNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Nombre de la planilla (sin el numero) -> nombre de la categoria en el sistema.
const NOMBRES_SISTEMA: Record<string, string> = {
  energia: "Energía",
  "honorarios administracion": "Honorarios administración",
  agua: "Agua",
  gas: "Gas",
  "mantenimiento gral": "Mantenimiento general",
  "mantenimiento general": "Mantenimiento general",
  "mantenimiento ascensores": "Mantenimiento ascensores",
  seguro: "Seguro",
  seguridad: "Seguridad",
  limpieza: "Limpieza",
  mgp: "MGP",
  arba: "ARBA",
  varios: "Varios",
};

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function aNumero(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    // Por si alguna celda viene como texto "1.234.567,89".
    const s = v.replace(/[^\d.,-]/g, "");
    const n = s.includes(",") ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function formatoPesos(n: number): string {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function leerPlanillaAdmin(archivo: ArrayBuffer): Promise<Planilla> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(archivo, { type: "array" });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, blankrows: false });

  const planilla: Planilla = {
    titulo: "",
    categorias: [],
    totalPlanilla: null,
    facturaGasTorreGrande: null,
    facturaGasTorreChica: null,
    advertencias: [],
  };
  let actual: CategoriaPlanilla | null = null;

  for (const fila of filas) {
    const texto = typeof fila[0] === "string" ? fila[0].trim() : fila[0] != null ? String(fila[0]).trim() : "";
    const monto = aNumero(fila[1]);
    if (!texto) continue;

    if (/^total gastos/i.test(texto)) {
      planilla.totalPlanilla = monto != null ? redondear(monto) : null;
      actual = null;
      continue;
    }
    if (/^detalle de gastos/i.test(texto)) {
      planilla.titulo = texto;
      continue;
    }

    const cat = texto.match(/^\d+\s*-\s*(.+)$/);
    if (cat) {
      const nombrePlanilla = cat[1].trim();
      const nombre = NOMBRES_SISTEMA[claveNombre(nombrePlanilla)];
      if (!nombre) {
        planilla.advertencias.push(
          `La categoría "${texto}" no es una de las conocidas: se cargó con ese nombre, revisala.`
        );
      }
      actual = {
        nombre: nombre ?? nombrePlanilla.charAt(0) + nombrePlanilla.slice(1).toLowerCase(),
        nombrePlanilla: texto,
        total: redondear(monto ?? 0),
        items: [],
      };
      planilla.categorias.push(actual);
      continue;
    }

    if (actual && monto != null) {
      actual.items.push({ detalle: texto, monto: redondear(monto) });
    }
  }

  if (planilla.categorias.length === 0) {
    throw new Error(
      'No se encontró ninguna categoría en la planilla. Tiene que tener filas como "1-ENERGIA" con el importe en la columna B.'
    );
  }

  // Controles internos de la planilla (que sus propias sumas cierren).
  for (const c of planilla.categorias) {
    const suma = redondear(c.items.reduce((a, it) => a + it.monto, 0));
    if (Math.abs(suma - c.total) > 0.01) {
      planilla.advertencias.push(
        `En la planilla, "${c.nombrePlanilla}" dice ${formatoPesos(c.total)} pero sus renglones suman ${formatoPesos(suma)}.`
      );
    }
    if (claveNombre(c.nombre) === "gas") {
      for (const it of c.items) {
        const d = claveNombre(it.detalle);
        if (d.includes("grande")) planilla.facturaGasTorreGrande = it.monto;
        else if (d.includes("chica")) planilla.facturaGasTorreChica = it.monto;
      }
    }
  }
  const sumaCategorias = redondear(planilla.categorias.reduce((a, c) => a + c.total, 0));
  if (planilla.totalPlanilla != null && Math.abs(sumaCategorias - planilla.totalPlanilla) > 0.01) {
    planilla.advertencias.push(
      `En la planilla, el TOTAL GASTOS dice ${formatoPesos(planilla.totalPlanilla)} pero las categorías suman ${formatoPesos(sumaCategorias)}.`
    );
  }

  return planilla;
}
