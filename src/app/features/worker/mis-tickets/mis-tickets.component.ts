import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TicketService } from '../../../core/services/ticket.service';
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
  tickets = signal<Ticket[]>([]);
  categorias = signal<Catalogo[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  modalAbierto = signal(false);
  enviando = signal(false);
  errorModal = signal<string | null>(null);

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
  }

  crearTicket(): void {
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
        this.enviando.set(false);
        this.cerrarModal();
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