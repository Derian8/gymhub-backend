import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Camera, Loader2, QrCode, SwitchCamera } from 'lucide-react'

type Orientacion = 'user' | 'environment'

interface AdminQrScannerProps {
  isSubmitting: boolean
  onSubmit: (token: string) => Promise<void>
}

export function AdminQrScanner({ isSubmitting, onSubmit }: AdminQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const enviarRef = useRef(onSubmit)
  const procesandoRef = useRef(false)
  const ultimoRef = useRef({ token: '', hasta: 0 })
  const aperturaRef = useRef<Promise<void>>(Promise.resolve())
  const [orientacion, establecerOrientacion] = useState<Orientacion>('environment')
  const [orientacionActiva, establecerOrientacionActiva] = useState<Orientacion>('environment')
  const [intento, establecerIntento] = useState(0)
  const [abriendo, establecerAbriendo] = useState(true)
  const [errorCamara, establecerError] = useState(false)
  const [mensaje, establecerMensaje] = useState('Solicitando acceso a la cámara…')

  useEffect(() => { enviarRef.current = onSubmit }, [onSubmit])

  useEffect(() => {
    let activo = true
    let controles: IScannerControls | undefined
    let flujo: MediaStream | undefined
    const video = videoRef.current
    const detener = () => {
      controles?.stop()
      flujo?.getTracks().forEach((pista) => pista.stop())
    }
    establecerAbriendo(true)
    establecerError(false)
    establecerMensaje('Abriendo cámara…')
    // Evita solicitudes simultáneas cuando el permiso anterior sigue pendiente.
    aperturaRef.current = aperturaRef.current.then(async () => {
      if (!activo || !video) return
      try {
        if (!window.isSecureContext) throw new Error('HTTPS_REQUIRED')
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('CAMERA_UNSUPPORTED')
        let orientacionAbierta = orientacion
        try {
          flujo = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { exact: orientacion } } })
        } catch (error) {
          if (error instanceof Error && ['OverconstrainedError', 'NotFoundError', 'NotReadableError', 'AbortError'].includes(error.name)) {
            if (!activo) return
            orientacionAbierta = orientacion === 'environment' ? 'user' : 'environment'
            flujo = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: orientacionAbierta } } })
          } else { throw error }
        }
        if (!activo) { detener(); return }
        const orientacionReal = flujo.getVideoTracks()[0]?.getSettings().facingMode
        establecerOrientacionActiva(orientacionReal === 'user' || orientacionReal === 'environment' ? orientacionReal : orientacionAbierta)
        const lector = new BrowserQRCodeReader(undefined, { delayBetweenScanSuccess: 1000, delayBetweenScanAttempts: 150 })
        controles = await lector.decodeFromStream(flujo, video, (resultado) => {
          if (!activo || !resultado || procesandoRef.current) return
          const token = resultado.getText().trim()
          if (!token || (ultimoRef.current.token === token && Date.now() < ultimoRef.current.hasta)) return
          procesandoRef.current = true
          establecerMensaje('Código detectado. Registrando asistencia…')
          void (async () => {
            let registrado = false
            try {
              await enviarRef.current(token)
              registrado = true
              if (activo) establecerMensaje('Asistencia registrada. Puedes escanear al siguiente cliente.')
            } catch {
              if (activo) establecerMensaje('No se pudo registrar. Revisa el aviso y solicita un QR nuevo si venció.')
            } finally {
              ultimoRef.current = { token, hasta: registrado ? Infinity : Date.now() + 5000 }
              procesandoRef.current = false
            }
          })()
        })
        if (!activo) { detener(); return }
        establecerAbriendo(false)
        if (!procesandoRef.current) establecerMensaje((orientacionReal || orientacionAbierta) !== orientacion
          ? 'La cámara solicitada no está disponible. Usando la cámara disponible para escanear.'
          : 'Apunta la cámara al código QR del cliente.')
      } catch (error) {
        detener()
        if (!activo) return
        establecerAbriendo(false)
        establecerError(true)
        const nombre = error instanceof Error ? error.name : ''
        establecerMensaje(error instanceof Error && error.message === 'HTTPS_REQUIRED'
          ? 'Abre el sitio mediante HTTPS para usar la cámara del celular.'
          : nombre === 'NotAllowedError' || nombre === 'SecurityError'
            ? 'Permite la cámara en los permisos de este sitio en tu navegador y pulsa Reintentar.'
            : nombre === 'NotReadableError'
              ? 'La cámara está ocupada. Cierra otras aplicaciones que la usen y pulsa Reintentar.'
              : 'No se pudo abrir la cámara. Revisa los permisos o prueba con la otra cámara.')
      }
    })
    return () => { activo = false; detener() }
  }, [orientacion, intento])

  return (
    <section className="rounded-3xl border border-primary/20 bg-white p-4 shadow-sm dark:bg-neutral-950 sm:p-6" data-testid="admin-qr-scanner">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary"><QrCode size={20} /></span>
        <div>
          <h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Registrar asistencia</h2>
          <p className="text-sm text-neutral-500">La entrada se registra automáticamente al leer el QR.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)] md:items-center">
        <div className="relative overflow-hidden rounded-2xl bg-neutral-950">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover sm:aspect-video" aria-label="Vista de la cámara para leer QR" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
            <div className="h-2/3 w-2/3 rounded-3xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-4 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300" aria-live="polite">
            {isSubmitting || abriendo ? <Loader2 size={18} className="shrink-0 animate-spin text-primary" /> : <Camera size={18} className="shrink-0 text-primary" />}
            <span>{isSubmitting ? 'Registrando asistencia…' : mensaje}</span>
          </div>
          <button type="button" disabled={abriendo || isSubmitting} onClick={() => {
            establecerOrientacion(orientacionActiva === 'environment' ? 'user' : 'environment')
            establecerIntento((actual) => actual + 1)
          }} className="btn-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 disabled:opacity-50">
            <SwitchCamera size={18} /> Usar cámara {orientacionActiva === 'environment' ? 'frontal' : 'trasera'}
          </button>
          {errorCamara ? <button type="button" onClick={() => establecerIntento((actual) => actual + 1)} className="btn-primary min-h-11 w-full">Reintentar cámara</button> : null}
          <p className="text-xs text-neutral-500">Al abrir el escáner usamos la cámara trasera; si no está disponible, usamos la frontal. Para conservar el permiso, permite la cámara para este sitio en tu navegador; la duración depende del navegador.</p>
        </div>
      </div>
    </section>
  )
}
