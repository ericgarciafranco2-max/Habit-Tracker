/**
 * HABIT TRACKER — versión completa dentro de Google Sheets.
 *
 * Pegas este fichero en una hoja de cálculo vacía, ejecutas `crearTracker` y
 * te construye el tracker entero: pestañas, formatos, fórmulas, gráficos,
 * validaciones y los avisos automáticos por correo.
 *
 * Qué gana esta versión frente a la aplicación:
 *   - No hay nada que instalar ni que desplegar. Se abre donde se abre Sheets.
 *   - Los recordatorios llegan de verdad. Un navegador no despierta a una web
 *     cerrada; un disparador de Apps Script sí manda el correo cada mañana y
 *     el informe a tu auditor cada domingo, esté tu móvil como esté.
 *
 * Qué se pierde, para que lo sepas antes de empezar:
 *   - Nada puede bloquearte de verdad. Las recompensas dicen BLOQUEADAS, pero
 *     es una celda, no un candado. En la app tampoco era un candado, pero sí
 *     una pantalla que te lo ponía delante.
 *   - No hay cronómetro de estudio ni planificador que reparta los bloques.
 *   - Marcar en el móvil se hace en la pestaña "Hoy", que es una lista corta.
 *     La rejilla del mes en un móvil es para mirar, no para marcar.
 *
 * Cómo se reparte el trabajo entre fórmulas y código: las fórmulas se quedan
 * con lo que es trivialmente correcto (contar, sumar, minigráficos) y el
 * código con todo lo que depende del calendario de cada hábito (días
 * exigibles, rachas, XP, veredicto). Tener eso en fórmulas encadenadas es
 * donde estas plantillas se rompen en cuanto tocas una fila.
 */

/* ================================================================== */
/* Configuración                                                       */
/* ================================================================== */

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_INICIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const HOJA_AJUSTES = 'Ajustes';
const HOJA_HOY = 'Hoy';
const HOJA_PANEL = 'Panel';
const HOJA_UNI = 'Universidad';
const HOJA_PRESION = 'Presion';
const HOJA_METODOS = 'Metodos';
const HOJA_FRASES = 'Frases';
const HOJA_DATOS = '_datos';

/** Momento en que arrancó esta ejecución, para no pasarse del limite. */
const ARRANQUE = Date.now();
/**
 * Apps Script corta a los 6 minutos. Paramos a los 3 porque el corte solo se
 * comprueba ENTRE fases: si una fase larga arranca al filo, se lleva por
 * delante el margen. Con 3 minutos cabe la fase mas lenta y sobra.
 */
const LIMITE_MS = 3 * 60 * 1000;

/**
 * Separador de argumentos de las formulas.
 *
 * Apps Script escribe las formulas tal cual, y una hoja en español espera
 * punto y coma donde una en ingles espera coma. Con el separador equivocado
 * TODAS las formulas quedan en #ERROR!. Se detecta probando las dos en una
 * pestaña temporal, asi que funciona sea cual sea el idioma de la hoja.
 */
let SEP = ',';

/** En las formulas se escribe ~ donde va el separador. */
function form(texto) {
  return texto.split('~').join(SEP);
}

function detectarSeparador(ss) {
  const tmp = ss.insertSheet('_sep_' + Date.now());
  try {
    tmp.getRange(1, 1).setFormula('=IF(1=1,"si","no")');
    tmp.getRange(2, 1).setFormula('=IF(1=1;"si";"no")');
    SpreadsheetApp.flush();
    if (tmp.getRange(1, 1).getValue() === 'si') return ',';
    if (tmp.getRange(2, 1).getValue() === 'si') return ';';
    return ',';
  } finally {
    ss.deleteSheet(tmp);
  }
}

function quedaTiempo() {
  return Date.now() - ARRANQUE < LIMITE_MS;
}

/** Numero de columna a letra: B, AA, AH... */
function letraColumna(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Fila de la cabecera de la tabla de habitos en Ajustes.
 *
 * Tiene que quedar por debajo del bloque de configuracion (filas 5 a 12): con
 * el valor anterior, la ultima fila de configuracion caia justo encima de esta
 * cabecera y se perdia al escribir la tabla.
 */
const FILA_HABITOS = 15;
/** Fila donde empieza la rejilla de hábitos en cada mes. */
const FILA_REJILLA = 4;
const MAX_HABITOS = 25;

// Paleta: los mismos tonos que la aplicación, para que las dos versiones se
// parezcan. Están elegidos para distinguirse también en impresión y para
// quien no distingue el rojo del verde.
const C = {
  tinta: '#1d1d1f',
  suave: '#6e6e73',
  linea: '#d2d2d7',
  fondo: '#f5f5f7',
  blanco: '#ffffff',
  acento: '#0071e3',
  bien: '#157a3a',
  bienSuave: '#d6f0dd',
  aviso: '#b06d00',
  avisoSuave: '#fdf0d5',
  malo: '#b3261e',
  maloSuave: '#fbe0de',
  neutro: '#6b7a99',
};

/** Catálogo inicial. Todo editable en la pestaña Ajustes. */
const HABITOS_INICIALES = [
  ['⏰', 'Levantarme a la hora', 'Disciplina', 'Hacer', 'Si/No', 1, 1, '', 'Todos los dias', 'SI', 5, 15, 'minutos', 'Sin snooze. Si suena, te levantas.'],
  ['📅', 'Planificar el dia', 'Disciplina', 'Hacer', 'Si/No', 1, 1, '', 'Todos los dias', '', 4, 0, '', '5 minutos: las 3 cosas de hoy.'],
  ['📚', 'Estudio profundo', 'Estudio', 'Hacer', 'Minutos', 90, 25, 'min', 'Todos los dias', 'SI', 5, 45, 'minutos', 'Movil fuera de la mesa.'],
  ['🎓', 'Asistir a clase', 'Estudio', 'Hacer', 'Si/No', 1, 1, '', 'Lunes a viernes', '', 4, 60, 'minutos', 'Faltar cuesta el doble de recuperar.'],
  ['🏋️', 'Entrenar', 'Salud', 'Hacer', 'Si/No', 1, 1, '', '4x por semana', '', 4, 15, 'minutos', 'Minimo valido: 15 min de algo.'],
  ['📖', 'Leer', 'Mente', 'Hacer', 'Cantidad', 20, 5, 'paginas', 'Todos los dias', '', 3, 10, 'paginas', ''],
  ['🧘', 'Meditar', 'Mente', 'Hacer', 'Minutos', 10, 3, 'min', 'Todos los dias', '', 2, 0, '', ''],
  ['📵', 'Sin redes hasta la noche', 'Disciplina', 'Evitar', 'Si/No', 0, 0, '', 'Todos los dias', '', 4, 30, 'minutos', 'Marca la casilla solo si has caido.'],
  ['💧', 'Agua', 'Salud', 'Hacer', 'Cantidad', 8, 5, 'vasos', 'Todos los dias', '', 1, 0, '', ''],
  ['🌙', 'Dormir a mi hora', 'Salud', 'Hacer', 'Si/No', 1, 1, '', 'Todos los dias', 'SI', 5, 20, 'minutos', ''],
];

const PENITENCIAS_INICIALES = [
  ['50 burpees hoy, antes de dormir', 1],
  ['30 min extra de estudio mañana', 1],
  ['Fin de semana sin videojuegos', 2],
  ['10 EUR fuera de mi bolsillo', 2],
  ['Sabado de 4h de estudio antes de cualquier plan', 3],
];

const RECOMPENSAS_INICIALES = [
  ['🎮', 'Una hora de juego o serie', 'Diaria'],
  ['📱', 'Scroll libre 30 min', 'Diaria'],
  ['🍕', 'Comida de capricho', 'Semanal'],
  ['🍻', 'Salir el sabado sin culpa', 'Semanal'],
];

/* ================================================================== */
/* Menú                                                                */
/* ================================================================== */

/**
 * La interfaz de la hoja solo existe si el script se ejecuta desde la hoja
 * abierta. Desde el editor de Apps Script no hay dialogos, asi que todo lo que
 * los usa tiene que seguir funcionando sin ellos.
 */
function interfaz() {
  try {
    return SpreadsheetApp.getUi();
  } catch (err) {
    return null;
  }
}

function avisar(titulo, mensaje) {
  const ui = interfaz();
  if (ui) ui.alert(titulo, mensaje, ui.ButtonSet.OK);
  else Logger.log(titulo + '\n' + mensaje);
}

function onOpen() {
  const ui = interfaz();
  if (!ui) return;
  ui.createMenu('⚡ Habit Tracker')
    // Lo primero es lo que se usa a diario; reconstruir queda al final,
    // separado, porque tarda minutos y casi nunca hace falta.
    .addItem('Actualizar tras cambiar habitos', 'actualizar')
    .addItem('Preparar el dia de hoy', 'prepararHoy')
    .addSeparator()
    .addItem('Crear o continuar el tracker', 'crearTracker')
    .addItem('Liquidar el dia de ayer', 'liquidarAyer')
    .addItem('Enviar informe semanal', 'informeSemanal')
    .addSeparator()
    .addItem('Activar avisos automaticos', 'activarAvisos')
    // Para comprobar desde el movil que el correo sale de verdad, sin tener
    // que abrir el editor de Apps Script ni esperar a las 7 de la mañana.
    .addItem('Enviar ahora el aviso de hoy', 'recordatorioDiario')
    .addItem('Comprobar que todo esta bien', 'verificar')
    .addSeparator()
    .addItem('Rehacer el tracker desde cero', 'rehacerTracker')
    .addToUi();
  try {
    prepararHoy();
  } catch (err) {
    // Si aun no existe el tracker, el menu basta.
  }
}

/* ================================================================== */
/* Construcción                                                        */
/* ================================================================== */

/**
 * Las fases de la construccion. Cada una se marca como hecha en cuanto
 * termina, asi que si Apps Script corta la ejecucion a los seis minutos, la
 * siguiente sigue por donde iba en vez de empezar de cero.
 */
const FASES = ['datos', 'ajustes', 'hoy', 'panel', 'universidad', 'presion', 'metodos', 'frases']
  .concat(MESES.map(function (m) { return 'mes-' + m; }))
  .concat(['orden', 'validaciones', 'recalculo', 'preparar']);
const PROP_PROGRESO = 'PROGRESO_CONSTRUCCION';
const PROP_INTENTOS = 'INTENTOS_CONSTRUCCION';
/**
 * Tope de pasadas de construccion. La red de seguridad reintenta sola, y sin
 * un tope un fallo que se repite siempre dejaria un disparador rearmandose
 * cada siete minutos para siempre.
 */
const MAX_INTENTOS = 15;

function fasesHechas() {
  const v = PropertiesService.getScriptProperties().getProperty(PROP_PROGRESO);
  return v ? v.split(',') : [];
}

function marcarFase(nombre) {
  const hechas = fasesHechas();
  if (hechas.indexOf(nombre) < 0) hechas.push(nombre);
  PropertiesService.getScriptProperties().setProperty(PROP_PROGRESO, hechas.join(','));
}

function reiniciarProgreso() {
  PropertiesService.getScriptProperties().setProperty(PROP_PROGRESO, '');
  PropertiesService.getScriptProperties().setProperty(PROP_INTENTOS, '0');
}

function intentosDeConstruccion() {
  return Number(PropertiesService.getScriptProperties().getProperty(PROP_INTENTOS)) || 0;
}

/**
 * Quita el formato condicional de las pestañas de meses que ya existan, antes
 * de tocar nada mas.
 *
 * Las versiones anteriores usaban INDIRECT en esas reglas, que es volatil: si
 * quedan doce rejillas con esas reglas puestas, la hoja se pasa el rato
 * recalculando cientos de miles de celdas y CADA escritura del script se queda
 * esperando. Aunque el codigo nuevo ya no las use, las reglas viejas siguen en
 * la hoja hasta que alguien las borra, y envenenan la ejecucion entera.
 */
function limpiarFormatosVolatiles(ss) {
  for (let m = 0; m < 12; m++) {
    const hoja = ss.getSheetByName(MESES[m]);
    if (hoja) hoja.setConditionalFormatRules([]);
  }
}

/**
 * Programa una continuacion dentro de un minuto.
 *
 * Apps Script no puede alargar una ejecucion, pero si dejar programada la
 * siguiente. Asi la construccion termina sola en un par de pasadas sin que
 * tengas que estar dandole a Ejecutar.
 */
function programarContinuacion() {
  borrarContinuaciones();
  ScriptApp.newTrigger('continuarConstruccion').timeBased().after(60 * 1000).create();
}

function borrarContinuaciones() {
  const lista = ScriptApp.getProjectTriggers();
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].getHandlerFunction() === 'continuarConstruccion') ScriptApp.deleteTrigger(lista[i]);
  }
}

