export abstract class HashContrasena {
  abstract generar(contrasena: string): Promise<string>;
  abstract verificar(hash: string, contrasena: string): Promise<boolean>;
}
