# Encuesta de validación de GymHub

Instrumento listo para trasladar a Google Forms. No contiene resultados. La meta
es recopilar 10 respuestas de responsables de gimnasios y 10 de miembros adultos.

## Configuración recomendada

- Título del formulario: `Validación de la plataforma GymHub`.
- No recopilar automáticamente correos electrónicos.
- No solicitar nombres, teléfonos, diagnósticos ni datos físicos.
- Restringir la participación a personas de 18 años o más.
- Activar una sección distinta según el rol seleccionado.
- Consultar previamente al CTR si corresponden ExpoTEC-5 y ExpoTEC-6.
- Mantener abierto el formulario hasta alcanzar las dos cuotas, sin presentar la
  muestra como representativa de todo Pérez Zeledón.

## Texto de presentación y consentimiento

> GymHub es un proyecto estudiantil de ExpoTÉCNICA 2026 orientado a organizar la
> gestión administrativa y el seguimiento deportivo de gimnasios. Esta encuesta
> busca conocer necesidades y opiniones para mejorar el prototipo. La
> participación es voluntaria, anónima y toma aproximadamente cinco minutos. No
> se solicitan datos personales sensibles. Las respuestas se analizarán de forma
> agregada con fines educativos y de validación del proyecto. Puede abandonar el
> formulario en cualquier momento antes de enviarlo.

### Pregunta 1 — Consentimiento

- Tipo: opción única, obligatoria.
- Pregunta: `¿Tiene 18 años o más y acepta participar voluntariamente?`
- Opciones:
  - `Sí, acepto participar.`
  - `No acepto.`
- Lógica: una respuesta negativa finaliza el formulario sin guardar el resto.

### Pregunta 2 — Rol

- Tipo: opción única, obligatoria.
- Pregunta: `¿Desde cuál rol responde?`
- Opciones:
  - `Dueño o administrador de gimnasio.`
  - `Entrenador con responsabilidades administrativas.`
  - `Entrenador personal independiente.`
  - `Miembro o cliente de un gimnasio.`
- Lógica: las primeras tres opciones abren la ruta A; la última abre la ruta B.

### Pregunta 3 — Zona

- Tipo: opción única, obligatoria.
- Pregunta: `¿Dónde se ubica principalmente el gimnasio con el que se relaciona?`
- Opciones:
  - `Pérez Zeledón.`
  - `Otro cantón de San José.`
  - `Otra provincia de Costa Rica.`

## Ruta A — Responsables de gimnasios o entrenadores

### A1 — Tamaño aproximado

- Tipo: opción única.
- Pregunta: `¿Cuántos miembros activos administra aproximadamente?`
- Opciones: `1–25`, `26–75`, `76–150`, `Más de 150`, `No sabe/no aplica`.

### A2 — Métodos utilizados

- Tipo: casillas, múltiples respuestas.
- Pregunta: `¿Qué herramientas utiliza actualmente para administrar el gimnasio o sus clientes?`
- Opciones: `Cuaderno o formularios en papel`, `Excel o Google Sheets`,
  `WhatsApp`, `Software especializado`, `Sistema desarrollado internamente`,
  `Otra`.

### A3 — Dificultades actuales

- Tipo: casillas, máximo tres respuestas.
- Pregunta: `¿Cuáles tareas generan mayor dificultad o tiempo?`
- Opciones: `Registro de miembros`, `Control de membresías`, `Cobro y pagos
  pendientes`, `Asistencia o acceso`, `Asignación de rutinas`, `Seguimiento del
  progreso`, `Reportes`, `Comunicación`, `Ninguna`, `Otra`.

### A4 — Frecuencia de problemas

- Tipo: escala lineal de 1 a 5.
- Pregunta: `¿Con qué frecuencia ocurren errores, atrasos o confusiones por la forma actual de gestionar información?`
- Etiquetas: `1 = Nunca` y `5 = Muy frecuentemente`.

### A5 — Funciones prioritarias

- Tipo: casillas, máximo cuatro respuestas.
- Pregunta: `¿Qué funciones serían más valiosas en una sola plataforma?`
- Opciones: `Miembros`, `Membresías`, `Pagos y mora`, `Asistencia`, `Planes de
  entrenamiento`, `Sesiones y progreso`, `Alertas`, `Reportes`, `Comunicación`,
  `Otra`.

### A6 — Dispositivos

- Tipo: opción única.
- Pregunta: `¿Desde qué dispositivo esperaría administrar principalmente el sistema?`
- Opciones: `Celular`, `Computadora`, `Tableta`, `Combinación de dispositivos`.

### A7 — Interés en piloto

- Tipo: opción única.
- Pregunta: `¿Estaría dispuesto a probar durante cuatro semanas una plataforma con datos de demostración y acompañamiento?`
- Opciones: `Sí`, `Tal vez, según condiciones`, `No`.