/**
 * Red de seguridad: un disparador que retoma la construccion aunque esta
 * ejecucion muera de golpe.
 *
 * El corte por tiempo se comprueba ENTRE fases, asi que una fase que arranca
 * al filo puede llevarse por delante el limite de seis minutos sin pasar por
 * el aviso ordenado. Cuando eso pasa no queda nada programado y el tracker se
 * queda a medias hasta que alguien vuelve a darle a Ejecutar.
 *
 * Va a siete minutos a proposito: mas alla del limite duro, para no arrancar
 * una segunda ejecucion encima de la que esta corriendo. Si esta termina bien,
 * lo borra; si se para de forma ordenada, lo reprograma a un minuto.
 */
function armarRedDeSeguridad() {
  try {
    borrarContinuaciones();
    ScriptApp.newTrigger('continuarConstruccion').timeBased().after(7 * 60 * 1000).create();
  } catch (err) {
    // Sin permiso para crear disparadores se sigue construyendo igual: la red
    // es una comodidad, no un requisito.
    Logger.log('no se pudo armar la red de seguridad: ' + err);
  }
}

/** La ejecuta el disparador: se limpia a si misma y sigue construyendo. */
function continuarConstruccion() {
  borrarContinuaciones();
  crearTracker();
}

function trabajoDeFase(ss, año, fase) {
  if (fase.indexOf('mes-') === 0) {
    const mes = MESES.indexOf(fase.slice(4));
    return function () { construirMes(ss, mes, año); };
  }
  const mapa = {
    'datos': function () { construirDatos(ss, año); },
    'ajustes': function () { construirAjustes(ss, año); },
    'hoy': function () { construirHoy(ss); },
    'panel': function () { construirPanel(ss); },
    'universidad': function () { construirUniversidad(ss); },
    'presion': function () { construirPresion(ss); },
    'metodos': function () { construirMetodos(ss); },
    'frases': function () { construirFrases(ss); },
    'orden': function () { limpiarSobrantes(ss); ordenarPestañas(ss); },
    'validaciones': function () {
      aplicarValidaciones(ss, leerHabitos(), año, new Date().getMonth());
    },
    'recalculo': function () { recalcularTodo(); },
    'preparar': function () { prepararHoy(); },
  };
  return mapa[fase];
}

/**
 * Lo que hay que ejecutar despues de tocar los habitos en Ajustes.
 *
 * No reconstruye nada: solo recalcula y rehace la lista de Hoy. Reconstruir
 * las veinte pestañas por cambiar un habito son dos pasadas de varios minutos
 * para nada.
 */
function actualizar() {
  recalcularTodo();
  prepararHoy();
  avisar('Actualizado', 'Hoy y el Panel ya reflejan tus habitos.');
}

/** Tira la estructura y la vuelve a levantar. Solo si algo esta roto. */
function rehacerTracker() {
  const ui = interfaz();
  if (ui) {
    const r = ui.alert(
      'Rehacer desde cero',
      'Se rehace la estructura de las veinte pestañas. Tarda varios minutos y puede ' +
        'necesitar un par de pasadas.\n\nTus marcas NO se borran.\n\n' +
        'Si solo has cambiado habitos, no hace falta: usa "Actualizar tras cambiar habitos".\n\n¿Sigo?',
      ui.ButtonSet.YES_NO,
    );
    if (r !== ui.Button.YES) return;
  }
  reiniciarProgreso();
  crearTracker();
}

function crearTracker() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error(
      'Este script no esta enganchado a ninguna hoja de calculo. Abrelo desde la hoja ' +
      'con Extensiones > Apps Script, no desde script.google.com.',
    );
  }
  const ui = interfaz();
  const año = new Date().getFullYear();
  // Antes de escribir una sola formula: en una hoja en español el separador
  // es el punto y coma, y con el equivocado no funciona ninguna.
  SEP = detectarSeparador(ss);
  Logger.log('separador de formulas: "' + SEP + '"');
  let hechas = fasesHechas();
  const reanudando = hechas.length > 0 && hechas.length < FASES.length;

  // Ya estaba todo montado: lo util es refrescar, no reconstruir. Antes,
  // darle a Ejecutar despues de cambiar un habito rehacia las veinte pestañas
  // y se comia el limite de tiempo.
  if (hechas.length >= FASES.length && ss.getSheetByName(HOJA_AJUSTES)) {
    actualizar();
    return;
  }

  if (!reanudando) {
    reiniciarProgreso();
    hechas = [];
    ss.setSpreadsheetTimeZone(ss.getSpreadsheetTimeZone() || 'Europe/Madrid');
    limpiarFormatosVolatiles(ss);
  }

  const intento = intentosDeConstruccion() + 1;
  PropertiesService.getScriptProperties().setProperty(PROP_INTENTOS, String(intento));
  if (intento > MAX_INTENTOS) {
    borrarContinuaciones();
    avisar(
      'Construccion detenida',
      'Van ' + (intento - 1) + ' intentos y sigue sin terminar, asi que dejo de reintentar ' +
        'para no estar rearmando disparadores sin fin.\n\n' +
        'Mira Ejecuciones en el editor de Apps Script: ahi esta el error concreto.\n\n' +
        'Cuando lo tengas, "Rehacer el tracker desde cero" vuelve a empezar.',
    );
    return;
  }
  armarRedDeSeguridad();

  // El mes en curso primero: en cuanto esta, ya puedes empezar a marcar.
  const mesActual = 'mes-' + MESES[new Date().getMonth()];
  const orden = [mesActual].concat(FASES.filter(function (f) { return f !== mesActual; }));

  for (let i = 0; i < orden.length; i++) {
    const fase = orden[i];
    if (fasesHechas().indexOf(fase) >= 0) continue;
    if (!quedaTiempo()) {
      const quedan = FASES.length - fasesHechas().length;
      programarContinuacion();
      avisar(
        'Va por buen camino',
        'Apps Script corta las ejecuciones a los 6 minutos, asi que se ha parado a tiempo.\n\n' +
          'Quedan ' + quedan + ' pasos de ' + FASES.length + '.\n\n' +
          'No tienes que hacer nada: seguira sola dentro de un minuto. Si prefieres no esperar, ' +
          'vuelve a ejecutar "Crear / rehacer el tracker".',
      );
      return;
    }
    const trabajo = trabajoDeFase(ss, año, fase);
    if (trabajo) {
      // Cronometro por fase: en el registro de ejecucion se ve cual se lleva
      // el tiempo. Adivinar donde esta el cuello de botella de Sheets desde
      // fuera no funciona; medirlo, si.
      const t0 = Date.now();
      trabajo();
      Logger.log('fase ' + fase + ': ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    }
    marcarFase(fase);
  }

  Logger.log('construccion completa en ' + ((Date.now() - ARRANQUE) / 1000).toFixed(1) + ' s');
  borrarContinuaciones();
  const hoja = ss.getSheetByName(HOJA_HOY);
  if (hoja) ss.setActiveSheet(hoja);
  avisar(
    'Listo',
    'Tu tracker esta montado.\n\n' +
      '1. Repasa la pestaña Ajustes: tus habitos, tus horarios y el email de tu auditor.\n' +
      '2. Marca cada dia en la pestaña Hoy.\n' +
      '3. Menu ⚡ Habit Tracker > Activar avisos automaticos, para el correo de cada mañana y el informe de los domingos.',
  );
}

function hojaLimpia(ss, nombre, filas, columnas) {
  let h = ss.getSheetByName(nombre);
  const nueva = !h;
  if (nueva) h = ss.insertSheet(nombre);

  if (columnas) {
    const maxC = h.getMaxColumns();
    if (maxC < columnas) h.insertColumnsAfter(maxC, columnas - maxC);
  }
  if (filas) {
    const maxF = h.getMaxRows();
    if (maxF < filas) h.insertRowsAfter(maxF, filas - maxF);
  }

  if (!nueva) {
    // Una pestaña recien creada no tiene nada que limpiar; hacerlo igualmente
    // en veinte pestañas es tiempo tirado del limite de seis minutos.
    h.clear();
    // clear() no deshace fusiones ni descongela: sin esto, rehacer el tracker
    // arrastra la estructura de la vez anterior.
    h.setFrozenRows(0);
    h.setFrozenColumns(0);
    h.getRange(1, 1, Math.min(h.getMaxRows(), 120), Math.min(h.getMaxColumns(), 45)).breakApart();
    h.clearConditionalFormatRules();
    const dibujos = h.getCharts();
    for (let i = 0; i < dibujos.length; i++) h.removeChart(dibujos[i]);
  }
  h.setHiddenGridlines(true);
  return h;
}

function titulo(hoja, texto, subtitulo, ancho) {
  hoja.getRange(1, 1).setValue(texto).setFontSize(20).setFontWeight('bold');
  if (subtitulo) hoja.getRange(2, 1).setValue(subtitulo).setFontColor(C.suave);
  hoja.setFrozenRows(2);
}

function cabecera(hoja, fila, columna, valores) {
  const r = hoja.getRange(fila, columna, 1, valores.length);
  r.setValues([valores]).setFontWeight('bold').setFontColor(C.suave).setBackground(C.fondo);
  return r;
}

/* ------------------------------ Ajustes --------------------------- */

function construirAjustes(ss, año) {
  const h = hojaLimpia(ss, HOJA_AJUSTES, FILA_HABITOS + MAX_HABITOS + 6, 16);
  titulo(h, 'Ajustes', 'Cambia aqui lo que quieras. Todo lo demas se recalcula solo.', 14);

  const config = [
    ['Tu nombre', ''],
    ['Año', año],
    ['Hora de corte del dia', '04:00'],
    ['Email para los avisos', ''],
    ['Email de tu auditor', ''],
    ['Minimo semanal exigido (%)', 85],
    ['Congelaciones al mes', 2],
    ['Empezado el', ''],
  ];
  h.getRange(4, 1).setValue('CONFIGURACION').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  // Si ya habia una fecha de inicio, se respeta: rehacer el tracker no puede
  // borrar desde cuando llevas registrando.
  const inicioPrevio = leerConfig('Empezado el');
  config[7][1] = inicioPrevio || new Date();
  h.getRange(5, 1, config.length, 2).setValues(config);
  h.getRange(5 + config.length - 1, 2).setNumberFormat('dd/mm/yyyy');
  h.getRange(5, 1, config.length, 1).setFontColor(C.suave);
  h.getRange(5, 2, config.length, 1).setBackground(C.fondo).setFontWeight('bold');
  h.getRange(6, 2).setNumberFormat('0');
  h.getRange(10, 2).setNumberFormat('0');

  const cols = ['Icono', 'Habito', 'Categoria', 'Tipo', 'Medida', 'Objetivo', 'Minimo',
    'Unidad', 'Cuando', 'Innegociable', 'Peso', 'Deuda si fallo', 'Unidad deuda', 'Notas'];
  h.getRange(FILA_HABITOS - 1, 1).setValue('TUS HABITOS')
    .setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, FILA_HABITOS, 1, cols);
  h.getRange(FILA_HABITOS + 1, 1, HABITOS_INICIALES.length, cols.length).setValues(HABITOS_INICIALES);

  const filas = MAX_HABITOS;
  lista(h, FILA_HABITOS + 1, 3, filas, ['Salud', 'Mente', 'Estudio', 'Disciplina', 'Social', 'Finanzas', 'Otro']);
  lista(h, FILA_HABITOS + 1, 4, filas, ['Hacer', 'Evitar']);
  lista(h, FILA_HABITOS + 1, 5, filas, ['Si/No', 'Cantidad', 'Minutos']);
  lista(h, FILA_HABITOS + 1, 9, filas, ['Todos los dias', 'Lunes a viernes', 'Fin de semana',
    '1x por semana', '2x por semana', '3x por semana', '4x por semana', '5x por semana', '6x por semana']);
  lista(h, FILA_HABITOS + 1, 10, filas, ['SI', '']);

  h.getRange(FILA_HABITOS + 1, 1, filas, cols.length)
    .setBorder(null, null, null, null, null, true, C.linea, SpreadsheetApp.BorderStyle.SOLID);
  h.getRange(FILA_HABITOS + 1, 10, filas, 1).setHorizontalAlignment('center')
    .setFontColor(C.malo).setFontWeight('bold');

  h.setColumnWidth(1, 50);
  h.setColumnWidth(2, 210);
  h.setColumnWidths(3, 11, 95);
  h.setColumnWidth(14, 280);
  h.setFrozenColumns(2);

  nota(h, FILA_HABITOS + filas + 2,
    'El MINIMO es tu regla anti-cero: el dia que no puedas, haces eso y la racha sigue viva. Ponlo tan bajo que sea absurdo no hacerlo.\n' +
    'INNEGOCIABLE marca los que bloquean tus recompensas del dia. Elige dos o tres: si todo es innegociable, nada lo es.\n' +
    'DEUDA es lo que se te acumula cada vez que fallas ese habito, y que tendras que pagar haciendo de mas.');
}

