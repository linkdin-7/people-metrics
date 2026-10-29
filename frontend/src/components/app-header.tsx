import { Search } from 'lucide-react'
import { useLocation } from 'react-router'

import { ThemeToggle } from '@/components/theme'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { findSection } from '@/lib/navigation'

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

export function AppHeader({ onOpenCommandMenu }: { onOpenCommandMenu: () => void }) {
  const { pathname } = useLocation()
  const section = findSection(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:rounded-t-xl">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4!" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:block">ACME</BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:block" />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{section?.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          aria-label="Search or jump to a page"
          onClick={onOpenCommandMenu}
          className="group h-9 gap-3 rounded-full bg-background/60 pr-2 pl-3 text-muted-foreground shadow-xs hover:text-foreground sm:w-64 sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <Search className="size-4 transition-transform duration-200 group-hover:scale-110" />
            <span className="hidden sm:inline">Search or jump to…</span>
          </span>
          <KbdGroup className="hidden sm:inline-flex">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  )
}
