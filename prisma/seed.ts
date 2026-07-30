import { PrismaClient, Torre } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Datos reales tomados de "EXPENSAS TORRES VILLA GRANDAS - Junio 2026"
// coeficiente esta guardado como fraccion (0.0189484 = 1,89484%)
//
// cochera/baulera abajo son los MONTOS que le tocaron a cada unidad en la
// liquidacion de junio 2026, tal como estaban en el excel. Ya NO se usan
// para cargar ningun campo (cocheras y bauleras ahora son sus propias
// tablas, ver COCHERAS_SEED/BAULERAS_SEED mas abajo) — se dejan aca
// UNICAMENTE como referencia para cuando alguien tenga que reconstruir a
// mano, en la pantalla de admin, que cochera/baulera fisica le corresponde
// a cada unidad (el excel nunca guardo esa referencia por numero de
// espacio, solo el monto ya calculado).
type UnidadSeed = {
  torre: Torre;
  piso: string;
  depto: string;
  titular: string;
  ambientes: string;
  m2: number;
  coeficiente: number;
  cochera?: number;
  baulera?: number;
};

const TORRE_GRANDE: UnidadSeed[] = [
  { torre: "GRANDE", piso: "01", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 184, coeficiente: 0.0189484 },
  { torre: "GRANDE", piso: "01", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "01", depto: "C", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "01", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 184, coeficiente: 0.0189484 },
  { torre: "GRANDE", piso: "02", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "02", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "02", depto: "C", titular: "Tavolaro Pablo", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 47288.01, baulera: 13417.61 },
  { torre: "GRANDE", piso: "02", depto: "D", titular: "Hamer Kevin", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 47288.01, baulera: 22388.72 },
  { torre: "GRANDE", piso: "03", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "03", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "03", depto: "C", titular: "Tajan Carlos", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, baulera: 40181.51 },
  { torre: "GRANDE", piso: "03", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "04", depto: "A", titular: "Dunda Maria Cristina", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, baulera: 22569.28 },
  { torre: "GRANDE", piso: "04", depto: "B", titular: "Venturo Victoria", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 50243.51, baulera: 11822.0 },
  { torre: "GRANDE", piso: "04", depto: "C", titular: "Deluz Maria Alejandra", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 49440.33, baulera: 23407.75 },
  { torre: "GRANDE", piso: "04", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "05", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "05", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "05", depto: "C", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "05", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "06", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "06", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "06", depto: "C", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "06", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "07", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "07", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "07", depto: "C", titular: "Obregon Silvina", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 47288.01, baulera: 13199.09 },
  { torre: "GRANDE", piso: "07", depto: "D", titular: "Manfredini Raul", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 55563.41, baulera: 10779.52 },
  { torre: "GRANDE", piso: "08", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "08", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "08", depto: "C", titular: "Cannizzaro Nestor", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 91050.91, baulera: 14738.1 },
  { torre: "GRANDE", piso: "08", depto: "D", titular: "Gallego Marta", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 49440.33, baulera: 14028.32 },
  { torre: "GRANDE", piso: "09", depto: "A", titular: "Molina Julio", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 47288.01, baulera: 18055.42 },
  { torre: "GRANDE", piso: "09", depto: "B", titular: "Conde Julio", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 47288.01, baulera: 10399.06 },
  { torre: "GRANDE", piso: "09", depto: "C", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "09", depto: "D", titular: "Spinelli Ana Maria", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 55563.41, baulera: 23072.15 },
  { torre: "GRANDE", piso: "10", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "10", depto: "B", titular: "Crispin Rojas", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 91050.91, baulera: 14738.1 },
  { torre: "GRANDE", piso: "10", depto: "C", titular: "Sztrum Sergio", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 49440.33, baulera: 13799.85 },
  { torre: "GRANDE", piso: "10", depto: "D", titular: "Tout International", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 49440.33, baulera: 12809.54 },
  { torre: "GRANDE", piso: "11", depto: "A", titular: "Costa Tranvial", ambientes: "3 Ambientes", m2: 169, coeficiente: 0.0174582 },
  { torre: "GRANDE", piso: "11", depto: "B", titular: "Costa Tranvial", ambientes: "3 Ambientes", m2: 169, coeficiente: 0.0174582 },
  { torre: "GRANDE", piso: "12", depto: "A", titular: "Troyano Ana", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 91050.91, baulera: 18055.42 },
  { torre: "GRANDE", piso: "12", depto: "B", titular: "Lauro Carlos", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 47288.01, baulera: 23596.52 },
  { torre: "GRANDE", piso: "13", depto: "A", titular: "Palomba Alberto", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 91050.91, baulera: 14738.1 },
  { torre: "GRANDE", piso: "13", depto: "B", titular: "Abbraccio Miriam", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 95195.11, baulera: 15408.9 },
  { torre: "GRANDE", piso: "14", depto: "A", titular: "Diez Damian", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 75834.73, baulera: 12360.08 },
  { torre: "GRANDE", piso: "14", depto: "B", titular: "Ialonardi Hugo", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 118993.89, baulera: 16386.47 },
  { torre: "GRANDE", piso: "15", depto: "A", titular: "Carseller Ricardo", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 46350.31, baulera: 16377.11 },
  { torre: "GRANDE", piso: "15", depto: "B", titular: "Iriart Ignacio", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 40181.51, baulera: 16255.38 },
  { torre: "GRANDE", piso: "16", depto: "A", titular: "Pestaña Walter", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 160641.75, baulera: 13053.0 },
  { torre: "GRANDE", piso: "16", depto: "B", titular: "Pierpauli Luis", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 49440.33, baulera: 13817.07 },
  { torre: "GRANDE", piso: "17", depto: "A", titular: "Costa Tranvial", ambientes: "4 Ambientes", m2: 258, coeficiente: 0.0266357 },
  { torre: "GRANDE", piso: "18", depto: "A", titular: "Costa Tranvial", ambientes: "4 Ambientes", m2: 181, coeficiente: 0.0186739 },
  { torre: "GRANDE", piso: "19", depto: "A", titular: "Freindenberg Silvina", ambientes: "4 Ambientes", m2: 181, coeficiente: 0.0186739, cochera: 94576.02, baulera: 27024.38 },
  { torre: "GRANDE", piso: "20", depto: "A", titular: "Gomez Gonzalo", ambientes: "4 Ambientes", m2: 181, coeficiente: 0.0186739, cochera: 259522.41, baulera: 13436.91 },
  { torre: "GRANDE", piso: "21", depto: "A", titular: "Daniel Rigueiro", ambientes: "4 Ambientes", m2: 261, coeficiente: 0.0269298, cochera: 129238.85, baulera: 28728.9 },
];

