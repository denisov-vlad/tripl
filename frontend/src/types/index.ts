export interface Project {
  id: string
  name: string
  slug: string
  description: string
  created_at: string
  updated_at: string
}

export interface EventType {
  id: string
  project_id: string
  name: string
  display_name: string
  description: string
  color: string
  order: number
  created_at: string
  updated_at: string
  field_definitions: FieldDefinition[]
}

export interface EventTypeBrief {
  id: string
  name: string
  display_name: string
  color: string
}

export interface FieldDefinition {
  id: string
  event_type_id: string
  name: string
  display_name: string
  field_type: 'string' | 'number' | 'boolean' | 'json' | 'enum' | 'url'
  is_required: boolean
  enum_options: string[] | null
  description: string
  order: number
}

export interface EventTypeRelation {
  id: string
  project_id: string
  source_event_type_id: string
  target_event_type_id: string
  source_field_id: string
  target_field_id: string
  relation_type: string
  description: string
}

export interface MetaFieldDefinition {
  id: string
  project_id: string
  name: string
  display_name: string
  field_type: 'string' | 'url' | 'boolean' | 'enum' | 'date'
  is_required: boolean
  enum_options: string[] | null
  default_value: string | null
  order: number
}

export interface EventFieldValue {
  id: string
  field_definition_id: string
  value: string
}

export interface EventMetaValue {
  id: string
  meta_field_definition_id: string
  value: string
}

export interface Event {
  id: string
  project_id: string
  event_type_id: string
  event_type: EventTypeBrief
  name: string
  description: string
  field_values: EventFieldValue[]
  meta_values: EventMetaValue[]
  created_at: string
  updated_at: string
}

export interface EventListResponse {
  items: Event[]
  total: number
}
