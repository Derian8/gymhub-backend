# Auditoría de velocidad de Pulso

Fecha: 11 de noviembre de 2026. Frontend publicado desde `65e9900`.
El frontend conserva las rutas hacia Render. La actualización de código del
backend de Render todavía está pendiente de publicación en GitHub y despliegue.

## Método y alcance

- Tres cargas de `/login` en Chromium, con contextos nuevos sin caché.
- Pantalla móvil de 390 × 844, CPU ralentizada 4 veces, latencia simulada de
  150 ms y descarga de 1,6 Mbit/s. Son mediciones de laboratorio desde este
  entorno, no datos de teléfonos reales ni una puntuación de Lighthouse.
- Cinco solicitudes independientes a cada endpoint público con curl.
- Render estaba activo: estos resultados no incluyen el arranque tras suspensión.
- Inspección del código de caché, carga de rutas, historial y serializadores.
- No se midieron pantallas autenticadas ni interacciones de usuarios reales.
- No hay medición anterior equivalente; no se puede afirmar un porcentaje de mejora.

## Resultados de la carga móvil

| Métrica | Carga 1 | Carga 2 | Carga 3 | Mediana |
|---|---:|---:|---:|---:|
| Primer contenido visible (FCP) | 3,528 s | 3,040 s | 2,972 s | 3,040 s |
| Contenido principal visible (LCP) | 3,904 s | 3,372 s | 3,264 s | 3,372 s |
| Suma de bloqueos mayores de 50 ms observados | 826 ms | 513 ms | 458 ms | 513 ms |
| Cambios de posición visual (CLS) | 0 | 0 | 0 | 0 |
| Datos de red observados | 414.282 B | 414.280 B | 414.283 B | 414.282 B |

Cada carga produjo 15 respuestas HTTP 200 y ningún error JavaScript. La suma
de bloqueos se observa durante la navegación y los cinco segundos posteriores;
no equivale al TBT calculado por Lighthouse ni permite estimar INP.

## Respuesta de servicios públicos

| Recurso | Mediana hasta primer byte | Mediana total |
|---|---:|---:|
| Documento de `www.pulsocr.me` | 441 ms | 443 ms |
| `/health/ready/` mediante el dominio de Pulso | 698 ms | 699 ms |
| `/health/ready/` directamente en Render | 471 ms | 471 ms |

Las 15 solicitudes respondieron HTTP 200. La diferencia observada entre las
medianas de salud fue de unos 227 ms; incluye rutas de red distintas y no debe
interpretarse como un coste fijo del proxy. El health check no representa el
tiempo de los endpoints de rutinas o historial.

## Hallazgos y prioridades

1. **Prioridad alta: todas las páginas se importan al arrancar.** `frontend/src/App.tsx`
   importa estáticamente páginas de administrador, reportes, planes y progreso.
   En el login se descargan 383.314 B de JavaScript de gráficas sin comprimir
   (103.957 B comprimidos), aproximadamente una cuarta parte de todos los bytes
   de red observados. Dividir la carga por rutas con `React.lazy` y `Suspense`
   permitiría solicitar las gráficas cuando se entre en las pantallas que las usan.
   El módulo principal también descarga 119.846 B comprimidos (467.521 B originales).

2. **Prioridad alta: la mejora de caché es en gran parte redundante.** Los hooks
   de miembros añaden `staleTime: 30000` y `refetchOnWindowFocus: false`, pero
   `frontend/src/main.tsx` ya configura ambos valores globalmente, también en la
   revisión anterior `d38fd2c`. Repetirlos no cambia el comportamiento. La caché
   de entrenadores de cinco minutos sí cambia su tiempo de frescura; falta medir
   navegación autenticada e invalidaciones para cuantificar el ahorro real.

3. **Prioridad media: el historial descarga páginas en serie.**
   `progressApi.sessionsForMonth` espera cada página antes de pedir la siguiente;
   el backend pagina en grupos de 20. Un mes con 31 sesiones requiere al menos dos
   solicitudes y espera ambas antes de mostrar el calendario. Cada sesión incluye
   sus registros de ejercicios. Conviene devolver un resumen mensual pequeño y
   cargar el detalle al seleccionar un día o una sesión.

4. **Prioridad media: quedan consultas por ejercicio en las rutinas.**
   `ExerciseSerializer.get_previous_log` ejecuta una consulta `.first()` por
   ejercicio. `TrainingPlanViewSet.get_queryset` solo precarga los días, de modo
   que la serialización de días, ejercicios, catálogo y equipos puede agregar
   consultas. Conviene obtener los registros anteriores en lote y cargar las
   relaciones necesarias. No se cuantificó el número de consultas de una petición
   autenticada en producción.

5. **Mejora útil del nuevo historial, todavía pendiente de Render:** la rama de
   cliente precarga `workout_day__plan` y `exercise_logs__exercise`, reduciendo
   consultas individuales de nombres. Las ramas de instructor y administrador
   no precargan `exercise_logs__exercise`, aunque usan el mismo serializador.
   Conviene aplicar la precarga también en esas ramas.

6. **Prioridad media: costo de los videos al abrir una rutina.** Los iframes de
   YouTube usan `loading="lazy"`, pero no un botón que cree el reproductor al
   pulsarlo. El navegador puede cargar varios reproductores cercanos a la vista.
   Una portada con reproducción bajo demanda reduciría las solicitudes externas.
   No se midió esta pantalla autenticada.

7. **Límite de infraestructura:** el keep-alive depende de que la PC esté
   encendida y no garantiza que Render Free permanezca activo. La auditoría no
   provocó una suspensión del servicio. Debe medirse el primer acceso tras una
   suspensión real antes de atribuir una mejora al arranque del backend.

## Siguiente validación

Medir las mismas tres cargas después de dividir las rutas, y recorrer Inicio,
Ejercicios e Historial con una cuenta de prueba y volúmenes conocidos. Comparar
bytes, tiempos, solicitudes repetidas y consultas SQL. Mantener Render como API
activa y verificar el commit publicado antes de comparar versiones.
