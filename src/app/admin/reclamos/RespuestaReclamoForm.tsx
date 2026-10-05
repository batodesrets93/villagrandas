"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { responderReclamoAction } from "@/lib/actions";

const MAX_IMAGENES = 5;
const LADO_MAXIMO = 1600;

// Achica las fotos del celular antes de subirlas (si no, una sola foto puede
// superar el límite de tamaño de la request).
async function comprimirImagen(file: File): Promise<File> {
  if (file.type === "image/png" && file.size < 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function RespuestaReclamoForm({
  reclamoId,
  respuestaActual,
}: {
  reclamoId: string;
  respuestaActual: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onElegir(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const elegidos = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    const noImagen = elegidos.find((f) => !f.type.startsWith("image/"));
    if (noImagen) {
      setError(noImagen.name + ": solo se pueden adjuntar imágenes.");
      return;
    }
    const comprimidos = await Promise.all(elegidos.map(comprimirImagen));
    setArchivos((prev) => {
      const todos = [...prev, ...comprimidos];
      if (todos.length > MAX_IMAGENES) {
        setError("Podés adjuntar hasta " + MAX_IMAGENES + " imágenes.");
        return todos.slice(0, MAX_IMAGENES);
      }
      return todos;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.delete("archivos");
      archivos.forEach((f) => fd.append("archivos", f));
      await responderReclamoAction(fd);
      setArchivos([]);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "No se pudo enviar la respuesta");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="reclamoId" value={reclamoId} />
      <textarea name="respuesta" placeholder="Escribir respuesta..." rows={2} defaultValue={respuestaActual} />

      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Adjuntar imágenes a la respuesta (opcional, hasta {MAX_IMAGENES})
        </label>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={onElegir}
          className="text-xs"
        />
        {archivos.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-2">
            {archivos.map((f, i) => (
              <li key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] leading-4 text-center"
                  title="Quitar"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500 flex items-center gap-1">
          <input type="checkbox" name="cerrar" /> Respuesta final: responder y cerrar el reclamo
        </label>
        <button disabled={enviando} className="btn btn-primary text-xs">
          {enviando ? "Enviando..." : "Responder"}
        </button>
      </div>
    </form>
  );
}
