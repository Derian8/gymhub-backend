#!/usr/bin/env python3
"""Extrae los dos Excel sin modificarlos y genera tablas y gráficas del informe.

Lee valores guardados, no ejecuta fórmulas de Excel. Comprueba conciliaciones
independientes antes de publicar las tablas. Solo requiere matplotlib.
"""

from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import math
import xml.etree.ElementTree as ET

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

BASE = Path(__file__).resolve().parent
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
FINANZAS = BASE / "modelo_negocios/Analisis_ gym.xlsx"
RUBRICA = BASE.parent / "evaluacion/plan_negocios.xlsx"

# En el orden exacto A28:A55 del archivo proporcionado, incluidos m y o.
RESPUESTAS = [
    ("Idea, antecedentes y definición del negocio", "Conexión de gestión administrativa y deportiva, acceso móvil y acompañamiento.", "La preferencia frente a competidores debe comprobarse en demostraciones."),
    ("Canvas y estudio técnico de operación", "Investigación, desarrollo, pruebas, incorporación y soporte con responsables y registros.", "La frecuencia y capacidad de soporte se contrastarán con uso real."),
    ("Inventario operativo", "Equipo físico, conectividad, infraestructura, trabajo y sus costos presupuestados.", "Falta completar el inventario y las cotizaciones; revisar si Workspace se contó dos veces."),
    ("Servicio ofrecido y módulos funcionales", "Miembros, membresías, pagos, asistencia, rutinas y progreso, con capturas del prototipo.", "Aislamiento multiempresa y personalización siguen como desarrollo posterior."),
    ("Alternativas actuales y decisión de compra", "Comparación de papel, hojas de cálculo, mensajería y plataformas; foco en tareas concretas.", "No se afirma exclusividad ni superioridad comprobada frente a todo competidor."),
    ("Arquitectura y conceptos financieros", "Se explican SaaS, roles, MRR, margen, liquidez, costos y recuperación.", "El equipo debe poder explicar estos conceptos durante la exposición."),
    ("Canvas y plan de promoción", "Contacto y demostración para venta; acceso web para entrega; mensajería para soporte.", "Falta probar qué canales consiguen contrataciones."),
    ("Cliente, usuario y mercado alcanzable", "Comprador y beneficiarios diferenciados; atributos, dispositivos y necesidades de la muestra.", "Solo cinco responsables y diez miembros; muestra no probabilística."),
    ("Competencia y decisión de compra", "Demostración, alcance explícito, precio y acompañamiento de incorporación.", "Falta conocer la respuesta de posibles compradores."),
    ("Calidad y diseño del piloto", "Seguimiento por tarea, duración, éxito, errores, incidentes y revisión semanal.", "El piloto permitirá medir las mejoras; sigue pendiente."),
    ("Calendario comercial", "Contacto inicial, demostración, seguimiento y soporte con recursos del presupuesto.", "El calendario es propuesto y requiere registro de ejecución."),
    ("Antecedentes y estudio de mercado", "Datos de encuesta y contexto documentado de digitalización; oportunidad de centralizar tareas.", "No existe censo local ni estimación representativa de demanda."),
    ("Promoción, distribución y permanencia", "Página, contenido demostrativo, contacto directo y distribución digital del servicio.", "El criterio o solicita lo mismo; ambos remiten a esta explicación."),
    ("Costos y proyección anual", "Se distinguen costos fijos, variables, trabajo, instalación, desarrollo e ingresos mensuales.", "Falta confirmar precios y completar los gastos pendientes."),
    ("Promoción, distribución y permanencia", "Acceso web, demostraciones y canales digitales de promoción y atención.", "Repite el criterio m de la rúbrica."),
    ("Comprador, usuario y mercado alcanzable", "Gimnasios con necesidad administrativa, conectividad y responsable de decisión.", "Diez prospectos y cinco altas son hipótesis, no mercado cuantificado."),
    ("Desarrollo del Canvas y apéndice visual", "Nueve módulos: segmentos, valor, canales, relaciones, ingresos, recursos, actividades, alianzas y costos; incluye a Pit Bull Gym como aliado para la validación inicial.", "La ejecución del piloto y la validación de tarifas siguen pendientes."),
    ("Análisis económico anual", "Tablas de ingresos, gastos, caja y balance, con explicación del margen y la recuperación.", "Resultados previstos antes de impuestos; falta comprobarlos durante la operación."),
    ("Financiamiento y permanencia", "Aporte propio y trabajo; comparación con reinversión, crédito y capital externo.", "Sin préstamo ni inversión externa confirmados; depende de disponibilidad del equipo."),
    ("Relaciones financieras y sensibilidad", "Relación entre clientes, ingresos y costos; cambios si baja el ingreso o sube el gasto.", "Revisar el trabajo sin pago y los impuestos antes de operar."),
    ("Forma jurídica y evidencia de formalización", "Trámites por consultar y pasos para registrar el negocio.", "Inscripciones y afiliaciones pendientes."),
    ("Alianzas y continuidad", "Tutor confirmado; Pit Bull Gym como aliado para la prueba inicial; proveedores diferenciados.", "La constancia escrita de la alianza y la ejecución de la prueba inicial siguen pendientes."),
    ("Orden del informe e índice", "Base institucional más definición, mercado, técnica, organización, inversión y evaluación anual.", "Verificar el PDF completo y su correspondencia con lineamientos."),
    ("Citas, notas de fuente y referencias", "Fuentes consultadas citadas en APA y cálculos propios identificados en tablas y figuras.", "La proyección financiera es elaboración propia; sus supuestos necesitan comprobación."),
    ("Portada y maquetación", "Carta, márgenes de 2,54 cm, cuerpo de 12 puntos, interlineado y numeración.", "Control visual de tablas, figuras y referencias en el PDF final."),
    ("Justificación y conclusión financiera", "Necesidad observada, prototipo y escenario con margen de 21,44 por ciento antes de impuestos.", "La viabilidad comercial está condicionada a piloto, capacidad y aceptación de precio."),
    ("Situación del mercado e industria", "Gestión dispersa y contexto de digitalización con fuentes y muestra identificadas.", "No se extrapola al total de establecimientos de Pérez Zeledón."),
    ("Problema, encuesta y propuesta de valor", "Dificultades de cobro, vigencia y seguimiento vinculadas con funciones concretas.", "El efecto de la solución requiere comparación de tareas durante el piloto."),
]


