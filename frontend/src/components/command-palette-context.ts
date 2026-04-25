import { createContext, useContext } from 'react'

export type CommandPaletteContextValue = {
  open: boolean
  setOpen: (next: boolean) => void
}

const NOOP_CONTEXT: CommandPaletteContextValue = {
  open: false,
  setOpen: () => {},
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue>(NOOP_CONTEXT)

export function useCommandPalette(): CommandPaletteContextValue {
  return useContext(CommandPaletteContext)
}
