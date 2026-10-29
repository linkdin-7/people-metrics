import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'

import App from '@/App'
import { stubMatchMedia } from '@/test-setup'

const SECTIONS = ['Dashboard', 'Employees', 'Insights', 'Ask a Question']

function renderApp(path = '/dashboard') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  return user
}

function mainNavigation() {
  return screen.getByRole('navigation', { name: 'Main' })
}

function pageHeading(name: string) {
  return screen.findByRole('heading', { level: 1, name })
}

describe('navigation', () => {
  test('shows the brand and one link per section in order', () => {
    renderApp()

    expect(screen.getByRole('link', { name: 'ACME Salary Management home' })).toBeInTheDocument()
    const links = within(mainNavigation()).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(SECTIONS)
  })

  test.each([
    ['/dashboard', 'Dashboard'],
    ['/employees', 'Employees'],
    ['/insights', 'Insights'],
    ['/ask', 'Ask a Question'],
  ])('%s shows the %s page and marks only that link as current', async (path, label) => {
    renderApp(path)

    expect(await pageHeading(label)).toBeInTheDocument()
    const current = within(mainNavigation())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.textContent)).toEqual([label])
  })

  test.each(['/', '/no-such-page'])('redirects %s to the dashboard', async (path) => {
    renderApp(path)

    expect(await pageHeading('Dashboard')).toBeInTheDocument()
  })

  test('clicking a section opens it and updates the breadcrumb', async () => {
    const user = renderApp()

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Employees' }))

    expect(await pageHeading('Employees')).toBeInTheDocument()
    const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })
    expect(within(breadcrumb).getByText('Employees')).toBeInTheDocument()
  })
})

describe('theme', () => {
  test('the toggle switches between light and dark and remembers the choice', async () => {
    const user = renderApp()
    expect(document.documentElement).not.toHaveClass('dark')

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  test('starts with the saved theme', () => {
    localStorage.setItem('theme', 'dark')

    renderApp()

    expect(document.documentElement).toHaveClass('dark')
  })

  test('follows the system preference when nothing is saved', () => {
    stubMatchMedia(true)

    renderApp()

    expect(document.documentElement).toHaveClass('dark')
  })
})

describe('command menu', () => {
  test('Ctrl+K opens it and Enter jumps to the chosen page', async () => {
    const user = renderApp()

    await user.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByRole('combobox'), 'employ')
    await user.keyboard('{Enter}')

    expect(await pageHeading('Employees')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('the header search button opens it', async () => {
    const user = renderApp()

    await user.click(screen.getByRole('button', { name: 'Search or jump to a page' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  test('it can switch the theme', async () => {
    const user = renderApp()

    await user.keyboard('{Control>}k{/Control}')
    await user.type(within(await screen.findByRole('dialog')).getByRole('combobox'), 'dark')
    await user.keyboard('{Enter}')

    expect(document.documentElement).toHaveClass('dark')
  })
})
