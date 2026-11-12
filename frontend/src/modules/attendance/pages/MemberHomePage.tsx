import { useState } from 'react'
import { ArrowUpRight, CheckCircle2, CircleAlert, Dumbbell, Loader2, LockKeyhole, Quote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { useMemberDashboardQuery, useMemberDetailQuery } from '@/modules/members/hooks/useMembers'
import { formatDate } from '@/shared/lib/utils'
import { BrandMark, PulsoDecorativo } from '@/shared/components/Brand'
import { getTodayAttendanceDate, useMemberAttendanceToday } from '../hooks/useAttendance'
import { MemberQrCode } from '../components/MemberQrCode'
import './MemberHomePage.css'

const PERIODOS: Record<string, string> = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
  monthly: 'Mensual', quarterly: 'Trimestral', annual: 'Anual',
}

const FRASES_SUPERACION = [
  'No necesitas hacerlo perfecto. Solo dar el siguiente paso.',
  'La fuerza tambiÃ©n estÃ¡ en volver a intentarlo.',
  'Tu progreso empieza cada vez que eliges presentarte.',
  'PequeÃ±os esfuerzos. Una versiÃ³n mÃ¡s fuerte de ti.',
  'Hoy no compites con nadie. Hoy construyes lo tuyo.',
  'Un dÃ­a a la vez. Una repeticiÃ³n mÃ¡s cerca de tu meta.',
  'La constancia convierte tus ganas en progreso.',
]

