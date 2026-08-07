import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Activity, AlertTriangle, CalendarDays, CheckSquare, Clock3, Loader2, NotebookPen, Search, ShieldAlert, UserCheck } from 'lucide-react'

import { useCheckInMutation, useCheckOutMutation, useAttendanceQuery } from '../hooks/useAttendance'
import { PageHeader, EmptyState, Badge } from '@/shared/components/UI'
import { SymbolFrame } from '@/shared/components/Brand'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatDate, formatDateTime, formatRelative } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { progressApi } from '@/modules/progress/api/progressApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { useMembersQuery } from '@/modules/members/hooks/useMembers'
import type { Attendance, CheckInBlockedResponse } from '@/shared/types'

export function CheckInPage() {
  const { user } = useAuthStore()
  const esEntrenador = user?.role === 'trainer' || user?.is_staff
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const todayCostaRica = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState(() => (esEntrenador ? todayCostaRica : ''))
  const filtros = esEntrenador
    ? {
        ...(memberId ? { member: memberId } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      }
    : undefined
  const [notes, setNotes] = useState('')
  const [assistedMemberId, setAssistedMemberId] = useState(memberId || '')
  const [overrideReason, setOverrideReason] = useState('')
  const [blockedState, setBlockedState] = useState<CheckInBlockedResponse | null>(null)
  const { mutate: checkIn, isPending } = useCheckInMutation()
  const { mutate: checkOut, isPending: isCheckingOut } = useCheckOutMutation()
  const { data: attendance, isLoading } = useAttendanceQuery(filtros)
  const { data: members } = useMembersQuery({ assignment: 'mine' }, esEntrenador)
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: QUERY_KEYS.WORKOUT_SESSIONS,
    queryFn: progressApi.sessions,
    enabled: !esEntrenador,
  })

  const ultimoRegistro = attendance?.results?.[0]
  const registroHoy = attendance?.results.find((item) => item.attendance_date === todayCostaRica)
  const todayAttendanceCount = attendance?.results.filter((item) => item.attendance_date === todayCostaRica).length ?? 0

  const handleCheckIn = () => {
    checkIn({ notes }, {
      onSuccess: () => {
        setBlockedState(null)
        setNotes('')
      },
      onError: (error) => {
        const response = (error as { response?: { data?: unknown } })?.response?.data as Partial<CheckInBlockedResponse> | undefined
        if (response?.blocked && response.reason && typeof response.days_overdue === 'number') {
          setBlockedState({
            blocked: true,
            reason: response.reason,
            days_overdue: response.days_overdue,
          })
        }
      },
    })
  }

  return (
    <div data-testid="checkin-page" className="page-enter mx-auto max-w-4xl">
      <PageHeader
        title={esEntrenador ? (memberId ? 'Asistencia Del Miembro' : 'Asistencia') : 'Registros'}
        subtitle={
          esEntrenador
            ? memberId
              ? 'Registros recientes del miembro seleccionado'
              : 'Visión rápida de registros recientes de asistencia'
            : 'Registra tu asistencia y revisa tus entrenamientos completados'
        }
      />

      {!esEntrenador ? (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[1.9rem] border border-neutral-200 bg-gradient-to-br from-white via-neutral-50 to-primary/5 p-6 shadow-sm dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950 dark:to-primary/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                <SymbolFrame size="lg" tone={blockedState ? 'danger' : 'primary'}>
                  {blockedState ? <ShieldAlert size={26} /> : <CheckSquare size={26} />}
                </SymbolFrame>
                <div>
                  <p className="label-base">Acción principal</p>
                  <h2 className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">
                    {blockedState ? 'Check-in bloqueado' : 'Registrar asistencia'}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    {blockedState
                      ? blockedState.reason === 'payment_overdue'
                        ? `Tu membresía venció hace ${blockedState.days_overdue} días. Registra el pago para recuperar el acceso.`
                        : 'Necesitas una membresía activa y pagada para registrar asistencia.'
                      : 'Confirma tu presencia y deja una nota opcional si quieres registrar el foco de tu sesión.'}
                  </p>
                </div>
              </div>
              <Badge variant={blockedState ? 'error' : 'success'}>
                {blockedState ? 'Requiere regularización' : 'Disponible hoy'}
              </Badge>
            </div>

            {ultimoRegistro ? (
              <div className="mt-5 rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Último check-in</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">
                  {formatRelative(ultimoRegistro.check_in_time)}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatDateTime(ultimoRegistro.check_in_time)}
                </p>
              </div>
            ) : null}

            {blockedState ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">No puedes hacer check-in por mora</p>
                    <p className="mt-1 text-xs opacity-90">
                      Regulariza tu pago pendiente para volver a registrar asistencia sin fricción.
                    </p>
                  </div>
                </div>
              </div>
            ) : registroHoy && !registroHoy.check_out_time ? (
              <button
                onClick={() => checkOut(registroHoy.id)}
                disabled={isCheckingOut}
                className="btn-primary mt-5 flex w-full items-center justify-center gap-2"
                data-testid="checkout-submit"
              >
                <Clock3 size={16} />
                {isCheckingOut ? 'Registrando salida...' : 'REGISTRAR SALIDA'}
              </button>
            ) : registroHoy?.check_out_time ? (
              <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900/70 dark:bg-green-950/30 dark:text-green-300">
                Tu entrada y salida de hoy ya están registradas.
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <label className="label-base mb-2 flex items-center gap-2">
                    <NotebookPen size={14} />
                    Nota opcional
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ejemplo: torso, movilidad, cardio suave"
                    rows={3}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-primary dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    data-testid="checkin-notes"
                  />
                </div>

                <button
                  onClick={handleCheckIn}
                  disabled={isPending}
                  className="btn-primary mt-5 flex w-full items-center justify-center gap-2"
                  data-testid="checkin-submit"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckSquare size={16} />
                      HACER CHECK-IN
                    </>
                  )}
                </button>
              </>
            )}
          </section>

          <section className="rounded-[1.9rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <p className="label-base">Orden del día</p>
            <div className="mt-4 space-y-3">
              <TimelinePoint
                icon={<CheckSquare size={16} />}
                title="1. Marca tu llegada"
                description="Deja visible tu constancia y habilita mejor seguimiento."
              />
              <TimelinePoint
                icon={<NotebookPen size={16} />}
                title="2. Añade una nota breve"
                description="Úsala solo si aporta contexto real de la sesión."
              />
              <TimelinePoint
                icon={<Clock3 size={16} />}
                title="3. Revisa tu historial"
                description="Tu progreso operativo queda ordenado por fecha y hora."
              />
            </div>
          </section>
        </div>
      ) : null}

      {esEntrenador ? (
        <><section className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5"><p className="label-base">Registro asistido</p><h2 className="font-heading text-xl font-bold">Marcar llegada de un miembro</h2><p className="mt-1 text-sm text-neutral-500">Si la membresía está bloqueada, el motivo de excepción será obligatorio y quedará auditado.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><select className="input" value={assistedMemberId} onChange={(event) => setAssistedMemberId(event.target.value)}><option value="">Selecciona miembro</option>{members?.results.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select><input className="input" placeholder="Nota operativa (opcional)" value={notes} onChange={(event) => setNotes(event.target.value)} /><input className="input" placeholder="Motivo si requiere excepción" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} /></div><button className="btn-primary mt-3" disabled={!assistedMemberId || isPending} onClick={() => checkIn({ member_id: Number(assistedMemberId), notes, override_reason: overrideReason }, { onSuccess: () => { setNotes(''); setOverrideReason('') } })}>Registrar llegada</button></section><section className="mt-6 rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <SymbolFrame size="lg" tone="success">
                <UserCheck size={26} />
              </SymbolFrame>
              <div>
                <p className="label-base">Asistencia de hoy</p>
                <h2 className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">
                  {todayAttendanceCount} check-ins registrados
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {dateFilter ? `Mostrando registros del ${formatDate(dateFilter)}` : 'Mostrando registros recientes del gimnasio'}
                </p>
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-[1fr_180px] lg:max-w-xl">
              <label className="space-y-1">
                <span className="label-base flex items-center gap-2">
                  <Search size={14} />
                  Buscar miembro
                </span>
                <input
                  className="input"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Nombre o correo"
                  data-testid="attendance-search"
                />
              </label>
              <label className="space-y-1">
                <span className="label-base flex items-center gap-2">
                  <CalendarDays size={14} />
                  Día
                </span>
                <input
                  className="input"
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  data-testid="attendance-date-filter"
                />
              </label>
            </div>
          </div>
        </section></>
      ) : null}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">
            {esEntrenador ? (memberId ? 'Registros del miembro' : 'Registro de asistencia') : 'Historial reciente'}
          </h3>
          {attendance?.results?.length ? (
            <Badge variant="neutral">{attendance.results.length} registros</Badge>
          ) : null}
        </div>

        {isLoading ? (
          <div className="card overflow-hidden">
            <table className="table-base">
              <tbody>{Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={3} />)}</tbody>
            </table>
          </div>
        ) : !attendance?.results.length ? (
          <EmptyState
            icon={<Clock3 size={32} />}
            title="Sin registros de asistencia"
            description="Tu historial de check-ins aparecerá aquí."
          />
        ) : esEntrenador ? (
          <div>
            <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 md:block">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="th-base">Miembro</th>
                    <th className="th-base">Día</th>
                    <th className="th-base">Entrada</th>
                    <th className="th-base">Salida</th>
                    <th className="th-base">Duración</th>
                    <th className="th-base">Registrado por</th>
                    <th className="th-base">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.results.map((item) => (
                    <TrainerAttendanceRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {attendance.results.map((item) => (
                <TrainerAttendanceCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {attendance.results.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                data-testid={`attendance-row-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  <SymbolFrame size="sm" tone="success">
                    <CheckSquare size={16} />
                  </SymbolFrame>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                        Check-in confirmado
                      </p>
                      <Badge variant="success">Presente</Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDateTime(item.check_in_time)} · {formatRelative(item.check_in_time)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Salida: {item.check_out_time ? formatDateTime(item.check_out_time) : 'pendiente'}
                      {item.duration_minutes == null ? '' : ` · ${item.duration_minutes} min`}
                    </p>
                    {item.notes ? (
                      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{item.notes}</p>
                    ) : (
                      <p className="mt-3 text-sm text-neutral-400">Sin nota registrada.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!esEntrenador ? (
        <section className="mt-6" data-testid="member-workout-records">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">
              Sesiones de entrenamiento
            </h3>
            {sessions?.results.length ? (
              <Badge variant="neutral">{sessions.results.length} sesiones</Badge>
            ) : null}
          </div>

          {sessionsLoading ? (
            <div className="card overflow-hidden">
              <table className="table-base">
                <tbody>{Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={3} />)}</tbody>
              </table>
            </div>
          ) : !sessions?.results.length ? (
            <EmptyState
              icon={<Activity size={32} />}
              title="Sin sesiones registradas"
              description="Tus entrenamientos aparecerán aquí cuando los registres."
            />
          ) : (
            <div className="table-container">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="th-base">Fecha</th>
                    <th className="th-base">Estado</th>
                    <th className="th-base">Sensación</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.results.slice(0, 10).map((session) => (
                    <tr key={session.id} className="tr-hover" data-testid={`record-session-${session.id}`}>
                      <td className="td-base">{formatDateTime(session.started_at)}</td>
                      <td className="td-base">
                        <Badge variant={session.is_completed ? 'success' : 'warning'}>
                          {session.is_completed ? 'Completada' : 'En progreso'}
                        </Badge>
                      </td>
                      <td className="td-base">{session.overall_feeling ? `${session.overall_feeling}/5` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

function formatAttendanceTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-CR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Costa_Rica',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function memberDisplayName(item: Attendance) {
  return item.member_name || item.member_email || `Miembro #${item.member}`
}

function TrainerAttendanceRow({ item }: { item: Attendance }) {
  return (
    <tr className="tr-hover" data-testid={`attendance-row-${item.id}`}>
      <td className="td-base">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900 dark:text-white">{memberDisplayName(item)}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.member_email || 'Sin correo registrado'}</p>
        </div>
      </td>
      <td className="td-base">{formatDate(item.attendance_date)}</td>
      <td className="td-base">
        <div className="flex items-center gap-2">
          <Badge variant="success">Presente</Badge>
          <span className="text-sm font-semibold">{formatAttendanceTime(item.check_in_time)}</span>
        </div>
      </td>
      <td className="td-base text-sm">{item.check_out_time ? formatAttendanceTime(item.check_out_time) : 'Pendiente'}</td>
      <td className="td-base text-sm">{item.duration_minutes == null ? '—' : `${item.duration_minutes} min`}</td>
      <td className="td-base text-sm">{item.checked_in_by_name || 'El miembro'}</td>
      <td className="td-base max-w-[220px] truncate text-sm text-neutral-500 dark:text-neutral-400">{item.notes || '—'}</td>
    </tr>
  )
}

function TrainerAttendanceCard({ item }: { item: Attendance }) {
  return (
    <div
      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      data-testid={`attendance-row-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900 dark:text-white">{memberDisplayName(item)}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.member_email || 'Sin correo registrado'}</p>
        </div>
        <Badge variant="success">Presente</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <AttendanceFact label="Día" value={formatDate(item.attendance_date)} />
        <AttendanceFact label="Entrada" value={formatAttendanceTime(item.check_in_time)} />
        <AttendanceFact label="Salida" value={item.check_out_time ? formatAttendanceTime(item.check_out_time) : 'Pendiente'} />
        <AttendanceFact label="Duración" value={item.duration_minutes == null ? '—' : `${item.duration_minutes} min`} />
      </div>
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        Registrado por: {item.checked_in_by_name || 'El miembro'}
      </p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{item.notes || 'Sin notas.'}</p>
    </div>
  )
}

function AttendanceFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function TimelinePoint({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 px-4 py-4 dark:border-neutral-800">
      <SymbolFrame size="sm" tone="default">
        {icon}
      </SymbolFrame>
      <div>
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
    </div>
  )
}
