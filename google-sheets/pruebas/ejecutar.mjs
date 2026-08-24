/**
 * Pruebas del tracker de Google Sheets.
 *
 * Apps Script solo corre dentro de Google, asi que aqui se ejecuta el fichero
 * real contra un simulador de la API que guarda los valores en memoria. No
 * evalua formulas a proposito: asi se comprueba que la logica no depende de
 * que una formula haya calculado antes.
 *
 *   node google-sheets/pruebas/ejecutar.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { entorno, libro, correos, alertas, contador, reiniciarContador } from './simulador-sheets.mjs';

const codigo = fs.readFileSync(new URL('../Tracker.gs', import.meta.url), 'utf8');
const ctx = vm.createContext({ ...entorno, Date, Math, Object, String, Number, Array, JSON, RegExp, isNaN });
vm.runInContext(codigo + '\n;globalThis.__api = { crearTracker, recalcularTodo, prepararHoy, liquidarAyer, informeSemanal, recordatorioDiario, onEdit, verificar, leerHabitos, leerConfig, estadoDelDia, leerAño, textoDeuda, calcularRacha, exigiblesDelMes, cumplido, aplicaHoy, fechaInicio };', ctx);
const api = ctx.__api;

let fallos = 0;
const comprobar = (nombre, condicion, detalle) => {
  console.log(`${condicion ? 'OK   ' : 'FALLO'} ${nombre}${condicion ? '' : '  → ' + detalle}`);
  if (!condicion) fallos++;
};

/* ---------------------------- Construccion ---------------------------- */
api.crearTracker();

const esperadas = ['Ajustes','Hoy','Panel','Universidad','Presion','Metodos','Frases','_datos',
  'Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const faltan = esperadas.filter((n) => !libro.getSheetByName(n));
comprobar('crea las 20 pestañas', faltan.length === 0, 'faltan ' + faltan.join(','));

const habitos = api.leerHabitos();
comprobar('lee los habitos de Ajustes', habitos.length === 10, 'leidos ' + habitos.length);
comprobar('detecta los innegociables',
  habitos.filter((h) => h.innegociable).length === 3,
  habitos.filter((h) => h.innegociable).length + ' innegociables');
comprobar('lee objetivo y minimo',
  habitos[2].objetivo === 90 && habitos[2].minimo === 25,
  JSON.stringify([habitos[2].objetivo, habitos[2].minimo]));
comprobar('el año de Ajustes se lee', Number(api.leerConfig('Año')) === new Date().getFullYear(),
  String(api.leerConfig('Año')));

/* ------------------------- Marcar y recalcular ------------------------- */
const hoy = new Date();
const mesActual = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][hoy.getMonth()];
const rejilla = libro.getSheetByName(mesActual);

// Fila 4 = primer habito (si/no), fila 6 = estudio profundo (minutos).
const colHoy = hoy.getDate() + 1;
rejilla.getRange(4, colHoy).setValue(true);      // levantarme: hecho
rejilla.getRange(6, colHoy).setValue(30);        // estudio: por encima del minimo (25), por debajo del objetivo (90)
rejilla.getRange(9, colHoy).setValue(2);         // leer: 2 paginas, por debajo del minimo (5)

comprobar('marcado si/no cuenta como cumplido', api.cumplido(habitos[0], true), 'no cuenta');
comprobar('el minimo cuenta (regla anti-cero)', api.cumplido(habitos[2], 30), '30 con minimo 25 no cuenta');
comprobar('por debajo del minimo no cuenta', !api.cumplido(habitos[5], 2), '2 con minimo 5 cuenta');
comprobar('los habitos de evitar se invierten',
  api.cumplido(habitos[7], false) && !api.cumplido(habitos[7], true), 'logica invertida mal');

api.recalcularTodo();
const resumen = rejilla.getRange(4, new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate() + 2, 3, 4).getValues();
comprobar('el resumen del mes se escribe', resumen[0][0] === 1, 'hechos = ' + resumen[0][0]);
// Se cuenta desde la fecha en que se monto el tracker, no desde el dia 1 del
// mes: los dias anteriores no son fallos tuyos.
comprobar('los exigibles del mes empiezan el dia que montaste el tracker',
  Number(resumen[0][1]) === 1, 'exigibles ' + resumen[0][1] + ' habiendo empezado hoy');