### A8 — Precio mensual

- Tipo: opción única.
- Pregunta: `Si la plataforma resolviera las funciones seleccionadas, ¿qué rango mensual consideraría razonable?`
- Opciones: `Menos de CRC 7 500`, `CRC 7 500–14 999`, `CRC 15 000–24 999`,
  `CRC 25 000–39 999`, `CRC 40 000 o más`, `No pagaría`, `Necesito una
  demostración antes de responder`.

### A9 — Soporte esperado

- Tipo: casillas, máximo dos respuestas.
- Pregunta: `¿Qué apoyo sería más importante para adoptar la plataforma?`
- Opciones: `Configuración inicial`, `Capacitación`, `Soporte por WhatsApp`,
  `Correo`, `Tutoriales`, `Respaldo y recuperación`, `Personalización`.

### A10 — Privacidad

- Tipo: opción única.
- Pregunta: `¿Qué tan importante considera controlar quién accede a datos de miembros, pagos y progreso?`
- Opciones: `Muy importante`, `Importante`, `Poco importante`, `No sabe`.

### A11 — Comentario abierto

- Tipo: párrafo, opcional.
- Pregunta: `¿Qué condición tendría que cumplir GymHub para que fuera útil en su trabajo?`

## Ruta B — Miembros adultos de gimnasios

### B1 — Frecuencia de asistencia

- Tipo: opción única.
- Pregunta: `¿Con qué frecuencia asiste normalmente al gimnasio?`
- Opciones: `Menos de una vez por semana`, `1–2 veces`, `3–4 veces`, `5 o más veces`.

### B2 — Información disponible

- Tipo: casillas.
- Pregunta: `¿Qué información puede consultar actualmente de forma digital?`
- Opciones: `Estado de membresía`, `Pagos`, `Asistencia`, `Rutina`, `Progreso`,
  `Mensajes del entrenador`, `Ninguna`, `Otra`.

### B3 — Dificultades

- Tipo: casillas, máximo tres respuestas.
- Pregunta: `¿Qué situaciones le generan más dificultad?`
- Opciones: `Recordar vencimientos`, `Conocer pagos pendientes`, `Encontrar la
  rutina`, `Registrar ejercicios`, `Observar progreso`, `Comunicarse con el
  entrenador`, `Ninguna`, `Otra`.

### B4 — Funciones valoradas

- Tipo: casillas, máximo cuatro respuestas.
- Pregunta: `¿Qué funciones usaría en una aplicación del gimnasio?`
- Opciones: `Membresía y pagos`, `Check-in`, `Entrenamiento del día`, `Registro de
  sesiones`, `Progreso`, `Alertas`, `Guías generales`, `Mensajes`, `Otra`.

### B5 — Dispositivo

- Tipo: opción única.
- Pregunta: `¿Desde qué dispositivo la usaría principalmente?`
- Opciones: `Celular`, `Computadora`, `Tableta`, `No la usaría`.

### B6 — Utilidad percibida

- Tipo: escala de 1 a 5.
- Pregunta: `¿Qué tan útil sería reunir pagos, asistencia, rutina y progreso en un solo lugar?`
- Etiquetas: `1 = Nada útil` y `5 = Muy útil`.

### B7 — Privacidad

- Tipo: opción única.
- Pregunta: `¿Le preocupa quién puede consultar su información de asistencia y progreso?`
- Opciones: `Sí, mucho`, `Sí, un poco`, `No`, `No sabe`.

### B8 — Comentario abierto

- Tipo: párrafo, opcional.
- Pregunta: `¿Qué haría que utilizara o dejara de utilizar una aplicación del gimnasio?`

## Mensaje final

> Gracias por participar. Las respuestas se utilizarán de forma agregada para
> mejorar el modelo de negocio y el prototipo GymHub. Completar esta encuesta no
> implica contratar, pagar ni participar automáticamente en una prueba.

## Plan de análisis

| Indicador | Preguntas | Presentación |
|---|---|---|
| Métodos actuales | A2 | Frecuencias y gráfico de barras |
| Problemas prioritarios | A3, B3 | Frecuencias separadas por rol |
| Funciones prioritarias | A5, B4 | Ranking por número de selecciones |
| Interés piloto | A7 | Porcentaje y cantidad absoluta |
| Disposición de pago | A8 | Distribución por rangos; no calcular promedio artificial |
| Soporte esperado | A9 | Dos necesidades más frecuentes |
| Utilidad para miembros | B6 | Mediana y distribución de escala |
| Privacidad | A10, B7 | Comparación descriptiva por rol |

Al informar resultados se debe indicar fecha, método de selección, cantidad de
respuestas válidas y limitaciones. Una muestra por conveniencia de 20 personas no
permite generalizar estadísticamente a todos los gimnasios de Pérez Zeledón.
