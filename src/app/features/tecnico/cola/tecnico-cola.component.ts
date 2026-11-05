import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, interval } from 'rxjs';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { Catalogo, Ticket } from '../../../core/models/ticket.model';
@Component({selector:'app-tecnico-cola', standalone:true, imports:[CommonModule,RouterLink], templateUrl:'./tecnico-cola.component.html', styleUrl:'./tecnico-cola.component.css'})
export class TecnicoColaComponent implements OnInit {
 private api=inject(TicketService); private auth=inject(AuthService); private cat=inject(CatalogoService); private destroy=inject(DestroyRef);
 tickets=signal<Ticket[]>([]); estados:Catalogo[]=[]; cargando=signal(false); pendiente=signal<number|null>(null); error=signal(''); tab=signal('asignados'); historial=signal(false);
 private uid=this.auth.sesionActual()?.usuarioId;
 activos=computed(()=>this.tickets().filter(t=>t.asignadoAId===this.uid&&!['resuelto','cerrado'].includes(t.estado)).length);
 visibles=computed(()=>this.tickets().filter(t=>this.tab()==='propios'?t.solicitanteId===this.uid:t.asignadoAId===this.uid&&(this.historial()===['resuelto','cerrado'].includes(t.estado))).sort((a,b)=>this.peso(a.prioridad)-this.peso(b.prioridad)||a.fechaCreacion.localeCompare(b.fechaCreacion)||a.id-b.id));
 ngOnInit(){this.cargar();interval(30000).pipe(takeUntilDestroyed(this.destroy)).subscribe(()=>{if(!document.hidden)this.cargar();});}
 @HostListener('window:focus') @HostListener('document:visibilitychange') visible(){if(!document.hidden)this.cargar();}
 cargar(){if(this.cargando()||this.pendiente()!==null)return;this.cargando.set(true);forkJoin({tickets:this.api.listar(),estados:this.cat.estados()}).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>{this.tickets.set(r.tickets);this.estados=r.estados;this.error.set('');this.cargando.set(false);},error:()=>{this.error.set('No se pudo actualizar la cola. Inténtalo nuevamente.');this.cargando.set(false);}});}
 accion(t:Ticket){return t.asignadoAId!==this.uid?'':['abierto','en_espera'].includes(t.estado)?'Iniciar':t.estado==='en_progreso'?'Completar':'';}
 cambiar(t:Ticket){if(this.pendiente()!==null||this.cargando()||!this.accion(t))return;const estado=this.estados.find(e=>e.nombre===(t.estado==='en_progreso'?'resuelto':'en_progreso'));if(!estado){this.error.set('No se encontró el estado. Actualiza la cola.');return;}this.pendiente.set(t.id);this.api.actualizarEstado(t.id,estado.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>{this.tickets.update(ts=>ts.map(x=>x.id===r.id?r:x));this.pendiente.set(null);this.cargar();},error:()=>{this.pendiente.set(null);this.error.set('No se pudo cambiar el estado. El ticket podría haber sido reasignado; actualiza la cola.');}});}
 etiqueta(s:string){return ({en_progreso:'En progreso',en_espera:'En espera',abierto:'Abierto',resuelto:'Resuelto',cerrado:'Cerrado'} as Record<string,string>)[s]||s;}
 private peso(s:string){return ({critica:0,alta:1,media:2,baja:3} as Record<string,number>)[s]??4;}
}
