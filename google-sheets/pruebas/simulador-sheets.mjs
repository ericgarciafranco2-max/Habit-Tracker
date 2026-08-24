/**
 * Simulador minimo de la API de Google Sheets: guarda valores en rejillas de
 * memoria y acepta las llamadas de formato sin hacer nada. No evalua formulas
 * (las celdas con formula quedan vacias), que es justo lo que queremos: asi
 * comprobamos que la logica del script no depende de que una formula haya
 * calculado antes.
 */
/**
 * Cada llamada a la API de Sheets es un viaje al servidor. Apps Script corta
 * la ejecucion a los 6 minutos, asi que lo que hay que vigilar no es el tiempo
 * de CPU sino cuantas operaciones se piden. Aqui se cuentan todas.
 */
export const contador = { total: 0, por: {} };
export function contar(nombre) {
  contador.total++;
  contador.por[nombre] = (contador.por[nombre] || 0) + 1;
}
export function reiniciarContador() {
  contador.total = 0;
  contador.por = {};
}

const noop = function () { return this; };

class Rango {
  constructor(hoja, fila, col, filas, cols) {
    this.hoja = hoja; this.fila = fila; this.col = col;
    this.filas = filas; this.cols = cols;
  }
  getRow() { return this.fila; }
  getColumn() { return this.col; }
  getSheet() { return this.hoja; }
  getNumRows() { return this.filas; }
  getNumColumns() { return this.cols; }
  setValue(v) {
    for (let r = 0; r < this.filas; r++)
      for (let c = 0; c < this.cols; c++) this.hoja._set(this.fila + r, this.col + c, v);
    return this;
  }
  setValues(m) {
    if (m.length !== this.filas || m[0].length !== this.cols) {
      throw new Error(`setValues: rango ${this.filas}x${this.cols} pero datos ${m.length}x${m[0].length} en ${this.hoja.getName()} R${this.fila}C${this.col}`);
    }
    for (let r = 0; r < this.filas; r++)
      for (let c = 0; c < this.cols; c++) this.hoja._set(this.fila + r, this.col + c, m[r][c]);
    return this;
  }
  getValue() { return this.hoja._get(this.fila, this.col); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.filas; r++) {
      const fila = [];
      for (let c = 0; c < this.cols; c++) fila.push(this.hoja._get(this.fila + r, this.col + c));
      out.push(fila);
    }
    return out;
  }
  // Las formulas se registran para poder revisarlas, pero dejan la celda vacia.
  setFormula(f) {
    if (typeof f !== 'string' || f[0] !== '=') throw new Error('formula rara: ' + f);
    this.hoja.formulas.push({ fila: this.fila, col: this.col, f });
    return this;
  }
  setFormulas(m) {
    m.forEach((fila, r) => fila.forEach((f, c) => {
      if (typeof f !== 'string' || f[0] !== '=') throw new Error('formula rara: ' + f);
      this.hoja.formulas.push({ fila: this.fila + r, col: this.col + c, f });
    }));
    return this;
  }
  setFormulaR1C1(f) { return this.setFormula(f); }
  setDataValidation() { return this; }
  setDataValidations(m) {
    if (m.length !== this.filas || m[0].length !== this.cols) throw new Error('setDataValidations: dimensiones');
    return this;
  }
  insertCheckboxes() { return this; }
  clearContent() {
    for (let r = 0; r < this.filas; r++)
      for (let c = 0; c < this.cols; c++) this.hoja._set(this.fila + r, this.col + c, '');
    return this;
  }
  merge() {
    // Google rechaza una fusion que cruce el borde de lo inmovilizado. El
    // error real aparece mas tarde, al vaciar el lote de escrituras, asi que
    // en la hoja de verdad la traza señala una funcion que no tiene la culpa.
    const fc = this.hoja.frozenCols;
    if (fc > 0 && this.col <= fc && this.col + this.cols - 1 > fc) {
      throw new Error(
        `No se pueden combinar columnas inmovilizadas con columnas no inmovilizadas ` +
        `(${this.hoja.getName()}: fusion de ${this.cols} columnas desde la ${this.col} con ${fc} inmovilizadas)`);
    }
    const fr = this.hoja.frozenRows;
    if (fr > 0 && this.fila <= fr && this.fila + this.filas - 1 > fr) {
      throw new Error(`No se pueden combinar filas inmovilizadas con filas no inmovilizadas (${this.hoja.getName()})`);
    }
    this.hoja.fusiones.push({ fila: this.fila, col: this.col, filas: this.filas, cols: this.cols });
    return this;
  }
  breakApart() { this.hoja.fusiones = []; return this; }
}
['setFontSize','setFontWeight','setFontWeights','setFontColor','setFontColors','setBackground','setBackgrounds','setBorder',
 'setNumberFormat','setHorizontalAlignment','setVerticalAlignment','setWrap','clearDataValidations',
 'setFontLine','setNote','clearFormat'].forEach((m) => {
  Rango.prototype[m] = function () { contar('rango.' + m); return this; };
});
['setValue','setValues','getValue','getValues','setFormula','setFormulas','setFormulaR1C1',
 'setDataValidation','setDataValidations','insertCheckboxes','clearContent','merge','breakApart']
  .forEach((m) => {
    const original = Rango.prototype[m];
    Rango.prototype[m] = function (...args) { contar('rango.' + m); return original.apply(this, args); };
  });

