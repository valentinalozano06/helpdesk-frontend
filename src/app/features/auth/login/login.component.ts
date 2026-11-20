import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { inject, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Pantalla de acceso. El rol real siempre lo decide el backend a partir
 * del usuario autenticado; el formulario solo envia correo y contrasena.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  config = inject(ConfiguracionService);
  sesionVencida = new URLSearchParams(window.location.search).get('motivo') === 'inactividad';
  mostrarPassword = signal(false);
  cargando = signal(false);
  errorMensaje = signal<string | null>(null);

  formulario = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {}

  ingresar(): void {
    if (this.cargando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorMensaje.set(null);

    const { email, password } = this.formulario.getRawValue();
    this.authService.login({ email: email!.trim(), password: password!.trim() }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate([this.authService.rutaInicioSegunRol()]);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorMensaje.set(err.error?.message ?? 'Credenciales inválidas, intenta nuevamente');
      }
    });
  }
}
