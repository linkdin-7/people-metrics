import { ChevronsUpDown } from 'lucide-react'
import { useRef, useState } from 'react'

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

type Suggestions = { values: string[]; heading: string; otherHeading: string }

type SearchSelectProps = {
  id: string
  label: string
  value: string
  options: FilterOption[]
  placeholder: string
  onChange: (value: string) => void
  onClose?: () => void
  invalid?: boolean
  describedBy?: string
  suggestions?: Suggestions
}

export function OptionLabel({ option }: { option: FilterOption }) {
  return (
    <>
      <span className="truncate">{option.label}</span>
      {option.hint && (
        <span
          aria-hidden="true"
          className="ml-auto rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground"
        >
          {option.hint}
        </span>
      )}
    </>
  )
}

export function SearchSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  onClose,
  invalid = false,
  describedBy,
  suggestions,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  function openChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setSearch('')
      onClose?.()
    }
  }

  function changeSearch(next: string) {
    setSearch(next)
    if (listRef.current) {
      listRef.current.scrollTop = 0
    }
  }

  // Before typing, suggested options come first; once searching, every option is ranked together.
  const suggested = new Set(suggestions?.values)
  const groups =
    suggestions && !search.trim()
      ? [
          { heading: suggestions.heading, options: options.filter((option) => suggested.has(option.value)) },
          { heading: suggestions.otherHeading, options: options.filter((option) => !suggested.has(option.value)) },
        ]
      : [{ heading: undefined, options }]

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-10 w-full justify-between font-normal aria-invalid:border-destructive"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 min-w-(--radix-popover-trigger-width) p-0">
        <Command filter={rankMatch}>
          <CommandInput
            placeholder={`Search ${label.toLowerCase()}…`}
            value={search}
            onValueChange={changeSearch}
          />
          <CommandList ref={listRef} className="max-h-72">
            <CommandEmpty>No matches.</CommandEmpty>
            {groups.map(
              (group) =>
                group.options.length > 0 && (
                  <CommandGroup key={group.heading ?? 'all'} heading={group.heading}>
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        keywords={option.keywords}
                        data-checked={option.value === value}
                        onSelect={() => {
                          onChange(option.value)
                          openChange(false)
                        }}
                      >
                        <OptionLabel option={option} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ),
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
