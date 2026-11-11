# Inspección de Interval Timer

## Identidad y alcance

App observada en el Redmi conectado: `com.interval.timer.workout.tabata.hiit.free`, versión 1.6.2, código 20106020, instalada mediante Google Play. Evidencia REA: `ev_7f542e5178c89fffd56a4d18fdee8431bc5f0b8d0bc3322dff5b6176cbf1acec` (registro completo en `evidencia_paquete.json`).

Se revisan entrenamientos destacados, contenido multimedia, creación de rutinas y opciones adicionales. Las capturas y XML de cada pantalla documentan observaciones de ejecución. Las cadenas DEX son indicios estáticos, no una decompilación ni demostración de ejecución.

## Entrenamientos destacados

El carrusel inspeccionado contiene cuatro entrenamientos. Las listas siguientes conservan el orden y las repeticiones observadas; los nombres se mantienen como aparecen en la app.

| Entrenamiento | Nivel | Duración mostrada | Secuencia |
|---|---|---|---|
| Abs | Beginner | 5m 45s | Dead Bug; Reverse Crunches; V Crunch; Crunches; Flutter Kicks; Reverse Crunches with leg raised; Plank Leg Up; Cobras |
| Lower body | Beginner | 8m | Dead Bug; Squats; Glute Kickback Right; Glute Kickback Left; Donkey Kicks Right; Donkey Kicks Left; Squats; Plank Leg Up; Bird Dog; Plank Leg Up; Bird Dog |
| Upper body | Medium | 8m | Bird Dog; Knee Push Ups; Plank Leg Up; Superman; Mountain Climber; Tricep Dips; Mountain Climber; Tricep Dips; Cobras |
| HIIT | Medium | 8m 20s | Mountain Climber; Knee Push Ups; Reverse Crunches; Mountain Climber; Knee Push Ups; Reverse Crunches; Rest - 30 sec; High Stepping; Squats; Plank Leg Up; High Stepping; Squats; Plank Leg Up; High Stepping; Squats; Plank Leg Up; Cobras |

Fuentes: `abs_lista_1/`, `abs_lista_2/`, `lower_lista_1/`, `lower_lista_2/`, `upper_lista_1/`, `upper_lista_2/`, `hiit_lista_1/`, `hiit_lista_2/`; cabeceras y descripciones en `abs_detalle/`, `lower_body/`, `upper_body/` y `hiit/`. Las descripciones incluyen afirmaciones de salud redactadas por la app; este informe no las valida.

## Multimedia

Se abrieron las 19 fichas de ejercicios distintos identificadas en las cuatro rutinas, sin pendientes en ese conjunto. Sus capturas y XML están en `videos/`; índice en `videos_revisados.json`. Las fichas no equivalen necesariamente a 19 videos distintos: ejercicios con lados distintos pueden compartir contenido. En las capturas examinadas de Dead Bug, Donkey Kicks Right y Cobras se observa un reproductor integrado de YouTube y autor «Simple Innovation». Abrir las fichas y ver las miniaturas no demuestra que la reproducción completa funcione ni que los videos estén disponibles sin conexión.

El inventario directo de los cuatro APK contiene 19 archivos Lottie en `assets/dark/`, 19 en `assets/light/` y 18 sonidos en `assets/sounds/`. Cada tema incluye 18 animaciones de ejercicios y una de descanso. Hay variantes izquierda/derecha para donkey kicks, mientras que el nombre de glute kickback no distingue lado. También existe `res/raw/ayp_youtube_player.html`.

Los archivos listados por estas rutas no incluyen videos MP4/WebM; esto no excluye multimedia empaquetada bajo otros nombres ni contenido remoto. Inventario: `recursos.json`. Las animaciones empaquetadas y el reproductor son observaciones; la selección exacta de cada animación durante el temporizador necesita corroboración en ejecución.

## Creación de rutinas

1. Workouts → Create workout abre una lista inicialmente vacía.
2. Add exercise abre un editor con series, nombre libre, duración de trabajo y descanso.
3. Valores inicialmente observados: una serie, 30 segundos de trabajo y 10 segundos de descanso.
4. Tocar la duración abre un selector de minutos y segundos, con confirmación OK.
5. Save agrega el ejercicio al borrador. La lista muestra el nombre, trabajo y descanso, y permite añadir el siguiente ejercicio.
6. Save workout abre un diálogo con nombre inicial «My workout», CANCEL y SAVE.
7. Salir de un borrador con cambios muestra «Discard changes?», con CANCEL y DISCARD.

