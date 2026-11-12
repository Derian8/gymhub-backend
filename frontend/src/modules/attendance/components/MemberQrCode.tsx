import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Expand, Loader2, RefreshCw, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { attendanceApi } from '../api/attendanceApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'

export function MemberQrCode({ entradaConfirmada = false }: { entradaConfirmada?: boolean }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [ahora, establecerAhora] = useState(Date.now())
  const { data: codigo, isPending: preparando, refetch: renovar, isFetching: renovando } = useQuery({
    queryKey: QUERY_KEYS.MEMBER_ATTENDANCE_QR,
    queryFn: attendanceApi.memberQrToken,
    staleTime: 0,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  useEffect(() => {
    if (!codigo?.expires_at) return
    const demora = Date.parse(codigo.expires_at) - Date.now()
    const temporizador = window.setTimeout(() => establecerAhora(Date.now()), Math.max(0, demora) + 20)
    return () => window.clearTimeout(temporizador)
  }, [codigo?.expires_at])

  const codigoVigente = codigo?.token && Date.parse(codigo.expires_at) > ahora

  const mostrarCodigo = (ampliado = false) => preparando ? (
    <p role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-neutral-700"><Loader2 size={18} className="animate-spin" /> Preparando tu QR...</p>
  ) : codigoVigente ? (
    <QRCodeSVG value={codigo.token} size={ampliado ? 360 : 176} level="M" includeMargin className={ampliado ? 'h-auto w-full' : 'h-44 w-44'} role="img" aria-label={ampliado ? 'QR de entrada ampliado' : 'QR de entrada'} />
  ) : (
    <div role="status" className="flex min-h-48 flex-col items-center justify-center text-center text-neutral-700">
      <p className="max-w-52 text-sm">{codigo ? 'Tu QR venció. Genera uno nuevo.' : 'No pudimos generar tu QR.'}</p>
      <button type="button" onClick={() => void renovar()} disabled={renovando} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-100 disabled:opacity-60"><RefreshCw size={15} className={renovando ? 'animate-spin' : ''} />{renovando ? 'Generando...' : 'Reintentar'}</button>
    </div>
  )

  return (
    <div className="flex flex-col items-center" data-testid="member-checkin-qr">
      {codigoVigente ? (
        <button type="button" onClick={() => dialogo.current?.showModal()} className="carnet-qr-boton group flex flex-col items-center rounded-2xl bg-white p-2 text-neutral-800 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Ampliar código QR de entrada">
          {mostrarCodigo()}
          <span className="flex min-h-9 items-center justify-center gap-2 text-sm font-semibold"><Expand size={15} />{entradaConfirmada ? 'Ver QR de acceso' : 'Ampliar QR'}</span>
        </button>
      ) : <div className="w-full rounded-xl bg-white p-2">{mostrarCodigo()}</div>}
      {!entradaConfirmada ? <p className="mt-2 text-center text-xs text-neutral-600 dark:text-neutral-300">Mu&eacute;stralo en recepci&oacute;n.</p> : null}
      <dialog ref={dialogo} aria-labelledby="qr-ampliado-titulo" aria-describedby="qr-ampliado-ayuda" className="carnet-qr-dialogo m-auto w-[calc(100%_-_2rem)] max-w-md rounded-3xl border-0 bg-white p-5 text-neutral-950 shadow-2xl backdrop:bg-neutral-950/80 sm:p-6" onClick={(evento) => { if (evento.target === evento.currentTarget) dialogo.current?.close() }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="qr-ampliado-titulo" className="font-heading text-2xl font-bold">Tu entrada al gimnasio</h2>
          <button type="button" onClick={() => dialogo.current?.close()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100" aria-label="Cerrar QR ampliado" autoFocus><X size={22} /></button>
        </div>
        {mostrarCodigo(true)}
        <p id="qr-ampliado-ayuda" className="mt-3 text-center text-sm text-neutral-600">Mu&eacute;stralo en recepci&oacute;n para registrar tu llegada.</p>
      </dialog>
    </div>
  )
}
