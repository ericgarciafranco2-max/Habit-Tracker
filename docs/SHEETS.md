# El tracker entero dentro de Google Sheets

Esta es la version que vive en una hoja de calculo y nada mas. Sin instalar,
sin desplegar, sin servidor. Se abre donde se abre Sheets: PC, movil, tablet, y
se sincroniza sola porque es un fichero de Drive.

Es hermana de la aplicacion, no un recorte: mismos habitos, misma regla
anti-cero, misma deuda por fallo, mismas sanciones, mismas tecnicas y las
mismas frases.

---

## Montarla — 3 minutos

1. Crea una hoja nueva en [sheets.new](https://sheets.new).
2. Menu **Extensiones → Apps Script**.
3. Borra lo que haya y pega el contenido de
   [`google-sheets/Tracker.gs`](../google-sheets/Tracker.gs). Guarda.
4. Vuelve a la hoja y **recargala**. Aparece el menu **⚡ Habit Tracker**.
5. **⚡ Habit Tracker → Crear / rehacer el tracker**.
   - Google pedira permisos: *Revisar permisos* → tu cuenta → *Configuracion
     avanzada* → *Ir a (proyecto)* → *Permitir*. El aviso de "aplicacion no
     verificada" sale porque el script es tuyo y no esta en ninguna tienda.
   - **Si te dice "Va por buen camino", no tienes que hacer nada.** La
     construccion completa no cabe en los seis minutos que da Apps Script, asi
     que va por fases: se para a tiempo, apunta por donde iba y deja programada
     una continuacion para dentro de un minuto. Termina sola en dos o tres
     pasadas. Si no quieres esperar, **⚡ Habit Tracker → Continuar la
     construccion**.
   - El mes en curso se construye el primero, asi que puedes empezar a marcar
     sin esperar a que esten los doce.
6. **⚡ Habit Tracker → Activar avisos automaticos**.

Ya esta. En el movil, instala Google Sheets y ancla la hoja a la pantalla de
inicio para abrirla de un toque.

## Como se usa cada dia

**Marcas en la pestaña `Hoy`.** Es una lista corta con los habitos que tocan
hoy: casilla para los de si/no, numero para los de minutos o cantidad. Lo que
marcas ahi se copia solo a la rejilla del mes. Esto importa: la rejilla de 31
columnas esta para mirarla, no para marcar desde un movil.

**El resto se rellena solo.** Rachas, porcentajes, veredicto del dia, deuda,
recompensas bloqueadas o desbloqueadas y los graficos del panel.

| Pestaña | Para que |
| --- | --- |
| `Hoy` | Marcar el dia, las 3 cosas del dia y el cierre de la noche |
| `Panel` | Indicadores del mes, progreso diario, cumplimiento por mes y por habito |
| `Ene`…`Dic` | La rejilla clasica: habitos en filas, dias en columnas |
| `Universidad` | Asignaturas, examenes con cuenta atras, entregas y horas de estudio |
| `Presion` | Contrato, penitencias, recompensas y la deuda pendiente |
| `Metodos` | 20 tecnicas, cada una con como se aplica en esta hoja |
| `Frases` | 26 frases con autor y fuente |
| `Ajustes` | Tus habitos y tu configuracion. **Es el unico sitio donde tocar** |

## Lo que aqui sale mejor que en la aplicacion

**Los avisos llegan de verdad.** Un navegador no despierta a una web cerrada
para lanzarte una notificacion; los disparadores de Apps Script se ejecutan en
los servidores de Google, tengas el movil como lo tengas:

- **07:00** — correo con los habitos del dia, tu deuda pendiente, la penitencia
  si la tienes y la frase del dia.
- **04:00** — se liquida el dia anterior. Lo que no marcaste cuenta como fallo,
  genera la deuda que pusiste en Ajustes y, al tercer fallo del mismo habito en
  7 dias, te asigna una penitencia de las que escribiste.
- **Domingo 20:00** — el informe de la semana, a ti y a tu auditor si pusiste su
  email. Eso es el contrato funcionando solo, sin que tengas que acordarte.

## Lo que aqui se pierde

Con la misma honestidad:

- **Nada puede bloquearte de verdad.** Las recompensas dicen BLOQUEADAS, pero
  es una celda, no un candado. En la app tampoco era un candado, pero si una
  pantalla que te lo ponia delante antes de dejarte seguir.
- **No hay cronometro** de estudio ni planificador que reparta los bloques por
  tus huecos entre clases. Aqui apuntas las horas a mano.
- **No hay rituales que te frenen.** Puedes cerrar el dia sin escribir nada.
- **El modo estricto no existe.** Puedes reescribir cualquier dia pasado sin que
  quede rastro. La app lo impedia y marcaba las ediciones tardias en el informe.

Si esas cuatro cosas te dan igual, esta version es mejor para ti que la
aplicacion, porque la vas a abrir todos los dias sin friccion.

## Detalles de como esta hecho

**Fórmulas para lo trivial, codigo para lo que depende del calendario.** Contar,
sumar y los minigraficos son formulas. Los dias exigibles de cada habito, las
rachas, el XP y el veredicto los calcula el script y los escribe como valores.
Encadenar eso en formulas es exactamente donde estas plantillas se rompen en
cuanto mueves una fila.

**Los porcentajes se recalculan** al abrir la hoja, con el menu *Recalcular
todo* y en la liquidacion de cada madrugada.

**Nada de formulas volatiles en el formato condicional.** Los colores de la
rejilla comparan cada casilla con el objetivo y el minimo de su fila, que
viajan a unas columnas ocultas de cada mes. La primera version los leia con
INDIRECT desde Ajustes: correcto, pero INDIRECT es volatil, y con doce
rejillas eran mas de cien mil celdas reevaluandose sin parar. La hoja se
arrastraba y la construccion agotaba los seis minutos de Apps Script.

**La construccion se reanuda sola.** Montar veinte pestañas con sus formatos
no cabe en los seis minutos de Apps Script. Va por veinticuatro fases pequeñas
y apunta cada una en cuanto termina; al quedarse sin tiempo se para y programa
un disparador que la continua un minuto despues. El corte se comprueba entre
fases, asi que el margen (tres minutos) tiene que ser mayor que la fase mas
lenta: con un margen justo, una fase larga que arranca al filo se lleva por
delante el limite.

**Y limpia los formatos volatiles antes de nada.** Las reglas viejas que
quedaran de una version anterior siguen en la hoja aunque el codigo nuevo ya
no las use, y bastan para envenenar la ejecucion entera: cada escritura del
script se queda esperando a que la hoja recalcule.

**La liquidacion es idempotente.** Deja una marca en la pestaña oculta
`_datos`, asi que abrir la hoja tres veces no te cobra tres veces la misma
deuda.

**Probado sin Google.** Apps Script solo corre dentro de Google, asi que el
repositorio trae un simulador de la API de Sheets y una bateria de pruebas que
ejecuta el fichero real contra el: construir las 20 pestañas, leer los habitos,
la regla anti-cero, marcar desde `Hoy` y que aterrice en la rejilla del mes,
guardar el cierre, generar la deuda, no cobrarla dos veces y mandar los correos.

```bash
npm run test:sheets
```

De ahi salieron dos fallos que leyendo el codigo no se veian: marcar el animo
caia en la rama que sincroniza habitos y no se guardaba nunca, y la tabla de
dias crecia usando la ultima fila de toda la hoja en vez de la de su bloque.

## Si algo falla

| Sintoma | Que hacer |
| --- | --- |
| No aparece el menu ⚡ | Recarga la hoja. El menu se crea al abrirla, no al pegar el codigo |
| "Se necesita autorizacion" | Ejecuta cualquier opcion del menu y acepta los permisos |
| Los porcentajes no cambian | Menu → *Recalcular todo* |
| No llegan los correos | Menu → *Activar avisos automaticos*, y revisa el email en Ajustes |
| Añado un habito y no sale en Hoy | Menu → *Preparar el dia de hoy* |
| Se quedo a medias | Menu → *Continuar la construccion* (o espera un minuto) |
| Quiero empezar de cero | Menu → *Crear / rehacer el tracker* |

Antes de nada, prueba **⚡ Habit Tracker → Comprobar que todo esta bien**: te
dice si faltan pestañas, si tienes demasiados innegociables, si algun minimo no
sirve de nada y si los avisos estan activos.

## Las dos versiones a la vez

Puedes tenerlas: la hoja para el dia a dia y la aplicacion cuando quieras el
planificador o el cronometro. No comparten datos automaticamente — son dos
sistemas distintos. Elegir uno y usarlo bien vale mas que tener los dos a
medias.
