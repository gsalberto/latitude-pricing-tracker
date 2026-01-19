import { Navigation } from "@/components/layout/navigation"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Navigation />
      <main className="flex-1 p-8 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
