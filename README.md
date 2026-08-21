# Habit Tracker — Disciplina

Un tracker de habitos para **PC y movil que se sincronizan**, pensado para
compaginarlo con la universidad. No es una cuadricula bonita: es un sistema con
consecuencias, porque marcar casillas no ha hecho cumplir nada a nadie.

Lo que lo diferencia de una plantilla de Excel o de otra app de rachas:

- **Contrato de compromiso** con prenda real y una persona que te audita.
- **Deuda**: cada fallo acumula minutos, repeticiones o euros que hay que pagar.
- **Penitencias** que escribes tu, hoy, y que la app te asigna sola al tercer fallo.
- **Recompensas bloqueadas** hasta cerrar los innegociables del dia.
- **Rituales de apertura y cierre** del dia, obligatorios.
- **Modo estricto**: no se reescribe el pasado ni se abandona un habito en caliente.
- **Planificador universitario** que reparte el estudio por tus huecos reales.
- **Metodos**: 20 tecnicas de disciplina, foco y estudio, cada una con como se
  aplica dentro de la app, y frases de gente que construyo algo.

La explicacion completa del metodo esta en [`docs/GUIA.md`](docs/GUIA.md).

## Arrancar

Necesitas Node 20 o superior.

```bash
npm install
npm run build      # compila el core y la PWA
npm start          # servidor + web en http://localhost:4321
```

Para desarrollar con recarga en caliente:

```bash
npm run dev        # web en :5173, servidor de sincronizacion en :4321
```

Otros comandos:

| Comando | Que hace |
| --- | --- |
| `npm test` | Tests del motor (rachas, deuda, sanciones, sincronizacion, planificador) |
| `npm run typecheck` | Comprueba tipos de todo el monorepo |
| `npm run build` | Compila core + PWA a `apps/web/dist` |

## Instalarla como app

Hay dos caminos. El primero es el que querras casi seguro.

### Sin servidores: GitHub Pages + una hoja de Google (recomendado)

La app se publica en GitHub Pages (HTTPS gratis) y una hoja de calculo tuya con
Apps Script hace de punto de sincronizacion. **Nada encendido en ningun sitio,
coste cero**, y tus datos aterrizan ademas en una hoja que puedes abrir,
filtrar y graficar.

Es la unica forma de que el movil la instale **de verdad** (offline, pantalla
completa, icono propio): los navegadores solo lo permiten por HTTPS o desde
`localhost`, nunca desde una IP de tu red local.

Los pasos, con capturas de que pulsar, estan en
[`docs/GOOGLE.md`](docs/GOOGLE.md). Resumen: activas Pages en *Settings →
Pages → Source: GitHub Actions*, pegas [`google/Codigo.gs`](google/Codigo.gs)
en *Extensiones → Apps Script* de una hoja nueva, ejecutas `configurar`,
publicas como aplicacion web y pegas la URL y la clave en **Ajustes →
Sincronizacion**.

Instalarla, una vez publicada:

- **Android (Chrome):** menu ⋮ → *Instalar aplicacion*.
- **iPhone (Safari):** compartir → *Añadir a pantalla de inicio*.
- **PC (Chrome/Edge):** icono de instalar en la barra de direcciones.

### Con tu propio servidor, en tu red

Si prefieres que nada pase por Google, arranca el servidor de este repositorio
(`npm start`) y usa la direccion de red que imprime. Funciona, pero el PC tiene
que estar encendido y el movil no podra instalarla como aplicacion, solo abrirla
en el navegador.

Y si quieres un ejecutable de escritorio de verdad, hay un envoltorio de
Electron opcional:

```bash
cd apps/desktop && npm install && npm start
npm run dist       # genera instalador en apps/desktop/release
```

## Sincronizacion

En **Ajustes → Sincronizacion** eliges el punto de encuentro: tu hoja de Google
o tu propio servidor. Conectas los dos dispositivos al mismo y ya esta. En
cualquiera de los dos casos:

- Todo se guarda primero en el dispositivo (IndexedDB), asi que la app funciona
  entera sin conexion.
- Los cambios suben solos unos segundos despues, y tambien al volver a la app o
  al recuperar la red.
- La mezcla es registro a registro: gana la version mas reciente de cada uno. Si
  marcas el gimnasio en el movil y lees 20 paginas en el PC, se quedan las dos
  cosas; no hay "el ultimo que sincroniza pisa al otro".
