import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const salida = resolve(process.cwd(), '../docs/gymhub_expotecnica/imagenes')
const grupo = process.env.CAPTURA_GRUPO || 'todas'
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

async function cambiarContexto(page, contexto, destino) {
  await page.getByTestId('active-context-selector').selectOption(contexto)
  await page.getByTestId(destino).waitFor({ timeout: 8_000 })
}

await mkdir(salida, { recursive: true })
const navegador = await chromium.launch({
  headless: true,
  executablePath: navegadorInstalado,
  args: ['--disable-gpu', '--disable-software-rasterizer'],
})
try {
  const administrador = await navegador.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await iniciarSesion(administrador, 'trainer1@gymhub.com', 'trainer123!', 'admin-dashboard')
  if (grupo !== 'roles') {
    await capturar(administrador, 'captura_actual_panel_administrador.png')
    await administrador.goto(`${baseUrl}/billing`, { waitUntil: 'domcontentloaded' })
    await administrador.getByTestId('billing-page').waitFor()
    await capturar(administrador, 'captura_actual_facturacion_administrador.png')
    await administrador.goto(`${baseUrl}/attendance`, { waitUntil: 'domcontentloaded' })
    await administrador.getByTestId('attendance-search').waitFor()
    await capturar(administrador, 'captura_actual_asistencia_administrador.png')
  }

  await cambiarContexto(administrador, 'instructor', 'trainer-dashboard')
  await administrador.goto(`${baseUrl}/plans`, { waitUntil: 'domcontentloaded' })
  await administrador.getByTestId('plans-page').waitFor()
  await administrador.getByTestId('open-create-plan-wizard').click()
  await administrador.getByTestId('wizard-plan-name').waitFor()
  await capturar(administrador, 'captura_actual_planes_instructor.png')

  const miembro = await navegador.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await iniciarSesion(miembro, 'member1@gymhub.com', 'member123!', 'member-dashboard')
  await capturar(miembro, 'captura_actual_panel_miembro.png')
  await miembro.goto(`${baseUrl}/today`, { waitUntil: 'domcontentloaded' })
  await miembro.getByTestId('today-workout-page').waitFor()
  await capturar(miembro, 'captura_actual_rutina_miembro.png')

  const instructorMovil = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await iniciarSesion(instructorMovil, 'trainer1@gymhub.com', 'trainer123!', 'admin-dashboard')
  await cambiarContexto(instructorMovil, 'instructor', 'trainer-dashboard')
  await capturar(instructorMovil, 'captura_actual_movil_instructor.png')

  const miembroMovil = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await iniciarSesion(miembroMovil, 'member1@gymhub.com', 'member123!', 'member-dashboard')
  await capturar(miembroMovil, 'captura_actual_movil_miembro.png')
} finally {
  await navegador.close()
}
