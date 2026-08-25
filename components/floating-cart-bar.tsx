'use client'

import { ChevronRight, ShoppingBag } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { formatPrice } from '@/lib/menu-data'
import { cn } from '@/lib/utils'

export function FloatingCartBar({ onOpen }: { onOpen: () => void }) {
  const { count, total } = useCart()
  const visible = count > 0

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 px-4 pb-5 transition-all duration-400 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="glass flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left transition-transform duration-200 active:scale-[0.98]"
      >
        <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ShoppingBag className="size-4" aria-hidden="true" />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="font-sans text-[0.65rem] tracking-[0.22em] text-muted-foreground uppercase">
            {count} {count === 1 ? 'item' : 'items'} selected
          </span>
          <span className="font-serif text-lg leading-tight text-primary tabular-nums">
            {formatPrice(total)}
          </span>
        </span>
        <span className="flex items-center gap-1 font-sans text-[0.65rem] tracking-[0.22em] text-foreground uppercase">
          Review
          <ChevronRight className="size-4 text-primary" aria-hidden="true" />
        </span>
      </button>
    </div>
  )
}
