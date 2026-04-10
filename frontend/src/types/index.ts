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

export interface EventTag {
  id: string
  name: string
}

export interface Event {
  id: string
  project_id: string
  event_type_id: string
  event_type: EventTypeBrief
  name: string
  description: string
  implemented: boolean
  reviewed: boolean
  archived: boolean
  tags: EventTag[]
  field_values: EventFieldValue[]
  meta_values: EventMetaValue[]
  created_at: string
  updated_at: string
}

export interface EventListResponse {
  items: Event[]
  total: number
}

export type VariableType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json' | 'string_array' | 'number_array'

export interface Variable {
  id: string
  project_id: string
  name: string
  source_name: string | null
  variable_type: VariableType
  description: string
}

export type DbType = 'clickhouse'

export interface DataSource {
  id: string
  name: string
  db_type: DbType
  host: string
  port: number
  database_name: string
  username: string
  password_set: boolean
  extra_params: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type IntervalCode = '15m' | '1h' | '6h' | '1d' | '1w'

export interface ScanConfig {
  id: string
  data_source_id: string
  project_id: string
  event_type_id: string | null
  name: string
  base_query: string
  event_type_column: string | null
  time_column: string | null
  event_name_format: string | null
  cardinality_threshold: number
  interval: IntervalCode | null
  created_at: string
  updated_at: string
}

export interface ProjectAnomalySettings {
  id: string
  project_id: string
  anomaly_detection_enabled: boolean
  detect_project_total: boolean
  detect_event_types: boolean
  detect_events: boolean
  baseline_window_buckets: number
  min_history_buckets: number
  sigma_threshold: number
  min_expected_count: number
  created_at: string
  updated_at: string
}

export interface ScanJob {
  id: string
  scan_config_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string | null
  completed_at: string | null
  result_summary: {
    events_created?: number
    events_skipped?: number
    variables_created?: number
    columns_analyzed?: number
    event_metrics?: number
    type_metrics?: number
    anomalies_detected?: number
    signals_added?: number
    details?: string[]
  } | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface EventMetricPoint {
  bucket: string
  count: number
  expected_count: number | null
  is_anomaly: boolean
  anomaly_direction: 'spike' | 'drop' | null
  z_score: number | null
}

export interface MonitoringSignal {
  scan_config_id: string
  scope_type: 'project_total' | 'event_type' | 'event'
  scope_ref: string
  event_id: string | null
  event_type_id: string | null
  bucket: string
  actual_count: number
  expected_count: number
  stddev: number
  z_score: number
  direction: 'spike' | 'drop'
}

export interface EventMetricsResponse {
  scope: 'project_total' | 'event_type' | 'event' | 'events_total'
  scan_config_id: string | null
  event_id: string | null
  event_type_id: string | null
  interval: string | null
  latest_signal: MonitoringSignal | null
  data: EventMetricPoint[]
}
