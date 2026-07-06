from django.db import migrations, models
from django.utils import timezone


def migrate_attendance_dates(apps, schema_editor):
    Attendance = apps.get_model('attendance', 'Attendance')
    seen = set()
    for attendance in Attendance.objects.order_by('check_in_time', 'id'):
        local_date = timezone.localtime(attendance.check_in_time).date()
        key = (attendance.member_id, local_date)
        if key in seen:
            attendance.delete()
            continue
        seen.add(key)
        attendance.attendance_date = local_date
        attendance.save(update_fields=['attendance_date'])


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('attendance', '0003_attendance_attendance__member__1a4486_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendance', name='attendance_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendance', name='check_out_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(migrate_attendance_dates, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name='attendance', name='attendance_date',
                    field=models.DateField(default=timezone.localdate),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name='attendance',
            constraint=models.UniqueConstraint(
                fields=('member', 'attendance_date'),
                name='attendance_unique_member_day',
            ),
        ),
    ]
