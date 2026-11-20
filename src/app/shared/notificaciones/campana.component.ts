import { Component, DestroyRef, ElementRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, interval } from 'rxjs';
import { Notificacion, NotificacionService } from '../../core/services/notificacion.service';

@Component({
  selector: 'app-campana',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campana.component.html',
  styleUrl: './campana.component.css'
})
export class CampanaComponent implements OnInit {
  private api = inject(NotificacionService);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private el = inject(ElementRef);

  abierta = signal(false);
  items = signal<Notificacion[]>([]);
  noLeidas = signal(0);
  cargando = signal(false);
  guardando = signal(false);
  error = signal('');

  ngOnInit() {
    this.cargar();
    interval(30000).pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (!document.hidden) this.cargar();
    });
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.abierta.set(false);
      this.cargar();
    });
  }

  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  visible() { if (!document.hidden) this.cargar(); }

  @HostListener('document:click', ['$event'])
  fuera(e: MouseEvent) { if (!this.el.nativeElement.contains(e.target)) this.abierta.set(false); }

  @HostListener('keydown.escape')
  cerrar() { this.abierta.set(false); this.el.nativeElement.querySelector('.campana')?.focus(); }

  toggle() { this.abierta.update(v => !v); if (this.abierta()) this.cargar(); }

  cargar() {
    if (this.cargando() || this.guardando()) return;
    this.cargando.set(true);
    this.api.listar().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: r => { this.items.set(r.items); this.noLeidas.set(r.noLeidas); this.error.set(''); this.cargando.set(false); },
      error: () => { this.error.set('No se pudieron actualizar las notificaciones.'); this.cargando.set(false); }
    });
  }

  abrir(n: Notificacion) {
    if (this.guardando() || this.cargando()) return;
    if (n.leida) { this.ir(n); return; }
    this.guardando.set(true);
    this.api.marcarLeida(n.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: r => {
        this.items.update(xs => xs.map(x => x.id === r.id ? r : x));
        this.noLeidas.update(v => Math.max(0, v - 1));
        this.guardando.set(false);
        this.ir(r);
        this.cargar();
      },
      error: () => { this.guardando.set(false); this.error.set('No se pudo marcar como leída. Vuelve a intentarlo.'); }
    });
  }

  todas() {
    if (this.guardando() || this.cargando() || !this.noLeidas()) return;
    this.guardando.set(true);
    this.api.leerTodas().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: r => { this.items.set(r.items); this.noLeidas.set(r.noLeidas); this.guardando.set(false); this.error.set(''); },
      error: () => { this.guardando.set(false); this.error.set('No se pudieron marcar las notificaciones.'); }
    });
  }

  private ir(n: Notificacion) {
    if (n.ticketId) {
      this.abierta.set(false);
      void this.router.navigate(['/tickets', n.ticketId]);
    }
  }

  tipo(n: Notificacion) {
    return ({
      ticket_asignado: 'Nueva asignación',
      ticket_creado: 'Ticket creado',
      ticket_resuelto: 'Ticket finalizado',
      ticket_comentado: 'Nuevo comentario',
      escalamiento_solicitado: 'Revisión solicitada a Jefatura',
      escalamiento_devuelto: 'Ticket devuelto a TI',
      escalamiento_pendiente: 'Revisión solicitada a Jefatura',
      escalamiento_decidido: 'Jefatura revisó el escalamiento',
      ticket_requiere_revision: 'Ticket enviado a revisión',
      ticket_categoria_actualizada: 'Categoría del ticket actualizada',
      ticket_no_resuelto: 'Ticket declarado no resuelto',
      ticket_reasignado: 'Ticket reasignado'
    } as Record<string, string>)[n.tipoEvento] || 'Actualización de ticket';
  }
}
