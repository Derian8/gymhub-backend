FROM debian:bookworm-slim

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
        biber \
        latexmk \
        make \
        texlive-bibtex-extra \
        texlive-fonts-recommended \
        texlive-lang-spanish \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-latex-recommended \
        texlive-publishers \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /documento
