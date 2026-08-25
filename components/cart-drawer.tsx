'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Check, Loader2, Minus, Plus, X } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { formatPrice } from '@/lib/menu-data'
import { cn } from '@/lib/utils'

const tables = ['T-01', 'T-04', 'T-07', 'T-11', 'Bar 02', 'Terrace']

type Status = 'idle' | 'sending' | 'confirmed'

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, count, total, add, remove, clear } = useCart()
  const [table, setTable] = useState('T-04')
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const serviceCharge = Math.round(total * 0.08)

  const placeOrder = () => {
    setStatus('sending')
    window.setTimeout(() => setStatus('confirmed'), 1600)
    window.setTimeout(() => {
      clear()
      setStatus('idle')
      onClose()
    }, 4000)
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-opacity duration-300',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close order summary"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your order"
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[88svh] flex-col overflow-hidden rounded-t-[2rem] border-t border-white/10 bg-card transition-transform duration-400 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {status === 'confirmed' ? (
          <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full border border-primary/40 text-primary">
              <Check className="size-7" aria-hidden="true" />
            </span>
            <h2 className="font-serif text-3xl leading-tight font-light">Order Confirmed</h2>
            <p className="max-w-xs font-sans text-xs leading-relaxed text-muted-foreground text-pretty">
              The kitchen has your ticket for table {table}. First course arrives in roughly
              fourteen minutes.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-[0.6rem] tracking-[0.32em] text-primary uppercase">
                  Your Order
                </span>
                <h2 className="font-serif text-2xl leading-tight font-light">
                  {count} {count === 1 ? 'plate' : 'plates'} selected
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="glass flex size-9 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto px-6">
              <ul className="flex flex-col gap-3">
                {lines.map(({ item, qty }) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={item.image || '/placeholder.svg'}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="truncate font-serif text-base leading-tight">{item.name}</h3>
                      <span className="font-sans text-xs text-muted-foreground">
                        {formatPrice(item.price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-1">
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        aria-label={`Remove one ${item.name}`}
                        className="flex size-6 items-center justify-center rounded-full text-muted-foreground"
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-4 text-center font-sans text-xs tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => add(item)}
                        aria-label={`Add one more ${item.name}`}
                        className="flex size-6 items-center justify-center rounded-full text-primary"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col gap-3">
                <span className="font-sans text-[0.6rem] tracking-[0.32em] text-primary uppercase">
                  Table
                </span>
                <div className="flex flex-wrap gap-2">
                  {tables.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTable(t)}
                      aria-pressed={table === t}
                      className={cn(
                        'rounded-full border px-4 py-2 font-sans text-[0.7rem] tracking-[0.14em] uppercase transition-colors',
                        table === t
                          ? 'border-primary/50 bg-primary/12 text-primary'
                          : 'border-white/10 text-muted-foreground',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <dl className="mt-6 flex flex-col gap-2 border-t border-white/8 pt-5 font-sans text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatPrice(total)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Service &amp; taxes</dt>
                  <dd className="tabular-nums">{formatPrice(serviceCharge)}</dd>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <dt className="font-serif text-lg text-foreground">Total</dt>
                  <dd className="font-sans text-lg tabular-nums text-primary">
                    {formatPrice(total + serviceCharge)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="p-6 pt-5">
              <button
                type="button"
                onClick={placeOrder}
                disabled={status === 'sending' || count === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-sans text-xs tracking-[0.28em] text-primary-foreground uppercase transition-transform duration-200 active:scale-[0.98] disabled:opacity-60"
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Sending to kitchen
                  </>
                ) : (
                  <>Place Order · {formatPrice(total + serviceCharge)}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