def escapar(texto):
    for origen, destino in [("&", r"\&"), ("%", r"\%"), ("_", r"\_"), ("#", r"\#")]:
        texto = texto.replace(origen, destino)
    return texto.replace("\t", " ").replace("\xa0", " ")


def generar_correspondencia(criterios):
    assert len(criterios) == len(RESPUESTAS) == 28
    latex = [r"\subsection{Correspondencia con los 28 indicadores del plan de negocios}",
             r"\label{ap:rubrica}",
             r"Esta tabla indica dónde se atiende cada criterio y qué falta comprobar. Conserva el orden de los 28 indicadores, incluidos los repetidos m y o. La calificación corresponde al jurado \parencite{rubrica_plan_negocios_2026}.",
             r"\begin{longtable}{p{4.0cm}p{5.6cm}p{4.2cm}}",
             r"\caption{Correspondencia del informe con la rúbrica suministrada}\\",
             r"\toprule Indicador de la rúbrica & Desarrollo en el informe & Aspecto pendiente \\",
             r"\midrule\endfirsthead",
             r"\toprule Indicador de la rúbrica & Desarrollo en el informe & Aspecto pendiente \\",
             r"\midrule\endhead"]
    markdown = ["# Análisis de los 28 indicadores del plan de negocios", "",
                "Actualizado: 23 de septiembre de 2026.", "",
                "Fuente rectora: `../evaluacion/plan_negocios.xlsx`, hoja `ExpoTEC-12 Doc escri plan nego `, A28:A55. Esta matriz sustituye la correspondencia anterior, cuyo orden no coincidía con el Excel suministrado. La escala es de 0 a 3, máximo 84 puntos; el archivo contiene marcas de 3 que no se atribuyen como calificación real de Pulso. Los indicadores m y o son duplicados en la fuente.", "",
                "La cobertura documental no equivale a cumplimiento acreditado. En particular, u requiere formalización verificable y v requiere respaldar documentalmente la alianza y concretar la prueba; j, r y t conservan validaciones pendientes.", "",
                "| Celda e indicador exacto | Ubicación y desarrollo | Evidencia pendiente o límite |", "|---|---|---|"]
    for criterio, (ubicacion, respuesta, limite) in zip(criterios, RESPUESTAS):
        titulo = " ".join(criterio['indicador'].split())
        latex.append(escapar(titulo) + " & " + escapar(ubicacion + ": " + respuesta) + " & " + escapar(limite) + r" \\")
        markdown.append(f"| {criterio['celda']}: {titulo} | {ubicacion}: {respuesta} | {limite} |")
    latex.extend([r"\bottomrule", r"\end{longtable}",
                  r"\textit{Nota}. La tabla permite revisar los 28 indicadores y las tareas pendientes antes de la entrega.", ""])
    (BASE/'secciones/13-correspondencia-rubrica.tex').write_text('\n'.join(latex),encoding='utf-8')
    (BASE/'PLAN_CUMPLIMIENTO_EXPOTEC12.md').write_text('\n'.join(markdown)+'\n',encoding='utf-8')


