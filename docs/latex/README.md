# Documento académico en LaTeX

Esta carpeta contiene la plantilla del documento escrito de GymHub. Usa la
clase `apa7` en modalidad estudiantil y administra citas y referencias con
`biblatex-apa` y Biber.

## Compilación

Desde esta carpeta:

```bash
cd docs/latex
./compilar
```

`./compilar` usa una instalación local de `latexmk` cuando está disponible. Si no
la encuentra, construye automáticamente la imagen definida en `Dockerfile` y
compila dentro de Docker. El resultado queda en `build/main.pdf`.

El repositorio también admite una instalación aislada de TinyTeX en
`../../.TinyTeX/`. El script la detecta automáticamente, por lo que no es
necesario modificar el `PATH` del sistema.

También se puede elegir el método explícitamente:

```bash
make local        # requiere LaTeX, latexmk, Biber y Make
make docker       # requiere Docker y Make
./compilar limpiar # elimina todos los artefactos generados
```

En Debian o Ubuntu, la instalación nativa equivalente es:

```bash
sudo apt-get update
sudo apt-get install biber latexmk texlive-bibtex-extra \
  texlive-fonts-recommended texlive-lang-spanish texlive-latex-base \
  texlive-latex-extra texlive-latex-recommended texlive-publishers
```

## Edición

- Complete los datos de portada y el resumen en `main.tex`.
- Edite el contenido dentro de `secciones/`.
- Agregue las fuentes bibliográficas a `referencias.bib`.
- Cite en el texto con `\parencite{clave}` o `\textcite{clave}`; no escriba las
  referencias manualmente.
- Conserve las fuentes académicas y técnicas que realmente se hayan consultado.

La clase genera la portada estudiantil, el interlineado y la estructura base.
`biblatex-apa` ordena y presenta automáticamente la lista de referencias según
APA 7.

## Docker en WSL

Si el comando `docker` no puede acceder al servicio, inicie Docker Desktop y
habilite la integración de la distribución en **Settings > Resources > WSL
Integration**. Después, ejecute nuevamente `make docker`.