function lista(hoja, fila, columna, filas, valores) {
  const regla = SpreadsheetApp.newDataValidation()
    .requireValueInList(valores, true).setAllowInvalid(false).build();
  hoja.getRange(fila, columna, filas, 1).setDataValidation(regla);
}

function nota(hoja, fila, texto) {
  // Google no deja fusionar columnas inmovilizadas con las que no lo estan,
  // asi que la nota arranca despues de la parte congelada de cada pestaña.
  const inicio = hoja.getFrozenColumns() + 1;
  hoja.getRange(fila, inicio, 1, 8).merge()
    .setValue(texto).setFontSize(10).setFontColor(C.suave)
    .setWrap(true).setVerticalAlignment('top');
  hoja.setRowHeight(fila, 58);
}

/* ------------------------------- Meses ---------------------------- */

function construirMes(ss, mes, año) {
  // La rejilla ocupa hasta la columna dias+8 (objetivo, minimo y calendario).
  const diasDelMes = new Date(año, mes + 1, 0).getDate();
  const h = hojaLimpia(ss, MESES[mes], FILA_REJILLA + MAX_HABITOS + 4, diasDelMes + 10);
  const dias = diasDelMes;
  titulo(h, MESES_LARGO[mes].charAt(0).toUpperCase() + MESES_LARGO[mes].slice(1),
    'Marca aqui o, mas comodo, en la pestaña Hoy.', dias + 5);

  // Fila 3: inicial del dia de la semana. Fila 4 en adelante: los habitos.
  const iniciales = [];
  const numeros = [];
  for (let d = 1; d <= dias; d++) {
    const fecha = new Date(año, mes, d);
    iniciales.push(DIAS_INICIAL[fecha.getDay()]);
    numeros.push(d);
  }
  h.getRange(3, 1).setValue('Habito').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  h.getRange(3, 2, 1, dias).setValues([iniciales])
    .setFontSize(9).setFontColor(C.suave).setHorizontalAlignment('center');
  h.getRange(2, 2, 1, dias).setValues([numeros])
    .setFontSize(9).setFontColor(C.suave).setHorizontalAlignment('center').setFontWeight('bold');

  // Fines de semana en gris para orientarse de un vistazo. En una sola
  // escritura: una por dia eran mas de cien viajes al servidor.
  const fondos = [[], []];
  for (let d = 1; d <= dias; d++) {
    const wd = new Date(año, mes, d).getDay();
    const color = wd === 0 || wd === 6 ? C.fondo : C.blanco;
    fondos[0].push(color);
    fondos[1].push(color);
  }
  h.getRange(2, 2, 2, dias).setBackgrounds(fondos);

  const resumen = ['Hechos', 'Exigibles', '%', 'Racha'];
  cabecera(h, 3, dias + 2, resumen);

  // Columnas de apoyo ocultas con el objetivo, el minimo y el calendario de
  // cada habito, traidos de Ajustes. Existen para que el formato condicional
  // pueda referirse a ellos con una referencia normal: la version anterior
  // usaba INDIRECT, que es volatil, y obligaba a la hoja a reevaluar cientos
  // de miles de celdas continuamente. Eso, y no el numero de llamadas, es lo
  // que agotaba los seis minutos de Apps Script.
  const apoyo = dias + 6;
  cabecera(h, 3, apoyo, ['Objetivo', 'Minimo', 'Cuando']);
  const desfaseAjustes = FILA_HABITOS + 1 - FILA_REJILLA;
  const objetivos = [];
  const minimos = [];
  const cuandos = [];
  for (let i = 0; i < MAX_HABITOS; i++) {
    const filaAjustes = FILA_REJILLA + i + desfaseAjustes;
    objetivos.push(['=' + HOJA_AJUSTES + '!$F$' + filaAjustes]);
    minimos.push(['=' + HOJA_AJUSTES + '!$G$' + filaAjustes]);
    cuandos.push(['=' + HOJA_AJUSTES + '!$I$' + filaAjustes]);
  }
  h.getRange(FILA_REJILLA, apoyo, MAX_HABITOS, 1).setFormulas(objetivos);
  h.getRange(FILA_REJILLA, apoyo + 1, MAX_HABITOS, 1).setFormulas(minimos);
  h.getRange(FILA_REJILLA, apoyo + 2, MAX_HABITOS, 1).setFormulas(cuandos);

  // Hasta que dia de ESTE mes ha pasado ya: 0 si el mes aun no ha llegado, 99
  // si ya termino. Va en una sola celda a proposito. Antes cada regla de
  // formato llamaba a TODAY(), que es volatil, en las 775 casillas de cada
  // rejilla: mas de nueve mil llamadas por mes y otras tantas reevaluaciones
  // cada vez que la hoja respira.
  h.getRange(1, apoyo + 3).setFormula(form(
    '=IF(TODAY()<DATE(' + año + '~' + (mes + 1) + '~1)~0~' +
    'IF(TODAY()>DATE(' + año + '~' + (mes + 1) + '~' + dias + ')~99~DAY(TODAY())))'));
  h.hideColumns(apoyo, 4);

  h.getRange(FILA_REJILLA, 1, MAX_HABITOS, 1)
    .setFormulas(nombresDeHabitos());
  h.getRange(FILA_REJILLA, 1, MAX_HABITOS, 1).setFontSize(11);

  h.setColumnWidth(1, 200);
  h.setColumnWidths(2, dias, 30);
  h.setColumnWidths(dias + 2, resumen.length, 72);
  h.setFrozenColumns(1);
  h.setFrozenRows(3);

  formatoRejilla(h, dias, mes, año);
  h.getRange(FILA_REJILLA, dias + 4, MAX_HABITOS, 1).setNumberFormat('0%');
}

/**
 * El color de cada casilla sale de su valor comparado con el objetivo y el
 * minimo DE SU FILA, leidos de las columnas de apoyo ocultas de esta misma
 * pestaña. Antes se leian con INDIRECT desde Ajustes: funcionaba, pero
 * INDIRECT es volatil y con doce rejillas eran mas de cien mil celdas
 * reevaluandose sin parar, hasta agotar el limite de ejecucion.
 */
/** Los nombres de la rejilla salen de Ajustes: cambiarlos alli los cambia en los doce meses. */
function nombresDeHabitos() {
  const desfase = FILA_HABITOS + 1 - FILA_REJILLA;
  const filas = [];
  for (let i = 0; i < MAX_HABITOS; i++) {
    const fa = FILA_REJILLA + i + desfase;
    filas.push([form('=IF(' + HOJA_AJUSTES + '!$B$' + fa + '=""~""~' +
      HOJA_AJUSTES + '!$A$' + fa + '&" "&' + HOJA_AJUSTES + '!$B$' + fa + ')')]);
  }
  return filas;
}

function formatoRejilla(hoja, dias, mes, año) {
  const rango = hoja.getRange(FILA_REJILLA, 2, MAX_HABITOS, dias);
  const apoyo = letraColumna(dias + 6);
  const obj = '$' + apoyo + FILA_REJILLA;
  const min = '$' + letraColumna(dias + 7) + FILA_REJILLA;
  const cuando = '$' + letraColumna(dias + 8) + FILA_REJILLA;

  // Solo pintamos de rojo el hueco de un dia que ya paso y en el que ese
  // habito era exigible. Los de cuota semanal no exigen un dia concreto, asi
  // que se quedan sin pintar en vez de acusarte de algo que no fallaste.
  // Una sola celda dice hasta que dia ha pasado; la regla solo la mira.
  const pasado = 'B$2<=$' + letraColumna(dias + 9) + '$1';
  const exigible = 'OR(' + cuando + '="Todos los dias"~' +
    'AND(' + cuando + '="Lunes a viernes"~WEEKDAY(DATE(' + año + '~' + (mes + 1) + '~B$2)~2)<=5)~' +
    'AND(' + cuando + '="Fin de semana"~WEEKDAY(DATE(' + año + '~' + (mes + 1) + '~B$2)~2)>=6))';

  const reglas = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(form('=AND($A4<>""~B4=TRUE)'))
      .setBackground(C.bien).setFontColor(C.bien).setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(form('=AND($A4<>""~ISNUMBER(B4)~' + obj + '>0~B4>=' + obj + ')'))
      .setBackground(C.bien).setFontColor(C.bien).setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(form('=AND($A4<>""~ISNUMBER(B4)~B4>0~B4>=' + min + ')'))
      .setBackground(C.avisoSuave).setFontColor(C.aviso).setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(form('=AND($A4<>""~B4=""~' + pasado + '~' + exigible + ')'))
      .setBackground(C.maloSuave).setRanges([rango]).build(),
  ];
  hoja.setConditionalFormatRules(reglas);
  rango.setHorizontalAlignment('center').setFontSize(9);
}

/**
 * Casillas de verificacion en los habitos de si/no y celdas numericas en los
 * demas. Se aplica de una tacada por mes: poner la validacion celda a celda
 * en doce meses es lo que hace que estas plantillas tarden un minuto en abrir.
 */
function aplicarValidaciones(ss, habitos, año, soloMes) {
  const casilla = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  for (let m = 0; m < 12; m++) {
    if (soloMes !== undefined && m !== soloMes) continue;
    const hoja = ss.getSheetByName(MESES[m]);
    if (!hoja) continue;
    const dias = new Date(año, m + 1, 0).getDate();
    const matriz = [];
    for (let i = 0; i < MAX_HABITOS; i++) {
      const hab = buscarPorIndice(habitos, i);
      const regla = hab && hab.medida === 'Si/No' ? casilla : null;
      const fila = [];
      for (let d = 0; d < dias; d++) fila.push(regla);
      matriz.push(fila);
    }
    hoja.getRange(FILA_REJILLA, 2, MAX_HABITOS, dias).setDataValidations(matriz);
  }
}

/* ------------------------------- Hoy ------------------------------ */

function construirHoy(ss) {
  const h = hojaLimpia(ss, HOJA_HOY, 11 + MAX_HABITOS + 24, 10);
  titulo(h, 'Hoy', '', 8);
  h.getRange(2, 1).setFormula(form(
    '=TEXT(TODAY()~"dddd")&", "&DAY(TODAY())&" de "&TEXT(TODAY()~"mmmm")'));

  h.getRange(4, 1).setValue('LAS 3 DE HOY').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  h.getRange(5, 1, 3, 1).setValues([['1.'], ['2.'], ['3.']]).setFontColor(C.suave);
  for (let f = 5; f <= 7; f++) h.getRange(f, 2, 1, 4).merge();
  h.getRange(5, 2, 3, 4).setBackground(C.fondo).setWrap(true);

  h.getRange(9, 1).setValue('HABITOS DE HOY').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 10, 1, ['Habito', 'Hoy', 'Objetivo', 'Racha', 'Estado']);

  h.setColumnWidth(1, 240);
  h.setColumnWidth(2, 80);
  h.setColumnWidth(3, 110);
  h.setColumnWidth(4, 70);
  h.setColumnWidth(5, 200);
  // Columnas de apoyo: le dicen al codigo a que celda del mes escribir.
  h.setColumnWidth(6, 10);
  h.setColumnWidth(7, 10);
  h.setColumnWidth(8, 10);
  h.hideColumns(6, 3);
  h.setFrozenRows(10);
}

