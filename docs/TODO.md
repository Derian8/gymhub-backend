# TODO Priorizado Y Continuidad

Este documento es el punto de entrada para retomar el proyecto en una conversación nueva. La funcionalidad activa de esta etapa es **administración comercial, control de accesos y entrega protegida de rutinas**.

## Estado Al 14 De Agosto De 2026

- [x] La migración `billing.0012_seguimiento_cobro` está aplicada en Supabase.
- [x] El recorrido transaccional de API se ejecutó contra Supabase y validó alta, pago, login temporal, cambio de contraseña, entrada, rutina, reporte, CSV de ingresos y comprobante PDF.
- [x] Los datos creados por ese recorrido se revirtieron; no quedaron cuentas ni cobros temporales.
- [x] Suite backend: `238 passed`.
- [x] Suite frontend: `108 passed`.
- [x] Compilación de producción del frontend completada correctamente.
- [x] Experiencia guiada de rutina para cliente implementada y desplegada: descripción inicial, un ejercicio por pantalla, acciones `Realizado` y `Omitir`, guardado inmediato y cierre automático.
- [x] El cierre anticipado de rutina confirma la acción y registra los ejercicios pendientes como `omitido`; el avance se conserva al recargar.
- [x] Migración `progress.0005_exerciselog_estado` aplicada en Supabase y servicios públicos de Vercel verificados.
- [ ] Ejecutar el recorrido visual en navegador contra el dominio final. Docker Desktop no respondió desde WSL durante la última validación.
- [ ] Confirmar que el código actual del worktree, y no solo la migración, está desplegado antes de probar producción.
- [ ] Revisar `git status` antes de editar. Hay cambios funcionales de esta etapa y documentos de ExpoTÉCNICA sin consolidar; no descartarlos ni sobrescribirlos.

## Punto Exacto Para Reanudar

1. Confirmar el alcance de “dos planes por cliente”. Se interpretó como **dos planes de entrenamiento simultáneos**, no como dos membresías comerciales.
2. Recuperar Docker Desktop/WSL o levantar frontend y backend como procesos locales.
3. Confirmar qué versión está desplegada y publicar los cambios actuales solo si el usuario autoriza el despliegue.
4. Ejecutar el E2E visual del demo con los tres roles y conservar evidencia de resultados.
5. Si el demo queda aprobado, comenzar el requerimiento de dos planes descrito abajo.

## Recorrido Visual Pendiente Del Demo

- [ ] Administrador inicia sesión y ve únicamente el menú comercial pertinente.
- [ ] Administrador registra un cliente con membresía y primer pago en una sola operación.
- [ ] El sistema muestra una sola vez la contraseña temporal y permite descargar el comprobante.
- [ ] El ingreso aparece en el reporte administrativo y en la exportación CSV/PDF.
- [ ] Entrenador ve al cliente y su estado operativo, pero no montos, pagos ni reportes financieros.
- [ ] Entrenador crea o publica la rutina del cliente habilitado.
- [ ] Cliente inicia sesión con la clave temporal y debe cambiarla.
- [ ] Cliente pulsa `Ver rutina`; el sistema valida vigencia, registra una única entrada diaria y muestra el plan activo.
- [ ] Cliente vencido dentro de gracia puede entrar; cliente fuera de gracia queda bloqueado.
- [ ] Administrador puede autorizar una entrada física excepcional, sin desbloquear la rutina.
- [ ] Repetir los casos críticos en vista móvil y comprobar estados de carga, vacío y error.

## Requerimiento Pendiente: Dos Planes Por Cliente

Antes de implementarlo, confirmar si se trata de planes de entrenamiento. Si la respuesta es sí, usar estos criterios iniciales:

