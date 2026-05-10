import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"
import type { AlertDelivery } from "@/types"
import { alertingApi } from "@/api/alerting"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function AlertDeliveryRow({ slug, delivery }: { slug: string; delivery: AlertDelivery }) {
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
