import { getProductionRedirectUrl, isPreviewBypassEnabled, shouldRedirectPreviewToProduction } from './runtimeInfo'

describe('runtimeInfo preview coordination', () => {
  it('redirects preview deployments to production by default', () => {
    expect(
      shouldRedirectPreviewToProduction(
        'proyectoappgym-frontend-abc123-derian8s-projects.vercel.app',
        '',
      ),
    ).toBe(true)
  })

  it('keeps preview open when the explicit bypass flag is present', () => {
    expect(isPreviewBypassEnabled('?preview=1')).toBe(true)
    expect(
      shouldRedirectPreviewToProduction(
        'proyectoappgym-frontend-abc123-derian8s-projects.vercel.app',
        '?preview=1',
      ),
    ).toBe(false)
  })

  it('preserves route and query params when redirecting to production', () => {
    expect(
      getProductionRedirectUrl('/today', '?foo=bar', '#resumen'),
    ).toBe('https://proyectoappgym-frontend.vercel.app/today?foo=bar#resumen')
  })

  it('removes the preview bypass flag from the redirected production url', () => {
    expect(
      getProductionRedirectUrl('/today', '?preview=1&foo=bar', ''),
    ).toBe('https://proyectoappgym-frontend.vercel.app/today?foo=bar')
  })
})
