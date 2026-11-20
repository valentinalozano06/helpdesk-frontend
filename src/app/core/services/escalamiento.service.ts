import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Escalamiento, EscalamientoEvidencia } from '../models/ticket.model';

@Injectable({ providedIn: 'root' })
export class EscalamientoService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/escalamientos`;

  solicitar(ticketId: number, motivo: string, diagnostico: string, accionesIntentadas: string): Observable<Escalamiento> {
    return this.http.post<Escalamiento>(`${environment.apiUrl}/tickets/${ticketId}/escalamientos`, { motivo, diagnostico, accionesIntentadas });
  }
  pendientes(): Observable<Escalamiento[]> { return this.http.get<Escalamiento[]>(`${this.base}/pendientes`); }
  ultimoDeTicket(ticketId: number): Observable<Escalamiento | null> { return this.http.get<Escalamiento | null>(`${environment.apiUrl}/tickets/${ticketId}/escalamientos/ultimo`); }
  subirEvidencias(id: number, archivos: File[]): Observable<EscalamientoEvidencia[]> {
    const datos = new FormData(); archivos.forEach(a => datos.append('archivos', a, a.name));
    return this.http.post<EscalamientoEvidencia[]>(`${this.base}/${id}/evidencias`, datos);
  }
  descargarEvidencia(id: number): Observable<Blob> { return this.http.get(`${this.base}/evidencias/${id}/contenido`, { responseType: 'blob' }); }
  decidir(id: number, accion: 'devolver' | 'reasignar' | 'no_resuelto', decision: string, tecnicoId?: number): Observable<Escalamiento> {
    return this.http.post<Escalamiento>(`${this.base}/${id}/decision`, { accion, decision, tecnicoId });
  }
}
