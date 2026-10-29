import { motion, type Variants } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import type { Section } from '@/lib/navigation'

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

type PagePlaceholderProps = { section: Section; highlights: string[] }

export function PagePlaceholder({ section, highlights }: PagePlaceholderProps) {
  const Icon = section.icon

  return (
    <motion.section variants={container} initial="hidden" animate="show" className="mx-auto max-w-5xl">
      <motion.div variants={rise} className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-5" />
        </span>
        <Badge variant="outline" className="gap-1.5 rounded-full bg-background/60">
          <span className="size-1.5 animate-pulse rounded-full bg-highlight" />
          Coming next
        </Badge>
      </motion.div>

      <motion.h1
        variants={rise}
        className="mt-6 text-3xl font-semibold tracking-tight text-balance md:text-4xl"
      >
        {section.label}
      </motion.h1>
      <motion.p variants={rise} className="mt-2 max-w-2xl text-base text-pretty text-muted-foreground">
        {section.description}
      </motion.p>

      <motion.ul variants={container} className="mt-10 grid gap-4 sm:grid-cols-3">
        {highlights.map((text, index) => (
          <motion.li
            key={text}
            variants={rise}
            whileHover={{ y: -4 }}
            className="group rounded-2xl border border-border/70 bg-card/70 p-5 shadow-xs backdrop-blur transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5"
          >
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              0{index + 1}
            </span>
            <p className="mt-3 text-sm leading-snug font-medium">{text}</p>
            <span className="mt-4 block h-0.5 w-8 rounded-full bg-primary/30 transition-all duration-300 group-hover:w-14 group-hover:bg-highlight" />
          </motion.li>
        ))}
      </motion.ul>
    </motion.section>
  )
}
