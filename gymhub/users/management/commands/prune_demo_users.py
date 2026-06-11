"""
Elimina usuarios demo sobrantes sin tocar trainer1, member1, superusuarios
ni usuarios reales fuera del patron controlado.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Elimina trainer2 y member2-member20. Por defecto solo muestra candidatos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Confirma la eliminacion de los usuarios demo sobrantes.',
        )

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        demo_emails = ['trainer2@gymhub.com'] + [
            f'member{i}@gymhub.com' for i in range(2, 21)
        ]
        queryset = User.objects.filter(
            email__in=demo_emails,
            is_superuser=False,
        ).order_by('email')
        candidates = list(queryset.values_list('email', flat=True))

        if not candidates:
            self.stdout.write(self.style.SUCCESS('No hay usuarios demo sobrantes para eliminar.'))
            return

        self.stdout.write('Usuarios demo sobrantes detectados:')
        for email in candidates:
            self.stdout.write(f'  - {email}')

        if not options['yes']:
            self.stdout.write(
                self.style.WARNING('Dry-run: ejecuta prune_demo_users --yes para eliminar estos usuarios.')
            )
            return

        with transaction.atomic():
            deleted_count, deleted_by_model = queryset.delete()

        self.stdout.write(self.style.SUCCESS(f'Usuarios demo eliminados: {len(candidates)}'))
        self.stdout.write(f'Objetos relacionados eliminados por cascada: {deleted_count}')
        for model_name, count in sorted(deleted_by_model.items()):
            self.stdout.write(f'  {model_name}: {count}')
