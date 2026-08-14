# Avance Y Pendientes Del Escrito

Última actualización: 13 de agosto de 2026.

## Avance Confirmado

- Portada completa con título, categoría, eje temático, participantes, docente
  tutor, centro educativo, CORVEC, correos y logos institucionales.
- Objetivo general y cuatro objetivos específicos aprobados por el equipo,
  formulados con una secuencia de necesidades, funciones, suscripción y viabilidad.
- Documento organizado según la secuencia: investigación, desarrollo de la
  plataforma, modelo de negocio y evaluación de viabilidad.
- Arquitectura y módulos del MVP documentados con sus limitaciones reales y con
  los dos roles implementados: entrenador y miembro.
- Canvas y estrategia de suscripción contrastados con la encuesta.
- Canvas visual actualizado con los planes, costos, segmentos, alianzas y
  capacidades vigentes, e incorporado en los apéndices según la guía.
- Maquetación continua corregida: se eliminaron los saltos forzados entre
  secciones del cuerpo, se evitó el aislamiento de encabezados y las capturas
  técnicas volvieron a flotar junto con su explicación. El Canvas se rediseñó
  como nueve tarjetas turquesa nativas de LaTeX, legibles en PDF e impresión.
- Resumen ejecutivo reducido al máximo reglamentario de 150 palabras.
- Contexto de mercado reforzado con datos oficiales de INEC y el marco de
  digitalización de pymes del MEIC, sin convertirlos en estimaciones de la
  cantidad de gimnasios locales.
- Comparación competitiva ampliada con alternativas manuales y plataformas de
  referencia.
- Estrategia de mercadeo integrada con producto, precio, distribución,
  promoción, posicionamiento e indicadores iniciales.
- Seguimiento de calidad definido para incorporación, operación, continuidad y
  cierre del piloto.
- Piloto de cuatro semanas definido en CRC 15 000, seguido por planes de
  CRC 30 000, CRC 45 000 y CRC 60 000 según uso y acompañamiento requerido.
- Costos de desarrollo, operación, trabajo y soporte incluidos en la proyección.
- Punto de equilibrio establecido en 3 gimnasios Básico o 2 gimnasios Gestión.
- Meta comercial inicial definida en 3 gimnasios durante los primeros 6 meses.
- Encuesta cerrada con 15 respuestas válidas: 5 responsables y 10 miembros.
- Periodo, composición, rechazo de propietarios, limitaciones y diferencias del
  formulario aplicado documentados.
- Resultados tabulados por rol y cuatro gráficos generados de forma reproducible.
- Capturas vigentes de planes, facturación y asistencia del entrenador, junto
  con el panel de miembro, incorporadas con datos ficticios y sin credenciales.
- Evidencia técnica actualizada a 21 archivos con 214 funciones de prueba
  backend, 32 archivos con 106 casos frontend y 2 especificaciones E2E. Se
  aprobaron los 106 casos frontend y una selección de 104 pruebas backend de los
  recorridos priorizados.
- Planes de entrenamiento y facturación documentados como recorridos separados:
  la rutina se configura y asigna desde Planes; la membresía y el pago se operan
  desde Facturación.
- Flujo de caja exploratorio de seis meses incorporado, con pérdida acumulada,
  capital operativo inicial, márgenes por escenario y recuperación condicionada
  de la inversión.
- Matriz de riesgos comerciales, técnicos, financieros, legales y de privacidad
  incorporada con controles y respuestas.
- Instrumento aplicado transcrito en los apéndices, con tipos de respuesta,
  opciones y diferencias metodológicas declaradas.
- Referencias administradas con BibLaTeX en estilo APA 7.
- Orden del informe y redacción impersonal ajustados a los lineamientos del
  documento escrito y a la rúbrica ExpoTEC-11.
- Matriz privada de trazabilidad de los 24 indicadores ExpoTEC-11 disponible en
  `AUDITORIA_EXPOTEC11.md`; los controles internos no forman parte del PDF que
  recibe el jurado.
- Auditoría institucional ampliada para ExpoTEC-11 y ExpoTEC-8, con evidencia
  documentada y pendientes comerciales separados de la cobertura del informe.
- Plan de cumplimiento ExpoTEC-12 creado para la futura etapa regional/nacional;
  identifica los 28 indicadores del plan de negocios y la evidencia faltante.
- Control de fuentes actualizado: fuentes en español y dos excepciones técnicas
  oficiales en inglés justificadas para Django REST Framework y Celery.
- Gráfica reproducible de escenarios de viabilidad y ruta comercial propuesta
  incorporadas como apoyo visual del modelo de negocio.
- Objetivos alineados explícitamente con viabilidad, escalabilidad y
  sostenibilidad.
- Origen documentado en el segundo periodo de 2025, en Fundamentos de
  Programación, y primera participación de GymHub en ExpoTÉCNICA.
- Declaración breve de apoyo técnico, sin atribuir a una herramienta la creación
  ni la redacción final del proyecto.
- Compilación LaTeX funcional y PDF vigente generado en `build/main.pdf`.

## Pendientes De Investigación

- Conservar sin alteraciones la exportación original de Google Forms.
- No generalizar los resultados a todos los gimnasios de Pérez Zeledón.
- Si se realiza una segunda consulta, registrar cantidad de invitaciones,
  rechazos y canal de reclutamiento desde el inicio.

## Pendientes De Validación Y Negocio

- Habilitar un canal de contacto voluntario separado de la encuesta y seleccionar
  un gimnasio interesado en una demostración o piloto.
- Ejecutar o documentar la demostración y medir adopción, incidencias, tiempo de
  tareas e intención de continuidad.
- Sustituir la hipótesis de precios regulares por evidencia de aceptación o
  rechazo obtenida después de las demostraciones.
- Medir la conversión del piloto hacia los planes Básico, Gestión y Crecimiento.
- Comparar las horas estimadas con el soporte realmente requerido.
- Cotizar formalización e impuestos antes de iniciar actividad lucrativa.

## Pendientes Técnicos Y De Evidencia

- Implementar aislamiento multiempresa antes de atender varios gimnasios.
- Implementar configuración de logo y colores por gimnasio, solicitada por cuatro
  responsables, antes de venderla como capacidad disponible.
- Resolver workers persistentes, Redis, almacenamiento de archivos, respaldos y
  recuperación para operación comercial.
- Confirmar con el CTR el uso de ExpoTEC-5 y ExpoTEC-6.

## Criterio De Cierre

El escrito estará listo para entrega cuando la proyección financiera sea
consistente en todas sus secciones, la evidencia de demostración esté anexada,
las tarifas tecnológicas se encuentren actualizadas y no existan marcadores sin
resolver, salvo pendientes expresamente aceptados por el equipo y el docente
tutor.
