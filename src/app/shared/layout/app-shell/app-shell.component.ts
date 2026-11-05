import { CampanaComponent } from '../../notificaciones/campana.component';
import Swal from 'sweetalert2';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { effect, inject, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { filter } from 'rxjs';

interface ItemMenu {
  etiqueta: string;
  ruta: string;
  icono: string;
}

/**
 * Cascaron visual comun (sidebar + topbar) para todas las pantallas
 * autenticadas, con la identidad visual compartida del Help Desk.
 * El menu lateral se arma segun el rol de la sesion activa.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CampanaComponent, CommonModule, RouterLink, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css'
})
export class AppShellComponent {
  config = inject(ConfiguracionService);
  colapsado = false;
  menuMovilAbierto = false;

  constructor(public authService: AuthService, private router: Router) {
    effect(() => { this.colapsado = this.config.actual().sidebarColapsado; });
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.menuMovilAbierto = false;
    });
  }

  get seccionActual(): string {
    const ruta = this.router.url.split('?')[0];
    if (ruta === '/tickets/nuevo') return 'Nueva solicitud';
    return this.menu.find(item => item.ruta === ruta)?.etiqueta ?? 'Detalle del ticket';
  }

  get nuevaSolicitudAbierta(): boolean {
    return this.router.parseUrl(this.router.url).queryParams['nuevo'] === '1';
  }

  get rutaActual(): string {
    return this.router.url.split(/[?#]/)[0];
  }

  get etiquetaPadreTicket(): string {
    return this.menu.find(item => item.ruta === this.rutaPadreTicket)?.etiqueta ?? 'Tickets';
  }

  get esRutaTicket(): boolean {
    return /^\/tickets\/[^/]+$/.test(this.rutaActual);
  }

  get rutaPadreTicket(): string {
    if (this.authService.tieneRol('rol_solicitante')) return '/mis-tickets';
    if (this.authService.tieneRol('rol_tecnico')) return '/mi-cola';
    return '/admin/tickets';
  }

  tieneHijoActivo(item: ItemMenu): boolean {
    return item.ruta === this.rutaPadreTicket && /^\/tickets\/[^/]+$/.test(this.rutaActual);
  }

  estaActivo(item: ItemMenu): boolean {
    return this.rutaActual === item.ruta || this.tieneHijoActivo(item);
  }

  get iniciales(): string {
    const nombre = this.authService.sesionActual()?.nombreCompleto ?? '';
    return nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  alternarMenuMovil(): void {
    this.menuMovilAbierto = !this.menuMovilAbierto;
  }

  get menu(): ItemMenu[] {
    if (this.authService.tieneRol('rol_solicitante')) {
      return [
        { etiqueta: 'Mis solicitudes', ruta: '/mis-tickets', icono: 'tickets' }
      ];
    }

    if (this.authService.tieneRol('rol_tecnico')) return [{ etiqueta: 'Mi Cola', ruta: '/mi-cola', icono: 'tickets' }];
    const items: ItemMenu[] = [
      { etiqueta: 'Dashboard', ruta: '/admin/dashboard', icono: 'grid' },
      { etiqueta: 'Tickets', ruta: '/admin/tickets', icono: 'tickets' }
    ];
    if (this.authService.tieneRol('rol_admin', 'rol_jefatura')) {
      items.push({ etiqueta: 'Usuarios', ruta: '/admin/usuarios', icono: 'usuarios' });
    }
    items.push({ etiqueta: 'Reportes', ruta: '/admin/reportes', icono: 'reportes' });
    if (this.authService.tieneRol('rol_admin')) {
      items.push({ etiqueta: 'Configuraci\u00f3n', ruta: '/admin/configuracion', icono: 'config' });
    }
    return items;
  }

  async cerrarSesion(): Promise<void> {
    if (this.config.actual().confirmarSalida && !(await Swal.fire({ title: '\u00bfCerrar sesi\u00f3n?', icon: 'question', showCancelButton: true, confirmButtonText: 'Cerrar sesi\u00f3n', cancelButtonText: 'Cancelar', confirmButtonColor: '#122d3e' })).isConfirmed) return;
    // La navegacion permite al formulario de configuracion proteger cambios pendientes.
    const salio = await this.router.navigate(['/login']);
    if (!salio) return;
    this.authService.logout();

  }
}



