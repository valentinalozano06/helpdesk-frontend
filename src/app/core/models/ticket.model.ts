export interface Catalogo {
  id: number;
  nombre: string;
}

export interface Ticket {
  id: number;
  codigoUnico: string;
  asunto: string;
  descripcion: string;
  categoria: string;
  prioridad: string;
  estado: string;
  solicitante: string;
  solicitanteId: number;
  asignadoAId: number | null;
  asignadoA: string | null;
  fechaCreacion: string;
  fechaUltimaActualizacion: string | null;
}

export interface NuevoTicket {
  asunto: string;
  descripcion: string;
  categoriaId: number;
}

export interface HistorialCambio {
  id: number;
  usuario: string;
  campoModificado: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  fechaCambio: string;
}

export interface Comentario {
  autorId: number;
  rol: string;
  id: number;
  contenido: string;
  autor: string;
  fechaCreacion: string;
}

export interface Adjunto {
  id: number;
  nombreArchivo: string;
  tipoMime: string;
  tamano: number;
  usuario: string;
  fechaCreacion: string;
}

export interface Escalamiento {
  id: number;
  ticketId: number;
  codigoUnico: string;
  asunto: string;
  solicitante: string;
  tecnico: string;
  categoria: string;
  prioridad: string;
  motivo: string;
  diagnostico: string;
  accionesIntentadas: string;
  estado: 'pendiente' | 'devuelto' | 'no_resuelto';
  decision: string | null;
  decisionPor: string | null;
  fechaCreacion: string;
  fechaDecision: string | null;
  evidencias: EscalamientoEvidencia[];
}

export interface EscalamientoEvidencia {
  id: number;
  nombreArchivo: string;
  tipoMime: string;
  tamano: number;
  usuario: string;
  fechaCreacion: string;
}
