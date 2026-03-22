import { notFound } from "next/navigation"
import { getPolicyBySlug } from "@/lib/policies/registry"
import { PolicyProvider } from "@/lib/policies/context"
import { DashboardLayout } from "@/components/dashboard-layout"

export default async function PolicyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const policy = getPolicyBySlug(slug)

  if (!policy) {
    notFound()
  }

  return (
    <PolicyProvider policy={policy}>
      <DashboardLayout>{children}</DashboardLayout>
    </PolicyProvider>
  )
}
