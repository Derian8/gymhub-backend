from django.db import migrations


def vincular_plantillas_historicas(apps, schema_editor):
    Plan = apps.get_model('plans', 'TrainingPlan')
    Plantilla = apps.get_model('plans', 'PlantillaEntrenamiento')

    plantillas = list(Plantilla.objects.prefetch_related('dias__ejercicios'))
    for plan in Plan.objects.filter(plantilla_origen__isnull=True).select_related(
        'member__user',
    ).prefetch_related('workout_days__exercises').iterator(chunk_size=100):
        nombres_cliente = {
            plan.member.user.first_name,
            plan.member.user.first_name or plan.member.user.email,
        }
        candidatas = [
            plantilla for plantilla in plantillas
            if plan.name in {
                f'{plantilla.nombre} — {nombre_cliente}'
                for nombre_cliente in nombres_cliente
            }
            and plan.goal == plantilla.objetivo
            and plan.modo_ejecucion == plantilla.modo_ejecucion
        ]
        coincidencias = []
        dias_plan = sorted(plan.workout_days.all(), key=lambda dia: (dia.order, dia.id))
        for plantilla in candidatas:
            dias_plantilla = sorted(plantilla.dias.all(), key=lambda dia: (dia.orden, dia.id))
            if len(dias_plan) != len(dias_plantilla):
                continue
            if all(
                dia_plan.name == dia_plantilla.nombre
                and dia_plan.day_label == dia_plantilla.etiqueta_dia
                and [ejercicio.name for ejercicio in sorted(
                    dia_plan.exercises.all(), key=lambda ejercicio: (ejercicio.order, ejercicio.id),
                )] == [ejercicio.nombre for ejercicio in sorted(
                    dia_plantilla.ejercicios.all(), key=lambda ejercicio: (ejercicio.orden, ejercicio.id),
                )]
                for dia_plan, dia_plantilla in zip(dias_plan, dias_plantilla)
            ):
                coincidencias.append(plantilla)
        if len(coincidencias) == 1:
            Plan.objects.filter(pk=plan.pk).update(plantilla_origen_id=coincidencias[0].pk)


class Migration(migrations.Migration):
    dependencies = [('plans', '0019_origen_y_copia_catalogo')]

    operations = [
        migrations.RunPython(vincular_plantillas_historicas, migrations.RunPython.noop),
    ]
