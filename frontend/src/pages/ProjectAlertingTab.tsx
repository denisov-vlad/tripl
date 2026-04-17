import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Pencil, Plus, Send, Trash2, Webhook } from 'lucide-react'

import { alertingApi } from '@/api/alerting'
import { eventTypesApi } from '@/api/eventTypes'
import { eventsApi } from '@/api/events'
import { scansApi } from '@/api/scans'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useConfirm } from '@/hooks/useConfirm'
import type {
  AlertDelivery,
  AlertDestination,
  AlertMessageFormat,
  AlertRule,
  Event,
  EventType,
} from '@/types'

type DestinationFormState = {
  type: 'slack' | 'telegram'
  name: string
  enabled: boolean
  webhook_url: string
  bot_token: string
  chat_id: string
}

type RuleFormState = {
  name: string
  enabled: boolean
  include_project_total: boolean
  include_event_types: boolean
  include_events: boolean
  notify_on_spike: boolean
  notify_on_drop: boolean
  min_percent_delta: number
  min_absolute_delta: number
  min_expected_count: number
  cooldown_minutes: number
  message_template: string
  items_template: string
  message_format: AlertMessageFormat
  excluded_event_type_ids: string[]
  excluded_event_ids: string[]
}

const TEMPLATE_VARIABLE_OPTIONS = [
  { name: 'project_name', description: 'Project display name' },
  { name: 'project_slug', description: 'Project slug' },
  { name: 'channel', description: 'Destination channel' },
  { name: 'destination_name', description: 'Destination name' },
  { name: 'rule_name', description: 'Rule name' },
  { name: 'scan_name', description: 'Scan config name' },
  { name: 'matched_count', description: 'Number of matched alert items' },
  { name: 'items_count', description: 'Alias for matched_count' },
  { name: 'items_text', description: 'Preformatted list of all matched alert items' },
] as const

const ITEM_TEMPLATE_VARIABLE_OPTIONS = [
  { name: 'scope_name', description: 'Matched scope name' },
  { name: 'scope_type', description: 'Matched scope type' },
  { name: 'scope_label', description: 'Matched scope label' },
  { name: 'direction', description: 'Direction: spike or drop' },
  { name: 'direction_label', description: 'Direction: up or down' },
  { name: 'actual_count', description: 'Actual count' },
  { name: 'expected_count', description: 'Expected count' },
  { name: 'absolute_delta', description: 'Absolute delta' },
  { name: 'percent_delta', description: 'Percent delta' },
  { name: 'bucket', description: 'Anomaly bucket timestamp' },
  { name: 'details_url', description: 'Details URL' },
  { name: 'monitoring_url', description: 'Monitoring URL' },
  { name: 'details_line', description: 'Rendered details line with leading newline when URL exists' },
  { name: 'monitoring_line', description: 'Rendered monitoring line with leading newline when URL exists' },
] as const

const DEFAULT_MESSAGE_TEMPLATES: Record<AlertMessageFormat, string> = {
  plain: [
    '[tripl] ${matched_count} alerts',
    'Project delivery via ${channel}: ${destination_name}',
    'Rule: ${rule_name}',
    'Scan: ${scan_name}',
    '',
    '${items_text}',
  ].join('\n'),
  slack_mrkdwn: [
    '*[tripl] ${matched_count} alerts*',
    'Project delivery via ${channel}: ${destination_name}',
    'Rule: *${rule_name}*',
    'Scan: `${scan_name}`',
    '',
    '${items_text}',
  ].join('\n'),
  telegram_html: [
    '<b>[tripl] ${matched_count} alerts</b>',
    'Project delivery via ${channel}: ${destination_name}',
    'Rule: <b>${rule_name}</b>',
    'Scan: <code>${scan_name}</code>',
    '',
    '${items_text}',
  ].join('\n'),
  telegram_markdownv2: [
    '*tripl: ${matched_count} alerts*',
    'Project delivery via ${channel}: ${destination_name}',
    'Rule: *${rule_name}*',
    'Scan: `${scan_name}`',
    '',
    '${items_text}',
  ].join('\n'),
}

const DEFAULT_ITEMS_TEMPLATES: Record<AlertMessageFormat, string> = {
  plain: '- ${scope_label} ${scope_name}: ${direction_label}, actual=${actual_count}, expected=${expected_count}, delta=${absolute_delta} (${percent_delta}%)${details_line}${monitoring_line}',
  slack_mrkdwn: '- ${scope_label} ${scope_name}: ${direction_label}, actual=${actual_count}, expected=${expected_count}, delta=${absolute_delta} (${percent_delta}%)${details_line}${monitoring_line}',
  telegram_html: '- ${scope_label} ${scope_name}: ${direction_label}, actual=${actual_count}, expected=${expected_count}, delta=${absolute_delta} (${percent_delta}%)${details_line}${monitoring_line}',
  telegram_markdownv2: '\\- ${scope_label} ${scope_name}: ${direction_label}, actual=${actual_count}, expected=${expected_count}, delta=${absolute_delta} \\(${percent_delta}%\\)${details_line}${monitoring_line}',
}

