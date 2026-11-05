export interface Configuracion {
  version: 1;
  nombre: string;
  institucion: string;
  nombreCorto: string;
  soporte: string;
  logo: string;
  formatoFecha: 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';
  acento: 'lima' | 'menta' | 'cielo';
  animaciones: boolean;
  compacto: boolean;
  sidebarColapsado: boolean;
  slaActivo: boolean;
  slaHoras: { baja: number; media: number; alta: number; critica: number };
  descripcionMinima: number;
  avisarCreacion: boolean;
  avisarCambios: boolean;
  duracionAviso: number;
  inactividad: number;
  confirmarSalida: boolean;
}
export const CONFIG_INICIAL: Configuracion = {
  version: 1, nombre: 'helpdesk', institucion: 'Municipalidad Distrital de Morales', nombreCorto: 'Muni Morales', soporte: '', logo: '',
  formatoFecha: 'dd/MM/yyyy', acento: 'lima', animaciones: true, compacto: false, sidebarColapsado: false,
  slaActivo: false, slaHoras: { baja: 72, media: 24, alta: 8, critica: 2 }, descripcionMinima: 1,
  avisarCreacion: true, avisarCambios: true, duracionAviso: 4, inactividad: 0, confirmarSalida: false
};
export const CONFIG_KEY = 'helpdesk_configuracion_v1';
export const copiaInicial = (): Configuracion => structuredClone(CONFIG_INICIAL);
export function validarConfiguracion(value: unknown): Configuracion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('El archivo no contiene una configuración válida.');
  const v = value as Record<string, unknown>;
  if (v['version'] !== 1) throw new Error('Versión de configuración incompatible.');
  const texto = (key: string, max: number, obligatorio = true) => {
    const s = v[key]; if (typeof s !== 'string' || s.length > max || (obligatorio && !s.trim())) throw new Error(`Revisa el campo ${key}.`);
    return s.trim();
  };
  const numero = (key: string, min: number, max: number) => {
    const n = v[key]; if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new Error(`Valor inválido: ${key}.`); return n;
  };
  const booleano = (key: string) => { if (typeof v[key] !== 'boolean') throw new Error(`Valor inválido: ${key}.`); return v[key] as boolean; };
  const opcion = <T extends string>(key: string, opciones: readonly T[]): T => { if (!opciones.includes(v[key] as T)) throw new Error(`Opción inválida: ${key}.`); return v[key] as T; };
  const soporte = texto('soporte', 120, false);
  if (soporte && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(soporte)) throw new Error('Ingresa un correo de soporte válido.');
  const logo = texto('logo', 700000, false);
  if (logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(logo)) throw new Error('El logo debe ser una imagen PNG, JPG o WebP.');
  const horas = v['slaHoras'] as Record<string, unknown>;
  if (!horas || typeof horas !== 'object') throw new Error('Revisa los plazos SLA.');
  for (const k of ['baja','media','alta','critica']) if (typeof horas[k] !== 'number' || !Number.isInteger(horas[k]) || (horas[k] as number) < 1 || (horas[k] as number) > 720) throw new Error('Los plazos SLA deben ser de 1 a 720 horas.');
  if (!(Number(horas['critica']) <= Number(horas['alta']) && Number(horas['alta']) <= Number(horas['media']) && Number(horas['media']) <= Number(horas['baja']))) throw new Error('Una prioridad mayor debe tener un plazo igual o menor.');
  const inactividad = numero('inactividad', 0, 120);
  if (![0, 5, 15, 30, 60, 120].includes(inactividad)) throw new Error('Selecciona un tiempo de inactividad válido.');
  return { version: 1, nombre: texto('nombre', 24), institucion: texto('institucion', 90), nombreCorto: texto('nombreCorto', 28), soporte, logo,
    formatoFecha: opcion('formatoFecha', ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']), acento: opcion('acento', ['lima','menta','cielo']),
    animaciones: booleano('animaciones'), compacto: booleano('compacto'), sidebarColapsado: booleano('sidebarColapsado'), slaActivo: booleano('slaActivo'),
    slaHoras: { baja: Number(horas['baja']), media: Number(horas['media']), alta: Number(horas['alta']), critica: Number(horas['critica']) },
    descripcionMinima: numero('descripcionMinima', 1, 200), avisarCreacion: booleano('avisarCreacion'), avisarCambios: booleano('avisarCambios'),
    duracionAviso: numero('duracionAviso', 2, 10), inactividad, confirmarSalida: booleano('confirmarSalida') };
}
export function calcularSla(t: { estado: string; prioridad: string; fechaCreacion: string }, c: Configuracion, ahora: number): { texto: string; vencido: boolean; limite: string } {
  if (!c.slaActivo) return { texto: '', vencido: false, limite: '' };
  if (['resuelto', 'cerrado'].includes(t.estado)) return { texto: 'Finalizado', vencido: false, limite: '' };
  const horas = c.slaHoras[t.prioridad as keyof Configuracion['slaHoras']];
  const inicio = Date.parse(t.fechaCreacion);
  if (!horas || !Number.isFinite(inicio)) return { texto: 'Sin plazo', vencido: false, limite: '' };
  const limite = inicio + horas * 3600000;
  const minutos = Math.max(1, Math.ceil(Math.abs(limite - ahora) / 60000));
  const tiempo = minutos < 60 ? `${minutos} min` : `${Math.ceil(minutos / 60)} h`;
  return { texto: limite <= ahora ? `Vencido · ${tiempo}` : `Restan ${tiempo}`, vencido: limite <= ahora, limite: new Date(limite).toISOString() };
}