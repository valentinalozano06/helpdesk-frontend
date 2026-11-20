import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AppShellComponent } from './shared/layout/app-shell/app-shell.component';

const ROLES_ADMINISTRATIVOS = ['rol_jefatura', 'rol_admin'];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    component: AppShellComponent,
    children: [
      { path: 'mi-cola', canActivate: [roleGuard(['rol_tecnico'])], loadComponent: () => import('./features/tecnico/cola/tecnico-cola.component').then(m => m.TecnicoColaComponent) },
      {
        path: '',
        loadComponent: () => import('./features/shared/home-redirect/home-redirect.component').then(m => m.HomeRedirectComponent)
      },
      // ---- Perfil Trabajador (rol_solicitante) ----
      { path: 'inicio', redirectTo: 'mis-tickets', pathMatch: 'full' },
      {
        path: 'mis-tickets',
        canActivate: [roleGuard(['rol_solicitante'])],
        loadComponent: () => import('./features/worker/mis-tickets/mis-tickets.component').then(m => m.MisTicketsComponent)
      },
      {
        path: 'tickets/nuevo',
        canActivate: [roleGuard(['rol_solicitante'])],
        loadComponent: () => import('./features/worker/crear-ticket/crear-ticket.component').then(m => m.CrearTicketComponent)
      },
      // ---- Ticket individual: visible para cualquier perfil autenticado ----
      {
        path: 'tickets/:id',
        loadComponent: () => import('./features/tickets/ticket-detail/ticket-detail.component').then(m => m.TicketDetailComponent)
      },
      // ---- Perfil Administrador TI / Tecnico / Jefatura ----
      {
        path: 'admin/dashboard',
        canActivate: [roleGuard(ROLES_ADMINISTRATIVOS)],
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'admin/tickets',
        canActivate: [roleGuard(ROLES_ADMINISTRATIVOS)],
        loadComponent: () => import('./features/admin/tickets/admin-tickets.component').then(m => m.AdminTicketsComponent)
      },
      {
        path: 'admin/escalamientos',
        canActivate: [roleGuard(['rol_admin', 'rol_jefatura'])],
        loadComponent: () => import('./features/admin/escalamientos/admin-escalamientos.component').then(m => m.AdminEscalamientosComponent)
      },
      {
        path: 'admin/usuarios',
        canActivate: [roleGuard(['rol_admin', 'rol_jefatura'])],
        loadComponent: () => import('./features/admin/usuarios/admin-usuarios.component').then(m => m.AdminUsuariosComponent)
      },
      {
        path: 'admin/reportes',
        canActivate: [roleGuard(ROLES_ADMINISTRATIVOS)],
        loadComponent: () => import('./features/admin/reportes/admin-reportes.component').then(m => m.AdminReportesComponent)
      },
      {
        path: 'admin/configuracion',
        canDeactivate: [(component: { puedeSalir: () => Promise<boolean> }) => component.puedeSalir()],
        canActivate: [roleGuard(['rol_admin'])],
        loadComponent: () => import('./features/admin/configuracion/admin-configuracion.component').then(m => m.AdminConfiguracionComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];


