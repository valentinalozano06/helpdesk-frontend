import { Component, DestroyRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { concat, forkJoin, of, Subscription } from 'rxjs';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { Catalogo, Comentario, Ticket, Adjunto } from '../../../core/models/ticket.model';

@Component({ selector: 'app-ticket-detail', standalone: true, imports: [CommonModule, ReactiveFormsModule, RouterLink], templateUrl: './ticket-detail.component.html', styleUrl: './ticket-detail.component.css' })
export class TicketDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(TicketService);
  private catalogos = inject(CatalogoService);
  private usuarios = inject(UsuarioService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);
  vistaPrevia = signal<Adjunto | null>(null);
  cargandoVista = signal(false);
  errorVista = signal('');
  urlImagen = signal('');
  urlPdf = signal<SafeResourceUrl | null>(null);
  miniaturas = signal<Record<number, string>>({});
  private urlVista = '';
  private peticionVista?: Subscription;
  private urlsMiniaturas: string[] = [];
  public authService = inject(AuthService);
  public config = inject(ConfiguracionService);
  ticket = signal<Ticket | null>(null);
  comentarios = signal<Comentario[]>([]);
  adjuntos = signal<Adjunto[]>([]);
  cargandoAdjuntos = signal(false);
  errorAdjuntos = signal('');
  errorEvidencia = signal('');
  exitoEvidencia = signal('');
  enviandoEvidencia = signal(false);
  readonly extensiones = ['png', 'jpg', 'jpeg'];
  readonly maxArchivos = 5;
  readonly maxTamano = 10 * 1024 * 1024;
  cargando = signal(true);
  mensajeError = signal('');
  cargandoComentarios = signal(false);
  errorComentarios = signal('');
  errorEnvio = signal('');
  exitoEnvio = signal('');
  enviandoComentario = signal(false);
  eliminandoTicket = signal(false);
  cargandoGestion = signal(false);
  guardandoGestion = signal(false);
  errorGestion = signal('');
  exitoGestion = signal('');
  prioridades = signal<Catalogo[]>([]);
  estados = signal<Catalogo[]>([]);
  tecnicos = signal<Catalogo[]>([]);
  idValido = signal(false);
  private ticketId = 0;
  private destruido = false;
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
  ngOnDestroy(): void {
    this.destruido = true;
    this.cerrarVistaPrevia(); this.limpiarMiniaturas();
    this.peticiones.unsubscribe();
  }
  cargar(): void {
    if (this.enviandoComentario() || this.guardandoGestion()) return;
    this.cerrarVistaPrevia(); this.limpiarMiniaturas();
    this.peticiones.unsubscribe(); this.peticiones = new Subscription();
    this.adjuntos.set([]); this.cargandoAdjuntos.set(false); this.errorAdjuntos.set('');
    this.errorEvidencia.set(''); this.exitoEvidencia.set(''); this.enviandoEvidencia.set(false);
    this.ticket.set(null); this.comentarios.set([]); this.mensajeError.set(''); this.errorEnvio.set(''); this.exitoEnvio.set(''); this.formularioComentario.reset();
    if (!this.idValido()) { this.mensajeError.set('El identificador del ticket no es válido.'); this.cargando.set(false); return; }
    this.cargando.set(true);
    this.peticiones.add(this.api.obtener(this.ticketId).subscribe({
      next: t => { this.ticket.set(t); this.cargando.set(false); this.cargarComentarios(); this.cargarAdjuntos(); if (this.puedeGestionar) this.cargarGestion(); },
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
  cargarAdjuntos(): void {
    if (!this.ticket() || this.cargandoAdjuntos()) return;
    this.cargandoAdjuntos.set(true); this.errorAdjuntos.set('');
    this.peticiones.add(this.api.listarAdjuntos(this.ticketId).subscribe({
      next: datos => {
        this.adjuntos.set(datos); this.cargandoAdjuntos.set(false);
        this.cargarMiniaturas(datos);
      },
      error: () => { this.cargandoAdjuntos.set(false); this.errorAdjuntos.set('No se pudo cargar la evidencia adjunta.'); }
    }));
  }
  private cargarMiniaturas(datos: Adjunto[]): void {
    const ticketId = this.ticketId;
    for (const adjunto of datos) {
      if (!adjunto.tipoMime.startsWith('image/') || this.miniaturas()[adjunto.id]) continue;
      this.peticiones.add(this.api.descargarAdjunto(adjunto.id).subscribe({
        next: blob => {
          void this.crearMiniatura(blob).then(url => {
            if (this.destruido || this.ticketId !== ticketId) { URL.revokeObjectURL(url); return; }
            this.urlsMiniaturas.push(url);
            this.miniaturas.update(actuales => ({ ...actuales, [adjunto.id]: url }));
          });
        }
        // Si falla, se conserva el ícono de respaldo.
      }));
    }
  }
  private async crearMiniatura(blob: Blob): Promise<string> {
    try {
      const bitmap = await createImageBitmap(blob);
      const escala = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * escala));
      canvas.height = Math.max(1, Math.round(bitmap.height * escala));
      const contexto = canvas.getContext('2d');
      if (!contexto) { bitmap.close(); return URL.createObjectURL(blob); }
      contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const mini = await new Promise<Blob | null>(resolver => canvas.toBlob(resolver, 'image/webp', 0.82));
      return URL.createObjectURL(mini ?? blob);
    } catch {
      return URL.createObjectURL(blob);
    }
  }
  private limpiarMiniaturas(): void {
    this.urlsMiniaturas.forEach(url => URL.revokeObjectURL(url));
    this.urlsMiniaturas = [];
    this.miniaturas.set({});
  }
  get puedeAdjuntar(): boolean {
    const t = this.ticket(); if (!t) return false;
    const uid = this.authService.sesionActual()?.usuarioId;
    return this.authService.tieneRol('rol_solicitante') && t.solicitanteId === uid;
  }
  get puedeEliminar(): boolean {
    const t = this.ticket(); if (!t || this.eliminandoTicket()) return false;
    if (this.authService.tieneRol('rol_admin', 'rol_jefatura')) return true;
    return this.authService.tieneRol('rol_solicitante')
      && t.solicitanteId === this.authService.sesionActual()?.usuarioId
      && t.estado === 'abierto';
  }
  async eliminarTicket(): Promise<void> {
    const t = this.ticket();
    if (!t || !this.puedeEliminar) return;
    const ticketId = this.ticketId;
    const resultado = await Swal.fire({
      title: '¿Eliminar ticket?',
      text: `${t.codigoUnico} — ${t.asunto}. Esta acción es permanente: se borrarán comentarios, historial, fotos y notificaciones. Escribe el código del ticket para confirmar.`,
      input: 'text',
      inputPlaceholder: t.codigoUnico,
      inputValidator: (valor) => (valor ?? '').trim().toUpperCase() === t.codigoUnico.toUpperCase()
        ? null
        : `Escribe exactamente ${t.codigoUnico}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#8c9a91',
      focusCancel: true
    });
    if (!resultado.isConfirmed || this.destruido || this.ticketId !== ticketId || !this.puedeEliminar) return;
    this.eliminandoTicket.set(true);
    this.peticiones.add(this.api.eliminar(t.id).subscribe({
      next: () => {
        this.eliminandoTicket.set(false);
        void Swal.fire({ icon: 'success', title: 'Ticket eliminado', confirmButtonText: 'Aceptar', confirmButtonColor: '#173346' })
          .then(() => { if (!this.destruido) void this.router.navigateByUrl(this.volverA); });
      },
      error: (err) => {
        this.eliminandoTicket.set(false);
        void Swal.fire({
          icon: 'error',
          title: 'No se pudo eliminar',
          text: err?.status === 403 ? 'No tienes permiso para eliminar este ticket.' : 'Inténtalo nuevamente en unos segundos.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#173346'
        });
      }
    }));
  }
  seleccionarEvidencia(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const nuevos = Array.from(input.files ?? []);
    input.value = '';
    if (!nuevos.length) return;
    if (nuevos.length > this.maxArchivos) { this.errorEvidencia.set('Máximo 5 archivos por carga.'); return; }
    this.errorEvidencia.set(''); this.exitoEvidencia.set('');
    for (const archivo of nuevos) {
      const ext = archivo.name.split('.').pop()?.toLowerCase() ?? '';
      if (!this.extensiones.includes(ext)) { this.errorEvidencia.set(`Formato no permitido: ${archivo.name}. Solo fotos PNG o JPG.`); return; }
      if (archivo.size > this.maxTamano) { this.errorEvidencia.set(`${archivo.name} supera los 10 MB permitidos.`); return; }
    }
    if (this.adjuntos().length + nuevos.length > 10) {
      this.errorEvidencia.set('El ticket admite hasta 10 archivos de evidencia en total.');
      return;
    }
    this.adjuntarEvidencia(nuevos);
  }
  adjuntarEvidencia(archivos: File[]): void {
    if (!this.ticket() || this.enviandoEvidencia()) return;
    this.enviandoEvidencia.set(true); this.errorEvidencia.set(''); this.exitoEvidencia.set('');
    this.peticiones.add(this.api.adjuntar(this.ticketId, archivos).subscribe({
      next: datos => {
        this.adjuntos.update(actuales => [...actuales, ...datos]); this.enviandoEvidencia.set(false);
        this.cargarMiniaturas(datos);
        this.exitoEvidencia.set('Evidencia adjuntada.');
      },
      error: () => { this.enviandoEvidencia.set(false); this.errorEvidencia.set('No se pudo subir la evidencia. Verifica tu sesión e inténtalo nuevamente.'); }
    }));
  }
  verAdjunto(adjunto: Adjunto): void {
    this.cerrarVistaPrevia();
    this.vistaPrevia.set(adjunto);
    this.cargandoVista.set(true);
    this.peticionVista = this.api.descargarAdjunto(adjunto.id).subscribe({
      next: blob => {
        const tipo = adjunto.nombreArchivo.toLowerCase().endsWith('.pdf') ? 'application/pdf'
          : adjunto.nombreArchivo.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        this.urlVista = URL.createObjectURL(new Blob([blob], { type: tipo }));
        if (tipo === 'application/pdf') {
          // Solo se confía en la URL blob creada localmente, nunca en una URL del servidor.
          this.urlPdf.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.urlVista));
        } else this.urlImagen.set(this.urlVista);
        this.cargandoVista.set(false);
      },
      error: () => { this.cargandoVista.set(false); this.errorVista.set('No se pudo cargar la vista previa. Inténtalo nuevamente.'); }
    });
  }
  cerrarVistaPrevia(): void {
    this.peticionVista?.unsubscribe();
    this.vistaPrevia.set(null); this.urlImagen.set(''); this.urlPdf.set(null);
    this.cargandoVista.set(false); this.errorVista.set('');
    if (this.urlVista) URL.revokeObjectURL(this.urlVista);
    this.urlVista = '';
  }
  @HostListener('document:keydown.escape')
  cerrarConEscape(): void { if (this.vistaPrevia()) this.cerrarVistaPrevia(); }
  async eliminarAdjunto(adjunto: Adjunto): Promise<void> {
    if (!this.puedeAdjuntar || this.enviandoEvidencia()) return;
    const ticketId = this.ticketId;
    const resultado = await Swal.fire({
      title: '¿Eliminar evidencia?',
      text: `¿Quieres eliminar ${adjunto.nombreArchivo}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e05a5a',
      cancelButtonColor: '#8c9a91',
      focusCancel: true
    });
    if (!resultado.isConfirmed || this.destruido || this.ticketId !== ticketId || !this.puedeAdjuntar || this.enviandoEvidencia()) return;
    this.enviandoEvidencia.set(true);
    this.errorEvidencia.set(''); this.exitoEvidencia.set('');
    this.peticiones.add(this.api.eliminarAdjunto(adjunto.id).subscribe({
      next: () => {
        this.adjuntos.update(actuales => actuales.filter(a => a.id !== adjunto.id));
        const urlMiniatura = this.miniaturas()[adjunto.id];
        if (urlMiniatura) {
          URL.revokeObjectURL(urlMiniatura);
          this.urlsMiniaturas = this.urlsMiniaturas.filter(url => url !== urlMiniatura);
          this.miniaturas.update(actuales => {
            const copia = { ...actuales };
            delete copia[adjunto.id];
            return copia;
          });
        }
        if (this.vistaPrevia()?.id === adjunto.id) this.cerrarVistaPrevia();
        this.enviandoEvidencia.set(false);
        void Swal.fire({ icon: 'success', title: 'Evidencia eliminada', confirmButtonText: 'Aceptar', confirmButtonColor: '#173346' });
      },
      error: () => { this.enviandoEvidencia.set(false); this.errorEvidencia.set('No se pudo eliminar la evidencia.'); }
    }));
  }
  tipoEvidencia(adjunto: Adjunto): string {
    return adjunto.tipoMime.includes('pdf') ? 'pdf' : 'imagen';
  }
  tamanoLegible(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  get contenido(): string { return this.formularioComentario.controls.contenido.value; }
  esMensajePropio(comentario: Comentario): boolean {
    return comentario.autorId === this.authService.sesionActual()?.usuarioId;
  }
  etiquetaRol(rol: string): string {
    const etiquetas: Record<string, string> = {
      rol_solicitante: 'Trabajador',
      rol_tecnico: 'Técnico TI',
      rol_jefatura: 'Jefatura TI',
      rol_admin: 'Administrador TI'
    };
    return etiquetas[rol] ?? rol;
  }
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
      next: t => { this.ticket.set(t); aplicados++; },
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
