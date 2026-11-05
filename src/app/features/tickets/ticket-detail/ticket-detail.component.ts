import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { concat, forkJoin, of, Subscription } from 'rxjs';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { Catalogo, Comentario, HistorialCambio, Ticket } from '../../../core/models/ticket.model';

@Component({ selector: 'app-ticket-detail', standalone: true, imports: [CommonModule, ReactiveFormsModule, RouterLink], templateUrl: './ticket-detail.component.html', styleUrl: './ticket-detail.component.css' })
export class TicketDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(TicketService);
  private catalogos = inject(CatalogoService);
  private usuarios = inject(UsuarioService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  public authService = inject(AuthService);
  public config = inject(ConfiguracionService);
  ticket = signal<Ticket | null>(null);
  comentarios = signal<Comentario[]>([]);
  historial = signal<HistorialCambio[]>([]);
  cargandoHistorial = signal(false);
  errorHistorial = signal('');
  private peticionHistorial?: Subscription;
  cargando = signal(true);
  mensajeError = signal('');
  cargandoComentarios = signal(false);
  errorComentarios = signal('');
  errorEnvio = signal('');
  exitoEnvio = signal('');
  enviandoComentario = signal(false);
  cargandoGestion = signal(false);
  guardandoGestion = signal(false);
  errorGestion = signal('');
  exitoGestion = signal('');
  prioridades = signal<Catalogo[]>([]);
  estados = signal<Catalogo[]>([]);
  tecnicos = signal<Catalogo[]>([]);
  idValido = signal(false);
  private ticketId = 0;
  private peticiones = new Subscription();
  readonly maxComentario = 2000;
  formularioComentario = this.fb.nonNullable.group({ contenido: ['', [Validators.required, Validators.maxLength(this.maxComentario)]] });
  gestion = this.fb.nonNullable.group({ prioridad: [0], estado: [0], tecnico: [0] });
  ordenados = computed(() => [...this.comentarios()].sort((a,b) => (Date.parse(a.fechaCreacion) || 0) - (Date.parse(b.fechaCreacion) || 0) || a.id-b.id));

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.peticiones.unsubscribe(); this.peticiones = new Subscription();
      this.enviandoComentario.set(false); this.guardandoGestion.set(false);
      this.cargandoComentarios.set(false); this.cargandoGestion.set(false);
      this.errorComentarios.set(''); this.errorGestion.set(''); this.exitoGestion.set('');
      this.prioridades.set([]); this.estados.set([]); this.tecnicos.set([]);
      const raw = params.get('id') ?? '';
      this.ticketId = Number(raw);
      this.idValido.set(/^[1-9]\d*$/.test(raw) && Number.isSafeInteger(this.ticketId));
      this.cargar();
    });
  }
  ngOnDestroy(): void { this.peticiones.unsubscribe(); }
  cargar(): void {
    if (this.enviandoComentario() || this.guardandoGestion()) return;
    this.peticiones.unsubscribe(); this.peticiones = new Subscription();
    this.historial.set([]); this.cargandoHistorial.set(false); this.errorHistorial.set('');
    this.ticket.set(null); this.comentarios.set([]); this.mensajeError.set(''); this.errorEnvio.set(''); this.exitoEnvio.set(''); this.formularioComentario.reset();
    if (!this.idValido()) { this.mensajeError.set('El identificador del ticket no es válido.'); this.cargando.set(false); return; }
    this.cargando.set(true);
    this.peticiones.add(this.api.obtener(this.ticketId).subscribe({
      next: t => { this.ticket.set(t); this.cargando.set(false); this.cargarComentarios(); this.cargarHistorial(); if (this.puedeGestionar) this.cargarGestion(); },
      error: err => { this.cargando.set(false); this.mensajeError.set(err.status === 404 ? 'No encontramos este ticket.' : err.status === 403 ? 'No tienes acceso a este ticket.' : 'No se pudo cargar el ticket. Inténtalo nuevamente.'); }
    }));
  }
  cargarComentarios(): void {
    if (!this.ticket() || this.cargandoComentarios() || this.enviandoComentario()) return;
    this.cargandoComentarios.set(true); this.errorComentarios.set('');
    this.peticiones.add(this.api.listarComentarios(this.ticketId).subscribe({
      next: datos => { this.comentarios.set(datos); this.cargandoComentarios.set(false); },
      error: () => { this.cargandoComentarios.set(false); this.errorComentarios.set('No se pudo cargar la conversación.'); }
    }));
  }
  cargarHistorial(): void {
    if (!this.ticket()) return;
    this.peticionHistorial?.unsubscribe();
    this.cargandoHistorial.set(true); this.errorHistorial.set('');
    this.peticionHistorial = this.api.listarHistorial(this.ticketId).subscribe({
      next: datos => { this.historial.set(datos); this.cargandoHistorial.set(false); },
      error: () => { this.cargandoHistorial.set(false); this.errorHistorial.set('No se pudo cargar el historial.'); }
    });
    this.peticiones.add(this.peticionHistorial);
  }
  etiquetaCampo(campo: string): string {
    return ({ estado: 'Estado', prioridad: 'Prioridad', asignado_a: 'Técnico asignado' } as Record<string, string>)[campo] ?? campo;
  }
  valorHistorial(campo: string, valor: string | null): string {
    if (!valor) return 'Sin valor';
    if (campo === 'estado') return this.etiquetaEstado(valor);
    if (campo === 'prioridad') return this.etiquetaPrioridad(valor);
    return valor === 'sin asignar' ? 'Sin asignar' : valor;
  }
  get contenido(): string { return this.formularioComentario.controls.contenido.value; }
  get puedeEnviar(): boolean { return !!this.contenido.trim() && this.formularioComentario.valid && !this.enviandoComentario() && !this.cargandoComentarios() && !this.errorComentarios(); }
  enviarComentario(): void {
    if (!this.puedeEnviar || !this.ticket()) { this.formularioComentario.markAllAsTouched(); return; }
    this.enviandoComentario.set(true); this.errorEnvio.set(''); this.exitoEnvio.set('');
    const contenido = this.contenido.trim();
    this.peticiones.add(this.api.comentar(this.ticketId, contenido).subscribe({
      next: comentario => {
        this.comentarios.update(list => [...list.filter(c => c.id !== comentario.id), comentario]);
        this.formularioComentario.reset(); this.enviandoComentario.set(false); this.exitoEnvio.set('Comentario enviado.');
      },
      error: () => { this.enviandoComentario.set(false); this.errorEnvio.set('No se pudo enviar. Tu texto se conserva para volver a intentarlo.'); }
    }));
  }
  get puedeGestionar(): boolean { return this.puedeAsignar || (this.authService.tieneRol('rol_tecnico') && this.ticket()?.asignadoAId === this.authService.sesionActual()?.usuarioId); }
  get puedeAsignar(): boolean { return this.authService.tieneRol('rol_admin','rol_jefatura'); }
  private normalizar(s: string): string { return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,'_'); }
  private idCatalogo(datos: Catalogo[], nombre: string): number { return datos.find(d => this.normalizar(d.nombre) === this.normalizar(nombre))?.id ?? 0; }
  cargarGestion(): void {
    if (!this.puedeGestionar || this.cargandoGestion() || this.guardandoGestion()) return;
    this.cargandoGestion.set(true); this.errorGestion.set('');
    this.peticiones.add(forkJoin({ prioridades: this.catalogos.prioridades(), estados: this.catalogos.estados(), tecnicos: this.puedeAsignar ? this.usuarios.listarTecnicos() : of([] as Catalogo[]) }).subscribe({
      next: datos => { this.prioridades.set(datos.prioridades); this.estados.set(datos.estados); this.tecnicos.set(datos.tecnicos); this.sincronizarGestion(); this.cargandoGestion.set(false); },
      error: () => { this.cargandoGestion.set(false); this.errorGestion.set('No se pudieron cargar las opciones de gestión.'); }
    }));
  }
  private valoresActuales() {
    const t = this.ticket();
    return { prioridad: this.idCatalogo(this.prioridades(),t?.prioridad ?? ''), estado: this.idCatalogo(this.estados(),t?.estado ?? ''), tecnico: this.idCatalogo(this.tecnicos(),t?.asignadoA ?? '') };
  }
  private sincronizarGestion(): void { this.gestion.reset(this.valoresActuales()); }
  get gestionModificada(): boolean { return JSON.stringify(this.gestion.getRawValue()) !== JSON.stringify(this.valoresActuales()); }
  guardarGestion(): void {
    if (!this.ticket() || !this.puedeGestionar || this.guardandoGestion() || this.cargandoGestion() || !this.gestionModificada) return;
    const anterior = this.valoresActuales(), nuevo = this.gestion.getRawValue();
    const tareas = [];
    if (this.puedeAsignar && nuevo.prioridad && nuevo.prioridad !== anterior.prioridad && this.prioridades().some(p => p.id === nuevo.prioridad)) tareas.push(this.api.actualizarPrioridad(this.ticketId,nuevo.prioridad));
    if (nuevo.tecnico && this.puedeAsignar && nuevo.tecnico !== anterior.tecnico && this.tecnicos().some(t => t.id === nuevo.tecnico)) tareas.push(this.api.asignar(this.ticketId,nuevo.tecnico));
    if (nuevo.estado && nuevo.estado !== anterior.estado && this.estados().some(e => e.id === nuevo.estado)) tareas.push(this.api.actualizarEstado(this.ticketId,nuevo.estado));
    if (!tareas.length) return;
    this.guardandoGestion.set(true); this.errorGestion.set(''); this.exitoGestion.set('');
    let aplicados = 0;
    this.peticiones.add(concat(...tareas).subscribe({
      next: t => { this.ticket.set(t); aplicados++; this.cargarHistorial(); },
      error: () => { this.guardandoGestion.set(false); this.sincronizarGestion(); this.errorGestion.set(aplicados ? 'Se guardó parte de los cambios. Revisa los valores actuales y vuelve a intentar los pendientes.' : 'No se pudo guardar. Selecciona los cambios e inténtalo nuevamente.'); },
      complete: () => { this.guardandoGestion.set(false); this.sincronizarGestion(); this.exitoGestion.set('Cambios guardados.'); }
    }));
  }
  iniciales(nombre: string): string { return nombre.trim().split(/\s+/).slice(0,2).map(p => p[0] || '').join('').toUpperCase(); }
  etiquetaEstado(estado: string): string { return ({abierto:'Abierto',en_progreso:'En progreso',en_espera:'En espera',resuelto:'Resuelto',cerrado:'Cerrado'} as Record<string,string>)[this.normalizar(estado)] ?? estado; }
  etiquetaPrioridad(p: string): string { return this.normalizar(p) === 'critica' ? 'Crítica' : p.charAt(0).toUpperCase() + p.slice(1); }
  hora(valor: string): string { const d = new Date(valor); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}); }
  get estadosPermitidos(): Catalogo[] { const actual = this.ticket()?.estado; return this.estados().filter(e => this.puedeAsignar || e.nombre === actual || (['abierto','en_espera'].includes(actual ?? '') && e.nombre === 'en_progreso') || (actual === 'en_progreso' && e.nombre === 'resuelto')); }
  get volverA(): string { if (this.authService.tieneRol('rol_tecnico')) return '/mi-cola'; return this.authService.tieneRol('rol_solicitante') ? '/mis-tickets' : '/admin/tickets'; }
}
