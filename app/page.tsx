'use client';

import React, { useState, useEffect } from 'react';
import { CATEGORIES, MOCK_PRODUCTS, MOCK_ADDONS } from '@/lib/mock-data';
import { Product, Addon, SaleItem, db, Sale, requestPersistence } from '@/lib/db';
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
function Numpad({ onInput, onDelete, onClear }: { onInput: (v: string) => void, onDelete: () => void, onClear: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', ','];
  return (
    <div className="grid grid-cols-3 gap-2 w-full">
      {keys.map(key => (
        <motion.button
          key={key}
          whileTap={{ scale: 0.9 }}
          onClick={() => onInput(key)}
          className="h-16 bg-white/5 hover:bg-primary/20 rounded-xl font-black text-2xl border border-white/5 transition-premium"
        >
          {key}
        </motion.button>
      ))}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClear}
        className="h-16 bg-red-500/10 text-red-500 rounded-xl font-black text-sm uppercase"
      >
        Limpar
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onDelete}
        className="h-16 bg-white/5 col-span-2 flex items-center justify-center rounded-xl text-foreground/40"
      >
        <Delete className="w-7 h-7" />
      </motion.button>
    </div>
  );
}

// Custom Alphabetical Keyboard
function AlphaKeyboard({ onInput, onDelete, onSpace }: { onInput: (v: string) => void, onDelete: () => void, onSpace: () => void }) {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1">
          {i === 2 && <div className="flex-[0.5]" />}
          {row.map(key => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.9 }}
              onClick={() => onInput(key)}
              className="flex-1 h-12 bg-white/5 hover:bg-primary/20 rounded-lg font-black text-base border border-white/5 transition-premium uppercase"
            >
              {key}
            </motion.button>
          ))}
          {i === 2 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onDelete}
              className="flex-[1.5] h-12 bg-white/5 hover:bg-primary/20 rounded-lg flex items-center justify-center border border-white/5"
            >
              <Delete className="w-5 h-5 opacity-40" />
            </motion.button>
          )}
        </div>
      ))}
      <div className="flex gap-1 px-[10%]">
        <motion.button
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
  const [sales, setSales] = useState<Sale[]>([]);
  
  // Sale State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'debit' | 'pix'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [payments, setPayments] = useState<{ method: 'cash' | 'credit' | 'debit' | 'pix', amount: number }[]>([]);
  const [cashierNumber] = useState(3);
  
  const { isOnline, pendingCount, lastSyncTime, pullRecentSales } = useOfflineSync();

  // Initialize Storage Persistence, Register SW and Keep Screen On
  useEffect(() => {
    requestPersistence();
    
    // Screen Wake Lock
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock is active');
        }
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    };

    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Force unregister all service workers to stop loops only if we want a fresh start
    // navigator.serviceWorker.getRegistrations().then(registrations => { ... });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW Registered!', reg))
        .catch(err => console.log('SW Error:', err));
    }

    // One-time local DB reset (migration v2.1)
    const hasReset = localStorage.getItem('db_reset_v2.1');
    if (!hasReset) {
      db.sales.clear().then(() => {
        localStorage.setItem('db_reset_v2.1', 'true');
        // Removed reload — not needed, clear() takes effect immediately
      });
    }

    return () => {
      if (wakeLock !== null) wakeLock.release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);


  // Load Sales History
  useEffect(() => {
    if (isHistoryOpen) {
      db.sales.reverse().toArray().then(setSales);
    }
  }, [isHistoryOpen]);

  // Alphabetical data
  const sortedCategories = [...CATEGORIES].sort((a, b) => a.localeCompare(b));

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

  // Handlers
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

  const addItemToCart = () => {
    if (!selectedProduct) return;
    
    const newItem: SaleItem = {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: selectedProduct.price,
      quantity: tempQuantity,
      addons: tempAddons.map(a => ({ name: a.name, price: a.price }))
    };

    setCart(prev => [...prev, newItem]);
    setSelectedProduct(null);
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
    if (adminPass === '1973') {
      setIsAdminVerified(true);
    } else {
      alert('Senha incorreta');
      setAdminPass('');
    }
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

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden font-sans text-foreground select-none">
      
      {/* Left Side: Product Selection (60%) */}
      <div className="flex-1 flex flex-col h-full border-r border-border">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border glass flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-[0_0_20px_rgba(255,107,0,0.4)] orange-glow">
                PDV
              </div>
              <h1 className="font-black text-2xl leading-tight tracking-tighter uppercase italic">UAI PDV</h1>
            </div>
            
            <div className="h-8 w-[1px] bg-white/10" />

            <div className="flex items-center gap-4 text-[10px] font-black tracking-widest uppercase">
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full text-primary border border-primary/20">
                <span className="opacity-40">CAIXA</span>
                <span>#{cashierNumber}</span>
              </div>
              
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full text-white/40">
                <span>VER. v2.5.5</span>
              </div>
              
              {isOnline ? (
                <div className="flex items-center gap-4 bg-green-500/10 px-4 py-1.5 rounded-full text-green-500 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="font-black">ONLINE</span>
                  </div>
                  {lastSyncTime && (
                    <div className="flex items-center gap-2 pl-3 border-l border-green-500/20">
                      <span className="text-white/30 text-[8px] font-bold">ÚLTIMO SYNC:</span>
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
              onTap={() => setIsHistoryOpen(true)}
              className="p-3 rounded-xl bg-white/5 hover:bg-primary/10 transition-premium border border-white/5 flex items-center gap-2"
            >
              <History className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 hidden md:block">Vendas</span>
            </motion.button>
            
            <motion.button 
              type="button"
              whileTap={{ scale: 0.9 }}
              onTap={() => { setIsAdminOpen(true); setActiveInput('admin'); }}
              className="p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-premium border border-white/5"
            >
              <Settings className="w-4 h-4 text-foreground/60" />
            </motion.button>
          </div>
        </header>

        {/* Category/Product Area */}
        <main className="flex-1 overflow-y-auto p-5 bg-background">
          {!selectedCategory ? (
            <div className="space-y-5">
              <h2 className="text-xl font-black uppercase tracking-tighter italic">Categorias</h2>
              <div className="grid grid-cols-5 gap-3">
                {sortedCategories.map(category => (
                  <motion.button
                    key={category}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onTap={() => setSelectedCategory(category)}
                    className="aspect-square bg-card rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border-2 border-transparent hover:border-primary/50 hover:bg-primary/5 transition-premium group shadow-lg relative overflow-hidden"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-primary/10 flex items-center justify-center transition-premium pointer-events-none">
                      <ShoppingCart className="w-6 h-6 text-foreground/20 group-hover:text-primary transition-premium group-hover:scale-110 pointer-events-none" />
                    </div>
                    <span className="font-black text-center text-[13px] uppercase tracking-tight opacity-60 group-hover:opacity-100 pointer-events-none">{category}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <motion.button 
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onTap={() => setSelectedCategory(null)}
                  className="flex items-center gap-2 text-primary font-black uppercase text-[9px] hover:gap-3 transition-premium px-3 py-1.5 bg-primary/10 rounded-full"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Voltar
                </motion.button>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic">{selectedCategory}</h2>
                <div className="w-16 h-1 bg-primary/20 rounded-full" />
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                {[...MOCK_PRODUCTS]
                  .filter(p => p.category === selectedCategory)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(product => (
                    <motion.button
                      key={product.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onTap={() => openProductOptions(product)}
                      className="bg-card p-3.5 rounded-2xl border border-white/5 hover:border-primary/50 transition-premium group relative shadow-lg flex flex-col gap-3 overflow-hidden"
                    >
                      <div className="aspect-square bg-white/5 rounded-xl overflow-hidden relative pointer-events-none">
                        <div className="absolute inset-0 flex items-center justify-center opacity-5 group-hover:opacity-15 transition-premium group-hover:scale-105 pointer-events-none">
                          <ShoppingCart className="w-12 h-12 text-white pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-0.5 pointer-events-none text-left">
                        <h3 className="font-black text-[13px] uppercase tracking-tight line-clamp-2 leading-tight pointer-events-none">{product.name}</h3>
                        <p className="text-primary font-black text-base tracking-tighter pointer-events-none">R$ {product.price.toFixed(2)}</p>
                      </div>
                      <div className="absolute top-2 right-2 w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-premium shadow-md">
                        <Plus className="w-4 h-4" />
                      </div>
                    </motion.button>
                  ))}
              </div>
            </div>
          )}
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
                   <div className="absolute inset-0 flex items-center justify-center opacity-5">
                     <ShoppingCart className="w-6 h-6" />
                   </div>
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
                <motion.button 
                  type="button"
                  whileTap={{ scale: 0.8 }}
                  onTap={() => removeFromCart(index)}
                  className="p-2 text-foreground/20 hover:text-primary transition-premium"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
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
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="bg-card w-full max-w-5xl rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 flex flex-col lg:flex-row max-h-[90vh] py-2"
            >
              <div className="w-full lg:w-1/2 p-8 lg:p-10 border-r border-white/5 bg-white/5 overflow-y-auto">
                <motion.button 
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onTap={() => setSelectedProduct(null)}
                  className="flex items-center gap-2 text-primary font-black uppercase text-[9px] mb-8 hover:gap-4 transition-premium px-4 py-2 bg-primary/10 rounded-full w-fit"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </motion.button>
                
                <div className="aspect-video bg-white/5 rounded-2xl mb-6 flex items-center justify-center">
                  <ShoppingCart className="w-14 h-14 text-white/10" />
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
                  {selectedProduct.addons?.map(addonId => {
                    const addon = MOCK_ADDONS.find(a => a.id === addonId);
                    if (!addon) return null;
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
                            <AlphaKeyboard 
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
              </div>
            </motion.div>
          </div>
        )}

        {isAdminOpen && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="bg-card w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 p-10 flex flex-col gap-8"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-6">
                <h2 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
                  <Lock className="w-8 h-8 text-primary" />
                  Gestão Admin
                </h2>
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onTap={() => { setIsAdminOpen(false); setIsAdminVerified(false); setAdminPass(''); }} 
                  className="flex items-center gap-2 text-primary font-black uppercase text-xs hover:gap-4 transition-premium px-6 py-3 bg-primary/10 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Voltar
                </motion.button>
              </div>

              {!isAdminVerified ? (
                <div className="flex flex-col gap-8">
                  <div className="bg-background p-6 rounded-3xl border-2 border-primary/30 text-center shadow-inner">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Senha de Acesso</p>
                    <p className="text-5xl font-black tracking-[0.6em] text-primary">{'*'.repeat(adminPass.length) || '----'}</p>
                  </div>
                  
                  <Numpad 
                    onInput={(v) => adminPass.length < 4 && setAdminPass(prev => prev + v)}
                    onDelete={() => setAdminPass(prev => prev.slice(0, -1))}
                    onClear={() => setAdminPass('')}
                  />

                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onTap={verifyAdmin}
                    className="w-full bg-primary text-white py-6 rounded-2xl font-black text-xl uppercase tracking-tighter shadow-xl shadow-primary/30 italic"
                  >
                    Acessar Painel
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {[
                    { label: 'Gerenciar Produtos', icon: ShoppingCart },
                    { label: 'Gerenciar Categorias', icon: Settings },
                    { label: 'Gerenciar Adicionais', icon: Plus },
                  ].map((item, i) => (
                    <motion.button 
                      key={i} 
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-primary/10 border border-transparent hover:border-primary/50 transition-premium group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary text-foreground/40 group-hover:text-white transition-premium shadow-lg">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="font-black text-base uppercase tracking-tight italic">{item.label}</span>
                      <ChevronRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-premium" />
                    </motion.button>
                  ))}

                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onTap={() => {
                      if(confirm('Deseja zerar o contador de pedidos?')) {
                        resetOrderCounter();
                        alert('Contador zerado!');
                      }
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-amber-500/5 rounded-2xl hover:bg-amber-500/10 border border-amber-500/10 transition-premium group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-premium shadow-lg">
                      <History className="w-5 h-5" />
                    </div>
                    <span className="font-black text-base uppercase tracking-tight italic text-amber-500">Zerar Contador</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onTap={exportBackup}
                    className="w-full flex items-center gap-4 p-4 bg-green-500/5 rounded-2xl hover:bg-green-500/10 border border-green-500/10 transition-premium group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-premium shadow-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="font-black text-base uppercase tracking-tight italic text-green-500">Exportar Backup</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onTap={async () => {
                      alert('Sincronizando dados com o servidor...');
                      await pullRecentSales();
                      alert('Sincronização concluída!');
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-cyan-500/5 rounded-2xl hover:bg-cyan-500/10 border border-cyan-500/10 transition-premium group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:bg-cyan-500 group-hover:text-white transition-premium shadow-lg">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <span className="font-black text-base uppercase tracking-tight italic text-cyan-500">Sincronizar Dados</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onTap={() => window.open('/UaiPDV-2.apk', '_blank')}
                    className="w-full flex items-center gap-4 p-4 bg-primary/5 rounded-2xl hover:bg-primary/10 border border-primary/10 transition-premium group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-premium shadow-lg">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="text-left flex flex-col">
                      <span className="font-black text-base uppercase tracking-tight italic text-primary leading-none">Baixar Aplicativo</span>
                      <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest mt-1">Instalar APK Nativo</span>
                    </div>
                    <ChevronRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-premium" />
                  </motion.button>

                  <div className="pt-6 border-t border-white/5">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onTap={() => { setIsAdminVerified(false); setAdminPass(''); }}
                      className="w-full flex items-center justify-center gap-3 p-5 text-red-500 bg-red-500/5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-500/10 transition-premium border border-red-500/10"
                    >
                      <LogOut className="w-5 h-5" />
                      Encerrar Sessão
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
