"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  IconBrandGithub,
  IconChevronDown,
  IconMoon,
  IconSun,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePolicyMaybe } from "@/lib/policies/context"
import { getDefaultPolicyForNetwork } from "@/lib/policies/registry"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {mounted && resolvedTheme === "dark" ? (
        <IconSun className="size-4" />
      ) : (
        <IconMoon className="size-4" />
      )}
    </Button>
  )
}

const NETWORKS = ["testnet", "mainnet"] as const

function NetworkSelector() {
  const policy = usePolicyMaybe()
  const router = useRouter()
  const currentNetwork = policy?.network ?? "testnet"

  function switchNetwork(network: "testnet" | "mainnet") {
    if (network === currentNetwork) return
    const target = getDefaultPolicyForNetwork(network)
    router.push(`/policy/${target.slug}/dashboard`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <span
            className={`inline-flex size-2 rounded-full ${
              currentNetwork === "mainnet" ? "bg-green-500" : "bg-blue-500"
            }`}
          />
          Hedera {currentNetwork.charAt(0).toUpperCase() + currentNetwork.slice(1)}
          <IconChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {NETWORKS.map((net) => (
          <DropdownMenuItem
            key={net}
            onClick={() => switchNetwork(net)}
            className={net === currentNetwork ? "bg-accent" : ""}
          >
            <span
              className={`inline-flex size-2 rounded-full mr-2 ${
                net === "mainnet" ? "bg-green-500" : "bg-blue-500"
              }`}
            />
            Hedera {net.charAt(0).toUpperCase() + net.slice(1)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteHeader() {
  const policy = usePolicyMaybe()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex flex-col">
          <h1 className="text-base font-medium leading-tight">
            {policy?.fullName ?? "Carbon Atlas"}
          </h1>
          {policy && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              {policy.standard} {policy.name}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <NetworkSelector />
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <a
              href="https://github.com/hashgraph/guardian"
              rel="noopener noreferrer"
              target="_blank"
              aria-label="GitHub"
            >
              <IconBrandGithub className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}
