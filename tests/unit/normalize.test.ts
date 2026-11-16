import { describe, expect, it } from 'vitest'
import { diffFields } from '../../src/main/domain/audit'
import { blankToNull, isHttpUrl, nameKey, suggestPlatformFromUrl } from '../../src/main/domain/normalize'
import { toFtsQuery } from '../../src/main/services/search'

describe('nameKey', () => {
  it('ignores accents, case and extra spaces', () => {
    expect(nameKey('  Ações   Brasil ')).toBe('acoes brasil')
    expect(nameKey('NUBANK')).toBe(nameKey('Nubank'))
  })
})

describe('blankToNull', () => {
  it('trims and nulls blanks', () => {
    expect(blankToNull('  x ')).toBe('x')
    expect(blankToNull('   ')).toBeNull()
    expect(blankToNull(undefined)).toBeNull()
    expect(blankToNull(null)).toBeNull()
  })
})

describe('suggestPlatformFromUrl', () => {
  it('maps known job board domains without fetching anything', () => {
    expect(suggestPlatformFromUrl('https://www.linkedin.com/jobs/view/123')).toBe('linkedin')
    expect(suggestPlatformFromUrl('https://empresa.gupy.io/jobs/1')).toBe('gupy')
    expect(suggestPlatformFromUrl('https://boards.greenhouse.io/x/jobs/1')).toBe('greenhouse')
    expect(suggestPlatformFromUrl('https://jobs.lever.co/x/1')).toBe('lever')
    expect(suggestPlatformFromUrl('https://x.wd1.myworkdayjobs.com/en-US/1')).toBe('workday')
    expect(suggestPlatformFromUrl('https://example.com')).toBeNull()
    expect(suggestPlatformFromUrl('not a url')).toBeNull()
  })
})

describe('isHttpUrl', () => {
  it('accepts only http and https', () => {
    expect(isHttpUrl('https://a.com')).toBe(true)
    expect(isHttpUrl('http://a.com')).toBe(true)
    expect(isHttpUrl('file:///c:/x')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('diffFields', () => {
  it('returns only changed fields as [before, after]', () => {
    expect(
      diffFields({ a: 1, b: 'x', c: null, updatedAt: 'x' }, { a: 1, b: 'y', c: undefined, updatedAt: 'y' })
    ).toEqual({
      b: ['x', 'y']
    })
  })
  it('compares objects by value', () => {
    expect(diffFields({ a: { x: 1 } }, { a: { x: 1 } })).toEqual({})
  })
})

describe('toFtsQuery', () => {
  it('quotes each word as a prefix term and drops operators', () => {
    expect(toFtsQuery('engenheira "dados" OR')).toBe('"engenheira"* "dados"* "OR"*')
    expect(toFtsQuery('  ')).toBeNull()
  })
})
