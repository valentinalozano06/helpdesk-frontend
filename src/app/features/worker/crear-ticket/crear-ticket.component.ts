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
  archivoSeleccionado = signal<string | null>(null);
  enviando = signal(false);
  mensajeError = signal<string | null>(null);

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

  onArchivoSeleccionado(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.archivoSeleccionado.set(input.files?.[0]?.name ?? null);
  }

  enviar(): void {
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
        this.enviando.set(false);
        this.router.navigate(['/tickets', ticket.id]);
      },
      error: () => {
        this.enviando.set(false);
        this.mensajeError.set('No se pudo crear el ticket. Verifica tu sesion e intenta nuevamente.');
      }
    });
  }
}