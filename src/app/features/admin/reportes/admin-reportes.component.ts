import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { inject, Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketService } from '../../../core/services/ticket.service';
import { Ticket } from '../../../core/models/ticket.model';

import Swal from 'sweetalert2';
import { crearReporte, filtrarTickets, rangoValido, generarPdf, generarExcel } from './reporte-export';

interface Barra { etiqueta: string; valor: number; color: string; }

/**
 * Reportes y estadisticas: los indicadores se calculan en el cliente a
 * partir de los tickets ya cargados (TicketService), sin necesitar un
 * endpoint de agregacion adicional para esta primera version.
 */
@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reportes.component.html',
  styleUrl: './admin-reportes.component.css'
})
export class AdminReportesComponent implements OnInit {
  config = inject(ConfiguracionService);
  datos = signal<Ticket[]>([]);
  rango = signal({ desde: this.primerDiaDelMes(), hasta: this.hoyIso() });
  cargando = signal(false);
  error = signal('');
  exportando = signal<'pdf' | 'xlsx' | null>(null);
  actualizado = signal<Date | null>(null);
  rangoCorrecto = computed(() => rangoValido(this.rango().desde, this.rango().hasta));
  tickets = computed(() => filtrarTickets(this.datos(), this.rango().desde, this.rango().hasta));
  reporte = computed(() => crearReporte(this.tickets(), this.rango().desde, this.rango().hasta, this.config.actual()));
  desde = this.primerDiaDelMes();
  hasta = this.hoyIso();

  constructor(private ticketService: TicketService) {}

  ngOnInit(): void {
    this.generar();
  }

  cambiarFechas(): void { this.rango.set({ desde: this.desde, hasta: this.hasta }); }

  generar(): void {
    this.cambiarFechas();
    if (!this.rangoCorrecto() || this.cargando()) return;
    this.cargando.set(true); this.error.set('');
    this.ticketService.listar().subscribe({
      next: datos => { this.datos.set(datos); this.actualizado.set(new Date()); this.cargando.set(false); },
      error: () => { this.datos.set([]); this.cargando.set(false); this.error.set('No se pudieron cargar los tickets. Intenta actualizar el reporte.'); }
    });
  }

  periodoRapido(tipo: 'mes' | '30dias' | 'anio'): void {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    if (tipo === '30dias') inicio.setTime(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29).getTime());
    if (tipo === 'anio') inicio.setMonth(0);
    this.desde = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`;
    this.hasta = this.hoyIso(); this.cambiarFechas();
  }

  async exportar(formato: 'pdf' | 'xlsx'): Promise<void> {
    if (this.exportando() || this.cargando() || this.error() || !this.rangoCorrecto() || !this.total()) return;
    this.exportando.set(formato);
    const reporte = crearReporte(this.tickets(), this.rango().desde, this.rango().hasta, this.config.actual());
    try {
      const blob = await (formato === 'pdf' ? generarPdf(reporte) : generarExcel(reporte));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `Helpdesk_${reporte.desde}_${reporte.hasta}.${formato}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      await Swal.fire({ icon: 'success', title: 'Reporte listo', text: 'Se inició la descarga del archivo.', timer: 2200, showConfirmButton: false, confirmButtonColor: '#122d3e' });
    } catch {
      await Swal.fire({ icon: 'error', title: 'No se pudo exportar', text: 'Inténtalo nuevamente.', confirmButtonColor: '#122d3e' });
    } finally { this.exportando.set(null); }
  }
  total = computed(() => this.tickets().length);

  tasaResolucion = computed(() => {
    const total = this.total();
    if (total === 0) return 0;
    const resueltos = this.tickets().filter((t) => t.estado === 'resuelto' || t.estado === 'cerrado').length;
    return Math.round((resueltos / total) * 100);
  });

  ticketsCriticos = computed(() => this.tickets().filter((t) => t.prioridad === 'critica').length);
  ticketsNoResueltos = computed(() => this.tickets().filter((t) => t.estado === 'no_resuelto').length);

  porCategoria = computed<Barra[]>(() => {
    const conteo = new Map<string, number>();
    for (const t of this.tickets()) conteo.set(t.categoria, (conteo.get(t.categoria) ?? 0) + 1);
    const paleta = ['#173346', '#789b4b', '#dfab2d', '#e47732', '#6c8eae', '#ab5a50', '#8066a3'];
    return Array.from(conteo.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([etiqueta, valor], i) => ({ etiqueta, valor, color: paleta[i % paleta.length] }));
  });

  porPrioridad = computed<Barra[]>(() => {
    const colores: Record<string, string> = { baja: '#2f8fe0', media: '#e0b020', alta: '#f08a1f', critica: '#d6362f' };
    return ['baja', 'media', 'alta', 'critica'].map((p) => ({
      etiqueta: p.charAt(0).toUpperCase() + p.slice(1),
      valor: this.tickets().filter((t) => t.prioridad === p).length,
      color: colores[p]
    }));
  });

  distribucionEstado = computed(() => {
    const colores: Record<string, string> = {
      abierto: '#d6362f', en_progreso: '#f08a1f', en_espera: '#e0b020', resuelto: '#2fa860', cerrado: '#8b98a5', requiere_revision: '#74549a', no_resuelto: '#b24840'
    };
    const etiquetas: Record<string, string> = {
      abierto: 'Abierto', en_progreso: 'En progreso', en_espera: 'En espera', resuelto: 'Finalizado', cerrado: 'Cerrado', requiere_revision: 'Requiere revisión', no_resuelto: 'No resuelto'
    };
    return Object.keys(etiquetas)
      .map((estado) => ({
        estado, etiqueta: etiquetas[estado], color: colores[estado],
        valor: this.tickets().filter((t) => t.estado === estado).length
      }))
      .filter((d) => d.valor > 0);
  });

  /** Genera los segmentos SVG (stroke-dasharray) de un donut a partir de la distribucion por estado. */
  segmentosDonut = computed(() => {
    const datos = this.distribucionEstado();
    const totalValor = datos.reduce((acc, d) => acc + d.valor, 0) || 1;
    const circunferencia = 2 * Math.PI * 60;
    let acumulado = 0;
    return datos.map((d) => {
      const largo = (d.valor / totalValor) * circunferencia;
      const segmento = { ...d, dasharray: `${largo} ${circunferencia - largo}`, offset: -acumulado };
      acumulado += largo;
      return segmento;
    });
  });

  maxCategoria = computed(() => Math.max(1, ...this.porCategoria().map((b) => b.valor)));
  maxPrioridad = computed(() => Math.max(1, ...this.porPrioridad().map((b) => b.valor)));
  porcentajeEstado(valor: number): number { return this.total() ? Math.round(valor / this.total() * 100) : 0; }
  porcentajePrioridad(valor: number): number { return this.porcentajeEstado(valor); }
  porcentajeEquipo(valor: number, total: number): number { return total ? Math.round(valor / total * 100) : 0; }
  iniciales(nombre: string): string { return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase(); }

  private primerDiaDelMes(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  private hoyIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
