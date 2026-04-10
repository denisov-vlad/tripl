import type { MetaFieldDefinition } from '@/types'

export const META_FIELD_LINK_PLACEHOLDER = '${value}'

export function resolveMetaFieldHref(
  metaField: Pick<MetaFieldDefinition, 'field_type' | 'link_template'>,
  value: string,
) {
  if (!value) {
    return null
  }
  if (metaField.link_template) {
    return metaField.link_template.replaceAll(META_FIELD_LINK_PLACEHOLDER, value)
  }
  if (metaField.field_type === 'url') {
    return value
  }
  return null
}
