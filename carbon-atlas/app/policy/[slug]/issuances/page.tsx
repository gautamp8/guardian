"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconLoader,
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePolicyVcDocuments } from "@/hooks/usePolicyVcDocuments"
import { formatTimestamp } from "@/lib/utils/format"
import { HederaProofBadge } from "@/components/shared/HederaProofBadge"
import { CopyableId } from "@/components/shared/CopyableId"
import { usePolicy } from "@/lib/policies/context"
import { useVcDocument } from "@/hooks/useVcDocument"
import { parseCredentialSubject } from "@/lib/api/vc-documents"

function IssuanceProject({ consensusTimestamp }: { consensusTimestamp: string }) {
  const { data: vcDetail } = useVcDocument(consensusTimestamp)
  const cs = vcDetail ? parseCredentialSubject<Record<string, unknown>>(vcDetail) : null
  if (!cs) return <span className="text-muted-foreground text-xs">—</span>

  const pd = cs.project_details as Record<string, unknown> | undefined

  const name =
    (cs.projectTitle as string) ??
    (pd?.field0 as string) ??
    null

  const rawId =
    (pd?.gs_id as string) ??
    (cs.gs_id as string) ??
    (pd?.vcs_id as string) ??
    (cs.vcs_id as string) ??
    (cs.registry_id as string) ??
    null

  const registryId = rawId
    ? /^\d+$/.test(rawId)
      ? (pd?.gs_id || cs.gs_id ? `GS${rawId}` : `VCS ${rawId}`)
      : rawId
    : null

  if (!name && !registryId) return <span className="text-muted-foreground text-xs">—</span>

  return (
    <div className="flex flex-col gap-0.5">
      {registryId && (
        <span className="text-xs font-semibold text-primary">{registryId}</span>
      )}
      {name && (
        <span className="text-sm leading-tight line-clamp-1">{name}</span>
      )}
    </div>
  )
}

export default function IssuancesPage() {
  const policy = usePolicy()
  const [pageIndex, setPageIndex] = React.useState(0)
  const PAGE_SIZE = 25

  const { data, isLoading, error } = usePolicyVcDocuments(
    "approved_report",
    pageIndex,
    PAGE_SIZE
  )

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Issuances</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Approved monitoring reports — each represents a carbon credit issuance
            {data ? ` (${data.total} total)` : ""}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <IconLoader className="size-5 animate-spin" />
          Loading issuances…
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive py-4">Error: {error.message}</p>
      )}

      {data && data.items.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No issuances found. Projects under this methodology have not yet completed the monitoring and verification process.
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted sticky top-0">
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hedera</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.consensusTimestamp}>
                    <TableCell className="max-w-[300px]">
                      <IssuanceProject consensusTimestamp={item.consensusTimestamp} />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatTimestamp(item.consensusTimestamp)}
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      {item.options?.issuer ? (
                        <CopyableId value={item.options.issuer} />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-green-700 border-green-300 bg-green-50 text-xs capitalize"
                      >
                        {(item.options?.documentStatus ?? "Approved").charAt(0).toUpperCase() + (item.options?.documentStatus ?? "Approved").slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <HederaProofBadge
                        consensusTimestamp={item.consensusTimestamp}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/policy/${policy.slug}/issuances/${item.consensusTimestamp}`}>
                          Trust Chain
                          <IconArrowRight className="size-3 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {pageIndex + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  disabled={pageIndex === 0}
                >
                  <IconChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageIndex((p) => p + 1)}
                  disabled={pageIndex + 1 >= totalPages}
                >
                  <IconChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
