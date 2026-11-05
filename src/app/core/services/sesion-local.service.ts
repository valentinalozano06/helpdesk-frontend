import { Injectable, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ConfiguracionService } from './configuracion.service';

@Injectable({ providedIn: 'root' })
export class SesionLocalService {
  private auth = inject(AuthService);
  private config = inject(ConfiguracionService);
  private ultimaActividad = Date.now();
  constructor() {
    effect(() => { this.auth.sesionActual(); this.config.actual().inactividad; this.ultimaActividad = Date.now(); });
    const actividad = () => { if (!this.comprobar()) this.ultimaActividad = Date.now(); };
    ['pointerdown', 'keydown', 'scroll', 'pointermove', 'touchstart'].forEach(event => window.addEventListener(event, actividad, { passive: true }));
    document.addEventListener('visibilitychange', () => this.comprobar());
    setInterval(() => this.comprobar(), 1000);
  }
  private comprobar(): boolean {
    const minutos = this.config.actual().inactividad;
    if (!this.auth.sesionActual() || !minutos || Date.now() - this.ultimaActividad < minutos * 60000) return false;
    this.auth.logout();
    // Vuelve al login incluso si un formulario tiene cambios sin guardar: la sesión terminó.
    window.location.assign('/login?motivo=inactividad');
    return true;
  }
}