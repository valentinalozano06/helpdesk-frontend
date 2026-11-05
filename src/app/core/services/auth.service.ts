import { computed, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, UsuarioSesion } from '../models/auth.model';

const CLAVE_SESION = 'helpdesk_sesion_pestana_v1';
interface SesionPestana { token: string; usuario: UsuarioSesion; }

/**
 * Autenticacion en el frontend: guarda el JWT emitido por el backend
 * (fuente unica de verdad de la validacion, ver JwtAuthenticationFilter
 * en el servidor) y expone la sesion actual como signal reactiva para
 * que la UI se adapte al rol sin recargar la pagina.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sesion = signal<SesionPestana | null>(this.leerSesionGuardada());
  readonly sesionActual = computed(() => this.sesion()?.usuario ?? null);

  constructor(private http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, request).pipe(
      tap((resp) => this.guardarSesion(resp))
    );
  }

  logout(): void {
    this.sesion.set(null);
    try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* In-memory session is already cleared. */ }
  }

  obtenerToken(): string | null {
    const token = this.sesion()?.token ?? null;
    if (token && this.tokenExpirado(token)) {
      this.logout();
      return null;
    }
    return token;
  }

  estaAutenticado(): boolean {
    return !!this.obtenerToken();
  }

  tieneRol(...roles: string[]): boolean {
    const sesion = this.sesionActual();
    return !!sesion && roles.includes(sesion.rol);
  }

  /** Roles con panel de administracion (sidebar "Dashboard/Tickets/Usuarios/Reportes/Configuracion"). */
  esPerfilAdministrativo(): boolean {
    return this.tieneRol('rol_admin', 'rol_jefatura');
  }

  /** Ruta de inicio segun el perfil, usada tras el login y por el guard raiz. */
  rutaInicioSegunRol(): string {
    if (this.tieneRol('rol_tecnico')) return '/mi-cola';
    return this.esPerfilAdministrativo() ? '/admin/dashboard' : '/mis-tickets';
  }

  etiquetaRol(): string {
    const etiquetas: Record<string, string> = {
      rol_solicitante: 'Trabajador',
      rol_tecnico: 'Técnico TI',
      rol_jefatura: 'Jefatura TI',
      rol_admin: 'Administrador TI'
    };
    const rol = this.sesionActual()?.rol ?? '';
    return etiquetas[rol] ?? rol;
  }

  private guardarSesion(resp: LoginResponse): void {
    const sesion: SesionPestana = {
      token: resp.token,
      usuario: { usuarioId: resp.usuarioId, nombreCompleto: resp.nombreCompleto, rol: resp.rol }
    };
    // Identity and token always come from the same login response.
    this.sesion.set(sesion);
    try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion)); }
    catch { /* Login still works in memory when storage is unavailable. */ }
  }

  private leerSesionGuardada(): SesionPestana | null {
    // Never migrate the shared token: it may belong to another open account.
    try {
      localStorage.removeItem('helpdesk_token');
      localStorage.removeItem('helpdesk_sesion');
    } catch { /* Shared storage is not required. */ }
    try {
      const raw = sessionStorage.getItem(CLAVE_SESION);
      if (!raw) return null;
      const sesion = JSON.parse(raw) as SesionPestana;
      if (typeof sesion.token !== 'string' || this.tokenExpirado(sesion.token)
        || !Number.isInteger(sesion.usuario?.usuarioId)
        || typeof sesion.usuario?.nombreCompleto !== 'string'
        || typeof sesion.usuario?.rol !== 'string') {
        sessionStorage.removeItem(CLAVE_SESION);
        return null;
      }
      return sesion;
    } catch {
      try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* Storage unavailable. */ }
      return null;
    }
  }

  private tokenExpirado(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }
}

