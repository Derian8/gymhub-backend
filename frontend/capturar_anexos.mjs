import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://proyectoappgym-frontend.vercel.app'
const salida = resolve(process.cwd(), '../docs/gymhub_expotecnica/imagenes')
const navegadorInstalado = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  '/home/dev/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'

async function iniciarSesion(page, email, password, destino) {
  console.log(`Abriendo inicio de sesión para ${destino}`)
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 8_000 })
  console.log('Página de inicio de sesión cargada')
  await page.getByTestId('login-form').waitFor({ timeout: 8_000 })
  console.log('Formulario visible')
  await page.getByTestId('email-input').fill(email)
  await page.getByTestId('password-input').fill(password)
  console.log('Credenciales de demostración ingresadas')
  await page.getByTestId('login-submit').click()
  console.log('Solicitud de inicio de sesión enviada')
  await page.getByTestId(destino).waitFor({ timeout: 20_000 })
  console.log(`Sesión activa: ${destino}`)
}

async function capturar(page, nombre) {
  await page.screenshot({ path: resolve(salida, nombre), fullPage: true })
  console.log(`Captura creada: ${nombre}`)
}

await mkdir(salida, { recursive: true })
const navegador = await chromium.launch({
  headless: true,
  executablePath: navegadorInstalado,
  args: ['--disable-gpu', '--disable-software-rasterizer'],
})
try {
  const entrenador = await navegador.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await iniciarSesion(entrenador, 'trainer1@gymhub.com', 'trainer123!', 'trainer-dashboard')
  await capturar(entrenador, 'captura_actual_panel_entrenador.png')
  await entrenador.goto(`${baseUrl}/plans`, { waitUntil: 'domcontentloaded' })
  await entrenador.getByTestId('plans-page').waitFor()
  await capturar(entrenador, 'captura_actual_planes_entrenador.png')

  const miembro = await navegador.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await iniciarSesion(miembro, 'member1@gymhub.com', 'member123!', 'member-dashboard')
  await capturar(miembro, 'captura_actual_panel_miembro.png')
  await miembro.goto(`${baseUrl}/membership`, { waitUntil: 'domcontentloaded' })
  await miembro.getByTestId('billing-page').waitFor()
  await capturar(miembro, 'captura_actual_membresia_miembro.png')

  const entrenadorMovil = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await iniciarSesion(entrenadorMovil, 'trainer1@gymhub.com', 'trainer123!', 'trainer-dashboard')
  await capturar(entrenadorMovil, 'captura_actual_movil_entrenador.png')

  const miembroMovil = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await iniciarSesion(miembroMovil, 'member1@gymhub.com', 'member123!', 'member-dashboard')
  await capturar(miembroMovil, 'captura_actual_movil_miembro.png')
} finally {
  await navegador.close()
}
