"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { PolicyConfig } from "./types"

const PolicyContext = createContext<PolicyConfig | null>(null)

export function PolicyProvider({
  policy,
  children,
}: {
  policy: PolicyConfig
  children: ReactNode
}) {
  return (
    <PolicyContext.Provider value={policy}>{children}</PolicyContext.Provider>
  )
}

export function usePolicy(): PolicyConfig {
  const ctx = useContext(PolicyContext)
  if (!ctx) {
    throw new Error("usePolicy must be used within a PolicyProvider")
  }
  return ctx
}

export function usePolicyMaybe(): PolicyConfig | null {
  return useContext(PolicyContext)
}
