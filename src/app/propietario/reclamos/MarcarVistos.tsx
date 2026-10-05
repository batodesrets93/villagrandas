"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { marcarRespuestasReclamosVistasAction } from "@/lib/actions";

// Al entrar a la pantalla de reclamos, marca las respuestas como vistas
// y refresca para que desaparezca el aviso del menú.
export default function MarcarVistos() {
  const router = useRouter();
  useEffect(() => {
    marcarRespuestasReclamosVistasAction()
      .then(() => router.refresh())
      .catch(() => {});
  }, [router]);
  return null;
}
