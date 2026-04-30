import { Product, Addon } from './db';

export const CATEGORIES = [
  'Pastéis Tradicionais',
  'Pastéis Especiais',
  'Pastéis Doces',
  'Bebidas',
  'Porções'
];

export const MOCK_ADDONS: Addon[] = [
  { id: 1, name: 'Catupiry Original', price: 3 },
  { id: 2, name: 'Cheddar', price: 3 },
  { id: 3, name: 'Bacon', price: 4 },
  { id: 4, name: 'Ovo', price: 2 },
  { id: 5, name: 'Carne Extra', price: 5 }
];

export const MOCK_PRODUCTS: Product[] = [
  { 
    id: 1, 
    name: 'Pastel de Carne', 
    price: 10, 
    category: 'Pastéis Tradicionais',
    available: true,
    addons: [1, 2, 3, 4]
  },
  { 
    id: 2, 
    name: 'Pastel de Queijo', 
    price: 10, 
    category: 'Pastéis Tradicionais',
    available: true,
    addons: [1, 2, 3]
  },
  { 
    id: 3, 
    name: 'Pastel de Frango c/ Catupiry', 
    price: 12, 
    category: 'Pastéis Tradicionais',
    available: true,
    addons: [3, 4]
  },
  { 
    id: 4, 
    name: 'Pastel Especial Maktub', 
    price: 18, 
    category: 'Pastéis Especiais',
    available: true,
    addons: [1, 2, 3, 4, 5]
  },
  { 
    id: 5, 
    name: 'Pastel de Chocolate', 
    price: 12, 
    category: 'Pastéis Doces',
    available: true
  },
  { 
    id: 6, 
    name: 'Coca-Cola 350ml', 
    price: 6, 
    category: 'Bebidas',
    available: true
  },
  { 
    id: 7, 
    name: 'Água Mineral', 
    price: 4, 
    category: 'Bebidas',
    available: true
  }
];
