import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { Catalogo, Ticket } from '../../../core/models/ticket.model';

@Component({
  selector: 'app-mis-tickets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './mis-tickets.component.html',
  styleUrl: './mis-tickets.component.css'
})
export class MisTicketsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  config = inject(ConfiguracionService);
  authService = inject(AuthService);
  tickets = signal<Ticket[]>([]);
  categorias = signal<Catalogo[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  modalAbierto = signal(false);
  enviando = signal(false);
  errorModal = signal<string | null>(null);
  archivos = signal<File[]>([]);
  ticketCreado = signal<Ticket | null>(null);
  eliminando = signal<number | null>(null);

  seleccionarArchivos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nuevos = Array.from(input.files ?? []);
    input.value = '';
    if (this.archivos().length + nuevos.length > 5) { this.errorModal.set('Máximo 5 archivos por carga.'); return; }
    if (nuevos.some(a => !/\.(png|jpe?g)$/i.test(a.name) || !a.size || a.size > 10 * 1024 * 1024)) {
      this.errorModal.set('Selecciona fotos PNG o JPG no vacías de hasta 10 MB cada una.'); return;
    }
    this.errorModal.set(null);
    this.archivos.update(actuales => [...actuales, ...nuevos]);
  }
  quitarArchivo(indice: number): void { this.archivos.update(actuales => actuales.filter((_, i) => i !== indice)); }
  subirEvidencia(ticket: Ticket): void {
    const finalizar = () => {
      this.enviando.set(false);
      this.cerrarModal();
      void this.router.navigate(['/tickets', ticket.id]);
    };
    if (!this.archivos().length) { finalizar(); return; }
    this.enviando.set(true);
    this.ticketService.adjuntar(ticket.id, this.archivos()).subscribe({
      next: finalizar,
      error: () => { this.enviando.set(false); this.errorModal.set('El ticket ya fue creado, pero la evidencia no se subió. Puedes reintentar sin crear otro ticket.'); }
    });
  }

  formulario = this.fb.group({
    asunto: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: ['', [Validators.required]],
    categoriaId: [null as number | null, [Validators.required]]
  });

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService,
    private catalogoService: CatalogoService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params.get('nuevo') === '1') this.abrirModal();
      else if (!this.enviando()) this.modalAbierto.set(false);
    });
    this.cargarSolicitudes();
    this.catalogoService.categorias().subscribe({
      next: (categorias) => this.categorias.set(categorias),
      error: () => this.errorModal.set('No se pudieron cargar las categorías.')
    });
  }

  cargarSolicitudes(): void {
    this.cargando.set(true);
    this.ticketService.listar().subscribe({
      next: (tickets) => {
        this.tickets.set(this.ordenar(tickets));
        this.cargando.set(false);
      },
      error: () => {
        this.mensajeError.set('No se pudieron cargar tus solicitudes.');
        this.cargando.set(false);
      }
    });
  }

  abrirModal(): void {
    this.errorModal.set(null);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    if (this.enviando()) return;
    this.modalAbierto.set(false);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { nuevo: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.errorModal.set(null);
    this.formulario.reset({ asunto: '', descripcion: '', categoriaId: null });
    this.formulario.enable();
    this.archivos.set([]);
    this.ticketCreado.set(null);
  }

  crearTicket(): void {
    if (this.enviando()) return;
    if (this.ticketCreado()) { this.subirEvidencia(this.ticketCreado()!); return; }
    const descripcion = (this.formulario.controls.descripcion.value ?? '').trim();
    if (descripcion.length < this.config.actual().descripcionMinima) {
      this.errorModal.set(`Describe el problema con al menos ${this.config.actual().descripcionMinima} caracteres.`);
      this.formulario.controls.descripcion.markAsTouched();
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errorModal.set('Completa los campos requeridos.');
      return;
    }

    const valor = this.formulario.getRawValue();
    this.enviando.set(true);
    this.errorModal.set(null);
    this.ticketService.crear({
      asunto: valor.asunto!.trim(),
      descripcion,
      categoriaId: valor.categoriaId!
    }).subscribe({
      next: (ticket) => {
        this.tickets.set(this.ordenar([ticket, ...this.tickets()]));
        this.ticketCreado.set(ticket);
        this.formulario.disable();
        this.subirEvidencia(ticket);
      },
      error: () => {
        this.enviando.set(false);
        this.errorModal.set('No se pudo crear el ticket. Intenta nuevamente.');
      }
    });
  }

  contar(...estados: string[]): number {
    return this.tickets().filter((t) => estados.includes(t.estado)).length;
  }

  puedeEliminar(ticket: Ticket): boolean {
    return ticket.estado === 'abierto'
      && ticket.solicitanteId === this.authService.sesionActual()?.usuarioId;
  }

  async eliminarTicket(ticket: Ticket): Promise<void> {
    if (!this.puedeEliminar(ticket) || this.eliminando()) return;
    const resultado = await Swal.fire({
      title: '¿Eliminar ticket?',
      text: `${ticket.codigoUnico} — ${ticket.asunto}. Esta acción es permanente: se borrarán comentarios, historial, fotos y notificaciones. Escribe el código del ticket para confirmar.`,
      input: 'text',
      inputPlaceholder: ticket.codigoUnico,
      inputValidator: (valor) => (valor ?? '').trim().toUpperCase() === ticket.codigoUnico.toUpperCase()
        ? null
        : `Escribe exactamente ${ticket.codigoUnico}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#8c9a91',
      focusCancel: true
    });
    if (!resultado.isConfirmed) return;

    this.mensajeError.set(null);
    this.eliminando.set(ticket.id);
    this.ticketService.eliminar(ticket.id).subscribe({
      next: () => {
        this.tickets.update((lista) => lista.filter((t) => t.id !== ticket.id));
        this.eliminando.set(null);
        void Swal.fire({ icon: 'success', title: 'Ticket eliminado', confirmButtonText: 'Aceptar', confirmButtonColor: '#173346' });
      },
      error: (err) => {
        this.eliminando.set(null);
        this.mensajeError.set(err?.status === 403
          ? 'No tienes permiso para eliminar este ticket.'
          : 'No se pudo eliminar el ticket. Inténtalo nuevamente.');
      }
    });
  }

  fechaPrincipal(ticket: Ticket): string {
    return ticket.fechaUltimaActualizacion || ticket.fechaCreacion;
  }

  claseEstado(estado: string): string { return 'estado estado-' + estado; }
  clasePrioridad(prioridad: string): string { return 'prioridad prioridad-' + prioridad; }

  etiquetaEstado(estado: string): string {
    const mapa: Record<string, string> = {
      abierto: 'Recibido',
      en_progreso: 'En proceso',
      en_espera: 'En espera',
      resuelto: 'Finalizado',
      cerrado: 'Cerrado'
    };
    return mapa[estado] ?? estado;
  }

  etiquetaPrioridad(prioridad: string): string {
    const mapa: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };
    return mapa[prioridad] ?? prioridad;
  }

  private ordenar(tickets: Ticket[]): Ticket[] {
    return [...tickets].sort((a, b) => (b.fechaUltimaActualizacion || b.fechaCreacion).localeCompare(a.fechaUltimaActualizacion || a.fechaCreacion));
  }
}
