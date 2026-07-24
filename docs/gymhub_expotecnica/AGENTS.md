# Reglas Del Proyecto Escrito GymHub

Estas instrucciones aplican a todo archivo dentro de `docs/gymhub_expotecnica/`.

## Flujo Obligatorio

- Todo cambio al informe escrito debe realizarse en LaTeX, principalmente en
  `main.tex`, `secciones/` y `referencias.bib`.
- Antes de modificar contenido, consultar
  `../guia_agente_gymhub_expotecnica.md` y los lineamientos PDF incluidos en este
  directorio. Ante una diferencia con APA general, prevalece el lineamiento
  específico de ExpoTÉCNICA para Modelo y Plan de Negocios.
- Las citas y referencias deben mantenerse con BibLaTeX y estilo APA 7. No se
  deben introducir afirmaciones externas sin una fuente documentada.
- Compilar siempre con `./compilar` y revisar `build/main.pdf`. Eliminar los
  auxiliares al finalizar si no son necesarios, conservando el PDF vigente.

## Contenido Aprobado

- No cambiar el objetivo general ni los cuatro objetivos específicos sin una
  instrucción explícita del usuario.
- Mantener la secuencia del escrito: investigación de necesidades, desarrollo
  tecnológico, modelo de negocio y viabilidad comercial y económica.
- Mantener los tamaños reglamentarios, los logos y los datos aprobados de la
  portada.
- No presentar como implementadas las capacidades multiempresa, personalización
  por gimnasio o facturación automática mientras no existan en el producto.

## Encuesta Y Datos

- La encuesta cerró el 24 de julio de 2026 con 15 respuestas válidas. La
  exportación original es `resultado_encuesta.csv` y no debe modificarse.
- La muestra es no probabilística: 5 responsables y 10 miembros. No generalizar
  sus resultados a todos los gimnasios de Pérez Zeledón.
- Mantener documentados el rechazo de varios propietarios, la ausencia de una
  tasa de respuesta y las diferencias entre el instrumento previsto y el aplicado.
- Toda afirmación nueva que dependa de evidencia todavía inexistente debe utilizar
  `\datoencuestapendiente{...}` para aparecer en rojo en el PDF.
- Los gráficos se regeneran con `generar_graficos_encuesta.py`; no alterar
  manualmente sus valores.

## Registro De Avance

- Consultar y actualizar `AVANCE_PENDIENTES.md` cuando se complete una etapa o se
  identifique un pendiente nuevo.
- Mantener sincronizados el registro, el apartado de anexos y el README.
