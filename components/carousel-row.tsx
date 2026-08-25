'use client'

import Image from 'next/image'
import { Plus } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { formatPrice, type MenuItem } from '@/lib/menu-data'

export function CarouselRow({
  title,
  eyebrow,
  items,
}: {
  title: string
  eyebrow: string
  items: (MenuItem & { offer?: string })[]
}) {
  const { add, qtyOf } = useCart()

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 px-5">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-[0.6rem] tracking-[0.32em] text-primary uppercase">
            {eyebrow}
          </span>
          <h2 className="font-serif text-2xl leading-tight font-light">{title}</h2>
        </div>
        <span className="font-sans text-[0.6rem] tracking-[0.2em] text-muted-foreground uppercase">
          Swipe
        </span>
      </div>

      <ul className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-1">
        {items.map((item) => {
          const qty = qtyOf(item.id)
          return (
            <li
              key={`${title}-${item.id}`}
              className="glass relative w-[15.5rem] shrink-0 snap-start overflow-hidden rounded-3xl"
            >
              <div className="relative h-40 w-full">
                <Image
                  src={item.image || '/placeholder.svg'}
                  alt={item.name}
                  fill
                  sizes="248px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/25 to-transparent" />
                {item.offer ? (
                  <span className="absolute top-3 left-3 rounded-full bg-accent/85 px-2.5 py-1 font-sans text-[0.6rem] font-medium tracking-[0.14em] text-accent-foreground uppercase backdrop-blur-sm">
                    {item.offer}
                  </span>
                ) : item.tag ? (
                  <span className="absolute top-3 left-3 rounded-full bg-background/60 px-2.5 py-1 font-sans text-[0.6rem] font-medium tracking-[0.14em] text-primary uppercase backdrop-blur-sm">
                    {item.tag}
                  </span>
                ) : null}
              </div>

              <div className="flex items-end justify-between gap-3 p-4 pt-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="truncate font-serif text-lg leading-tight">{item.name}</h3>
                  <p className="font-sans text-sm tracking-wide text-primary">
                    {formatPrice(item.price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => add(item)}
                  className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 active:scale-90"
                  aria-label={`Add ${item.name} to order`}
                >
                  <Plus className="size-5" aria-hidden="true" />
                  {qty > 0 && (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent font-sans text-[0.6rem] text-accent-foreground">
                      {qty}
                    </span>
                  )}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
