# Proyecto escrito Pulso — ExpoTÉCNICA 2026

Este directorio contiene el plan de negocios regional de Pulso, ampliado sobre
el documento institucional completo. El
documento sigue los lineamientos específicos de ExpoTÉCNICA 2026 y utiliza APA
7 para las citas y referencias. La propuesta documenta el origen estudiantil del
proyecto en 2025, su primera participación en la feria, la encuesta aplicada y
una proyección económica con planes y punto de equilibrio.
El alcance demostrable se concentra en la relación entrenador--miembro, los
planes de entrenamiento, la facturación y la asistencia. El escrito distingue
el piloto diseñado de cualquier resultado comercial todavía no obtenido.

## Compilación

```bash
cd docs/gymhub_expotecnica
./compilar
```

El PDF se genera en `build/main.pdf`. La copia de entrega `main.pdf` debe
sincronizarse después de compilar. Para eliminar los artefactos:

```bash
./compilar limpiar
```

## Archivos editables

- `main.tex`: configuración, portada y orden del documento.
- `secciones/`: contenido del modelo de negocio.
- `referencias.bib`: fuentes citadas en formato BibLaTeX.
- `encuesta_validacion.md`: instrumento de referencia y diferencias de la versión aplicada.
- `resultado_encuesta.csv`: exportación original de las 15 respuestas válidas.
- `generar_graficos_encuesta.py`: generación reproducible de gráficos anonimizados.
- `plantilla_resultados_encuesta.csv`: estructura para registrar las respuestas.
- `secciones/04-modelo-canvas.tex`: desarrollo y representación visual vigente
  de los nueve módulos del Canvas.
- `AUDITORIA_EXPOTEC11.md`: trazabilidad interna de los 24 indicadores de la
  rúbrica al contenido verificable del escrito.
- `AUDITORIA_INSTITUCIONAL.md`: control de cobertura documental y de exposición
  de las rúbricas ExpoTEC-11 y ExpoTEC-8, con pendientes explícitos.
- `PLAN_CUMPLIMIENTO_EXPOTEC12.md`: análisis de los 28 indicadores exactos del
  archivo `../evaluacion/plan_negocios.xlsx`, con respuesta y límites de evidencia.
- `generar_integracion_excel.py`: lee ambos Excel sin modificarlos, concilia
  cifras y genera cuatro gráficas, tablas anuales y la matriz de correspondencia.
- `auditoria_integracion_excel.json`: criterios originales, huellas de fuentes,
  conciliaciones y recuperación simple del escenario.
- `CONTROL_FUENTES.md`: verificación de idioma, uso y respaldo de cada fuente.
- `datos_financieros.csv` y `generar_grafico_financiero.py`: fuente y generador
  reproducible de la gráfica de escenarios de viabilidad.
- `AVANCE_PENDIENTES.md`: estado verificable del escrito y trabajo restante.
- `../frontend/capturar_anexos.mjs`: capturador Playwright de vistas de escritorio
  y móvil con cuentas ficticias; requiere Chromium instalado.
- `AGENTS.md`: reglas obligatorias para futuras modificaciones del escrito.

Para regenerar tablas, gráficas y matriz desde los Excel originales:

```bash
MPLCONFIGDIR=/tmp/matplotlib ../../.venv/bin/python generar_integracion_excel.py
./compilar
```

El generador lee valores guardados en el Excel y comprueba las relaciones de
cartera, ingresos, costos, resultados, caja y balance; no ejecuta todas las
fórmulas del libro. El Excel financiero es un borrador de trabajo y no se
entrega como anexo ni se cita como fuente bibliográfica. Las tablas y figuras
se identifican como elaboración propia a partir del escenario financiero
preliminar. La revisión editorial conserva secciones, tablas y cifras, aunque
puede reducir la cantidad de páginas.

Para instalar Chromium y generar las capturas del sistema:

```bash
cd frontend
npx playwright install chromium
node capturar_anexos.mjs
```

El script genera cuatro capturas de escritorio y dos móviles en
`docs/gymhub_expotecnica/imagenes/`. Debe ejecutarse únicamente con cuentas y
datos de demostración.

Para regenerar la gráfica de viabilidad de detalle con el entorno del proyecto:

```bash
MPLCONFIGDIR=/tmp/matplotlib ../../.venv/bin/python generar_grafico_financiero.py
```

## Pendientes antes de entregar

El detalle vigente se mantiene en `AVANCE_PENDIENTES.md`.

La rúbrica rectora es `../evaluacion/plan_negocios.xlsx`, citada en el informe.
`modelo_negocios/Analisis_ gym.xlsx` conserva los cálculos de trabajo para
regenerar las tablas; no es una validación externa del negocio. La marca vigente es
**Pulso**. La versión regional incluye mercado, organización, finanzas anuales,
cuatro gráficas adicionales y correspondencia de los 28 indicadores.
Quedan pendientes evidencias externas de formalización, aliado y piloto,
aceptación de precios, cotizaciones y capacidad multiempresa. No se atribuye
una calificación oficial al documento ni se presentan proyecciones como ventas.

La revisión editorial está registrada en `AUDITORIA_REDACCION.md`. Los
objetivos aprobados y la declaración de IA se conservaron literalmente.

## Entrega final con análisis de precios

`main.pdf` es la copia de entrega sincronizada con `build/main.pdf`.
La revisión del 18 de septiembre incorpora una tabla de tarifas oficiales,
sus condiciones y seis referencias adicionales. Las 22 referencias están
citadas en el texto. `CONTROL_FUENTES.md` documenta qué se verificó y los
límites de acceso. El escenario financiero conserva sus importes y detalla
la conciliación pendiente de Workspace. La declaración de IA y los objetivos
permanecen sin cambios.
