import { ExternalLink, PlayCircle } from 'lucide-react'

export function ExerciseVideo({ url, extraUrl, pending = false }: { url?: string | null; extraUrl?: string | null; pending?: boolean }) {
  const videos = [
    { url, label: 'Video del catálogo' },
    { url: extraUrl, label: 'Video agregado' },
  ].map((video) => ({ ...video, id: video.url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1] }))
    .filter((video, index, items) => Boolean(video.id) && items.findIndex((item) => item.id === video.id) === index)

  if (!videos.length) return <p className="mt-3 flex items-center gap-2 text-sm text-neutral-500"><PlayCircle size={17} />{pending ? 'Video pendiente: el administrador puede agregar uno sin quitar los del catálogo.' : 'Video no disponible.'}</p>
  return <div className="mt-3 grid gap-3 sm:grid-cols-2">{videos.map((video) => <div key={`${video.label}-${video.id}`}><p className="mb-1 text-xs font-semibold text-neutral-500">{video.label}</p><div className="aspect-video overflow-hidden rounded-xl bg-neutral-950"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${video.id}`} title={video.label} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div><a className="sr-only" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">Abrir en YouTube <ExternalLink size={15} /></a></div>)}</div>
}
