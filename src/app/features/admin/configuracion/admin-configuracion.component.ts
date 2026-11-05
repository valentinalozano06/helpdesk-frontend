import { AjusteRepartoComponent } from '../../../shared/ajuste-reparto/ajuste-reparto.component';
import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { Configuracion, copiaInicial, validarConfiguracion } from '../../../core/models/configuracion.model';

@Component({ selector: 'app-admin-configuracion', standalone: true, imports: [CommonModule, FormsModule, AjusteRepartoComponent], templateUrl: './admin-configuracion.component.html', styleUrl: './admin-configuracion.component.css' })
export class AdminConfiguracionComponent {
  config = inject(ConfiguracionService);
  form: Configuracion = structuredClone(this.config.actual());
  private base = JSON.stringify(this.form);
  pestana = signal('general');
  procesando = signal(false);
  error = signal('');
  readonly tabs = [{ id: 'general', texto: 'General' }, { id: 'sla', texto: 'Tickets y SLA' }, { id: 'avisos', texto: 'Notificaciones' }, { id: 'seguridad', texto: 'Seguridad' }, { id: 'apariencia', texto: 'Personalización' }];
  readonly prioridades = ['baja', 'media', 'alta', 'critica'] as const;
  readonly acentos = [{ id: 'lima', nombre: 'Lima', color: '#d6f58a' }, { id: 'menta', nombre: 'Menta', color: '#a2ead4' }, { id: 'cielo', nombre: 'Cielo', color: '#b6ddff' }] as const;
  get cambios(): boolean { return JSON.stringify(this.form) !== this.base; }
  get conflicto(): boolean { return JSON.stringify(this.config.actual()) !== this.base; }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void { if (this.cambios) { event.preventDefault(); event.returnValue = ''; } }
  async puedeSalir(): Promise<boolean> {
    if (!this.cambios) return true;
    return (await Swal.fire({ title: '¿Salir sin guardar?', text: 'Los cambios pendientes se perderán.', icon: 'question', showCancelButton: true, confirmButtonText: 'Salir', cancelButtonText: 'Seguir editando', confirmButtonColor: '#122d3e' })).isConfirmed;
  }
  recargar(): void { this.form = structuredClone(this.config.actual()); this.base = JSON.stringify(this.form); this.error.set(''); }
  async guardar(): Promise<void> {
    this.error.set('');
    if (this.procesando()) return;
    try {
      const validada = validarConfiguracion(this.form);
      if (this.conflicto && !(await Swal.fire({ title: 'Configuración actualizada en otra pestaña', text: '¿Reemplazarla con estos cambios?', icon: 'question', showCancelButton: true, confirmButtonText: 'Reemplazar', cancelButtonText: 'Cancelar' })).isConfirmed) return;
      this.config.guardar(validada); this.recargar();
      await Swal.fire({ icon: 'success', title: 'Configuración aplicada', text: 'Guardada en este navegador.', timer: 1700, showConfirmButton: false });
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  }
  async restaurar(): Promise<void> {
    if (!(await Swal.fire({ title: '¿Restaurar configuración?', text: 'Se restablecerán las preferencias de este navegador. El reparto del servidor, los usuarios y los tickets se conservan.', icon: 'question', showCancelButton: true, confirmButtonText: 'Restaurar', cancelButtonText: 'Cancelar', confirmButtonColor: '#122d3e' })).isConfirmed) return;
    try { this.config.guardar(copiaInicial()); this.recargar(); await Swal.fire({ icon: 'success', title: 'Configuración restaurada', timer: 1400, showConfirmButton: false }); }
    catch(e) { this.error.set(e instanceof Error ? e.message : 'No se pudo restaurar.'); }
  }
  exportar(): void {
    const blob = new Blob([JSON.stringify(this.config.actual(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'helpdesk-configuracion.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async importar(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    this.error.set(''); this.procesando.set(true);
    try {
      if (file.size > 800000) throw new Error('El archivo supera el tamaño permitido (800 KB).');
      const nueva = validarConfiguracion(JSON.parse(await file.text()));
      if (nueva.logo) await this.comprobarImagen(nueva.logo);
      if ((await Swal.fire({ title: '¿Cargar configuración?', text: 'Reemplazará el formulario. Guarda para aplicar los ajustes.', showCancelButton: true, confirmButtonText: 'Cargar', cancelButtonText: 'Cancelar', icon: 'question' })).isConfirmed) this.form = nueva;
    } catch(e) { this.error.set(e instanceof SyntaxError ? 'El archivo JSON no es válido.' : e instanceof Error ? e.message : 'No se pudo importar.'); }
    finally { this.procesando.set(false); }
  }
  private comprobarImagen(src: string): Promise<void> {
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => img.naturalWidth <= 2048 && img.naturalHeight <= 2048 ? resolve() : reject(new Error('El logo admite hasta 2048 × 2048 píxeles.')); img.onerror = () => reject(new Error('No se pudo leer la imagen.')); img.src = src; });
  }
  async cargarLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    this.error.set(''); this.procesando.set(true);
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 500000) throw new Error('Selecciona PNG, JPG o WebP de hasta 500 KB.');
      const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('No se pudo leer la imagen.')); r.readAsDataURL(file); });
      await this.comprobarImagen(data); this.form.logo = data;
    } catch(e) { this.error.set(e instanceof Error ? e.message : 'No se pudo cargar el logo.'); }
    finally { this.procesando.set(false); }
  }
  probarAviso(): void {
    this.config.mostrarAviso('Así se verá un aviso de prueba', this.form.duracionAviso);
  }
}