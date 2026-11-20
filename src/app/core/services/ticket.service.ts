import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ConfiguracionService } from './configuracion.service';
import { environment } from '../../../environments/environment';
import { Comentario, HistorialCambio, NuevoTicket, Ticket, Adjunto } from '../models/ticket.model';

/** Consume la API REST de tickets expuesta por TicketController (CE0233). */
@Injectable({ providedIn: 'root' })
export class TicketService {
  private config = inject(ConfiguracionService);
  private readonly base = `${environment.apiUrl}/tickets`;

  constructor(private http: HttpClient) {}

  listar(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(this.base);
  }

  obtener(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.base}/${id}`);
  }

  crear(ticket: NuevoTicket): Observable<Ticket> {
    return this.http.post<Ticket>(this.base, ticket).pipe(tap(t => this.config.notificar('creacion', `Ticket ${t.codigoUnico} creado`)));
  }

  actualizarEstado(id: number, estadoId: number): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.base}/${id}/estado`, { estadoId }).pipe(tap(t => this.config.notificar('cambio', `Ticket ${t.codigoUnico} actualizado`)));
  }

  actualizarCategoria(id: number, categoriaId: number): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.base}/${id}/categoria`, { categoriaId }).pipe(tap(t => this.config.notificar('cambio', `Ticket ${t.codigoUnico} reclasificado`)));
  }

  actualizarPrioridad(id: number, prioridadId: number): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.base}/${id}/prioridad`, { prioridadId }).pipe(tap(t => this.config.notificar('cambio', `Ticket ${t.codigoUnico} actualizado`)));
  }

  asignar(id: number, tecnicoId: number): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.base}/${id}/asignar`, { tecnicoId }).pipe(tap(t => this.config.notificar('cambio', `Ticket ${t.codigoUnico} actualizado`)));
  }

  listarComentarios(id: number): Observable<Comentario[]> {
    return this.http.get<Comentario[]>(`${this.base}/${id}/comentarios`);
  }

  listarHistorial(id: number): Observable<HistorialCambio[]> {
    return this.http.get<HistorialCambio[]>(`${this.base}/${id}/historial`);
  }

  comentar(id: number, contenido: string): Observable<Comentario> {
    return this.http.post<Comentario>(`${this.base}/${id}/comentarios`, { contenido });
  }

  adjuntar(id: number, archivos: File[]): Observable<Adjunto[]> {
    const datos = new FormData();
    archivos.forEach(archivo => datos.append('archivos', archivo, archivo.name));
    return this.http.post<Adjunto[]>(`${this.base}/${id}/adjuntos`, datos);
  }

  listarAdjuntos(id: number): Observable<Adjunto[]> {
    return this.http.get<Adjunto[]>(`${this.base}/${id}/adjuntos`);
  }

  descargarAdjunto(adjuntoId: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/adjuntos/${adjuntoId}/contenido`, { responseType: 'blob' });
  }
  eliminarAdjunto(adjuntoId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/adjuntos/${adjuntoId}`);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(tap(() => this.config.notificar('cambio', 'Ticket eliminado')));
  }
}
