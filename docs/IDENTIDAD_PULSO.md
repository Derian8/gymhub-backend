# Identidad visual PULSO

La aplicación conserva sus funciones, roles y navegación con la marca PULSO:
«El ritmo de tu gimnasio en un solo lugar».

Los originales en `docs/nueva_identidad_visual` se publican en
`frontend/public/marca`. No se redibujan ni deforman: el componente compartido
encuadra el logo horizontal con CSS y utiliza una superficie blanca para mantener
su contraste en ambos temas. El icono circular identifica la navegación compacta
y la pestaña del navegador. El banner original acompaña el acceso.

El rojo de acción es `#D90018`, con `#B50016` al señalar un botón. El texto de
acento en modo oscuro utiliza `#FF5666` para mejorar la legibilidad. Los colores
de éxito, advertencia e información mantienen su significado. La tipografía
continúa siendo Barlow Condensed para títulos y Manrope para el cuerpo.

La preferencia de tema existente se conserva, incluido el modo oscuro inicial.
Los detalles deportivos se concentran en el acceso y los encabezados de inicio;
las pantallas operativas comparten tarjetas, formularios, tablas y navegación.
Las animaciones respetan la preferencia de movimiento reducido.

Los dominios, correos, cookies, claves de almacenamiento, nombres internos y
contratos de API mantienen su identidad técnica anterior por compatibilidad.
Los nombres y logos personalizados de gimnasios permanecen vigentes. La marca
PULSO sustituye solamente los textos de producto y valores de presentación por
defecto en interfaz, asistente, reportes, comprobantes y mensajes.

## Verificación

- Compilación y suite frontend con `npm run build` y `npm test`.
- Pruebas de asistente, alertas, facturación y tareas del backend.
- Capturas de acceso y los tres roles en ambos temas, a 390, 768 y 1440 píxeles.
- Recorrido de módulos sin crear pagos, entradas o sesiones en producción.

Las pruebas backend utilizan `--nomigrations` porque la historia local de
migraciones no incluye `configuracion_sistema`, aunque la tabla existe en la
base publicada. Este cambio visual no modifica modelos ni aplica migraciones.

La primera ejecución completa del frontend dio 111 pruebas aprobadas y 11
fallidas. Las mismas 11 fallas se reprodujeron sobre `HEAD` sin esta adaptación,
en las pruebas de `TodayWorkoutPage`, `MemberDashboard` y `NewMemberPage`.
Las 59 pruebas backend seleccionadas pasaron. La revisión visual conserva las
respuestas reales por perfil en memoria para no activar los límites de consultas
al repetir capturas; no crea registros operativos.

La revisión inicial completó 40 capturas sin imágenes rotas ni desbordamientos
horizontales. Incluye el acceso, los tres paneles y los módulos de gestión. El
estado previo a «Ver rutina» mantiene el control de entrada existente: la API
no entrega la prescripción al cliente antes de registrar su entrada. No se
registraron entradas reales para tomar las capturas.

Se unificó el punto de cambio de navegación en 1024 px: en tabletas sigue visible
la navegación inferior y, a partir de escritorio, aparece la barra lateral.

La publicación del frontend y backend se completó el 16 de septiembre de 2026.
La dirección pública respondió HTTP 200 con el título, favicon y recursos PULSO.
La comprobación final de producción agregó 10 capturas: acceso a 390 y 1440 px
y paneles de los tres roles a 768 px, en ambos temas, sin imágenes rotas,
errores JavaScript ni desbordamientos horizontales. Se inspeccionó visualmente
la navegación inferior y el encabezado de administración en tableta.
Las cuatro pruebas de acceso pasaron tras actualizar la expectativa del texto
que indica que la administración crea las cuentas de miembros.
