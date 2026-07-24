#!/usr/bin/env python3
"""Genera figuras anonimizadas a partir de la exportación de Google Forms."""

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

import matplotlib.pyplot as plt


BASE = Path(__file__).resolve().parent
ENTRADA = BASE / "resultado_encuesta.csv"
SALIDA = BASE / "imagenes"

COLOR_PRINCIPAL = "#166534"
COLOR_SECUNDARIO = "#2563EB"
COLOR_ACENTO = "#D97706"
COLOR_NEUTRO = "#64748B"


def buscar_columna(encabezados: list[str], texto: str) -> str:
    for encabezado in encabezados:
        if (
            texto in encabezado
            and "[Puntuación]" not in encabezado
            and "[Comentarios]" not in encabezado
        ):
            return encabezado
    raise KeyError(f"No se encontró la columna que contiene: {texto}")


def separar(valor: str) -> list[str]:
    return [elemento.strip() for elemento in valor.split(";") if elemento.strip()]


def contar_selecciones(filas: list[dict[str, str]], columna: str) -> Counter[str]:
    conteo: Counter[str] = Counter()
    for fila in filas:
        conteo.update(separar(fila[columna]))
    return conteo


def preparar_ejes(ax: plt.Axes, titulo: str, maximo: int) -> None:
    ax.set_title(titulo, loc="left", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlim(0, maximo)
    ax.set_xlabel("Cantidad de respuestas")
    ax.grid(axis="x", color="#E2E8F0", linewidth=0.8)
    ax.set_axisbelow(True)
    for borde in ("top", "right", "left"):
        ax.spines[borde].set_visible(False)


def barras_horizontales(
    nombre: str,
    titulo: str,
    etiquetas: list[str],
    valores: list[int],
    maximo: int,
    colores: list[str] | None = None,
) -> None:
    fig, ax = plt.subplots(figsize=(9, 4.8))
    posiciones = list(range(len(etiquetas)))
    ax.barh(
        posiciones,
        valores,
        color=colores or [COLOR_PRINCIPAL] * len(etiquetas),
        height=0.62,
    )
    ax.set_yticks(posiciones, etiquetas)
    ax.invert_yaxis()
    preparar_ejes(ax, titulo, maximo)
    for posicion, valor in zip(posiciones, valores, strict=True):
        ax.text(valor + 0.08, posicion, str(valor), va="center", fontweight="bold")
    fig.tight_layout()
    fig.savefig(SALIDA / nombre, dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def main() -> None:
    SALIDA.mkdir(exist_ok=True)
    with ENTRADA.open(newline="", encoding="utf-8-sig") as archivo:
        filas = list(csv.DictReader(archivo))

    encabezados = list(filas[0])
    consentimiento = buscar_columna(encabezados, "acepta participar voluntariamente")
    rol = buscar_columna(encabezados, "¿Desde cuál rol responde?")
    filas = [fila for fila in filas if fila[consentimiento].startswith("Sí")]

    responsables = [
        fila
        for fila in filas
        if fila[rol]
        in {
            "Dueño o administrador de gimnasio",
            "Entrenador con responsabilidades administrativas",
        }
    ]
    miembros = [fila for fila in filas if fila[rol] == "Miembro o cliente de un gimnasio"]

    roles = Counter(fila[rol] for fila in filas)
    barras_horizontales(
        "encuesta_composicion_muestra.png",
        "Composición de la muestra (n = 15)",
        ["Miembros", "Dueños o administradores", "Entrenadores administrativos"],
        [
            roles["Miembro o cliente de un gimnasio"],
            roles["Dueño o administrador de gimnasio"],
            roles["Entrenador con responsabilidades administrativas"],
        ],
        11,
        [COLOR_SECUNDARIO, COLOR_PRINCIPAL, COLOR_ACENTO],
    )

    tareas = contar_selecciones(
        responsables,
        buscar_columna(encabezados, "¿Cuales tareas le generan"),
    )
    apoyo = contar_selecciones(
        responsables,
        buscar_columna(encabezados, "¿Qué apoyo sería más importante"),
    )
    privacidad = Counter(
        fila[buscar_columna(encabezados, "¿Qué tan importante considera")]
        for fila in responsables
    )
    piloto = Counter(
        fila[buscar_columna(encabezados, "¿Estarías dispuesto")] for fila in responsables
    )
    barras_horizontales(
        "encuesta_resultados_responsables.png",
        "Hallazgos entre responsables (n = 5)",
        [
            "Cobros y pagos como dificultad",
            "Personalización como apoyo",
            "Privacidad muy importante",
            "Aceptación directa del piloto",
        ],
        [
            tareas["Cobro y pagos pendientes"],
            apoyo["Personalización"],
            privacidad["Muy importante"],
            piloto["Sí"],
        ],
        5.6,
        [COLOR_ACENTO, COLOR_SECUNDARIO, COLOR_PRINCIPAL, COLOR_NEUTRO],
    )

    informacion = contar_selecciones(
        miembros,
        buscar_columna(encabezados, "¿Qué información puede consultar"),
    )
    dispositivo = Counter(
        fila[buscar_columna(encabezados, "¿Desde qué dispositivo utilizarías")]
        for fila in miembros
    )
    utilidad = Counter(
        fila[buscar_columna(encabezados, "¿Qué tan útil sería")] for fila in miembros
    )
    situaciones = contar_selecciones(
        miembros,
        buscar_columna(encabezados, "¿Qué situaciones le generan"),
    )
    barras_horizontales(
        "encuesta_resultados_miembros.png",
        "Hallazgos entre miembros (n = 10)",
        [
            "Sin información digital actual",
            "Uso principal desde celular",
            "Utilidad máxima (5 de 5)",
            "Recordar vencimientos",
            "Seguimiento del progreso",
        ],
        [
            informacion["Ninguna"],
            dispositivo["Celular"],
            utilidad["5"],
            situaciones["Recordar vencimientos"],
            situaciones["Progreso"],
        ],
        11,
        [
            COLOR_ACENTO,
            COLOR_SECUNDARIO,
            COLOR_PRINCIPAL,
            COLOR_NEUTRO,
            COLOR_NEUTRO,
        ],
    )

    precio = Counter(
        fila[buscar_columna(encabezados, "¿qué rango mensual")] for fila in responsables
    )
    barras_horizontales(
        "encuesta_disposicion_pago.png",
        "Respuesta sobre precio mensual (n = 5 responsables)",
        ["Requiere demostración", "CRC 7 500–15 000"],
        [
            precio["Necesito una demostación antes de responder"],
            precio["7.500 -15.000"],
        ],
        5.6,
        [COLOR_ACENTO, COLOR_PRINCIPAL],
    )


if __name__ == "__main__":
    main()
