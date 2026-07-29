"use client";

import { useRef } from "react";
import { marcarDesarrolladorAction } from "@/lib/actions";

export default function DesarrolladorToggle({ unidadId, checked }: { unidadId: string; checked: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={marcarDesarrolladorAction}>
      <input type="hidden" name="unidadId" value={unidadId} />
      <input
        type="checkbox"
        name="esDesarrollador"
        defaultChecked={checked}
        title="Marcar como unidad del edificio (no aparece en el ranking de deudores)"
        onChange={() => formRef.current?.requestSubmit()}
        style={{ width: "auto" }}
      />
    </form>
  );
}
