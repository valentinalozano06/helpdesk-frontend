import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Adjunta el JWT a cada peticion saliente. La validacion real ocurre
 * siempre en el backend (JwtAuthenticationFilter); este interceptor
 * solo transporta el token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.obtenerToken();
  const esApi = req.url.startsWith('http') || req.url.startsWith('/api');
  const esLogin = req.url.includes('/auth/login');

  if (token && esApi && !esLogin) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req).pipe(catchError((error) => {
    if (token && esApi && !esLogin && error.status === 401 && authService.obtenerToken() === token) {
      authService.logout();
      void router.navigate(['/login']);
    }
    return throwError(() => error);
  }));
};
