import Dexie, { type Table } from 'dexie';

export interface SaleItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  addons?: { name: string; price: number }[];
}

export interface Sale {
  id?: number; // Local incremental ID (primary key for Dexie)
  uuid: string; // Global unique ID (for Supabase sync)
  displayId: string; // Sequential ID for UI (#001, #002...)
  date: Date;
  customerName: string;
  items: SaleItem[];
  paymentMethod: 'cash' | 'credit' | 'debit' | 'pix' | 'multi';
  total: number;
  payments: { method: 'cash' | 'credit' | 'debit' | 'pix'; amount: number }[];
  cashReceived?: number;
  change?: number;
  cashierId: number;
  synced: number; // 0 = false, 1 = true (Dexie index compatibility)
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string;
  addons?: number[]; // IDs of addons
  available: boolean;
  order?: number;
}

export interface Addon {
  id: number;
  name: string;
  price: number;
  visible: boolean;
  product_ids?: number[];
}

export interface Category {
  id?: number;
  name: string;
  order: number;
  visible: boolean;
}

export class MaktubDatabase extends Dexie {
  sales!: Table<Sale>;
  products!: Table<Product>;
  addons!: Table<Addon>;
  categories!: Table<Category>;

  constructor() {
    super('MaktubPDV');
    this.version(1).stores({
      sales: '++id, uuid, displayId, date, synced',
      products: '++id, name, category, available',
      addons: '++id, name'
    });
    this.version(2).stores({
      categories: '++id, name, order, visible'
    });
    this.version(3).stores({
      products: '++id, name, category, available, order'
    });
  }
}

export const db = new MaktubDatabase();

/**
 * Requests persistent storage from the browser.
 * This helps prevent the OS from clearing IndexedDB data.
 */
export const requestPersistence = async () => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Storage persistence: ${isPersisted ? 'Granted' : 'Denied'}`);
    return isPersisted;
  }
  return false;
};
