import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

import { OptionLabel } from '@/components/search-select'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, rankMatch, type FilterOption } from '@/lib/utils'

type FilterComboboxProps = {
  label: string
  value: string | null
  options: FilterOption[]
  onChange: (value: string | null) => void
}

export function FilterCombobox({ label, value, options, onChange }: FilterComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  function choose(next: string | null) {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={selected ? `${label}: ${selected.label}` : label}
          className={cn(
            'h-9 max-w-52 justify-between gap-2 rounded-full bg-background/60 font-normal',
            selected && 'border-primary/40 bg-primary/8 font-medium text-primary hover:text-primary',
          )}
        >
          <span className="truncate">{selected ? selected.label : label}</span>
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command filter={rankMatch}>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList className="max-h-72">
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={`Any ${label}`} data-checked={value === null} onSelect={() => choose(null)}>
                <span className="text-muted-foreground">Any {label.toLowerCase()}</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  keywords={option.keywords}
                  data-checked={option.value === value}
                  onSelect={() => choose(option.value)}
                >
                  <OptionLabel option={option} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
