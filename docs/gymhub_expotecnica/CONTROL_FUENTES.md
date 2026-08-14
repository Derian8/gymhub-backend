# Control De Fuentes Y Citas

Fecha de revisión: 13 de agosto de 2026.

Este registro complementa `referencias.bib`. Cada fuente debe respaldar una
afirmación identificable en el informe y aparecer tanto en una cita como en la
bibliografía. Las fuentes se verifican por autor, título, idioma, fecha y enlace
o ejemplar disponible.

## Criterio lingüístico

- Todas las fuentes de contexto, normativa, mercado, costos, metodología y
  modelo de negocio están en español.
- Se permiten únicamente dos excepciones técnicas en inglés: Django REST
  Framework y Celery. Son documentación primaria de los componentes utilizados
  y no se encontró una versión oficial actual en español. Sus citas se limitan a
  la descripción técnica del prototipo.
- Los datos propios se citan como documentos internos en español y sus soportes
  se conservan en los apéndices: encuesta anonimizada, presupuesto y repositorio.

## Registro de verificación

| Clave BibLaTeX | Idioma | Tipo y respaldo | Uso en el informe | Estado |
|---|---|---|---|---|
| `mep2026` | Español | Lineamientos oficiales incluidos en el directorio | Estructura, Canvas, uso responsable de IA | Verificada localmente |
| `baca2016` | Español | Libro en español | Evaluación económica y método de consulta | Verificada por ficha editorial |
| `kotler2018` | Español | Libro en español | Propuesta de valor | Verificada por ficha editorial |
| `inec_enameh2024` | Español | Informe oficial INEC | Contexto de microempresas | Enlace oficial registrado |
| `meic_pndip2023_2026` | Español | Documento oficial MEIC | Digitalización de pymes | Enlace oficial registrado |
| `ley8968`, `codigo_comercio_cr` | Español | Normativa costarricense | Privacidad y formalización | Fuente oficial PGR-SCIJ |
| `hacienda_rut`, `ccss_independiente`, `bccr_tipo_cambio` | Español | Entidades públicas costarricenses | Obligaciones y conversión monetaria | Enlaces oficiales registrados |
| `django51`, `react2026` | Español | Documentación oficial en español | Arquitectura e interfaz | Páginas oficiales verificadas |
| `drf315`, `celery2026` | Inglés | Documentación primaria oficial | API y tareas asíncronas | Excepción técnica justificada |
| `gymhub_repo` | Español | Repositorio propio | Evidencia del MVP y pruebas | Verificada localmente |
| `encuesta_gymhub_2026` | Español | Instrumento y CSV anonimizado | Validación de necesidades | Incluidos en apéndices |
| `presupuesto_gymhub_2026` | Español | Supuestos y escenarios internos | Costos, precios y equilibrio | Incluido en apéndices |

## Controles antes de entregar

1. Confirmar que no existan citas sin entrada en `referencias.bib` ni entradas
   sin cita en archivos `.tex`.
2. Confirmar que cada URL pública responda y que la fecha de consulta coincida
   con la revisión final.
3. Reemplazar el presupuesto interno por cotizaciones formales si se inicia la
   venta del servicio; no presentar las estimaciones como tarifas garantizadas.
4. Mantener el límite de dos fuentes técnicas en inglés; cualquier tercera fuente
   debe contar con versión oficial en español o eliminarse del informe.
