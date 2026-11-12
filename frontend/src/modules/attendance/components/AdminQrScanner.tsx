import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Camera, Loader2, QrCode } from 'lucide-react'

interface AdminQrScannerProps {
  isSubmitting: boolean
  onSubmit: (token: string) => void
}

export function AdminQrScanner({ isSubmitting, onSubmit }: AdminQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onSubmitRef = useRef(onSubmit)
  const wasSubmittingRef = useRef(false)
  const submittedRef = useRef(false)
  const [cameraMessage, setCameraMessage] = useState('Solicitando acceso a la cámara…')

  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    if (isSubmitting) {
      wasSubmittingRef.current = true
      return
    }

    if (wasSubmittingRef.current) {
      wasSubmittingRef.current = false
      submittedRef.current = false
      setCameraMessage('No se pudo registrar. Vuelve a enfocar el código QR.')
    }
  }, [isSubmitting])

  useEffect(() => {
    let active = true
    let controls: IScannerControls | undefined
    const video = videoRef.current

    if (!navigator.mediaDevices?.getUserMedia || !video) {
      setCameraMessage('Este navegador no permite usar la cámara. Revisa sus permisos para este sitio.')
      return
    }

    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanSuccess: 1000,
      delayBetweenScanAttempts: 150,
    })

    void reader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      video,
      (result, _error, scannerControls) => {
        controls = scannerControls
        if (!active || !result || submittedRef.current) return

        const token = result.getText().trim()
        if (!token) return

        submittedRef.current = true
        setCameraMessage('Código detectado. Registrando asistencia…')
        onSubmitRef.current(token)
      },
    ).then((scannerControls) => {
      controls = scannerControls
      if (active && !submittedRef.current) setCameraMessage('Apunta la cámara al código QR del cliente.')
      else scannerControls.stop()
    }).catch(() => {
      if (active) setCameraMessage('No se pudo abrir la cámara. Habilita el permiso de cámara y vuelve a cargar la vista.')
    })

    return () => {
      active = false
      controls?.stop()
    }
  }, [])

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
        <div className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-4 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300" aria-live="polite">
          {isSubmitting ? <Loader2 size={18} className="shrink-0 animate-spin text-primary" /> : <Camera size={18} className="shrink-0 text-primary" />}
          <span>{isSubmitting ? 'Registrando asistencia…' : cameraMessage}</span>
        </div>
      </div>
    </section>
  )
}
