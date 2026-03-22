"use client"

import * as React from "react"
import type { VCDetail, EntityType } from "@/lib/types/indexer"
import { parseCredentialSubject } from "@/lib/api/vc-documents"
import { usePolicyMaybe } from "@/lib/policies/context"

// Shared renderers (work across all policies)
import { VerificationReportView } from "./VerificationReportView"
import { ValidationReportView } from "./ValidationReportView"
import { VVBView } from "./VVBView"
import { GenericVCView } from "./GenericVCView"

// MECD-specific renderers
import { MonitoringReportView } from "./mecd/MonitoringReportView"
import { ProjectView as MECDProjectView } from "./mecd/ProjectView"
import { DeviceDataView } from "./mecd/DeviceDataView"

// VM0033-specific renderers
import { PDDView } from "./vm0033/PDDView"

interface VCRendererProps {
  vcDetail: VCDetail
  entityTypeOverride?: EntityType
}

export function VCRenderer({ vcDetail, entityTypeOverride }: VCRendererProps) {
  const policy = usePolicyMaybe()
  const entityType = entityTypeOverride ?? vcDetail.item.options?.entityType as EntityType
  const cs = parseCredentialSubject<Record<string, unknown>>(vcDetail)
  const rawDocs = vcDetail.item.documents

  if (!cs) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not parse credential subject.
      </p>
    )
  }

  // Policy-specific renderer dispatch
  if (policy?.slug === "vm0033") {
    switch (entityType) {
      case "project_form":
      case "project":
      case "approved_project":
        return <PDDView cs={cs} rawDocuments={rawDocs} entityType={entityType} />
      case "verification_report":
        return <VerificationReportView cs={cs} rawDocuments={rawDocs} />
      case "validation_report":
        return <ValidationReportView cs={cs} rawDocuments={rawDocs} />
      case "vvb":
      case "approved_vvb":
        return <VVBView cs={cs} entityType={entityType} />
      default:
        return <GenericVCView credentialSubject={cs} rawDocuments={rawDocs} />
    }
  }

  // Default / MECD renderer dispatch
  switch (entityType) {
    case "approved_report":
    case "report":
      return <MonitoringReportView cs={cs} rawDocuments={rawDocs} />

    case "verification_report":
      return <VerificationReportView cs={cs} rawDocuments={rawDocs} />

    case "daily_mrv_report":
      return <DeviceDataView credentialSubject={cs} rawDocuments={rawDocs} />

    case "project_form":
    case "project":
    case "approved_project":
      return <MECDProjectView cs={cs} entityType={entityType} rawDocuments={rawDocs} />

    case "validation_report":
      return <ValidationReportView cs={cs} rawDocuments={rawDocs} />

    case "vvb":
    case "approved_vvb":
      return <VVBView cs={cs} entityType={entityType} />

    default:
      return <GenericVCView credentialSubject={cs} rawDocuments={rawDocs} />
  }
}
