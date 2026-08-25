'use client'

import Image from 'next/image'
import { Minus, Plus } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { formatPrice, type MenuItem } from '@/lib/menu-data'

export function MenuList({ items }: { items: MenuItem[] }) {
  const { add, remove, qtyOf } = useCart()

  if (items.length === 0) {
    return (
      <p className="glass mx-5 rounded-3xl px-6 py-10 text-center font-serif text-lg leading-relaxed text-muted-foreground italic">
        Nothing plated here tonight. Ask the maître d&apos; for the off-menu list.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3 px-5">
      {items.map((item) => {
        const qty = qtyOf(item.id)
        return (
          <li key={item.id} className="glass flex items-center gap-4 rounded-3xl p-3">
            <div className="relative size-[5.25rem] shrink-0 overflow-hidden rounded-2xl">
              <Image
                src={item.image || '/placeholder.svg'}
                alt={item.name}
                fill
                sizes="84px"
                className="object-cover"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {item.tag && (
                <span className="font-sans text-[0.58rem] tracking-[0.2em] text-primary uppercase">
                  {item.tag}
                </span>
              )}
              <h3 className="font-serif text-lg leading-tight">{item.name}</h3>
              <p className="line-clamp-2 font-sans text-[0.7rem] leading-relaxed text-muted-foreground text-pretty">
                {item.description}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-sans text-sm tracking-wide text-primary">
                {formatPrice(item.price)}
              </span>
              {qty === 0 ? (
                <button
                  type="button"
                  onClick={() => add(item)}
                  className="flex size-9 items-center justify-center rounded-full border border-primary/40 text-primary transition-all duration-200 active:scale-90 active:bg-primary active:text-primary-foreground"
                  aria-label={`Add ${item.name} to order`}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <div className="flex items-center gap-1 rounded-full bg-primary px-1.5 py-1 text-primary-foreground">
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="flex size-6 items-center justify-center rounded-full transition-transform active:scale-90"
                    aria-label={`Remove one ${item.name}`}
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                  <span className="min-w-4 text-center font-sans text-xs font-medium tabular-nums">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => add(item)}
                    className="flex size-6 items-center justify-center rounded-full transition-transform active:scale-90"
                    aria-label={`Add one more ${item.name}`}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
