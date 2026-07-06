import os
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


DEMO_EMAIL_PATTERN = re.compile(
    r'^(trainer|member)(\d+)@gymhub\.com$',
    re.IGNORECASE,
)
PRIMARY_DEMO_EMAILS = {
    'trainer1@gymhub.com',
    'member1@gymhub.com',
}


class Command(BaseCommand):
    help = (
        'Restablece trainer1/member1 y elimina demos numeradas adicionales, '
        'sin tocar cuentas reales ni superusuarios.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Confirma el restablecimiento. Sin esta bandera solo muestra el dry-run.',
        )
        parser.add_argument(
            '--trainer-password',
            default=os.environ.get('DEMO_TRAINER_PASSWORD'),
            help='Password nuevo de trainer1. Alternativa: DEMO_TRAINER_PASSWORD.',
        )
        parser.add_argument(
            '--member-password',
            default=os.environ.get('DEMO_MEMBER_PASSWORD'),
            help='Password nuevo de member1. Alternativa: DEMO_MEMBER_PASSWORD.',
        )

    def handle(self, *args, **options):
        User = get_user_model()
        protected_primary = User.objects.filter(
            is_superuser=True,
            email__in=PRIMARY_DEMO_EMAILS,
        ).values_list('email', flat=True)
        if protected_primary:
            raise CommandError(
                'Un superusuario usa un correo demo principal; no se modificó nada: '
                + ', '.join(protected_primary)
            )
        candidates = [
            user
            for user in User.objects.filter(is_superuser=False).order_by('email')
            if DEMO_EMAIL_PATTERN.fullmatch(user.email or '')
        ]
        preserved_real_count = User.objects.filter(is_superuser=False).count() - len(candidates)
        superuser_count = User.objects.filter(is_superuser=True).count()

        self.stdout.write('Cuentas demo que se reemplazarán o eliminarán:')
        if candidates:
            for user in candidates:
                action = 'recrear' if user.email.lower() in PRIMARY_DEMO_EMAILS else 'eliminar'
                self.stdout.write(f'  - {user.email}: {action}')
        else:
            self.stdout.write('  - ninguna existente; se crearán trainer1 y member1')
        self.stdout.write(f'Cuentas reales preservadas: {preserved_real_count}')
        self.stdout.write(f'Superusuarios preservados: {superuser_count}')

        if not options['yes']:
            self.stdout.write(self.style.WARNING(
                'Dry-run: no se modificó ningún dato. Usa --yes para confirmar.'
            ))
            return

        trainer_password = options.get('trainer_password')
        member_password = options.get('member_password')
        if not trainer_password or not member_password:
            raise CommandError(
                'Para confirmar debes definir ambas contraseñas mediante argumentos '
                'o variables DEMO_TRAINER_PASSWORD/DEMO_MEMBER_PASSWORD.'
            )
        self._validate_password('trainer1', trainer_password)
        self._validate_password('member1', member_password)
        if trainer_password == member_password:
            raise CommandError('Las dos cuentas demo deben usar contraseñas diferentes.')

        candidate_ids = [user.id for user in candidates]
        with transaction.atomic():
            deleted_count = 0
            deleted_by_model = {}
            if candidate_ids:
                deleted_count, deleted_by_model = User.objects.filter(
                    id__in=candidate_ids,
                    is_superuser=False,
                ).delete()

            call_command(
                'seed_data',
                clear=False,
                trainer_password=trainer_password,
                member_password=member_password,
                stdout=self.stdout,
                stderr=self.stderr,
            )

            remaining_demo_emails = {
                email.lower()
                for email in User.objects.filter(is_superuser=False).values_list(
                    'email', flat=True
                )
                if DEMO_EMAIL_PATTERN.fullmatch(email or '')
            }
            if remaining_demo_emails != PRIMARY_DEMO_EMAILS:
                raise CommandError(
                    'El resultado demo no es el esperado: '
                    + ', '.join(sorted(remaining_demo_emails))
                )

            trainer = User.objects.get(email='trainer1@gymhub.com')
            member = User.objects.get(email='member1@gymhub.com')
            if not trainer.check_password(trainer_password):
                raise CommandError('No se pudo validar la contraseña nueva de trainer1.')
            if not member.check_password(member_password):
                raise CommandError('No se pudo validar la contraseña nueva de member1.')

        self.stdout.write(self.style.SUCCESS(
            'Demo restablecida: quedaron trainer1 y member1 como únicas cuentas demo.'
        ))
        self.stdout.write(f'Objetos eliminados por cascada: {deleted_count}')
        for model_name, count in sorted(deleted_by_model.items()):
            self.stdout.write(f'  {model_name}: {count}')

    @staticmethod
    def _validate_password(label, password):
        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError(
                f'La contraseña de {label} no cumple la política: '
                + ' '.join(exc.messages)
            ) from exc
