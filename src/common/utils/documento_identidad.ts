/**
 * "1.090.123-456", "1090 123 456" y "1090123456" son el mismo documento. La
 * usan el registro y el inicio de sesión de ciudadanos para comparar igual.
 */
export function normalizarNumeroDocumento(numero: string): string {
  return numero.replace(/[\s.-]/g, '').toUpperCase();
}
