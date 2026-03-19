'use client'

import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Planeerija' },
  { href: '/dashboard', label: 'Riskid' },
  { href: '/plans', label: 'Plaanid' },
  { href: '/scenarios', label: 'Stsenaariumid' },
  { href: '/liability', label: 'Vastutus' },
  { href: '/pipeline', label: 'Hankeplaan' },
  { href: '/admin', label: 'Admin' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-print">
      {NAV_ITEMS.map(item => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex h-9 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition ${
              isActive
                ? 'bg-[#009B8D]/15 dark:bg-[#009B8D]/25 text-[#009B8D] dark:text-[#5EEAD4] ring-1 ring-[#009B8D]/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}
