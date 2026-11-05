import { Configuracion, CONFIG_INICIAL } from '../../../core/models/configuracion.model';
import { Ticket } from '../../../core/models/ticket.model';

export const etiquetas: Record<string, string> = { abierto: 'Abierto', en_progreso: 'En progreso', en_espera: 'En espera', resuelto: 'Resuelto', cerrado: 'Cerrado', baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };
export const etiqueta = (valor: string) => etiquetas[valor] ?? valor;
export const terminado = (t: Ticket) => ['resuelto', 'cerrado'].includes(t.estado);
export function rangoValido(desde: string, hasta: string): boolean {
  const valida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  return valida(desde) && valida(hasta) && desde <= hasta;
}
export function filtrarTickets(tickets: Ticket[], desde: string, hasta: string): Ticket[] {
  if (!rangoValido(desde, hasta)) return [];
  // La API entrega fecha/hora local; conservar el día calendario, sin desplazarlo a UTC.
  return tickets.filter(t => { const dia = t.fechaCreacion?.slice(0, 10); return dia >= desde && dia <= hasta; })
    .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion) || a.id - b.id);
}
export function crearReporte(tickets: Ticket[], desde: string, hasta: string, configuracion: Configuracion = CONFIG_INICIAL) {
  const agrupar = (campo: 'estado' | 'prioridad' | 'categoria') => {
    const grupos = new Map<string, number>();
    tickets.forEach(t => grupos.set(t[campo] || 'Sin categoría', (grupos.get(t[campo] || 'Sin categoría') ?? 0) + 1));
    return [...grupos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([nombre, cantidad]) => ({ nombre: etiqueta(nombre), cantidad, proporcion: tickets.length ? cantidad / tickets.length : 0 }));
  };
  const resueltos = tickets.filter(terminado).length;
  const tecnicos = [...new Set(tickets.map(t => t.asignadoA || 'Sin asignar'))].sort().map(nombre => {
    const grupo = tickets.filter(t => (t.asignadoA || 'Sin asignar') === nombre);
    const completados = grupo.filter(terminado).length;
    return { nombre, total: grupo.length, resueltos: completados, pendientes: grupo.length - completados };
  });
  return { nombre: configuracion.nombre, institucion: configuracion.institucion, formatoFecha: configuracion.formatoFecha, tickets: [...tickets], desde, hasta, generado: new Date(), total: tickets.length, resueltos, pendientes: tickets.length - resueltos,
    criticos: tickets.filter(t => t.prioridad === 'critica').length, tasa: tickets.length ? resueltos / tickets.length : 0,
    estados: agrupar('estado'), prioridades: agrupar('prioridad'), categorias: agrupar('categoria'), tecnicos };
}
export type Reporte = ReturnType<typeof crearReporte>;
const fecha = (s: string, formato = 'dd/MM/yyyy') => {
  if (!s) return 'Sin fecha';
  const [anio, mes, dia] = s.slice(0,10).split('-');
  return formato === 'yyyy-MM-dd' ? `${anio}-${mes}-${dia}` : formato === 'MM/dd/yyyy' ? `${mes}/${dia}/${anio}` : `${dia}/${mes}/${anio}`;
};
const periodo = (r: Reporte) => `${fecha(r.desde, r.formatoFecha)} al ${fecha(r.hasta, r.formatoFecha)}`;
const resumen = (r: Reporte) => [['Total de tickets', r.total], ['Resueltos o cerrados', r.resueltos], ['Pendientes', r.pendientes], ['Tickets críticos', r.criticos], ['Tasa de resolución', `${Math.round(r.tasa * 100)}%`]] as (string | number)[][];