class Hoja {
  constructor(nombre) {
    this.nombre = nombre; this.celdas = new Map(); this.formulas = [];
    this.oculta = false; this.frozenRows = 0; this.frozenCols = 0; this.fusiones = [];
  }
  setFrozenRows(n) { this.frozenRows = n; return this; }
  setFrozenColumns(n) { this.frozenCols = n; return this; }
  getFrozenRows() { return this.frozenRows; }
  getFrozenColumns() { return this.frozenCols; }
  getMaxColumns() { return 60; }
  getName() { return this.nombre; }
  _clave(f, c) { return f + ':' + c; }
  _set(f, c, v) {
    if (f < 1 || c < 1) throw new Error('celda fuera de rango: R' + f + 'C' + c);
    if (f > 1000 || c > 200) throw new Error('celda muy lejos: R' + f + 'C' + c + ' en ' + this.nombre);
    this.celdas.set(this._clave(f, c), v);
  }
  _get(f, c) { const v = this.celdas.get(this._clave(f, c)); return v === undefined ? '' : v; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') throw new Error('getRange con texto no soportado: ' + a);
    return new Rango(this, a, b, c === undefined ? 1 : c, d === undefined ? 1 : d);
  }
  getLastRow() { let m = 0; for (const k of this.celdas.keys()) m = Math.max(m, Number(k.split(':')[0])); return m; }
  getMaxRows() { return 1000; }
  getCharts() { return []; }
  clear() { this.celdas.clear(); this.formulas = []; return this; }
  hideSheet() { this.oculta = true; return this; }
  newChart() {
    const b = {};
    ['setChartType','addRange','setPosition','setOption'].forEach((m) => { b[m] = () => b; });
    b.build = () => ({});
    return b;
  }
}
['clearConditionalFormatRules','removeChart','setHiddenGridlines','setColumnWidth','setColumnWidths',
 'setRowHeight','hideColumns','insertChart','setConditionalFormatRules','autoResizeColumns',
 'setTabColor','hideSheet'].forEach((m) => {
  Hoja.prototype[m] = function () { contar('hoja.' + m); return this; };
});
// getRange() no viaja al servidor, solo describe un rango: no se cuenta.
['clear','getLastRow','getCharts','setFrozenRows','setFrozenColumns'].forEach((m) => {
  const original = Hoja.prototype[m];
  Hoja.prototype[m] = function (...args) { contar('hoja.' + m); return original.apply(this, args); };
});

class Libro {
  constructor() { this.hojas = []; }
  getSheetByName(n) { return this.hojas.find((h) => h.nombre === n) || null; }
  insertSheet(n) { contar('libro.insertSheet'); const h = new Hoja(n); this.hojas.push(h); return h; }
  getSheets() { return this.hojas.slice(); }
  deleteSheet(h) { this.hojas = this.hojas.filter((x) => x !== h); }
  setActiveSheet(h) { this.activa = h; return h; }
  moveActiveSheet() {}
  getSpreadsheetTimeZone() { return 'Europe/Madrid'; }
  setSpreadsheetTimeZone() {}
  getUrl() { return 'https://docs.google.com/spreadsheets/d/prueba'; }
  getName() { return 'Habit Tracker de prueba'; }
}

export const libro = new Libro();
export const propiedades = new Map();
export const correos = [];
export const alertas = [];

const validador = () => {
  const v = {};
  ['requireValueInList','requireCheckbox','setAllowInvalid'].forEach((m) => { v[m] = () => v; });
  v.build = () => ({});
  return v;
};
const reglaCF = () => {
  const r = {};
  ['whenFormulaSatisfied','setBackground','setFontColor','setRanges'].forEach((m) => { r[m] = () => r; });
  r.build = () => ({});
  return r;
};

export const entorno = {
  SpreadsheetApp: {
    getActive: () => libro,
    getActiveSpreadsheet: () => libro,
    newDataValidation: validador,
    newConditionalFormatRule: reglaCF,
    BorderStyle: { SOLID: 'SOLID' },
    getUi: () => ({
      createMenu: () => {
        const m = {};
        ['addItem','addSeparator','addToUi'].forEach((f) => { m[f] = () => m; });
        return m;
      },
      alert: (a, b) => { alertas.push(b === undefined ? a : a + ' | ' + b); return 'YES'; },
      ButtonSet: { OK: 'OK', YES_NO: 'YES_NO' },
      Button: { YES: 'YES' },
    }),
  },
  Charts: { ChartType: { COLUMN: 'COLUMN', BAR: 'BAR', LINE: 'LINE' } },
  ScriptApp: {
    getProjectTriggers: () => [],
    deleteTrigger: () => {},
    WeekDay: { SUNDAY: 'SUNDAY' },
    newTrigger: () => {
      const t = {};
      ['timeBased','atHour','everyDays','onWeekDay'].forEach((f) => { t[f] = () => t; });
      t.create = () => ({});
      return t;
    },
  },
  MailApp: { sendEmail: (o) => correos.push(o) },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'yo@example.com' }) },
  Logger: { log: () => {} },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => (propiedades.has(k) ? propiedades.get(k) : null),
      setProperty: (k, v) => { propiedades.set(k, String(v)); },
      deleteProperty: (k) => { propiedades.delete(k); },
    }),
  },
  Utilities: { formatDate: (d) => d.toISOString() },
  console,
};
