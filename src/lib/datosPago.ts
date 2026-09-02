// Datos de la cuenta bancaria del consorcio, usados para mostrarle a los
// propietarios como transferir (alias/CVU copiables + QR de conveniencia)
// en su cuenta corriente. Se cargan por variable de entorno para no tener
// datos bancarios reales hardcodeados en el codigo.
export type DatosPago = {
    titular: string;
    cuit: string;
    banco: string;
    cvu: string;
    alias: string;
};

export function getDatosPago(): DatosPago {
    return {
          titular: process.env.CONSORCIO_TITULAR || "",
          cuit: process.env.CONSORCIO_CUIT || "",
          banco: process.env.CONSORCIO_BANCO || "",
          cvu: process.env.CONSORCIO_CVU || "",
          alias: process.env.CONSORCIO_ALIAS || "",
    };
}

// Con que haya alias o CVU alcanza para mostrar la tarjeta de pago.
export function datosPagoCompletos(datos: DatosPago): boolean {
    return Boolean(datos.alias || datos.cvu);
}
