import type { PolicyConfig } from "./types"

export const mecd: PolicyConfig = {
  slug: "mecd",
  name: "MECD v1.2",
  fullName: "Metered & Measured Energy Cooking Devices",
  standard: "Gold Standard",
  description:
    "Carbon credits from metered energy cooking devices replacing traditional biomass fuels",
  network: "testnet",
  policyHederaId: "1767599197.624837133",

  links: {
    methodology:
      "https://globalgoals.goldstandard.org/431_ee_ics_methodology-for-metered-measured-energy-cooking-devices/",
    hederaPolicy:
      "https://guardian.hedera.com/guardian/demo-guide/carbon-offsets/goldstandard-metered-energy-cooking",
  },

  projectDeveloper: {
    name: "ATEC Global",
    url: "https://www.atecglobal.io",
    logoDark: "/atec-dark.png",
    logoLight: "/atec-light.png",
  },

  dashboard: {
    statCards: [
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
        label: "Projected Emission Reductions",
        description: "Total tCO₂e (including partial issuances)",
        icon: "IconLeaf",
        iconColor: "text-green-600",
        source: "computed",
        valuePath: "totalERy",
        format: "tco2e",
      },
      {
        key: "projects",
        label: "Active Projects",
        description: "Validated projects on Hedera",
        icon: "IconSitemap",
        source: "count",
        entityType: "approved_project",
        format: "number",
      },
      {
        key: "devices",
        label: "Monitored Devices",
        description: "Cooking devices with metered energy data",
        icon: "IconDevices",
        source: "computed",
        valuePath: "totalDevices",
        format: "number",
      },
    ],
    charts: ["emission-timeline", "device-map"],
  },

  statsExtractors: {
    eryPath: "emission_reduction.ER_y",
    deviceCountPath:
      "project_emission_electricity.total_usage.number_of_devices",
    periodPath: "monitoring_period.to",
  },
}
