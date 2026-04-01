import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Member MVP', () => {
  test('member can complete today workout, review billing and logout', async ({ page }) => {
    await login(page, 'member1@gymhub.com', 'member123!', 'member-dashboard')

    await expect(page.getByTestId('card-workout')).toBeVisible()
    await page.getByTestId('card-workout').click()

    await expect(page.getByTestId('today-workout-page')).toBeVisible()
    await page.getByTestId('start-session-btn').click()
    await expect(page.getByTestId('complete-session-btn')).toBeVisible()
    await page.getByTestId('complete-session-btn').click()
    await expect(page.getByTestId('start-session-btn')).toBeVisible()

    await page.getByTestId('nav-billing').click()
    await expect(page.getByTestId('billing-page')).toBeVisible()
    await expect(page.getByTestId('payment-row-1')).toBeVisible()

    await page.getByTestId('nav-profile').click()
    await expect(page.getByTestId('profile-page')).toBeVisible()

    await page.getByTestId('logout-button').click()
    await expect(page.getByTestId('login-form')).toBeVisible()
  })
})
