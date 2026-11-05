import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TicketService } from '../../../core/services/ticket.service';
import { Ticket } from '../../../core/models/ticket.model';

@Component({
  selector: 'app-admin-dashboard', standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  tickets = signal<Ticket[]>([]);
  cargando = signal(true);
  error = signal(false);
  actualizado = signal(new Date());
  busqueda = signal('');
  fechaHoy = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  estados = [
    { id: 'abierto', nombre: 'Abiertos', tono: 'coral', icono: 'circle', detalle: 'Listos para atender' },
    { id: 'en_progreso', nombre: 'En progreso', tono: 'blue', icono: 'clock', detalle: 'Soluciones en marcha' },
    { id: 'en_espera', nombre: 'En espera', tono: 'amber', icono: 'pause', detalle: 'Pendientes de continuar' },
    { id: 'resuelto', nombre: 'Resueltos', tono: 'green', icono: 'check', detalle: 'Un paso más adelante' }
  ];
  distribucion = computed(() => [...this.estados, { id: 'cerrado', nombre: 'Cerrados', tono: 'muted' }]
    .map(e => ({ ...e, cantidad: this.contarPorEstado(e.id), porcentaje: this.tickets().length ? this.contarPorEstado(e.id) / this.tickets().length * 100 : 0 })));
  sinAsignar = computed(() => this.tickets().filter(t => this.activo(t) && !t.asignadoA?.trim()).length);
  atencion = computed(() => this.tickets().filter(t => this.activo(t) && (!t.asignadoA?.trim() || ['critica', 'alta'].includes(t.prioridad)))
    .sort((a, b) => this.peso(b) - this.peso(a) || this.fecha(a) - this.fecha(b)));
  recientes = computed(() => {
    const q = this.busqueda().trim().toLocaleLowerCase('es');
    return [...this.tickets()].filter(t => !q || [t.asunto, t.codigoUnico, t.solicitante, t.asignadoA ?? ''].some(v => v.toLocaleLowerCase('es').includes(q)))
      .sort((a, b) => this.fecha(b) - this.fecha(a) || b.id - a.id).slice(0, 6);
  });
  actividad = computed(() => {
    const hoy = this.actualizado();
    const dias = Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6 + i);
      const fin = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1);
      const cantidad = this.tickets().filter(t => { const ms = this.fecha(t); return ms >= +fecha && ms < +fin; }).length;
      return { etiqueta: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(fecha).replace('.', ''), fecha: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(fecha), cantidad, hoy: i === 6 };
    });
    const maximo = Math.max(1, ...dias.map(d => d.cantidad));
    return dias.map(d => ({ ...d, altura: d.cantidad / maximo * 100 }));
  });
  totalSemana = computed(() => this.actividad().reduce((s, d) => s + d.cantidad, 0));

  constructor(private ticketService: TicketService) {}
  ngOnInit(): void { this.cargar(); }
  cargar(): void {
    this.cargando.set(true); this.error.set(false);
    this.ticketService.listar().subscribe({
      next: tickets => { this.tickets.set(tickets); this.actualizado.set(new Date()); this.cargando.set(false); },
      error: () => { this.error.set(true); this.cargando.set(false); }
    });
  }
  contarPorEstado(estado: string): number { return this.tickets().filter(t => t.estado === estado).length; }
  etiquetaEstado(estado: string): string { return ({ abierto: 'Abierto', en_progreso: 'En progreso', en_espera: 'En espera', resuelto: 'Resuelto', cerrado: 'Cerrado' } as Record<string, string>)[estado] ?? estado; }
  iniciales(nombre: string): string { return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase(); }
  private activo(t: Ticket): boolean { return !['resuelto', 'cerrado'].includes(t.estado); }
  private peso(t: Ticket): number { return (t.prioridad === 'critica' ? 6 : t.prioridad === 'alta' ? 3 : 0) + (!t.asignadoA?.trim() ? 1 : 0); }
  private fecha(t: Ticket): number { const n = Date.parse(t.fechaCreacion); return Number.isFinite(n) ? n : 0; }
}
