import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, UserPlus, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMembersQuery } from '../hooks/useMembers'
import { Badge, PageHeader, EmptyState, Avatar } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatDate, PAYMENT_STATUS_CLASS } from '@/shared/lib/utils'
import type { MemberProfile } from '@/shared/types'

export function MembersPage() {
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [inactivityFilter, setInactivityFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useMembersQuery({
    search: search || undefined,
    payment_status: paymentFilter || undefined,
    inactivity: inactivityFilter || undefined,
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
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table-base">
          <thead>
            <tr>
              <th className="th-base">Miembro</th>
              <th className="th-base hidden sm:table-cell">Teléfono</th>
              <th className="th-base hidden md:table-cell">Fecha ingreso</th>
              <th className="th-base">Estado</th>
              <th className="th-base">Pago</th>
              <th className="th-base">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
            ) : data?.results.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-neutral-400 text-sm">
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
      <td className="td-base">
        {member.is_active ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="error">Inactivo</Badge>
        )}
      </td>
      <td className="td-base">
        <Badge variant="neutral">—</Badge>
      </td>
      <td className="td-base">
        <Link
          to={`/members/${member.id}`}
          className="text-primary text-sm font-medium hover:underline"
          data-testid={`member-detail-${member.id}`}
        >
          Ver detalle
        </Link>
      </td>
    </tr>
  )
}
