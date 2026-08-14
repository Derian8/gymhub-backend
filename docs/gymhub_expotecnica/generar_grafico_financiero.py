#!/usr/bin/env python3
"""Genera una figura reproducible de los escenarios financieros de GymHub."""

from __future__ import annotations

import csv
from pathlib import Path

import matplotlib.pyplot as plt


BASE = Path(__file__).resolve().parent
ENTRADA = BASE / "datos_financieros.csv"
SALIDA = BASE / "imagenes" / "escenarios_punto_equilibrio.png"


def formato_colones(valor: float, _posicion: float) -> str:
    return f"CRC {valor / 1000:.0f} mil"


def main() -> None:
    with ENTRADA.open(newline="", encoding="utf-8") as archivo:
        filas = list(csv.DictReader(archivo))

    etiquetas = [fila["escenario"] for fila in filas]
    ingresos = [int(fila["ingreso"]) for fila in filas]
    costos = [int(fila["costo"]) for fila in filas]
    utilidades = [int(fila["utilidad"]) for fila in filas]
    posiciones = list(range(len(filas)))

    figura, (eje_principal, eje_utilidad) = plt.subplots(
        1,
        2,
        figsize=(12, 5.5),
        gridspec_kw={"width_ratios": [1.55, 1]},
    )

    ancho = 0.36
    eje_principal.bar(
        [posicion - ancho / 2 for posicion in posiciones],
        ingresos,
        width=ancho,
        color="#166534",
        label="Ingreso",
    )
    eje_principal.bar(
        [posicion + ancho / 2 for posicion in posiciones],
        costos,
        width=ancho,
        color="#64748B",
        label="Costo",
    )
    eje_principal.set_xticks(posiciones, etiquetas, rotation=28, ha="right")
    eje_principal.yaxis.set_major_formatter(formato_colones)
    eje_principal.set_title("Ingreso y costo mensual", loc="left", fontweight="bold")
    eje_principal.grid(axis="y", color="#E2E8F0")
    eje_principal.set_axisbelow(True)
    eje_principal.legend(frameon=False)

    colores = ["#B91C1C" if valor < 0 else "#2563EB" for valor in utilidades]
    eje_utilidad.barh(etiquetas, utilidades, color=colores)
    eje_utilidad.axvline(0, color="#1F2937", linewidth=0.8)
    eje_utilidad.xaxis.set_major_formatter(formato_colones)
    eje_utilidad.set_title("Utilidad o pérdida", loc="left", fontweight="bold")
    eje_utilidad.grid(axis="x", color="#E2E8F0")
    eje_utilidad.set_axisbelow(True)
    eje_utilidad.set_xlim(min(utilidades) - 17000, max(utilidades) + 7000)
    for posicion, valor in enumerate(utilidades):
        etiqueta = f"CRC {valor:,.0f}".replace(",", " ")
        if valor < 0:
            eje_utilidad.text(
                valor - 1800,
                posicion,
                f"−{abs(valor) / 1000:.0f} mil",
                va="center",
                ha="right",
                fontsize=8,
                fontweight="bold",
                color="#1F2937",
            )
            continue
        if valor < 25000:
            eje_utilidad.text(
                valor + 1800,
                posicion,
                etiqueta,
                va="center",
                ha="left",
                fontsize=8,
                fontweight="bold",
                color="#1F2937",
            )
            continue
        eje_utilidad.text(
            valor / 2,
            posicion,
            etiqueta,
            va="center",
            ha="center",
            fontsize=9,
            fontweight="bold",
            color="white",
        )

    for eje in (eje_principal, eje_utilidad):
        for borde in ("top", "right", "left"):
            eje.spines[borde].set_visible(False)

    figura.suptitle("Escenarios mensuales de viabilidad de GymHub", x=0.03, ha="left", fontweight="bold")
    figura.tight_layout()
    figura.savefig(SALIDA, dpi=220, bbox_inches="tight", facecolor="white")


if __name__ == "__main__":
    main()
