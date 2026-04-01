import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { useMembersQuery } from '../hooks/useMembers'
import { Badge, PageHeader, EmptyState, Avatar } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatDate, RISK_LEVEL_BADGE, RISK_LEVEL_LABELS } from '@/shared/lib/utils'
import type { MemberProfile } from '@/shared/types'

export function MembersPage() {
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [inactivityFilter, setInactivityFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [prescriptionFilter, setPrescriptionFilter] = useState('')
  const [ordering, setOrdering] = useState('riesgo_desc')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useMembersQuery({
    search: search || undefined,
    payment_status: paymentFilter || undefined,
    inactivity: inactivityFilter || undefined,
    risk_level: riskFilter || undefined,
    prescription_status: prescriptionFilter || undefined,
    ordering: ordering || undefined,
    page,
  })

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <div data-testid="members-page" className="page-enter">
      <PageHeader
        title="Miembros"
        subtitle={`${data?.count || 0} miembros en total`}
        action={
          <Link to="/members/new" className="btn-primary flex items-center gap-2" data-testid="new-member-btn">
            <UserPlus size={16} />
            Nuevo miembro
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar por nombre, email o teléfono..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-900 dark:text-white placeholder-neutral-400"
            data-testid="members-search"
          />
        </div>

        <select
          value={paymentFilter}
          onChange={(e) => { setPaymentFilter(e.target.value); setPage(1) }}
          className="py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-700 dark:text-neutral-300"
          data-testid="payment-filter"
        >
          <option value="">Todos los estados</option>
          <option value="paid">Pagados</option>
          <option value="pending">Pendientes</option>
          <option value="late">En mora</option>
        </select>

        <label className="flex items-center gap-2 py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm cursor-pointer">
          <input
            type="checkbox"
            checked={inactivityFilter === 'true'}
            onChange={(e) => { setInactivityFilter(e.target.checked ? 'true' : ''); setPage(1) }}
            className="accent-primary"
            data-testid="inactivity-filter"
          />
          <span className="text-neutral-700 dark:text-neutral-300">Solo inactivos</span>
        </label>

        <select
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setPage(1) }}
          className="py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-700 dark:text-neutral-300"
          data-testid="risk-filter"
        >
          <option value="">Todos los riesgos</option>
          <option value="high">Riesgo alto</option>
          <option value="medium">Riesgo medio</option>
          <option value="low">Riesgo bajo</option>
        </select>

        <select
          value={prescriptionFilter}
          onChange={(e) => { setPrescriptionFilter(e.target.value); setPage(1) }}
          className="py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-700 dark:text-neutral-300"
          data-testid="prescription-filter"
        >
          <option value="">Toda la prescripción</option>
          <option value="sin_plan">Sin plan activo</option>
          <option value="incompleta">Incompleta</option>
          <option value="lista">Lista para member</option>
        </select>

        <select
          value={ordering}
          onChange={(e) => { setOrdering(e.target.value); setPage(1) }}
          className="py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-700 dark:text-neutral-300"
          data-testid="members-ordering"
        >
          <option value="riesgo_desc">Priorizar riesgo</option>
          <option value="prescripcion">Priorizar prescripción</option>
          <option value="riesgo_asc">Menor riesgo primero</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table-base">
          <thead>
            <tr>
              <th className="th-base">Miembro</th>
              <th className="th-base hidden sm:table-cell">Teléfono</th>
              <th className="th-base hidden md:table-cell">Fecha ingreso</th>
              <th className="th-base hidden lg:table-cell">Riesgo</th>
              <th className="th-base">Estado</th>
              <th className="th-base hidden xl:table-cell">Señales</th>
              <th className="th-base">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
            ) : data?.results.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400 text-sm">
                  No se encontraron miembros
                </td>
              </tr>
            ) : (
              data?.results.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.count > 20 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-neutral-500">
            Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, data.count)} de {data.count}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={!data.previous}
              className="p-2 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="prev-page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Pág. {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!data.next}
              className="p-2 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="next-page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MemberRow({ member }: { member: MemberProfile }) {
  return (
    <tr className="tr-hover" data-testid={`member-row-${member.id}`}>
      <td className="td-base">
        <div className="flex items-center gap-3">
          <Avatar name={member.full_name} photo={member.photo} size="sm" />
          <div>
            <p className="font-medium text-neutral-900 dark:text-white text-sm">{member.full_name}</p>
            <p className="text-xs text-neutral-400">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="td-base hidden sm:table-cell">{member.phone || '—'}</td>
      <td className="td-base hidden md:table-cell">{formatDate(member.join_date)}</td>
      <td className="td-base hidden lg:table-cell">
        {member.nivel_riesgo ? (
          <div className="space-y-1">
            <Badge variant={RISK_LEVEL_BADGE[member.nivel_riesgo]}>
              {RISK_LEVEL_LABELS[member.nivel_riesgo]} {member.riesgo_adherencia != null ? `· ${member.riesgo_adherencia}/100` : ''}
            </Badge>
            {member.days_since_last_checkin != null && (
              <p className="text-[11px] text-neutral-500">
                {member.days_since_last_checkin} días sin check-in
              </p>
            )}
          </div>
        ) : (
          <Badge variant="neutral">Sin señal</Badge>
        )}
      </td>
      <td className="td-base">
        {member.is_active ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="error">Inactivo</Badge>
        )}
      </td>
      <td className="td-base hidden xl:table-cell">
        <div className="max-w-xs space-y-2">
          {member.estado_prescripcion ? (
            <Badge variant={member.estado_prescripcion === 'lista' ? 'success' : 'warning'}>
              {member.estado_prescripcion === 'sin_plan'
                ? 'Sin plan activo'
                : member.estado_prescripcion === 'incompleta'
                  ? 'Prescripción incompleta'
                  : 'Lista para member'}
            </Badge>
          ) : null}
          {member.motivos_riesgo?.length ? (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
              {member.motivos_riesgo.join(' · ')}
            </p>
          ) : (
            <span className="text-xs text-neutral-400">Sin señales críticas</span>
          )}
        </div>
      </td>
      <td className="td-base">
        <div className="flex items-center gap-3">
          {member.nivel_riesgo === 'high' && <AlertTriangle size={14} className="text-red-500" />}
          <Link
            to={`/members/${member.id}/program`}
            className="text-sm font-medium text-neutral-700 hover:text-primary dark:text-neutral-300"
            data-testid={`member-program-${member.id}`}
          >
            Asignar plan
          </Link>
          <Link
            to={`/members/${member.id}`}
            className="text-primary text-sm font-medium hover:underline"
            data-testid={`member-detail-${member.id}`}
          >
            Ver detalle
          </Link>
        </div>
      </td>
    </tr>
  )
}
