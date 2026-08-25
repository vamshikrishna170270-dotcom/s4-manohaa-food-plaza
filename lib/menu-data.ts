export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: string
  subcategory: string
  tag?: string
  offer?: string
}

export type Category = {
  id: string
  name: string
  subcategories: { id: string; name: string }[]
}

export const categories: Category[] = [
  {
    id: 'non-veg',
    name: 'Non-Veg',
    subcategories: [
      { id: 'biryani', name: 'Biryani' },
      { id: 'curries', name: 'Curries' },
      { id: 'starters', name: 'Starters' },
    ],
  },
  {
    id: 'veg',
    name: 'Veg',
    subcategories: [
      { id: 'curries', name: 'Curries' },
      { id: 'starters', name: 'Starters' },
      { id: 'biryani', name: 'Biryani' },
    ],
  },
  {
    id: 'beverages',
    name: 'Beverages',
    subcategories: [
      { id: 'cold', name: 'Chilled' },
      { id: 'hot', name: 'Brewed' },
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    subcategories: [{ id: 'plated', name: 'Plated' }],
  },
]

export const menu: MenuItem[] = [
  {
    id: 'dum-biryani',
    name: 'Nizami Lamb Dum Biryani',
    description: 'Sealed copper handi, 24-hour marinated lamb shank, Kashmiri saffron rice.',
    price: 1450,
    image: '/images/dish-biryani.png',
    category: 'non-veg',
    subcategory: 'biryani',
    tag: "Chef's Signature",
  },
  {
    id: 'kolkata-biryani',
    name: 'Kolkata Kacchi Biryani',
    description: 'Rose-scented long grain rice, smoked potato, spiced egg, kewra mist.',
    price: 1180,
    image: '/images/dish-biryani.png',
    category: 'non-veg',
    subcategory: 'biryani',
  },
  {
    id: 'butter-chicken',
    name: 'Makhani Poulet Noir',
    description: 'Charcoal-kissed chicken, tomato reduction, white butter, 23-karat gold leaf.',
    price: 1320,
    image: '/images/dish-butter-chicken.png',
    category: 'non-veg',
    subcategory: 'curries',
    tag: 'Most Ordered',
  },
  {
    id: 'laal-maas',
    name: 'Mewari Laal Maas',
    description: 'Mathania chilli, smoked ghee, slow-braised mutton, burnt garlic oil.',
    price: 1490,
    image: '/images/dish-butter-chicken.png',
    category: 'non-veg',
    subcategory: 'curries',
  },
  {
    id: 'lamb-chops',
    name: 'Tandoori Lamb Chops',
    description: 'Coal-charred rack, mint emulsion, pickled shallot, cardamom smoke.',
    price: 1680,
    image: '/images/dish-lamb-chops.png',
    category: 'non-veg',
    subcategory: 'starters',
    tag: 'Limited Nightly',
  },
  {
    id: 'paneer-tikka',
    name: 'Kesari Paneer Tikka',
    description: 'House-set paneer, saffron yoghurt, charred pepper, micro coriander.',
    price: 890,
    image: '/images/dish-paneer-tikka.png',
    category: 'veg',
    subcategory: 'starters',
  },
  {
    id: 'dal-makhani',
    name: 'Dal Makhani 36',
    description: 'Thirty-six hours over coal, black urad, brass bowl, cultured butter.',
    price: 780,
    image: '/images/dish-dal-makhani.png',
    category: 'veg',
    subcategory: 'curries',
    tag: 'House Classic',
  },
  {
    id: 'malai-kofta',
    name: 'Malai Kofta Royale',
    description: 'Silken cashew velouté, rose petal, slivered Iranian pistachio.',
    price: 940,
    image: '/images/dish-kofta.png',
    category: 'veg',
    subcategory: 'curries',
  },
  {
    id: 'veg-biryani',
    name: 'Awadhi Garden Biryani',
    description: 'Heirloom vegetables, mace-scented rice, fried onion, saffron milk.',
    price: 980,
    image: '/images/dish-biryani.png',
    category: 'veg',
    subcategory: 'biryani',
  },
  {
    id: 'rose-lassi',
    name: 'Saffron Rose Lassi',
    description: 'Hung curd, Kannauj rose water, saffron threads, crushed ice.',
    price: 420,
    image: '/images/drink-lassi.png',
    category: 'beverages',
    subcategory: 'cold',
  },
  {
    id: 'masala-chai',
    name: 'Midnight Masala Chai',
    description: 'Assam second flush, star anise, green cardamom, jaggery.',
    price: 320,
    image: '/images/drink-chai.png',
    category: 'beverages',
    subcategory: 'hot',
  },
  {
    id: 'kulfi',
    name: 'Kesar Pista Kulfi',
    description: 'Reduced milk, Kashmiri saffron, pistachio praline, edible gold.',
    price: 540,
    image: '/images/dish-kulfi.png',
    category: 'desserts',
    subcategory: 'plated',
    tag: 'Sommelier Pick',
  },
]

export const chefsRecommendations: MenuItem[] = [
  menu[0],
  menu[4],
  menu[2],
  menu[11],
]

export const topOffers: (MenuItem & { offer: string })[] = [
  { ...menu[6], offer: '20% off till 1 AM' },
  { ...menu[5], offer: 'Pairs free with chai' },
  { ...menu[7], offer: 'Second bowl at ₹1' },
  { ...menu[9], offer: 'Table of 4 — 2 free' },
]

export const formatPrice = (n: number) => `₹${n.toLocaleString('en-IN')}`
