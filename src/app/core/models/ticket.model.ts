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
  id: number;
  contenido: string;
  autor: string;
  fechaCreacion: string;
}
