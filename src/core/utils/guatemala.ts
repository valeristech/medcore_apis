/**
 * Valida el formato del CUI (Código Único de Identificación) guatemalteco,
 * conocido también como DPI (Documento Personal de Identificación).
 */
export function isValidCUI(dpi: string): boolean {
  const dpiStr = String(dpi).replace(/\s/g, '');
  if (!/^\d{13}$/.test(dpiStr)) return false;

  const depto = parseInt(dpiStr.substring(9, 11), 10);
  if (depto < 1 || depto > 22) return false;

  const muni = parseInt(dpiStr.substring(11, 13), 10);
  if (muni < 1) return false;

  return true;
}
