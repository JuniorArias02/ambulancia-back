/** Configuración que necesita la aplicación (no la de cada proveedor). */
export abstract class ConfiguracionGeocodificacion {
  /** Código ISO del país al que se restringen las búsquedas; forma parte de la clave de la caché. */
  abstract readonly pais: string | null;
  /**
   * Se usa cuando la solicitud no trae ciudad. Sin ella, la ciudad es
   * obligatoria: "Calle 10 # 5-20" existe en cientos de municipios.
   */
  abstract readonly ciudadPredeterminada: string | null;
  /**
   * En la geocodificación inversa, hasta qué distancia del punto la calle
   * encontrada todavía describe el lugar; más lejos, solo se informa la zona.
   */
  abstract readonly distanciaMaximaInversaMetros: number;
}