/**
 * Rellena la pestaña Hoy con los habitos que tocan hoy y engancha cada fila a
 * su casilla del mes. Se ejecuta al abrir la hoja y desde el menu.
 */
function prepararHoy() {
  const ss = SpreadsheetApp.getActive();
  const h = ss.getSheetByName(HOJA_HOY);
  if (!h) return;

  const habitos = leerHabitos();
  const hoy = new Date();
  const dia = hoy.getDate();
  const hojaMes = MESES[hoy.getMonth()];
  const mes = ss.getSheetByName(hojaMes);
  const año = leerConfig('Año') || hoy.getFullYear();

  h.getRange(11, 1, MAX_HABITOS + 30, 8).clearContent().clearDataValidations()
    .setBackground(null).setFontColor(C.tinta).setBorder(false, false, false, false, false, false);

  const datos = leerAño(ss, año);
  const desde = fechaInicio();
  const aplican = habitos.filter(function (x) { return aplicaHoy(x, hoy); });

  // Todo el bloque de habitos se escribe de una vez. Celda a celda eran unos
  // veinte viajes al servidor por habito, y el limite de Apps Script son seis
  // minutos para toda la construccion.
  const casilla = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  // Una sola lectura de la columna de hoy en vez de una por habito.
  const columnaHoy = mes ? mes.getRange(FILA_REJILLA, dia + 1, MAX_HABITOS, 1).getValues() : null;
  const valores = [];
  const pesos = [];
  const validaciones = [];
  for (let i = 0; i < aplican.length; i++) {
    const hab = aplican[i];
    const valor = columnaHoy ? columnaHoy[hab.indice][0] : '';
    const esCasilla = hab.medida === 'Si/No';
    const racha = calcularRacha(datos, hab, hoy, año, desde);
    valores.push([
      hab.icono + '  ' + hab.nombre,
      esCasilla ? valor === true || valor === 1 : (typeof valor === 'number' ? valor : ''),
      textoObjetivo(hab),
      racha > 0 ? '🔥 ' + racha : '',
      hab.innegociable ? 'Innegociable' : '',
      hojaMes,
      FILA_REJILLA + hab.indice,
      dia + 1,
    ]);
    pesos.push([hab.innegociable ? 'bold' : 'normal']);
    validaciones.push([esCasilla ? casilla : null]);
  }

  let fila = 11;
  if (valores.length) {
    h.getRange(11, 1, valores.length, 8).setValues(valores);
    h.getRange(11, 1, valores.length, 1).setFontWeights(pesos).setFontSize(12);
    h.getRange(11, 2, valores.length, 1)
      .setDataValidations(validaciones).setHorizontalAlignment('center').setBackground(C.fondo);
    h.getRange(11, 3, valores.length, 3).setFontColor(C.suave).setFontSize(10);
    h.getRange(11, 4, valores.length, 1).setHorizontalAlignment('center');
    fila = 11 + valores.length;
  }

  bloqueCierre(h, fila + 1, datos, habitos, hoy, año);
  ss.getSheetByName(HOJA_HOY).getRange(11, 1, Math.max(1, fila - 11), 5)
    .setBorder(null, null, null, null, null, true, C.linea, SpreadsheetApp.BorderStyle.SOLID);
}

function bloqueCierre(h, fila, datos, habitos, hoy, año) {
  const est = estadoDelDia(datos, habitos, hoy, año);

  h.getRange(fila, 1).setValue('EL DIA').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  fila++;
  const filas = [
    ['Cumplido', est.exigibles ? Math.round((est.hechos / est.exigibles) * 100) + '%' : '—'],
    ['Veredicto', est.veredicto],
    ['Innegociables', est.negociablesHechos + ' de ' + est.negociables],
    ['Recompensas', est.bloqueadas ? '🔒 BLOQUEADAS — ' + est.motivo : '🔓 Desbloqueadas'],
    ['Deuda pendiente', textoDeuda()],
  ];
  h.getRange(fila, 1, filas.length, 2).setValues(filas);
  h.getRange(fila, 1, filas.length, 1).setFontColor(C.suave);
  h.getRange(fila, 2, filas.length, 1).setFontWeight('bold');
  h.getRange(fila + 3, 2).setFontColor(est.bloqueadas ? C.malo : C.bien);
  h.getRange(fila + 1, 2).setFontColor(
    est.veredicto === 'Perfecto' ? C.bien : est.veredicto === 'Suspenso' ? C.malo : C.aviso);
  fila += filas.length + 1;

  h.getRange(fila, 1).setValue('CIERRE DEL DIA').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  fila++;
  const cierre = leerCierre(fechaISO(hoy));
  const campos = ETIQUETAS_CIERRE.map(function (etiqueta, i) {
    return [etiqueta, cierre[i + 1] || ''];
  });
  h.getRange(fila, 1, campos.length, 2).setValues(campos);
  h.getRange(fila, 1, campos.length, 1).setFontColor(C.suave);
  h.getRange(fila, 2, campos.length, 4).setBackground(C.fondo);
  h.getRange(fila + 3, 2, 2, 4).setWrap(true);
}

function textoObjetivo(hab) {
  if (hab.tipo === 'Evitar') return 'evitar';
  if (hab.medida === 'Si/No') return hab.cuando;
  return hab.objetivo + ' ' + (hab.unidad || '') + ' (min. ' + hab.minimo + ')';
}

/* ---------------------------- Sincronizado ------------------------ */

/**
 * Cuando marcas algo en Hoy, se copia a la casilla del mes que corresponde.
 * Este disparador tambien salta editando desde la app movil, que es donde de
 * verdad vas a marcar los habitos.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const hoja = e.range.getSheet();
    const fila = e.range.getRow();
    const col = e.range.getColumn();

    // Cambiar un habito en Ajustes deberia notarse sin ejecutar nada. Este
    // disparador tambien salta editando desde la app del movil.
    if (hoja.getName() === HOJA_AJUSTES && fila >= FILA_HABITOS) {
      prepararHoy();
      return;
    }
    if (hoja.getName() !== HOJA_HOY) return;

    if (col === 2 && fila >= 11) {
      const ref = hoja.getRange(fila, 6, 1, 3).getValues()[0];
      if (ref[0]) {
        const destino = SpreadsheetApp.getActive().getSheetByName(String(ref[0]));
        if (destino) destino.getRange(Number(ref[1]), Number(ref[2])).setValue(e.range.getValue());
        return;
      }
    }

    // Los campos del cierre viven en la misma columna que los habitos, asi que
    // se reconocen por su etiqueta, no por la posicion.
    if (col >= 2) {
      const campo = campoDeCierre(hoja, fila);
      if (campo) guardarCierre(fechaISO(new Date()), campo, e.range.getValue());
    }
  } catch (err) {
    // Un fallo aqui no puede impedirte marcar un habito.
  }
}

const ETIQUETAS_CIERRE = ['Animo (1-5)', 'Energia (1-5)', 'Horas de sueño',
  'Que ha salido bien', 'Que me ha frenado y como lo evito mañana'];

function campoDeCierre(hoja, fila) {
  const idx = ETIQUETAS_CIERRE.indexOf(String(hoja.getRange(fila, 1).getValue()));
  return idx < 0 ? 0 : idx + 1;
}

/* ================================================================== */
/* Lectura de datos                                                    */
/* ================================================================== */

function leerConfig(clave) {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA_AJUSTES);
  if (!h) return '';
  const filas = h.getRange(5, 1, FILA_HABITOS - 6, 2).getValues();
  for (let i = 0; i < filas.length; i++) {
    if (String(filas[i][0]).indexOf(clave) === 0) return filas[i][1];
  }
  return '';
}

function leerHabitos() {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA_AJUSTES);
  if (!h) return [];
  const filas = h.getRange(FILA_HABITOS + 1, 1, MAX_HABITOS, 14).getValues();
  const salida = [];
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    if (!f[1]) continue;
    salida.push({
      indice: i,
      icono: f[0], nombre: f[1], categoria: f[2],
      tipo: f[3] || 'Hacer', medida: f[4] || 'Si/No',
      objetivo: Number(f[5]) || 0, minimo: Number(f[6]) || 0, unidad: f[7],
      cuando: f[8] || 'Todos los dias',
      innegociable: String(f[9]).toUpperCase() === 'SI',
      peso: Number(f[10]) || 1,
      deuda: Number(f[11]) || 0, unidadDeuda: f[12] || 'minutos',
      notas: f[13],
    });
  }
  return salida;
}

/** Lee las doce rejillas de una vez: doce lecturas en vez de una por celda. */
function leerAño(ss, año) {
  const mapa = {};
  for (let m = 0; m < 12; m++) {
    const hoja = ss.getSheetByName(MESES[m]);
    if (!hoja) continue;
    const dias = new Date(año, m + 1, 0).getDate();
    mapa[m] = hoja.getRange(FILA_REJILLA, 2, MAX_HABITOS, dias).getValues();
  }
  return mapa;
}

function valorDe(datos, mes, dia, indiceHabito) {
  const rejilla = datos[mes];
  if (!rejilla || !rejilla[indiceHabito]) return '';
  const v = rejilla[indiceHabito][dia - 1];
  return v === undefined ? '' : v;
}

/** Si el habito toca ese dia, segun la columna "Cuando" de Ajustes. */
function aplicaHoy(hab, fecha) {
  const wd = fecha.getDay();
  const c = String(hab.cuando);
  if (c === 'Todos los dias') return true;
  if (c === 'Lunes a viernes') return wd >= 1 && wd <= 5;
  if (c === 'Fin de semana') return wd === 0 || wd === 6;
  // Los de cuota semanal cuentan todos los dias como oportunidad; el numero
  // de veces exigidas se controla al calcular los exigibles de la semana.
  return true;
}

function esCuota(hab) {
  return /^(\d)x por semana$/.test(String(hab.cuando));
}

function cuotaSemanal(hab) {
  const m = String(hab.cuando).match(/^(\d)x por semana$/);
  return m ? Number(m[1]) : 0;
}

/** Cumplido: marcado, o valor por encima del minimo (regla no-zero). */
function cumplido(hab, valor) {
  if (hab.tipo === 'Evitar') return valor !== true && valor !== 1;
  if (hab.medida === 'Si/No') return valor === true || valor === 1;
  return typeof valor === 'number' && valor > 0 && valor >= hab.minimo;
}

function alObjetivo(hab, valor) {
  if (hab.tipo === 'Evitar') return valor !== true && valor !== 1;
  if (hab.medida === 'Si/No') return valor === true || valor === 1;
  return typeof valor === 'number' && valor >= hab.objetivo;
}

/**
 * Racha en dias exigibles: los dias que el habito no tocaba no la rompen, y
 * el dia en curso no cuenta como fallo hasta que termina.
 */