export async function generarPdf(r: Reporte): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const header = (titulo: string) => {
    doc.setFillColor('#122d3e'); doc.rect(0, 0, 297, 34, 'F');
    doc.setTextColor('#d6f58a'); doc.setFontSize(20); doc.text(r.nombre, 14, 14);
    doc.setTextColor('#ffffff'); doc.setFontSize(12); doc.text(titulo, 14, 24);
    doc.setFontSize(10); doc.text(periodo(r), 283, 14, { align: 'right' });
    doc.setFontSize(9); doc.text(doc.splitTextToSize(r.institucion, 145), 283, 23, { align: 'right' });
  };
  const tabla = (titulo: string, head: string[], body: (string | number)[][]) => {
    doc.addPage(); header(titulo);
    autoTable(doc, { startY: 42, margin: { top: 42, bottom: 18, left: 14, right: 14 }, head: [head], body,
      styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: '#122d3e' },
      alternateRowStyles: { fillColor: '#f4f7ee' }, didDrawPage: () => header(titulo) });
  };
  header('Reporte de soporte');
  doc.setTextColor('#122d3e'); doc.setFontSize(10);
  doc.text(`Emitido: ${r.generado.toLocaleString('es-PE')}`, 14, 43);
  doc.text('Tickets creados en el periodo. Estados y asignaciones actuales.', 14, 50);
  autoTable(doc, { startY: 58, margin: { left: 14, right: 150 }, head: [['Indicador', 'Valor']], body: resumen(r),
    headStyles: { fillColor: '#122d3e' }, styles: { fontSize: 11, cellPadding: 4 } });
  doc.setTextColor('#122d3e'); doc.setFontSize(12); doc.text('Distribución por estado', 164, 62);
  r.estados.forEach((e, i) => {
    const y = 75 + i * 20;
    doc.setFontSize(10); doc.text(`${e.nombre}: ${e.cantidad} (${Math.round(e.proporcion * 100)}%)`, 164, y);
    doc.setFillColor('#eef2e8'); doc.roundedRect(164, y + 3, 115, 5, 2, 2, 'F');
    if (e.proporcion > 0) { doc.setFillColor('#91b84e'); doc.rect(164, y + 3, 115 * e.proporcion, 5, 'F'); }
  });
  tabla('Estadísticas del periodo', ['Dimensión', 'Grupo', 'Tickets', 'Porcentaje'],
    [['Estado', r.estados], ['Prioridad', r.prioridades], ['Categoría', r.categorias]].flatMap(([grupo, valores]) =>
      (valores as Reporte['estados']).map(v => [grupo as string, v.nombre, v.cantidad, `${Math.round(v.proporcion * 100)}%`])));
  tabla('Carga actual del equipo', ['Técnico', 'Asignados', 'Resueltos / cerrados', 'Pendientes'], r.tecnicos.map(t => [t.nombre, t.total, t.resueltos, t.pendientes]));
  tabla('Detalle de tickets', ['Código', 'Asunto', 'Categoría', 'Prioridad', 'Estado', 'Solicitante', 'Técnico', 'Creación'],
    r.tickets.map(t => [t.codigoUnico, t.asunto, t.categoria, etiqueta(t.prioridad), etiqueta(t.estado), t.solicitante, t.asignadoA || 'Sin asignar', fecha(t.fechaCreacion, r.formatoFecha)]));
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) { doc.setPage(i); doc.setTextColor('#627567'); doc.setFontSize(9); doc.text('Helpdesk | Reporte generado automáticamente', 14, 202); doc.text(`${i} / ${paginas}`, 283, 202, { align: 'right' }); }
  return doc.output('blob');
}

export async function generarExcel(r: Reporte): Promise<Blob> {
  const { Workbook } = await import('exceljs');
  const libro = new Workbook(); libro.creator = `${r.nombre} · ${r.institucion}`; libro.created = r.generado;
  const hoja = (nombre: string, headers: string[], rows: (string | number | Date | null)[][], widths: number[]) => {
    const ws = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4' } });
    ws.mergeCells(1, 1, 1, headers.length); ws.getCell('A1').value = `${r.nombre.toUpperCase()} · ${nombre}`;
    ws.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF122D3E' } }; ws.getRow(1).height = 32;
    ws.mergeCells(2, 1, 2, headers.length); ws.getCell('A2').value = `Periodo: ${periodo(r)} | Emitido: ${r.generado.toLocaleString('es-PE')} | Estados actuales`;
    ws.addRow([]); ws.getRow(4).values = headers; ws.getRow(4).height = 26;
    rows.forEach(row => ws.addRow(row));
    widths.forEach((width, i) => ws.getColumn(i + 1).width = width);
    ws.getRow(4).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF122D3E' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, ws.rowCount), column: headers.length } };
    ws.eachRow((row, i) => { if (i <= 4) return; row.alignment = { vertical: 'top', wrapText: true }; row.eachCell(cell => {
      cell.font = { size: 11, color: { argb: 'FF122D3E' } }; if (i % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7EE' } };
      if (cell.value instanceof Date) cell.numFmt = r.formatoFecha.toLowerCase() + ' hh:mm';
    }); });
    return ws;
  };
  hoja('Resumen', ['Indicador', 'Valor'], [...resumen(r), ['Criterio', 'Fecha de creación; resueltos incluye cerrados.'], ['Alcance', 'Estado y técnico actuales, no historial de asignaciones.']], [36, 95]);
  for (const [nombre, datos] of [['Estados', r.estados], ['Prioridades', r.prioridades], ['Categorías', r.categorias]] as const) {
    const ws = hoja(nombre, ['Grupo', 'Tickets', 'Porcentaje'], datos.map(d => [d.nombre, d.cantidad, d.proporcion]), [42, 18, 20]);
    ws.getColumn(3).numFmt = '0.0%';
  }
  hoja('Equipo', ['Técnico', 'Asignados', 'Resueltos / cerrados', 'Pendientes'], r.tecnicos.map(t => [t.nombre, t.total, t.resueltos, t.pendientes]), [38, 18, 25, 18]);
  const fechaExcel = (s: string | null) => { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; };
  hoja('Tickets', ['Código', 'Asunto', 'Descripción', 'Categoría', 'Prioridad', 'Estado', 'Solicitante', 'Técnico', 'Creación', 'Actualización'],
    r.tickets.map(t => [t.codigoUnico, t.asunto, t.descripcion, t.categoria, etiqueta(t.prioridad), etiqueta(t.estado), t.solicitante, t.asignadoA || 'Sin asignar', fechaExcel(t.fechaCreacion), fechaExcel(t.fechaUltimaActualizacion)]),
    [25, 48, 65, 26, 16, 20, 30, 30, 24, 24]);
  const buffer = await libro.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}