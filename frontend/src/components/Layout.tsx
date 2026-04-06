import { Outlet } from 'react-router-dom'
import { AppSidebar } from './app-sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <ScrollArea className="flex-1">
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </ScrollArea>
    </div>
  )
}