function calcularRacha(datos, hab, hasta, año, desde) {
  let racha = 0;
  const tope = desde || fechaInicio();
  const cursor = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  for (let i = 0; i < 400; i++) {
    if (cursor.getFullYear() !== año) break;
    // Los dias anteriores a empezar no son merito tuyo. Sin este corte, un
    // habito de "evitar" sumaria racha desde el 1 de enero: su casilla vacia
    // significa "no he caido", y antes de existir el tracker estaban todas.
    if (tope && cursor < tope) break;
    if (aplicaHoy(hab, cursor) && !esCuota(hab)) {
      const v = valorDe(datos, cursor.getMonth(), cursor.getDate(), hab.indice);
      if (cumplido(hab, v)) racha++;
      else if (i > 0) break;
    } else if (esCuota(hab)) {
      const v = valorDe(datos, cursor.getMonth(), cursor.getDate(), hab.indice);
      if (cumplido(hab, v)) racha++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return racha;
}

/** Dias del mes en los que ese habito era exigible, hasta la fecha dada. */
function exigiblesDelMes(hab, mes, año, hasta, desde) {
  const dias = new Date(año, mes + 1, 0).getDate();
  const iMes = año * 12 + mes;
  const iHasta = hasta.getFullYear() * 12 + hasta.getMonth();
  // Un mes que todavia no ha llegado no exige nada. Sin este corte, en agosto
  // diciembre pedia sus 31 dias y la pestaña salia con un 0% que no es real.
  if (iMes > iHasta) return 0;
  const tope = iMes === iHasta ? hasta.getDate() : dias;
  // Igual que con la racha: el mes en que empezaste solo cuenta desde ese dia.
  let primero = 1;
  if (desde) {
    const iDesde = desde.getFullYear() * 12 + desde.getMonth();
    if (iDesde > iMes) return 0;
    if (iDesde === iMes) primero = desde.getDate();
  }
  if (primero > tope) return 0;
  if (esCuota(hab)) return Math.round(((tope - primero + 1) / 7) * cuotaSemanal(hab));
  let n = 0;
  for (let d = primero; d <= tope; d++) if (aplicaHoy(hab, new Date(año, mes, d))) n++;
  return n;
}

/**
 * Dias cumplidos del mes. Cuenta solo los dias que ya han pasado, posteriores
 * a la fecha de inicio y en los que el habito tocaba: un habito de "evitar"
 * tiene la casilla vacia todo el año, y sin estos tres cortes el mes que viene
 * ya aparece cumplido al 100%.
 */
function hechosDelMes(datos, hab, mes, año, hasta, desde) {
  const dias = new Date(año, mes + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= dias; d++) {
    const fecha = new Date(año, mes, d);
    if (fecha > hasta) break;
    if (desde && fecha < desde) continue;
    if (!aplicaHoy(hab, fecha)) continue;
    if (cumplido(hab, valorDe(datos, mes, d, hab.indice))) n++;
  }
  return n;
}

function estadoDelDia(datos, habitos, fecha, año, penitencia) {
  const castigo = penitencia === undefined ? penitenciaActiva() : penitencia;
  let exigibles = 0, hechos = 0, negociables = 0, negociablesHechos = 0, xp = 0;
  const pendientes = [];
  for (let i = 0; i < habitos.length; i++) {
    const hab = habitos[i];
    if (!aplicaHoy(hab, fecha)) continue;
    const v = valorDe(datos, fecha.getMonth(), fecha.getDate(), hab.indice);
    const ok = cumplido(hab, v);
    if (!esCuota(hab)) {
      exigibles++;
      if (ok) hechos++;
    } else if (ok) {
      hechos++; exigibles++;
    }
    if (hab.innegociable) {
      negociables++;
      if (ok) negociablesHechos++;
      else pendientes.push(hab.nombre);
    }
    if (ok) xp += 10 * hab.peso * (alObjetivo(hab, v) ? 1 : 0.5);
  }
  const ratio = exigibles ? hechos / exigibles : 1;
  const bloqueadas = pendientes.length > 0 || Boolean(castigo);
  return {
    exigibles: exigibles, hechos: hechos, ratio: ratio,
    negociables: negociables, negociablesHechos: negociablesHechos,
    pendientes: pendientes,
    xp: Math.round(negociables && !pendientes.length ? xp * 1.25 : xp),
    veredicto: pendientes.length ? 'Suspenso' : ratio >= 1 ? 'Perfecto' : ratio >= 0.7 ? 'Aprobado' : 'Suspenso',
    bloqueadas: bloqueadas,
    motivo: castigo
      ? 'penitencia sin cumplir'
      : pendientes.length ? 'te faltan: ' + pendientes.join(', ') : '',
  };
}

/** Dia en que se monto el tracker. Antes de esa fecha no hay nada que contar. */
function fechaInicio() {
  const v = leerConfig('Empezado el');
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fechaISO(f) {
  const p = function (n) { return (n < 10 ? '0' : '') + n; };
  return f.getFullYear() + '-' + p(f.getMonth() + 1) + '-' + p(f.getDate());
}

/* ================================================================== */
/* Pestaña oculta de datos                                             */
/* ================================================================== */

function construirDatos(ss, año) {
  const h = hojaLimpia(ss, HOJA_DATOS, 500, 20);
  h.getRange(1, 1).setValue('Datos internos. No hace falta que toques nada aqui.');
  cabecera(h, 2, 1, ['Fecha', 'Animo', 'Energia', 'Sueño', 'Salio bien', 'Me freno']);
  cabecera(h, 2, 8, ['Fecha', 'Habito', 'Cantidad', 'Unidad', 'Motivo', 'Pagada']);
  cabecera(h, 2, 15, ['Fecha', 'Tipo', 'Texto']);
  h.setColumnWidth(5, 220); h.setColumnWidth(6, 220); h.setColumnWidth(17, 320);
  h.hideSheet();
}

function hojaDatos() {
  return SpreadsheetApp.getActive().getSheetByName(HOJA_DATOS);
}

function leerCierre(fecha) {
  const h = hojaDatos();
  if (!h) return [];
  const ultima = ultimaFilaBloque(h, 1);
  if (ultima < 3) return [];
  const filas = h.getRange(3, 1, ultima - 2, 6).getValues();
  for (let i = 0; i < filas.length; i++) if (String(filas[i][0]) === fecha) return filas[i];
  return [];
}

function guardarCierre(fecha, campo, valor) {
  const h = hojaDatos();
  if (!h) return;
  const ultima = ultimaFilaBloque(h, 1);
  if (ultima >= 3) {
    const filas = h.getRange(3, 1, ultima - 2, 1).getValues();
    for (let i = 0; i < filas.length; i++) {
      if (String(filas[i][0]) === fecha) {
        h.getRange(3 + i, campo + 1).setValue(valor);
        return;
      }
    }
  }
  const fila = Math.max(3, ultima + 1);
  h.getRange(fila, 1).setValue(fecha);
  h.getRange(fila, campo + 1).setValue(valor);
}

function apuntarDeuda(fecha, habito, cantidad, unidad, motivo) {
  const h = hojaDatos();
  if (!h) return;
  const fila = Math.max(3, ultimaFilaBloque(h, 8) + 1);
  h.getRange(fila, 8, 1, 6).setValues([[fecha, habito, cantidad, unidad, motivo, '']]);
}

function textoDeuda() {
  const h = hojaDatos();
  if (!h) return 'Sin deuda';
  const ultima = ultimaFilaBloque(h, 8);
  if (ultima < 3) return 'Sin deuda';
  const filas = h.getRange(3, 8, ultima - 2, 6).getValues();
  const suma = {};
  for (let i = 0; i < filas.length; i++) {
    if (!filas[i][0] || filas[i][5]) continue;
    const u = filas[i][3] || 'unidades';
    suma[u] = (suma[u] || 0) + Number(filas[i][2] || 0);
  }
  const partes = Object.keys(suma).map(function (u) { return suma[u] + ' ' + u; });
  return partes.length ? partes.join(' · ') : 'Sin deuda';
}

function apuntarHistorial(fecha, tipo, texto) {
  const h = hojaDatos();
  if (!h) return;
  const fila = Math.max(3, ultimaFilaBloque(h, 15) + 1);
  h.getRange(fila, 15, 1, 3).setValues([[fecha, tipo, texto]]);
}

function historialTiene(texto) {
  const h = hojaDatos();
  if (!h) return false;
  const ultima = ultimaFilaBloque(h, 15);
  if (ultima < 3) return false;
  const filas = h.getRange(3, 17, ultima - 2, 1).getValues();
  for (let i = 0; i < filas.length; i++) if (String(filas[i][0]) === texto) return true;
  return false;
}

function ultimaFilaBloque(hoja, columna) {
  const valores = hoja.getRange(1, columna, Math.max(hoja.getMaxRows(), 3), 1).getValues();
  for (let i = valores.length - 1; i >= 0; i--) if (valores[i][0] !== '') return i + 1;
  return 2;
}

/* ================================================================== */
/* Panel                                                               */
/* ================================================================== */

function construirPanel(ss) {
  // Los bloques de apoyo de los graficos viven en las columnas 28 a 33.
  const h = hojaLimpia(ss, HOJA_PANEL, MAX_HABITOS + 20, 36);
  titulo(h, 'Panel', 'Se recalcula al abrir la hoja y desde el menu.', 10);

  const kpis = ['Cumplido del mes', 'Dias perfectos', 'Dias en cero', 'Mejor racha', 'XP del mes'];
  h.getRange(4, 1, 1, kpis.length).setValues([kpis])
    .setFontSize(10).setFontColor(C.suave).setFontWeight('bold');
  h.getRange(5, 1, 1, kpis.length).setFontSize(24).setFontWeight('bold').setFontColor(C.tinta);
  h.getRange(4, 1, 2, kpis.length).setBackground(C.fondo);
  h.setColumnWidths(1, kpis.length, 140);

  h.getRange(8, 1).setValue('POR HABITO — este mes')
    .setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 9, 1, ['Habito', 'Hechos', 'Exigibles', '%', 'Racha', 'Progreso']);
  h.setColumnWidth(6, 220);
  h.getRange(10, 4, MAX_HABITOS, 1).setNumberFormat('0%');

  // Bloques de apoyo para los graficos. Van a la derecha y se ocultan.
  cabecera(h, 2, 28, ['Dia', '% del dia']);
  cabecera(h, 2, 31, ['Mes', '% del mes']);
  const meses = [];
  for (let m = 0; m < 12; m++) meses.push([MESES[m], 0]);
  h.getRange(3, 31, 12, 2).setValues(meses);
  const dias = [];
  for (let d = 1; d <= 31; d++) dias.push([d, 0]);
  h.getRange(3, 28, 31, 2).setValues(dias);
  h.hideColumns(28, 6);

  const grafDias = h.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(h.getRange(2, 28, 32, 2))
    .setPosition(8, 8, 0, 0)
    .setOption('title', 'Progreso diario del mes')
    .setOption('legend', { position: 'none' })
    .setOption('colors', [C.bien])
    .setOption('vAxis', { format: 'percent', viewWindow: { min: 0, max: 1 } })
    .setOption('width', 520).setOption('height', 240)
    .build();
  h.insertChart(grafDias);

  const grafMeses = h.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(h.getRange(2, 31, 13, 2))
    .setPosition(22, 8, 0, 0)
    .setOption('title', 'Cumplimiento por mes')
    .setOption('legend', { position: 'none' })
    .setOption('colors', [C.acento])
    .setOption('vAxis', { format: 'percent', viewWindow: { min: 0, max: 1 } })
    .setOption('width', 520).setOption('height', 240)
    .build();
  h.insertChart(grafMeses);
}

/* ================================================================== */
/* Recalcular                                                          */
/* ================================================================== */

function recalcularTodo() {
  const ss = SpreadsheetApp.getActive();
  const habitos = leerHabitos();
  const hoy = new Date();
  const año = Number(leerConfig('Año')) || hoy.getFullYear();
  const datos = leerAño(ss, año);
  const desde = fechaInicio();

  // Resumen de cada mes: hechos, exigibles, porcentaje y racha por habito.
  for (let m = 0; m < 12; m++) {
    const hoja = ss.getSheetByName(MESES[m]);
    if (!hoja) continue;
    const diasMes = new Date(año, m + 1, 0).getDate();
    const filas = [];
    for (let i = 0; i < MAX_HABITOS; i++) {
      const hab = buscarPorIndice(habitos, i);
      if (!hab) { filas.push(['', '', '', '']); continue; }
      const hechos = hechosDelMes(datos, hab, m, año, hoy, desde);
      const exigibles = exigiblesDelMes(hab, m, año, hoy, desde);
      const finDeMes = new Date(año, m, diasMes);
      const hasta = finDeMes < hoy ? finDeMes : hoy;
      filas.push([
        hechos,
        exigibles,
        exigibles ? Math.min(1, hechos / exigibles) : '',
        m === hoy.getMonth() ? calcularRacha(datos, hab, hasta, año, desde) : '',
      ]);
    }
    hoja.getRange(FILA_REJILLA, diasMes + 2, MAX_HABITOS, 4).setValues(filas);
  }

  panelAlDia(ss, habitos, datos, hoy, año, desde);
}

/** Doce bloques llenos o vacios segun el porcentaje. */
function barraTexto(fraccion) {
  const total = 12;
  const llenos = Math.round(Math.max(0, Math.min(1, fraccion)) * total);
  let s = '';
  for (let i = 0; i < total; i++) s += i < llenos ? '█' : '░';
  return s;
}

function buscarPorIndice(habitos, indice) {
  for (let i = 0; i < habitos.length; i++) if (habitos[i].indice === indice) return habitos[i];
  return null;
}

function panelAlDia(ss, habitos, datos, hoy, año, desde) {
  const h = ss.getSheetByName(HOJA_PANEL);
  if (!h) return;
  const mes = hoy.getMonth();
  const diasMes = new Date(año, mes + 1, 0).getDate();

  const castigo = penitenciaActiva();
  let perfectos = 0, ceros = 0, xp = 0, sumaHechos = 0, sumaExigibles = 0;
  const porDia = [];
  for (let d = 1; d <= 31; d++) {
    const fecha = new Date(año, mes, d);
    if (d > diasMes || d > hoy.getDate() || (desde && fecha < desde)) { porDia.push([d, 0]); continue; }
    const est = estadoDelDia(datos, habitos, new Date(año, mes, d), año, castigo);
    porDia.push([d, est.ratio]);
    sumaHechos += est.hechos;
    sumaExigibles += est.exigibles;
    xp += est.xp;
    if (est.exigibles && est.hechos >= est.exigibles) perfectos++;
    if (est.exigibles && est.hechos === 0) ceros++;
  }
  h.getRange(3, 28, 31, 2).setValues(porDia);

  const porMes = [];
  for (let m = 0; m < 12; m++) {
    let hechos = 0, exigibles = 0;
    const dias = new Date(año, m + 1, 0).getDate();
    for (let d = 1; d <= dias; d++) {
      const fecha = new Date(año, m, d);
      if (fecha > hoy) break;
      if (desde && fecha < desde) continue;
      const est = estadoDelDia(datos, habitos, fecha, año, castigo);
      hechos += est.hechos;
      exigibles += est.exigibles;
    }
    porMes.push([MESES[m], exigibles ? hechos / exigibles : 0]);
  }
  h.getRange(3, 31, 12, 2).setValues(porMes);

  let mejorRacha = 0;
  const tabla = [];
  for (let i = 0; i < habitos.length; i++) {
    const hab = habitos[i];
    const hechos = hechosDelMes(datos, hab, mes, año, hoy, desde);
    const exigibles = exigiblesDelMes(hab, mes, año, hoy, desde);
    const racha = calcularRacha(datos, hab, hoy, año, desde);
    mejorRacha = Math.max(mejorRacha, racha);
    const ratio = exigibles ? Math.min(1, hechos / exigibles) : 0;
    // Barra de texto en vez de SPARKLINE: la sintaxis de sus arrays cambia con
    // el idioma de la hoja, y esto se lee igual de bien y no puede fallar.
    tabla.push([hab.icono + ' ' + hab.nombre, hechos, exigibles, ratio, racha, barraTexto(ratio)]);
  }
  h.getRange(10, 1, MAX_HABITOS, 6).clearContent();
  if (tabla.length) {
    h.getRange(10, 1, tabla.length, 6).setValues(tabla);
  }

  h.getRange(5, 1, 1, 5).setValues([[
    sumaExigibles ? Math.round((sumaHechos / sumaExigibles) * 100) + '%' : '—',
    perfectos, ceros, mejorRacha, xp,
  ]]);
  h.getRange(5, 3).setFontColor(ceros ? C.malo : C.tinta);
}

/* ================================================================== */
/* Universidad                                                         */
/* ================================================================== */

function construirUniversidad(ss) {
  const h = hojaLimpia(ss, HOJA_UNI, 280, 12);
  titulo(h, 'Universidad', 'Asignaturas, examenes, entregas y horas de estudio.', 10);

  h.getRange(4, 1).setValue('ASIGNATURAS').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 5, 1, ['Asignatura', 'Creditos', 'Dificultad 1-5', 'Nota objetivo', 'Nota final']);

  h.getRange(17, 1).setValue('EXAMENES').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 18, 1, ['Asignatura', 'Examen', 'Fecha', 'Dias que faltan', 'Peso %',
    'Horas que necesito', 'Horas hechas', 'Preparacion', 'Nota']);
  const diasQueFaltan = [];
  const horasHechas = [];
  const preparacion = [];
  for (let i = 0; i < 20; i++) {
    const f = 19 + i;
    diasQueFaltan.push([form('=IF(C' + f + '=""~""~C' + f + '-TODAY())')]);
    // Las horas hechas salen solas del registro de estudio de mas abajo.
    horasHechas.push([form('=IF(A' + f + '=""~""~ROUND(SUMIF($A$60:$A$260~A' + f +
      '~$C$60:$C$260)/60~1))')]);
    preparacion.push([form('=IF(OR(A' + f + '=""~F' + f + '="")~""~MIN(1~G' + f + '/F' + f + '))')]);
  }
  h.getRange(19, 4, 20, 1).setFormulas(diasQueFaltan);
  h.getRange(19, 7, 20, 1).setFormulas(horasHechas);
  h.getRange(19, 8, 20, 1).setFormulas(preparacion);
  h.getRange(19, 8, 20, 1).setNumberFormat('0%');
  h.getRange(19, 3, 20, 1).setNumberFormat('dd/mm/yyyy');

  h.getRange(40, 1).setValue('ENTREGAS').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 41, 1, ['Asignatura', 'Entrega', 'Fecha limite', 'Dias que faltan', 'Horas', 'Hecha']);
  const diasEntrega = [];
  for (let i = 0; i < 12; i++) {
    diasEntrega.push([form('=IF(C' + (42 + i) + '=""~""~C' + (42 + i) + '-TODAY())')]);
  }
  h.getRange(42, 4, 12, 1).setFormulas(diasEntrega);
  h.getRange(42, 6, 12, 1).insertCheckboxes();
  h.getRange(42, 3, 12, 1).setNumberFormat('dd/mm/yyyy');

  h.getRange(58, 1).setValue('HORAS DE ESTUDIO').setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 59, 1, ['Asignatura', 'Fecha', 'Minutos', 'Tecnica', 'Foco 1-5', 'Nota']);
  h.getRange(60, 2, 201, 1).setNumberFormat('dd/mm/yyyy');
  lista(h, 60, 4, 201, ['Deep work', 'Pomodoro', 'Repaso', 'Ejercicios', 'Clase']);

  h.setColumnWidth(1, 180); h.setColumnWidth(2, 200); h.setColumnWidth(6, 130);
  h.setColumnWidth(7, 110); h.setColumnWidth(8, 110);

  // Rojo cuando el examen esta encima y no llevas horas suficientes; ambar
  // cuando entra en la quincena. Es el aviso que en la app daba el planificador.
  const rango = h.getRange(19, 1, 20, 9);
  h.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(form('=AND($D19<>""~$D19>=0~$D19<=7~$H19<0.6)'))
      .setBackground(C.maloSuave).setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(form('=AND($D19<>""~$D19>=0~$D19<=14)'))
      .setBackground(C.avisoSuave).setRanges([rango]).build(),
  ]);

  nota(h, 55,
    'Apunta cada sesion en HORAS DE ESTUDIO (mas abajo) y la columna "Horas hechas" de cada examen se suma sola.\n' +
    'Se honesto con las horas que necesitas: si pones 4 para un parcial, tendras un suspenso perfectamente planificado.');
}

