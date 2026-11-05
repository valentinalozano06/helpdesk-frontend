import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Configuracion, CONFIG_KEY, copiaInicial, validarConfiguracion, calcularSla } from '../models/configuracion.model';
import { Ticket } from '../models/ticket.model';

@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private documento = inject(DOCUMENT);
  readonly avisoAlmacenamiento = signal('');
  private estado = signal<Configuracion>(this.leer());
  readonly actual = this.estado.asReadonly();
  readonly ahora = signal(Date.now());
  readonly aviso = signal('');
  private avisoTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const c = this.actual();
      const colores = { lima: '#d6f58a', menta: '#a2ead4', cielo: '#b6ddff' };
      this.documento.documentElement.style.setProperty('--app-acento', colores[c.acento]);
      this.documento.documentElement.classList.toggle('sin-animaciones', !c.animaciones);
      this.documento.documentElement.classList.toggle('vista-compacta', c.compacto);
      this.documento.title = `${c.nombre} · ${c.institucion}`;
    });
    window.addEventListener('storage', event => { if (event.key === CONFIG_KEY || event.key === null) this.estado.set(this.leer()); });
    setInterval(() => this.ahora.set(Date.now()), 30000);
  }
  private leer(): Configuracion {
    try { const raw = localStorage.getItem(CONFIG_KEY); return raw ? validarConfiguracion(JSON.parse(raw)) : copiaInicial(); }
    catch { this.avisoAlmacenamiento.set('No se pudo leer la configuración local. Se usarán los valores iniciales.'); return copiaInicial(); }
  }
  guardar(valor: Configuracion): void {
    const validado = validarConfiguracion(valor);
    // Persistir antes de aplicar: una cuota agotada no debe anunciar cambios guardados.
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(validado)); }
    catch { throw new Error('No se pudo guardar en este navegador. Revisa el espacio disponible o utiliza un logo más pequeño.'); }
    this.estado.set(validado); this.avisoAlmacenamiento.set('');
  }
  logo(): string { return this.actual().logo || 'assets/helpdesk-isotipo.svg'; }
  fecha(valor: string | Date | null): string {
    if (!valor) return '—';
    const d = typeof valor === 'string' ? new Date(valor) : valor;
    if (isNaN(d.getTime())) return '—';
    const dia = String(d.getDate()).padStart(2,'0'), mes = String(d.getMonth()+1).padStart(2,'0'), anio = d.getFullYear();
    switch (this.actual().formatoFecha) { case 'yyyy-MM-dd': return `${anio}-${mes}-${dia}`; case 'MM/dd/yyyy': return `${mes}/${dia}/${anio}`; default: return `${dia}/${mes}/${anio}`; }
  }
  sla(ticket: Ticket) { return calcularSla(ticket, this.actual(), this.ahora()); }
  notificar(tipo: 'creacion' | 'cambio', mensaje: string): void {
    const c = this.actual();
    if (!(tipo === 'creacion' ? c.avisarCreacion : c.avisarCambios)) return;
    this.mostrarAviso(mensaje, c.duracionAviso);
  }
  mostrarAviso(mensaje: string, segundos: number): void {
    clearTimeout(this.avisoTimer); this.aviso.set(mensaje);
    this.avisoTimer = setTimeout(() => this.aviso.set(''), Math.max(2, Math.min(10, segundos || 4)) * 1000);
  }
}