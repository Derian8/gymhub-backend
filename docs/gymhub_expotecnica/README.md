# Proyecto escrito GymHub — ExpoTÉCNICA 2026

Este directorio contiene el modelo de negocio institucional de GymHub. El
documento sigue los lineamientos específicos de ExpoTÉCNICA 2026 y utiliza APA
7 para las citas y referencias. La propuesta documenta el origen estudiantil del
proyecto en 2025, su primera participación en la feria, la encuesta aplicada y
una proyección económica con planes y punto de equilibrio.

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
- `AVANCE_PENDIENTES.md`: estado verificable del escrito y trabajo restante.
- `AGENTS.md`: reglas obligatorias para futuras modificaciones del escrito.

## Pendientes antes de entregar

El detalle vigente se mantiene en `AVANCE_PENDIENTES.md`.
