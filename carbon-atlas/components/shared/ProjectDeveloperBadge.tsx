"use client"

import * as React from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { usePolicyMaybe } from "@/lib/policies/context"

export function ProjectDeveloperBadge({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const policy = usePolicyMaybe()
  const pd = policy?.projectDeveloper

  if (!pd) return null

  const logo = mounted && resolvedTheme === "dark" ? pd.logoDark : pd.logoLight

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">Project Developer</span>
      <a
        href={pd.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src={logo}
          alt={pd.name}
          width={200}
          height={200}
          className="h-20 w-auto"
        />
      </a>
    </div>
  )
}