const MESSAGE_FORMAT_OPTIONS: Record<'slack' | 'telegram', { value: AlertMessageFormat; label: string }[]> = {
  slack: [
    { value: 'plain', label: 'Plain text' },
    { value: 'slack_mrkdwn', label: 'Slack mrkdwn' },
  ],
  telegram: [
    { value: 'plain', label: 'Plain text' },
    { value: 'telegram_html', label: 'Telegram HTML' },
    { value: 'telegram_markdownv2', label: 'Telegram MarkdownV2' },
  ],
}

const FORMAT_HELP: Record<AlertMessageFormat, string[]> = {
  plain: [
    'No rich formatting. Variables are inserted as plain text.',
  ],
  slack_mrkdwn: [
    '*bold*',
    '_italic_',
    '~strike~',
    '`code`',
    'Slack mrkdwn does not support underline.',
  ],
  telegram_html: [
    '<b>bold</b>',
    '<i>italic</i>',
    '<u>underline</u>',
    '<s>strike</s>',
    '<code>code</code>',
  ],
  telegram_markdownv2: [
    '*bold*',
    '_italic_',
    '__underline__',
    '~strike~',
    '`code`',
  ],
}

function defaultDestinationForm(type: 'slack' | 'telegram'): DestinationFormState {
  return {
    type,
    name: '',
    enabled: true,
    webhook_url: '',
    bot_token: '',
    chat_id: '',
  }
}

function getDefaultMessageTemplate(messageFormat: AlertMessageFormat): string {
  return DEFAULT_MESSAGE_TEMPLATES[messageFormat]
}

function getDefaultItemsTemplate(messageFormat: AlertMessageFormat): string {
  return DEFAULT_ITEMS_TEMPLATES[messageFormat]
}

