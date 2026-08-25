'use client'

import { cn } from '@/lib/utils'
import { categories } from '@/lib/menu-data'

export function CategoryNav({
  activeCategory,
  activeSubcategory,
  onCategoryChange,
  onSubcategoryChange,
}: {
  activeCategory: string
  activeSubcategory: string
  onCategoryChange: (id: string) => void
  onSubcategoryChange: (id: string) => void
}) {
  const current = categories.find((c) => c.id === activeCategory) ?? categories[0]

  return (
    <nav aria-label="Menu categories" className="flex flex-col gap-3">
      <ul className="no-scrollbar flex gap-2.5 overflow-x-auto px-5">
        {categories.map((cat) => {
          const active = cat.id === activeCategory
          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'rounded-full px-5 py-2.5 font-sans text-xs tracking-[0.16em] uppercase transition-colors duration-200',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'glass text-muted-foreground',
                )}
              >
                {cat.name}
              </button>
            </li>
          )
        })}
      </ul>

      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-5">
        {current.subcategories.map((sub) => {
          const active = sub.id === activeSubcategory
          return (
            <li key={sub.id}>
              <button
                type="button"
                onClick={() => onSubcategoryChange(sub.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'rounded-full border px-4 py-1.5 font-sans text-[0.7rem] tracking-[0.14em] uppercase transition-colors duration-200',
                  active
                    ? 'border-primary/50 bg-primary/12 text-primary'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {sub.name}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