Se utilizó un ejercicio temporal «REVISION REA» para llegar al diálogo de guardado; se canceló la confirmación final y se descartó el borrador. No se confirmó una rutina persistente. La pantalla final de My workouts no muestra el borrador. Capturas: `crear_rutina/`, `agregar_ejercicio/`, `selector_tiempo/`, `rutina_borrador_con_ejercicio/`, `guardar_rutina_dialogo/`, `regreso_workouts/` y `workouts_final/`.

«Workout constructor» aparece como descripción no pulsable bajo Create workout. No se observó un segundo constructor independiente. El anuncio de PRO menciona rutinas de varios ejercicios, colores personalizados, sonidos y eliminación de anuncios; ver el editor no demuestra que guardar varios ejercicios sea gratuito.

## Opciones adicionales

- Timer: series, trabajo, descanso, omitir último descanso y duración total; en la configuración observada, 8 × 20 s de trabajo y 7 × 10 s de descanso dan 3m 50s.
- Settings: sonido y guía de voz, vibración, mantener pantalla encendida, tema, colores marcados PRO, preparación y tiempo de preparación (3 s observado), valoración, compartir y comentarios.
- Se observaron avisos de ejecución en segundo plano, anuncios en la interfaz y una promoción intermedia al navegar.
- History muestra un calendario mensual con días de la semana; no se completó una sesión para verificar su persistencia (`historial/`).

Fuentes: `pantalla_principal/`, `ajustes/`, `ajustes_2/` y los XML guardados. Evidencia REA de la pantalla principal: `ev_8ef30df48137bd4e1faa6308d1cf191631ed69d36d7b6140f4af0f91e3d51bbb`.

## Ejecución guiada

Se inició brevemente HIIT: primero aparece GET READY y después MOUNTAIN CLIMBER. La pantalla muestra ilustración del ejercicio, tiempo total restante y cuenta del intervalo. Al pausar cambia Pause por Resume y se conservan los tiempos. También se observan controles de anterior/siguiente, cierre y un icono de comentarios; no se accionaron todos esos controles.

Al volver atrás aparece «Quit workout?» y «Workout will be closed without saving to History», con CANCEL y QUIT. Se eligió QUIT para cerrar la prueba sin guardar una sesión. La app quedó abierta en Workouts. Capturas: `hiit_ejecucion/`, `hiit_pausa/`, `salir_sesion/`, `historial/`, `workouts_final/`. No se verificó un ciclo completo hasta su final automático.

## Evidencia estática y límites

Se copiaron el APK base y tres splits; rutas, tamaños y hashes están en `apks/artefactos.json`. SHA-256 base: `ddb7a959be0760c16f14a806a22758d5a54383c7b2bd7d9e24b567fc798c9ade`.

REA inventarió el APK como archivo ZIP/APK. Evidencia de inspección retenida: `ev_6ed8c0549f272b99b4004cdd4c22d68301912a57d7cbecaa9e130efba35d4d9f`; vista resumen: `ev_c7e4f45336d7b957e8016288ba2dcfa6b488b7036693e63470b7ff1363221b23`. El inventario de entradas no establece semántica del código ni comportamiento en ejecución.

`candidatos_codigo.json` registra cadenas DEX con índice y archivo de origen: clases de ejercicios y entrenamientos destacados, editor de ejercicios, presets compartidos y referencias SQL a `workouts`. Son puntos de entrada para un análisis posterior. No hay Java/JADX configurado para decompilar métodos; no se afirma haber reconstruido el algoritmo interno. La evidencia exportada de REA está en `evidencia_rea.json`; `indice_archivos.json` registra los hashes de las capturas, XML y registros locales.

## Cobertura pendiente

- Verificar reproducción, enlaces exactos y disponibilidad de todos los videos.
- Completar una sesión y verificar su registro y edición en el historial; comprobar las transiciones de todos los intervalos y el fin automático.
- Verificar persistencia, límites numéricos, reordenamiento, edición, importación/exportación y restricciones PRO.

La revisión queda abierta mientras existan estos puntos; no se presenta como una auditoría completa de toda la app.
