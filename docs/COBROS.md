# Cobro y activación de membresías

La acción habitual es **Confirmar pago y activar**. El registro del pago,
la emisión del número de recibo y la actualización de la membresía se guardan
en una sola transacción. La respuesta incluye `membresia_confirmada`, con
el acceso efectivo y la fecha de vencimiento, para confirmar el resultado
en pantalla sin una segunda acción del administrador.

Antes del cobro, `vigencia_pago` muestra el periodo que aplicará el servidor:

- Dentro de los días de tolerancia del plan, se conserva el periodo del cargo.
- Si supera la tolerancia o el periodo completo ya terminó, comienza un periodo
  nuevo desde hoy. La fecha original de cobro se conserva.
- Un pago anticipado conserva los días ya pagados y agrega el periodo siguiente.
- Si se cobra anticipadamente la primera membresía, su vigencia comienza hoy.

Los cargos atrasados permiten elegir **Solo pagar deuda anterior**. Esta acción
registra el pago y el recibo sin extender ni activar la membresía. Se puede
renovar después, generando un cargo nuevo; el cargo pagado no se reutiliza.
Los otros cargos anteriores no se anulan ni se perdonan automáticamente.

El endpoint `POST /api/payment-records/{id}/mark-paid/` recibe `method`,
`payment_reference`, `notes` y el campo opcional `aplicacion` (`activar`,
predeterminado, o `deuda`). SINPE, transferencia y otros medios requieren
referencia. Un error de validación no registra el pago ni emite el recibo.
Los cargos históricos sin suscripción conservan su compatibilidad de registro,
pero no pueden otorgar vigencia por sí mismos.

No se reactiva automáticamente un perfil dado de baja manualmente. Tampoco se
activa una membresía anterior si el cliente ya tiene otra vigente. Una
membresía cancelada y un cargo anulado no admiten pagos.
