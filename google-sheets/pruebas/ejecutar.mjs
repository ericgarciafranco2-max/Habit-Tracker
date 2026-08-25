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
vm.runInContext(codigo + '\n;globalThis.__api = { crearTracker, recalcularTodo, prepararHoy, liquidarAyer, informeSemanal, recordatorioDiario, onEdit, verificar, leerHabitos, leerConfig, estadoDelDia, leerAño, textoDeuda, calcularRacha, exigiblesDelMes, hechosDelMes, cumplido, aplicaHoy, fechaInicio, actualizar, fasesHechas, FILA_HABITOS };', ctx);
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

/* --------------------- Auditoria cruzada ------------------------------- */
// Dos amigos que se auditan reciben cada uno el informe del otro. Sin nombre
// son dos correos titulados igual y no se sabe cual es de quien. Y el email
// del auditor se pone en Ajustes: el contrato de Presion solo lo refleja, que
// escrito en dos sitios acababa relleno en el que nadie lee.
{
  const ajustes = libro.getSheetByName('Ajustes');
  ajustes.getRange(5, 2).setValue('Eric');
  ajustes.getRange(9, 2).setValue('auditor@example.com');
  correos.length = 0;
  api.informeSemanal();
  comprobar('el informe va a ti y a tu auditor',
    correos.length === 1 && correos[0].to.indexOf('auditor@example.com') >= 0,
    correos.length ? correos[0].to : 'sin correo');
  comprobar('y lleva tu nombre, para saber de quien es',
    correos.length === 1 && correos[0].subject.indexOf('Eric') > 0,
    correos.length ? correos[0].subject : 'sin correo');

  const presion = libro.getSheetByName('Presion');
  const contrato = presion.formulas.filter((f) => f.col === 2 && (f.fila === 7 || f.fila === 10));
  comprobar('el contrato refleja Ajustes en vez de duplicarlo',
    contrato.length === 2 && contrato.every((f) => f.f.indexOf('Ajustes!$B$') > 0),
    contrato.map((f) => f.f).join(' | ') || 'son valores escritos a mano');
  comprobar('y apunta a las filas correctas de Ajustes',
    contrato.some((f) => f.fila === 10 && f.f.indexOf('$B$9') > 0) &&
    contrato.some((f) => f.fila === 7 && f.f.indexOf('$B$10') > 0),
    contrato.map((f) => f.fila + '->' + f.f).join(' | '));

  ajustes.getRange(5, 2).setValue('');
  ajustes.getRange(9, 2).setValue('');
}

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

/* ------------- Un mes que aun no ha llegado no cuenta ------------------ */
// La pestaña de un mes futuro daba 31 exigibles y, en un habito de "evitar",
// 31 hechos: la casilla vacia significa exito, asi que octubre aparecia al
// 100% en agosto. Ni se exige ni se cumple lo que no ha pasado.
{
  const evitar = api.leerHabitos().find((h) => h.tipo === 'Evitar');
  const datosAño = api.leerAño(libro, new Date().getFullYear());
  const hasta = new Date(2026, 7, 25);   // 25 de agosto
  const desde = new Date(2026, 7, 1);

  const exigFuturo = api.exigiblesDelMes(evitar, 9, 2026, hasta, desde);
  comprobar('un mes que no ha llegado no exige nada', exigFuturo === 0,
    exigFuturo + ' dias exigibles en octubre visto desde agosto');

  const hechosFuturo = api.hechosDelMes(datosAño, evitar, 9, 2026, hasta, desde);
  comprobar('un mes que no ha llegado no da nada por cumplido', hechosFuturo === 0,
    hechosFuturo + ' dias cumplidos en octubre visto desde agosto');

  const hechosMesEnCurso = api.hechosDelMes(datosAño, evitar, 7, 2026, hasta, desde);
  comprobar('el mes en curso solo cuenta hasta hoy', hechosMesEnCurso <= 25,
    hechosMesEnCurso + ' dias cumplidos a 25 de agosto');

  const antesDeEmpezar = api.hechosDelMes(datosAño, evitar, 7, 2026, hasta, new Date(2026, 7, 20));
  comprobar('lo anterior a la fecha de inicio no suma', antesDeEmpezar <= 6,
    antesDeEmpezar + ' dias cumplidos empezando el 20 de agosto');

  // Y lo mismo escrito en la pestaña real, si este año queda algun mes por venir.
  if (new Date().getMonth() < 11) {
    api.recalcularTodo();
    const nombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const mesQueViene = new Date().getMonth() + 1;
    const hoja = libro.getSheetByName(nombres[mesQueViene]);
    const dias = new Date(new Date().getFullYear(), mesQueViene + 1, 0).getDate();
    const fila = hoja.getRange(4, dias + 2, 1, 2).getValues()[0];
    comprobar('la pestaña del mes que viene sale a cero', fila[0] === 0 && fila[1] === 0,
      fila[0] + ' hechos y ' + fila[1] + ' exigibles');
  }
}

