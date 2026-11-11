import { ExternalLink, PlayCircle } from 'lucide-react'

export function ExerciseVideo({ url, pending = false }: { url?: string | null; pending?: boolean }) {
  const id = url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1]
  if (!id) return <p className="mt-3 flex items-center gap-2 text-sm text-neutral-500"><PlayCircle size={17} />{pending ? 'Video pendiente: tu instructor puede agregar un enlace de YouTube.' : 'Video no disponible.'}</p>
  return <div className="mt-3 aspect-video overflow-hidden rounded-xl bg-neutral-950"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title="Video de demostración del ejercicio" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /><a className="sr-only" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">Abrir en YouTube <ExternalLink size={15} /></a></div>
}
