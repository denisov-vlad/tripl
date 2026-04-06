import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "./theme-provider"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const next = () => {
    if (theme === "light") setTheme("dark")
    else if (theme === "dark") setTheme("system")
    else setTheme("light")
  }

  return (
    <button
      onClick={next}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-2 text-sm",
        "text-sidebar-muted-foreground hover:text-sidebar-foreground",
        "hover:bg-sidebar-accent transition-colors"
      )}
      title={`Theme: ${theme}`}
    >
      {theme === "light" && <Sun className="h-4 w-4" />}
      {theme === "dark" && <Moon className="h-4 w-4" />}
      {theme === "system" && <Monitor className="h-4 w-4" />}
    </button>
  )
}
