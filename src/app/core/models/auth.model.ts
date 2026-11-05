export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  tipo: string;
  usuarioId: number;
  nombreCompleto: string;
  rol: string;
  expiraEnMs: number;
}

export interface UsuarioSesion {
  usuarioId: number;
  nombreCompleto: string;
  rol: string; // rol_solicitante | rol_tecnico | rol_jefatura | rol_admin
}
