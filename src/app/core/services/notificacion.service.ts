import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
export interface Notificacion { id:number; tipoEvento:string; mensaje:string; leida:boolean; fechaCreacion:string; ticketId:number|null; }
export interface Bandeja { items:Notificacion[]; noLeidas:number; }
@Injectable({providedIn:'root'})
export class NotificacionService {
 private http=inject(HttpClient); private base=environment.apiUrl+'/notificaciones';
 listar(){return this.http.get<Bandeja>(this.base);}
 marcarLeida(id:number){return this.http.patch<Notificacion>(this.base+'/'+id+'/leida',{});}
 leerTodas(){return this.http.post<Bandeja>(this.base+'/leer-todas',{});}
}