const TORRE_CHICA: UnidadSeed[] = [
  { torre: "CHICA", piso: "01", depto: "A", titular: "Stagno Jorge", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 45844.67, baulera: 13053.0 },
  { torre: "CHICA", piso: "01", depto: "B", titular: "Monzon Juan Manuel", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 105844.67, baulera: 11461.17 },
  { torre: "CHICA", piso: "02", depto: "A", titular: "Kuhn Guillermo", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49440.33, baulera: 23407.75 },
  { torre: "CHICA", piso: "02", depto: "B", titular: "Schoijet Moises", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49131.33, baulera: 15935.14 },
  { torre: "CHICA", piso: "03", depto: "A", titular: "Rosana D. Andrea", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49440.33, baulera: 13817.07 },
  { torre: "CHICA", piso: "03", depto: "B", titular: "Di Iorio Jorge", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49440.33, baulera: 16255.38 },
  { torre: "CHICA", piso: "04", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "04", depto: "B", titular: "Altuna Eliana", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49440.33, baulera: 10562.25 },
  { torre: "CHICA", piso: "05", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "05", depto: "B", titular: "Sack Ana Maria", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49131.33, baulera: 14279.64 },
  { torre: "CHICA", piso: "06", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "06", depto: "B", titular: "Manuela Rigueiro", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 91050.91 },
  { torre: "CHICA", piso: "07", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "07", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "08", depto: "A", titular: "Peyre Edgardo Jorge", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49131.33, baulera: 15684.2 },
  { torre: "CHICA", piso: "08", depto: "B", titular: "Gutierrez Leoncio", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 66616.73, baulera: 11011.71 },
  { torre: "CHICA", piso: "09", depto: "A", titular: "Gonza Fernando", ambientes: "2 Ambientes", m2: 82, coeficiente: 0.0084623, cochera: 51500.34, baulera: 16476.36 },
  { torre: "CHICA", piso: "09", depto: "B", titular: "Riva Sandra", ambientes: "3 Ambientes", m2: 97, coeficiente: 0.0100444, cochera: 91050.91, baulera: 18055.42 },
  { torre: "CHICA", piso: "10", depto: "A", titular: "Aducci Adriana", ambientes: "2 Ambientes", m2: 82, coeficiente: 0.0084623, cochera: 109440.33, baulera: 12809.54 },
  { torre: "CHICA", piso: "10", depto: "B", titular: "Abdelhadi Leandro", ambientes: "3 Ambientes", m2: 97, coeficiente: 0.0100444, cochera: 49131.33, baulera: 15079.3 },
  { torre: "CHICA", piso: "11", depto: "A", titular: "Iriart Ignacio", ambientes: "2 Ambientes", m2: 82, coeficiente: 0.0084623, cochera: 47288.01, baulera: 22388.72 },
  { torre: "CHICA", piso: "11", depto: "B", titular: "Delfino Graciela", ambientes: "3 Ambientes", m2: 97, coeficiente: 0.0100444, cochera: 52530.35, baulera: 11461.17 },
];

