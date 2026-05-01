'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CATEGORIES, MOCK_PRODUCTS, MOCK_ADDONS } from '@/lib/mock-data';
import { Product, Addon, SaleItem, db, Sale, requestPersistence } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  QrCode, 
  User,
  ChevronRight,
  CheckCircle2,
  Printer,
  Settings,
  Lock,
  LogOut,
  Smartphone,
  ChevronLeft,
  Delete,
  Space,
  History,
  FileText
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateDisplayId, resetOrderCounter, generateUUID } from '@/lib/utils-pdv';
import { useOfflineSync } from '@/hooks/useOfflineSync';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Custom Numeric Keyboard (Numpad)
function Numpad({ onInput, onDelete, onClear, onConfirm }: { onInput: (v: string) => void, onDelete: () => void, onClear: () => void, onConfirm?: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="grid grid-cols-3 gap-2 w-full">
      {keys.map(key => (
        <motion.button
          key={key}
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onInput(key)}
          className="h-14 bg-white/5 hover:bg-primary/20 rounded-xl font-black text-2xl border border-white/5 transition-premium"
        >
          {key}
        </motion.button>
      ))}
      
      {/* Botão Limpar no lugar da vírgula */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={onClear}
        className="h-14 bg-red-500/10 text-red-500 rounded-xl font-black text-xs uppercase border border-red-500/20"
      >
        Limpar
      </motion.button>

      {/* Zero no meio */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => onInput('0')}
        className="h-14 bg-white/5 hover:bg-primary/20 rounded-xl font-black text-2xl border border-white/5 transition-premium"
      >
        0
      </motion.button>

      {/* Botão 00 no lugar do OK/Delete */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => onInput('00')}
        className="h-14 bg-white/5 hover:bg-primary/20 rounded-xl font-black text-2xl border border-white/5 transition-premium"
      >
        00
      </motion.button>
    </div>
  );
}

// Custom Virtual Keyboard (Alpha + Numeric)
function VirtualKeyboard({ onInput, onDelete, onSpace }: { onInput: (v: string) => void, onDelete: () => void, onSpace: () => void }) {
  const [mode, setMode] = useState<'alpha' | 'numeric'>('alpha');
  
  const rowsAlpha = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];
  const rowsNumeric = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
    ['.', ',', '?', '!', '\'', '_']
  ];

  const rows = mode === 'alpha' ? rowsAlpha : rowsNumeric;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1">
          {i === 2 && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setMode(m => m === 'alpha' ? 'numeric' : 'alpha')}
              className="flex-[1.5] h-12 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg font-black text-[11px] border border-primary/20 transition-premium uppercase"
            >
              {mode === 'alpha' ? '?123' : 'ABC'}
            </motion.button>
          )}
          {row.map(key => (
            <motion.button
              key={key}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => onInput(key)}
              className="flex-1 h-12 bg-white/5 hover:bg-primary/20 rounded-lg font-black text-base border border-white/5 transition-premium"
            >
              {key}
            </motion.button>
          ))}
          {i === 2 && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onDelete}
              className="flex-[1.5] h-12 bg-white/5 hover:bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center border border-white/5"
            >
              <Delete className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      ))}
      <div className="flex gap-1 px-[10%]">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={onSpace}
          className="flex-1 h-12 bg-white/5 hover:bg-primary/20 rounded-lg flex items-center justify-center border border-white/5"
        >
          <Space className="w-6 h-6 opacity-40" />
          <span className="ml-2 text-[10px] font-black uppercase opacity-20 tracking-widest">ESPAÇO</span>
        </motion.button>
      </div>
    </div>
  );
}

// Helper para converter imagem para WebP e cortar 700x700
const processImageToWebP = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 700;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));

      // Calcula o redimensionamento "contain" (enquadrar sem cortar)
      const scale = Math.min(size / img.width, size / img.height);
      const newWidth = img.width * scale;
      const newHeight = img.height * scale;
      const startX = (size - newWidth) / 2;
      const startY = (size - newHeight) / 2;

      ctx.clearRect(0, 0, size, size); // Fundo transparente
      ctx.drawImage(img, startX, startY, newWidth, newHeight);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert canvas to blob'));
      }, 'image/webp', 0.8);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

// Memoized Product Card for better performance
const ProductCard = React.memo(({ product, onClick }: { product: Product, onClick: (p: Product) => void }) => {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(product)}
      className="bg-card rounded-xl border border-white/5 hover:border-primary/50 transition-premium group shadow-md flex flex-col overflow-hidden relative"
    >
      <div className="aspect-[4/3] w-full bg-white/5 relative overflow-hidden flex items-center justify-center">
         {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
         ) : (
            <ShoppingCart className="w-8 h-8 text-white/10 group-hover:scale-110 transition-all duration-500" />
         )}
         
         <div className="absolute top-2 right-2 px-2.5 py-1 bg-[#131313]/85 backdrop-blur-md rounded-lg shadow-md border border-white/5 flex items-center justify-center z-10">
            <span className="text-primary font-black text-[12px] lg:text-[14px] tracking-tighter">R$ {product.price.toFixed(2)}</span>
         </div>
      </div>
      <div className="py-2 px-2 flex flex-col items-center text-center bg-gradient-to-t from-black/40 to-transparent flex-1 justify-center">
         <h3 className="font-black text-[11px] lg:text-[12px] uppercase tracking-tight leading-tight line-clamp-2 text-white/90">{product.name}</h3>
      </div>
    </motion.button>
  );
});

ProductCard.displayName = 'ProductCard';