def leer_libro(ruta):
    hojas = {}
    with ZipFile(ruta) as archivo:
        textos = []
        if "xl/sharedStrings.xml" in archivo.namelist():
            textos = ["".join(t.itertext()) for t in ET.fromstring(
                archivo.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        relaciones = {r.attrib["Id"]: r.attrib["Target"] for r in ET.fromstring(
            archivo.read("xl/_rels/workbook.xml.rels"))}
        for hoja in ET.fromstring(archivo.read("xl/workbook.xml")).findall("s:sheets/s:sheet", NS):
            destino = relaciones[hoja.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
            destino = destino.lstrip("/") if destino.startswith("/") else "xl/" + destino
            celdas = {}
            for celda in ET.fromstring(archivo.read(destino)).findall(".//s:sheetData/s:row/s:c", NS):
                valor = celda.find("s:v", NS)
                tipo = celda.attrib.get("t")
                if tipo == "inlineStr":
                    contenido = "".join(celda.find("s:is", NS).itertext())
                elif valor is None:
                    continue
                elif tipo == "s":
                    contenido = textos[int(valor.text)]
                elif tipo == "str":
                    contenido = valor.text
                elif tipo == "e":
                    raise ValueError(f"Error Excel: {hoja.attrib['name']}!{celda.attrib['r']}")
                else:
                    contenido = float(valor.text)
                celdas[celda.attrib["r"]] = contenido
            hojas[hoja.attrib["name"]] = celdas
    return hojas


def verificar(valor, esperado, contexto):
    if not math.isclose(valor, esperado, abs_tol=0.02):
        raise ValueError(f"No concilia {contexto}: {valor} != {esperado}")


def monto(valor):
    return f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", r"\,")


def tabla(nombre, titulo, encabezados, filas, nota):
    columnas = "l" + "r" * (len(encabezados) - 1)
    texto = [r"\begin{longtable}{" + columnas + "}",
             r"\caption{" + titulo + r"}\\", r"\toprule",
             " & ".join(encabezados) + r" \\", r"\midrule", r"\endfirsthead",
             r"\toprule", " & ".join(encabezados) + r" \\", r"\midrule", r"\endhead"]
    texto.extend(" & ".join(fila) + r" \\" for fila in filas)
    texto.extend([r"\bottomrule", r"\end{longtable}",
                  r"{\small\textit{Nota}. Elaboración propia a partir del escenario financiero preliminar. " + nota + r"}", ""])
    if len(filas) <= 7:
        texto.insert(0, r"\Needspace{10\baselineskip}")
    (BASE / "secciones" / nombre).write_text("\n".join(texto), encoding="utf-8")


def guardar(figura, nombre):
    figura.tight_layout()
    figura.savefig(BASE / "imagenes" / nombre, dpi=200, bbox_inches="tight")
    plt.close(figura)


def main():
    libros = leer_libro(FINANZAS)
    rubrica = next(iter(leer_libro(RUBRICA).values()))
    criterios = [{"celda": f"A{i}", "indicador": rubrica[f"A{i}"]} for i in range(28, 56)]
    generar_correspondencia(criterios)
    ventas = libros["Clientes e Ingresos"]
    egresos = libros["Egresos e Inversión"]
    estados = libros["Estados Financieros"]
    equilibrio = libros["Punto de Equilibrio"]
    meses = list(range(1, 13))
    ingresos = [ventas[f"H{i}"] for i in range(6, 18)]
    activos = [ventas[f"F{i}"] for i in range(6, 18)]
    costos = [egresos[f"F{i}"] for i in range(35, 47)]
    salidas = [estados[f"{chr(67+i)}15"] for i in range(12)]
    caja = [estados[f"{chr(67+i)}17"] for i in range(12)]
    resultado = [ingresos[i] - costos[i] - (egresos['D12'] if i == 0 else 0) for i in range(12)]
    acumulado = [sum(resultado[:i+1]) for i in range(12)]
    for i in range(12):
        fila = i + 6
        verificar(activos[i], ventas[f"C{fila}"] + ventas[f"D{fila}"] - ventas[f"E{fila}"], f"clientes mes {i+1}")
        verificar(ingresos[i], 15000 + (activos[i]-1)*25000, f"ingreso mes {i+1}")
        verificar(caja[i], (caja[i-1] if i else 40000) + ingresos[i] - salidas[i], f"caja mes {i+1}")
    verificar(sum(ingresos), estados['C22'], "ingresos anuales")
    verificar(sum(costos), egresos['F47'], "egresos anuales")
    verificar(sum(resultado), estados['C28'], "resultado antes de impuestos")
    verificar(estados['C41'], estados['F41'], "balance")
    verificar(caja[-1]-40000-sum(resultado), estados['F38']-40000, "trabajo aportado")
    for fila in range(18, 33):
        verificar(equilibrio[f'G{fila}'], equilibrio[f'C{fila}']-equilibrio[f'F{fila}'], f"equilibrio fila {fila}")
    tabla("datos-excel-mensuales.tex", "Cartera e ingresos mensuales proyectados", ["Mes", "Altas", "Bajas", "Activos", "Ingreso CRC"],
          [[str(i+1),str(int(ventas[f'D{i+6}'])),str(int(ventas[f'E{i+6}'])),str(int(activos[i])),monto(ingresos[i])] for i in range(12)],
          "Se cobra el mes completo desde el alta y se mantiene un cliente Starter.")
    tabla("datos-excel-caja.tex", "Flujo mensual y resultado económico proyectados", ["Mes", "Pagos CRC", "Caja final CRC", "Resultado CRC"],
          [[str(i+1),monto(salidas[i]),monto(caja[i]),monto(resultado[i])] for i in range(12)],
          "La caja incluye CRC 40 000 de aporte inicial. El resultado del mes 1 incluye todo el costo del desarrollo.")
    tabla("datos-excel-resultados.tex", "Estado de resultados anual proyectado", ["Concepto", "CRC", r"\% de ingresos"],
          [[nombre,monto(estados[f'C{fila}']),monto(estados[f'D{fila}']*100)] for nombre,fila in [("Ingresos",22),("Costos directos",23),("Utilidad bruta",24),("Gastos fijos",25),("Resultado antes del desarrollo",26),("Desarrollo del año",27),("Resultado antes de impuestos",28)]],
          "Se presenta el resultado antes de impuestos porque falta confirmar las obligaciones del negocio.")
    tabla("datos-excel-balance.tex", "Balance económico proyectado al cierre", ["Cuenta", "CRC"],
          [["Efectivo y activos totales",monto(estados['C41'])],["Deuda financiera",monto(estados['F35'])],["Aportes de efectivo y trabajo",monto(estados['F38'])],["Resultado económico del escenario",monto(estados['F39'])],["Patrimonio total",monto(estados['F40'])]],
          "El trabajo se aporta sin pago y sin registrarlo como deuda. El tratamiento contable definitivo se revisará al formalizar el negocio.")
    plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False})
    formato = FuncFormatter(lambda v, p: f"{v:,.0f}".replace(",", " "))
    fig, ejes = plt.subplots(2, 1, figsize=(9, 7), sharex=True)
    ejes[0].plot(meses, activos, 'o-', color='#b91c1c'); ejes[0].set_ylabel('Gimnasios activos'); ejes[0].set_ylim(0,16)
    ejes[1].bar(meses, [v/1000 for v in ingresos], color='#334155'); ejes[1].set_ylabel('Ingreso mensual (miles CRC)')
    for eje in ejes: eje.grid(axis='y', alpha=.2); eje.set_xticks(meses)
    ejes[1].set_xlabel('Mes del escenario'); fig.suptitle('Pulso: cartera e ingreso proyectados')
    guardar(fig, 'excel_cartera_ingresos.png')
    fig, eje = plt.subplots(figsize=(9, 5.5))
    eje.plot(meses, [v/1000 for v in caja], 'o-', label='Caja acumulada con aporte inicial', color='#0369a1')
    eje.plot(meses, [v/1000 for v in acumulado], 's--', label='Resultado económico acumulado', color='#b91c1c')
    eje.axhline(0,color='black',linewidth=.8); eje.set_xticks(meses); eje.set_xlabel('Mes del escenario'); eje.set_ylabel('Miles de CRC'); eje.legend(); eje.grid(alpha=.2)
    eje.set_title('Liquidez y recuperación económica: conceptos distintos')
    guardar(fig, 'excel_caja_resultado.png')
    fig, eje = plt.subplots(figsize=(9,5.5))
    eje.plot(meses, [v/1000 for v in ingresos], 'o-', label='Ingresos', color='#166534')
    eje.plot(meses, [v/1000 for v in costos], 's--', label='Costos económicos sin desarrollo',color='#b91c1c')
    eje.plot(meses, [v/1000 for v in salidas], '^:', label='Pagos efectivos',color='#334155')
    eje.set_xticks(meses); eje.set_xlabel('Mes del escenario'); eje.set_ylabel('Miles de CRC'); eje.legend(); eje.grid(alpha=.2); eje.set_title('Ingresos, costos y pagos durante el primer año')
    guardar(fig, 'excel_ingresos_egresos.png')
    fig, eje = plt.subplots(figsize=(9,5.5))
    cantidades=[equilibrio[f'B{i}'] for i in range(18,33)]
    eje.plot(cantidades,[equilibrio[f'C{i}']/1000 for i in range(18,33)],'o-',label='Ingresos',color='#166534')
    eje.plot(cantidades,[equilibrio[f'F{i}']/1000 for i in range(18,33)],'s--',label='Costos operativos',color='#b91c1c')
    eje.axvline(6,color='#334155',linestyle=':',label='Primer entero con resultado positivo: 6')
    eje.set_xticks(cantidades); eje.set_xlabel('Gimnasios activos: 1 Starter y los demás Pro Gym'); eje.set_ylabel('Miles de CRC'); eje.legend(); eje.grid(alpha=.2); eje.set_title('Equilibrio operativo: escenarios de 1 a 15 gimnasios')
    guardar(fig,'excel_equilibrio_completo.png')
    auditoria = {"metodo": "Valores guardados en Excel; conciliaciones independientes, sin recalcular todas sus fórmulas", "archivos": {str(p.relative_to(BASE.parent)): hashlib.sha256(p.read_bytes()).hexdigest() for p in (FINANZAS,RUBRICA)}, "criterios": criterios, "ingresos_anuales":sum(ingresos), "resultado_antes_impuestos":sum(resultado), "caja_final":caja[-1], "recuperacion_economica_mes":next(i+1 for i,v in enumerate(acumulado) if v>=0), "resultado_acumulado":acumulado, "verificaciones": "Conciliaciones aprobadas"}
    (BASE/'auditoria_integracion_excel.json').write_text(json.dumps(auditoria,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in auditoria.items() if k not in ('criterios','archivos')}, ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
