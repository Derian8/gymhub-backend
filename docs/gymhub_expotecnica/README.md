# Proyecto escrito GymHub — ExpoTÉCNICA 2026

Este directorio contiene el modelo de negocio institucional de GymHub. El
documento sigue los lineamientos específicos de ExpoTÉCNICA 2026 y utiliza APA
7 para las citas y referencias.

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
- `encuesta_validacion.md`: instrumento actualmente en aplicación mediante Google Forms.
- `plantilla_resultados_encuesta.csv`: estructura para registrar las respuestas.
- `imagenes/canvas_gymhub.png`: Canvas recuperado del documento inicial.

## Pendientes antes de entregar

1. Finalizar la encuesta e incorporar sus resultados sin alterar los datos originales.
2. Actualizar cotizaciones si cambian los planes tecnológicos.
3. Incorporar capturas anonimizadas del prototipo si el CTR las solicita.
