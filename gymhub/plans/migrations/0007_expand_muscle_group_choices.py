from django.db import migrations, models


MUSCLE_GROUP_CHOICES = [
    ("chest", "Chest"),
    ("back", "Back"),
    ("lats", "Lats"),
    ("shoulders", "Shoulders"),
    ("traps", "Traps"),
    ("biceps", "Biceps"),
    ("triceps", "Triceps"),
    ("forearms", "Forearms"),
    ("legs", "Legs"),
    ("quadriceps", "Quadriceps"),
    ("hamstrings", "Hamstrings"),
    ("glutes", "Glutes"),
    ("calves", "Calves"),
    ("adductors", "Adductors"),
    ("abductors", "Abductors"),
    ("hip_flexors", "Hip Flexors"),
    ("core", "Core"),
    ("abs", "Abs"),
    ("obliques", "Obliques"),
    ("lower_back", "Lower Back"),
    ("full_body", "Full Body"),
    ("cardio", "Cardio"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("plans", "0006_trainingplan_status_level_notes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="exercise",
            name="muscle_group",
            field=models.CharField(choices=MUSCLE_GROUP_CHOICES, max_length=20),
        ),
        migrations.AlterField(
            model_name="plantillaejercicio",
            name="grupo_muscular",
            field=models.CharField(choices=MUSCLE_GROUP_CHOICES, max_length=20),
        ),
    ]
