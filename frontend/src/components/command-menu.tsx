import { CornerDownLeft, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useTheme } from '@/components/theme'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'
import { sections } from '@/lib/navigation'

type CommandMenuProps = { open: boolean; onOpenChange: (open: boolean) => void }

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const navigate = useNavigate()
  const { setTheme } = useTheme()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  function run(action: () => void) {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command menu"
      description="Jump to a page or change the theme"
    >
      <Command>
      <CommandInput placeholder="Where to?" />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>
        <CommandGroup heading="Go to">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <CommandItem
                key={section.path}
                value={section.label}
                onSelect={() => run(() => navigate(section.path))}
              >
                <Icon />
                <span>{section.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem value="Light theme" onSelect={() => run(() => setTheme('light'))}>
            <Sun />
            <span>Light theme</span>
          </CommandItem>
          <CommandItem value="Dark theme" onSelect={() => run(() => setTheme('dark'))}>
            <Moon />
            <span>Dark theme</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-end gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
        <Kbd>
          <CornerDownLeft />
        </Kbd>
        to select
        <Kbd className="ml-2">Esc</Kbd>
        to close
      </div>
      </Command>
    </CommandDialog>
  )
}
