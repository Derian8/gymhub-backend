# Avance Y Pendientes Del Escrito

Última actualización: 18 de septiembre de 2026.

## Documento final y referencias de precios — 18 de septiembre

- Se incorporaron seis fuentes oficiales de tarifas con citas dentro del análisis
  de precios y bibliografía APA: Vercel, Supabase, dominio de Supabase, Workspace,
  Amazon SES y GPT-4.1 mini. Se precisaron moneda, unidad y condiciones.
- Se revisaron las 22 entradas y su correspondencia con las citas del informe;
  se corrigieron metadatos de INEC y Kotler, páginas sin fecha y enlace de Hacienda.
- Se retiró la referencia BCCR sin cita; CRC 500/USD es un supuesto del equipo.
- Workspace aparece en dos descripciones del Excel. Su duplicación monetaria
  requiere desglose; se explica un ajuste condicionado sin alterar el escenario.
- La reserva de CRC 40000 se denomina propuesta, no mínimo comprobado.
- Se conservaron íntegros los objetivos y la declaración de IA.
- Las limitaciones de acceso a MEIC, CCSS y textos legales se registran en
  CONTROL_FUENTES.md; no se presentan como verificaciones completas.
- PDF final: 86 páginas; compilación sin citas ni referencias indefinidas y
  sin desbordamientos horizontales. Se revisaron visualmente las páginas de
  tarifas y bibliografía y se sincronizaron `main.pdf` y `build/main.pdf`.
- Conciliaciones del generador aprobadas: ingresos CRC 2780000, resultado
  CRC 596044,36 y caja CRC 1666983,56.
- Esta entrega finaliza la edición del documento; no acredita piloto,
  formalización, inventario, cotizaciones ni nuevas capturas móviles.

## Revisión Editorial Integral — 18 De Septiembre

- Se revisó la redacción de todas las secciones, conclusiones, anexos y notas de
  tablas con un tono formal y sencillo para undécimo año.
- Se acortaron repeticiones y se explicaron los conceptos de caja, costo del
  trabajo, margen y recuperación con los mismos importes del escenario.
- Se conservaron las secciones, tablas, cifras tabuladas, figuras y objetivos
  aprobados. La declaración de IA permanece literal por instrucción del usuario;
  su porcentaje no fue validado en esta revisión.
- Se retiraron las referencias bibliográficas al Excel financiero y al borrador
  de costos. Los resultados se identifican como elaboración propia a partir del
  escenario financiero preliminar. Los archivos de trabajo se conservan.
- Se actualizaron el generador de tablas y la matriz de rúbrica para mantener
  este criterio en futuras regeneraciones.
- Las pruebas y capturas de julio se describen como evidencia de esa versión.
- PDF revisado: 83 páginas, frente a 89 antes de la edición. Se sincronizan
  `build/main.pdf` y `main.pdf` como versión vigente.
- Detalle editorial y pendientes: `AUDITORIA_REDACCION.md`.

## Integración Del Plan De Negocios — 18 De Septiembre

- Se analizaron los 28 indicadores exactos de `../evaluacion/plan_negocios.xlsx`,
  A28:A55. La matriz anterior no coincidía en el orden; se sustituyó con la
  correspondencia correcta, conservando el duplicado m/o de la fuente.
- Se amplió el documento base de 55 páginas con definición y estudio de mercado,
  inventario, organización, operación y análisis económico-financiero anual.
- Se citaron ambos Excel mediante BibLaTeX APA. Se incorporaron cuatro gráficas
  adicionales y tablas reproducibles de clientes, caja, resultados y balance.
- Se conciliaron ingresos (CRC 2 780 000), resultado antes de impuestos
  (CRC 596 044,36), caja final (CRC 1 666 983,56) y patrimonio. La recuperación
  económica simple se proyecta en el mes 8, cargando el desarrollo al mes 1.
- Se reemplazó en el PDF el Canvas gráfico desactualizado por nueve bloques
  LaTeX con los importes del Excel; la imagen histórica sigue disponible.
- El impuesto cero MYPE es un supuesto condicionado, no un beneficio acreditado.
  La reserva de CRC 40 000 requiere calendario diario para comprobar su mínimo.
