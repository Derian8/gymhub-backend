import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, CheckSquare, Clock3, NotebookPen } from 'lucide-react'

import { useCheckInMutation, useCheckOutMutation, useAttendanceQuery } from '../hooks/useAttendance'
import { PageHeader, EmptyState, Badge } from '@/shared/components/UI'
import { SymbolFrame } from '@/shared/components/Brand'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatDateTime, formatRelative } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { progressApi } from '@/modules/progress/api/progressApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { AdminQrScanner } from '../components/AdminQrScanner'

export function CheckInPage() {
  const { user } = useAuthStore()
  return user?.is_staff ? <AdminQrAttendancePage /> : <MemberCheckInPage />
}

function AdminQrAttendancePage() {
  const [scannerSession, setScannerSession] = useState(0)
  const navigate = useNavigate()
  const { mutate: checkIn, isPending } = useCheckInMutation()

  return (
    <div className="page-enter mx-auto max-w-4xl" data-testid="checkin-page">
      <PageHeader
        title="Registrar asistencia"
        subtitle="Escanea el código QR temporal del cliente para registrar su entrada."
        backTo="/dashboard/admin"
        backLabel="Volver a Inicio"
      />
      <AdminQrScanner
        key={scannerSession}
        isSubmitting={isPending}
        onSubmit={(qrToken) => checkIn({ qr_token: qrToken }, {
          onSuccess: () => setScannerSession((session) => session + 1),
          onError: (error) => {
            const response = (error as { response?: { data?: { blocked?: boolean; member_id?: number } } }).response?.data
            if (response?.blocked && response.member_id) {
              navigate(`/billing?member=${response.member_id}`, {
                state: { returnTo: '/attendance', returnLabel: 'Volver a asistencia' },
              })
            }
          },
        })}
      />
    </div>
  )
}

function MemberCheckInPage() {
  const todayCostaRica = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const { mutate: checkOut, isPending: isCheckingOut } = useCheckOutMutation()
  const { data: attendance, isLoading } = useAttendanceQuery()
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: QUERY_KEYS.WORKOUT_SESSIONS,
    queryFn: () => progressApi.sessions(),
  })

  const ultimoRegistro = attendance?.results?.[0]
  const registroHoy = attendance?.results.find((item) => item.attendance_date === todayCostaRica)

  return (
    <div data-testid="checkin-page" className="page-enter mx-auto max-w-4xl">
      <PageHeader
        title="Registros"
        subtitle="Consulta tu asistencia y tus entrenamientos completados."
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[1.9rem] border border-neutral-200 bg-gradient-to-br from-white via-neutral-50 to-primary/5 p-6 shadow-sm dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950 dark:to-primary/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                <SymbolFrame size="lg" tone="primary">
                  <CheckSquare size={26} />
                </SymbolFrame>
                <div>
                  <p className="label-base">Acción principal</p>
                  <h2 className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">
                    Entrada desde tu rutina
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Muestra tu código QR en Inicio para que el administrador registre tu llegada.
                  </p>
                </div>
              </div>
              <Badge variant="success">Disponible hoy</Badge>
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

            {registroHoy && !registroHoy.check_out_time ? (
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
              <Link to="/today" className="btn-primary mt-5 flex w-full items-center justify-center gap-2" data-testid="open-routine-link">
                <CheckSquare size={16} />
                MOSTRAR CÓDIGO QR
              </Link>
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

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">
            Historial reciente
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
