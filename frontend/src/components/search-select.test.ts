import { describe, expect, test } from 'vitest'

import { rankMatch } from '@/lib/utils'

describe('rankMatch', () => {
  test('an exact name or code ranks highest', () => {
    expect(rankMatch('India', 'india')).toBe(1)
    expect(rankMatch('India', 'in', ['IN'])).toBe(1)
  })

  test('names that start with the search come before names with a matching word', () => {
    expect(rankMatch('India', 'ind')).toBeGreaterThan(rankMatch('British Indian Ocean Territory', 'ind'))
  })

  test('a word that starts with the search beats text found inside a word', () => {
    expect(rankMatch('British Indian Ocean Territory', 'ind')).toBeGreaterThan(rankMatch('Sindh', 'ind'))
    expect(rankMatch('Tunisia', 'uni')).toBeGreaterThan(0)
  })

  test('letters scattered across a name do not count as a match', () => {
    expect(rankMatch('Heard Island and McDonald Islands', 'india')).toBe(0)
    expect(rankMatch('Trinidad and Tobago', 'india')).toBe(0)
  })

  test('within the same kind of match, shorter names come first', () => {
    expect(rankMatch('United States', 'uni')).toBeGreaterThan(
      rankMatch('United States Minor Outlying Islands', 'uni'),
    )
    expect(rankMatch('United States Minor Outlying Islands', 'uni')).toBeGreaterThan(
      rankMatch('British Indian Ocean Territory', 'ind'),
    )
  })

  test('an empty search keeps every option', () => {
    expect(rankMatch('Germany', '  ')).toBe(1)
  })
})
