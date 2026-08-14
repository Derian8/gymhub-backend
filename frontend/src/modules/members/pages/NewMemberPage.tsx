import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, Copy, ReceiptText, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useMembershipPlansQuery } from '@/modules/billing/hooks/useBilling'
import { BASE_URL } from '@/shared/api/client'
import { PageHeader } from '@/shared/components/UI'
import { formatCurrency, formatDate } from '@/shared/lib/utils'
import type { RegistroClientePagoPayload, RegistroClientePagoResponse } from '@/shared/types'
import { useRegisterClientWithPaymentMutation, useTrainersQuery } from '../hooks/useMembers'

const initialForm: RegistroClientePagoPayload = {
  nombres: '',
  apellidos: '',
  correo_electronico: '',
  telefono: '',
  fecha_nacimiento: '',
  contacto_emergencia: '',
  entrenador: null,
  tipo_membresia: 'catalogo',
  plan_membresia: null,
  nombre_membresia: '',
  precio_acordado: '',
  tipo_recurrencia: 'monthly',
  dias_gracia: 7,
  renovacion_automatica: true,
  motivo_ajuste_precio: '',
  notas_comerciales: '',
  metodo_pago: 'cash',
  referencia_pago: '',
  notas_pago: '',
}

const recurrenceOptions = [
  ['daily', 'Diaria'],
  ['weekly', 'Semanal'],
  ['biweekly', 'Quincenal'],
  ['monthly', 'Mensual'],
  ['quarterly', 'Trimestral'],
  ['annual', 'Anual'],
] as const

const paymentMethods = [
  ['cash', 'Efectivo'],
  ['sinpe', 'SINPE Móvil'],
  ['transfer', 'Transferencia'],
  ['other', 'Otro'],
] as const

