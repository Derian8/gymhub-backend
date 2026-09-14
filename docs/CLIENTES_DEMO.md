# Dos clientes demo completos

`python manage.py completar_clientes_demo` muestra las cuentas que conservará y
eliminará sin modificar datos. Reconoce únicamente clientes con correos
`cliente.demoNN@gymhub.com` o `memberN@gymhub.com`, excluyendo cuentas staff y
superusuarios. Conserva los dos primeros por número, excluyendo a
`cliente.demo03@gymhub.com` de la selección.

Para aplicar sobre la base configurada:

```sh
python manage.py completar_clientes_demo --yes --respaldo /ruta/privada/respaldo-clientes.json
```

El archivo debe ser nuevo. Se genera con permisos 0600 y contiene una exportación
completa previa, incluidos datos personales y credenciales cifradas de usuarios;
no debe versionarse ni compartirse. Guardarlo en almacenamiento privado duradero.
En WSL, usar el sistema de archivos de Linux: algunos montajes de Windows no
respetan permisos 0600 y el comando rechazará esas rutas antes de exportar datos.
Ante un fallo, la transacción revierte todos los cambios de base de datos.

Los dos clientes conservan identidad y contraseña. Se completan perfiles con
datos ficticios, planes activos de ocho semanas, tres rutinas de cuatro ejercicios,
guías nutricionales, progreso, sesiones y membresías mensuales pagadas mediante
registros explícitamente simulados. No se realizan cobros ni envíos de mensajes.
La membresía demo no genera cobros futuros automáticamente. Los planes activos
anteriores se archivan y las membresías anteriores se cancelan conservando su
historial. Las cuentas de administración, instructores y clientes reales se preservan.

El comando puede repetirse sin duplicar sus ejemplos. No ejecutar después
`restablecer_demo`, `prune_demo_users` o `seed_data --clear`: son herramientas
independientes con otro alcance que pueden reemplazar estos datos.

Para recuperar el estado previo, probar primero el respaldo con `loaddata` en una
base aislada con las mismas migraciones. Restaurar producción requiere detener
escrituras y eliminar los registros creados después del respaldo antes de cargarlo;
`loaddata` por sí solo no elimina registros nuevos. No restaurar todo el respaldo
sobre una base con actividad posterior sin reconciliar esos cambios.

Pruebas del comando: `pytest tests/test_completar_clientes_demo.py --nomigrations`.
Se usa el esquema de los modelos porque las migraciones locales actuales no
incluyen la tabla `configuracion_sistema`; la tabla sí existe en producción.
