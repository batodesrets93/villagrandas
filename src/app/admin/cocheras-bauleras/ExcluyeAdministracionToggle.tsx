"use client";

import { useRef } from "react";
import { marcarExcluyeAdministracionCocheraAction, marcarExcluyeAdministracionBauleraAction } from "@/lib/actions";

export default function ExcluyeAdministracionToggle({
  tipo,
  espacioId,
  checked,
}: {
  tipo: "cochera" | "baulera";
  espacioId: string;
  checked: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const accion = tipo === "cochera" ? marcarExcluyeAdministracionCocheraAction : marcarExcluyeAdministracionBauleraAction;

  return (
    <form ref={formRef} action={accion}>
      <input type="hidden" name={tipo === "cochera" ? "cocheraId" : "bauleraId"} value={espacioId} />
      <input
        type="checkbox"
        name="excluyeDesarrollador"
        defaultChecked={checked}
        title="No cobrarle Honorarios de Administración a este espacio puntual (igual que a Costa Tranvial)"
        onChange={() => formRef.current?.requestSubmit()}
        style={{ width: "auto" }}
      />
    </form>
  );
}
