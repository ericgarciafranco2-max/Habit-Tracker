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

**En el PC.** Abre `http://localhost:4321` en Chrome o Edge y pulsa el icono de
instalar de la barra de direcciones. Queda como una aplicacion con su ventana y
su icono. Si prefieres un ejecutable de verdad hay un envoltorio de Electron
opcional:

```bash
cd apps/desktop && npm install && npm start
npm run dist       # genera instalador en apps/desktop/release
```

**En el movil.** Con el movil en la misma red que el PC, abre la direccion de
red que imprime el servidor al arrancar (algo como `http://192.168.1.40:4321`) y
usa *Añadir a pantalla de inicio*. A partir de ahi se abre a pantalla completa,
funciona sin conexion y se sincroniza sola.

## Sincronizacion

En **Ajustes → Sincronizacion**, crea una cuenta contra tu servidor y entra con
ella en los dos dispositivos. A partir de ese momento:

- Todo se guarda primero en el dispositivo (IndexedDB), asi que la app funciona
  entera sin conexion.
- Los cambios se suben solos unos segundos despues, y tambien al volver a la app
  o al recuperar la red.
- La mezcla es registro a registro: gana la version mas reciente de cada uno. Si
  marcas el gimnasio en el movil y lees 20 paginas en el PC, se quedan las dos
  cosas; no hay "el ultimo que sincroniza pisa al otro".
- Las claves de los registros diarios son deterministas (`habito:fecha`), asi
  que marcar lo mismo en dos sitios no crea duplicados.

Los datos viven en `apps/server/data/` como ficheros JSON. Copiar esa carpeta es
tu copia de seguridad. Nada sale de tus maquinas.

Si no quieres servidor, la app funciona igual en un solo dispositivo, y puedes
mover los datos a mano con **Ajustes → Datos → Exportar / Importar JSON**.

## Como esta montado

```
packages/core        Motor sin interfaz: tipos, rachas, XP, deuda, sanciones,
                     planificador y mezcla de sincronizacion. Con tests.
apps/web             PWA en React + TypeScript (la misma para PC y movil).
apps/server          Servidor de sincronizacion (Express + ficheros JSON).
apps/desktop         Envoltorio de Electron opcional.
docs/GUIA.md         El metodo: como usarlo para cumplir de verdad.
```

Toda la logica que decide si un dia esta cumplido, cuanta deuda generas o que se
estudia manana vive en `packages/core`, sin React ni DOM. Por eso se puede
probar con tests rapidos y por eso el servidor puede reutilizar exactamente la
misma funcion de mezcla que el cliente.

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
