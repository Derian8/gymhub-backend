import os
from django.core.wsgi import get_wsgi_application
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gymhub.settings')
application = get_wsgi_application()

# Prepara conexiones en segundo plano antes de recibir la primera peticion.
pool_conexiones = getattr(connection, 'pool', None)
if pool_conexiones is not None and not os.environ.get('VERCEL'):
    pool_conexiones.open()

app = application
