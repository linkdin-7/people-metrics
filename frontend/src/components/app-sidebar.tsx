import { motion } from 'motion/react'
import { useId } from 'react'
import { Link, NavLink, useLocation } from 'react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sections } from '@/lib/navigation'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3BA7A0" />
          <stop offset="1" stopColor="#1F5F6E" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <rect x="7.5" y="17" width="4.5" height="8" rx="1.5" fill="white" fillOpacity="0.7" />
      <rect x="13.75" y="13" width="4.5" height="12" rx="1.5" fill="white" fillOpacity="0.85" />
      <rect x="20" y="10" width="4.5" height="15" rx="1.5" fill="white" />
      <circle cx="22.25" cy="6.25" r="2.25" fill="#F2B33D" />
    </svg>
  )
}

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
              <Link to="/dashboard" aria-label="ACME Salary Management home">
                <BrandMark className="size-8 shrink-0 drop-shadow-sm transition-transform duration-300 group-hover/menu-button:-rotate-6 group-hover/menu-button:scale-105" />
                <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold tracking-tight">ACME</span>
                  <span className="text-xs text-muted-foreground">Salary Management</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <nav aria-label="Main">
            <SidebarMenu className="gap-1">
              {sections.map((section) => {
                const active = pathname.startsWith(section.path)
                const Icon = section.icon
                return (
                  <SidebarMenuItem key={section.path}>
                    <SidebarMenuButton
                      asChild
                      tooltip={section.label}
                      className={cn(
                        'relative h-9 hover:bg-sidebar-accent/50 active:scale-[0.98]',
                        active && 'font-medium text-sidebar-accent-foreground hover:bg-transparent',
                      )}
                    >
                      <NavLink to={section.path}>
                        {active && (
                          // Shared layoutId makes the highlight glide from the old item to the new one.
                          <motion.span
                            layoutId="active-section"
                            className="absolute inset-0 rounded-md bg-sidebar-accent shadow-sm ring-1 ring-sidebar-border"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          >
                            <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-highlight" />
                          </motion.span>
                        )}
                        <Icon
                          className={cn(
                            'relative transition-transform duration-200 group-hover/menu-button:translate-x-0.5',
                            active && 'text-sidebar-primary',
                          )}
                        />
                        <span className="relative">{section.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-3 rounded-lg p-1.5 group-data-[collapsible=icon]:p-0">
          <Avatar className="size-8 ring-2 ring-sidebar-primary/25">
            <AvatarFallback className="bg-linear-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground">
              HR
            </AvatarFallback>
          </Avatar>
          <div className="grid text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-medium">HR Manager</span>
            <span className="text-xs text-muted-foreground">Synthetic demo data</span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