/* --------------- Cambiar habitos no reconstruye la hoja ---------------- */
// Volver a ejecutar crearTracker con todo ya montado rehacia las veinte
// pestañas: dos pasadas de varios minutos por cambiar un nombre. Ahora
// refresca y punto.
{
  reiniciarContador();
  api.crearTracker();
  const trasSegundaLlamada = contador.total;
  comprobar('con el tracker ya montado, crearTracker solo refresca',
    trasSegundaLlamada < 300, trasSegundaLlamada + ' operaciones (una construccion son ~900)');
  comprobar('y no borra el progreso',
    api.fasesHechas().length >= 20, api.fasesHechas().length + ' fases marcadas');

  // Editar un habito en Ajustes refresca la pestaña Hoy sin tocar nada mas.
  const ajustes = libro.getSheetByName('Ajustes');
  ajustes.getRange(api.FILA_HABITOS + 1, 2).setValue('Levantarme temprano');
  api.onEdit({ range: ajustes.getRange(api.FILA_HABITOS + 1, 2) });
  const hojaHoy2 = libro.getSheetByName('Hoy');
  comprobar('cambiar un habito se refleja solo en Hoy',
    String(hojaHoy2.getRange(11, 1).getValue()).indexOf('temprano') > 0,
    hojaHoy2.getRange(11, 1).getValue());
}