/* ================================================================== */
/* Presion                                                             */
/* ================================================================== */

function construirPresion(ss) {
  const h = hojaLimpia(ss, HOJA_PRESION, 120, 10);
  titulo(h, 'Presion', 'Donde fallar deja de ser gratis.', 8);

  h.getRange(4, 1).setValue('CONTRATO DE COMPROMISO')
    .setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  const contrato = [
    ['Desde', ''],
    ['Hasta', ''],
    ['Minimo semanal exigido (%)', 85],
    ['Que pasa exactamente si fallo', ''],
    ['Mi auditor', ''],
    ['Su email', ''],
    ['Firmado el', ''],
  ];
  h.getRange(5, 1, contrato.length, 2).setValues(contrato);
  h.getRange(5, 1, contrato.length, 1).setFontColor(C.suave);
  h.getRange(5, 2, contrato.length, 4).setBackground(C.fondo);
  h.getRange(8, 2, 1, 4).merge().setWrap(true);
  h.setRowHeight(8, 46);

  h.getRange(14, 1).setValue('PENITENCIAS')
    .setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 15, 1, ['Penitencia', 'Dureza 1-3', 'Asignada el', 'Cumplida']);
  h.getRange(16, 1, PENITENCIAS_INICIALES.length, 2).setValues(PENITENCIAS_INICIALES);
  h.getRange(16, 4, 12, 1).insertCheckboxes();

  h.getRange(30, 1).setValue('RECOMPENSAS')
    .setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 31, 1, ['', 'Recompensa', 'Cadencia']);
  h.getRange(32, 1, RECOMPENSAS_INICIALES.length, 3).setValues(RECOMPENSAS_INICIALES);

  h.getRange(40, 1).setValue('DEUDA PENDIENTE')
    .setFontWeight('bold').setFontColor(C.suave).setFontSize(10);
  cabecera(h, 41, 1, ['Fecha', 'Habito', 'Cantidad', 'Unidad', 'Motivo', 'Pagada']);
  h.getRange(42, 1).setFormula(form(
    '=IFERROR(QUERY(\'' + HOJA_DATOS + '\'!H3:M~"select * where H is not null and M is null"~0)~"")'));

  h.setColumnWidth(1, 200); h.setColumnWidth(2, 260); h.setColumnWidth(5, 300);

  nota(h, 104,
    'La deuda se apunta sola cada madrugada: por cada habito exigible que fallaste, se te suma lo que pusiste en Ajustes.\n' +
    'Se paga haciendo de mas y marcando la casilla "Pagada" en la pestaña de datos, o tachandola aqui a mano.\n' +
    'Tres fallos del mismo habito en 7 dias y se te asigna una penitencia de las que escribiste arriba.');
}

function penitenciaActiva() {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA_PRESION);
  if (!h) return null;
  const filas = h.getRange(16, 1, 12, 4).getValues();
  for (let i = 0; i < filas.length; i++) {
    if (filas[i][0] && filas[i][2] && filas[i][3] !== true) return filas[i][0];
  }
  return null;
}

function asignarPenitencia(dureza, motivo) {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA_PRESION);
  if (!h || penitenciaActiva()) return;
  const filas = h.getRange(16, 1, 12, 4).getValues();
  let elegida = -1;
  for (let i = 0; i < filas.length; i++) {
    if (!filas[i][0]) continue;
    if (filas[i][2] && filas[i][3] !== true) return;
    if (Number(filas[i][1]) === dureza && !filas[i][2]) { elegida = i; break; }
    if (elegida < 0 && !filas[i][2]) elegida = i;
  }
  if (elegida < 0) return;
  h.getRange(16 + elegida, 3).setValue(new Date());
  apuntarHistorial(fechaISO(new Date()), 'Sancion', motivo + ' -> ' + filas[elegida][0]);
}

/* ================================================================== */
/* Metodos y frases                                                    */
/* ================================================================== */

function construirMetodos(ss) {
  const h = hojaLimpia(ss, HOJA_METODOS, TECNICAS.length + 12, 6);
  titulo(h, 'Metodos', 'Tecnicas que hacen que un sistema de habitos funcione.', 4);
  cabecera(h, 4, 1, ['Tecnica', 'De quien', 'Que es', 'Como la aplicas aqui']);
  h.getRange(5, 1, TECNICAS.length, 4).setValues(TECNICAS);
  h.setColumnWidth(1, 210); h.setColumnWidth(2, 190);
  h.setColumnWidth(3, 430); h.setColumnWidth(4, 430);
  h.getRange(5, 1, TECNICAS.length, 4).setWrap(true).setVerticalAlignment('top');
  h.getRange(5, 1, TECNICAS.length, 1).setFontWeight('bold');
  h.getRange(5, 4, TECNICAS.length, 1).setBackground(C.fondo);
}

function construirFrases(ss) {
  const h = hojaLimpia(ss, HOJA_FRASES, FRASES.length + 12, 5);
  titulo(h, 'Frases', 'Para cuando no apetezca. Cada dia sale una en el correo.', 3);
  cabecera(h, 4, 1, ['Frase', 'Quien', 'Fuente']);
  h.getRange(5, 1, FRASES.length, 3).setValues(FRASES);
  h.setColumnWidth(1, 560); h.setColumnWidth(2, 230); h.setColumnWidth(3, 250);
  h.getRange(5, 1, FRASES.length, 3).setWrap(true).setVerticalAlignment('top');
  h.getRange(5, 1, FRASES.length, 1).setFontSize(12);
}

