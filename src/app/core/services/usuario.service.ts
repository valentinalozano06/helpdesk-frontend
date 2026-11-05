import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NuevoUsuario, UsuarioAdmin } from '../models/usuario.model';

type EstadoUsuario = 'activo' | 'inactivo';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/usuarios`;

  listar(): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(this.base);
  }

  listarTecnicos(): Observable<{ id: number; nombre: string }[]> {
    return this.http.get<{ id: number; nombre: string }[]>(`${this.base}/tecnicos`);
  }

  crear(usuario: NuevoUsuario): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(this.base, this.normalizarPayload(usuario));
  }

  actualizar(id: number, usuario: NuevoUsuario): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(`${this.base}/${id}`, this.normalizarPayload(usuario, true));
  }

  cambiarEstado(id: number, estado: EstadoUsuario): Observable<UsuarioAdmin> {
    return this.http.patch<UsuarioAdmin>(`${this.base}/${id}/estado`, { estado });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  private normalizarPayload(usuario: NuevoUsuario, passwordOpcional = false): NuevoUsuario {
    const payload: NuevoUsuario = {
      nombres: usuario.nombres.trim(),
      apellidos: usuario.apellidos.trim(),
      email: usuario.email.trim().toLowerCase(),
      password: usuario.password ?? '',
      rol: usuario.rol,
      areaId: usuario.areaId ?? null
    };

    if (passwordOpcional && !(payload.password ?? '').trim()) {
      payload.password = null;
    }

    return payload;
  }
}
