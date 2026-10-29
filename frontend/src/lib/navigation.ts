import {
  ChartColumnBig,
  LayoutDashboard,
  MessagesSquare,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type Section = {
  path: string
  label: string
  description: string
  icon: LucideIcon
}

export const sections: Section[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    description: 'A quick read on headcount and pay across ACME.',
    icon: LayoutDashboard,
  },
  {
    path: '/employees',
    label: 'Employees',
    description: 'Find, add and update employee salary records.',
    icon: Users,
  },
  {
    path: '/insights',
    label: 'Insights',
    description: 'How ACME pays people by country, department and role.',
    icon: ChartColumnBig,
  },
  {
    path: '/ask',
    label: 'Ask a Question',
    description: 'Ask about pay in plain English and get an answer from the data.',
    icon: MessagesSquare,
  },
]

export function findSection(pathname: string): Section | undefined {
  return sections.find((section) => pathname.startsWith(section.path))
}