export function NewMemberPage() {
  const [form, setForm] = useState<RegistroClientePagoPayload>(initialForm)
  const [created, setCreated] = useState<RegistroClientePagoResponse | null>(null)
  const { data: plans, isLoading: isLoadingPlans } = useMembershipPlansQuery()
  const { data: trainers, isLoading: isLoadingTrainers } = useTrainersQuery()
  const registerClient = useRegisterClientWithPaymentMutation()
  const selectedPlan = useMemo(
    () => plans?.results.find((plan) => plan.id === form.plan_membresia),
    [form.plan_membresia, plans?.results],
  )

  const update = <K extends keyof RegistroClientePagoPayload>(
    key: K,
    value: RegistroClientePagoPayload[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload: RegistroClientePagoPayload = {
      ...form,
      fecha_nacimiento: form.fecha_nacimiento || undefined,
      contacto_emergencia: form.contacto_emergencia || undefined,
      plan_membresia: form.tipo_membresia === 'catalogo' ? form.plan_membresia : null,
      nombre_membresia: form.tipo_membresia === 'personalizada' ? form.nombre_membresia : undefined,
      precio_acordado: form.precio_acordado || undefined,
      tipo_recurrencia: form.tipo_membresia === 'personalizada' ? form.tipo_recurrencia : undefined,
      dias_gracia: form.tipo_membresia === 'personalizada' ? form.dias_gracia : undefined,
      referencia_pago: form.referencia_pago?.trim() || undefined,
    }
    registerClient.mutate(payload, { onSuccess: setCreated })
  }

  if (created) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="registration-success">
        <PageHeader
          title="Cliente registrado y pago confirmado"
          subtitle="La membresía está activa y el comprobante interno ya está disponible."
        />
        <section className="card space-y-6 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 text-green-500" size={28} />
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                {created.member.full_name}
              </h2>
              <p className="text-sm text-neutral-500">
                {formatCurrency(created.payment.amount)} cobrados · acceso activo hasta {formatDate(created.membership.end_date)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
            <p className="label-base">Contraseña temporal — se muestra una sola vez</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 text-lg font-bold" data-testid="temporary-password">
                {created.contrasena_temporal}
              </code>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(created.contrasena_temporal)
                  toast.success('Contraseña copiada')
                }}
              >
                <Copy size={16} /> Copiar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              className="btn-primary"
              href={`${BASE_URL}${created.receipt_url}`}
              target="_blank"
              rel="noreferrer"
            >
              <ReceiptText size={17} /> Descargar comprobante
            </a>
            <Link className="btn-secondary" to={`/members/${created.member.id}`}>Abrir cliente</Link>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCreated(null)
                setForm(initialForm)
              }}
            >
              Registrar otro
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Registrar cliente y cobrar"
        subtitle="El alta se completa cuando el primer pago queda confirmado y el acceso activo."
      />
      <form className="space-y-6" onSubmit={submit}>
        <section className="card grid gap-5 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">1. Datos del cliente</h2>
          </div>
          <Field label="Nombres" required>
            <input className="input-base mt-2 w-full" required value={form.nombres} onChange={(event) => update('nombres', event.target.value)} />
          </Field>
          <Field label="Apellidos" required>
            <input className="input-base mt-2 w-full" required value={form.apellidos} onChange={(event) => update('apellidos', event.target.value)} />
          </Field>
          <Field label="Correo electrónico" required>
            <input className="input-base mt-2 w-full" type="email" required value={form.correo_electronico} onChange={(event) => update('correo_electronico', event.target.value)} />
          </Field>
          <Field label="Teléfono" required>
            <input className="input-base mt-2 w-full" required value={form.telefono} onChange={(event) => update('telefono', event.target.value)} />
          </Field>
          <Field label="Fecha de nacimiento">
            <input className="input-base mt-2 w-full" type="date" value={form.fecha_nacimiento} onChange={(event) => update('fecha_nacimiento', event.target.value)} />
          </Field>
          <Field label="Contacto de emergencia">
            <input className="input-base mt-2 w-full" value={form.contacto_emergencia} onChange={(event) => update('contacto_emergencia', event.target.value)} />
          </Field>
          <Field label="Entrenador responsable" required className="sm:col-span-2">
            <select
              className="input-base mt-2 w-full"
              data-testid="assigned-trainer"
              required
              disabled={isLoadingTrainers}
              value={form.entrenador ?? ''}
              onChange={(event) => {
                const entrenador = event.target.value ? Number(event.target.value) : null
                setForm((current) => {
                  const planActual = plans?.results.find((plan) => plan.id === current.plan_membresia)
                  return {
                    ...current,
                    entrenador,
                    plan_membresia: planActual?.trainer && planActual.trainer !== entrenador
                      ? null
                      : current.plan_membresia,
                  }
                })
              }}
            >
              <option value="">Seleccionar entrenador</option>
              {trainers?.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {`${trainer.user.first_name} ${trainer.user.last_name}`.trim() || trainer.user.email}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="card grid gap-5 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">2. Membresía</h2>
            <div className="mt-3 flex gap-2">
              <button type="button" data-testid="membership-catalog" className={form.tipo_membresia === 'catalogo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setForm((current) => ({ ...current, tipo_membresia: 'catalogo', nombre_membresia: '', precio_acordado: '', motivo_ajuste_precio: '' }))}>Catálogo</button>
              <button type="button" data-testid="membership-custom" className={form.tipo_membresia === 'personalizada' ? 'btn-primary' : 'btn-secondary'} onClick={() => setForm((current) => ({ ...current, tipo_membresia: 'personalizada', plan_membresia: null, precio_acordado: '', motivo_ajuste_precio: '' }))}>Personalizada</button>
            </div>
          </div>

          {form.tipo_membresia === 'catalogo' ? (
            <>
              <Field label="Plan de membresía" required>
                <select
                  className="input-base mt-2 w-full"
                  data-testid="membership-plan"
                  required
                  disabled={isLoadingPlans}
                  value={form.plan_membresia ?? ''}
                  onChange={(event) => update('plan_membresia', event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">Seleccionar plan</option>
                  {plans?.results.filter((plan) => (
                    plan.is_active !== false
                    && (!plan.trainer || plan.trainer === form.entrenador)
                  )).map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name} · {formatCurrency(plan.price)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Precio acordado (opcional)">
                <input className="input-base mt-2 w-full" type="number" min="1" step="0.01" placeholder={selectedPlan?.price ?? ''} value={form.precio_acordado} onChange={(event) => update('precio_acordado', event.target.value)} />
              </Field>
              {form.precio_acordado && selectedPlan && Number(form.precio_acordado) !== Number(selectedPlan.price) && (
                <Field label="Motivo del ajuste" required className="sm:col-span-2">
                  <input className="input-base mt-2 w-full" required value={form.motivo_ajuste_precio} onChange={(event) => update('motivo_ajuste_precio', event.target.value)} />
                </Field>
              )}
            </>
          ) : (
            <>
              <Field label="Nombre de la membresía" required>
                <input className="input-base mt-2 w-full" data-testid="custom-membership-name" required value={form.nombre_membresia} onChange={(event) => update('nombre_membresia', event.target.value)} />
              </Field>
              <Field label="Precio acordado" required>
                <input className="input-base mt-2 w-full" data-testid="agreed-price" type="number" min="1" step="0.01" required value={form.precio_acordado} onChange={(event) => update('precio_acordado', event.target.value)} />
              </Field>
              <Field label="Recurrencia" required>
                <select className="input-base mt-2 w-full" value={form.tipo_recurrencia} onChange={(event) => update('tipo_recurrencia', event.target.value as RegistroClientePagoPayload['tipo_recurrencia'])}>
                  {recurrenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Días de gracia">
                <input className="input-base mt-2 w-full" type="number" min="0" value={form.dias_gracia} onChange={(event) => update('dias_gracia', Number(event.target.value))} />
              </Field>
            </>
          )}
          <Field label="Notas comerciales" className="sm:col-span-2">
            <textarea className="input-base mt-2 min-h-20 w-full" value={form.notas_comerciales} onChange={(event) => update('notas_comerciales', event.target.value)} />
          </Field>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input type="checkbox" checked={form.renovacion_automatica} onChange={(event) => update('renovacion_automatica', event.target.checked)} />
            Generar automáticamente el próximo cobro
          </label>
        </section>

        <section className="card grid gap-5 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">3. Primer pago obligatorio</h2>
            <p className="mt-1 text-sm text-neutral-500">La vigencia comienza hoy al confirmar este pago.</p>
          </div>
          <Field label="Método de pago" required>
            <select className="input-base mt-2 w-full" data-testid="payment-method" value={form.metodo_pago} onChange={(event) => update('metodo_pago', event.target.value as RegistroClientePagoPayload['metodo_pago'])}>
              {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Referencia" required={form.metodo_pago !== 'cash'}>
            <input className="input-base mt-2 w-full" data-testid="payment-reference" required={form.metodo_pago !== 'cash'} disabled={form.metodo_pago === 'cash'} value={form.referencia_pago} onChange={(event) => update('referencia_pago', event.target.value)} placeholder={form.metodo_pago === 'cash' ? 'No aplica' : 'Número de comprobante'} />
          </Field>
          <Field label="Notas del pago" className="sm:col-span-2">
            <textarea className="input-base mt-2 min-h-20 w-full" value={form.notas_pago} onChange={(event) => update('notas_pago', event.target.value)} />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <button className="btn-primary flex items-center gap-2" data-testid="register-and-pay" disabled={registerClient.isPending || !form.entrenador || (form.tipo_membresia === 'catalogo' && !form.plan_membresia)}>
              <UserPlus size={17} /> {registerClient.isPending ? 'Registrando y cobrando…' : 'Registrar cliente y cobrar'}
            </button>
          </div>
        </section>
      </form>
    </div>
  )
}

function Field({ label, required = false, className = '', children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span className="label-base">{label}{required ? ' *' : ''}</span>
      {children}
    </label>
  )
}
