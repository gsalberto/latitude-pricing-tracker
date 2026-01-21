'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Server, GitCompare, History, Layers, LogOut, Clock, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Latitude Products', href: '/latitude', icon: Server },
  { name: 'Spec Matching', href: '/matching', icon: Layers },
  { name: 'Comparisons', href: '/comparisons', icon: GitCompare },
  { name: 'Price History', href: '/price-history', icon: History },
  { name: 'Changelog', href: '/changelog', icon: FileText },
]

interface NavigationProps {
  lastUpdated?: Date | null
}

export function Navigation({ lastUpdated }: NavigationProps) {
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

      {/* Last Updated */}
      {lastUpdated && (
        <div className="mt-6 px-3 py-3 rounded-lg bg-[hsl(260,15%,10%)]">
          <div className="flex items-center gap-2 text-[hsl(260,10%,50%)]">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Last Updated</span>
          </div>
          <p className="text-xs text-[hsl(260,10%,70%)] mt-1 ml-5">
            {new Date(lastUpdated).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      )}

      {/* Version Info */}
      <div className="mt-4 px-3">
        <p className="text-[10px] text-[hsl(260,10%,40%)]">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
          <span className="mx-1">•</span>
          <span className="font-mono">{process.env.NEXT_PUBLIC_GIT_COMMIT}</span>
          {process.env.NODE_ENV === 'development' && (
            <span className="ml-1 px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[9px]">DEV</span>
          )}
        </p>
      </div>

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
