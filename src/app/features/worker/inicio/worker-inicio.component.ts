import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TicketService } from '../../../core/services/ticket.service';
import { Ticket } from '../../../core/models/ticket.model';

@Component({
  selector: 'app-worker-inicio',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './worker-inicio.component.html',
  styleUrl: './worker-inicio.component.css'
})
export class WorkerInicioComponent implements OnInit {
  tickets = signal<Ticket[]>([]);
  fechaHoy = this.formatearFechaHoy();

  constructor(public authService: AuthService, private ticketService: TicketService) {}

  private formatearFechaHoy(): string {
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const hoy = new Date();
    return `${dias[hoy.getDay()]}, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;
  }

  ngOnInit(): void {
    this.ticketService.listar().subscribe((tickets) => this.tickets.set(tickets));
  }

  contarPorEstado(estado: string): number {
    return this.tickets().filter((t) => t.estado === estado).length;
  }

  get recientes(): Ticket[] {
    return this.tickets().slice(0, 5);
  }

  claseEstado(estado: string): string { return 'badge-estado badge-estado-' + estado; }
  claseBadge(prioridad: string): string { return 'badge badge-' + prioridad; }
  etiquetaEstado(estado: string): string {
    const mapa: Record<string, string> = {
      abierto: 'Abierto', en_progreso: 'En progreso', en_espera: 'En espera',
      resuelto: 'Resuelto', cerrado: 'Cerrado'
    };
    return mapa[estado] ?? estado;
  }
}
