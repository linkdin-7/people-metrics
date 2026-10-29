import { describe, expect, test } from 'vitest'

import { comparePay, describeTenure } from '@/lib/format'

const TODAY = new Date(2026, 9, 29)

describe('describeTenure', () => {
  test.each([
    ['2022-04-01', '4 years 6 months'],
    ['2025-10-29', '1 year'],
    ['2024-09-28', '2 years 1 month'],
    ['2026-02-15', '8 months'],
    ['2026-10-17', '12 days'],
    ['2026-10-28', '1 day'],
    ['2026-10-29', 'Joined today'],
    ['2026-10-30', 'Starts tomorrow'],
    ['2026-11-12', 'Starts in 14 days'],
  ])('hired %s reads "%s"', (hireDate, expected) => {
    expect(describeTenure(hireDate, TODAY)).toBe(expected)
  })
})

describe('comparePay', () => {
  const peers = { min_salary: 800000, median_salary: 1200000, max_salary: 2000000 }

  test('describes the difference from the median in whole percent', () => {
    expect(comparePay(1300000, peers).label).toBe('8% above the median')
    expect(comparePay(1080000, peers).label).toBe('10% below the median')
    expect(comparePay(1203000, peers).label).toBe('Right at the median')
  })

  test('places the salary and the median between the lowest and highest pay', () => {
    expect(comparePay(1400000, peers)).toMatchObject({ position: 0.5, medianPosition: 1 / 3 })
  })

  test('a group where everyone earns the same sits in the middle', () => {
    expect(comparePay(500, { min_salary: 500, median_salary: 500, max_salary: 500 })).toMatchObject({
      position: 0.5,
      medianPosition: 0.5,
      label: 'Right at the median',
    })
  })
})