export const COCHERAS_SEED: { planta: string; numero: string; ancho: number; largo: number; m2: number; caracteristica: string }[] = [
  { planta: "01-01", numero: "1", ancho: 4.05, largo: 10.59, m2: 42.8895, caracteristica: "DOBLE" },
  { planta: "01-02", numero: "2", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-03", numero: "3", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-04", numero: "4", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-05", numero: "5", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-06", numero: "6", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-07", numero: "7", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-08", numero: "8", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-09", numero: "9", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-10", numero: "10", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-11", numero: "11", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "01-12", numero: "12", ancho: 3, largo: 10.59, m2: 31.77, caracteristica: "DOBLE" },
  { planta: "01-13", numero: "13", ancho: 2.5, largo: 4.95, m2: 12.375, caracteristica: "SIMPLE" },
  { planta: "01-14", numero: "14", ancho: 2.65, largo: 4.95, m2: 13.1175, caracteristica: "SIMPLE" },
  { planta: "01-15", numero: "15", ancho: 2.65, largo: 4.95, m2: 13.1175, caracteristica: "SIMPLE" },
  { planta: "01-16", numero: "16", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-17", numero: "17", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-18", numero: "18", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-19", numero: "19", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-20", numero: "20", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-21", numero: "21", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-22", numero: "22", ancho: 2.55, largo: 5.5, m2: 14.025, caracteristica: "SIMPLE" },
  { planta: "01-23", numero: "23", ancho: 2.55, largo: 5.5, m2: 14.025, caracteristica: "SIMPLE" },
  { planta: "01-24", numero: "24", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-25", numero: "25", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-26", numero: "26", ancho: 2.82, largo: 5.5, m2: 15.51, caracteristica: "SIMPLE" },
  { planta: "01-27", numero: "27", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-28", numero: "28", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-29", numero: "29", ancho: 4.05, largo: 5.5, m2: 22.275, caracteristica: "DOBLE" },
  { planta: "01-30", numero: "30", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-31", numero: "31", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-32", numero: "32", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-33", numero: "33", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-34", numero: "34", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-35", numero: "35", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-36", numero: "36", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-37", numero: "37", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-38", numero: "38", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-39", numero: "39", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-40", numero: "40", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-41", numero: "41", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "01-42", numero: "42", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-01", numero: "43", ancho: 4.05, largo: 10.59, m2: 42.8895, caracteristica: "DOBLE" },
  { planta: "02-02", numero: "44", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-03", numero: "45", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-04", numero: "46", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-05", numero: "47", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-06", numero: "48", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-07", numero: "49", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-08", numero: "50", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-09", numero: "51", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-10", numero: "52", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-11", numero: "53", ancho: 2.4, largo: 10.59, m2: 25.416, caracteristica: "DOBLE" },
  { planta: "02-12", numero: "54", ancho: 3, largo: 10.59, m2: 31.77, caracteristica: "DOBLE" },
  { planta: "02-13", numero: "55", ancho: 2.5, largo: 5.5, m2: 13.75, caracteristica: "SIMPLE" },
  { planta: "02-14", numero: "56", ancho: 2.65, largo: 4.95, m2: 13.1175, caracteristica: "SIMPLE" },
  { planta: "02-15", numero: "57", ancho: 2.65, largo: 4.95, m2: 13.1175, caracteristica: "SIMPLE" },
  { planta: "02-16", numero: "58", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-17", numero: "59", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-18", numero: "60", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-19", numero: "61", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-20", numero: "62", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-21", numero: "63", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-22", numero: "64", ancho: 2.4, largo: 5.1, m2: 12.24, caracteristica: "SIMPLE" },
  { planta: "02-23", numero: "65", ancho: 2.4, largo: 5.1, m2: 12.24, caracteristica: "SIMPLE" },
  { planta: "02-24", numero: "66", ancho: 3.97, largo: 5.1, m2: 20.247, caracteristica: "SIMPLE" },
  { planta: "02-25", numero: "67", ancho: 2.45, largo: 5.5, m2: 13.475, caracteristica: "SIMPLE" },
  { planta: "02-26", numero: "68", ancho: 2.45, largo: 5.5, m2: 13.475, caracteristica: "SIMPLE" },
  { planta: "02-27", numero: "69", ancho: 2.82, largo: 5.5, m2: 15.51, caracteristica: "SIMPLE" },
  { planta: "02-28", numero: "70", ancho: 2.45, largo: 5.5, m2: 13.475, caracteristica: "SIMPLE" },
  { planta: "02-29", numero: "71", ancho: 2.45, largo: 5.5, m2: 13.475, caracteristica: "SIMPLE" },
  { planta: "02-30", numero: "72", ancho: 4.37, largo: 4.07, m2: 17.7859, caracteristica: "SIMPLE" },
  { planta: "02-31", numero: "73", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-32", numero: "74", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-33", numero: "75", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-34", numero: "76", ancho: 2.4, largo: 5.5, m2: 13.2, caracteristica: "SIMPLE" },
  { planta: "02-35", numero: "77", ancho: 2.4, largo: 4.47, m2: 10.728, caracteristica: "SIMPLE" },
  { planta: "02-36", numero: "78", ancho: 2.4, largo: 4.47, m2: 10.728, caracteristica: "SIMPLE" },
  { planta: "02-37", numero: "79", ancho: 2.4, largo: 4.47, m2: 10.728, caracteristica: "SIMPLE" },
  { planta: "02-38", numero: "80", ancho: 2.4, largo: 4.47, m2: 10.728, caracteristica: "SIMPLE" },
  { planta: "02-39", numero: "81", ancho: 2.4, largo: 4.47, m2: 10.728, caracteristica: "SIMPLE" },
  { planta: "02-40", numero: "82", ancho: 2.4, largo: 5.52, m2: 13.248, caracteristica: "SIMPLE" },
  { planta: "02-41", numero: "83", ancho: 2.4, largo: 5.52, m2: 13.248, caracteristica: "SIMPLE" },
  { planta: "02-42", numero: "84", ancho: 2.4, largo: 5.52, m2: 13.248, caracteristica: "SIMPLE" },
  { planta: "02-43", numero: "85", ancho: 2.4, largo: 5.52, m2: 13.248, caracteristica: "SIMPLE" },
];

export const BAULERAS_SEED: { planta: string; numero: string; ancho: number; largo: number; m2: number }[] = [
  { planta: "01-01", numero: "A", ancho: 1.7, largo: 2.42, m2: 4.114 },
  { planta: "01-02", numero: "B", ancho: 1.7, largo: 2.42, m2: 4.114 },
  { planta: "01-03", numero: "C", ancho: 1.7, largo: 2.42, m2: 4.114 },
  { planta: "01-04", numero: "D", ancho: 1.7, largo: 2.42, m2: 4.114 },
  { planta: "01-05", numero: "E", ancho: 1.7, largo: 2.42, m2: 4.114 },
  { planta: "01-06", numero: "F", ancho: 1.7, largo: 2.42, m2: 4.114 },
  { planta: "01-07", numero: "G", ancho: 1.7, largo: 2.42, m2: 4.114 },
  { planta: "01-08", numero: "H", ancho: 1.7, largo: 2.42, m2: 4.114 },
  { planta: "01-09", numero: "I", ancho: 1.68, largo: 3, m2: 5.04 },
  { planta: "01-10", numero: "J", ancho: 1.68, largo: 3, m2: 5.04 },
  { planta: "01-11", numero: "K", ancho: 1.68, largo: 3, m2: 5.04 },
  { planta: "01-12", numero: "L", ancho: 2.1, largo: 3, m2: 6.3 },
  { planta: "01-13", numero: "M", ancho: 2.65, largo: 1.65, m2: 4.3725 },
  { planta: "01-14", numero: "N", ancho: 2.44, largo: 1.65, m2: 4.026 },
  { planta: "01-15", numero: "Ñ", ancho: 1.25, largo: 3.5, m2: 4.375 },
  { planta: "01-16", numero: "O", ancho: 1.27, largo: 3.35, m2: 4.2545 },
  { planta: "01-17", numero: "P", ancho: 2.35, largo: 1.2, m2: 2.82 },
  { planta: "01-18", numero: "Q", ancho: 2.85, largo: 1.2, m2: 3.42 },
  { planta: "01-19", numero: "R", ancho: 2.52, largo: 2.48, m2: 6.2496 },
  { planta: "01-20", numero: "S", ancho: 2.52, largo: 2.48, m2: 6.2496 },
  { planta: "01-21", numero: "T", ancho: 2.17, largo: 1.7, m2: 3.689 },
  { planta: "01-22", numero: "U", ancho: 2.17, largo: 2, m2: 4.34 },
  { planta: "01-23", numero: "V", ancho: 1.7, largo: 2.55, m2: 4.335 },
  { planta: "01-24", numero: "W", ancho: 1.2, largo: 2.55, m2: 3.06 },
  { planta: "01-25", numero: "X", ancho: 1.2, largo: 2.75, m2: 3.3 },
  { planta: "01-26", numero: "Y", ancho: 1.18, largo: 2.45, m2: 2.891 },
  { planta: "01-27", numero: "Z", ancho: 1.18, largo: 2.55, m2: 3.009 },
  { planta: "01-28", numero: "AA", ancho: 2.24, largo: 2.75, m2: 6.16 },
  { planta: "01-29", numero: "AB", ancho: 2.05, largo: 1.75, m2: 3.5875 },
  { planta: "01-31", numero: "AC", ancho: 2.55, largo: 1.18, m2: 3.009 },
  { planta: "01-32", numero: "AD", ancho: 2.46, largo: 1.18, m2: 2.9028 },
  { planta: "01-33", numero: "AE", ancho: 2.05, largo: 1.7, m2: 3.485 },
  { planta: "01-34", numero: "AF", ancho: 1.22, largo: 3.02, m2: 3.6844 },
  { planta: "01-35", numero: "AG", ancho: 1.22, largo: 3.02, m2: 3.6844 },
  { planta: "01-36", numero: "AH", ancho: 1.22, largo: 3.07, m2: 3.7454 },
  { planta: "01-37", numero: "AI", ancho: 1.22, largo: 3.02, m2: 3.6844 },
  { planta: "01-38", numero: "AJ", ancho: 1.22, largo: 3.07, m2: 3.7454 },
  { planta: "02-01", numero: "AK", ancho: 1.22, largo: 2.95, m2: 3.599 },
  { planta: "02-02", numero: "AL", ancho: 1.63, largo: 2.42, m2: 3.9446 },
  { planta: "02-03", numero: "AM", ancho: 1.65, largo: 2.42, m2: 3.993 },
  { planta: "02-04", numero: "AN", ancho: 1.65, largo: 2.42, m2: 3.993 },
  { planta: "02-05", numero: "AO", ancho: 1.65, largo: 2.42, m2: 3.993 },
  { planta: "02-06", numero: "AP", ancho: 1.65, largo: 2.42, m2: 3.993 },
  { planta: "02-07", numero: "AQ", ancho: 1.65, largo: 2.42, m2: 3.993 },
  { planta: "02-08", numero: "AR", ancho: 1.65, largo: 3, m2: 4.95 },
  { planta: "02-09", numero: "AS", ancho: 1.68, largo: 3, m2: 5.04 },
  { planta: "02-10", numero: "AT", ancho: 1.68, largo: 3, m2: 5.04 },
  { planta: "02-11", numero: "AU", ancho: 2.1, largo: 3, m2: 6.3 },
  { planta: "02-12", numero: "AV", ancho: 2.65, largo: 1.66, m2: 4.399 },
  { planta: "02-13", numero: "AW", ancho: 1.25, largo: 3.05, m2: 3.8125 },
  { planta: "02-14", numero: "AX", ancho: 1.25, largo: 3.35, m2: 4.1875 },
  { planta: "02-15", numero: "AY", ancho: 1.24, largo: 3.5, m2: 4.34 },
  { planta: "02-16", numero: "AZ", ancho: 2.35, largo: 1.2, m2: 2.82 },
  { planta: "02-17", numero: "BA", ancho: 2.85, largo: 1.2, m2: 3.42 },
  { planta: "02-18", numero: "BB", ancho: 2.52, largo: 2.48, m2: 6.2496 },
  { planta: "02-19", numero: "BC", ancho: 2.52, largo: 2.48, m2: 6.2496 },
  { planta: "02-20", numero: "BD", ancho: 2.17, largo: 1.7, m2: 6.2496 },
  { planta: "02-21", numero: "BE", ancho: 2.17, largo: 2, m2: 3.689 },
  { planta: "02-22", numero: "BF", ancho: 1.7, largo: 2.05, m2: 4.34 },
  { planta: "02-23", numero: "BG", ancho: 1.2, largo: 2.55, m2: 3.485 },
  { planta: "02-24", numero: "BH", ancho: 1.2, largo: 2.75, m2: 3.06 },
  { planta: "02-25", numero: "BI", ancho: 1.2, largo: 4.3, m2: 3.3 },
  { planta: "02-26", numero: "BJ", ancho: 1.18, largo: 2.65, m2: 5.16 },
  { planta: "02-27", numero: "BK", ancho: 1.18, largo: 2.55, m2: 3.127 },
  { planta: "02-28", numero: "BL", ancho: 2.25, largo: 2.75, m2: 3.009 },
  { planta: "02-29", numero: "BM", ancho: 2.55, largo: 1.2, m2: 6.1875 },
  { planta: "02-30", numero: "BN", ancho: 1.2, largo: 2.45, m2: 3.06 },
  { planta: "02-31", numero: "BÑ", ancho: 1.2, largo: 4.37, m2: 2.94 },
  { planta: "02-32", numero: "BO", ancho: 1.75, largo: 2.05, m2: 2.94 },
  { planta: "02-33", numero: "BP", ancho: 1.7, largo: 2.05, m2: 3.5875 },
  { planta: "02-34", numero: "BQ", ancho: 2.67, largo: 1.22, m2: 3.485 },
  { planta: "02-35", numero: "BR", ancho: 2.5, largo: 1.22, m2: 3.2574 },
  { planta: "02-36", numero: "BS", ancho: 1.22, largo: 2.5, m2: 3.05 },
  { planta: "02-37", numero: "BT", ancho: 1.22, largo: 2.55, m2: 3.05 },
  { planta: "02-38", numero: "BU", ancho: 1.22, largo: 2.45, m2: 3.111 },
  { planta: "02-39", numero: "BV", ancho: 1.22, largo: 2.5, m2: 2.989 },
  { planta: "02-40", numero: "BW", ancho: 1.22, largo: 2.5, m2: 3.05 },
  { planta: "02-41", numero: "BX", ancho: 1.22, largo: 2.5, m2: 3.05 },
];

async function main() {
  console.log("Creando quinchos...");
  await prisma.quincho.upsert({
    where: { nombre: "Amparo" },
    update: {},
    create: { nombre: "Amparo", capacidad: 12, permitePiscina: false },
  });
  await prisma.quincho.upsert({
    where: { nombre: "Eva" },
    update: {},
    create: { nombre: "Eva", capacidad: 24, permitePiscina: true },
  });
  await prisma.quincho.upsert({
    where: { nombre: "Amado" },
    update: {},
    create: { nombre: "Amado", capacidad: 18, permitePiscina: false },
  });

  console.log("Creando unidades (Torre Grande + Torre Chica)...");
  const todas = [...TORRE_GRANDE, ...TORRE_CHICA];
  for (const u of todas) {
    await prisma.unidad.upsert({
      where: { torre_piso_depto: { torre: u.torre, piso: u.piso, depto: u.depto } },
      update: {},
      create: {
        torre: u.torre,
        piso: u.piso,
        depto: u.depto,
        titular: u.titular,
        ambientes: u.ambientes,
        m2: u.m2,
        coeficiente: u.coeficiente,
      },
    });
  }
  console.log(`${todas.length} unidades creadas/actualizadas.`);

  console.log("Creando la cuenta consolidada de Costa Tranvial (cocheras/bauleras sin asignar)...");
  const consolidada = await prisma.unidad.upsert({
    where: { torre_piso_depto: { torre: "GRANDE", piso: "-", depto: "CONSOLIDADO" } },
    update: { esConsolidadaCocheraBaulera: true, esDesarrollador: true },
    create: {
      torre: "GRANDE",
      piso: "-",
      depto: "CONSOLIDADO",
      titular: "Costa Tranvial (cocheras y bauleras sin asignar)",
      ambientes: "-",
      m2: 0,
      coeficiente: 0,
      esDesarrollador: true,
      esConsolidadaCocheraBaulera: true,
    },
  });

  console.log(`Creando ${COCHERAS_SEED.length} cocheras y ${BAULERAS_SEED.length} bauleras...`);
  // OJO: se cargan todas SIN propietario asignado (unidadId: null), porque
  // el excel nunca guardo la referencia "cochera numero X -> unidad Y", solo
  // el monto ya calculado por unidad (ver el comentario en UnidadSeed mas
  // arriba). Mientras no se reasignen a mano en /admin/cocheras-bauleras,
  // TODAS quedan cobrandose a la cuenta consolidada de Costa Tranvial: no se
  // pierde nada, pero tampoco es todavia la distribucion real entre
  // propietarios.
  for (const c of COCHERAS_SEED) {
    await prisma.cochera.upsert({
      where: { planta_numero: { planta: c.planta, numero: c.numero } },
      update: { ancho: c.ancho, largo: c.largo, m2: c.m2, caracteristica: c.caracteristica },
      create: { ...c, unidadId: null },
    });
  }
  for (const b of BAULERAS_SEED) {
    await prisma.baulera.upsert({
      where: { planta_numero: { planta: b.planta, numero: b.numero } },
      update: { ancho: b.ancho, largo: b.largo, m2: b.m2 },
      create: { ...b, unidadId: null },
    });
  }
  console.log(
    `Listo. Todas las cocheras y bauleras estan sin asignar por ahora: se cobran a "${consolidada.titular}" ` +
      `hasta que se asignen a su propietario real desde /admin/cocheras-bauleras.`
  );

  const adminEmail = process.env.ADMIN_EMAIL || "admin@villagrandas.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "cambiar1234";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      nombre: "Administración Rigueiro",
      rol: "ADMIN",
    },
  });
  console.log(`Usuario admin: ${adminEmail} / ${adminPassword} (cambiar despues del primer login)`);

  console.log("Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