- Las claves de los registros diarios son deterministas (`habito:fecha`), asi
  que marcar lo mismo en dos sitios no crea duplicados.

Esa mezcla existe en tres sitios (cliente, servidor de Node y Apps Script) pero
se escribe dos veces, porque el `.gs` no puede importar el paquete. Para que no
se separen en silencio hay una prueba que carga el fichero `.gs` real y compara
las dos implementaciones caso por caso.

Con servidor propio los datos viven en `apps/server/data/` como ficheros JSON;
con Google, en un fichero de tu Drive y en las pestañas de la hoja. En ambos
casos son tuyos y puedes llevartelos con **Ajustes → Datos → Exportar**.

Si no quieres sincronizar nada, la app funciona igual en un solo dispositivo.

## Como esta montado

```
packages/core        Motor sin interfaz: tipos, rachas, XP, deuda, sanciones,
                     planificador y mezcla de sincronizacion. Con tests.
apps/web             PWA en React + TypeScript (la misma para PC y movil).
apps/server          Servidor de sincronizacion (Express + ficheros JSON).
apps/desktop         Envoltorio de Electron opcional.
google/              Apps Script: sincronizacion sobre una hoja de calculo.
docs/GUIA.md         El metodo: como usarlo para cumplir de verdad.
docs/GOOGLE.md       Montar Pages + la hoja de Google, paso a paso.
```

Toda la logica que decide si un dia esta cumplido, cuanta deuda generas o que se
estudia manana vive en `packages/core`, sin React ni DOM. Por eso se puede
probar con tests rapidos y por eso el servidor puede reutilizar exactamente la
misma funcion de mezcla que el cliente.

### Diseño y graficas

La interfaz es deliberadamente sobria: superficies blancas sobre gris, una sola
tinta de acento, separadores finos en vez de cajas, tipografia del sistema y
radios generosos. Modo claro y oscuro, los dos elegidos, no uno invertido.

Las graficas siguen tres reglas que evitan casi todos los errores tipicos:

- **La forma la elige el trabajo del dato.** Una razon contra su limite es un
  medidor (los anillos de Hoy, en pequeños multiples y nunca concentricos);
  comparar magnitud en el tiempo son columnas; el reparto de un total es una
  barra apilada; una rejilla de magnitud es un mapa de calor.
- **Nunca dos escalas en un mismo eje.** Animo y horas de sueño van en dos
  graficas separadas a proposito.
- **Los porcentajes se dibujan sobre 0–100, no sobre el maximo de la muestra**,
  para que un mes al 1% no parezca un mes lleno.

La paleta categorica son ocho tonos en orden fijo, validados en los dos modos
contra las comprobaciones de banda de luminosidad, croma, separacion para
daltonismo y contraste minimo sobre la superficie. Estan en
`apps/web/src/lib/palette.ts`, con su version clara y su version oscura.

### Decisiones que quiza no son obvias

- **Un solo documento por usuario en vez de una base de datos.** Un año de uso
  intenso son unos pocos cientos de kilobytes. Con ese tamaño, leer y escribir
  el documento entero es mas simple, mas rapido de sincronizar y trivial de
  respaldar.
- **Ultimo que escribe gana, por registro.** Es un usuario con dos o tres
  dispositivos, no un equipo editando a la vez. Un CRDT completo seria complejidad
  sin beneficio; los empates se rompen de forma determinista para que ambos
  dispositivos converjan al mismo resultado.
- **Graficas dibujadas a mano en SVG.** Ninguna libreria de graficas pesa menos
  que las cuarenta lineas que hacen falta, y asi todo comparte el mismo diseño.
- **El "dia logico" empieza a las 04:00.** Si marcas algo a las 02:00, cuenta
  como el dia anterior. Trasnochar no regala un dia nuevo.

## Aviso sobre los recordatorios

Un navegador no despierta a una web cerrada para lanzarte una notificacion sin
un servidor de push. Lo que hace la app es avisarte mientras esta abierta o
instalada en segundo plano, y avisarte una hora antes del cierre si te quedan
innegociables. Para lo demas, una alarma del movil a la hora de tu ritual sigue
siendo lo mas fiable que existe.
