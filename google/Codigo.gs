/**
 * Habit Tracker — servidor de sincronizacion sobre Google Apps Script.
 *
 * Que hace: guarda tu documento completo en un fichero JSON de tu Drive y lo
 * mezcla con el que le manda cada dispositivo (gana el registro mas reciente,
 * igual que el servidor de Node). Ademas vuelca los datos a pestañas legibles
 * de esta hoja para que puedas mirarlos, filtrarlos y graficarlos.
 *
 * Por que Drive y no celdas: una celda admite 50.000 caracteres y un año de
 * uso se pasa de ahi. El JSON vive en un fichero; la hoja es el espejo humano.
 *
 * Instalacion: pestaña Extensiones > Apps Script, pega este fichero, ejecuta
 * `configurar` una vez y publica como aplicacion web. Los pasos completos
 * estan en docs/GOOGLE.md del repositorio.
 */

const PROP_CLAVE = 'CLAVE';
const PROP_ARCHIVO = 'ARCHIVO_ID';
const PROP_ESPEJO = 'ULTIMO_ESPEJO';
const NOMBRE_ARCHIVO = 'habit-tracker-datos.json';

/** Cada cuanto se regeneran las pestañas legibles, como mucho. */
const ESPEJO_CADA_MS = 60 * 60 * 1000;

const COLECCIONES = [
  'habits', 'entries', 'days', 'goals', 'subjects', 'exams',
  'tasks', 'sessions', 'contracts', 'debts', 'penances', 'rewards', 'ledger',
];

/* ------------------------------------------------------------------ */
/* Instalacion                                                         */
/* ------------------------------------------------------------------ */

/**
 * Ejecuta esto UNA vez desde el editor de Apps Script. Crea el fichero de
 * datos, genera una clave y te la enseña: esa clave es la que pegas en la app.
 */
function configurar() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(PROP_CLAVE)) {
    props.setProperty(PROP_CLAVE, generarClave());
  }
  archivoDatos();
  const clave = props.getProperty(PROP_CLAVE);
  const mensaje =
    'Clave de sincronizacion:\n\n' + clave +
    '\n\nGuardala. La necesitas en Ajustes > Sincronizacion de la app.';
  Logger.log(mensaje);
  try {
    SpreadsheetApp.getUi().alert(mensaje);
  } catch (err) {
    // Sin interfaz (ejecucion desde el editor sin hoja abierta): basta el log.
  }
  return clave;
}

/** Vuelve a enseñar la clave si la has perdido. */
function verClave() {
  return configurar();
}

function generarClave() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 20; i++) {
    s += abc.charAt(Math.floor(Math.random() * abc.length));
    if (i % 5 === 4 && i < 19) s += '-';
  }
  return s;
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Habit Tracker')
      .addItem('Ver clave de sincronizacion', 'verClave')
      .addItem('Actualizar pestañas ahora', 'exportarAhora')
      .addToUi();
  } catch (err) {
    // La hoja puede abrirse sin permisos de interfaz; no es critico.
  }
}

function exportarAhora() {
  escribirEspejo(leerDoc());
  PropertiesService.getScriptProperties().setProperty(PROP_ESPEJO, String(Date.now()));
}

/* ------------------------------------------------------------------ */
/* Puntos de entrada web                                               */
/* ------------------------------------------------------------------ */

function doGet() {
  return responder({ ok: true, name: 'habit-tracker-apps-script', version: 1 });
}

/**
 * La app manda el cuerpo como text/plain a proposito: con application/json el
 * navegador haria una peticion previa de comprobacion (preflight) que Apps
 * Script no contesta, y la sincronizacion fallaria por CORS.
 */
