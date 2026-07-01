IMAGEN := proyectoappgym-latex
ARCHIVO_PRINCIPAL := main.tex
DIRECTORIO_SALIDA := build
PDF := $(DIRECTORIO_SALIDA)/main.pdf

.PHONY: pdf local docker clean

pdf:
	@if command -v latexmk >/dev/null 2>&1; then \
		$(MAKE) local; \
	else \
		$(MAKE) docker; \
	fi

local:
	mkdir -p $(DIRECTORIO_SALIDA)
	latexmk -pdf -interaction=nonstopmode -halt-on-error \
		-file-line-error -outdir=$(DIRECTORIO_SALIDA) $(ARCHIVO_PRINCIPAL)

docker:
	docker build --tag $(IMAGEN) .
	docker run --rm \
		--user "$$(id -u):$$(id -g)" \
		--volume "$(CURDIR):/documento" \
		--workdir /documento \
		$(IMAGEN) make local

clean:
	rm -rf $(DIRECTORIO_SALIDA)
