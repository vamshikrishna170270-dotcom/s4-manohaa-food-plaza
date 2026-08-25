'use client'

import { useMemo, useState } from 'react'
import { CarouselRow } from '@/components/carousel-row'
import { CartDrawer } from '@/components/cart-drawer'
import { CartProvider } from '@/components/cart-provider'
import { CategoryNav } from '@/components/category-nav'
import { FloatingCartBar } from '@/components/floating-cart-bar'
import { HeroHeader } from '@/components/hero-header'
import { MenuList } from '@/components/menu-list'
import { categories, chefsRecommendations, menu, topOffers } from '@/lib/menu-data'

export function OrderExperience() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(categories[0].id)
  const [subcategory, setSubcategory] = useState(categories[0].subcategories[0].id)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleCategoryChange = (id: string) => {
    const next = categories.find((c) => c.id === id)
    if (!next) return
    setCategory(id)
    setSubcategory(next.subcategories[0].id)
  }

  const searching = query.trim().length > 0

  const items = useMemo(() => {
    if (searching) {
      const q = query.trim().toLowerCase()
      return menu.filter(
        (m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q),
      )
    }
    return menu.filter((m) => m.category === category && m.subcategory === subcategory)
  }, [query, searching, category, subcategory])

  const activeCategoryName = categories.find((c) => c.id === category)?.name ?? ''
  const activeSubName =
    categories
      .find((c) => c.id === category)
      ?.subcategories.find((s) => s.id === subcategory)?.name ?? ''

  return (
    <CartProvider>
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-10 pb-36">
        <HeroHeader query={query} onQueryChange={setQuery} />

        {!searching && (
          <>
            <CarouselRow
              eyebrow="Curated by Chef Advaith"
              title="Chef's Recommendations"
              items={chefsRecommendations}
            />
            <CarouselRow eyebrow="Until 2 AM" title="Top Offers of the Day" items={topOffers} />
          </>
        )}

        <section className="flex flex-col gap-5">
          {!searching && (
            <div className="flex flex-col gap-0.5 px-5">
              <span className="font-sans text-[0.6rem] tracking-[0.32em] text-primary uppercase">
                The Carte
              </span>
              <h2 className="font-serif text-2xl leading-tight font-light">Browse by course</h2>
            </div>
          )}

          {!searching && (
            <CategoryNav
              activeCategory={category}
              activeSubcategory={subcategory}
              onCategoryChange={handleCategoryChange}
              onSubcategoryChange={setSubcategory}
            />
          )}

          <div className="flex items-center justify-between gap-3 px-5">
            <h3 className="font-serif text-lg leading-tight text-foreground/90 italic">
              {searching ? `Results for "${query.trim()}"` : `${activeCategoryName} · ${activeSubName}`}
            </h3>
            <span className="font-sans text-[0.6rem] tracking-[0.2em] text-muted-foreground uppercase">
              {items.length} {items.length === 1 ? 'plate' : 'plates'}
            </span>
          </div>

          <MenuList items={items} />
        </section>

        <footer className="mt-2 flex flex-col items-center gap-1 px-5">
          <span className="h-px w-10 bg-primary/40" />
          <p className="font-serif text-sm text-muted-foreground italic">
            Kitchen closes at 2 AM · Service charge 8%
          </p>
        </footer>
      </main>

      <FloatingCartBar onOpen={() => setDrawerOpen(true)} />
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </CartProvider>
  )
}