- Pendientes: formalización y seguridad social acreditadas, aliado/piloto,
  aceptación comercial, capacidad multiempresa, cotizaciones, inventario real
  y conciliación del rótulo Workspace entre infraestructura y correo/diseño.
- La cobertura de los indicadores no constituye 84/84 ni calificación del jurado.
- Compilación regional ampliada: 85 páginas frente a las 55 de la versión base.
  En esa etapa el PDF se generó en `build/main.pdf`. Desde la revisión editorial,
  `main.pdf` también se sincroniza como copia vigente de entrega.
- Se añadió el anexo de capturas de la interfaz del MVP con datos ficticios.
  Chromium quedó instalado para Playwright y `frontend/capturar_anexos.mjs`
  quedó preparado para cuatro capturas de escritorio y dos móviles. La ejecución
  remota sigue pendiente porque el backend de demostración no completó el inicio
  de sesión dentro del tiempo disponible del contenedor; no se generan imágenes
  móviles que no correspondan a una vista real de la interfaz.

## Adaptación Regional — 17 De Septiembre

- El informe se reestructuró como Plan de negocios regional y adopta la marca
  Pulso. GymHub se conserva únicamente como nombre de la versión de desarrollo
  anterior.
- La fuente financiera del informe es `modelo_negocios/Analisis_ gym.xlsx`.
  Se incorporaron sus supuestos de Starter CRC 15 000, Pro Gym CRC 25 000,
  14 gimnasios activos al cierre del año uno, ingresos de CRC 2 780 000 y
  equilibrio operativo desde seis clientes.
- La gráfica reproducible de punto de equilibrio se sincronizó con los
  escenarios de cuatro a ocho clientes. Todas las cifras se presentan como
  proyecciones y no como ventas, contratos ni piloto ejecutado.

## Revisión De Marca Y Documentos Financieros — 11 De Septiembre

- El equipo confirmó Pulso como nombre comercial vigente. La identidad visual
  está en `../nueva_identidad_visual/`: logo, banner, icono y merchandising, con
  rojo, negro y blanco y el lema «El ritmo de tu gimnasio en un solo lugar».
- La marca ya fue trasladada al informe y sus anexos; GymHub se conserva solo
  cuando es necesario explicar el nombre histórico de la versión inicial.
- El equipo confirmó `modelo_negocios/Modelo_costos_SaaS_GymHub_regional.docx`
  como base de costos aprobada para Pulso. Sus importes son CRC 61 125 fijos y
  CRC 4 750 o 17 250 variables por gimnasio, con tipo de cambio presupuestario
  de CRC 500/USD y hora técnica de CRC 5 000. Las observaciones y sugerencias
  deben distinguirse de los importes aprobados, sin alterarlos automáticamente.
- El informe utiliza el escenario consolidado del Excel: Starter CRC 15 000,
  Pro Gym CRC 25 000 y equilibrio operativo desde seis clientes. El documento
  de costos anterior permanece como antecedente, no como fuente de las cifras
  proyectadas vigentes.
- Los tres Excel conservan datos genéricos. PIEA contiene resultados guardados
  `#DIV/0!` en GASTOS y PRESUPUESTO; la simulación usa 10 000 unidades a CRC 150.
  Adaptar ventas a suscripciones activas mensuales y recalcular las fórmulas.
- Los puntos de equilibrio del Word coinciden aritméticamente con sus supuestos
  (6, 4, 3 y 2 clientes por plan), pero falta validar consumo, soporte y costos
  de implementación multiempresa. Separar costo de instalación y precio cobrado.

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
- Escenario comercial proyectado con Starter de CRC 15 000 y Pro Gym de
  CRC 25 000; no se presenta como piloto, venta, contrato ni cartera real.
- Costos de desarrollo, operación, trabajo valorado y soporte incluidos en la
  proyección financiera de referencia.
- Punto de equilibrio operativo proyectado desde 6 clientes activos.
- Escenario anual proyectado con 14 gimnasios activos al cierre del primer año,
  sin presentarlo como meta comercial alcanzada.
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