function normalizeRuleTemplate(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function isDefaultMessageTemplate(
  value: string | null | undefined,
  messageFormat: AlertMessageFormat,
): boolean {
  return normalizeRuleTemplate(value) === normalizeRuleTemplate(getDefaultMessageTemplate(messageFormat))
}

function isDefaultItemsTemplate(
  value: string | null | undefined,
  messageFormat: AlertMessageFormat,
): boolean {
  return normalizeRuleTemplate(value) === normalizeRuleTemplate(getDefaultItemsTemplate(messageFormat))
}

function defaultRuleForm(): RuleFormState {
  return {
    name: '',
    enabled: true,
    include_project_total: true,
    include_event_types: true,
    include_events: true,
    notify_on_spike: true,
    notify_on_drop: true,
    min_percent_delta: 0,
    min_absolute_delta: 0,
    min_expected_count: 0,
    cooldown_minutes: 1440,
    message_template: getDefaultMessageTemplate('plain'),
    items_template: getDefaultItemsTemplate('plain'),
    message_format: 'plain',
    excluded_event_type_ids: [],
    excluded_event_ids: [],
  }
}

function ruleToForm(rule: AlertRule): RuleFormState {
  return {
    name: rule.name,
    enabled: rule.enabled,
    include_project_total: rule.include_project_total,
    include_event_types: rule.include_event_types,
    include_events: rule.include_events,
    notify_on_spike: rule.notify_on_spike,
    notify_on_drop: rule.notify_on_drop,
    min_percent_delta: rule.min_percent_delta,
    min_absolute_delta: rule.min_absolute_delta,
    min_expected_count: rule.min_expected_count,
    cooldown_minutes: rule.cooldown_minutes,
    message_template: rule.message_template ?? getDefaultMessageTemplate(rule.message_format),
    items_template: rule.items_template ?? getDefaultItemsTemplate(rule.message_format),
    message_format: rule.message_format,
    excluded_event_type_ids: rule.excluded_event_type_ids,
    excluded_event_ids: rule.excluded_event_ids,
  }
}

function ruleFormToPayload(ruleForm: RuleFormState) {
  const normalizedTemplate = normalizeRuleTemplate(ruleForm.message_template)
  const normalizedItemsTemplate = normalizeRuleTemplate(ruleForm.items_template)
  return {
    ...ruleForm,
    message_template:
      !normalizedTemplate || isDefaultMessageTemplate(normalizedTemplate, ruleForm.message_format)
        ? null
        : normalizedTemplate,
    items_template:
      !normalizedItemsTemplate || isDefaultItemsTemplate(normalizedItemsTemplate, ruleForm.message_format)
        ? null
        : normalizedItemsTemplate,
  }
}

function formatCooldown(minutes: number) {
  if (minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

function scopeSummary(rule: AlertRule) {
  return [
    rule.include_project_total ? 'total' : null,
    rule.include_event_types ? 'groups' : null,
    rule.include_events ? 'events' : null,
  ].filter(Boolean).join(', ')
}

function directionSummary(rule: AlertRule) {
  return [
    rule.notify_on_spike ? 'up' : null,
    rule.notify_on_drop ? 'down' : null,
  ].filter(Boolean).join(' / ')
}

function findTemplateVariableToken(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor)
  const start = beforeCursor.lastIndexOf('${')
  if (start === -1) return null
  if (beforeCursor.indexOf('}', start) !== -1) return null
  const query = beforeCursor.slice(start + 2)
  if (!/^[a-zA-Z0-9_]*$/.test(query)) return null
  return { start, end: cursor, query }
}

function TemplateEditor({
  destinationType,
  messageFormat,
  onMessageFormatChange,
  title,
  variableOptions,
  helperText,
  showFormatSelector,
  placeholder,
  value,
  onChange,
}: {
  destinationType: 'slack' | 'telegram'
  messageFormat: AlertMessageFormat
  onMessageFormatChange: (value: AlertMessageFormat) => void
  title: string
  variableOptions: readonly { name: string; description: string }[]
  helperText: string
  showFormatSelector?: boolean
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [activeToken, setActiveToken] = useState<{ start: number; end: number; query: string } | null>(null)

  const suggestions = useMemo(() => {
    if (!activeToken) return []
    const needle = activeToken.query.toLowerCase()
    return variableOptions.filter(option =>
      !needle || option.name.toLowerCase().includes(needle),
    ).slice(0, 8)
  }, [activeToken, variableOptions])

  const updateToken = (nextValue: string, cursor: number) => {
    setActiveToken(findTemplateVariableToken(nextValue, cursor))
  }

  const insertVariable = (variableName: string) => {
    const textarea = textareaRef.current
    const currentValue = value
    const fallbackPosition = textarea?.selectionStart ?? currentValue.length
    const start = activeToken?.start ?? fallbackPosition
    const end = activeToken?.end ?? fallbackPosition
    const insertion = `\${${variableName}}`
    const nextValue = currentValue.slice(0, start) + insertion + currentValue.slice(end)
    onChange(nextValue)
    setActiveToken(null)

    requestAnimationFrame(() => {
      const nextCursor = start + insertion.length
      textarea?.focus()
      textarea?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
        <div className="grid gap-2">
          <Label>Message Format</Label>
          {showFormatSelector !== false ? (
            <>
              <Select
                value={messageFormat}
                onValueChange={nextValue => onMessageFormatChange(nextValue as AlertMessageFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_FORMAT_OPTIONS[destinationType].map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                {FORMAT_HELP[messageFormat].map(helpLine => (
                  <div key={helpLine} className="font-mono leading-5">
                    {helpLine}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              Uses the same escaping and channel formatting as the selected message format.
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label>{title}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm">Variables</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[28rem] space-y-2">
                <div className="text-sm font-medium">Available variables</div>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {variableOptions.map(option => (
                    <button
                      key={option.name}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => insertVariable(option.name)}
                    >
                      <span className="font-mono text-xs">{`\${${option.name}}`}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={value}
              rows={8}
              placeholder={placeholder}
              onChange={event => {
                onChange(event.target.value)
                updateToken(event.target.value, event.target.selectionStart ?? event.target.value.length)
              }}
              onClick={event => updateToken(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
              onKeyUp={event => updateToken(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
            />
            {activeToken && suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-md border bg-popover p-1 shadow-md">
                {suggestions.map(option => (
                  <button
                    key={option.name}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => insertVariable(option.name)}
                  >
                    <span className="font-mono text-xs">{`\${${option.name}}`}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {helperText}
          </p>
        </div>
      </div>
    </div>
  )
}

function DestinationCard({
  slug,
  destination,
  eventTypes,
  events,
  onEditDestination,
}: {
  slug: string
  destination: AlertDestination
  eventTypes: EventType[]
  events: Event[]
  onEditDestination: (destination: AlertDestination) => void
}) {
  const qc = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [ruleForm, setRuleForm] = useState<RuleFormState>(defaultRuleForm())

  const updateDestinationMut = useMutation({
    mutationFn: (data: { enabled?: boolean }) =>
      alertingApi.updateDestination(slug, destination.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertDestinations', slug] }),
  })

  const createRuleMut = useMutation({
    mutationFn: () => alertingApi.createRule(slug, destination.id, ruleFormToPayload(ruleForm)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertDestinations', slug] })
      setRuleDialogOpen(false)
      setEditingRule(null)
      setRuleForm(defaultRuleForm())
    },
  })

  const updateRuleMut = useMutation({
    mutationFn: () => {
      if (!editingRule) throw new Error('Missing rule')
      return alertingApi.updateRule(slug, destination.id, editingRule.id, ruleFormToPayload(ruleForm))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertDestinations', slug] })
      setRuleDialogOpen(false)
      setEditingRule(null)
      setRuleForm(defaultRuleForm())
    },
  })

  const deleteRuleMut = useMutation({
    mutationFn: (ruleId: string) => alertingApi.deleteRule(slug, destination.id, ruleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertDestinations', slug] }),
  })

  const openNewRule = () => {
    setEditingRule(null)
    setRuleForm(defaultRuleForm())
    setRuleDialogOpen(true)
  }

  const openEditRule = (rule: AlertRule) => {
    setEditingRule(rule)
    setRuleForm(ruleToForm(rule))
    setRuleDialogOpen(true)
  }

  const handleDeleteRule = async (rule: AlertRule) => {
    const ok = await confirm({
      title: 'Delete alert rule',
      message: `Delete "${rule.name}"?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteRuleMut.mutate(rule.id)
  }

  const ruleMutation = editingRule ? updateRuleMut : createRuleMut

  return (
    <>
      {dialog}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{destination.name}</span>
                <Badge variant="outline" className="uppercase text-[10px]">
                  {destination.type}
                </Badge>
                <Badge variant={destination.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {destination.enabled ? 'enabled' : 'disabled'}
                </Badge>
                {destination.type === 'slack' && destination.webhook_set && (
                  <Badge variant="outline" className="text-[10px]">webhook set</Badge>
                )}
                {destination.type === 'telegram' && destination.bot_token_set && (
                  <Badge variant="outline" className="text-[10px]">bot token set</Badge>
                )}
                {destination.type === 'telegram' && destination.chat_id && (
                  <Badge variant="outline" className="text-[10px]">chat {destination.chat_id}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {destination.rules.length} rule{destination.rules.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={destination.enabled}
                onCheckedChange={checked => updateDestinationMut.mutate({ enabled: checked })}
                aria-label={`Toggle ${destination.name}`}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditDestination(destination)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Label className="text-sm">Rules</Label>
            <Button size="sm" variant="outline" onClick={openNewRule}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>

          {destination.rules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No rules yet.
            </div>
          ) : (
            <div className="space-y-2">
              {destination.rules.map(rule => (
                <div key={rule.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-[10px]">
                          {rule.enabled ? 'enabled' : 'disabled'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Scopes: {scopeSummary(rule) || 'none'}</span>
                        <span>Direction: {directionSummary(rule) || 'none'}</span>
                        <span>Cooldown: {formatCooldown(rule.cooldown_minutes)}</span>
                        <span>Min %: {rule.min_percent_delta}</span>
                        <span>Min Δ: {rule.min_absolute_delta}</span>
                        <span>Min expected: {rule.min_expected_count}</span>
                        <span>
                          Message: {!rule.message_template || isDefaultMessageTemplate(rule.message_template, rule.message_format)
                            ? `default (${rule.message_format})`
                            : `custom (${rule.message_format})`}
                        </span>
                        {!!rule.excluded_event_type_ids.length && (
                          <span>{rule.excluded_event_type_ids.length} group exclusions</span>
                        )}
                        {!!rule.excluded_event_ids.length && (
                          <span>{rule.excluded_event_ids.length} event exclusions</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={checked => alertingApi.updateRule(slug, destination.id, rule.id, { enabled: checked }).then(() => qc.invalidateQueries({ queryKey: ['alertDestinations', slug] }))}
                        aria-label={`Toggle ${rule.name}`}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteRule(rule)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={ruleDialogOpen} onOpenChange={open => { if (!open) { setRuleDialogOpen(false); setEditingRule(null) } }}>
        <DialogContent className="max-w-3xl">
          <form onSubmit={event => { event.preventDefault(); ruleMutation.mutate() }}>
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Alert Rule' : 'New Alert Rule'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    aria-label="Rule Name"
                    value={ruleForm.name}
                    onChange={event => setRuleForm(current => ({ ...current, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cooldown Minutes</Label>
                  <Input
                    type="number"
                    min={1}
                    value={ruleForm.cooldown_minutes}
                    onChange={event => setRuleForm(current => ({ ...current, cooldown_minutes: Number(event.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={ruleForm.include_project_total}
                    onCheckedChange={checked => setRuleForm(current => ({ ...current, include_project_total: !!checked }))}
                  />
                  Project total
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={ruleForm.include_event_types}
                    onCheckedChange={checked => setRuleForm(current => ({ ...current, include_event_types: !!checked }))}
                  />
                  Event types
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={ruleForm.include_events}
                    onCheckedChange={checked => setRuleForm(current => ({ ...current, include_events: !!checked }))}
                  />
                  Events
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={ruleForm.notify_on_spike}
                    onCheckedChange={checked => setRuleForm(current => ({ ...current, notify_on_spike: !!checked }))}
                  />
                  Up only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={ruleForm.notify_on_drop}
                    onCheckedChange={checked => setRuleForm(current => ({ ...current, notify_on_drop: !!checked }))}
                  />
                  Down only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={ruleForm.enabled}
                    onCheckedChange={checked => setRuleForm(current => ({ ...current, enabled: !!checked }))}
                  />
                  Rule enabled
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Min Percent Delta</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={ruleForm.min_percent_delta}
                    onChange={event => setRuleForm(current => ({ ...current, min_percent_delta: Number(event.target.value) }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Min Absolute Delta</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={ruleForm.min_absolute_delta}
                    onChange={event => setRuleForm(current => ({ ...current, min_absolute_delta: Number(event.target.value) }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Min Expected Count</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={ruleForm.min_expected_count}
                    onChange={event => setRuleForm(current => ({ ...current, min_expected_count: Number(event.target.value) }))}
                  />
                </div>
              </div>

              <TemplateEditor
                destinationType={destination.type}
                messageFormat={ruleForm.message_format}
                onMessageFormatChange={message_format =>
                  setRuleForm(current => {
                    const shouldResetTemplate =
                      !normalizeRuleTemplate(current.message_template)
                      || isDefaultMessageTemplate(current.message_template, current.message_format)
                    const shouldResetItemsTemplate =
                      !normalizeRuleTemplate(current.items_template)
                      || isDefaultItemsTemplate(current.items_template, current.message_format)
                    return {
                      ...current,
                      message_format,
                      message_template: shouldResetTemplate
                        ? getDefaultMessageTemplate(message_format)
                        : current.message_template,
                      items_template: shouldResetItemsTemplate
                        ? getDefaultItemsTemplate(message_format)
                        : current.items_template,
                    }
                  })
                }
                title="Message Template"
                variableOptions={TEMPLATE_VARIABLE_OPTIONS}
                helperText="Type ${var} to get variable suggestions. Use ${items_text} to render the full matched alert list generated from Item Template."
                placeholder={getDefaultMessageTemplate(ruleForm.message_format)}
                value={ruleForm.message_template}
                onChange={message_template => setRuleForm(current => ({ ...current, message_template }))}
              />

              <TemplateEditor
                destinationType={destination.type}
                messageFormat={ruleForm.message_format}
                onMessageFormatChange={() => {}}
                title="Items Template"
                variableOptions={ITEM_TEMPLATE_VARIABLE_OPTIONS}
                helperText="This template is rendered for each matched alert item and then joined into ${items_text}. Use ${details_line} and ${monitoring_line} for optional link lines."
                showFormatSelector={false}
                placeholder={getDefaultItemsTemplate(ruleForm.message_format)}
                value={ruleForm.items_template}
                onChange={items_template => setRuleForm(current => ({ ...current, items_template }))}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ExclusionSelector
                  label="Excluded event types"
                  items={eventTypes.map(eventType => ({
                    id: eventType.id,
                    label: eventType.display_name,
                  }))}
                  selectedIds={ruleForm.excluded_event_type_ids}
                  onChange={selectedIds => setRuleForm(current => ({ ...current, excluded_event_type_ids: selectedIds }))}
                />
                <ExclusionSelector
                  label="Excluded events"
                  items={events.map(event => ({
                    id: event.id,
                    label: event.name,
                  }))}
                  selectedIds={ruleForm.excluded_event_ids}
                  onChange={selectedIds => setRuleForm(current => ({ ...current, excluded_event_ids: selectedIds }))}
                />
              </div>

              {ruleMutation.isError && (
                <p className="text-sm text-destructive">{(ruleMutation.error as Error).message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={ruleMutation.isPending}>
                {editingRule ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ExclusionSelector({
  label,
  items,
  selectedIds,
  onChange,
}: {
  label: string
  items: { id: string; label: string }[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!search) return items
    const needle = search.toLowerCase()
    return items.filter(item => item.label.toLowerCase().includes(needle))
  }, [items, search])

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="justify-between">
            <span>{selectedIds.length ? `${selectedIds.length} selected` : 'Select exclusions'}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 space-y-3" align="start">
          <Input placeholder="Search…" value={search} onChange={event => setSearch(event.target.value)} />
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filtered.map(item => {
              const checked = selectedIds.includes(item.id)
              return (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={nextChecked => {
                      if (nextChecked) onChange([...selectedIds, item.id])
                      else onChange(selectedIds.filter(id => id !== item.id))
                    }}
                  />
                  <span className="truncate">{item.label}</span>
                </label>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">No matches.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function AlertDeliveryRow({ slug, delivery }: { slug: string; delivery: AlertDelivery }) {
  const [open, setOpen] = useState(false)
  const { data: detail } = useQuery({
    queryKey: ['alertDelivery', slug, delivery.id],
    queryFn: () => alertingApi.getDelivery(slug, delivery.id),
    enabled: open,
  })
  const renderedPreview = typeof delivery.payload_snapshot?.rendered_message === 'string'
    ? delivery.payload_snapshot.rendered_message
    : null
  const payloadItems = Array.isArray(detail?.payload_snapshot?.items)
    ? detail.payload_snapshot.items
    : null

  return (
    <>
      <TableRow>
        <TableCell className="text-xs">{new Date(delivery.created_at).toLocaleString()}</TableCell>
        <TableCell><Badge variant={delivery.status === 'failed' ? 'destructive' : delivery.status === 'sent' ? 'default' : 'secondary'} className="text-[10px]">{delivery.status}</Badge></TableCell>
        <TableCell className="text-xs">{delivery.destination_name}</TableCell>
        <TableCell className="text-xs">{delivery.rule_name}</TableCell>
        <TableCell className="text-xs">{delivery.scan_name}</TableCell>
        <TableCell className="text-xs">{delivery.matched_count}</TableCell>
        <TableCell className="text-xs uppercase">{delivery.channel}</TableCell>
        <TableCell className="max-w-80 text-xs text-muted-foreground">
          {delivery.error_message || (renderedPreview ? (
            <span className="block truncate" title={renderedPreview}>{renderedPreview}</span>
          ) : '—')}
        </TableCell>
        <TableCell>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(current => !current)}>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </Button>
        </TableCell>
      </TableRow>
      {open && detail && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/20">
            <div className="space-y-3 p-3">
              <div className="flex flex-wrap gap-2">
                {payloadItems && (
                  <Badge variant="outline" className="text-[10px]">
                    {payloadItems.length} items
                  </Badge>
                )}
                {detail.sent_at && (
                  <Badge variant="outline" className="text-[10px]">
                    sent {new Date(detail.sent_at).toLocaleString()}
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scope</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Abs Δ</TableHead>
                      <TableHead>% Δ</TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">
                          <div className="font-medium">{item.scope_name}</div>
                          <div className="text-muted-foreground">{item.scope_type}</div>
                        </TableCell>
                        <TableCell className="text-xs">{item.direction}</TableCell>
                        <TableCell className="text-xs">{item.actual_count}</TableCell>
                        <TableCell className="text-xs">{item.expected_count}</TableCell>
                        <TableCell className="text-xs">{item.absolute_delta}</TableCell>
                        <TableCell className="text-xs">{item.percent_delta.toFixed(1)}%</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex gap-3">
                            {item.details_path && (
                              <a href={item.details_path} className="text-primary underline" target="_blank" rel="noreferrer">
                                details
                              </a>
                            )}
                            {item.monitoring_path && (
                              <a href={item.monitoring_path} className="text-primary underline" target="_blank" rel="noreferrer">
                                monitoring
                              </a>
                            )}
                            {!item.details_path && !item.monitoring_path && '—'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default function ProjectAlertingTab({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [createType, setCreateType] = useState<'slack' | 'telegram' | null>(null)
  const [destinationForm, setDestinationForm] = useState<DestinationFormState>(defaultDestinationForm('slack'))
  const [editingDestination, setEditingDestination] = useState<AlertDestination | null>(null)
  const [deliveryFilters, setDeliveryFilters] = useState<{
    status: string
    channel: string
    destination_id: string
    rule_id: string
    scan_config_id: string
  }>({
    status: '',
    channel: '',
    destination_id: '',
    rule_id: '',
    scan_config_id: '',
  })

  const { data: destinations = [] } = useQuery({
    queryKey: ['alertDestinations', slug],
    queryFn: () => alertingApi.listDestinations(slug),
  })
  const { data: eventTypes = [] } = useQuery({
    queryKey: ['eventTypes', slug],
    queryFn: () => eventTypesApi.list(slug),
  })
  const { data: eventsResp } = useQuery({
    queryKey: ['events', slug, 'alerting'],
    queryFn: () => eventsApi.list(slug, { limit: 10000, offset: 0 }),
  })
  const { data: scans = [] } = useQuery({
    queryKey: ['scans', slug],
    queryFn: () => scansApi.list(slug),
  })
  const { data: deliveries } = useQuery({
    queryKey: ['alertDeliveries', slug, deliveryFilters],
    queryFn: () => alertingApi.listDeliveries(slug, {
      ...deliveryFilters,
      status: deliveryFilters.status || undefined,
      channel: deliveryFilters.channel || undefined,
      destination_id: deliveryFilters.destination_id || undefined,
      rule_id: deliveryFilters.rule_id || undefined,
      scan_config_id: deliveryFilters.scan_config_id || undefined,
      limit: 50,
      offset: 0,
    }),
  })

  const events = eventsResp?.items ?? []
  const groupedDestinations = useMemo(() => ({
    slack: destinations.filter(destination => destination.type === 'slack'),
    telegram: destinations.filter(destination => destination.type === 'telegram'),
  }), [destinations])

  const allRules = destinations.flatMap(destination =>
    destination.rules.map(rule => ({
      ...rule,
      destination_name: destination.name,
      destination_id: destination.id,
    })))

  const createDestinationMut = useMutation({
    mutationFn: () => alertingApi.createDestination(slug, destinationForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertDestinations', slug] })
      setCreateType(null)
      setDestinationForm(defaultDestinationForm('slack'))
    },
  })

  const updateDestinationMut = useMutation({
    mutationFn: () => {
      if (!editingDestination) throw new Error('Missing destination')
      return alertingApi.updateDestination(slug, editingDestination.id, {
        name: destinationForm.name,
        enabled: destinationForm.enabled,
        webhook_url: destinationForm.type === 'slack' && destinationForm.webhook_url ? destinationForm.webhook_url : undefined,
        bot_token: destinationForm.type === 'telegram' && destinationForm.bot_token ? destinationForm.bot_token : undefined,
        chat_id: destinationForm.type === 'telegram' ? destinationForm.chat_id : undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertDestinations', slug] })
      setEditingDestination(null)
      setDestinationForm(defaultDestinationForm('slack'))
    },
  })

  const deleteDestinationMut = useMutation({
    mutationFn: (destinationId: string) => alertingApi.deleteDestination(slug, destinationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertDestinations', slug] }),
  })

  const openCreate = (type: 'slack' | 'telegram') => {
    setCreateType(type)
    setEditingDestination(null)
    setDestinationForm(defaultDestinationForm(type))
  }

  const openEdit = (destination: AlertDestination) => {
    setEditingDestination(destination)
    setCreateType(null)
    setDestinationForm({
      type: destination.type,
      name: destination.name,
      enabled: destination.enabled,
      webhook_url: '',
      bot_token: '',
      chat_id: destination.chat_id ?? '',
    })
  }

  const closeDestinationDialog = () => {
    setCreateType(null)
    setEditingDestination(null)
    setDestinationForm(defaultDestinationForm('slack'))
  }

  const handleDeleteDestination = async (destination: AlertDestination) => {
    const ok = await confirm({
      title: 'Delete destination',
      message: `Delete "${destination.name}" and all its alert rules?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteDestinationMut.mutate(destination.id)
  }

  const destinationMutation = editingDestination ? updateDestinationMut : createDestinationMut
  const activeDestinationType = editingDestination?.type ?? createType ?? destinationForm.type

  return (
    <div className="space-y-6">
      {dialog}
      <div>
        <h2 className="text-lg font-semibold">Alerting</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Route active anomaly signals to Slack and Telegram. Rules are project-level and apply to every scan in the project.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Destinations</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openCreate('slack')}>
                <Webhook className="mr-2 h-4 w-4" />
                Add Slack
              </Button>
              <Button variant="outline" size="sm" onClick={() => openCreate('telegram')}>
                <Send className="mr-2 h-4 w-4" />
                Add Telegram
              </Button>
            </div>
          </div>

          {destinations.length === 0 && (
            <EmptyState
              icon={Webhook}
              title="No alert destinations"
              description="Create a Slack webhook or Telegram bot destination, then attach rules to it."
            />
          )}

          {(['slack', 'telegram'] as const).map(channel => (
            <div key={channel} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium capitalize">{channel}</h4>
                <Badge variant="outline" className="text-[10px]">
                  {groupedDestinations[channel].length}
                </Badge>
              </div>
              {groupedDestinations[channel].map(destination => (
                <Collapsible key={destination.id} defaultOpen>
                  <CollapsibleTrigger asChild>
                    <div className="hidden" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <DestinationCard
                      slug={slug}
                      destination={destination}
                      eventTypes={eventTypes}
                      events={events}
                      onEditDestination={openEdit}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteDestination(destination)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete destination
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Audit</h3>
            <Badge variant="outline" className="text-[10px]">
              {deliveries?.total ?? 0} deliveries
            </Badge>
          </div>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={deliveryFilters.status || 'all'} onValueChange={value => setDeliveryFilters(current => ({ ...current, status: value === 'all' ? '' : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Channel</Label>
                  <Select value={deliveryFilters.channel || 'all'} onValueChange={value => setDeliveryFilters(current => ({ ...current, channel: value === 'all' ? '' : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Destination</Label>
                  <Select value={deliveryFilters.destination_id || 'all'} onValueChange={value => setDeliveryFilters(current => ({ ...current, destination_id: value === 'all' ? '' : value, rule_id: '' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {destinations.map(destination => (
                        <SelectItem key={destination.id} value={destination.id}>
                          {destination.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Rule</Label>
                  <Select value={deliveryFilters.rule_id || 'all'} onValueChange={value => setDeliveryFilters(current => ({ ...current, rule_id: value === 'all' ? '' : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {allRules
                        .filter(rule => !deliveryFilters.destination_id || rule.destination_id === deliveryFilters.destination_id)
                        .map(rule => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.destination_name} / {rule.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Scan</Label>
                  <Select value={deliveryFilters.scan_config_id || 'all'} onValueChange={value => setDeliveryFilters(current => ({ ...current, scan_config_id: value === 'all' ? '' : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {scans.map(scan => (
                        <SelectItem key={scan.id} value={scan.id}>
                          {scan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!deliveries || deliveries.items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No deliveries yet.
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Rule</TableHead>
                        <TableHead>Scan</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Error / Preview</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries.items.map(delivery => (
                        <AlertDeliveryRow key={delivery.id} slug={slug} delivery={delivery} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!createType || !!editingDestination} onOpenChange={open => { if (!open) closeDestinationDialog() }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={event => { event.preventDefault(); destinationMutation.mutate() }}>
            <DialogHeader>
              <DialogTitle>{editingDestination ? 'Edit Destination' : `New ${activeDestinationType === 'slack' ? 'Slack' : 'Telegram'} Destination`}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    aria-label="Destination Name"
                    value={destinationForm.name}
                    onChange={event => setDestinationForm(current => ({ ...current, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Channel</Label>
                  <Select
                    value={destinationForm.type}
                    onValueChange={value => setDestinationForm(current => ({ ...defaultDestinationForm(value as 'slack' | 'telegram'), name: current.name }))}
                    disabled={!!editingDestination}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {destinationForm.type === 'slack' ? (
                <div className="grid gap-2">
                  <Label>Webhook URL</Label>
                  <Input
                    type="password"
                    aria-label="Webhook URL"
                    placeholder={editingDestination?.webhook_set ? 'Leave empty to keep current webhook' : 'https://hooks.slack.com/...'}
                    value={destinationForm.webhook_url}
                    onChange={event => setDestinationForm(current => ({ ...current, webhook_url: event.target.value }))}
                    required={!editingDestination || !editingDestination.webhook_set}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Bot Token</Label>
                    <Input
                      type="password"
                      aria-label="Bot Token"
                      placeholder={editingDestination?.bot_token_set ? 'Leave empty to keep current token' : '123456:ABC...'}
                      value={destinationForm.bot_token}
                      onChange={event => setDestinationForm(current => ({ ...current, bot_token: event.target.value }))}
                      required={!editingDestination || !editingDestination.bot_token_set}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Chat ID</Label>
                    <Input
                      aria-label="Chat ID"
                      value={destinationForm.chat_id}
                      onChange={event => setDestinationForm(current => ({ ...current, chat_id: event.target.value }))}
                      required
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={destinationForm.enabled}
                  onCheckedChange={checked => setDestinationForm(current => ({ ...current, enabled: !!checked }))}
                />
                Destination enabled
              </label>

              {destinationMutation.isError && (
                <p className="text-sm text-destructive">{(destinationMutation.error as Error).message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDestinationDialog}>Cancel</Button>
              <Button type="submit" disabled={destinationMutation.isPending}>
                {editingDestination ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
