"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  IconChartBar,
  IconChevronDown,
  IconDashboard,
  IconExternalLink,
  IconList,
  IconSearch,
  IconSitemap,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getPoliciesByNetwork } from "@/lib/policies/registry"
import { usePolicyMaybe } from "@/lib/policies/context"

function PolicySelector() {
  const policy = usePolicyMaybe()
  const router = useRouter()

  if (!policy) return null

  const networkPolicies = getPoliciesByNetwork(policy.network)

  // Don't show dropdown if only one policy on this network
  if (networkPolicies.length <= 1) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="w-full">
            <span className="font-medium text-sm">{policy.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-full justify-between">
              <span className="font-medium text-sm">{policy.name}</span>
              <IconChevronDown className="size-4 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
            {networkPolicies.map((p) => (
              <DropdownMenuItem
                key={p.slug}
                onClick={() => router.push(`/policy/${p.slug}/dashboard`)}
                className={p.slug === policy.slug ? "bg-accent" : ""}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const policy = usePolicyMaybe()
  const slug = policy?.slug ?? "mecd"
  const base = `/policy/${slug}`

  const navMain = [
    { title: "Dashboard", url: `${base}/dashboard`, icon: IconDashboard },
    { title: "Issuances", url: `${base}/issuances`, icon: IconList },
    { title: "Projects", url: `${base}/projects`, icon: IconSitemap },
    { title: "Analytics", url: `${base}/analytics`, icon: IconChartBar },
    { title: "Verify", url: `${base}/verify`, icon: IconSearch },
  ]

  const navSecondary = [
    {
      title: "Methodology",
      url: policy?.links.methodology ?? "#",
      icon: IconExternalLink,
    },
    {
      title: "Guardian",
      url: "https://github.com/hashgraph/guardian",
      icon: IconExternalLink,
    },
    {
      title: "Hedera Policy",
      url: policy?.links.hederaPolicy ?? "#",
      icon: IconExternalLink,
    },
  ]

  const cmhqLogo = mounted && resolvedTheme === "dark"
    ? "/cmhq-logo-dark.png"
    : "/cmhq-logo-light.png"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <Image src="/hedera-logo.png" alt="Hedera" width={20} height={20} className="!size-5 rounded-full" />
                <span className="text-base font-semibold">Carbon Atlas</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <PolicySelector />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Built by</span>
          <a
            href="https://carbonmarketshq.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src={cmhqLogo}
              alt="CarbonMarketsHQ"
              width={120}
              height={24}
              className="h-5 w-auto"
            />
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
