import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { finalize, of, switchMap } from 'rxjs';
import { UsuarioService } from '../../../core/services/usuario.service';
import { AuthService } from '../../../core/services/auth.service';
import { NuevoUsuario, UsuarioAdmin } from '../../../core/models/usuario.model';

type ModoModal = 'crear' | 'editar' | 'ver';

interface FormularioUsuario {
  estado: 'activo' | 'inactivo';
  nombres: string;
  apellidos: string;
  email: string;
  password: string;
  rol: string;
  areaId: number | null;
}

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.css'
})
export class AdminUsuariosComponent implements OnInit {
  usuarios = signal<UsuarioAdmin[]>([]);
  cargando = signal(true);
  filtroRol = signal('');
  filtroEstado = signal('');
  modalAbierto = signal(false);
  modoModal = signal<ModoModal>('crear');
  usuarioSeleccionado = signal<UsuarioAdmin | null>(null);
  guardando = signal(false);
  mensajeError = signal('');
  errorGuardado = signal('');

  readonly roles = [
    { valor: 'rol_solicitante', etiqueta: 'Solicitante' },
    { valor: 'rol_tecnico', etiqueta: 'Tecnico TI' },
    { valor: 'rol_jefatura', etiqueta: 'Jefatura TI' },
    { valor: 'rol_admin', etiqueta: 'Administrador' }
  ];

  readonly areas = [
    { id: 1, nombre: 'Tecnologias de la Informacion' },
    { id: 2, nombre: 'Administracion' },
    { id: 3, nombre: 'Rentas' },
    { id: 4, nombre: 'Obras Publicas' },
    { id: 5, nombre: 'Secretaria General' }
  ];

  form: FormularioUsuario = this.formVacio();

  constructor(private usuarioService: UsuarioService, private authService: AuthService) {}

  ngOnInit(): void {
    this.cargar();
  }

  filtrados = computed(() => {
    return this.usuarios().filter((usuario) =>
      (!this.filtroRol() || usuario.rol === this.filtroRol()) &&
      (!this.filtroEstado() || usuario.estado === this.filtroEstado())
    );
  });

  tituloModal = computed(() => {
    const titulos: Record<ModoModal, string> = {
      crear: 'Crear usuario',
      editar: 'Editar usuario',
      ver: 'Detalle de usuario'
    };

    return titulos[this.modoModal()];
  });

  get esLectura(): boolean {
    return this.modoModal() === 'ver';
  }

  get puedeAdministrar(): boolean {
    return this.authService.tieneRol('rol_admin');
  }

