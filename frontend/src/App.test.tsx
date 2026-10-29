import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import App from '@/App'

test('shows the application title and a shadcn button', () => {
  render(<App />)

  expect(
    screen.getByRole('heading', { name: 'ACME Salary Management' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument()
})