function doPost(e) {
  try {
    const cuerpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const clave = PropertiesService.getScriptProperties().getProperty(PROP_CLAVE);

    if (!clave) {
      return responder({ error: 'Sin configurar: ejecuta la funcion configurar() una vez.' });
    }
    if (String(cuerpo.clave || '') !== clave) {
      return responder({ error: 'Clave incorrecta' });
    }

    switch (cuerpo.accion) {
      case 'ping':
        return responder({ ok: true, hoja: SpreadsheetApp.getActive().getName() });

      case 'sync': {
        if (!cuerpo.doc || typeof cuerpo.doc !== 'object') {
          return responder({ error: 'Falta el documento' });
        }
        const guardado = leerDoc();
        const mezclado = guardado ? mezclar(guardado, cuerpo.doc) : normalizar(cuerpo.doc);
        guardarDoc(mezclado);
        espejoSiTocaba(mezclado);
        return responder({ doc: mezclado, serverTime: Date.now() });
      }

      case 'exportar':
        escribirEspejo(leerDoc());
        PropertiesService.getScriptProperties().setProperty(PROP_ESPEJO, String(Date.now()));
        return responder({ ok: true });

      default:
        return responder({ error: 'Accion desconocida' });
    }
  } catch (err) {
    return responder({ error: String((err && err.message) || err) });
  }
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/* ------------------------------------------------------------------ */
/* Almacen en Drive                                                    */
/* ------------------------------------------------------------------ */

function archivoDatos() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(PROP_ARCHIVO);
  if (id) {
    try {
      return DriveApp.getFileById(id);
    } catch (err) {
      // Si lo borraste de la papelera, creamos uno nuevo abajo.
    }
  }
  const archivo = DriveApp.createFile(NOMBRE_ARCHIVO, '', MimeType.PLAIN_TEXT);
  props.setProperty(PROP_ARCHIVO, archivo.getId());
  return archivo;
}

function leerDoc() {
  const contenido = archivoDatos().getBlob().getDataAsString('UTF-8');
  if (!contenido) return null;
  try {
    return JSON.parse(contenido);
  } catch (err) {
    return null;
  }
}

function guardarDoc(doc) {
  archivoDatos().setContent(JSON.stringify(doc));
}

/* ------------------------------------------------------------------ */
/* Mezcla — misma regla que el cliente para que ambos converjan         */
/* ------------------------------------------------------------------ */

function normalizar(entrada) {
  const doc = { schema: 1, profile: (entrada && entrada.profile) || {} };
  for (let i = 0; i < COLECCIONES.length; i++) {
    const c = COLECCIONES[i];
    const valor = entrada && entrada[c];
    doc[c] = valor && typeof valor === 'object' ? valor : {};
  }
  return doc;
}

/**
 * Gana el `updatedAt` mas alto de cada registro. Los empates se rompen
 * comparando el JSON, de forma determinista, para que dos dispositivos que
 * sincronizan en distinto orden acaben con el mismo resultado.
 */
function mezclar(a, b) {
  const izq = normalizar(a);
  const der = normalizar(b);
  const salida = normalizar({});

  salida.profile = elegir(izq.profile, der.profile);

  for (let i = 0; i < COLECCIONES.length; i++) {
    const c = COLECCIONES[i];
    const destino = {};
    const l = izq[c];
    const r = der[c];
    const claves = {};
    Object.keys(l).forEach(function (k) { claves[k] = true; });
    Object.keys(r).forEach(function (k) { claves[k] = true; });
    Object.keys(claves).forEach(function (k) {
      destino[k] = l[k] && r[k] ? elegir(l[k], r[k]) : l[k] || r[k];
    });
    salida[c] = destino;
  }
  return salida;
}

