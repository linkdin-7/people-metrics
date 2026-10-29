import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'

import { AppHeader } from '@/components/app-header'
import { AppSidebar } from '@/components/app-sidebar'
import { CommandMenu } from '@/components/command-menu'
import { PagePlaceholder } from '@/components/page-placeholder'
import { ThemeProvider } from '@/components/theme'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { sections } from '@/lib/navigation'

const PLACEHOLDER_HIGHLIGHTS: Record<string, string[]> = {
  '/dashboard': [
    'Headcount across countries and departments',
    'Lowest, median, average and highest pay per currency',
    'One click into the detail behind every number',
  ],
  '/employees': [
    'Search, filter and sort 10,000 employees',
    'Add and edit in a side panel without losing your place',
    'Currency fills in from the country automatically',
  ],
  '/insights': [
    'Pay by country, department and job title',
    'Salary distribution for each currency',
    'Highest and lowest paid at a glance',
  ],
  '/ask': [
    'Ask in plain English, one question at a time',
    'Every answer is computed from the database',
    'See exactly how your question was understood',
  ],
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={location}>
          {sections.map((section) => (
            <Route
              key={section.path}
              path={section.path}
              element={
                <PagePlaceholder section={section} highlights={PLACEHOLDER_HIGHLIGHTS[section.path]} />
              }
            />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)

  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={150}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="relative min-w-0 overflow-hidden">
              <div aria-hidden="true" className="aurora" />
              <AppHeader onOpenCommandMenu={() => setCommandMenuOpen(true)} />
              <div className="relative flex-1 px-6 py-8 md:px-10 md:py-12">
                <AnimatedRoutes />
              </div>
            </SidebarInset>
            <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
          </SidebarProvider>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
