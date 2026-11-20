import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Escalamiento, Catalogo } from '../../../core/models/ticket.model';
import { EscalamientoService } from '../../../core/services/escalamiento.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({ selector: 'app-admin-escalamientos', standalone: true, imports: [CommonModule, FormsModule, RouterLink], templateUrl: './admin-escalamientos.component.html', styleUrl: './admin-escalamientos.component.css' })
export class AdminEscalamientosComponent implements OnInit {
  private api = inject(EscalamientoService);
  private usuarios = inject(UsuarioService);
  auth = inject(AuthService);
  items = signal<Escalamiento[]>([]);
  tecnicos = signal<Catalogo[]>([]);
  decisiones: Record<number, string> = {};
  reassign: Record<number, number | null> = {};
  cargando = signal(true);
  error = signal('');
  guardando = signal<number | null>(null);
  puedeDecidir = this.auth.tieneRol('rol_jefatura');

  ngOnInit(): void { this.cargar(); }
  cargar(): void {
    this.cargando.set(true); this.error.set('');
    forkJoin({ items: this.api.pendientes(), tecnicos: this.usuarios.listarTecnicos() }).subscribe({
      next: r => { this.items.set(r.items); this.tecnicos.set(r.tecnicos); this.cargando.set(false); },
      error: () => { this.error.set('No se pudieron cargar los tickets escalados.'); this.cargando.set(false); }
    });
  }
  async evidencia(id: number, nombre: string): Promise<void> {
    this.api.descargarEvidencia(id).subscribe({ next: blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }, error: () => this.error.set('No se pudo descargar la evidencia interna.') });
  }
  decidir(item: Escalamiento, accion: 'devolver' | 'reasignar' | 'no_resuelto'): void {
    const decision = (this.decisiones[item.id] ?? '').trim();
    if (!decision || this.guardando() !== null) { if (!decision) this.error.set('Escribe el motivo de la decisión antes de continuar.'); return; }
    const tecnicoId = this.reassign[item.id] ?? undefined;
    if (accion === 'reasignar' && !tecnicoId) { this.error.set('Selecciona un técnico para reasignar el ticket.'); return; }
    this.error.set(''); this.guardando.set(item.id);
    this.api.decidir(item.id, accion, decision, tecnicoId).subscribe({
      next: () => { this.items.update(xs => xs.filter(x => x.id !== item.id)); this.guardando.set(null); },
      error: () => { this.guardando.set(null); this.error.set('No se pudo guardar la decisión. Actualiza la bandeja e inténtalo de nuevo.'); }
    });
  }
  bytes(n: number): string { return n < 1048576 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`; }
}
