# QA Manual Del MVP

## Objetivo
Recorrer el MVP completo por rol y confirmar navegación, permisos, datos reales y estados UI antes de cualquier entrega.

## Member
- `/login`: login exitoso con credenciales demo y redirección a `/dashboard/member`
- `/dashboard/member`: tarjetas visibles, sin placeholders, links operativos
- `/plans/my`: listado o estado vacío coherente
- `/plans/:id`: detalle cargado y consistente con el plan real
- `/plans/:id/today`: inicio de sesión, registro y finalización sin errores
- `/attendance/check-in`: check-in exitoso o bloqueo coherente por mora
- `/progress`: estado con datos o vacío explícito
- `/sessions`: historial visible y consistente
- `/billing`: pagos, estados y notas visibles
- `/nutrition`: perfil cargado o vacío útil
- `/ai-chat`: historial, envío y fallback visibles
- `/profile`: datos del usuario correctos

## Trainer O Staff
- `/login`: login exitoso con redirección a `/dashboard/trainer`
- `/dashboard/trainer`: métricas, quick links y tablas visibles
- `/members`: listado funcional, búsqueda y navegación a detalle
- `/members/:id`: perfil, activación y quick links operativos
- `/plans`: lista general y filtro por `?member=` desde detalle de miembro
- `/attendance`: lista general y filtro por `?member=` desde detalle de miembro
- `/alerts`: tabs, conteos y resolución de alertas
- `/billing`: lista general y filtro por `?member=` desde detalle de miembro
- `/nutrition`: datos visibles sin errores
- `/charts`: gráfica backend visible y datos de progreso si existen
- `/ai-chat`: comportamiento coherente con permisos actuales
- `/profile`: datos del usuario correctos

## Criterios Por Pantalla
- `loading`: muestra skeleton o spinner, no pantallas rotas
- `empty`: mensaje útil y específico del módulo
- `error`: mensaje visible o toast coherente
- permisos: rutas y acciones bloqueadas según rol
- navegación: links internos llevan al destino correcto
- datos: contratos reales del backend, no placeholders

## Cierre
- Ejecutar junto con [`docs/RELEASE_CHECKLIST.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/RELEASE_CHECKLIST.md)
- Registrar cualquier fallo como `bloqueante`, `degrada demo` o `deuda post-release`
