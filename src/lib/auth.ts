import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { usuarioTieneUnidad } from "@/lib/unidadesUsuario";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { unidad: true },
        });
        if (!usuario) return null;
        if (!usuario.activo) return null;

        const valido = await bcrypt.compare(credentials.password, usuario.passwordHash);
        if (!valido) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          rol: usuario.rol,
          unidadId: usuario.unidadId ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Un propietario con varios departamentos cambia de unidad desde el menu
      // (useSession().update). Se valida contra la base que de verdad tenga
      // acceso a esa unidad antes de cambiarla en el token.
      if (trigger === "update" && token.rol === "PROPIETARIO" && token.id) {
        const nuevaUnidadId = (session as any)?.unidadId;
        if (typeof nuevaUnidadId === "string" && (await usuarioTieneUnidad(token.id as string, nuevaUnidadId))) {
          token.unidadId = nuevaUnidadId;
        }
        return token;
      }
      if (user) {
        token.rol = (user as any).rol;
        token.unidadId = (user as any).unidadId;
        token.id = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).rol = token.rol;
        (session.user as any).unidadId = token.unidadId;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
