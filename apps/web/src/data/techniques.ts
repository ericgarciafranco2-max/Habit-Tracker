/**
 * Tecnicas de disciplina, foco y estudio.
 *
 * Cada ficha dice de donde sale, cuanto cuesta aplicarla y —lo importante—
 * como se usa dentro de esta app, no en abstracto.
 */
export interface Technique {
  id: string;
  name: string;
  author: string;
  topic: 'habitos' | 'foco' | 'tiempo' | 'estudio' | 'compromiso' | 'constancia';
  /** Coste de arrancarla, en minutos. */
  setup: number;
  what: string;
  how: string;
}

export const TECHNIQUES: Technique[] = [
  {
    id: 'dos-minutos',
    name: 'La regla de los dos minutos',
    author: 'David Allen · popularizada por James Clear',
    topic: 'habitos',
    setup: 2,
    what: 'Si algo lleva menos de dos minutos, se hace ahora. Y para empezar un habito nuevo, redúcelo hasta que quepa en dos minutos: "leer" pasa a ser "abrir el libro y leer una pagina".',
    how: 'Es exactamente el campo **minimo valido** de cada habito. Ponlo tan bajo que sea absurdo no hacerlo: la racha sobrevive y mañana no empiezas de cero.',
  },
  {
    id: 'apilar',
    name: 'Apilar habitos',
    author: 'BJ Fogg · James Clear',
    topic: 'habitos',
    setup: 3,
    what: 'Enganchas el habito nuevo a uno que ya haces sin pensar: "despues de X, hare Y". El habito viejo hace de recordatorio, que es la parte que siempre falla.',
    how: 'Escribelo en las **notas** del habito: "Despues de cerrar el portatil, 10 min de lectura". Y pon la ventana horaria justo despues de ese ancla.',
  },
  {
    id: 'intenciones',
    name: 'Intenciones de implementacion',
    author: 'Peter Gollwitzer',
    topic: 'habitos',
    setup: 3,
    what: 'Decidir de antemano cuando, donde y como. En los estudios, la gente que escribe "el martes a las 18:00 en la biblioteca" cumple mucho mas que la que escribe "estudiar mas".',
    how: 'Es el **ritual de apertura**: las 3 cosas del dia se escriben concretas y con hora. "Tema 4 de Calculo a las 17:00", no "estudiar".',
  },
  {
    id: 'bloques',
    name: 'Bloques de tiempo',
    author: 'Cal Newport',
    topic: 'tiempo',
    setup: 10,
    what: 'Cada hora del dia tiene un dueño asignado por escrito. No se decide sobre la marcha, porque decidir sobre la marcha siempre gana la opcion mas comoda.',
    how: 'El **planificador** de Universidad ya lo hace por ti: coge tus huecos reales entre clases y les asigna asignatura. Tu solo tienes que sentarte.',
  },
  {
    id: 'pomodoro',
    name: 'Pomodoro',
    author: 'Francesco Cirillo',
    topic: 'foco',
    setup: 1,
    what: 'Bloques cerrados de trabajo con descanso corto entre medias. El limite de tiempo es lo que hace tolerable empezar cuando no apetece.',
    how: 'El **cronometro** de la pestaña Plan. Al terminar, los minutos se suman solos a tu habito de estudio y a la asignatura.',
  },
  {
    id: 'deep-work',
    name: 'Trabajo profundo',
    author: 'Cal Newport',
    topic: 'foco',
    setup: 5,
    what: 'Sesiones largas sin interrupciones sobre una sola cosa dificil. La capacidad de concentrarse asi es cada vez mas rara y por eso vale cada vez mas.',
    how: 'Sube el tamaño de bloque a 90 minutos en Ajustes y deja el movil en otra habitacion. Un bloque profundo al dia rinde mas que cinco fragmentados.',
  },
  {
    id: 'ivy-lee',
    name: 'Metodo Ivy Lee',
    author: 'Ivy Lee, para Charles Schwab (1918)',
    topic: 'tiempo',
    setup: 5,
    what: 'Al terminar el dia, apunta las 6 cosas mas importantes de mañana en orden. Al dia siguiente empiezas por la primera y no pasas a la segunda hasta acabarla.',
    how: 'Usa el **ritual de cierre** para dejar escritas las de mañana. La app te pide 3 en vez de 6: si cumples esas tres, el dia ya esta bien invertido.',
  },
  {
    id: 'eisenhower',
    name: 'Matriz de Eisenhower',
    author: 'Atribuida a Dwight D. Eisenhower',
    topic: 'tiempo',
    setup: 5,
    what: 'Separar urgente de importante. Lo importante y no urgente (estudiar con antelacion, entrenar, dormir) es lo que nunca grita y lo que decide el año.',
    how: 'Tus **innegociables** son la casilla de importante-no-urgente. Por eso bloquean recompensas: es la unica forma de que compitan con lo urgente.',
  },
  {
    id: 'cadena',
    name: 'No romper la cadena',
    author: 'Atribuida a Jerry Seinfeld',
    topic: 'habitos',
    setup: 1,
    what: 'Marcar cada dia cumplido en un calendario. La cadena de marcas se convierte en algo que no quieres romper, y esa reticencia hace mas que la motivacion.',
    how: 'La **rejilla mensual** es literalmente eso. Y las rachas por habito la miden: 🔥 al lado del nombre.',
  },
  {
    id: 'tentaciones',
    name: 'Emparejar tentaciones',
    author: 'Katherine Milkman',
    topic: 'habitos',
    setup: 3,
    what: 'Solo te permites algo que te encanta mientras haces algo que te cuesta: la serie solo en la cinta, el podcast bueno solo yendo al gimnasio.',
    how: 'Define esas cosas como **recompensas** en Presion. La app las mantiene bloqueadas hasta que cierras los innegociables del dia.',
  },
  {
    id: 'recuerdo-activo',
    name: 'Recuerdo activo',
    author: 'Investigacion en psicologia cognitiva',
    topic: 'estudio',
    setup: 5,
    what: 'Cerrar los apuntes e intentar reproducir lo que sabes. Cuesta mas y por eso funciona: releer da sensacion de dominio sin producirlo.',
    how: 'Registra esos bloques con tecnica "repaso" o "ejercicios". Si un tema te sale mal, sube las horas estimadas del examen y el plan te dara mas bloques.',
  },
  {
    id: 'espaciado',
    name: 'Repaso espaciado',
    author: 'Hermann Ebbinghaus',
    topic: 'estudio',
    setup: 5,
    what: 'Repasar en intervalos crecientes en vez de amontonar. Lo mismo estudiado en cuatro dias se retiene mucho mas que en una noche.',
    how: 'El planificador ya evita mas de dos bloques seguidos de la misma asignatura y la reparte por la semana. Meter los examenes con antelacion es lo que le da margen para espaciar.',
  },
  {
    id: 'feynman',
    name: 'Tecnica Feynman',
    author: 'Richard Feynman',
    topic: 'estudio',
    setup: 10,
    what: 'Explicar el tema con palabras sencillas como si se lo contaras a alguien que no sabe nada. Donde te atascas es exactamente lo que no entiendes.',
    how: 'Usa la **nota del habito** de estudio para escribir en dos lineas lo que has aprendido hoy. Si no puedes, no lo has aprendido.',
  },
  {
    id: 'cinco-segundos',
    name: 'La regla de los 5 segundos',
    author: 'Mel Robbins',
    topic: 'habitos',
    setup: 1,
    what: 'Cuando sabes lo que tienes que hacer, cuenta 5-4-3-2-1 y muevete antes de terminar. Corta el margen que tu cabeza usa para negociar.',
    how: 'Para el habito que mas te cuesta arrancar. Escribelo en sus notas: leerlo al abrir la ficha es parte del truco.',
  },
  {
    id: 'rana',
    name: 'Comete la rana',
    author: 'Brian Tracy',
    topic: 'tiempo',
    setup: 2,
    what: 'La tarea mas fea del dia va primero, cuando aun tienes energia y nadie te ha interrumpido. Todo lo demas del dia es cuesta abajo.',
    how: 'Pon la peor de tus 3 del ritual de apertura en primer lugar y hazla antes de comer.',
  },
  {
    id: 'marginales',
    name: 'Ganancias marginales del 1%',
    author: 'Dave Brailsford, British Cycling',
    topic: 'constancia',
    setup: 5,
    what: 'Mejorar un 1% en muchas cosas pequeñas en vez de buscar un cambio heroico. Acumulado, el 1% diario multiplica por 37 en un año.',
    how: 'No añadas habitos nuevos: sube un poco el objetivo de los que ya cumples al 90%. El **Panel** te dice cuales son.',
  },
  {
    id: 'parkinson',
    name: 'Ley de Parkinson',
    author: 'Cyril Northcote Parkinson',
    topic: 'tiempo',
    setup: 1,
    what: 'El trabajo se estira hasta llenar el tiempo disponible. Si te das toda la tarde, tardas toda la tarde.',
    how: 'Dale al cronometro antes de empezar y ponte un limite corto. Un bloque de 50 minutos con final visible rinde mas que "la tarde".',
  },
  {
    id: 'compromiso',
    name: 'Dispositivos de compromiso',
    author: 'Richard Thaler · Dean Karlan',
    topic: 'compromiso',
    setup: 15,
    what: 'Atarse al mastil por adelantado: poner dinero o reputacion de por medio para que el yo de dentro de dos semanas no pueda renegociar.',
    how: 'Es el **contrato** de la pestaña Presion. Prenda concreta, auditor con nombre y email, y bloqueado hasta la fecha de fin.',
  },
  {
    id: 'entorno',
    name: 'Diseñar el entorno',
    author: 'BJ Fogg · James Clear',
    topic: 'habitos',
    setup: 20,
    what: 'Añadir friccion a lo que quieres evitar y quitarsela a lo que quieres hacer. Mover el movil de habitacion gana a cualquier promesa.',
    how: 'Apunta la friccion de cada dia en el **ritual de cierre** ("el movil en la mesa") y arreglala mañana. Esa pregunta convierte cada fallo en un ajuste.',
  },
  {
    id: 'revision',
    name: 'Revision semanal',
    author: 'David Allen (GTD)',
    topic: 'compromiso',
    setup: 15,
    what: 'Una cita fija a la semana para mirar lo que ha pasado y decidir lo siguiente. Sin ella, cualquier sistema se degrada en dos semanas.',
    how: 'Presion → **Auditoria**, todos los domingos. Mira tu peor habito, decide UNA cosa para la semana y manda el informe a tu auditor.',
  },
];

export const TOPIC_LABEL: Record<string, string> = {
  habitos: 'Habitos',
  foco: 'Foco',
  tiempo: 'Tiempo',
  estudio: 'Estudio',
  compromiso: 'Compromiso',
  constancia: 'Constancia',
};
