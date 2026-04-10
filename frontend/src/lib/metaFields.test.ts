import { describe, expect, it } from 'vitest'
import { resolveMetaFieldHref } from './metaFields'

describe('resolveMetaFieldHref', () => {
  it('builds link from template while keeping stored value separate', () => {
    expect(resolveMetaFieldHref(
      { field_type: 'string', link_template: 'https://tracker.example.com/issues/${value}' },
      'TASK-123',
    )).toBe('https://tracker.example.com/issues/TASK-123')
  })

  it('falls back to raw url values for url fields without template', () => {
    expect(resolveMetaFieldHref(
      { field_type: 'url', link_template: null },
      'https://example.com/task/42',
    )).toBe('https://example.com/task/42')
  })

  it('returns null for empty values', () => {
    expect(resolveMetaFieldHref(
      { field_type: 'string', link_template: 'https://example.com/${value}' },
      '',
    )).toBeNull()
  })
})
