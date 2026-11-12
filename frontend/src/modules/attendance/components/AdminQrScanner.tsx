import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Camera, Loader2, QrCode } from 'lucide-react'

interface DetectorResult {
  rawValue: string
}

interface QrDetector {
  detect: (source: HTMLVideoElement) => Promise<DetectorResult[]>
}

type WindowWithQrDetector = Window & {
  BarcodeDetector?: new (options: { formats: string[] }) => QrDetector
}

interface AdminQrScannerProps {
  isSubmitting: boolean
  onSubmit: (token: string) => void
}

export function AdminQrScanner({ isSubmitting, onSubmit }: AdminQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onSubmitRef = useRef(onSubmit)
  const [token, setToken] = useState('')
  const [cameraMessage, setCameraMessage] = useState('Solicitando acceso a la cámara…')

  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    let activo = true
    let stream: MediaStream | null = null
    let timer: number | undefined
    let detectando = false
    const Detector = (window as WindowWithQrDetector).BarcodeDetector

    const iniciar = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage('Este navegador no ofrece acceso a la cámara. Puedes pegar el código QR debajo.')
        return
      }
      if (!Detector) {
        setCameraMessage('El lector QR no está disponible en este navegador. Puedes pegar el código QR debajo.')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (!activo) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setCameraMessage('Apunta la cámara al código del cliente.')
        const detector = new Detector({ formats: ['qr_code'] })

        const buscar = async () => {
          if (!activo || !videoRef.current || detectando) return
          detectando = true
          try {
            const result = await detector.detect(videoRef.current)
            const scannedToken = result[0]?.rawValue?.trim()
            if (scannedToken && activo) {
              setToken(scannedToken)
              setCameraMessage('Código detectado. Confirma para registrar la entrada.')
            }
          } catch {
            setCameraMessage('No se pudo leer el código. Ajusta la cámara o pega el código QR.')
          } finally {
            detectando = false
            if (activo) timer = window.setTimeout(buscar, 350)
          }
        }
        void buscar()
      } catch {
        setCameraMessage('No se pudo abrir la cámara. Revisa el permiso o pega el código QR.')
      }
    }

    void iniciar()
    return () => {
      activo = false
      if (timer) window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (token.trim()) onSubmitRef.current(token.trim())
  }

  return (
    <section className="rounded-3xl border border-primary/20 bg-white p-4 shadow-sm dark:bg-neutral-950 sm:p-6" data-testid="admin-qr-scanner">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-primary/10 p-3 text-primary"><QrCode size={20} /></span>
          <div>
            <h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Lector QR</h2>
            <p className="text-sm text-neutral-500">Escanea el código de asistencia del cliente.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <div className="overflow-hidden rounded-2xl bg-neutral-950">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover sm:aspect-video" aria-label="Vista de la cámara para leer QR" />
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300" aria-live="polite">
            <Camera size={16} className="shrink-0" />{cameraMessage}
          </p>
          <form onSubmit={enviar} className="mt-4 space-y-3">
            <label className="block space-y-1">
              <span className="label-base">Código QR</span>
              <input className="input" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Se completa al escanear" autoComplete="off" />
            </label>
            <button type="submit" disabled={!token.trim() || isSubmitting} className="btn-primary inline-flex w-full items-center justify-center gap-2">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
              {isSubmitting ? 'Registrando...' : 'Confirmar entrada'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