  cargar(): void {
    this.cargando.set(true);
    this.mensajeError.set('');
    this.usuarioService.listar().subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.cargando.set(false);
      },
      error: () => {
        this.usuarios.set([]);
        this.cargando.set(false);
        this.mensajeError.set('No se pudieron cargar los usuarios. Vuelve a iniciar sesión o intenta de nuevo.');
      }
    });
  }

  abrirCrear(): void {
    this.modoModal.set('crear');
    this.usuarioSeleccionado.set(null);
    this.form = this.formVacio();
    this.errorGuardado.set('');
    this.modalAbierto.set(true);
  }

  abrirVer(usuario: UsuarioAdmin): void {
    this.modoModal.set('ver');
    this.usuarioSeleccionado.set(usuario);
    this.form = this.formDesdeUsuario(usuario);
    this.errorGuardado.set('');
    this.modalAbierto.set(true);
  }

  abrirEditar(usuario: UsuarioAdmin): void {
    this.modoModal.set('editar');
    this.usuarioSeleccionado.set(usuario);
    this.form = this.formDesdeUsuario(usuario);
    this.errorGuardado.set('');
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    if (this.guardando()) {
      return;
    }

    this.modalAbierto.set(false);
  }

  guardar(): void {
    if (this.guardando() || !this.puedeAdministrar || this.esLectura || !this.formValido()) {
      return;
    }

    this.errorGuardado.set('');
    const creando = this.modoModal() === 'crear';
    const estadoDeseado = this.form.estado;
    let datosGuardados = false;
    this.guardando.set(true);
    const payload: NuevoUsuario = {
      nombres: this.form.nombres,
      apellidos: this.form.apellidos,
      email: this.form.email,
      password: this.form.password,
      rol: this.form.rol,
      areaId: this.form.areaId
    };

    const accion = this.modoModal() === 'crear'
      ? this.usuarioService.crear(payload)
      : this.usuarioService.actualizar(this.usuarioSeleccionado()!.id, payload);

    accion.pipe(
      switchMap(usuario => {
        datosGuardados = true;
        // Retain the persisted id if the second request needs a retry.
        this.usuarioSeleccionado.set(usuario);
        this.modoModal.set('editar');
        this.form.password = '';
        return usuario.estado === estadoDeseado
          ? of(usuario)
          : this.usuarioService.cambiarEstado(usuario.id, estadoDeseado);
      }),
      finalize(() => this.guardando.set(false))
    ).subscribe({
      next: () => {
        this.modalAbierto.set(false);
        this.cargar();
        this.alertaOk(creando ? 'Usuario creado' : 'Cambios guardados');
      },
      error: () => {
        this.errorGuardado.set(datosGuardados
          ? 'Los datos se guardaron, pero no se pudo cambiar el estado. Puedes volver a guardar para reintentarlo.'
          : 'No se pudo guardar el usuario. Revisa los datos e intenta nuevamente.');
        if (datosGuardados) this.cargar();
      }
    });
  }

  async alternarEstado(usuario: UsuarioAdmin): Promise<void> {
    const activar = usuario.estado !== 'activo';
    const resultado = await Swal.fire({
      title: activar ? 'Activar usuario' : 'Desactivar usuario',
      text: activar ? `${usuario.nombreCompleto} volvera a ingresar al sistema.` : `${usuario.nombreCompleto} no podra iniciar sesion.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: activar ? 'Si, activar' : 'Si, desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: activar ? '#173346' : '#e05a5a',
      cancelButtonColor: '#8c9a91',
      showClass: { popup: 'swal2-show swal-pop-in' },
      hideClass: { popup: 'swal2-hide swal-pop-out' }
    });

    if (!resultado.isConfirmed) {
      return;
    }

    this.usuarioService.cambiarEstado(usuario.id, activar ? 'activo' : 'inactivo').subscribe(() => {
      this.cargar();
      this.alertaOk(activar ? 'Usuario activado' : 'Usuario desactivado');
    });
  }

  async eliminar(usuario: UsuarioAdmin): Promise<void> {
    const resultado = await Swal.fire({
      title: 'Eliminar usuario',
      text: `${usuario.nombreCompleto} saldra de la lista.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e05a5a',
      cancelButtonColor: '#8c9a91',
      showClass: { popup: 'swal2-show swal-pop-in' },
      hideClass: { popup: 'swal2-hide swal-pop-out' }
    });

    if (!resultado.isConfirmed) {
      return;
    }

    this.usuarioService.eliminar(usuario.id).subscribe(() => {
      this.cargar();
      this.alertaOk('Usuario eliminado o desactivado');
    });
  }

  iniciales(nombreCompleto: string): string {
    return nombreCompleto.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
  }

  claseRol(rol: string): string {
    return 'badge-rol badge-rol-' + rol;
  }

  etiquetaRol(rol: string): string {
    const encontrado = this.roles.find((item) => item.valor === rol);
    return encontrado?.etiqueta ?? rol;
  }

  etiquetaArea(): string {
    return this.areas.find((area) => area.id === Number(this.form.areaId))?.nombre ?? 'Sin area';
  }

  formValido(): boolean {
    const passwordRequerido = this.modoModal() === 'crear';

    return Boolean(
      this.form.nombres.trim() &&
      this.form.apellidos.trim() &&
      this.form.email.trim() &&
      this.form.rol &&
      this.form.areaId &&
      (!passwordRequerido || this.form.password.trim().length >= 6)
    );
  }

  private formVacio(): FormularioUsuario {
    return {
      estado: 'activo',
      nombres: '',
      apellidos: '',
      email: '',
      password: '',
      rol: 'rol_solicitante',
      areaId: 1
    };
  }

  private formDesdeUsuario(usuario: UsuarioAdmin): FormularioUsuario {
    return {
      estado: usuario.estado === 'activo' ? 'activo' : 'inactivo',
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      email: usuario.email,
      password: '',
      rol: usuario.rol,
      areaId: this.areas.find((area) => area.nombre === usuario.area)?.id ?? null
    };
  }

  private alertaOk(title: string): void {
    void Swal.fire({
      title,
      icon: 'success',
      timer: 1400,
      showConfirmButton: false,
      confirmButtonColor: '#173346',
      showClass: { popup: 'swal2-show swal-pop-in' },
      hideClass: { popup: 'swal2-hide swal-pop-out' }
    });
  }
}
