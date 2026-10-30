export interface Paginacion {
  pagina: number;
  limite: number;
}

export interface ResultadoPaginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}
