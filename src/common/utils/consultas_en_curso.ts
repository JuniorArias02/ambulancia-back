/**
 * Dos solicitudes simultáneas con la misma clave comparten una sola consulta:
 * evita pagarle dos veces al proveedor por lo mismo (doble clic, reintentos).
 */
export class ConsultasEnCurso<T> {
  private readonly enCurso = new Map<string, Promise<T>>();

  ejecutar(clave: string, consulta: () => Promise<T>): Promise<T> {
    const existente = this.enCurso.get(clave);
    if (existente) return existente;

    const nueva = consulta().finally(() => this.enCurso.delete(clave));
    this.enCurso.set(clave, nueva);
    return nueva;
  }
}
