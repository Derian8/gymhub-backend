import { useState } from 'react'
import { useChangePasswordMutation } from '../hooks/useAuthMutations'

export function ChangePasswordPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const changePassword = useChangePasswordMutation()
  const valid = next.length >= 8 && next === confirmation && current.length > 0

  return (
    <div className="mx-auto max-w-lg page-enter">
      <section className="card p-6 sm:p-8">
        <p className="label-base">Seguridad obligatoria</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-neutral-900 dark:text-white">Crea tu contraseña personal</h1>
        <p className="mt-2 text-sm text-neutral-500">La contraseña temporal deja de funcionar cuando guardes esta nueva contraseña.</p>
        <form className="mt-6 space-y-4" onSubmit={(event) => {
          event.preventDefault()
          if (valid) changePassword.mutate({ contrasena_actual: current, contrasena_nueva: next })
        }}>
          <label className="block"><span className="label-base">Contraseña temporal</span><input className="input-base mt-2 w-full" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" /></label>
          <label className="block"><span className="label-base">Nueva contraseña</span><input className="input-base mt-2 w-full" type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" /></label>
          <label className="block"><span className="label-base">Confirmar nueva contraseña</span><input className="input-base mt-2 w-full" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" /></label>
          {confirmation && next !== confirmation ? <p className="text-sm text-red-500">Las contraseñas no coinciden.</p> : null}
          <button className="btn-primary w-full" disabled={!valid || changePassword.isPending}>Guardar contraseña</button>
        </form>
      </section>
    </div>
  )
}
