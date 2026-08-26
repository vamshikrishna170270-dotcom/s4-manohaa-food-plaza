'use client'

import Image from 'next/image'
import { Search } from 'lucide-react'

export function HeroHeader({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (value: string) => void
}) {
  return (
    <header className="relative isolate overflow-hidden rounded-b-[2.5rem]">
      <Image
        src="/interior-hero.webp" /* <-- YOUR NEW INTERIOR IMAGE PATH HERE */
        alt="S4 Manohaa Premium Dining Interior"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* The dark gradient overlay is already here and perfect! */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background" />

      <div className="relative flex min-h-[19rem] flex-col justify-end gap-6 px-5 pt-10 pb-8">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-primary/60" />
          <span className="font-sans text-[0.65rem] tracking-[0.4em] text-primary uppercase">
            S4 Manohaa Food Plaza
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="gold-text font-serif text-4xl leading-none font-light tracking-tight text-balance">
            PREMIUM DINING
          </h1>
          <p className="font-serif text-xl leading-relaxed text-foreground/85 italic">
            Good evening, Guest
          </p>
          <p className="max-w-[22rem] font-sans text-xs leading-relaxed text-muted-foreground text-pretty">
            Authentic flavors, crafted with passion. Experience the best Biryani and Tandoori in town.
          </p>
        </div>

        <label className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
          <Search className="size-[18px] shrink-0 text-primary" aria-hidden="true" />
          <span className="sr-only">Search the menu</span>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search biryani, kebabs, starters…"
            className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
      </div>
    </header>
  )
}