function fraseDelDia() {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA_FRASES);
  if (!h) return null;
  const n = FRASES.length;
  const dias = Math.floor(Date.now() / 86400000);
  const fila = 5 + (dias % n);
  const f = h.getRange(fila, 1, 1, 3).getValues()[0];
  return { texto: f[0], quien: f[1], fuente: f[2] };
}

/* ================================================================== */
/* Automatismos: aqui es donde esta version gana a la aplicacion       */
/* ================================================================== */

/**
 * Un navegador no despierta a una web cerrada para avisarte. Un disparador de
 * Apps Script si manda el correo cada mañana, tengas el movil como lo tengas.
 * Esta es la razon de peso para tener el tracker aqui.
 */
function activarAvisos() {
  const email = String(leerConfig('Email para los avisos') || Session.getEffectiveUser().getEmail());
  const disparadores = ScriptApp.getProjectTriggers();
  for (let i = 0; i < disparadores.length; i++) {
    const f = disparadores[i].getHandlerFunction();
    if (['recordatorioDiario', 'liquidarAyer', 'informeSemanal'].indexOf(f) >= 0) {
      ScriptApp.deleteTrigger(disparadores[i]);
    }
  }
  ScriptApp.newTrigger('recordatorioDiario').timeBased().atHour(7).everyDays(1).create();
  ScriptApp.newTrigger('liquidarAyer').timeBased().atHour(4).everyDays(1).create();
  ScriptApp.newTrigger('informeSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).create();

  avisar(
    'Avisos activados',
    'A partir de ahora:\n\n' +
      '• Cada mañana a las 7:00 recibes en ' + email + ' tus habitos del dia, tu deuda y una frase.\n' +
      '• Cada madrugada a las 4:00 se liquida el dia anterior: lo que no marcaste cuenta como fallo y genera deuda.\n' +
      '• Cada domingo a las 20:00 sale el informe de la semana, tambien a tu auditor si pusiste su email.',
  );
}

function recordatorioDiario() {
  const ss = SpreadsheetApp.getActive();
  const email = String(leerConfig('Email para los avisos') || Session.getEffectiveUser().getEmail());
  if (!email) return;

  const habitos = leerHabitos();
  const hoy = new Date();
  const año = Number(leerConfig('Año')) || hoy.getFullYear();
  const datos = leerAño(ss, año);
  const est = estadoDelDia(datos, habitos, hoy, año);
  const frase = fraseDelDia();

  const pendientes = habitos
    .filter(function (h) { return aplicaHoy(h, hoy); })
    .map(function (h) {
      return '<li>' + h.icono + ' <b>' + h.nombre + '</b> — ' + textoObjetivo(h) +
        (h.innegociable ? ' <span style="color:#b3261e">innegociable</span>' : '') + '</li>';
    })
    .join('');

  const cuerpo =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1d1d1f">' +
    '<h2 style="margin:0 0 4px">Hoy toca esto</h2>' +
    '<p style="color:#6e6e73;margin:0 0 18px">' + hoy.toLocaleDateString() + '</p>' +
    '<ul style="padding-left:18px;line-height:1.7">' + pendientes + '</ul>' +
    (textoDeuda() !== 'Sin deuda'
      ? '<p style="background:#fdf0d5;padding:10px 12px;border-radius:8px"><b>Deuda pendiente:</b> ' +
        textoDeuda() + '. Se paga haciendo de mas.</p>'
      : '') +
    (penitenciaActiva()
      ? '<p style="background:#fbe0de;padding:10px 12px;border-radius:8px"><b>Penitencia sin cumplir:</b> ' +
        penitenciaActiva() + '</p>'
      : '') +
    (frase
      ? '<blockquote style="border-left:3px solid #d2d2d7;margin:22px 0;padding-left:14px;color:#6e6e73">' +
        frase.texto + '<br><small><b>' + frase.quien + '</b></small></blockquote>'
      : '') +
    '<p><a href="' + ss.getUrl() + '" style="background:#0071e3;color:#fff;padding:10px 16px;' +
    'border-radius:8px;text-decoration:none;display:inline-block">Abrir el tracker</a></p>' +
    '</div>';

  MailApp.sendEmail({
    to: email,
    subject: 'Tus habitos de hoy' + (est.negociables ? ' · ' + est.negociables + ' innegociables' : ''),
    htmlBody: cuerpo,
  });
}

/** Liquida el dia de ayer: genera deuda por cada fallo y sanciona a los 3. */
function liquidarAyer() {
  const ss = SpreadsheetApp.getActive();
  const habitos = leerHabitos();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const año = Number(leerConfig('Año')) || ayer.getFullYear();
  if (ayer.getFullYear() !== año) return;

  const marca = 'liquidado:' + fechaISO(ayer);
  if (historialTiene(marca)) return; // Abrir la hoja tres veces no cobra tres veces.

  const datos = leerAño(ss, año);
  for (let i = 0; i < habitos.length; i++) {
    const hab = habitos[i];
    if (!aplicaHoy(hab, ayer) || esCuota(hab)) continue;
    if (cumplido(hab, valorDe(datos, ayer.getMonth(), ayer.getDate(), hab.indice))) continue;

    if (hab.deuda > 0) {
      apuntarDeuda(fechaISO(ayer), hab.nombre, hab.deuda, hab.unidadDeuda,
        'Fallaste "' + hab.nombre + '" el ' + fechaISO(ayer));
    }
    let fallos = 0;
    const cursor = new Date(ayer);
    for (let d = 0; d < 7; d++) {
      if (aplicaHoy(hab, cursor) && cursor.getFullYear() === año &&
          !cumplido(hab, valorDe(datos, cursor.getMonth(), cursor.getDate(), hab.indice))) {
        fallos++;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    if (fallos >= 3) {
      asignarPenitencia(hab.innegociable ? 3 : 2, fallos + ' fallos de "' + hab.nombre + '" en 7 dias');
    }
  }
  apuntarHistorial(fechaISO(ayer), 'Liquidacion', marca);
  recalcularTodo();
}

function informeSemanal() {
  const ss = SpreadsheetApp.getActive();
  const habitos = leerHabitos();
  const hoy = new Date();
  const año = Number(leerConfig('Año')) || hoy.getFullYear();
  const datos = leerAño(ss, año);

  const castigo = penitenciaActiva();
  let hechos = 0, exigibles = 0, perfectos = 0;
  const fallosPorHabito = {};
  const cursor = new Date(hoy);
  for (let d = 0; d < 7; d++) {
    const est = estadoDelDia(datos, habitos, cursor, año, castigo);
    hechos += est.hechos;
    exigibles += est.exigibles;
    if (est.exigibles && est.hechos >= est.exigibles) perfectos++;
    for (let i = 0; i < habitos.length; i++) {
      const hab = habitos[i];
      if (!aplicaHoy(hab, cursor) || esCuota(hab)) continue;
      if (!cumplido(hab, valorDe(datos, cursor.getMonth(), cursor.getDate(), hab.indice))) {
        fallosPorHabito[hab.nombre] = (fallosPorHabito[hab.nombre] || 0) + 1;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  const ratio = exigibles ? hechos / exigibles : 0;
  const umbral = Number(leerConfig('Minimo semanal exigido')) || 85;
  const cumple = ratio * 100 >= umbral;
  const peores = Object.keys(fallosPorHabito)
    .sort(function (a, b) { return fallosPorHabito[b] - fallosPorHabito[a]; })
    .slice(0, 3);

  const veredicto = ratio >= 0.95 ? 'Semana impecable. Sube el liston.'
    : ratio >= 0.8 ? 'Semana solida. Ataca tu peor habito.'
    : ratio >= 0.6 ? 'Semana mediocre. Reduce habitos y cumple los que queden.'
    : 'Semana rota. Vuelve a los innegociables y nada mas.';

  const cuerpo =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1d1d1f">' +
    '<h2 style="margin:0 0 16px">Informe de la semana</h2>' +
    '<p style="font-size:34px;font-weight:700;margin:0;color:' + (cumple ? C.bien : C.malo) + '">' +
    Math.round(ratio * 100) + '%</p>' +
    '<p style="color:#6e6e73;margin:0 0 18px">Minimo del contrato: ' + umbral + '% · ' +
    perfectos + ' dias perfectos de 7</p>' +
    (peores.length
      ? '<p><b>Lo que te esta hundiendo:</b><br>' +
        peores.map(function (n) { return n + ' (' + fallosPorHabito[n] + ' fallos)'; }).join('<br>') + '</p>'
      : '') +
    (textoDeuda() !== 'Sin deuda' ? '<p><b>Deuda pendiente:</b> ' + textoDeuda() + '</p>' : '') +
    '<p style="background:' + (cumple ? '#d6f0dd' : '#fbe0de') + ';padding:12px;border-radius:8px">' +
    (cumple ? 'Contrato CUMPLIDO esta semana.' : 'Contrato INCUMPLIDO. Toca ejecutar la prenda.') + '</p>' +
    '<p>' + veredicto + '</p></div>';

  const mio = String(leerConfig('Email para los avisos') || Session.getEffectiveUser().getEmail());
  const auditor = String(leerConfig('Email de tu auditor') || '');
  const destinos = [mio, auditor].filter(function (x) { return x; }).join(',');
  if (destinos) {
    MailApp.sendEmail({ to: destinos, subject: 'Informe semanal: ' + Math.round(ratio * 100) + '%', htmlBody: cuerpo });
  }
  apuntarHistorial(fechaISO(hoy), 'Informe', 'Semana al ' + Math.round(ratio * 100) + '%');
}

/* ================================================================== */
/* Comprobacion y limpieza                                             */
/* ================================================================== */

function verificar() {
  const ss = SpreadsheetApp.getActive();
  const faltan = [];
  const necesarias = [HOJA_AJUSTES, HOJA_HOY, HOJA_PANEL, HOJA_UNI, HOJA_PRESION,
    HOJA_METODOS, HOJA_FRASES, HOJA_DATOS].concat(MESES);
  for (let i = 0; i < necesarias.length; i++) {
    if (!ss.getSheetByName(necesarias[i])) faltan.push(necesarias[i]);
  }

  const habitos = leerHabitos();
  const sinMinimo = habitos.filter(function (h) {
    return h.medida !== 'Si/No' && (!h.minimo || h.minimo >= h.objetivo);
  }).map(function (h) { return h.nombre; });
  const innegociables = habitos.filter(function (h) { return h.innegociable; }).length;

  const disparadores = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  const avisos = disparadores.indexOf('recordatorioDiario') >= 0;

  const lineas = [
    faltan.length ? '❌ Faltan pestañas: ' + faltan.join(', ') : '✅ Estan las ' + necesarias.length + ' pestañas',
    habitos.length ? '✅ ' + habitos.length + ' habitos configurados' : '❌ No hay ningun habito en Ajustes',
    innegociables === 0 ? '⚠️ No has marcado ningun innegociable: nada bloqueara tus recompensas'
      : innegociables > 4 ? '⚠️ ' + innegociables + ' innegociables es demasiado. Con dos o tres basta'
      : '✅ ' + innegociables + ' innegociables',
    sinMinimo.length ? '⚠️ Sin minimo util (regla anti-cero): ' + sinMinimo.join(', ') : '✅ Todos los minimos tienen sentido',
    avisos ? '✅ Avisos automaticos activos' : '⚠️ Avisos sin activar (menu > Activar avisos automaticos)',
    leerConfig('Email de tu auditor') ? '✅ Tienes auditor' : '⚠️ Sin auditor: el informe solo te llegara a ti',
  ];
  avisar('Comprobacion', lineas.join('\n\n'));
}

function limpiarSobrantes(ss) {
  const validas = [HOJA_AJUSTES, HOJA_HOY, HOJA_PANEL, HOJA_UNI, HOJA_PRESION,
    HOJA_METODOS, HOJA_FRASES, HOJA_DATOS].concat(MESES);
  const hojas = ss.getSheets();
  for (let i = 0; i < hojas.length; i++) {
    const n = hojas[i].getName();
    // Solo se va la hoja vacia que Google crea por defecto.
    if (validas.indexOf(n) < 0 && /^(Hoja|Sheet)\s*\d*$/i.test(n) && hojas.length > 1) {
      ss.deleteSheet(hojas[i]);
    }
  }
}

function ordenarPestañas(ss) {
  const orden = [HOJA_HOY, HOJA_PANEL].concat(MESES)
    .concat([HOJA_UNI, HOJA_PRESION, HOJA_METODOS, HOJA_FRASES, HOJA_AJUSTES]);
  // La posicion se cuenta sobre las pestañas que EXISTEN, no sobre la lista
  // completa: mientras se construye por partes faltan meses, y pedirle a
  // Sheets la posicion 15 cuando solo hay diez pestañas es "Invalid argument".
  let posicion = 0;
  for (let i = 0; i < orden.length; i++) {
    const h = ss.getSheetByName(orden[i]);
    if (!h) continue;
    posicion++;
    ss.setActiveSheet(h);
    ss.moveActiveSheet(posicion);
  }
}

/* ================================================================== */
/* Contenido — mismo material que las pestañas Metodos y Frases de la  */
/* aplicacion, para que las dos versiones digan lo mismo.              */
/* ================================================================== */

/** Tecnica, de quien, que es, y como se aplica dentro de esta hoja. */
const TECNICAS = [
  ['La regla de los dos minutos', 'David Allen · popularizada por James Clear', 'Si algo lleva menos de dos minutos, se hace ahora. Y para empezar un habito nuevo, redúcelo hasta que quepa en dos minutos: "leer" pasa a ser "abrir el libro y leer una pagina".', 'Es exactamente el campo minimo valido de cada habito. Ponlo tan bajo que sea absurdo no hacerlo: la racha sobrevive y mañana no empiezas de cero.'],
  ['Apilar habitos', 'BJ Fogg · James Clear', 'Enganchas el habito nuevo a uno que ya haces sin pensar: "despues de X, hare Y". El habito viejo hace de recordatorio, que es la parte que siempre falla.', 'Escribelo en las notas del habito: "Despues de cerrar el portatil, 10 min de lectura". Y pon la ventana horaria justo despues de ese ancla.'],
  ['Intenciones de implementacion', 'Peter Gollwitzer', 'Decidir de antemano cuando, donde y como. En los estudios, la gente que escribe "el martes a las 18:00 en la biblioteca" cumple mucho mas que la que escribe "estudiar mas".', 'Es el ritual de apertura: las 3 cosas del dia se escriben concretas y con hora. "Tema 4 de Calculo a las 17:00", no "estudiar".'],
  ['Bloques de tiempo', 'Cal Newport', 'Cada hora del dia tiene un dueño asignado por escrito. No se decide sobre la marcha, porque decidir sobre la marcha siempre gana la opcion mas comoda.', 'El planificador de Universidad ya lo hace por ti: coge tus huecos reales entre clases y les asigna asignatura. Tu solo tienes que sentarte.'],
  ['Pomodoro', 'Francesco Cirillo', 'Bloques cerrados de trabajo con descanso corto entre medias. El limite de tiempo es lo que hace tolerable empezar cuando no apetece.', 'El cronometro de la pestaña Plan. Al terminar, los minutos se suman solos a tu habito de estudio y a la asignatura.'],
  ['Trabajo profundo', 'Cal Newport', 'Sesiones largas sin interrupciones sobre una sola cosa dificil. La capacidad de concentrarse asi es cada vez mas rara y por eso vale cada vez mas.', 'Sube el tamaño de bloque a 90 minutos en Ajustes y deja el movil en otra habitacion. Un bloque profundo al dia rinde mas que cinco fragmentados.'],
  ['Metodo Ivy Lee', 'Ivy Lee, para Charles Schwab (1918)', 'Al terminar el dia, apunta las 6 cosas mas importantes de mañana en orden. Al dia siguiente empiezas por la primera y no pasas a la segunda hasta acabarla.', 'Usa el ritual de cierre para dejar escritas las de mañana. La app te pide 3 en vez de 6: si cumples esas tres, el dia ya esta bien invertido.'],
  ['Matriz de Eisenhower', 'Atribuida a Dwight D. Eisenhower', 'Separar urgente de importante. Lo importante y no urgente (estudiar con antelacion, entrenar, dormir) es lo que nunca grita y lo que decide el año.', 'Tus innegociables son la casilla de importante-no-urgente. Por eso bloquean recompensas: es la unica forma de que compitan con lo urgente.'],
  ['No romper la cadena', 'Atribuida a Jerry Seinfeld', 'Marcar cada dia cumplido en un calendario. La cadena de marcas se convierte en algo que no quieres romper, y esa reticencia hace mas que la motivacion.', 'La rejilla mensual es literalmente eso. Y las rachas por habito la miden: 🔥 al lado del nombre.'],
  ['Emparejar tentaciones', 'Katherine Milkman', 'Solo te permites algo que te encanta mientras haces algo que te cuesta: la serie solo en la cinta, el podcast bueno solo yendo al gimnasio.', 'Define esas cosas como recompensas en Presion. La app las mantiene bloqueadas hasta que cierras los innegociables del dia.'],
  ['Recuerdo activo', 'Investigacion en psicologia cognitiva', 'Cerrar los apuntes e intentar reproducir lo que sabes. Cuesta mas y por eso funciona: releer da sensacion de dominio sin producirlo.', 'Registra esos bloques con tecnica "repaso" o "ejercicios". Si un tema te sale mal, sube las horas estimadas del examen y el plan te dara mas bloques.'],
  ['Repaso espaciado', 'Hermann Ebbinghaus', 'Repasar en intervalos crecientes en vez de amontonar. Lo mismo estudiado en cuatro dias se retiene mucho mas que en una noche.', 'El planificador ya evita mas de dos bloques seguidos de la misma asignatura y la reparte por la semana. Meter los examenes con antelacion es lo que le da margen para espaciar.'],
  ['Tecnica Feynman', 'Richard Feynman', 'Explicar el tema con palabras sencillas como si se lo contaras a alguien que no sabe nada. Donde te atascas es exactamente lo que no entiendes.', 'Usa la nota del habito de estudio para escribir en dos lineas lo que has aprendido hoy. Si no puedes, no lo has aprendido.'],
  ['La regla de los 5 segundos', 'Mel Robbins', 'Cuando sabes lo que tienes que hacer, cuenta 5-4-3-2-1 y muevete antes de terminar. Corta el margen que tu cabeza usa para negociar.', 'Para el habito que mas te cuesta arrancar. Escribelo en sus notas: leerlo al abrir la ficha es parte del truco.'],
  ['Comete la rana', 'Brian Tracy', 'La tarea mas fea del dia va primero, cuando aun tienes energia y nadie te ha interrumpido. Todo lo demas del dia es cuesta abajo.', 'Pon la peor de tus 3 del ritual de apertura en primer lugar y hazla antes de comer.'],
  ['Ganancias marginales del 1%', 'Dave Brailsford, British Cycling', 'Mejorar un 1% en muchas cosas pequeñas en vez de buscar un cambio heroico. Acumulado, el 1% diario multiplica por 37 en un año.', 'No añadas habitos nuevos: sube un poco el objetivo de los que ya cumples al 90%. El Panel te dice cuales son.'],
  ['Ley de Parkinson', 'Cyril Northcote Parkinson', 'El trabajo se estira hasta llenar el tiempo disponible. Si te das toda la tarde, tardas toda la tarde.', 'Dale al cronometro antes de empezar y ponte un limite corto. Un bloque de 50 minutos con final visible rinde mas que "la tarde".'],
  ['Dispositivos de compromiso', 'Richard Thaler · Dean Karlan', 'Atarse al mastil por adelantado: poner dinero o reputacion de por medio para que el yo de dentro de dos semanas no pueda renegociar.', 'Es el contrato de la pestaña Presion. Prenda concreta, auditor con nombre y email, y bloqueado hasta la fecha de fin.'],
  ['Diseñar el entorno', 'BJ Fogg · James Clear', 'Añadir friccion a lo que quieres evitar y quitarsela a lo que quieres hacer. Mover el movil de habitacion gana a cualquier promesa.', 'Apunta la friccion de cada dia en el ritual de cierre ("el movil en la mesa") y arreglala mañana. Esa pregunta convierte cada fallo en un ajuste.'],
  ['Revision semanal', 'David Allen (GTD)', 'Una cita fija a la semana para mirar lo que ha pasado y decidir lo siguiente. Sin ella, cualquier sistema se degrada en dos semanas.', 'Presion → Auditoria, todos los domingos. Mira tu peor habito, decide UNA cosa para la semana y manda el informe a tu auditor.'],
];

/**
 * Frase, quien la dijo y de donde sale. Las que circulan sin fuente
 * documentada van marcadas como atribuidas: es preferible decirlo a colgarle
 * a alguien una frase que quiza nunca dijo.
 */
const FRASES = [
  ['La disciplina es el puente entre las metas y los logros.', 'Jim Rohn · Emprendedor y conferenciante', ''],
  ['No te elevas a la altura de tus objetivos: caes a la altura de tus sistemas.', 'James Clear · Autor', 'Habitos atomicos'],
  ['La unica forma de hacer un gran trabajo es amar lo que haces.', 'Steve Jobs · Cofundador de Apple', 'Discurso en Stanford, 2005'],
  ['Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un habito.', 'Will Durant · Historiador, resumiendo a Aristoteles', 'La historia de la filosofia'],
  ['No he fracasado. Simplemente he encontrado diez mil formas que no funcionan.', 'Thomas Edison · Inventor y empresario', 'Atribuida'],
  ['Tanto si crees que puedes como si crees que no puedes, tienes razon.', 'Henry Ford · Fundador de Ford', 'Atribuida'],
  ['Si no te averguenza la primera version de tu producto, has lanzado demasiado tarde.', 'Reid Hoffman · Cofundador de LinkedIn', ''],
  ['La determinacion es la cualidad mas importante en un fundador.', 'Paul Graham · Cofundador de Y Combinator', ''],
  ['Cuando algo es lo bastante importante, lo haces aunque las probabilidades no esten a tu favor.', 'Elon Musk · Fundador de SpaceX y Tesla', ''],
  ['Si duplicas el numero de experimentos que haces al año, duplicas tu inventiva.', 'Jeff Bezos · Fundador de Amazon', ''],
  ['La diferencia entre la gente de exito y la gente de mucho exito es que la segunda dice que no a casi todo.', 'Warren Buffett · Inversor', ''],
  ['Lo que se mide, se gestiona.', 'Peter Drucker · Padre de la gestion moderna', ''],
  ['El trabajo profundo es la superpotencia del siglo XXI.', 'Cal Newport · Profesor de informatica y autor', 'Deep Work'],
  ['El grit es pasion y perseverancia por objetivos a muy largo plazo.', 'Angela Duckworth · Psicologa', 'Grit'],
  ['Si quieres ser grande en algo, tienes que obsesionarte.', 'Kobe Bryant · Jugador de baloncesto', ''],
  ['He fallado mas de 9.000 tiros en mi carrera. He perdido casi 300 partidos. Por eso he tenido exito.', 'Michael Jordan · Jugador de baloncesto', 'Anuncio de Nike, 1997'],
  ['No pierdas mas tiempo discutiendo como debe ser un hombre bueno. Se uno.', 'Marco Aurelio · Emperador romano', 'Meditaciones'],
  ['No es que tengamos poco tiempo: es que perdemos mucho.', 'Seneca · Filosofo', 'Sobre la brevedad de la vida'],
  ['No importa lo despacio que vayas mientras no te detengas.', 'Confucio · Filosofo', 'Atribuida'],
  ['En mi casa, en la cena, se preguntaba: ¿en que has fracasado esta semana?', 'Sara Blakely · Fundadora de Spanx', ''],
  ['Empieza donde estas. Usa lo que tienes. Haz lo que puedas.', 'Arthur Ashe · Tenista', 'Atribuida'],
  ['Los planes no valen nada; planificar lo es todo.', 'Dwight D. Eisenhower · General y presidente', ''],
  ['Lee lo que te guste hasta que te guste leer.', 'Naval Ravikant · Inversor y fundador de AngelList', ''],
  ['Las ideas son faciles. La ejecucion lo es todo.', 'John Doerr · Inversor', ''],
  ['El exito es la suma de pequeños esfuerzos repetidos dia tras dia.', 'Robert Collier · Escritor', 'Atribuida'],
  ['Un objetivo sin un plan es solo un deseo.', 'Antoine de Saint-Exupery · Escritor y aviador', 'Atribuida'],
];

