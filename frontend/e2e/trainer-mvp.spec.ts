import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Trainer MVP', () => {
  test('trainer can review dashboard, members, alerts and logout', async ({ page }) => {
    await login(page, 'trainer1@gymhub.com', 'trainer123!', 'trainer-dashboard')

    await expect(page.getByTestId('stat-total-members')).toBeVisible()
    await page.getByTestId('quick-members').click()

    await expect(page.getByTestId('members-page')).toBeVisible()
    await expect(page.getByTestId('member-row-1')).toBeVisible()
    await page.getByTestId('member-detail-1').click()

    await expect(page.getByTestId('member-detail-page')).toBeVisible()
    await expect(page.getByTestId('member-profile-card')).toBeVisible()

    await page.getByTestId('nav-alerts').click()
    await expect(page.getByTestId('alerts-page')).toBeVisible()

    await page.getByTestId('filter-resolved').click()
    await expect(page.getByTestId('alerts-page')).toBeVisible()

    await page.getByTestId('nav-profile').click()
    await expect(page.getByTestId('profile-page')).toBeVisible()

    await page.getByTestId('logout-button').click()
    await expect(page.getByTestId('login-form')).toBeVisible()
  })
})
