"""Reduce el paquete de Vercel retirando pruebas de dependencias gráficas."""

import importlib.util
from pathlib import Path
import shutil


def preparar():
    eliminados = 0
    for nombre in ('numpy', 'matplotlib'):
        especificacion = importlib.util.find_spec(nombre)
        if especificacion is None or not especificacion.origin:
            raise RuntimeError(f'Dependencia ausente: {nombre}')
        raiz = Path(especificacion.origin).resolve().parent
        if raiz.name != nombre or 'site-packages' not in raiz.parts:
            raise RuntimeError('Ruta de dependencia inesperada.')
        for directorio in list(raiz.rglob('tests')):
            if directorio.is_dir() and directorio.resolve().is_relative_to(raiz):
                shutil.rmtree(directorio)
                eliminados += 1
        if nombre == 'matplotlib':
            ejemplos = raiz / 'mpl-data' / 'sample_data'
            if ejemplos.is_dir():
                shutil.rmtree(ejemplos)
                eliminados += 1
    print(f'Paquete preparado: {eliminados} directorios de pruebas retirados.')


if __name__ == '__main__':
    preparar()
