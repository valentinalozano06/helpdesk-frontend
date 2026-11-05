export interface UsuarioAdmin {
  id: number;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  email: string;
  area: string | null;
  rol: string; // rol_solicitante | rol_tecnico | rol_jefatura | rol_admin
  estado: string; // activo | inactivo
}

export interface NuevoUsuario {
  nombres: string;
  apellidos: string;
  email: string;
  password?: string | null;
  rol: string;
  areaId?: number | null;
}
