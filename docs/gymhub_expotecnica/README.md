# Proyecto escrito GymHub — ExpoTÉCNICA 2026

Este directorio contiene el modelo de negocio institucional de GymHub. El
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

El PDF se genera en `build/main.pdf`. Para eliminar los artefactos:

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
- `PLAN_CUMPLIMIENTO_EXPOTEC12.md`: matriz y ruta de trabajo para convertir el
  modelo institucional en un plan de negocios verificable con los 28 indicadores
  de ExpoTEC-12 (84 puntos).
- `CONTROL_FUENTES.md`: verificación de idioma, uso y respaldo de cada fuente.
- `datos_financieros.csv` y `generar_grafico_financiero.py`: fuente y generador
  reproducible de la gráfica de escenarios de viabilidad.
- `AVANCE_PENDIENTES.md`: estado verificable del escrito y trabajo restante.
- `AGENTS.md`: reglas obligatorias para futuras modificaciones del escrito.

Para regenerar la gráfica de viabilidad con el entorno del proyecto:

```bash
MPLCONFIGDIR=/tmp/matplotlib ../../.venv/bin/python generar_grafico_financiero.py
```

## Pendientes antes de entregar

El detalle vigente se mantiene en `AVANCE_PENDIENTES.md`.
