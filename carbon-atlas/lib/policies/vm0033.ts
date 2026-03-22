import type { PolicyConfig } from "./types"

export const vm0033: PolicyConfig = {
  slug: "vm0033",
  name: "VM0033",
  fullName: "Tidal Wetland and Seagrass Restoration",
  standard: "Verra",
  description:
    "REDD+ methodology for mangrove and tidal wetland conservation and restoration projects",
  network: "mainnet",
  policyHederaId: "1768954927.914654000",

  links: {
    methodology:
      "https://verra.org/methodologies/vm0033-methodology-for-tidal-wetland-and-seagrass-restoration-v2-1/",
    hederaPolicy:
      "https://guardian.hedera.com/guardian/demo-guide/carbon-offsets/verra-vm0033",
  },

  projectDeveloper: {
    name: "Allcot",
    url: "https://allcot.com",
    logoDark: "/allcot-dark.svg",
    logoLight: "/allcot-light.svg",
  },

  dashboard: {
    statCards: [
      {
        key: "projects",
        label: "Registered Projects",
        description: "Projects submitted to this policy",
        icon: "IconSitemap",
        source: "count",
        entityType: "project_form",
        format: "number",
      },
      {
        key: "validation-status",
        label: "Validation Status",
        description: "Current stage in validation lifecycle",
        icon: "IconClipboardCheck",
        source: "computed",
        valuePath: "validationStage",
        format: "text",
      },
      {
        key: "issuances",
        label: "Verified Issuances",
        description: "Approved monitoring reports on Hedera",
        icon: "IconCertificate",
        source: "count",
        entityType: "approved_report",
        format: "number",
      },
      {
        key: "ery",
        label: "Estimated VCUs",
        description: "Projected Verified Carbon Units from PDD",
        icon: "IconLeaf",
        iconColor: "text-green-600",
        source: "computed",
        valuePath: "totalERy",
        format: "tco2e",
      },
    ],
    charts: ["project-overview"],
  },

  statsExtractors: {},
}
