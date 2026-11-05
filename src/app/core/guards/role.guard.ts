import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Guard de UI: oculta rutas segun rol. La autorizacion real vive en el backend (@PreAuthorize). */
export const roleGuard = (rolesPermitidos: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.tieneRol(...rolesPermitidos)) return true;

    router.navigate([authService.rutaInicioSegunRol()]);
    return false;
  };
};
