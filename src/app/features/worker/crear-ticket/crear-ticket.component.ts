import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { inject, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TicketService } from '../../../core/services/ticket.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { Catalogo } from '../../../core/models/ticket.model';

@Component({
  selector: 'app-crear-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './crear-ticket.component.html',
  styleUrl: './crear-ticket.component.css'
})
export class CrearTicketComponent implements OnInit {
  auth = inject(AuthService);
  get volverA(): string { return this.auth.tieneRol('rol_solicitante') ? '/mis-tickets' : this.auth.tieneRol('rol_tecnico') ? '/mi-cola' : '/admin/tickets'; }
  config = inject(ConfiguracionService);
  categorias = signal<Catalogo[]>([]);
  archivos = signal<File[]>([]);
  readonly extensiones = ['png', 'jpg', 'jpeg'];
  readonly maxArchivos = 5;
  readonly maxTamano = 10 * 1024 * 1024;
  enviando = signal(false);
  mensajeError = signal<string | null>(null);
  ticketCreadoId = signal<number | null>(null);

  formulario = this.fb.group({
    asunto: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: ['', [Validators.required]],
    categoriaId: [null as number | null, [Validators.required]]
  });

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService,
    private catalogoService: CatalogoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.catalogoService.categorias().subscribe({
      next: (categorias) => this.categorias.set(categorias),
      error: () => this.mensajeError.set('No se pudieron cargar las categorias.')
    });
  }

  onArchivosSeleccionados(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const nuevos = Array.from(input.files ?? []);
    input.value = '';
    if (!nuevos.length) return;
    for (const archivo of nuevos) {
      const ext = archivo.name.split('.').pop()?.toLowerCase() ?? '';
      if (!this.extensiones.includes(ext)) {
        this.mensajeError.set(`Formato no permitido: ${archivo.name}. Solo fotos PNG o JPG.`);
        return;
      }
      if (archivo.size > this.maxTamano) {
        this.mensajeError.set(`${archivo.name} supera los 10 MB permitidos.`);
        return;
      }
    }
    if (this.archivos().length + nuevos.length > this.maxArchivos) {
      this.mensajeError.set(`Puedes adjuntar hasta ${this.maxArchivos} archivos de evidencia.`);
      return;
    }
    this.mensajeError.set(null);
    this.archivos.update(actuales => [...actuales, ...nuevos]);
  }

  quitarArchivo(indice: number): void {
    this.archivos.update(actuales => actuales.filter((_, i) => i !== indice));
  }

  tamanoLegible(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  enviar(): void {
    if (this.enviando()) return;
    if (this.ticketCreadoId()) { this.subirEvidencia(this.ticketCreadoId()!); return; }
    if ((this.formulario.controls.descripcion.value ?? '').trim().length < this.config.actual().descripcionMinima) {
      this.mensajeError.set(`Describe el problema con al menos ${this.config.actual().descripcionMinima} caracteres.`);
      this.formulario.controls.descripcion.markAsTouched(); return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.mensajeError.set(null);
    this.enviando.set(true);
    const v = this.formulario.getRawValue();

    this.ticketService.crear({
      asunto: v.asunto!,
      descripcion: v.descripcion!,
      categoriaId: v.categoriaId!
    }).subscribe({
      next: (ticket) => {
        this.ticketCreadoId.set(ticket.id);
        this.formulario.disable();
        this.subirEvidencia(ticket.id);
      },
      error: () => {
        this.enviando.set(false);
        this.mensajeError.set('No se pudo crear el ticket. Verifica tu sesion e intenta nuevamente.');
      }
    });
  }
  private subirEvidencia(id: number): void {
    if (!this.archivos().length) { this.enviando.set(false); void this.router.navigate(['/tickets', id]); return; }
    this.enviando.set(true); this.mensajeError.set(null);
    this.ticketService.adjuntar(id, this.archivos()).subscribe({
      next: () => { this.enviando.set(false); void this.router.navigate(['/tickets', id]); },
      error: () => { this.enviando.set(false); this.mensajeError.set('El ticket ya fue creado, pero la evidencia no se subió. Reintenta sin crear otro ticket.'); }
    });
  }
}
