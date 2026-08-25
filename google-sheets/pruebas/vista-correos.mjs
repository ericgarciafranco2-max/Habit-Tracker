/**
 * Genera los dos correos en un fichero HTML para poder mirarlos sin mandarlos.
 *
 * Cambiar el aspecto de un correo a base de enviarselo a uno mismo es lento y
 * gasta cuota de Gmail. Esto los pinta con datos de prueba en un segundo.
 *
 *   node google-sheets/pruebas/vista-correos.mjs && open correos.html
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { entorno, libro, correos } from './simulador-sheets.mjs';

const codigo = fs.readFileSync(new URL('../Tracker.gs', import.meta.url), 'utf8');
const ctx = vm.createContext({ ...entorno, Date, Math, Object, String, Number, Array, JSON, RegExp, isNaN });
vm.runInContext(codigo +
  '\n;globalThis.__api = { crearTracker, recordatorioDiario, informeSemanal, liquidarAyer };', ctx);
const api = ctx.__api;

api.crearTracker();

// Unos dias de historia, para que los correos tengan algo que contar.
const ajustes = libro.getSheetByName('Ajustes');
const hace = new Date();
hace.setDate(hace.getDate() - 20);
ajustes.getRange(12, 2).setValue(hace);          // Empezado el
ajustes.getRange(5, 2).setValue('Eric');         // Tu nombre
ajustes.getRange(9, 2).setValue('auditor@example.com');

const hoy = new Date();
const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const mes = libro.getSheetByName(meses[hoy.getMonth()]);
// Marca los ultimos 14 dias con un patron irregular: algunos habitos bien,
// otros a medias, y un par de dias en cero.
for (let d = Math.max(1, hoy.getDate() - 14); d <= hoy.getDate(); d++) {
  for (let i = 0; i < 10; i++) {
    if ((d + i) % 4 === 0) continue;
    const fila = 4 + i;
    const valor = i === 2 ? 60 : i === 5 ? 12 : i === 8 ? 7 : true;
    if (i === 7) continue;                        // el de evitar se deja vacio
    mes.getRange(fila, d + 1).setValue(valor);
  }
}
api.liquidarAyer();
correos.length = 0;
api.recordatorioDiario();
api.informeSemanal();

const pagina = correos.map((c) =>
  '<section><h3 style="font:600 13px -apple-system,sans-serif;color:#6e6e73">' +
  'Para: ' + c.to + '<br>Asunto: ' + c.subject + '</h3>' +
  '<div class="sobre">' + c.htmlBody + '</div></section>').join('');

fs.writeFileSync('correos.html',
  '<!doctype html><meta charset="utf-8"><title>Los dos correos</title>' +
  '<style>body{background:#e9e9ed;margin:0;padding:28px;font-family:-apple-system,sans-serif}' +
  'section{max-width:640px;margin:0 auto 28px}' +
  '.sobre{background:#fff;border-radius:14px;padding:26px;box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
  '</style>' + pagina);
console.log('escrito correos.html con ' + correos.length + ' correos');
