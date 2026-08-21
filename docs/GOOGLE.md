# Sincronizar con una hoja de Google

Esta es la forma mas comoda de tener la app **instalada de verdad en el movil y
en el PC, sincronizada, sin ningun servidor encendido y sin pagar nada**.

El reparto es:

- **GitHub Pages** sirve la app por HTTPS. Los navegadores solo instalan una web
  como aplicacion (offline, pantalla completa, icono propio) si viene por HTTPS
  o desde `localhost`; por eso una direccion de tu red local no sirve.
- **Una hoja de calculo tuya con Apps Script** hace de punto de sincronizacion.
  Guarda el documento completo en un fichero de tu Drive y vuelca los datos a
  pestañas legibles para que puedas mirarlos y graficarlos.

Tiempo total: unos 15 minutos, una sola vez.

---

## Parte 1 — Publicar la app (5 min)

1. En GitHub, entra en tu repositorio → **Settings** → **Pages**.
2. En *Build and deployment*, en **Source**, elige **GitHub Actions**.
3. Ve a la pestaña **Actions** → **Publicar la app** → **Run workflow**.
4. Cuando termine (un par de minutos), tu app esta en:

   `https://ericgarciafranco2-max.github.io/Habit-Tracker/`

A partir de ahi, cada vez que cambie el codigo se vuelve a publicar sola.

## Parte 2 — Montar la hoja (7 min)

1. Crea una hoja de calculo nueva en [sheets.new](https://sheets.new) y ponle
   nombre, por ejemplo *Habit Tracker*.
2. Menu **Extensiones → Apps Script**. Se abre el editor.
3. Borra lo que haya en `Codigo.gs` y pega el contenido de
   [`google/Codigo.gs`](../google/Codigo.gs) de este repositorio.
4. Guarda (el icono del disquete).
5. Arriba, en el desplegable de funciones, elige **`configurar`** y pulsa
   **Ejecutar**.
   - Google te pedira permisos la primera vez: *Revisar permisos* → tu cuenta →
     *Configuracion avanzada* → *Ir a (nombre del proyecto)* → *Permitir*.
     Ese aviso de "aplicacion no verificada" sale porque el script es tuyo y no
     esta publicado en ninguna tienda; es normal.
   - Al terminar te enseña tu **clave de sincronizacion**. Copiala.
     Si la pierdes: menu **Habit Tracker → Ver clave** en la hoja.
6. Boton **Implementar → Nueva implementacion**.
   - Tipo (el engranaje): **Aplicacion web**.
   - *Ejecutar como*: **Yo**.
   - *Quien tiene acceso*: **Cualquier usuario**.
   - **Implementar**, y copia la **URL de la aplicacion web**. Termina en
     `/exec`.

> **Sobre "cualquier usuario":** hace falta para que la app pueda hablar con la
> hoja sin pasar por una pantalla de inicio de sesion de Google. Lo que protege
> tus datos es la clave, que el script comprueba en cada peticion. Por eso: no
> publiques la URL y la clave juntas en ningun sitio.

## Parte 3 — Conectar (3 min)

1. Abre tu app en `https://…github.io/Habit-Tracker/`.
2. **Ajustes → Sincronizacion**, pestaña **Hoja de Google**.
3. Pega la URL (`…/exec`) y la clave. **Conectar con la hoja**.
4. Repite lo mismo en el otro dispositivo. Ya esta.

**Instalarla como app:**

- **Android (Chrome):** menu ⋮ → *Instalar aplicacion* / *Añadir a pantalla de inicio*.
- **iPhone (Safari):** boton compartir → *Añadir a pantalla de inicio*.
- **PC (Chrome/Edge):** icono de instalar en la barra de direcciones.

---

## Que hay dentro de la hoja

Cuatro pestañas de datos y un resumen, que el script regenera **como mucho una
vez por hora** (sincronizas cada pocos segundos mientras usas la app; reescribir
la hoja cada vez seria tirar cuota para nada). Para forzarlo: boton *Actualizar
hoja* en Ajustes, o menu **Habit Tracker → Actualizar pestañas ahora**.

| Pestaña | Que tiene |
| --- | --- |
| `Habitos` | Tus habitos con objetivo, minimo, calendario y peso |
| `Registros` | Cada dia marcado: fecha, habito, valor, estado y nota |
| `Dias` | Animo, energia, horas de sueño y las respuestas del cierre |
| `Estudio` | Sesiones de estudio con asignatura, minutos y foco |
| `Resumen` | Por habito: veces cumplido, veces al minimo, fallos y ultima vez |

Los **porcentajes de cumplimiento no se calculan en la hoja**, a proposito.
Dependen del calendario de cada habito y de las congelaciones, y tener esa
logica en dos sitios acaba dando dos respuestas distintas. La app manda; la hoja
es el espejo en crudo para que hagas tus propias tablas dinamicas.

El documento completo (el que se sincroniza) vive en un fichero de tu Drive
llamado `habit-tracker-datos.json`. **No lo borres**; si lo haces, el script
crea uno vacio y pierdes el historial que no este en otro dispositivo.

## Como se resuelven los conflictos

Cada registro lleva su marca de tiempo y gana el mas reciente. Si marcas el
gimnasio en el movil y lees 20 paginas en el PC, se quedan las dos cosas. Si
tocas *lo mismo* en los dos sitios, gana el ultimo, y los empates se rompen de
forma determinista para que ambos dispositivos acaben igual.

Esa mezcla esta escrita dos veces (en el paquete `core` y en el `.gs`, que no
puede importarlo). Para que no se separen en silencio, hay una prueba
automatica que carga el fichero `.gs` real y compara las dos implementaciones:
`packages/core/test/apps-script.test.ts`.

## Si algo falla

| Sintoma | Causa casi siempre |
| --- | --- |
| "La hoja no ha contestado en JSON" | La implementacion no es *Aplicacion web* o el acceso no es *Cualquier usuario* |
| "Clave incorrecta" | La clave tiene espacios al pegarla, o ejecutaste `configurar` en otro proyecto |
| "Sin configurar" | Falta ejecutar la funcion `configurar` una vez desde el editor |
| Cambias el script y no se entera | Hay que hacer **Implementar → Gestionar implementaciones → editar → Version: nueva** |
| El movil no ofrece instalar | Estas entrando por `http://` o por IP local. Tiene que ser la URL de Pages, con HTTPS |

**Cuotas:** Apps Script permite del orden de 20.000 llamadas al dia por cuenta
gratuita. La app sincroniza como mucho cada pocos segundos mientras la usas, asi
que no te vas a acercar; pero si algun dia ves errores raros a rachas, es el
primer sitio donde mirar.
