import { Component, inject } from '@angular/core';
import { ConfiguracionService } from './core/services/configuracion.service';
import { SesionLocalService } from './core/services/sesion-local.service';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>@if (config.aviso()) { <div class="aviso-global" role="status"><span aria-hidden="true">✓</span>{{ config.aviso() }}<button type="button" aria-label="Cerrar aviso" (click)="config.aviso.set('')">×</button></div> }`
})
export class AppComponent { config = inject(ConfiguracionService); private sesionLocal = inject(SesionLocalService); }
