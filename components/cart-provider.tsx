'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { MenuItem } from '@/lib/menu-data'

export type CartLine = { item: MenuItem; qty: number }

type CartContextValue = {
  lines: CartLine[]
  count: number
  total: number
  qtyOf: (id: string) => number
  add: (item: MenuItem) => void
  remove: (id: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])

  const add = useCallback((item: MenuItem) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id)
      if (existing) {
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...prev, { item, qty: 1 }]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setLines((prev) =>
      prev
        .map((l) => (l.item.id === id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    )
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, l) => sum + l.qty, 0)
    const total = lines.reduce((sum, l) => sum + l.qty * l.item.price, 0)
    return {
      lines,
      count,
      total,
      qtyOf: (id) => lines.find((l) => l.item.id === id)?.qty ?? 0,
      add,
      remove,
      clear,
    }
  }, [lines, add, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