const panel = libro.getSheetByName('Panel');
comprobar('el panel escribe sus indicadores', String(panel.getRange(5, 1).getValue()).indexOf('%') > 0,
  'valor "' + panel.getRange(5, 1).getValue() + '"');
comprobar('la tabla por habito se rellena',
  String(panel.getRange(10, 1).getValue()).indexOf('Levantarme') > 0, panel.getRange(10, 1).getValue());

/* ------------------------------- Hoy ---------------------------------- */
api.prepararHoy();
const hojaHoy = libro.getSheetByName('Hoy');
comprobar('Hoy lista los habitos del dia',
  String(hojaHoy.getRange(11, 1).getValue()).indexOf('Levantarme') > 0, hojaHoy.getRange(11, 1).getValue());
comprobar('Hoy trae el valor ya marcado', hojaHoy.getRange(11, 2).getValue() === true,
  String(hojaHoy.getRange(11, 2).getValue()));
comprobar('Hoy guarda a que celda del mes escribir',
  hojaHoy.getRange(11, 6).getValue() === mesActual && hojaHoy.getRange(11, 8).getValue() === colHoy,
  JSON.stringify(hojaHoy.getRange(11, 6, 1, 3).getValues()));

// Marcar desde Hoy debe escribir en la rejilla del mes.
const filaLeer = [...Array(20).keys()].map((i) => i + 11)
  .find((f) => String(hojaHoy.getRange(f, 1).getValue()).indexOf('Leer') > 0);
hojaHoy.getRange(filaLeer, 2).setValue(25);
api.onEdit({ range: hojaHoy.getRange(filaLeer, 2) });
comprobar('marcar en Hoy escribe en la rejilla del mes',
  rejilla.getRange(9, colHoy).getValue() === 25, String(rejilla.getRange(9, colHoy).getValue()));

// El cierre del dia se guarda en la tabla interna.
const filaAnimo = [...Array(60).keys()].map((i) => i + 11)
  .find((f) => hojaHoy.getRange(f, 1).getValue() === 'Animo (1-5)');
comprobar('la pestaña Hoy pinta el bloque de cierre', Boolean(filaAnimo), 'no aparece');
if (filaAnimo) {
  hojaHoy.getRange(filaAnimo, 2).setValue(4);
  api.onEdit({ range: hojaHoy.getRange(filaAnimo, 2) });
  const datos = libro.getSheetByName('_datos');
  comprobar('el animo se guarda en la tabla de dias', datos.getRange(3, 2).getValue() === 4,
    String(datos.getRange(3, 2).getValue()));
}

/* --------------------------- Liquidar y avisar ------------------------- */
api.liquidarAyer();
const datos = libro.getSheetByName('_datos');
const deuda = datos.getRange(3, 8, 10, 6).getValues().filter((f) => f[0]);
comprobar('fallar ayer genera deuda', deuda.length > 0, 'no se apunto ninguna deuda');
comprobar('la deuda lleva cantidad y unidad',
  deuda.length > 0 && Number(deuda[0][2]) > 0 && deuda[0][3] === 'minutos', JSON.stringify(deuda[0]));
comprobar('el resumen de deuda se lee', api.textoDeuda().indexOf('minutos') > 0, api.textoDeuda());

const antes = deuda.length;
api.liquidarAyer();
const despues = datos.getRange(3, 8, 30, 6).getValues().filter((f) => f[0]).length;
comprobar('liquidar dos veces no cobra dos veces', antes === despues, antes + ' -> ' + despues);

api.recordatorioDiario();
comprobar('manda el correo de la mañana', correos.length === 1, correos.length + ' correos');
comprobar('el correo lleva los habitos del dia',
  correos.length > 0 && correos[0].htmlBody.indexOf('Estudio profundo') > 0, 'no aparecen');

