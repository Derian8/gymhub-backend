from django.core.management.base import BaseCommand

from billing.correos import procesar_correos


class Command(BaseCommand):
    help = 'Procesa hasta 10 correos pendientes de Resend respetando la cuota demo.'

    def handle(self, *args, **options):
        resultado = procesar_correos()
        self.stdout.write(f"Aceptados por Resend: {resultado['aceptados']}")
