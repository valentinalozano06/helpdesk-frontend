import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Redirige tras el login a /inicio (trabajador) o /admin/dashboard (perfil administrativo). */
@Component({
  selector: 'app-home-redirect',
  standalone: true,
  template: ``
})
export class HomeRedirectComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.router.navigate([this.authService.rutaInicioSegunRol()]);
  }
}