- [ ] Permitir como máximo dos planes de entrenamiento simultáneos por cliente.
- [ ] Identificar explícitamente un plan `principal` y otro `secundario`.
- [ ] Evitar que ambos ocupen el mismo tipo/posición y garantizar un único plan principal.
- [ ] Definir si ambos deben pertenecer al mismo entrenador y qué ocurre al reasignar al cliente.
- [ ] Definir si el cliente puede cambiar de plan o si la selección la controla el entrenador.
- [ ] Mostrar el principal de forma predeterminada en `Ver rutina` y permitir acceder al secundario según la regla aprobada.
- [ ] Definir cómo se reemplaza, finaliza, archiva o programa cada plan sin perder historial.
- [ ] Agregar migración y restricciones de base de datos que impidan más de dos planes vigentes.
- [ ] Actualizar API, tipos, hooks y pantallas de entrenador y cliente.
- [ ] Cubrir permisos, conflictos, selección, publicación, archivo y acceso del cliente con pruebas backend y frontend.
- [ ] Mantener este cambio separado de las membresías y pagos, salvo que el usuario confirme otro alcance.

## Completado En Esta Etapa

- Alta atómica de cliente, membresía y primer pago.
- Membresía de catálogo o personalizada, con vigencia desde el pago.
- Activación inmediata del acceso, contraseña temporal y comprobante interno.
- Auditoría del alta comercial y protección contra duplicados por correo.
- Pagos confirmados expuestos como registros de solo lectura.
- Roles separados: administrador comercial y entrenador técnico sin visibilidad financiera.
- Entrada del cliente desde `Ver rutina`, validando membresía y período de gracia.
- Excepción administrativa de acceso físico, auditable y sin desbloquear rutinas.
- Bandeja de seguimiento de cobros y reportes administrativos en pantalla, PDF y CSV.
- Ejecución de rutina simplificada para clientes, con estados persistentes por ejercicio (`realizado` u `omitido`); el instructor conserva su registro técnico detallado.

## P0 — Antes De Producción Formal

- [ ] Validar en producción la ejecución diaria ya configurada en Vercel y su `CRON_SECRET`; Celery/Beat continúa como alternativa en despliegues con workers.
- [ ] Validar migraciones contra el esquema real de Supabase antes de cada despliegue.
- [ ] Rotar los secretos de Supabase y Vercel compartidos durante la preparación.
- [ ] Ejecutar en el dominio final el E2E visual de los tres roles y validar clientes al día, por vencer y bloqueados.
- [ ] Confirmar que los reportes concilian con los pagos reales del período seleccionado.

## P1 — Cierre Comercial

- [ ] Implementar el requerimiento confirmado de dos planes por cliente.
- [ ] Implementar reversión de pagos con registro separado, motivo, responsable y vínculo al pago original.
- [ ] Añadir conciliación bancaria; los exportes actuales son de control interno.
- [ ] Incorporar numeración correlativa por gimnasio y estado de anulación en comprobantes.
- [ ] Mover fotos, códigos QR y archivos generados a almacenamiento persistente.

## P2 — Simplificación Y Mantenimiento

- [ ] Retirar gradualmente `/api/member-subscriptions/` y conservar `/api/member-memberships/` como interfaz comercial principal.
- [ ] Resolver la inconsistencia de `card`: soportarla de extremo a extremo o retirarla de métodos configurables.
- [ ] Extraer lógica de negocio restante desde vistas hacia servicios y casos de uso.
- [ ] Medir cobertura y fijar umbrales mínimos por módulo.
- [ ] Normalizar nombres nuevos en español sin romper contratos externos existentes.

## Comandos De Revalidación

Ejecutar desde la raíz del repositorio, sin imprimir variables ni secretos:

```bash
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend ./run_tests.sh
npm --prefix frontend test -- --run
npm --prefix frontend run build
./gym-smoke
```

Si Docker Desktop continúa sin integración WSL, se puede usar el entorno `.venv` y levantar los servicios locales, pero el cierre del demo requiere repetir después el E2E visual en el dominio final.

## Fuera Del Alcance Actual

- Pasarela de pagos o cobro automático.
- Facturación electrónica.
- Nuevas funciones de clases, nutrición, IA, wearables o notificaciones en tiempo real.
- Calendario, analítica técnica avanzada y alertas genéricas fuera del circuito comercial.
