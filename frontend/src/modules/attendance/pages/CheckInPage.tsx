import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { CheckSquare, Loader2, Clock } from 'lucide-react'
import { useCheckInMutation, useAttendanceQuery } from '../hooks/useAttendance'
import { PageHeader, EmptyState } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatDateTime } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'

export function CheckInPage() {
  const { user } = useAuthStore()
  const es_entrenador = user?.role === 'trainer' || user?.is_staff
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const filtros = es_entrenador && memberId ? { member: memberId } : undefined
  const [notes, setNotes] = useState('')
  const { mutate: checkIn, isPending } = useCheckInMutation()
  const { data: attendance, isLoading } = useAttendanceQuery(filtros)

  const handleCheckIn = () => {
    checkIn(notes)
    setNotes('')
  }

  return (
    <div data-testid="checkin-page" className="page-enter max-w-xl mx-auto">
      <PageHeader
        title={es_entrenador ? (memberId ? 'Asistencia Del Miembro' : 'Asistencia') : 'Check-in'}
        subtitle={
          es_entrenador
            ? memberId
              ? 'Registros recientes del miembro seleccionado'
              : 'Visión rápida de registros recientes de asistencia'
            : 'Registra tu asistencia al gimnasio'
        }
      />

      {/* Check-in card */}
      {!es_entrenador && (
        <div className="card p-8 mb-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <CheckSquare size={36} />
          </div>
          <h2 className="font-heading font-bold text-2xl text-neutral-900 dark:text-white mb-2">
            Registrar asistencia
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            Confirma tu presencia en el gimnasio para hoy
          </p>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas opcionales (ej: entrenamiento de pecho)"
            rows={2}
            className="w-full px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-900 dark:text-white placeholder-neutral-400 resize-none mb-4"
            data-testid="checkin-notes"
          />

          <button
            onClick={handleCheckIn}
            disabled={isPending}
            className="btn-primary w-full flex items-center justify-center gap-2"
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
        </div>
      )}

      {/* Recent attendance */}
      <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-3">
        {es_entrenador ? (memberId ? 'Registros recientes del miembro' : 'Registros recientes del gimnasio') : 'Historial reciente'}
      </h3>

      {isLoading ? (
        <div className="card overflow-hidden">
          <table className="table-base">
            <tbody>{Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={3} />)}</tbody>
          </table>
        </div>
      ) : !attendance?.results.length ? (
        <EmptyState
          icon={<Clock size={32} />}
          title="Sin registros de asistencia"
          description="Tu historial de check-ins aparecerá aquí"
        />
      ) : (
        <div className="table-container">
          <table className="table-base">
            <thead>
              <tr>
                <th className="th-base">Fecha</th>
                <th className="th-base">Check-in</th>
                <th className="th-base">Notas</th>
              </tr>
            </thead>
            <tbody>
              {attendance.results.map((a) => (
                <tr key={a.id} className="tr-hover" data-testid={`attendance-row-${a.id}`}>
                  <td className="td-base">{formatDateTime(a.check_in_time)}</td>
                  <td className="td-base">
                    <span className="text-green-500 font-medium text-xs">✓ Presente</span>
                  </td>
                  <td className="td-base text-neutral-400 text-xs">{a.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