api.informeSemanal();
comprobar('manda el informe semanal', correos.length === 2, correos.length + ' correos');
comprobar('el informe lleva el porcentaje',
  correos.length > 1 && /\d+%/.test(correos[1].htmlBody), 'sin porcentaje');

api.verificar();
comprobar('la comprobacion integrada responde', alertas.length > 0 && alertas.join(' ').indexOf('habitos configurados') > 0,
  alertas[alertas.length - 1]);

/* ------------------------------ Formulas ------------------------------ */
let malas = [];
for (const hoja of libro.getSheets()) {
  for (const f of hoja.formulas) {
    // En Apps Script las formulas se escriben con coma; un punto y coma entre
    // argumentos falla en cuanto la hoja no esta en un idioma concreto.
    const sinTextos = f.f.replace(/"[^"]*"/g, '""');
    if (/\w\(/.test(sinTextos) && sinTextos.indexOf(';') >= 0 && !/\{/.test(sinTextos)) {
      malas.push(hoja.getName() + ': ' + f.f);
    }
  }
}
comprobar('todas las formulas usan coma como separador', malas.length === 0, malas.slice(0, 3).join(' | '));

/* ---------------------------- Rehacer ---------------------------------- */
// Rehacer el tracker sobre uno ya montado tiene que funcionar: clear() no
// deshace fusiones ni descongela filas, asi que sin limpiarlas la segunda
// pasada hereda la estructura de la primera y falla.
try {
  api.crearTracker();
  comprobar('rehacer el tracker sobre uno ya montado', true, '');
  comprobar('tras rehacerlo siguen los habitos', api.leerHabitos().length === 10,
    api.leerHabitos().length + ' habitos');
} catch (e) {
  comprobar('rehacer el tracker sobre uno ya montado', false, e.message);
}


/* ------------------- Nada cuenta antes de empezar ---------------------- */
// Un habito de "evitar" se marca solo si has caido, asi que su casilla vacia
// significa exito. Sin una fecha de inicio, la racha subia desde el 1 de enero
// y un habito recien creado aparecia con 236 dias seguidos.
{
  const evitar = api.leerHabitos().find((h) => h.tipo === 'Evitar');
  const datosAño = api.leerAño(libro, new Date().getFullYear());
  const desde = api.fechaInicio();
  comprobar('la fecha de inicio queda guardada', Boolean(desde), String(desde));
  const rachaEvitar = api.calcularRacha(datosAño, evitar, new Date(), new Date().getFullYear(), desde);
  comprobar('un habito de evitar sin tocar no inventa racha', rachaEvitar <= 1,
    rachaEvitar + ' dias de racha en "' + evitar.nombre + '"');

  const exigibles = api.exigiblesDelMes(
    api.leerHabitos()[0], new Date().getMonth(), new Date().getFullYear(), new Date(), desde);
  comprobar('los dias exigibles se cuentan desde que empezaste', exigibles <= 1,
    exigibles + ' dias exigibles el mes en que empiezas');
}

/* --------------------- Formulas que Sheets entiende -------------------- */
// Sheets no admite barras de escape dentro del formato de TEXT: contesta
// "Error de analisis de formula" y la celda queda en #ERROR!.
{
  const conEscape = [];
  for (const hoja of libro.getSheets()) {
    for (const f of hoja.formulas) {
      if (f.f.indexOf('\\') >= 0) conEscape.push(hoja.getName() + ': ' + f.f);
    }
  }
  comprobar('ninguna formula lleva barras de escape', conEscape.length === 0,
    conEscape.slice(0, 2).join(' | '));
}

/* ---------------------- Tamaño de las pestañas ------------------------- */
// Una hoja de Google nace con 26 columnas. La rejilla de un mes llega a la 40
// y el panel a la 34, asi que hay que ampliarlas antes de escribir: si no,
// Sheets contesta "Those columns are out of bounds" y aborta.
for (const nombre of ['Ago', 'Panel', 'Universidad', '_datos']) {
  const hoja = libro.getSheetByName(nombre);
  comprobar('la pestaña ' + nombre + ' se amplia a lo que necesita',
    Boolean(hoja) && hoja.getMaxColumns() >= 26,
    hoja ? hoja.getMaxColumns() + ' columnas' : 'no existe');
}

// El orden de las pestañas se calcula sobre las que existen: durante una
// construccion por partes faltan meses, y pedir una posicion mayor que el
// numero de pestañas aborta con "Invalid argument".
comprobar('las pestañas quedan en orden, con Hoy la primera',
  libro.getSheets()[0].getName() === 'Hoy' && libro.getSheets()[1].getName() === 'Panel',
  libro.getSheets().slice(0, 3).map((h) => h.getName()).join(', '));

/* ------------------ Construccion reanudable ---------------------------- */
// Apps Script corta a los seis minutos. La construccion tiene que pararse a
// tiempo, recordar por donde iba y terminar en la siguiente pasada, en vez de
// morir a medias o empezar de cero. Se comprueba con un reloj que "adelanta"
// seis minutos a partir de la llamada que se le diga.
{
  const mod = await import('./simulador-sheets.mjs?aislado=1');
  const reloj = { llamadas: 0, corteEn: Infinity };
  class RelojFalso extends Date {
    static now() {
      reloj.llamadas++;
      return Date.now() + (reloj.llamadas > reloj.corteEn ? 6 * 60 * 1000 : 0);
    }
  }
  const ctx2 = vm.createContext({
    ...mod.entorno, Date: RelojFalso, Math, Object, String, Number, Array, JSON, RegExp, isNaN,
  });
  vm.runInContext(codigo + '\n;globalThis.__api = { crearTracker, fasesHechas };', ctx2);

  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const creados = () => meses.filter((m) => mod.libro.getSheetByName(m)).length;

  // Primera pasada: se queda sin tiempo despues de cuatro fases.
  reloj.corteEn = 5;
  ctx2.__api.crearTracker();
  const trasCorte = ctx2.__api.fasesHechas().length;
  comprobar('se para a tiempo en vez de morir a los 6 minutos',
    trasCorte > 0 && trasCorte < 10, trasCorte + ' fases hechas');
  comprobar('avisa de cuantos pasos quedan',
    mod.alertas.join(' ').indexOf('Quedan') > 0, mod.alertas[mod.alertas.length - 1] || 'sin aviso');

  // Segunda pasada: ya con tiempo, continua por donde iba.
  reloj.corteEn = Infinity;
  ctx2.__api.crearTracker();
  comprobar('la segunda pasada termina la construccion',
    ctx2.__api.fasesHechas().length === 10, ctx2.__api.fasesHechas().join(','));
  comprobar('estan todas las pestañas base',
    ['Ajustes', 'Hoy', 'Panel', 'Universidad', 'Presion', 'Metodos', 'Frases', '_datos']
      .every((n) => mod.libro.getSheetByName(n)), 'falta alguna');
  comprobar('y los doce meses', creados() === 12, creados() + '/12');
}

/* --------------------------- Coste de la API --------------------------- */
// Apps Script aborta la ejecucion a los 6 minutos y cada llamada a Sheets es
// un viaje al servidor, asi que el numero de operaciones decide si
// crearTracker termina o se queda a medias. La primera version se pasaba de
// tiempo con 2.432 operaciones, casi quinientas de ellas anchos de columna
// puestos uno a uno.
//
// El tope no es una medida fisica: es un aviso de que alguien ha vuelto a
// meter un bucle que escribe celda a celda. Se mide el caso peor, que es
// rehacer el tracker sobre uno ya construido.
const TOPE_OPERACIONES = 1200;
reiniciarContador();
api.crearTracker();
comprobar('crearTracker cabe en el limite de tiempo de Apps Script',
  contador.total <= TOPE_OPERACIONES,
  contador.total + ' operaciones (tope ' + TOPE_OPERACIONES + ')');

const top = Object.entries(contador.por).sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log('\nOperaciones de crearTracker: ' + contador.total + ' (tope ' + TOPE_OPERACIONES + ')');
for (const [nombre, n] of top) console.log('   ' + String(n).padStart(5) + '  ' + nombre);

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo correcto.');
process.exit(fallos ? 1 : 0);
