import { NextResponse } from "next/server";
import { contarReservasNuevasLimpiezaAction } from "@/lib/actions";

export async function GET() {
  try {
    const nuevas = await contarReservasNuevasLimpiezaAction();
    return NextResponse.json({ nuevas });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