export function MemberHomePage() {
  const usuario = useAuthStore((state) => state.user)
  const miembroId = usuario?.memberprofile_id ?? 0
  const { data: resumen, isLoading: cargando, isError: errorResumen, refetch: recargar, isFetching: actualizando } = useMemberDashboardQuery(miembroId)
  const { data: miembro } = useMemberDetailQuery(miembroId)
  const { hasCheckedInToday: entradaConfirmada, isError: errorAsistencia, refetch: revisarEntrada, isFetching: revisandoEntrada } = useMemberAttendanceToday(Boolean(miembroId))
  const [fotoFallida, establecerFotoFallida] = useState<string | null>(null)
  const nombre = miembro?.full_name || `${usuario?.first_name || ''} ${usuario?.last_name || ''}`.trim() || 'Miembro PULSO'
  const iniciales = nombre.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('')
  const periodo = resumen?.membership_recurrence_type ? PERIODOS[resumen.membership_recurrence_type] : null
  const nombrePlan = resumen?.membership_plan_name?.trim()
  const tituloPlan = nombrePlan ? (/^plan\b/i.test(nombrePlan) ? nombrePlan : `Plan ${nombrePlan}`) : 'Sin plan asignado'
  const mostrarPeriodo = periodo && nombrePlan && !nombrePlan.toLocaleLowerCase('es').includes(periodo.toLocaleLowerCase('es'))
  const necesitaRevision = resumen?.membership_access_allowed === false
  const porVencer = resumen?.days_until_due != null && resumen.days_until_due >= 0 && resumen.days_until_due <= 7
  const fechaHoy = getTodayAttendanceDate()
  const indiceFrase = Math.floor(Date.parse(`${fechaHoy}T00:00:00Z`) / 86_400_000) % FRASES_SUPERACION.length
  const fraseHoy = FRASES_SUPERACION[indiceFrase]

  return (
    <div className="mx-auto max-w-3xl space-y-6 selection:bg-primary selection:text-white" data-testid="member-home-page">
      <h1 className="break-words font-heading text-3xl font-bold text-neutral-950 dark:text-white">{nombre}</h1>

      <section className="carnet-entrada overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950" aria-label="Carnet digital del gimnasio">
        <div className="relative grid grid-cols-[minmax(0,1fr)_112px] items-center gap-4 overflow-hidden bg-neutral-950 px-5 py-5 text-white sm:grid-cols-[minmax(0,1fr)_216px] sm:gap-8 sm:px-7">
          <PulsoDecorativo className="carnet-trazo pointer-events-none absolute -right-16 top-4 h-28 w-80 text-primary/30" />
          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-2.5"><BrandMark size="sm" /><span className="font-heading text-xl font-bold tracking-wide">PULSO</span></div>
            <p className="mt-3 font-heading text-xl font-bold leading-tight">Tu mejor versi&oacute;n <span className="text-primary">empieza aqu&iacute;.</span></p>
          </div>
          <div className="relative z-10 flex h-20 w-20 shrink-0 items-center justify-center justify-self-center overflow-hidden rounded-2xl border-2 border-white/30 bg-neutral-800 text-2xl font-semibold text-neutral-200">
            <span aria-label={`Iniciales de ${nombre}`}>{iniciales}</span>
            {miembro?.photo && fotoFallida !== miembro.photo ? <img src={miembro.photo} alt={`Foto de ${nombre}`} width={80} height={80} className="absolute inset-0 h-full w-full object-cover" onError={() => establecerFotoFallida(miembro.photo)} /> : null}
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 p-5 sm:p-7">
          <MemberQrCode entradaConfirmada={entradaConfirmada} />
          <div className="w-full max-w-sm border-t border-neutral-200 pt-5 text-center dark:border-neutral-800">
            <div aria-label="Plan de gimnasio">
              {cargando ? <p role="status" className="flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-300"><Loader2 size={16} className="animate-spin" /> Cargando membres&iacute;a...</p> : errorResumen ? (
                <div role="status" className="text-sm text-neutral-700 dark:text-neutral-300">
                  <p>No pudimos consultar tu membres&iacute;a.</p>
                  <button type="button" onClick={() => void recargar()} disabled={actualizando} className="mt-1 min-h-11 font-semibold text-primary disabled:opacity-60" aria-label="Reintentar cargar membresÃ­a">{actualizando ? 'Consultando...' : 'Reintentar'}</button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <h2 className="break-words font-heading text-3xl font-bold text-neutral-950 dark:text-white">{tituloPlan}</h2>
                    {mostrarPeriodo ? <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{periodo}</span> : null}
                  </div>
                  {nombrePlan ? <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Tu espacio para seguir super&aacute;ndote.</p> : null}
                  <p className="mt-3 text-sm tabular-nums text-neutral-600 dark:text-neutral-300">{resumen?.membership_expires_at ? `Vigencia hasta el ${formatDate(resumen.membership_expires_at)}` : 'Sin vencimiento registrado'}</p>
                  {resumen?.membership_plan_name && resumen.membership_access_allowed != null ? (
                    <p className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${necesitaRevision || porVencer ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>
                      {necesitaRevision || porVencer ? <CircleAlert size={14} /> : <CheckCircle2 size={14} />}
                      {necesitaRevision ? 'Renueva tu impulso en recepciÃ³n' : porVencer ? 'Tu prÃ³ximo ciclo te espera Â· Por vencer' : 'Acceso al gimnasio habilitado'}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
        {entradaConfirmada ? <p role="status" className="carnet-confirmacion flex items-center gap-2 border-t border-neutral-200 px-5 py-3 text-sm font-medium text-emerald-800 dark:border-neutral-700 dark:text-emerald-300 sm:px-7"><CheckCircle2 size={16} /> Tu entrada de hoy est&aacute; registrada.</p> : null}
      </section>

      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60" aria-labelledby="entrenamiento-hoy">
        <div className="relative px-6 py-7 sm:px-8 sm:py-8">
          <Quote size={48} strokeWidth={1.25} className="pointer-events-none absolute right-5 top-4 text-primary/15" aria-hidden="true" />
          <h2 id="entrenamiento-hoy" className="relative max-w-xl text-balance font-heading text-3xl font-bold leading-tight text-neutral-950 dark:text-white sm:text-4xl">{fraseHoy}</h2>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{entradaConfirmada ? 'Ya estÃ¡s aquÃ­. Ahora haz que este momento cuente.' : 'Tu prÃ³ximo paso empieza aquÃ­. A tu ritmo.'}</p>
        </div>

        <div className="border-t border-neutral-200 px-6 py-5 dark:border-neutral-800 sm:px-8">
          {cargando ? <p role="status" className="text-sm text-neutral-600 dark:text-neutral-300">Consultando tu entrenamiento...</p> : errorResumen ? <p className="text-sm text-neutral-600 dark:text-neutral-300">El adelanto estar&aacute; disponible cuando recuperemos la conexi&oacute;n.</p> : (
            <p className="flex items-start gap-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-100"><Dumbbell size={18} className="mt-0.5 shrink-0 text-primary" />{resumen?.today_has_workout ? resumen.resumen_hoy : 'Hoy tambiÃ©n cuenta recuperar energÃ­a. Revisa tu rutina cuando estÃ©s listo.'}</p>
          )}
          {errorAsistencia && !entradaConfirmada ? (
            <button type="button" onClick={() => void revisarEntrada()} disabled={revisandoEntrada} className="mt-3 min-h-11 text-sm font-semibold text-primary disabled:opacity-60">{revisandoEntrada ? 'Revisando entrada...' : 'Reintentar confirmar mi entrada'}</button>
          ) : entradaConfirmada ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-300"><CheckCircle2 size={16} /> Entrada de hoy confirmada</p>
              <Link to="/plans/my" className="btn-primary inline-flex min-h-12 items-center justify-center gap-3">Ir a mis ejercicios <ArrowUpRight size={18} /></Link>
            </div>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-300"><LockKeyhole size={15} className="mt-0.5 shrink-0" /> Muestra tu QR en recepci&oacute;n para desbloquear tus ejercicios.</p>
          )}
        </div>
      </section>
    </div>
  )
}