/* ------------------- Idioma de la hoja y separadores -------------------- */
// Apps Script escribe las formulas tal cual: una hoja en español espera punto
// y coma donde una en ingles espera coma. Con el separador equivocado TODAS
// las formulas quedan en #ERROR!, incluidas las triviales.
{
  const mod = await import('./simulador-sheets.mjs?espanol=1');
  mod.config.separador = ';';
  const ctx3 = vm.createContext({
    ...mod.entorno, Date, Math, Object, String, Number, Array, JSON, RegExp, isNaN,
  });
  vm.runInContext(codigo + '\n;globalThis.__api = { crearTracker };', ctx3);
  ctx3.__api.crearTracker();

  const todas = mod.libro.getSheets().flatMap((h) => h.formulas.map((x) => x.f));
  const conComa = todas.filter((f) => /=(IF|AND|OR|TEXT|QUERY|ROUND|SUMIF|MIN|DATE|WEEKDAY)\(/.test(f)
    && /\((?:[^"()]|"[^"]*")*,/.test(f));
  comprobar('en una hoja en español las formulas usan punto y coma',
    conComa.length === 0 && todas.length > 10,
    conComa.length ? conComa[0].slice(0, 70) : 'solo ' + todas.length + ' formulas');

  const reglas = mod.libro.getSheets().flatMap((h) => (h.reglas || []).map((r) => r.formula));
  const reglasConComa = reglas.filter((f) => f && /\((?:[^"()]|"[^"]*")*,/.test(f));
  comprobar('y las reglas de formato tambien',
    reglasConComa.length === 0 && reglas.length > 0,
    reglasConComa.length ? reglasConComa[0].slice(0, 70) : 'sin reglas');
}

/* ------------------- Nada volatil en el formato condicional ------------ */
// Una funcion volatil (INDIRECT, TODAY, NOW, RAND, OFFSET) dentro de una regla
// de formato se evalua en CADA casilla y se reevalua sin parar. Con doce
// rejillas de 775 casillas son mas de cien mil evaluaciones continuas: la hoja
// se arrastra y la construccion se queda sin tiempo. Esto ya paso dos veces.
{
  const volatiles = /\b(INDIRECT|TODAY|NOW|RAND|RANDBETWEEN|OFFSET)\s*\(/;
  const culpables = [];
  for (const hoja of libro.getSheets()) {
    for (const regla of hoja.reglas || []) {
      if (regla.formula && volatiles.test(regla.formula)) {
        culpables.push(hoja.getName() + ': ' + regla.formula.slice(0, 60));
      }
    }
  }
  comprobar('ninguna regla de formato usa funciones volatiles', culpables.length === 0,
    culpables.slice(0, 2).join(' | '));
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
// La construccion completa no cabe en los 6 minutos que da Apps Script. Va por
// fases pequeñas, apunta cada una, y al quedarse sin tiempo deja programada
// una continuacion para dentro de un minuto: termina sola.
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
  vm.runInContext(codigo +
    '\n;globalThis.__api = { crearTracker, continuarConstruccion, fasesHechas, FASES };', ctx2);

  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const creados = () => meses.filter((m) => mod.libro.getSheetByName(m)).length;
  const total = ctx2.__api.FASES.length;

  // Primera pasada: se queda sin tiempo tras unas pocas fases.
  reloj.corteEn = 6;
  ctx2.__api.crearTracker();
  const trasCorte = ctx2.__api.fasesHechas().length;
  comprobar('se para a tiempo en vez de morir a los 6 minutos',
    trasCorte > 0 && trasCorte < total, trasCorte + ' de ' + total + ' fases');
  comprobar('deja el mes en curso listo lo primero', creados() >= 1, creados() + ' meses');
  comprobar('avisa de cuantos pasos quedan',
    mod.alertas.join(' ').indexOf('Quedan') > 0, mod.alertas[mod.alertas.length - 1] || 'sin aviso');
  comprobar('programa la continuacion automatica',
    mod.disparadores.some((t) => t.getHandlerFunction() === 'continuarConstruccion'),
    mod.disparadores.map((t) => t.getHandlerFunction()).join(',') || 'ninguno');

  // El disparador dispara: sigue por donde iba y termina.
  reloj.corteEn = Infinity;
  ctx2.__api.continuarConstruccion();
  comprobar('la continuacion termina la construccion',
    ctx2.__api.fasesHechas().length === total, ctx2.__api.fasesHechas().length + ' de ' + total);
  comprobar('al terminar no deja disparadores de continuacion colgando',
    !mod.disparadores.some((t) => t.getHandlerFunction() === 'continuarConstruccion'),
    mod.disparadores.map((t) => t.getHandlerFunction()).join(','));
  comprobar('estan todas las pestañas base',
    ['Ajustes', 'Hoy', 'Panel', 'Universidad', 'Presion', 'Metodos', 'Frases', '_datos']
      .every((n) => mod.libro.getSheetByName(n)), 'falta alguna');
  comprobar('y los doce meses', creados() === 12, creados() + '/12');
}

/* ------------- La construccion sobrevive a una muerte subita ----------- */
// El corte por tiempo se mira ENTRE fases, asi que una fase que arranca al
// filo puede llevarse por delante los 6 minutos sin pasar por el aviso
// ordenado. Antes, cuando eso pasaba no quedaba nada programado: el tracker se
// quedaba a medias hasta que alguien volvia a darle a Ejecutar. Ahora la red
// de seguridad se arma ANTES de construir nada.
{
  const mod = await import('./simulador-sheets.mjs?muerte=1');
  // Sin Charts, la fase del Panel revienta: una muerte subita como cualquier
  // otra, y sin aviso ordenado de por medio.
  const roto = { ...mod.entorno };
  delete roto.Charts;
  const ctx4 = vm.createContext({
    ...roto, Date, Math, Object, String, Number, Array, JSON, RegExp, isNaN,
  });
  vm.runInContext(codigo +
    '\n;globalThis.__api = { crearTracker, continuarConstruccion, fasesHechas, FASES, MAX_INTENTOS };', ctx4);

  let murio = false;
  try { ctx4.__api.crearTracker(); } catch (err) { murio = true; }
  comprobar('la fase que falla tumba la ejecucion', murio, 'no fallo, la prueba no vale');

  const red = mod.disparadores.filter((t) => t.getHandlerFunction() === 'continuarConstruccion');
  comprobar('una muerte subita deja programada la continuacion', red.length === 1,
    red.length + ' disparadores de continuacion');
  comprobar('y la programa por encima del limite de 6 minutos, para no pisarse',
    red.length === 1 && red[0].retraso > 6 * 60 * 1000, red.length ? red[0].retraso + ' ms' : 'ninguno');

  // Arreglado lo que fallaba, la continuacion termina el trabajo.
  const ctx5 = vm.createContext({
    ...mod.entorno, Date, Math, Object, String, Number, Array, JSON, RegExp, isNaN,
  });
  vm.runInContext(codigo +
    '\n;globalThis.__api = { crearTracker, continuarConstruccion, fasesHechas, FASES };', ctx5);
  ctx5.__api.continuarConstruccion();
  comprobar('y al reanudar termina por donde iba',
    ctx5.__api.fasesHechas().length === ctx5.__api.FASES.length,
    ctx5.__api.fasesHechas().length + ' de ' + ctx5.__api.FASES.length + ' fases');

  // Un fallo que se repite siempre no puede dejar un disparador rearmandose
  // cada siete minutos hasta el fin de los tiempos.
  const mod2 = await import('./simulador-sheets.mjs?tope=1');
  const roto2 = { ...mod2.entorno };
  delete roto2.Charts;
  const ctx6 = vm.createContext({
    ...roto2, Date, Math, Object, String, Number, Array, JSON, RegExp, isNaN,
  });
  vm.runInContext(codigo +
    '\n;globalThis.__api = { crearTracker, MAX_INTENTOS };', ctx6);
  for (let i = 0; i < ctx6.__api.MAX_INTENTOS + 1; i++) {
    try { ctx6.__api.crearTracker(); } catch (err) { /* muere en la misma fase */ }
  }
  comprobar('deja de reintentar cuando el fallo se repite siempre',
    !mod2.disparadores.some((t) => t.getHandlerFunction() === 'continuarConstruccion'),
    mod2.disparadores.map((t) => t.getHandlerFunction()).join(',') || 'ninguno');
  comprobar('y dice donde mirar el error',
    mod2.alertas.join(' ').indexOf('Ejecuciones') > 0,
    mod2.alertas[mod2.alertas.length - 1] || 'sin aviso');
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
