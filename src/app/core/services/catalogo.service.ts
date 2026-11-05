import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Catalogo } from '../models/ticket.model';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly base = `${environment.apiUrl}/catalogos`;

  constructor(private http: HttpClient) {}

  categorias(): Observable<Catalogo[]> { return this.http.get<Catalogo[]>(`${this.base}/categorias`); }
  prioridades(): Observable<Catalogo[]> { return this.http.get<Catalogo[]>(`${this.base}/prioridades`); }
  estados(): Observable<Catalogo[]> { return this.http.get<Catalogo[]>(`${this.base}/estados`); }
  areas(): Observable<Catalogo[]> { return this.http.get<Catalogo[]>(`${this.base}/areas`); }
}
