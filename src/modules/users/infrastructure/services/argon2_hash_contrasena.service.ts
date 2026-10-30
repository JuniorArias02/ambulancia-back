import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { HashContrasena } from '../../domain/services/hash_contrasena.service.js';

@Injectable()
export class Argon2HashContrasena extends HashContrasena {
  generar(contrasena: string): Promise<string> {
    return argon2.hash(contrasena, { type: argon2.argon2id });
  }

  async verificar(hash: string, contrasena: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, contrasena);
    } catch {
      // Un hash con formato inválido equivale a credenciales incorrectas.
      return false;
    }
  }
}
