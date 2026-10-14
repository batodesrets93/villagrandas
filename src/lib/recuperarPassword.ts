import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Tokens de recuperación de contraseña SIN guardar nada en la base.
 *
 * El token es `<payload>.<firma>`, con payload = base64url("<usuarioId>.<vence>")
 * y firma = HMAC-SHA256 con NEXTAUTH_SECRET. La firma además incluye una huella
 * del passwordHash actual del usuario: apenas cambia la contraseña (por este
 * mismo link, por el admin o por "Cambiar contraseña"), el link deja de servir.
 * Así es de un solo uso y vence solo, sin columnas nuevas en el schema.
 */

export const VIGENCIA_TOKEN_MS = 60 * 60 * 1000; // 1 hora

function secreto(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("Falta NEXTAUTH_SECRET.");
  return s;
}

function huella(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

function firmar(payload: string, passwordHash: string): string {
  return createHmac("sha256", secreto()).update(payload + "." + huella(passwordHash)).digest("base64url");
}

export function generarTokenRecupero(usuario: { id: string; passwordHash: string }): string {
  const vence = Date.now() + VIGENCIA_TOKEN_MS;
  const payload = Buffer.from(usuario.id + "." + vence).toString("base64url");
  return payload + "." + firmar(payload, usuario.passwordHash);
}

/** Saca el usuarioId del token SIN validarlo (para poder buscar al usuario y verificar la firma). */
export function usuarioIdDeToken(token: string): { usuarioId: string; vence: number } | null {
  const [payload] = token.split(".");
  if (!payload) return null;
  try {
    const [usuarioId, venceRaw] = Buffer.from(payload, "base64url").toString().split(".");
    const vence = Number(venceRaw);
    if (!usuarioId || !Number.isFinite(vence)) return null;
    return { usuarioId, vence };
  } catch {
    return null;
  }
}

export function tokenValido(token: string, usuario: { id: string; passwordHash: string }): boolean {
  const partes = token.split(".");
  if (partes.length !== 2) return false;
  const [payload, firma] = partes;
  const info = usuarioIdDeToken(token);
  if (!info || info.usuarioId !== usuario.id || info.vence < Date.now()) return false;

  const esperada = Buffer.from(firmar(payload, usuario.passwordHash));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
