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
import { useAllPolicyVcs } from "@/hooks/usePolicyVcDocuments"
import { formatTimestamp } from "@/lib/utils/format"
import { HederaProofBadge } from "@/components/shared/HederaProofBadge"
import { CopyableId } from "@/components/shared/CopyableId"
import { deduplicateProjects } from "@/lib/utils/trust-chain"
import { usePolicy } from "@/lib/policies/context"
import { useVcDocument } from "@/hooks/useVcDocument"
import { parseCredentialSubject } from "@/lib/api/vc-documents"

const PAGE_SIZE = 25

function ProjectName({ consensusTimestamp }: { consensusTimestamp: string }) {
  const { data: vcDetail } = useVcDocument(consensusTimestamp)
  const cs = vcDetail ? parseCredentialSubject<Record<string, unknown>>(vcDetail) : null
  if (!cs) return <span className="text-muted-foreground text-xs">—</span>

  const pd = cs.project_details as Record<string, unknown> | undefined

  // Try common project name paths
  const name =
    (cs.projectTitle as string) ??
    (pd?.field0 as string) ??
    null

  // Try common registry ID paths (top-level and nested under project_details)
  const rawId =
    (pd?.gs_id as string) ??
    (cs.gs_id as string) ??
    (pd?.vcs_id as string) ??
    (cs.vcs_id as string) ??
    (cs.registry_id as string) ??
    null

  // Format registry ID with standard prefix if it's a bare number
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
        <span className="text-sm leading-tight line-clamp-2">{name}</span>
      )}
    </div>
  )
}

export default function ProjectsPage() {
  const policy = usePolicy()
  const [pageIndex, setPageIndex] = React.useState(0)
  const { data: allVcs, isLoading } = useAllPolicyVcs()

  const projects = React.useMemo(() => {
    if (!allVcs) return []
    return deduplicateProjects(allVcs)
  }, [allVcs])

  const totalPages = Math.ceil(projects.length / PAGE_SIZE)
  const pagedItems = projects.slice(
    pageIndex * PAGE_SIZE,
    (pageIndex + 1) * PAGE_SIZE
  )

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold">Projects</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Registered projects under this policy
          {projects.length > 0 ? ` (${projects.length} total)` : ""}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <IconLoader className="size-5 animate-spin" />
          Loading projects…
        </div>
      )}

      {!isLoading && pagedItems.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Project Developer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hedera</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map(({ vc, developerDid, stage }) => (
                  <TableRow key={vc.consensusTimestamp}>
                    <TableCell className="max-w-[300px]">
                      <ProjectName consensusTimestamp={vc.consensusTimestamp} />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatTimestamp(vc.consensusTimestamp)}
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      {developerDid ? (
                        <CopyableId value={developerDid} />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          stage === "Validated"
                            ? "text-green-700 border-green-300 bg-green-50 text-xs"
                            : "text-muted-foreground text-xs"
                        }
                      >
                        {stage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <HederaProofBadge
                        consensusTimestamp={vc.consensusTimestamp}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/policy/${policy.slug}/projects/${vc.consensusTimestamp}`}>
                          View
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

      {!isLoading && projects.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No projects found.</p>
        </div>
      )}
    </div>
  )
}
