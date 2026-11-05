import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { inject, Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Catalogo, Ticket } from '../../../core/models/ticket.model';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { TicketService } from '../../../core/services/ticket.service';
import { UsuarioService } from '../../../core/services/usuario.service';

/** Pantalla "Gestion de Tickets" del panel admin: tabla completa con filtros. */
@Component({
  selector: 'app-admin-tickets',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-tickets.component.html',
  styleUrl: './admin-tickets.component.css'
})
export class AdminTicketsComponent implements OnInit {
  config = inject(ConfiguracionService);
  tickets = signal<Ticket[]>([]);
  prioridades = signal<Catalogo[]>([]);
  estados = signal<Catalogo[]>([]);
  tecnicos = signal<Catalogo[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  actualizandoPrioridad = signal<number | null>(null);
  actualizandoEstado = signal<number | null>(null);
  asignandoTecnico = signal<number | null>(null);

  busqueda = signal('');
  filtroEstado = signal('');
  filtroPrioridad = signal('');
  filtroCategoria = signal('');

  constructor(
    private ticketService: TicketService,
    private catalogoService: CatalogoService,
    private usuarioService: UsuarioService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarTickets();
    this.catalogoService.prioridades().subscribe({
      next: (prioridades) => this.prioridades.set(prioridades),
      error: () => this.mensajeError.set('No se pudieron cargar las prioridades.')
    });
    this.catalogoService.estados().subscribe({
      next: (estados) => this.estados.set(estados),
      error: () => this.mensajeError.set('No se pudieron cargar los estados.')
    });
    if (this.puedeAsignar()) {
      this.usuarioService.listarTecnicos().subscribe({
        next: (tecnicos) => this.tecnicos.set(tecnicos),
        error: () => this.mensajeError.set('No se pudieron cargar los tecnicos.')
      });
    }
  }

  categoriasDisponibles = computed(() => {
    const set = new Set(this.tickets().map((t) => t.categoria));
    return Array.from(set);
  });

  filtrados = computed(() => {
    const texto = this.busqueda().toLowerCase().trim();
    return this.tickets().filter((t) => {
      const coincideTexto = !texto ||
        t.codigoUnico.toLowerCase().includes(texto) ||
        t.asunto.toLowerCase().includes(texto) ||
        t.solicitante.toLowerCase().includes(texto);
      const coincideEstado = !this.filtroEstado() || t.estado === this.filtroEstado();
      const coincidePrioridad = !this.filtroPrioridad() || t.prioridad === this.filtroPrioridad();
      const coincideCategoria = !this.filtroCategoria() || t.categoria === this.filtroCategoria();
      return coincideTexto && coincideEstado && coincidePrioridad && coincideCategoria;
    });
  });

  iniciales(nombre: string): string {
    return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
  }

  limpiarFiltros(): void {
    this.busqueda.set(''); this.filtroEstado.set(''); this.filtroPrioridad.set(''); this.filtroCategoria.set('');
  }

  puedeAsignar(): boolean {
    return this.authService.tieneRol('rol_admin', 'rol_jefatura');
  }

  actualizarPrioridad(ticket: Ticket, evento: Event): void {
    const prioridadId = Number((evento.target as HTMLSelectElement).value);
    if (!prioridadId) return;

    this.mensajeError.set(null);
    this.actualizandoPrioridad.set(ticket.id);
    this.ticketService.actualizarPrioridad(ticket.id, prioridadId).subscribe({
      next: (actualizado) => {
        this.reemplazarTicket(actualizado);
        this.actualizandoPrioridad.set(null);
      },
      error: () => {
        this.mensajeError.set('No se pudo actualizar la prioridad del ticket.');
        this.actualizandoPrioridad.set(null);
      }
    });
  }

  actualizarEstado(ticket: Ticket, evento: Event): void {
    const estadoId = Number((evento.target as HTMLSelectElement).value);
    if (!estadoId) return;

    this.mensajeError.set(null);
    this.actualizandoEstado.set(ticket.id);
    this.ticketService.actualizarEstado(ticket.id, estadoId).subscribe({
      next: (actualizado) => {
        this.reemplazarTicket(actualizado);
        this.actualizandoEstado.set(null);
      },
      error: () => {
        this.mensajeError.set('No se pudo actualizar el estado del ticket.');
        this.actualizandoEstado.set(null);
      }
    });
  }

  asignarTecnico(ticket: Ticket, evento: Event): void {
    const tecnicoId = Number((evento.target as HTMLSelectElement).value);
    if (!tecnicoId) return;

    this.mensajeError.set(null);
    this.asignandoTecnico.set(ticket.id);
    this.ticketService.asignar(ticket.id, tecnicoId).subscribe({
      next: (actualizado) => {
        this.reemplazarTicket(actualizado);
        this.asignandoTecnico.set(null);
      },
      error: () => {
        this.mensajeError.set('No se pudo asignar el tecnico al ticket.');
        this.asignandoTecnico.set(null);
      }
    });
  }

  prioridadIdActual(nombre: string): number | '' {
    return this.prioridades().find((p) => p.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? '';
  }

  estadoIdActual(nombre: string): number | '' {
    return this.estados().find((e) => e.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? '';
  }

  tecnicoIdActual(nombre: string | null): number | '' {
    if (!nombre) return '';
    return this.tecnicos().find((t) => t.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? '';
  }

  etiquetaEstado(estado: string): string {
    const mapa: Record<string, string> = {
      abierto: 'Abierto', en_progreso: 'En progreso', en_espera: 'En espera',
      resuelto: 'Resuelto', cerrado: 'Cerrado'
    };
    return mapa[estado] ?? estado;
  }

  private cargarTickets(): void {
    this.ticketService.listar().subscribe({
      next: (tickets) => {
        this.tickets.set(tickets);
        this.cargando.set(false);
      },
      error: () => {
        this.mensajeError.set('No se pudieron cargar los tickets.');
        this.cargando.set(false);
      }
    });
  }

  private reemplazarTicket(actualizado: Ticket): void {
    this.tickets.update((tickets) => tickets.map((t) => t.id === actualizado.id ? actualizado : t));
  }
}