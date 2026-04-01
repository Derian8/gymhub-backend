import { expect, type Page } from '@playwright/test'

export async function login(page: Page, email: string, password: string, dashboardTestId: string) {
  await page.goto('/login')
  await expect(page.getByTestId('login-form')).toBeVisible()

  await page.getByTestId('email-input').fill(email)
  await page.getByTestId('password-input').fill(password)
  await page.getByTestId('login-submit').click()

  await expect(page.getByTestId(dashboardTestId)).toBeVisible()
}