export default function PDVPage() {
  // UI State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState(1);
  const [tempAddons, setTempAddons] = useState<Addon[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [adminPass, setAdminPass] = useState('');
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [activeInput, setActiveInput] = useState<'name' | 'value' | 'admin'>('value');
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [isManagingProducts, setIsManagingProducts] = useState(false);
  const [isManagingAddons, setIsManagingAddons] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isAddonFormOpen, setIsAddonFormOpen] = useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormName, setProductFormName] = useState('');
  const [productFormPrice, setProductFormPrice] = useState('');
  const [productFormImage, setProductFormImage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'name' | 'price' | 'image' | null>(null);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [addonFormName, setAddonFormName] = useState('');
  const [addonFormPrice, setAddonFormPrice] = useState('0');
  const [addonFormProducts, setAddonFormProducts] = useState<number[]>([]);
  const [addonFocusedInput, setAddonFocusedInput] = useState<'name' | 'price' | null>(null);
  const [productFormAddons, setProductFormAddons] = useState<number[]>([]);
  const [cartIndexEditing, setCartIndexEditing] = useState<number | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [draggedProductId, setDraggedProductId] = useState<number | null>(null);
  const [dashboardStats, setDashboardStats] = useState<{
    totalDay: number,
    paymentMethods: Record<string, number>,
    ranking: { name: string, quantity: number }[]
  } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [sales, setSales] = useState<Sale[]>([]);
  
  // Sale State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'debit' | 'pix'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [payments, setPayments] = useState<{ method: 'cash' | 'credit' | 'debit' | 'pix', amount: number }[]>([]);
  const [cashierNumber] = useState(3);
  
  const { isOnline, pendingCount, lastSyncTime, pullRecentSales, pullMenu } = useOfflineSync();

  // Memoized lists to prevent re-filtering on every render
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => p.available)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name));
  }, [products]);

  const addonsForSelectedProduct = useMemo(() => {
    if (!selectedProduct) return [];
    return addons
      .filter(a => {
        if (!a.visible) return false;
        // Show if explicitly linked to product (from either side)
        const linkedFromAddon = a.product_ids?.includes(selectedProduct.id);
        const linkedFromProduct = selectedProduct.addons?.includes(a.id);
        
        return linkedFromAddon || linkedFromProduct;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addons, selectedProduct]);

  // Initialize Storage Persistence, Register SW and Keep Screen On
  // Physical Keyboard Listener for Forms
  useEffect(() => {
    if ((!isProductFormOpen || !focusedInput) && (!isAddonFormOpen || !addonFocusedInput)) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key;

      if (key === 'Backspace') {
        if (isProductFormOpen) {
          if (focusedInput === 'name') setProductFormName(prev => prev.slice(0, -1));
          else if (focusedInput === 'image') setProductFormImage(prev => prev.slice(0, -1));
          else if (focusedInput === 'price') setProductFormPrice(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        } else if (isAddonFormOpen) {
          if (addonFocusedInput === 'name') setAddonFormName(prev => prev.slice(0, -1));
          else if (addonFocusedInput === 'price') setAddonFormPrice(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        }
        return;
      }

      if (key === ' ') {
        if (isProductFormOpen && focusedInput === 'name') setProductFormName(prev => prev + ' ');
        else if (isAddonFormOpen && addonFocusedInput === 'name') setAddonFormName(prev => prev + ' ');
        return;
      }

      // Handle Price Input
      if (isProductFormOpen && focusedInput === 'price') {
        if (/^[0-9]$/.test(key)) setProductFormPrice(prev => (prev === '0' ? key : prev + key));
        else if (key === ',' || key === '.') setProductFormPrice(prev => prev.includes(',') ? prev : prev + ',');
        return;
      } else if (isAddonFormOpen && addonFocusedInput === 'price') {
        if (/^[0-9]$/.test(key)) setAddonFormPrice(prev => (prev === '0' ? key : prev + key));
        else if (key === ',' || key === '.') setAddonFormPrice(prev => prev.includes(',') ? prev : prev + ',');
        return;
      }

      // Handle Text Input
      if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isProductFormOpen) {
          if (focusedInput === 'name') setProductFormName(prev => prev + key);
          else if (focusedInput === 'image') setProductFormImage(prev => prev + key);
        } else if (isAddonFormOpen) {
          if (addonFocusedInput === 'name') setAddonFormName(prev => prev + key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProductFormOpen, focusedInput, isAddonFormOpen, addonFocusedInput]);

  // Wake Lock Ref
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active');
      }
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  const loadCategories = async () => {
    const cats = await db.categories.orderBy('order').toArray();
    setCategories(cats);
  };

  const loadProducts = async () => {
    const prods = await db.products.toArray();
    setProducts(prods);
  };

  const loadAddons = async () => {
      const ads = await db.addons.toArray();
      setAddons(ads);
  };

  // Initialize Storage Persistence, Register SW and Keep Screen On
  useEffect(() => {
    requestPersistence();
    requestWakeLock();
 
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW Registered!', reg))
        .catch(err => console.log('SW Error:', err));
    }

    let syncChannel: any;

    const init = async () => {
      await loadCategories();
      await loadProducts();
      await loadAddons();

      // Realtime Supabase Sync for Multi-Device
      syncChannel = supabase.channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload) => {
            if (payload.eventType === 'DELETE') {
               await db.products.delete(payload.old.id);
            } else {
               const p = payload.new;
               await db.products.put({ id: p.id, name: p.name, price: Number(p.price), category: p.category, available: p.available, image: p.image, addons: p.addon_ids || [], order: p.order });
            }
            await loadProducts();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async (payload) => {
            if (payload.eventType === 'DELETE') {
               await db.categories.delete(payload.old.id);
            } else {
               const c = payload.new;
               await db.categories.put({ id: c.id, name: c.name, order: Number(c.order), visible: c.visible });
            }
            await loadCategories();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'addons' }, async (payload) => {
            if (payload.eventType === 'DELETE') {
               await db.addons.delete(payload.old.id);
            } else {
               const a = payload.new;
               await db.addons.put({ id: a.id, name: a.name, price: Number(a.price), visible: a.visible });
            }
            await loadAddons();
        })
        .subscribe();
    };

    init();

    const handleVisibilityChange = () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLockRef.current !== null) wakeLockRef.current.release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (syncChannel) supabase.removeChannel(syncChannel);
    };
  }, []);


  // Load Sales History (With pagination)
  useEffect(() => {
    if (isHistoryOpen) {
      db.sales.reverse()
        .limit(ITEMS_PER_PAGE * historyPage)
        .toArray()
        .then(setSales);
    }
  }, [isHistoryOpen, historyPage]);

  const calculateDashboardStats = async () => {
    const allSales = await db.sales.toArray();
    const today = new Date().toDateString();
    
    const stats = {
      totalDay: 0,
      paymentMethods: { cash: 0, credit: 0, debit: 0, pix: 0, multi: 0 },
      ranking: {} as Record<string, number>
    };

    allSales.forEach(sale => {
      // Only sales from today for totalDay
      if (new Date(sale.date).toDateString() === today) {
        stats.totalDay += sale.total;
      }

      // Payment Methods
      if (sale.payments && sale.payments.length > 0) {
        sale.payments.forEach(p => {
          (stats.paymentMethods as any)[p.method] += p.amount;
        });
      } else {
        (stats.paymentMethods as any)[sale.paymentMethod] += sale.total;
      }

      // Item Ranking
      sale.items.forEach(item => {
        stats.ranking[item.name] = (stats.ranking[item.name] || 0) + item.quantity;
      });
    });

    const sortedRanking = Object.entries(stats.ranking)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    setDashboardStats({
      totalDay: stats.totalDay,
      paymentMethods: stats.paymentMethods,
      ranking: sortedRanking
    });
  };

  useEffect(() => {
    if (isDashboardOpen) {
      calculateDashboardStats();
    }
  }, [isDashboardOpen]);

  const addCategory = () => {
    setEditingCategory(null);
    setIsCategoryFormOpen(true);
  };

  const editCategoryName = (id: number, currentName: string) => {
    const cat = categories.find(c => c.id === id);
    if (cat) {
      setEditingCategory(cat);
      setIsCategoryFormOpen(true);
    }
  };

  const saveCategory = async (newName: string) => {
    if (!newName) return;
    try {
      let catId: number;
      if (editingCategory) {
        catId = editingCategory.id!;
        const oldName = editingCategory.name;
        await db.categories.update(catId, { name: newName });
        
        // Update products that were in the old category
        const productsToUpdate = await db.products.where('category').equals(oldName).toArray();
        for (const prod of productsToUpdate) {
          await db.products.update(prod.id!, { category: newName });
        }
        await loadProducts();
      } else {
        const count = await db.categories.count();
        catId = await db.categories.add({
          name: newName,
          order: count,
          visible: true
        }) as number;
      }
      await loadCategories();
      setIsCategoryFormOpen(false);

      if (isOnline) {
        const cat = await db.categories.get(catId);
        if (cat) supabase.from('categories').upsert({ id: cat.id, name: cat.name, order: cat.order, visible: cat.visible }).then();
      }
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
    }
  };

  const moveProduct = async (id: number, direction: 'up' | 'down') => {
    const sortedProducts = [...products].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name));
    const currentIndex = sortedProducts.findIndex(p => p.id === id);
    if (currentIndex === -1) return;

    if (direction === 'up' && currentIndex > 0) {
      const p1 = sortedProducts[currentIndex];
      const p2 = sortedProducts[currentIndex - 1];
      const temp = p1.order ?? currentIndex;
      p1.order = p2.order ?? (currentIndex - 1);
      p2.order = temp;
      await db.products.put(p1);
      await db.products.put(p2);
      if (isOnline) supabase.from('products').upsert([{ id: p1.id, name: p1.name, price: p1.price, category: p1.category, available: p1.available, image: p1.image, addon_ids: p1.addons || [], order: p1.order }, { id: p2.id, name: p2.name, price: p2.price, category: p2.category, available: p2.available, image: p2.image, addon_ids: p2.addons || [], order: p2.order }]).then();
      loadProducts();
    } else if (direction === 'down' && currentIndex < sortedProducts.length - 1) {
      const p1 = sortedProducts[currentIndex];
      const p2 = sortedProducts[currentIndex + 1];
      const temp = p1.order ?? currentIndex;
      p1.order = p2.order ?? (currentIndex + 1);
      p2.order = temp;
      await db.products.put(p1);
      await db.products.put(p2);
      if (isOnline) supabase.from('products').upsert([{ id: p1.id, name: p1.name, price: p1.price, category: p1.category, available: p1.available, image: p1.image, addon_ids: p1.addons || [], order: p1.order }, { id: p2.id, name: p2.name, price: p2.price, category: p2.category, available: p2.available, image: p2.image, addon_ids: p2.addons || [], order: p2.order }]).then();
      loadProducts();
    }
  };

  const handleDropProduct = async (targetId: number) => {
    if (!draggedProductId || draggedProductId === targetId) return;

    const sortedProducts = [...products].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name));
    
    const draggedIndex = sortedProducts.findIndex(p => p.id === draggedProductId);
    const targetIndex = sortedProducts.findIndex(p => p.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedItem] = sortedProducts.splice(draggedIndex, 1);
    sortedProducts.splice(targetIndex, 0, draggedItem);

    const updates = sortedProducts.map((p, index) => ({ ...p, order: index }));

    await db.products.bulkPut(updates);
    
    if (isOnline) {
       const supabaseUpdates = updates.map(p => ({
         id: p.id, name: p.name, price: p.price, category: p.category, available: p.available, image: p.image, addon_ids: p.addons || [], order: p.order
       }));
       supabase.from('products').upsert(supabaseUpdates).then();
    }
    
    setProducts(updates);
    setDraggedProductId(null);
  };

  const moveCategory = async (id: number, direction: 'up' | 'down') => {
    const cats = await db.categories.orderBy('order').toArray();
    const index = cats.findIndex(c => c.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cats.length) return;

    const currentCat = cats[index];
    const swapCat = cats[newIndex];

    const tempOrder = currentCat.order;
    currentCat.order = swapCat.order;
    swapCat.order = tempOrder;

    await db.categories.update(currentCat.id!, { order: currentCat.order });
    await db.categories.update(swapCat.id!, { order: swapCat.order });
    
    const newCats = await db.categories.orderBy('order').toArray();
    setCategories(newCats);

    if (isOnline) {
      supabase.from('categories').upsert([
        { id: currentCat.id, name: currentCat.name, order: currentCat.order, visible: currentCat.visible },
        { id: swapCat.id, name: swapCat.name, order: swapCat.order, visible: swapCat.visible }
      ]).then(({error}) => { if (error) console.error('Supabase Error:', error) });
    }
  };

  const toggleCategoryVisibility = async (id: number, visible: boolean) => {
    await db.categories.update(id, { visible: !visible });
    const newCats = await db.categories.orderBy('order').toArray();
    setCategories(newCats);

    if (isOnline) {
      const cat = await db.categories.get(id);
      if (cat) supabase.from('categories').upsert({ id: cat.id, name: cat.name, order: cat.order, visible: cat.visible }).then(({error}) => { if (error) console.error('Supabase Error:', error) });
    }
  };

  const deleteProduct = async (id: number) => {
    await db.products.delete(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    if (isOnline) supabase.from('products').delete().eq('id', id).then(({error}) => { if (error) console.error('Supabase Error:', error) });
  };

  const saveProduct = async (data: Partial<Product>) => {
    try {
      let prodId: number;
      const finalData = { ...data, addons: productFormAddons };
      if (editingProduct?.id) {
        prodId = editingProduct.id;
        await db.products.update(prodId, finalData);
      } else {
        const newProduct = { 
          ...finalData,
          name: data.name!, 
          price: data.price!, 
          category: data.category!, 
          available: true,
          image: data.image,
          order: products.length
        };
        delete (newProduct as any).id;
        prodId = await db.products.add(newProduct as Product) as number;
      }
      const prods = await db.products.toArray();
      setProducts(prods);
      setIsProductFormOpen(false);
      setEditingProduct(null);

      if (isOnline) {
        const prod = await db.products.get(prodId);
        if (prod) supabase.from('products').upsert({ id: prod.id, name: prod.name, price: prod.price, category: prod.category, available: prod.available, image: prod.image, addon_ids: prod.addons || [], order: prod.order }).then(({error}) => { if (error) console.error('Supabase Error:', error) });
      }
    } catch (err) {
      console.error('Erro ao salvar produto:', err);
    }
  };

  const toggleProductAvailability = async (id: number, available: boolean) => {
    await db.products.update(id, { available: !available });
    const prods = await db.products.toArray();
    setProducts(prods);

    if (isOnline) {
      const prod = await db.products.get(id);
      if (prod) supabase.from('products').upsert({ id: prod.id, name: prod.name, price: prod.price, category: prod.category, available: prod.available, image: prod.image, addon_ids: prod.addons || [], order: prod.order }).then(({error}) => { if (error) console.error('Supabase Error:', error) });
    }
  };

  const saveAddon = async (data: { name: string, price: number }) => {
    try {
      let addonId: number;
      const finalData = { ...data, product_ids: addonFormProducts, visible: true };
      if (editingAddon) {
        addonId = editingAddon.id!;
        await db.addons.update(addonId, finalData);
      } else {
        const newAddon = { ...finalData };
        delete (newAddon as any).id;
        addonId = await db.addons.add(newAddon as Addon) as number;
      }
      const updated = await db.addons.toArray();
      setAddons(updated);
      setIsAddonFormOpen(false);
      setEditingAddon(null);

      if (isOnline) {
        const addon = await db.addons.get(addonId);
        if (addon) supabase.from('addons').upsert({ id: addon.id, name: addon.name, price: addon.price, visible: addon.visible }).then();
      }
    } catch (err) {
      console.error('Erro ao salvar adicional:', err);
    }
  };

  const deleteAddon = async (id: number) => {
    await db.addons.delete(id);
    setAddons(prev => prev.filter(a => a.id !== id));
    if (isOnline) supabase.from('addons').delete().eq('id', id).then();
  };

  const toggleAddonVisibility = async (id: number, current: boolean) => {
    await db.addons.update(id, { visible: !current });
    setAddons(prev => prev.map(a => a.id === id ? { ...a, visible: !current } : a));
    
    if (isOnline) {
      const addon = await db.addons.get(id);
      if (addon) supabase.from('addons').upsert({ id: addon.id, name: addon.name, price: addon.price, visible: addon.visible }).then();
    }
  };

  const editCartItem = (index: number) => {
    const item = cart[index];
    const originalProduct = products.find(p => p.name === item.name);
    if (originalProduct) {
      setCartIndexEditing(index);
      setSelectedProduct(originalProduct);
      // Map names back to full Addon objects to maintain selection logic
      const fullAddons = (item.addons || []).map(ia => addons.find(a => a.name === ia.name)).filter(Boolean) as Addon[];
      setTempAddons(fullAddons);
      setTempQuantity(item.quantity);
    }
  };

  const addItemToCart = () => {
    if (!selectedProduct) return;
    
    const newItem: SaleItem = {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: selectedProduct.price,
      quantity: tempQuantity,
      image: selectedProduct.image,
      addons: tempAddons.map(a => ({ name: a.name, price: a.price }))
    };

    if (cartIndexEditing !== null) {
      const newCart = [...cart];
      newCart[cartIndexEditing] = newItem;
      setCart(newCart);
      setCartIndexEditing(null);
    } else {
      setCart(prev => [...prev, newItem]);
    }

    setSelectedProduct(null);
    setTempAddons([]);
    setTempQuantity(1);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const finalizeSale = async () => {
    const displayId = await generateDisplayId();
    
    const uuid = generateUUID();

    const sale: Sale = {
      uuid,
      displayId,
      date: new Date(),
      customerName: customerName || 'Cliente',
      items: cart,
      paymentMethod: payments.length > 1 ? 'multi' : (payments[0]?.method || 'cash'),
      total: cartTotal,
      payments: payments,
      change: change > 0 ? change : undefined,
      cashierId: cashierNumber,
      synced: 0
    };

    try {
      await db.sales.add(sale);
      setLastFinishedSale(sale); // Store to print on success screen
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsCheckoutOpen(false);
        setCart([]);
        setPayments([]);
        setCustomerName('');
        setCashReceived('');
        setIsNaming(false);
        setSelectedCategory(null);
        setActiveInput('value');
      }, 1500); // Increased back to 1.5s to allow time to see/click print
    } catch (err) {
      console.error('Failed to save sale:', err);
    }
  };

  const [lastFinishedSale, setLastFinishedSale] = useState<Sale | null>(null);

  const handlePrint = (sale: Sale) => {
    try {
      const lines = [];
      lines.push('       PASTELARIA MAKTUB       ');
      lines.push('-------------------------------');
      lines.push(`PEDIDO: ${sale.displayId}`);
      lines.push(`CLIENTE: ${sale.customerName.toUpperCase()}`);
      lines.push(`DATA: ${new Date(sale.date).toLocaleString('pt-BR')}`);
      lines.push('-------------------------------');
      lines.push('ITEM         QTD      VALOR    ');
      
      sale.items.forEach(item => {
        const name = item.name.substring(0, 12).padEnd(12);
        const qty = ('x' + item.quantity).padEnd(8);
        const price = ('R$' + item.price.toFixed(2)).padStart(9);
        lines.push(`${name} ${qty} ${price}`);
        if (item.addons && item.addons.length > 0) {
          lines.push(` + ${item.addons.map(a => a.name).join(', ')}`.substring(0, 31));
        }
      });

      lines.push('-------------------------------');
      lines.push(`TOTAL:           R$ ${sale.total.toFixed(2).padStart(10)}`);
      
      if (sale.paymentMethod === 'multi') {
        sale.payments?.forEach(p => {
          const m = (p.method === 'cash' ? 'DINHEIRO' : p.method === 'pix' ? 'PIX' : 'CARTAO').padEnd(15);
          lines.push(`${m} R$ ${p.amount.toFixed(2).padStart(10)}`);
        });
      } else {
        const m = (sale.paymentMethod === 'cash' ? 'DINHEIRO' : sale.paymentMethod === 'pix' ? 'PIX' : 'CARTAO').padEnd(15);
        lines.push(`${m} R$ ${sale.total.toFixed(2).padStart(10)}`);
      }

      if (sale.change && sale.change > 0) {
        lines.push(`TROCO:           R$ ${sale.change.toFixed(2).padStart(10)}`);
      }

      lines.push('-------------------------------');
      lines.push('    OBRIGADO PELA PREFERENCIA! ');
      lines.push('\n\n\n\n'); 

      const text = lines.join('\n');
      const base64 = btoa(unescape(encodeURIComponent(text)));
      window.location.href = `rawbt:base64,${base64}`;
    } catch (err) {
      console.error('Print failed:', err);
      alert('Erro ao enviar para impressora. Verifique o RawBT.');
    }
  };

  const verifyAdmin = () => {
    if (adminPass === '9900') {
      setIsAdminVerified(true);
    } else {
      alert('Senha incorreta');
      setAdminPass('');
    }
  };

  const clearAllData = async () => {
    if (!confirm('ATENÇÃO: Isso irá APAGAR PERMANENTEMENTE todos os produtos, categorias, adicionais e VENDAS deste aparelho. Tem certeza?')) return;
    await db.transaction('rw', db.categories, db.products, db.addons, db.sales, async () => {
      await db.categories.clear();
      await db.products.clear();
      await db.addons.clear();
      await db.sales.clear();
    });
    alert('Banco de dados local zerado!');
    window.location.reload();
  };

  const clearCloudData = async () => {
    if (!confirm('PERIGO: Isso irá APAGAR TODAS as categorias, produtos e adicionais do SUPABASE (Nuvem). Esta ação não pode ser desfeita. Continuar?')) return;
    try {
      await supabase.from('categories').delete().neq('id', 0);
      await supabase.from('products').delete().neq('id', 0);
      await supabase.from('addons').delete().neq('id', 0);
      alert('Nuvem limpa com sucesso!');
      await clearAllData();
    } catch (err) {
      alert('Erro ao limpar nuvem: ' + err);
    }
  };

  const exportConfig = async () => {
    const cats = await db.categories.toArray();
    const prods = await db.products.toArray();
    const ads = await db.addons.toArray();
    
    const config = {
      version: 'v2.9.6',
      categories: cats,
      products: prods,
      addons: ads,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uaipdv_config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Isso irá APAGAR todos os produtos, categorias e adicionais atuais deste aparelho e substituir pelos do arquivo. Continuar?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        
        await db.transaction('rw', db.categories, db.products, db.addons, async () => {
          await db.categories.clear();
          await db.products.clear();
          await db.addons.clear();
          
          if (config.categories) await db.categories.bulkAdd(config.categories);
          if (config.products) await db.products.bulkAdd(config.products);
          if (config.addons) await db.addons.bulkAdd(config.addons);
        });

        alert('Configuração importada com sucesso!');
        window.location.reload();
      } catch (err) {
        alert('Erro ao importar arquivo: ' + err);
      }
    };
    reader.readAsText(file);
  };

  const exportBackup = async () => {
    try {
      const allSales = await db.sales.toArray();
      const dataStr = JSON.stringify(allSales, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `backup_vendas_maktub_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (err) {
      alert('Erro ao exportar backup');
      console.error(err);
    }
  };

  // Calculations
  const cartTotal = cart.reduce((acc, item) => {
    const addonsTotal = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
    return acc + (item.price + addonsTotal) * item.quantity;
  }, 0);
  
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingTotal = Math.max(0, cartTotal - totalPaid);
  const hasCashPayment = payments.some(p => p.method === 'cash');
  const change = (totalPaid > cartTotal && hasCashPayment) ? (totalPaid - cartTotal) : 0;
  
  const getNumericValue = (val: string) => parseFloat(val.replace(',', '.')) || 0;

  const addPayment = () => {
    const amount = getNumericValue(cashReceived);
    if (amount <= 0) return;
    
    setPayments(prev => [...prev, { method: paymentMethod, amount }]);
    setCashReceived('');
    setActiveInput('value');
  };

  const removePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const openProductOptions = (product: Product) => {
    setSelectedProduct(product);
    setTempQuantity(1);
    setTempAddons([]);
  };

  const toggleAddon = (addon: Addon) => {
    setTempAddons(prev => {
      const exists = prev.find(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      }
      return [...prev, addon];
    });
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden font-sans text-foreground select-none">
      
      {/* Left Side: Product Selection (60%) */}
      <div className="flex-1 flex flex-col h-full border-r border-border">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border glass flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(255,107,0,0.2)] transition-premium">
                <img src="/logo.png" alt="Sabor Junino" className="w-full h-full object-cover" />
              </div>
              <h1 className="font-black text-2xl leading-tight tracking-tighter uppercase italic group-hover:text-primary transition-premium">SABOR JUNINO</h1>
            </div>
            
            <div className="h-8 w-[1px] bg-white/10" />

            <div className="flex items-center gap-4 text-[10px] font-black tracking-widest uppercase">
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full text-primary border border-primary/20">
                <span className="opacity-40">CAIXA</span>
                <span>#{cashierNumber}</span>
              </div>
              

              
              {isOnline ? (
                <div className="flex items-center gap-4 bg-green-500/10 px-4 py-1.5 rounded-full text-green-500 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="font-black">ONLINE</span>
                  </div>
                  {lastSyncTime && (
                    <div className="flex items-center gap-4 pl-3 border-l border-green-500/20">
                      <span className="text-white/30 text-[8px] font-bold">SYNC:</span>
                      <span className="text-white font-black">{lastSyncTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                  {pendingCount > 0 && (
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping" />
                      <div className="w-5 h-5 bg-amber-500 text-black rounded-full flex items-center justify-center text-[10px] font-black shadow-lg relative z-10">
                        {pendingCount}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-red-500/10 px-4 py-1.5 rounded-full text-red-500 border border-red-500/20">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span>OFFLINE</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <motion.button 
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsHistoryOpen(true)}
              className="p-3 rounded-xl bg-white/5 hover:bg-primary/10 transition-premium border border-white/5 flex items-center gap-2"
            >
              <History className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 hidden md:block">Vendas</span>
            </motion.button>
            
            <motion.button 
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => { 
                setAdminPass('');
                setIsAdminVerified(false);
                setIsAdminOpen(true); 
                setActiveInput('admin'); 
              }}
              className="p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-premium border border-white/5"
            >
              <Settings className="w-4 h-4 text-foreground/60" />
            </motion.button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-5 bg-background custom-scrollbar pb-24">
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onClick={openProductOptions} 
              />
            ))}
          </div>
        </main>
      </div>

      {/* Right Side: Cart (40%) */}
      <div className="w-[340px] lg:w-[380px] h-full flex flex-col bg-card shadow-[-20px_0_40px_rgba(0,0,0,0.5)] relative z-10 border-l border-white/5">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xl lg:text-2xl uppercase italic tracking-tighter">Carrinho</h3>
            <div className="px-3 py-1 bg-primary text-white rounded-full font-black text-sm shadow-lg shadow-primary/20">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center p-8">
              <div className="w-24 h-24 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                <ShoppingCart className="w-12 h-12" />
              </div>
              <p className="font-black uppercase tracking-widest text-[10px]">Vazio</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="flex gap-3 items-start group">
                <div className="w-16 h-16 rounded-xl bg-white/5 flex-shrink-0 relative overflow-hidden border border-white/5">
                   {item.image ? (
                     <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                   ) : (
                     <div className="absolute inset-0 flex items-center justify-center opacity-5">
                       <ShoppingCart className="w-6 h-6" />
                     </div>
                   )}
                </div>
                <div className="flex-1 py-0.5">
                  <h4 className="font-black text-sm uppercase leading-tight mb-1">{item.name}</h4>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {item.addons?.map((a, i) => (
                      <span key={i} className="text-[7px] font-black uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                        + {a.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-primary font-black text-base tracking-tighter">
                    {item.quantity}x R$ {(item.price + (item.addons?.reduce((s, a) => s + a.price, 0) || 0)).toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <motion.button 
                    type="button"
                    whileTap={{ scale: 0.8 }}
                    onTap={() => editCartItem(index)}
                    className="p-2 text-foreground/20 hover:text-primary transition-premium"
                  >
                    <Settings className="w-4 h-4" />
                  </motion.button>
                  <motion.button 
                    type="button"
                    whileTap={{ scale: 0.8 }}
                    onTap={() => removeFromCart(index)}
                    className="p-2 text-foreground/20 hover:text-red-500 transition-premium"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/5 bg-background/40">
          <div className="flex justify-between items-end mb-3">
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary italic">TOTAL DO PEDIDO</p>
              <p className="text-3xl font-black text-white tracking-tighter italic drop-shadow-[0_4px_10px_rgba(255,107,0,0.1)]">R$ {cartTotal.toFixed(2)}</p>
            </div>
            <motion.button 
              whileTap={{ scale: 0.8 }}
              onTap={() => setCart([])}
              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-foreground/20 hover:text-primary transition-premium hover:bg-primary/10"
            >
              <Trash2 className="w-3 h-3" />
            </motion.button>
          </div>
          
          <motion.button 
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="w-full bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed text-white py-3 rounded-lg font-black text-sm tracking-tight shadow-md transition-premium flex items-center justify-center gap-2 group uppercase italic"
          >
            Finalizar
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-premium" />
          </motion.button>
        </div>
      </div>

      {/* Modals with AnimatePresence */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="bg-card w-full max-w-5xl rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 flex flex-col lg:flex-row max-h-[90vh] py-2"
            >
              <div className="w-full lg:w-1/2 p-8 lg:p-10 border-r border-white/5 bg-white/5 overflow-y-auto">
                <motion.button 
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onTap={() => { setSelectedProduct(null); setCartIndexEditing(null); setTempAddons([]); setTempQuantity(1); }}
                  className="flex items-center gap-2 text-primary font-black uppercase text-[9px] mb-8 hover:gap-4 transition-premium px-4 py-2 bg-primary/10 rounded-full w-fit"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </motion.button>
                
                <div className="aspect-video bg-white/5 rounded-2xl mb-6 flex items-center justify-center overflow-hidden border border-white/10 shadow-inner group">
                  {selectedProduct.image ? (
                    <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain p-2 rounded-2xl drop-shadow-2xl transition-premium group-hover:scale-105" />
                  ) : (
                    <ShoppingCart className="w-14 h-14 text-white/10" />
                  )}
                </div>
                
                <h2 className="text-xl lg:text-3xl font-black uppercase tracking-tighter mb-2 leading-none">{selectedProduct.name}</h2>
                <p className="text-primary font-black text-lg lg:text-2xl tracking-tighter mb-6">R$ {selectedProduct.price.toFixed(2)}</p>
                
                <div className="flex items-center bg-background rounded-xl border-2 border-white/5 p-1 shadow-xl inline-flex">
                  <motion.button 
                    type="button"
                    whileTap={{ scale: 0.8 }}
                    onTap={() => setTempQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg hover:bg-white/5 flex items-center justify-center transition-premium text-primary"
                  >
                    <Minus className="w-5 h-5" />
                  </motion.button>
                  <span className="w-10 text-center text-xl font-black">{tempQuantity}</span>
                  <motion.button 
                    type="button"
                    whileTap={{ scale: 0.8 }}
                    onTap={() => setTempQuantity(q => q + 1)}
                    className="w-10 h-10 rounded-lg hover:bg-white/5 flex items-center justify-center transition-premium text-primary"
                  >
                    <Plus className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              <div className="flex-1 flex flex-col p-8 lg:p-10 overflow-hidden">
                <h3 className="text-xl font-black uppercase tracking-tighter mb-5 italic">Adicionais</h3>
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
                  {addonsForSelectedProduct.map((addon) => {
                    const isSelected = tempAddons.find(a => a.id === addon.id);
                    
                    return (
                      <motion.button
                        key={addon.id}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onTap={() => toggleAddon(addon)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-premium group cursor-pointer",
                          isSelected 
                            ? "border-primary bg-primary/20 shadow-lg" 
                            : "border-white/5 hover:border-white/20 bg-white/5"
                        )}
                      >
                        <div className="text-left pointer-events-none">
                          <p className="font-black uppercase tracking-wide text-xs">{addon.name}</p>
                          <p className={cn("font-bold text-[10px]", isSelected ? "text-primary" : "opacity-40")}>+ R$ {addon.price.toFixed(2)}</p>
                        </div>
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center transition-premium pointer-events-none",
                          isSelected ? "bg-primary text-white scale-110 shadow-lg" : "bg-white/5 text-transparent"
                        )}>
                          {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <motion.button 
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onTap={addItemToCart}
                  className="mt-6 w-full bg-primary text-white py-4 rounded-xl font-black text-base lg:text-lg uppercase tracking-tight shadow-xl shadow-primary/30 transition-premium"
                >
                  Confirmar • R$ {((selectedProduct.price + tempAddons.reduce((s, a) => s + a.price, 0)) * tempQuantity).toFixed(2)}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 lg:p-4 bg-black/95 backdrop-blur-3xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full max-w-6xl rounded-[2.5rem] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col lg:flex-row h-[95dvh]"
            >
              {isSuccess ? (
                <div className="w-full p-10 text-center flex flex-col items-center justify-center gap-4">
                  <motion.div 
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                  </motion.div>
                  <motion.h2 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-3xl lg:text-4xl font-black uppercase tracking-tighter italic"
                  >
                    Pedido Concluído!
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: 0.2 }}
                    className="text-white uppercase tracking-widest text-xs font-bold"
                  >
                    Obrigado pela preferência
                  </motion.p>
                  
                  {lastFinishedSale && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      onClick={() => handlePrint(lastFinishedSale)}
                      className="mt-4 flex items-center gap-3 bg-primary px-8 py-4 rounded-2xl text-white font-black uppercase italic tracking-tighter shadow-[0_10px_30px_rgba(255,107,0,0.3)] hover:scale-105 active:scale-95 transition-all"
                    >
                      <Printer className="w-5 h-5" />
                      Imprimir Cupom
                    </motion.button>
                  )}
                </div>
              ) : (
                <>
                  {/* Left: Info & Methods */}
                  <div className="flex-1 p-6 lg:p-7 flex flex-col gap-4 border-r border-white/5 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl lg:text-2xl font-black uppercase tracking-tighter italic">Finalizar</h2>
                        <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest italic">Pagamento e Identificação</p>
                      </div>
                      <motion.button 
                        whileTap={{ scale: 0.8 }}
                        onClick={() => setIsCheckoutOpen(false)} 
                        className="flex items-center gap-2 text-primary font-black uppercase text-[8px] px-4 py-2 bg-primary/10 rounded-full"
                      >
                        <ChevronLeft className="w-3 h-3" />
                        Voltar
                      </motion.button>
                    </div>


                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { id: 'cash', label: 'DINHEIRO', icon: Banknote, color: 'text-green-500' },
                        { id: 'pix', label: 'PIX', icon: QrCode, color: 'text-cyan-500' },
                        { id: 'credit', label: 'CRÉDITO', icon: CreditCard, color: 'text-fuchsia-500' },
                        { id: 'debit', label: 'DÉBITO', icon: CreditCard, color: 'text-amber-500' },
                      ].map(method => (
                        <motion.button
                          key={method.id}
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setPaymentMethod(method.id as 'cash' | 'credit' | 'debit' | 'pix'); setActiveInput('value'); }}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-xl border-2 transition-premium group",
                            paymentMethod === method.id 
                              ? "border-primary bg-primary/20 shadow-md" 
                              : "border-white/5 bg-white/5"
                          )}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center transition-premium",
                            paymentMethod === method.id ? "bg-primary text-white" : "bg-white/5 " + method.color
                          )}>
                            <method.icon className="w-5 h-5" />
                          </div>
                          <span className={cn(
                            "font-black text-sm lg:text-base uppercase tracking-tighter italic",
                            paymentMethod === method.id ? "text-white" : "text-white/40"
                          )}>
                            {method.label}
                          </span>
                        </motion.button>
                      ))}
                    </div>

                    <div className="bg-white/5 p-4 lg:p-5 rounded-[1.5rem] border border-white/10 shadow-2xl space-y-3 mt-auto">
                      <div className="flex justify-between items-end px-1">
                        <span className="text-white/30 text-[9px] font-black uppercase tracking-widest">Resumo do Pagamento</span>
                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase text-amber-500/50 leading-none">Falta Receber</p>
                          <p className="text-lg font-black text-amber-500 tracking-tighter italic">R$ {remainingTotal.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="max-h-[140px] overflow-y-auto space-y-2 custom-scrollbar pr-2">
                        {payments.length === 0 ? (
                          <div className="py-6 border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center gap-2">
                            <Banknote className="w-5 h-5 text-white/10" />
                            <p className="text-[9px] font-bold opacity-10 uppercase tracking-widest">Aguardando Pagamento</p>
                          </div>
                        ) : (
                          payments.map((p, i) => (
                            <div key={i} className="flex justify-between items-center bg-white/5 p-3.5 rounded-xl border border-white/5 group shadow-sm">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shadow-inner",
                                  p.method === 'cash' ? "bg-green-500/20 text-green-500" :
                                  p.method === 'pix' ? "bg-cyan-500/20 text-cyan-500" :
                                  "bg-primary/20 text-primary"
                                )}>
                                  {p.method === 'cash' ? 'D' : p.method === 'pix' ? 'P' : 'C'}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[7px] font-black opacity-30 uppercase tracking-widest">
                                    {p.method === 'cash' ? 'Dinheiro' : p.method === 'pix' ? 'Pix' : 'Cartão'}
                                  </p>
                                  <span className="font-black text-sm lg:text-base text-white tracking-tighter italic">R$ {p.amount.toFixed(2)}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => removePayment(i)} 
                                className="bg-red-500/10 text-red-500 p-2.5 hover:bg-red-500 text-white transition-premium rounded-xl shadow-sm border border-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="flex justify-between items-center border-t border-white/10 pt-4">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Total a Pagar</p>
                          <div className="flex items-center gap-2.5">
                            <div className="w-1.5 h-6 bg-primary rounded-full" />
                            <p className="text-3xl lg:text-4xl font-black text-white tracking-tighter italic">
                              R$ {cartTotal.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {change > 0 && (
                          <div className="text-right">
                             <p className="text-[9px] font-black uppercase tracking-[0.2em] text-green-500/40">Troco</p>
                             <p className="text-2xl lg:text-3xl font-black text-green-500 tracking-tighter italic">
                              R$ {change.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Custom Dynamic Keyboard Panel */}
                  <div className="w-full lg:w-[480px] bg-white/5 p-6 lg:p-7 flex flex-col gap-4 overflow-hidden">
                    <motion.button 
                      onClick={() => setActiveInput('value')}
                      className={cn(
                        "w-full bg-background p-4 rounded-xl border-2 text-right transition-premium shadow-2xl",
                        activeInput === 'value' ? "border-primary shadow-primary/20" : "border-white/5"
                      )}
                    >
                       <p className="text-[8px] font-black uppercase tracking-widest text-primary/40 mb-1">Recebido</p>
                       <span className="text-3xl font-black text-primary tracking-tighter italic">
                        R$ {cashReceived || '0,00'}
                      </span>
                    </motion.button>

                    <div className="flex-1 flex flex-col justify-center">
                      <AnimatePresence mode="wait">
                        {isNaming ? (
                          <motion.div 
                            key="naming"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                          >
                            <div className="bg-background p-5 rounded-2xl border-2 border-primary shadow-2xl">
                              <p className="text-[9px] font-black uppercase tracking-widest text-primary/40 mb-2 text-center">Identificar Cliente (Opcional)</p>
                              <div className="flex items-center justify-center gap-3">
                                <User className="w-5 h-5 text-primary" />
                                <span className={cn("font-black text-2xl uppercase", customerName ? "text-white" : "text-white/10")}>
                                  {customerName || 'SEM NOME'}
                                </span>
                              </div>
                            </div>
                            <VirtualKeyboard 
                              onInput={(v) => setCustomerName(prev => (prev + v).slice(0, 20))}
                              onSpace={() => setCustomerName(prev => prev + ' ')}
                              onDelete={() => setCustomerName(prev => prev.slice(0, -1))}
                            />
                            <div className="flex gap-3">
                              <button 
                                onClick={() => { setCustomerName(''); finalizeSale(); }}
                                className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-black text-xs uppercase tracking-widest transition-premium"
                              >
                                Pular
                              </button>
                              <button 
                                onClick={finalizeSale}
                                className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-premium"
                              >
                                {customerName ? 'Confirmar e Concluir' : 'Concluir sem Nome'}
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="numpad"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-4"
                          >
                            <Numpad 
                              onInput={(v) => setCashReceived(prev => (prev === '0,00' ? v : prev + v))}
                              onDelete={() => setCashReceived(prev => prev.slice(0, -1))}
                              onClear={() => setCashReceived('')}
                            />
                            <div className="flex gap-3">
                              <motion.button 
                                onClick={addPayment}
                                className={cn(
                                  "flex-1 bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-tighter shadow-lg orange-glow flex items-center justify-center gap-2 transition-premium",
                                  getNumericValue(cashReceived) <= 0 && "opacity-50 grayscale pointer-events-none"
                                )}
                              >
                                <Plus className="w-4 h-4" /> Adicionar
                              </motion.button>

                              <motion.button 
                                type="button"
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  if (totalPaid < cartTotal) {
                                    setCashReceived(remainingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                  } else {
                                    setIsNaming(true);
                                  }
                                }}
                                className={cn(
                                  "flex-[1.5] py-4 rounded-2xl font-black text-base lg:text-lg uppercase tracking-tighter italic transition-premium",
                                  totalPaid < cartTotal 
                                    ? "bg-amber-500/20 text-amber-500 border-2 border-amber-500/50 hover:bg-amber-500/30 active:scale-95" 
                                    : "bg-green-600 text-white shadow-[0_15px_40_rgba(34,197,94,0.3)] hover:scale-[1.02]"
                                )}
                              >
                                {totalPaid < cartTotal ? (
                                  <div className="flex flex-col items-center leading-none">
                                    <span className="text-[8px] opacity-60 mb-1">Clique para auto-preencher</span>
                                    <span>Falta R$ {remainingTotal.toFixed(2)}</span>
                                  </div>
                                ) : 'Concluir Venda'}
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                    </AnimatePresence>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 lg:p-12 bg-black/95 backdrop-blur-3xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="bg-card w-full max-w-5xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 flex flex-col h-full lg:h-[80vh]"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                     <History className="w-6 h-6 text-primary" />
                   </div>
                   <div>
                     <h2 className="text-2xl font-black uppercase tracking-tighter italic">Histórico de Vendas</h2>
                     <p className="text-[10px] font-black opacity-40 uppercase tracking-widest italic">Todas as transações do tablet</p>
                   </div>
                </div>
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onTap={() => setIsHistoryOpen(false)} 
                  className="flex items-center gap-2 text-primary font-black uppercase text-xs hover:gap-4 transition-premium px-6 py-3 bg-primary/10 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Voltar
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                {sales.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-10">
                    <FileText className="w-20 h-20 mb-4" />
                    <p className="font-black uppercase tracking-widest">Nenhuma venda encontrada</p>
                  </div>
                ) : (
                  sales.map((sale) => (
                    <motion.div 
                      key={sale.id} 
                      onTap={() => setExpandedSaleId(expandedSaleId === sale.id ? null : (sale.id ?? null))}
                      layout
                      className={cn(
                        "p-6 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-4 hover:bg-white/10 transition-premium group cursor-pointer",
                        expandedSaleId === sale.id && "bg-white/10 border-primary/40 shadow-2xl"
                      )}
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-[105px] h-14 rounded-xl flex items-center justify-center font-mono font-black text-base bg-white/5 text-primary border border-white/10 shadow-inner"
                          )}>
                            {sale.displayId}
                          </div>
                          <div>
                            <h4 className="font-black text-xl uppercase leading-none mb-1.5">{sale.customerName}</h4>
                            <p className="text-sm font-bold opacity-60 uppercase tracking-widest flex items-center gap-2">
                              {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 
                              <span className="w-2 h-2 bg-primary/40 rounded-full" />
                              <span className={cn(
                                "font-black px-2.5 py-1 rounded-md text-[10px] tracking-tighter",
                                sale.paymentMethod === 'cash' ? "bg-green-500/20 text-green-400 border border-green-500/20" :
                                sale.paymentMethod === 'pix' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20" :
                                sale.paymentMethod === 'multi' ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/20" :
                                sale.paymentMethod === 'credit' ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/20" :
                                "bg-amber-500/20 text-amber-400 border border-amber-500/20"
                              )}>
                                {sale.paymentMethod === 'cash' ? 'DINHEIRO' :
                                 sale.paymentMethod === 'pix' ? 'PIX' :
                                 sale.paymentMethod === 'multi' ? 'MISTO' :
                                 sale.paymentMethod === 'credit' ? 'CRÉDITO' : 'DÉBITO'}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-primary tracking-tighter italic">R$ {sale.total.toFixed(2)}</p>
                          <div className="flex items-center justify-end gap-2 mt-1.5">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrint(sale);
                              }}
                              className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-primary transition-all border border-white/5"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {sale.synced ? (
                              <span className="text-[9px] font-black uppercase text-green-400 bg-green-500/10 px-2.5 py-1 rounded-md border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">Sincronizado</span>
                            ) : (
                              <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 italic animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.1)]">Aguardando Sync</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedSaleId === sale.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden border-t border-white/5 pt-6 mt-3"
                          >
                            <div className="bg-background/60 rounded-2xl p-5 border border-white/5 shadow-inner">
                              <table className="w-full text-left border-separate border-spacing-y-1">
                                <thead>
                                  <tr className="text-[10px] font-black uppercase tracking-widest opacity-30">
                                    <th className="pb-4 px-2">Item / Adicionais</th>
                                    <th className="pb-4 px-2 text-center">Qtd</th>
                                    <th className="pb-4 px-2 text-right">V. Unit</th>
                                    <th className="pb-4 px-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="text-xs font-bold uppercase tracking-tight">
                                  {sale.items.map((item, idx) => (
                                    <tr key={idx} className="group/row transition-premium">
                                      <td className="py-3 px-2 bg-white/[0.02] rounded-l-xl">
                                        <div className="text-foreground text-[13px]">{item.name}</div>
                                        {item.addons && item.addons.length > 0 && (
                                          <div className="text-[9px] text-primary/70 italic mt-1 font-medium lowercase">
                                            + {item.addons.map(a => a.name).join(', ')}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 px-2 text-center bg-white/[0.02] opacity-60 text-sm">x{item.quantity}</td>
                                      <td className="py-3 px-2 text-right bg-white/[0.02] opacity-60">R$ {item.price.toFixed(2)}</td>
                                      <td className="py-3 px-2 text-right bg-white/[0.02] rounded-r-xl text-primary font-black text-sm">R$ {((item.price + (item.addons?.reduce((s, a) => s + a.price, 0) || 0)) * item.quantity).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Payment Breakdown */}
                            <div className="mt-4 flex flex-wrap gap-2.5">
                              {sale.payments && sale.payments.length > 0 ? (
                                sale.payments.map((p, i) => (
                                  <div key={i} className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 shadow-sm">
                                    <div className={cn(
                                      "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black",
                                      p.method === 'cash' ? "bg-green-500/20 text-green-500" :
                                      p.method === 'pix' ? "bg-cyan-500/20 text-cyan-500" :
                                      "bg-primary/20 text-primary"
                                    )}>
                                      {p.method === 'cash' ? 'D' : p.method === 'pix' ? 'P' : 'C'}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[7px] font-black opacity-30 uppercase tracking-widest">{p.method === 'cash' ? 'Dinheiro' : p.method === 'pix' ? 'Pix' : 'Cartão'}</span>
                                      <span className="text-sm font-black text-white tracking-tighter italic">R$ {p.amount.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 opacity-50">
                                  <span className="text-[10px] font-black uppercase italic text-white/40">Pagamento: {sale.paymentMethod}</span>
                                  <span className="text-sm font-black text-white px-2">R$ {sale.total.toFixed(2)}</span>
                                </div>
                              )}
                              {sale.change && sale.change > 0 && (
                                <div className="flex items-center gap-3 bg-green-500/5 px-4 py-2.5 rounded-xl border border-green-500/20 ml-auto">
                                  <div className="flex flex-col text-right">
                                    <span className="text-[7px] font-black text-green-500/50 uppercase tracking-widest">Troco Devolvido</span>
                                    <span className="text-sm font-black text-green-500 tracking-tighter italic">R$ {sale.change.toFixed(2)}</span>
                                  </div>
                                  <Banknote className="w-5 h-5 text-green-500/40" />
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                )}

                {sales.length >= ITEMS_PER_PAGE * historyPage && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setHistoryPage(prev => prev + 1)}
                    className="w-full py-4 bg-white/5 rounded-2xl font-black uppercase text-xs tracking-widest opacity-40 hover:opacity-100 transition-premium mb-10"
                  >
                    Carregar Mais Vendas
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Login/Settings Modal */}
      <AnimatePresence>
        {isAdminOpen && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="bg-card w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 p-7 flex flex-col gap-5"
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <h2 className="text-xl lg:text-2xl font-black uppercase tracking-tighter italic flex items-center gap-3">
                    <Lock className="w-6 h-6 text-primary" />
                    Gestão Admin
                  </h2>
                  <motion.button 
                    whileTap={{ scale: 0.8 }}
                    onTap={() => { setIsAdminOpen(false); setIsAdminVerified(false); setAdminPass(''); }} 
                    className="flex items-center gap-2 text-primary font-black uppercase text-[10px] hover:gap-4 transition-premium px-5 py-2.5 bg-primary/10 rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Voltar
                  </motion.button>
                </div>

                {!isAdminVerified ? (
                  <div className="flex flex-col gap-6">
                    <div className="bg-background p-4 rounded-3xl border-2 border-primary/30 text-center shadow-inner">
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Senha de Acesso</p>
                      <p className="text-3xl font-black tracking-[0.4em] text-primary">{'*'.repeat(adminPass.length) || '----'}</p>
                    </div>
                    
                    <Numpad 
                      onInput={(v) => adminPass.length < 4 && setAdminPass(prev => prev + v)}
                      onDelete={() => setAdminPass(prev => prev.slice(0, -1))}
                      onClear={() => setAdminPass('')}
                    />

                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onTap={verifyAdmin}
                      className="w-full bg-primary text-white py-5 rounded-2xl font-black text-lg uppercase tracking-tighter shadow-xl shadow-primary/30 italic"
                    >
                      Acessar Painel
                    </motion.button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onTap={() => setIsDashboardOpen(true)}
                        className="w-full flex items-center gap-4 p-4 bg-primary/10 rounded-2xl hover:bg-primary/20 border border-primary/30 transition-premium group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white transition-premium shadow-lg">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left flex flex-col">
                          <span className="font-black text-base uppercase tracking-tight italic text-primary leading-none">Painel de Vendas</span>
                          <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest mt-1">Estatísticas e Ranking</span>
                        </div>
                        <ChevronRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-premium" />
                      </motion.button>

                      {[
                        { label: 'Gerenciar Produtos', icon: ShoppingCart, action: () => setIsManagingProducts(true) },
                        { label: 'Gerenciar Categorias', icon: Settings, action: () => setIsManagingCategories(true) },
                        { label: 'Gerenciar Adicionais', icon: Plus, action: () => setIsManagingAddons(true) },
                      ].map((item, i) => (
                        <motion.button 
                          key={i} 
                          whileTap={{ scale: 0.98 }}
                          onTap={item.action}
                          className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-primary/10 border border-transparent hover:border-primary/50 transition-premium group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary text-foreground/40 group-hover:text-white transition-premium shadow-lg">
                            <item.icon className="w-5 h-5" />
                          </div>
                          <span className="font-black text-base uppercase tracking-tight italic">{item.label}</span>
                          <ChevronRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-premium" />
                        </motion.button>
                      ))}
                    </div>

                    <div className="pt-5 border-t border-white/5 space-y-4 mt-auto">
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onTap={() => { setIsAdminVerified(false); setAdminPass(''); }}
                        className="w-full flex items-center justify-center gap-3 p-4 text-red-500 bg-red-500/5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/10 transition-premium border border-red-500/10"
                      >
                        <LogOut className="w-4 h-4" />
                        Encerrar Sessão
                      </motion.button>
                      
                      <div className="flex justify-between items-center px-1">
                        <a 
                          href="https://wa.me/5511999514289" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-primary transition-colors italic"
                        >
                          feito por aalves.dev
                        </a>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 italic">v4.1.0</span>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}
      </AnimatePresence>

      {/* Product Management Modal */}
      <AnimatePresence>
        {isManagingProducts && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 p-8 flex flex-col gap-6 max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex flex-col">
                  <h2 className="text-base font-black uppercase tracking-tighter italic flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    Produtos
                  </h2>
                  <div className="flex gap-1.5 mt-2">
                    <button 
                      onClick={exportConfig}
                      className="text-[11px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition-premium"
                    >
                      Exportar
                    </button>
                    <label className="text-[11px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition-premium cursor-pointer">
                      Importar
                      <input type="file" accept=".json" onChange={importConfig} className="hidden" />
                    </label>
                    <button 
                      onClick={async () => {
                        const ok = await pullMenu();
                        if (ok) {
                          await loadCategories();
                          await loadProducts();
                          await loadAddons();
                          alert('Sincronizado!');
                        }
                      }}
                      className="text-[11px] font-black uppercase tracking-widest bg-primary/20 hover:bg-primary/30 px-3 py-1.5 rounded-full border border-primary/40 text-primary transition-premium flex items-center gap-1"
                    >
                      <Smartphone className="w-3 h-3" />
                      Sync Nuvem
                    </button>
                  </div>
                </div>
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onTap={() => setIsManagingProducts(false)} 
                  className="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-full text-primary font-black uppercase text-[10px] tracking-widest transition-premium border border-primary/20"
                >
                  Fechar
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-3">
                  {[...products]
                    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))
                    .map((prod, idx, arr) => (
                    <div 
                      key={prod.id} 
                      draggable
                      onDragStart={(e) => {
                        setDraggedProductId(prod.id!);
                        // Set visual drag image to empty so it doesn't look weird
                        // but it still works
                      }}
                      onDragOver={(e) => {
                        e.preventDefault(); // Necessary to allow dropping
                        e.currentTarget.style.opacity = '0.5';
                        e.currentTarget.style.borderTop = '2px solid #ff4500'; // Primary color
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.borderTop = '';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.borderTop = '';
                        handleDropProduct(prod.id!);
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.borderTop = '';
                        setDraggedProductId(null);
                      }}
                      className={cn("p-4 rounded-xl border flex justify-between items-start transition-all duration-200 cursor-move", !prod.available ? 'bg-white/5 opacity-50 grayscale border-white/5' : draggedProductId === prod.id ? 'opacity-30 bg-primary/10 border-primary border-dashed scale-95' : 'bg-white/5 border-primary/20 hover:border-primary/50')}
                    >
                      <div className="flex items-start gap-4">
                        {prod.image ? (
                          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 shrink-0 mt-1">
                            <img src={prod.image} alt={prod.name} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 shrink-0 mt-1">
                            <ShoppingCart className="w-5 h-5 opacity-20" />
                          </div>
                        )}
                        <div>
                          <span className="font-black text-xs uppercase opacity-40">{prod.category}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-black text-base uppercase italic leading-tight">{prod.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button 
                              onClick={() => { 
                                setEditingProduct(prod); 
                                setProductFormName(prod.name);
                                setProductFormImage(prod.image || '');
                                setProductFormPrice(prod.price.toString().replace('.', ',')); 
                                setProductFormAddons(prod.addons || []);
                                setFocusedInput('name');
                                setIsProductFormOpen(true); 
                              }} 
                              className="px-4 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-premium"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => { if(confirm('Excluir?')) deleteProduct(prod.id!) }} 
                              className="px-4 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-premium"
                            >
                              Excluir
                            </button>
                            <div className="flex border border-white/10 rounded-lg overflow-hidden ml-2">
                              <button
                                onClick={() => moveProduct(prod.id!, 'up')}
                                disabled={idx === 0}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-premium"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveProduct(prod.id!, 'down')}
                                disabled={idx === arr.length - 1}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-premium border-l border-white/10"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="font-black text-base italic text-primary">
                          R$ {prod.price.toFixed(2)}
                        </span>
                        <button 
                          onClick={() => toggleProductAvailability(prod.id!, prod.available)}
                          className={cn(
                            "px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest border transition-premium w-24",
                            prod.available 
                              ? "bg-green-500/10 text-green-500 border-green-500/20" 
                              : "bg-red-500/10 text-red-500 border-red-500/20 opacity-40"
                          )}
                        >
                          {prod.available ? 'Ativo' : 'Pausado'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={() => { 
                  setEditingProduct(null); 
                  setProductFormName('');
                  setProductFormImage('');
                  setProductFormPrice('0'); 
                  setProductFormAddons([]);
                  setFocusedInput('name');
                  setIsProductFormOpen(true); 
                }}
                className="w-full bg-white/5 border border-white/10 text-white/60 py-4 rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-premium"
              >
                + Novo Produto
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {isManagingCategories && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 p-8 flex flex-col gap-6 max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h2 className="text-base font-black uppercase tracking-tighter italic flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Categorias
                </h2>
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onTap={() => setIsManagingCategories(false)} 
                  className="px-5 py-2.5 bg-primary/10 hover:bg-primary/20 rounded-full text-primary font-black uppercase text-[10px] tracking-widest transition-premium border border-primary/20"
                >
                  Fechar
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                {categories.map((cat, i) => (
                  <div key={cat.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="font-black text-base uppercase italic leading-tight">{cat.name}</span>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => editCategoryName(cat.id!, cat.name)} className="px-4 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-premium">Editar</button>
                        <div className="flex border border-white/10 rounded-lg overflow-hidden">
                          <button onClick={() => moveCategory(cat.id!, 'up')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-premium">▲</button>
                          <button onClick={() => moveCategory(cat.id!, 'down')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-premium border-l border-white/10">▼</button>
                        </div>
                      </div>
                    </div>

                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleCategoryVisibility(cat.id!, cat.visible)}
                      className={cn(
                        "px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest border transition-premium w-24",
                        cat.visible ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20 opacity-40"
                      )}
                    >
                      {cat.visible ? 'Visível' : 'Oculto'}
                    </motion.button>
                  </div>
                ))}
              </div>

              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={addCategory}
                className="w-full bg-white/5 border border-white/10 text-white/60 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 hover:text-white transition-premium"
              >
                + Nova Categoria
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Form Modal */}
      <AnimatePresence>
        {isCategoryFormOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card w-full max-w-sm rounded-[2rem] border border-white/10 p-8 flex flex-col gap-6 shadow-2xl"
            >
              <h2 className="text-xl font-black uppercase tracking-tighter italic">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  saveCategory(fd.get('name') as string);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase opacity-40 ml-1">Nome da Categoria</label>
                  <input 
                    name="name" 
                    autoFocus
                    defaultValue={editingCategory?.name} 
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold text-sm focus:border-primary outline-none transition-premium" 
                    placeholder="Ex: BEBIDAS"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsCategoryFormOpen(false)}
                    className="flex-1 py-3 bg-white/5 rounded-xl font-black uppercase text-[10px] tracking-widest opacity-60 hover:opacity-100"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-3 bg-primary rounded-xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg shadow-primary/20"
                  >
                    {editingCategory ? 'Salvar' : 'Criar Categoria'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Addon Management Modal */}
      <AnimatePresence>
        {isManagingAddons && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 p-8 flex flex-col gap-6 max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h2 className="text-base font-black uppercase tracking-tighter italic flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Adicionais
                </h2>
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onTap={() => setIsManagingAddons(false)} 
                  className="px-5 py-2.5 bg-primary/10 hover:bg-primary/20 rounded-full text-primary font-black uppercase text-[10px] tracking-widest transition-premium border border-primary/20"
                >
                  Fechar
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                {addons.map((ad) => (
                  <div key={ad.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="font-black text-base uppercase italic leading-tight">{ad.name}</span>
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => { 
                            setEditingAddon(ad); 
                            setAddonFormName(ad.name);
                            setAddonFormPrice(ad.price.toString().replace('.', ','));
                            setAddonFormProducts(ad.product_ids || []);
                            setAddonFocusedInput('name');
                            setIsAddonFormOpen(true); 
                          }} 
                          className="px-4 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-premium"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => { if(confirm('Excluir?')) deleteAddon(ad.id!) }} 
                          className="px-4 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-premium"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-3">
                      <span className="font-black text-lg italic tracking-tighter text-primary">R$ {ad.price.toFixed(2)}</span>
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleAddonVisibility(ad.id!, ad.visible)}
                        className={cn(
                          "px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest border transition-premium w-24",
                          ad.visible 
                            ? "bg-green-500/10 text-green-500 border-green-500/20" 
                            : "bg-red-500/10 text-red-500 border-red-500/20 opacity-40"
                        )}
                      >
                        {ad.visible ? 'Visível' : 'Oculto'}
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={() => { 
                  setEditingAddon(null); 
                  setAddonFormName('');
                  setAddonFormPrice('0');
                  setAddonFormProducts([]);
                  setAddonFocusedInput('name');
                  setIsAddonFormOpen(true); 
                }}
                className="w-full bg-white/5 border border-white/10 text-white/60 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 hover:text-white transition-premium"
              >
                + Novo Adicional
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Form Modal */}
      <AnimatePresence>
        {isProductFormOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card w-full max-w-5xl rounded-[2.5rem] border border-white/10 p-8 lg:p-10 flex flex-col gap-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar"
            >
              <h2 className="text-2xl font-black uppercase tracking-tighter italic">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  saveProduct({
                    name: productFormName,
                    price: parseFloat(productFormPrice.replace(',', '.') || '0'),
                    category: fd.get('category') as string,
                    image: productFormImage,
                  });
                }}
                className="flex flex-col gap-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Left Column: Normal Inputs */}
                  <div className="space-y-6">
                    <div 
                      className="space-y-1.5 cursor-pointer"
                      onClick={() => setFocusedInput('name')}
                    >
                      <label className="text-xs font-black uppercase opacity-40 ml-1">Nome do Produto</label>
                      <div className={cn("w-full bg-white/5 border rounded-xl px-5 py-4 font-black text-lg transition-premium", focusedInput === 'name' ? "border-primary shadow-lg shadow-primary/20 text-white" : "border-white/10 text-white/50")}>
                        {productFormName || <span className="opacity-20">EX: BOLO DE POTE</span>}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase opacity-40 ml-1">Categoria</label>
                      <select 
                        name="category" 
                        defaultValue={editingProduct?.category || (categories.length > 0 ? categories[0].name : '')} 
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 font-black text-lg focus:border-primary outline-none transition-premium appearance-none"
                      >
                        {categories.map(c => <option key={c.id} value={c.name} className="bg-background text-white">{c.name}</option>)}
                      </select>
                    </div>

                    {/* New Section: Addons for this product */}
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase opacity-40 ml-1">Vincular Adicionais Específicos</label>
                      <div className="bg-black/20 rounded-2xl p-4 border border-white/5 max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                        {addons.map(addon => {
                          const isSelected = productFormAddons.includes(addon.id!);
                          return (
                            <button
                              key={addon.id}
                              type="button"
                              onClick={() => {
                                setProductFormAddons(prev => 
                                  isSelected ? prev.filter(id => id !== addon.id) : [...prev, addon.id!]
                                );
                              }}
                              className={cn(
                                "w-full flex items-center justify-between p-3 rounded-xl border transition-premium",
                                isSelected ? "bg-primary/20 border-primary text-white" : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                              )}
                            >
                              <span className="font-black uppercase text-[10px] tracking-widest">{addon.name}</span>
                              <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", isSelected ? "bg-primary text-white" : "bg-white/10")}>
                                {isSelected && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase opacity-40 ml-1">Imagem do Produto (Opcional)</label>
                      <div className="flex gap-2">
                        <div 
                          className={cn("flex-1 bg-white/5 border rounded-xl px-5 py-4 font-black text-xs transition-premium overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer", focusedInput === 'image' ? "border-primary text-white" : "border-white/10 text-white/50")}
                          onClick={() => setFocusedInput('image')}
                        >
                          {productFormImage || <span className="opacity-20">URL da Imagem</span>}
                        </div>
                        {productFormImage && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm('Tem certeza que deseja remover esta imagem?')) {
                                if (productFormImage.includes('/products/')) {
                                  const oldFileName = productFormImage.split('/').pop();
                                  if (oldFileName) await supabase.storage.from('products').remove([oldFileName]);
                                }
                                setProductFormImage('');
                              }
                            }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl px-4 flex items-center justify-center transition-premium"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                        <label className={cn("border rounded-xl px-4 py-4 font-black text-xs uppercase tracking-widest cursor-pointer transition-premium flex items-center justify-center", isUploadingImage ? "bg-white/10 text-white/50 border-white/10 pointer-events-none" : "bg-primary/20 hover:bg-primary/30 text-primary border-primary/30")}>
                          {isUploadingImage ? 'Enviando...' : 'Upload'}
                          <input 
                            type="file" 
                            accept="image/*"
                            className="hidden" 
                            disabled={isUploadingImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!navigator.onLine) return;
                              try {
                                setIsUploadingImage(true);
                                
                                // Deleta a imagem antiga do Supabase se ela existir para economizar espaço
                                if (productFormImage && productFormImage.includes('/products/')) {
                                  const oldFileName = productFormImage.split('/').pop();
                                  if (oldFileName) {
                                    await supabase.storage.from('products').remove([oldFileName]);
                                  }
                                }

                                const webpBlob = await processImageToWebP(file);
                                const name = `img_${Date.now()}.webp`;
                                const { error } = await supabase.storage.from('products').upload(name, webpBlob, { contentType: 'image/webp' });
                                if (error) throw error;
                                const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(name);
                                setProductFormImage(publicUrl);
                              } catch(err: any) { 
                                console.error('Erro no upload:', err);
                              } finally {
                                setIsUploadingImage(false);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Price and Keyboard */}
                  <div className="flex flex-col gap-6">
                    <div 
                      className="space-y-1.5 cursor-pointer"
                      onClick={() => setFocusedInput('price')}
                    >
                      <label className="text-xs font-black uppercase opacity-40 ml-1">Preço de Venda</label>
                      <div className={cn("w-full bg-white/5 border rounded-xl px-5 py-4 font-black text-2xl flex justify-between items-center transition-premium", focusedInput === 'price' ? "border-green-500 text-green-500 shadow-lg shadow-green-500/20" : "border-white/10 text-white/50")}>
                        <span>R$</span>
                        <span>{productFormPrice || '0'}</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 bg-black/40 rounded-3xl p-4 border border-white/5 shadow-inner">
                      {focusedInput === 'price' ? (
                        <Numpad 
                          onInput={(v) => {
                            if (productFormPrice === '0' && v !== ',') setProductFormPrice(v);
                            else if (v === ',' && productFormPrice.includes(',')) return;
                            else setProductFormPrice(prev => prev + v);
                          }}
                          onDelete={() => setProductFormPrice(prev => prev.length > 1 ? prev.slice(0, -1) : '0')}
                          onClear={() => setProductFormPrice('0')}
                        />
                      ) : (
                        <VirtualKeyboard 
                          onInput={(v) => {
                            if (focusedInput === 'name') setProductFormName(prev => prev + v);
                            else if (focusedInput === 'image') setProductFormImage(prev => prev + v.toLowerCase());
                          }}
                          onDelete={() => {
                            if (focusedInput === 'name') setProductFormName(prev => prev.slice(0, -1));
                            else if (focusedInput === 'image') setProductFormImage(prev => prev.slice(0, -1));
                          }}
                          onSpace={() => {
                            if (focusedInput === 'name') setProductFormName(prev => prev + ' ');
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/5">
                  <button 
                    type="button"
                    onClick={() => setIsProductFormOpen(false)}
                    className="flex-1 py-5 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase text-sm tracking-widest transition-premium"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-5 bg-primary hover:bg-primary/90 rounded-2xl font-black uppercase text-sm tracking-widest text-white shadow-xl shadow-primary/20 transition-premium"
                  >
                    Confirmar Produto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Addon Form Modal */}
      <AnimatePresence>
        {isAddonFormOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card w-full max-w-5xl rounded-[2.5rem] border border-white/10 p-8 lg:p-10 flex flex-col gap-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar"
            >
              <h2 className="text-2xl font-black uppercase tracking-tighter italic">
                {editingAddon ? 'Editar Adicional' : 'Novo Adicional'}
              </h2>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  saveAddon({
                    name: addonFormName,
                    price: parseFloat(addonFormPrice.replace(',', '.') || '0')
                  });
                  setIsAddonFormOpen(false);
                }}
                className="flex flex-col gap-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Left Column: Inputs and Keyboard */}
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div 
                        className="space-y-1.5 cursor-pointer"
                        onClick={() => setAddonFocusedInput('name')}
                      >
                        <label className="text-xs font-black uppercase opacity-40 ml-1">Nome</label>
                        <div className={cn("w-full bg-white/5 border rounded-xl px-5 py-4 font-black text-base transition-premium", addonFocusedInput === 'name' ? "border-primary shadow-lg shadow-primary/20 text-white" : "border-white/10 text-white/50")}>
                          {addonFormName || <span className="opacity-20">EX: BACON</span>}
                        </div>
                      </div>

                      <div 
                        className="space-y-1.5 cursor-pointer"
                        onClick={() => setAddonFocusedInput('price')}
                      >
                        <label className="text-xs font-black uppercase opacity-40 ml-1">Preço (R$)</label>
                        <div className={cn("w-full bg-white/5 border rounded-xl px-5 py-4 font-black text-xl transition-premium", addonFocusedInput === 'price' ? "border-green-500 shadow-lg shadow-green-500/20 text-green-500" : "border-white/10 text-white/50")}>
                          {addonFormPrice || '0'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/40 rounded-3xl p-6 border border-white/5 shadow-inner min-h-[300px] flex items-center justify-center">
                      {addonFocusedInput === 'price' ? (
                        <Numpad 
                          onInput={(v) => {
                            if (addonFormPrice === '0' && v !== ',') setAddonFormPrice(v);
                            else if (v === ',' && addonFormPrice.includes(',')) return;
                            else setAddonFormPrice(prev => prev + v);
                          }}
                          onDelete={() => setAddonFormPrice(prev => prev.length > 1 ? prev.slice(0, -1) : '0')}
                          onClear={() => setAddonFormPrice('0')}
                        />
                      ) : (
                        <VirtualKeyboard 
                          onInput={(v) => {
                            if (addonFocusedInput === 'name') setAddonFormName(prev => prev + v);
                          }}
                          onDelete={() => {
                            if (addonFocusedInput === 'name') setAddonFormName(prev => prev.slice(0, -1));
                          }}
                          onSpace={() => {
                            if (addonFocusedInput === 'name') setAddonFormName(prev => prev + ' ');
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Right Column: Product Links */}
                  <div className="flex flex-col gap-4">
                    <label className="text-xs font-black uppercase opacity-40 ml-1">Vincular a Produtos</label>
                    <div className="flex-1 bg-black/20 rounded-3xl p-6 border border-white/5 overflow-y-auto custom-scrollbar flex flex-col gap-6 content-start">
                      {categories.map(cat => {
                        const catProds = products.filter(p => p.category === cat.name);
                        if (catProds.length === 0) return null;
                        
                        return (
                          <div key={cat.id} className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                              <h4 className="text-[10px] font-black uppercase text-primary italic">{cat.name}</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  const allIds = catProds.map(p => p.id!);
                                  const allSelected = allIds.every(id => addonFormProducts.includes(id));
                                  if (allSelected) {
                                    setAddonFormProducts(prev => prev.filter(id => !allIds.includes(id)));
                                  } else {
                                    setAddonFormProducts(prev => [...new Set([...prev, ...allIds])]);
                                  }
                                }}
                                className="text-[8px] font-black uppercase opacity-40 hover:opacity-100 hover:text-primary transition-premium"
                              >
                                {catProds.every(p => addonFormProducts.includes(p.id!)) ? 'Desmarcar Tudo' : 'Marcar Tudo'}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {catProds.map(prod => {
                                const isSelected = addonFormProducts.includes(prod.id!);
                                return (
                                  <button
                                    key={prod.id}
                                    type="button"
                                    onClick={() => {
                                      setAddonFormProducts(prev => 
                                        isSelected ? prev.filter(id => id !== prod.id) : [...prev, prod.id!]
                                      );
                                    }}
                                    className={cn(
                                      "flex items-center justify-between p-3 rounded-xl border transition-premium text-left relative overflow-hidden",
                                      isSelected ? "bg-primary/20 border-primary text-white shadow-lg shadow-primary/10" : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                                    )}
                                  >
                                    <span className="font-black uppercase text-[9px] tracking-tight truncate mr-1 relative z-10">{prod.name}</span>
                                    <div className={cn("w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-premium relative z-10", isSelected ? "bg-primary text-white scale-110" : "bg-white/10")}>
                                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                    </div>
                                    {isSelected && <div className="absolute inset-0 bg-primary/5 animate-pulse" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/5">
                  <button 
                    type="button"
                    onClick={() => setIsAddonFormOpen(false)}
                    className="flex-1 py-6 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase text-sm tracking-widest transition-premium"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-6 bg-primary hover:bg-primary/90 rounded-2xl font-black uppercase text-sm tracking-widest text-white shadow-xl shadow-primary/20 transition-premium"
                  >
                    Salvar Adicional
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dashboard Modal */}
      <AnimatePresence>
        {isDashboardOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 p-10 flex flex-col gap-8 max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-6">
                <h2 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary" />
                  Painel de Vendas
                </h2>
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onTap={() => setIsDashboardOpen(false)} 
                  className="px-6 py-3 bg-primary/10 rounded-full text-primary font-black uppercase text-xs"
                >
                  Fechar
                </motion.button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar">
                {/* Summary Card */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/5 shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Vendas de Hoje</p>
                    <p className="text-4xl font-black text-primary tracking-tighter italic">R$ {dashboardStats?.totalDay.toFixed(2)}</p>
                  </div>

                  <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Meios de Pagamento</p>
                    <div className="space-y-3">
                      {Object.entries(dashboardStats?.paymentMethods || {}).map(([method, amount]) => (
                        amount > 0 && (
                          <div key={method} className="flex justify-between items-center bg-black/20 p-3 rounded-xl">
                            <span className="text-[10px] font-black uppercase opacity-60 italic">{method}</span>
                            <span className="font-black text-sm">R$ {amount.toFixed(2)}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ranking Card */}
                <div className="lg:col-span-2 bg-white/5 p-8 rounded-3xl border border-white/5 shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-6 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Ranking de Produtos (Top 20)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    {dashboardStats?.ranking.map((item, i) => (
                      <div key={i} className="flex items-center gap-4 bg-black/20 p-3 rounded-2xl border border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center font-black text-primary text-xs italic">
                          #{i + 1}
                        </div>
                        <span className="flex-1 font-black uppercase text-xs truncate italic">{item.name}</span>
                        <span className="bg-primary px-3 py-1 rounded-full font-black text-[10px] text-white">
                          {item.quantity} un
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
