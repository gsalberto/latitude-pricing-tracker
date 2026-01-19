'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Server, GitCompare, History, Layers, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Latitude Products', href: '/latitude', icon: Server },
  { name: 'Spec Matching', href: '/matching', icon: Layers },
  { name: 'Comparisons', href: '/comparisons', icon: GitCompare },
  { name: 'Price History', href: '/price-history', icon: History },
]

export function Navigation() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <nav className="flex flex-col w-64 bg-[hsl(260,20%,6%)] border-r border-[hsl(260,15%,15%)] min-h-screen p-6">
      {/* Logo/Brand */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <Image
            src="/favicon.svg"
            alt="Latitude"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <h1 className="text-lg font-semibold text-white">Latitude</h1>
        </div>
        <p className="text-xs text-[hsl(260,10%,50%)] ml-11">Competitive Tracker</p>
      </div>

      {/* Navigation Links */}
      <ul className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[hsl(241,87%,61%)] text-white shadow-lg shadow-[hsl(241,87%,61%)]/20'
                    : 'text-[hsl(260,10%,60%)] hover:text-white hover:bg-[hsl(260,15%,12%)]'
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4",
                  isActive ? "text-white" : "text-[hsl(260,10%,50%)]"
                )} />
                {item.name}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* User & Sign Out */}
      <div className="mt-auto pt-6 border-t border-[hsl(260,15%,12%)]">
        {session?.user && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || ''}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session.user.name}
                </p>
                <p className="text-xs text-[hsl(260,10%,50%)] truncate">
                  {session.user.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full justify-start text-[hsl(260,10%,60%)] hover:text-white hover:bg-[hsl(260,15%,12%)]"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </nav>
  )
}
