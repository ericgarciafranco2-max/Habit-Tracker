/**
 * Frases de gente que construyo algo.
 *
 * Cada una lleva autor y, cuando existe, la fuente. Las que circulan sin
 * origen documentado van marcadas como atribuidas: es mejor decirlo que
 * inventarse una cita bonita y falsa.
 */
export interface Quote {
  text: string;
  author: string;
  role: string;
  source?: string;
  /** true cuando la atribucion es popular pero no esta documentada. */
  attributed?: boolean;
  topic: 'disciplina' | 'ejecucion' | 'fracaso' | 'tiempo' | 'foco' | 'constancia';
}

export const QUOTES: Quote[] = [
  {
    text: 'La disciplina es el puente entre las metas y los logros.',
    author: 'Jim Rohn',
    role: 'Emprendedor y conferenciante',
    topic: 'disciplina',
  },
  {
    text: 'No te elevas a la altura de tus objetivos: caes a la altura de tus sistemas.',
    author: 'James Clear',
    role: 'Autor',
    source: 'Habitos atomicos',
    topic: 'constancia',
  },
  {
    text: 'La unica forma de hacer un gran trabajo es amar lo que haces.',
    author: 'Steve Jobs',
    role: 'Cofundador de Apple',
    source: 'Discurso en Stanford, 2005',
    topic: 'ejecucion',
  },
  {
    text: 'Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un habito.',
    author: 'Will Durant',
    role: 'Historiador, resumiendo a Aristoteles',
    source: 'La historia de la filosofia',
    topic: 'constancia',
  },
  {
    text: 'No he fracasado. Simplemente he encontrado diez mil formas que no funcionan.',
    author: 'Thomas Edison',
    role: 'Inventor y empresario',
    attributed: true,
    topic: 'fracaso',
  },
  {
    text: 'Tanto si crees que puedes como si crees que no puedes, tienes razon.',
    author: 'Henry Ford',
    role: 'Fundador de Ford',
    attributed: true,
    topic: 'disciplina',
  },
  {
    text: 'Si no te averguenza la primera version de tu producto, has lanzado demasiado tarde.',
    author: 'Reid Hoffman',
    role: 'Cofundador de LinkedIn',
    topic: 'ejecucion',
  },
  {
    text: 'La determinacion es la cualidad mas importante en un fundador.',
    author: 'Paul Graham',
    role: 'Cofundador de Y Combinator',
    topic: 'constancia',
  },
  {
    text: 'Cuando algo es lo bastante importante, lo haces aunque las probabilidades no esten a tu favor.',
    author: 'Elon Musk',
    role: 'Fundador de SpaceX y Tesla',
    topic: 'ejecucion',
  },
  {
    text: 'Si duplicas el numero de experimentos que haces al año, duplicas tu inventiva.',
    author: 'Jeff Bezos',
    role: 'Fundador de Amazon',
    topic: 'fracaso',
  },
  {
    text: 'La diferencia entre la gente de exito y la gente de mucho exito es que la segunda dice que no a casi todo.',
    author: 'Warren Buffett',
    role: 'Inversor',
    topic: 'foco',
  },
  {
    text: 'Lo que se mide, se gestiona.',
    author: 'Peter Drucker',
    role: 'Padre de la gestion moderna',
    topic: 'disciplina',
  },
  {
    text: 'El trabajo profundo es la superpotencia del siglo XXI.',
    author: 'Cal Newport',
    role: 'Profesor de informatica y autor',
    source: 'Deep Work',
    topic: 'foco',
  },
  {
    text: 'El grit es pasion y perseverancia por objetivos a muy largo plazo.',
    author: 'Angela Duckworth',
    role: 'Psicologa',
    source: 'Grit',
    topic: 'constancia',
  },
  {
    text: 'Si quieres ser grande en algo, tienes que obsesionarte.',
    author: 'Kobe Bryant',
    role: 'Jugador de baloncesto',
    topic: 'disciplina',
  },
  {
    text: 'He fallado mas de 9.000 tiros en mi carrera. He perdido casi 300 partidos. Por eso he tenido exito.',
    author: 'Michael Jordan',
    role: 'Jugador de baloncesto',
    source: 'Anuncio de Nike, 1997',
    topic: 'fracaso',
  },
  {
    text: 'No pierdas mas tiempo discutiendo como debe ser un hombre bueno. Se uno.',
    author: 'Marco Aurelio',
    role: 'Emperador romano',
    source: 'Meditaciones',
    topic: 'ejecucion',
  },
  {
    text: 'No es que tengamos poco tiempo: es que perdemos mucho.',
    author: 'Seneca',
    role: 'Filosofo',
    source: 'Sobre la brevedad de la vida',
    topic: 'tiempo',
  },
  {
    text: 'No importa lo despacio que vayas mientras no te detengas.',
    author: 'Confucio',
    role: 'Filosofo',
    attributed: true,
    topic: 'constancia',
  },
  {
    text: 'En mi casa, en la cena, se preguntaba: ¿en que has fracasado esta semana?',
    author: 'Sara Blakely',
    role: 'Fundadora de Spanx',
    topic: 'fracaso',
  },
  {
    text: 'Empieza donde estas. Usa lo que tienes. Haz lo que puedas.',
    author: 'Arthur Ashe',
    role: 'Tenista',
    attributed: true,
    topic: 'ejecucion',
  },
  {
    text: 'Los planes no valen nada; planificar lo es todo.',
    author: 'Dwight D. Eisenhower',
    role: 'General y presidente',
    topic: 'tiempo',
  },
  {
    text: 'Lee lo que te guste hasta que te guste leer.',
    author: 'Naval Ravikant',
    role: 'Inversor y fundador de AngelList',
    topic: 'constancia',
  },
  {
    text: 'Las ideas son faciles. La ejecucion lo es todo.',
    author: 'John Doerr',
    role: 'Inversor',
    topic: 'ejecucion',
  },
  {
    text: 'El exito es la suma de pequeños esfuerzos repetidos dia tras dia.',
    author: 'Robert Collier',
    role: 'Escritor',
    attributed: true,
    topic: 'constancia',
  },
  {
    text: 'Un objetivo sin un plan es solo un deseo.',
    author: 'Antoine de Saint-Exupery',
    role: 'Escritor y aviador',
    attributed: true,
    topic: 'tiempo',
  },
];

/** La frase del dia: la misma para todo el dia, distinta cada dia. */
export function quoteOfDay(date: string): Quote {
  let hash = 0;
  for (let i = 0; i < date.length; i++) hash = (hash * 31 + date.charCodeAt(i)) >>> 0;
  return QUOTES[hash % QUOTES.length]!;
}
