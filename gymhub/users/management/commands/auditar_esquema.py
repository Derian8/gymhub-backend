from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = 'Verifica que migraciones, tablas y columnas coincidan con los modelos.'

    def handle(self, *args, **options):
        executor = MigrationExecutor(connection)
        pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
        if pending:
            names = ', '.join(f'{migration.app_label}.{migration.name}' for migration, _ in pending)
            raise CommandError(f'Hay migraciones pendientes: {names}')

        models = [
            model for model in apps.get_models()
            if model._meta.managed and not model._meta.proxy
        ]
        actual_tables = set(connection.introspection.table_names())
        missing_tables = sorted(
            model._meta.db_table
            for model in models
            if model._meta.db_table not in actual_tables
        )
        if missing_tables:
            raise CommandError(f'Faltan tablas: {", ".join(missing_tables)}')

        missing_columns = []
        with connection.cursor() as cursor:
            for model in models:
                table = model._meta.db_table
                description = connection.introspection.get_table_description(cursor, table)
                actual_columns = {column.name for column in description}
                for field in model._meta.local_fields:
                    if field.column not in actual_columns:
                        missing_columns.append(f'{table}.{field.column}')

        if missing_columns:
            raise CommandError(f'Faltan columnas: {", ".join(sorted(missing_columns))}')

        self.stdout.write(self.style.SUCCESS(
            f'Esquema consistente: {len(models)} modelos y {len(actual_tables)} tablas.'
        ))
