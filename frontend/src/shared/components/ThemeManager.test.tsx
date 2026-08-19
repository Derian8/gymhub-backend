import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useAuthStore } from '@/shared/store/authStore'
import { ThemeManager } from './ThemeManager'

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})

describe('ThemeManager', () => {
  it('applies light mode to the document root', () => {
    useAuthStore.setState({ theme: 'light' })

    render(<ThemeManager />)

    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('updates the document when the saved theme changes', () => {
    useAuthStore.setState({ theme: 'dark' })
    render(<ThemeManager />)

    act(() => {
      useAuthStore.getState().toggleTheme()
    })

    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('persists the selected theme outside the authentication session', () => {
    useAuthStore.setState({ theme: 'dark' })

    act(() => {
      useAuthStore.getState().setTheme('light')
    })

    expect(localStorage.getItem('gymhub-theme')).toBe('light')
    expect(JSON.parse(localStorage.getItem('gymhub-auth') || '{}')).not.toHaveProperty('state.theme')
  })
})
