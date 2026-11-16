import { describe, expect, it } from 'vitest'
import { centsToInput, formatMoney, parseMoneyToCents } from '../../src/renderer/src/lib/format'

describe('money parsing (pt-BR input)', () => {
  it('parses Brazilian and plain formats into integer cents', () => {
    expect(parseMoneyToCents('12.500,50')).toBe(1_250_050)
    expect(parseMoneyToCents('12500')).toBe(1_250_000)
    expect(parseMoneyToCents('12500.5')).toBe(1_250_050)
    expect(parseMoneyToCents(' 1 000,00 ')).toBe(100_000)
    expect(parseMoneyToCents('')).toBeNull()
    expect(parseMoneyToCents('abc')).toBeNaN()
    expect(parseMoneyToCents('-5')).toBeNaN()
  })
  it('round-trips through the form representation', () => {
    expect(parseMoneyToCents(centsToInput(1_250_050))).toBe(1_250_050)
  })
  it('always shows the currency', () => {
    expect(formatMoney(150_000, 'USD')).toMatch(/US\$|USD/)
    expect(formatMoney(null, 'BRL')).toBe('—')
  })
})