function elegir(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ta = a.updatedAt || 0;
  const tb = b.updatedAt || 0;
  if (ta > tb) return a;
  if (tb > ta) return b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/* ------------------------------------------------------------------ */
/* Espejo legible en la hoja                                           */
/* ------------------------------------------------------------------ */

function espejoSiTocaba(doc) {
  const props = PropertiesService.getScriptProperties();
  const ultimo = Number(props.getProperty(PROP_ESPEJO) || 0);
  // Sincronizas cada pocos segundos mientras usas la app; reescribir la hoja
  // cada vez seria tirar cuota para nada.
  if (Date.now() - ultimo < ESPEJO_CADA_MS) return;
  escribirEspejo(doc);
  props.setProperty(PROP_ESPEJO, String(Date.now()));
}

function escribirEspejo(doc) {
  if (!doc) return;
  const hoja = SpreadsheetApp.getActive();
  const habitos = vivos(doc.habits);
  const nombrePorId = {};
  habitos.forEach(function (h) { nombrePorId[h.id] = h.emoji ? h.emoji + ' ' + h.name : h.name; });
  const asignaturas = {};
  vivos(doc.subjects).forEach(function (s) { asignaturas[s.id] = s.name; });

  volcar(hoja, 'Habitos',
    ['Nombre', 'Categoria', 'Tipo', 'Objetivo', 'Unidad', 'Minimo', 'Cuando', 'Innegociable', 'Peso', 'Notas'],
    habitos.map(function (h) {
      return [
        nombrePorId[h.id], h.category, h.kind === 'quit' ? 'evitar' : 'hacer',
        h.target, h.unit || '', h.minimum, cuando(h.schedule),
        h.nonNegotiable ? 'SI' : '', h.weight, h.notes || '',
      ];
    }));

  volcar(hoja, 'Registros',
    ['Fecha', 'Habito', 'Valor', 'Estado', 'Nota'],
    vivos(doc.entries)
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
      .map(function (e) {
        return [e.date, nombrePorId[e.habitId] || e.habitId, e.value, e.status, e.note || ''];
      }));

  volcar(hoja, 'Dias',
    ['Fecha', 'Animo', 'Energia', 'Horas de sueño', 'Cerrado', 'Que salio bien', 'Que me freno'],
    vivos(doc.days)
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
      .map(function (d) {
        return [d.date, d.mood || '', d.energy || '', d.sleepHours || '',
          d.closedAt ? 'SI' : '', d.win || '', d.friction || ''];
      }));

  volcar(hoja, 'Estudio',
    ['Fecha', 'Asignatura', 'Minutos', 'Tecnica', 'Foco'],
    vivos(doc.sessions)
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
      .map(function (s) {
        return [s.date, asignaturas[s.subjectId] || '', s.minutes, s.technique, s.focus];
      }));

  volcar(hoja, 'Resumen',
    ['Habito', 'Veces cumplido', 'Veces al minimo', 'Fallos registrados', 'Ultima vez'],
    habitos.map(function (h) {
      const suyos = vivos(doc.entries).filter(function (e) { return e.habitId === h.id; });
      const hechos = suyos.filter(function (e) { return e.status === 'done'; });
      const ultimo = hechos.map(function (e) { return e.date; }).sort().pop();
      return [
        nombrePorId[h.id],
        hechos.length,
        suyos.filter(function (e) { return e.status === 'partial'; }).length,
        suyos.filter(function (e) { return e.status === 'missed'; }).length,
        ultimo || '',
      ];
    }));
}

/**
 * Los porcentajes de cumplimiento NO se calculan aqui a proposito: dependen
 * del calendario de cada habito y de las congelaciones, y tener esa logica en
 * dos sitios acaba en dos respuestas distintas. La app manda; esto es el
 * espejo en crudo para que puedas hacer tus propias tablas.
 */
function volcar(hoja, nombre, cabecera, filas) {
  let pestaña = hoja.getSheetByName(nombre);
  if (!pestaña) pestaña = hoja.insertSheet(nombre);
  pestaña.clear();
  const datos = [cabecera].concat(filas.length ? filas : [cabecera.map(function () { return ''; })]);
  pestaña.getRange(1, 1, datos.length, cabecera.length).setValues(datos);
  pestaña.getRange(1, 1, 1, cabecera.length).setFontWeight('bold');
  pestaña.setFrozenRows(1);
  pestaña.autoResizeColumns(1, cabecera.length);
}

function vivos(coleccion) {
  if (!coleccion) return [];
  return Object.keys(coleccion)
    .map(function (k) { return coleccion[k]; })
    .filter(function (r) { return r && !r.deleted; });
}

function cuando(s) {
  if (!s) return '';
  const dias = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
  switch (s.type) {
    case 'daily': return 'Todos los dias';
    case 'weekdays': return 'Lunes a viernes';
    case 'weekend': return 'Fin de semana';
    case 'classDays': return 'Dias con clase';
    case 'freeDays': return 'Dias sin clase';
    case 'timesPerWeek': return s.timesPerWeek + 'x por semana';
    case 'custom': return (s.days || []).map(function (d) { return dias[d]; }).join(' ');
    default: return '';
  }
}
