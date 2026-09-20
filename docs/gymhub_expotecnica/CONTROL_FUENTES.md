# Control De Fuentes Y Citas

Fecha de revisión bibliográfica y de precios: 18 de septiembre de 2026.
Se distingue la comprobación de tarifas y metadatos de la lectura completa
de cada obra. Los límites de acceso se registran al final.

Este registro complementa `referencias.bib`. Cada fuente debe respaldar una
afirmación identificable en el informe y aparecer tanto en una cita como en la
bibliografía. Las fuentes se verifican por autor, título, idioma, fecha y enlace
o ejemplar disponible.

## Criterio lingüístico

- Se prefieren fuentes oficiales en español.
- Se mantienen Django REST Framework y Celery en inglés. A solicitud del usuario
  se incorporan además las fuentes primarias de precios de Vercel y Supabase
  en su idioma original, para conservar enlaces y títulos exactos. Google, AWS
  y OpenAI se consultaron en sus páginas oficiales en español.
- La encuesta y el repositorio mantienen sus referencias propias. El presupuesto
  es elaboración del equipo para este informe: su Excel y el documento de costos
  fueron borradores de preparación y no se presentan como publicaciones ni
  validación independiente. Las tablas explican los supuestos del escenario.

## Registro de verificación

| Clave BibLaTeX | Idioma | Tipo y respaldo | Uso en el informe | Estado |
|---|---|---|---|---|
| `mep2026` | Español | Lineamientos oficiales incluidos en el directorio | Estructura, Canvas, uso responsable de IA | Verificada localmente |
| `baca2016` | Español | Libro en español | Evaluación económica y método de consulta | Verificada por ficha editorial |
| `kotler2018` | Español | Libro en español | Propuesta de valor | Verificada por ficha editorial |
| `inec_enameh2024` | Español | Informe oficial INEC | Contexto de microempresas | Enlace oficial registrado |
| `meic_pndip2023_2026` | Español | Documento oficial MEIC | Digitalización de pymes | Enlace oficial registrado |
| `ley8968`, `codigo_comercio_cr` | Español | Normativa costarricense | Privacidad y formalización | Fuente oficial PGR-SCIJ |
| `hacienda_rut`, `ccss_independiente` | Español | Entidades públicas costarricenses | Obligaciones y trámites | Enlaces oficiales registrados |
| `django51`, `react2026` | Español | Documentación oficial en español | Arquitectura e interfaz | Páginas oficiales verificadas |
| `drf315`, `celery2026` | Inglés | Documentación primaria oficial | API y tareas asíncronas | Excepción técnica justificada |
| `gymhub_repo` | Español | Repositorio propio | Evidencia del MVP y pruebas | Verificada localmente |
| `encuesta_gymhub_2026` | Español | Instrumento y CSV anonimizado | Validación de necesidades | Incluidos en apéndices |
| Escenario financiero preliminar | Español | Cálculos propios del informe | Costos, precios, equilibrio y estados proyectados | Notas de elaboración propia; sin referencia bibliográfica al borrador |

## Controles antes de entregar

1. Confirmar que no existan citas sin entrada en `referencias.bib` ni entradas
   sin cita en archivos `.tex`.
2. Confirmar que cada URL pública responda y que la fecha de consulta coincida
   con la revisión final.
3. Reemplazar el presupuesto interno por cotizaciones formales si se inicia la
   venta del servicio; no presentar las estimaciones como tarifas garantizadas.
4. Conservar las fuentes primarias de tarifas aunque su versión oficial esté en
   inglés; no sustituirlas por traducciones no oficiales.

## Verificación final de precios y referencias

Las seis fuentes siguientes tienen cita en la sección «Fuentes y condiciones
 del análisis de precios» y entrada BibLaTeX sin año de publicación inventado,
con fecha de recuperación 2026-09-18:

| Clave | Página oficial consultada | Dato comprobado |
|---|---|---|
| `vercel_precios` | https://vercel.com/pricing | Pro USD 20/mes, crédito de consumo y cargos adicionales; impuestos excluidos. |
| `supabase_precios` | https://supabase.com/pricing | Pro desde USD 25/mes; cómputo y consumo afectan el total. |
| `supabase_dominio` | https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains | USD 0,0137/hora, referencia USD 10/mes por dominio personalizado. |
| `google_workspace_precios` | https://workspace.google.com/pricing?hl=es-419 | Starter regular USD 7/usuario/mes con compromiso anual, sin usar promoción. |
| `aws_ses_precios` | https://aws.amazon.com/es/ses/pricing/ | Modalidad a la carta: USD 0,10/1000 correos salientes; extras aparte. |
| `openai_mini_precios` | https://developers.openai.com/es-419/api/docs/models/gpt-4.1-mini | Texto estándar: USD 0,40 entrada y USD 1,60 salida por millón de tokens. |

- Se verificó el título y mes del informe INEC con el PDF oficial.
- Kotler y Armstrong: ficha bibliográfica de Google Books, ISBN 9788420568607,
  segunda edición, Pearson, 2018. Se precisó el subtítulo. La ficha confirma
  metadatos, no constituye una revisión de todo el libro.
- Baca: edición octava, 2016, confirmada en catálogos bibliotecarios universitarios;
  no se comprobó todo el contenido del ejemplar.
- Se abrieron las cuatro páginas técnicas de Django, DRF, React y Celery.
  Para páginas vivas sin fecha de publicación identificable se usa «s. f.».
- El enlace antiguo de Hacienda no se pudo recuperar; se sustituyó por el
  portal oficial TRIBU-CR abierto durante esta revisión.
- CCSS: se sustituyó la página de contacto por el directorio de trámites, cuya
  indexación oficial identifica «Afiliación de Trabajador Independiente».
  La apertura directa del directorio agotó el tiempo de espera.
- PGR-SCIJ redirige a SINALEVI. La página recuperada no expone el articulado;
  no se certifica una revisión de la versión consolidada de ambas leyes.
- MEIC: la descarga del PDF falló por tiempo de espera y certificado TLS,
  incluso al repetir fuera del entorno restringido. Se conserva la referencia
  previa y su fecha de consulta; su contenido no se da por revalidado.
- Se retiró la entrada BCCR no citada y su cotización histórica no acreditada;
  CRC 500/USD se explica como supuesto presupuestario propio.
- Repositorio, encuesta y rúbrica se verifican con los archivos locales.

## Conciliación de Workspace

El Excel «Analisis_ gym.xlsx», tercera hoja, contiene Workspace en C17
(infraestructura; D17 = 58125) y en C20 (correo USD 7 y diseño USD 5;
D20 = 6000). D17 no desglosa proveedores: se confirma repetición descriptiva,
pero no se acredita aún doble cobro monetario. No se cambió el Excel ni los
estados base. El informe explica el ajuste condicional de CRC 3500/mes y
CRC 42000/año, sujeto a comprobar el desglose. Diseño, dominio, Redis y worker
siguen como estimaciones sin cotizaciones suficientes.
