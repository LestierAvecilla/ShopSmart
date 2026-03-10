/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  History as HistoryIcon, 
  ShoppingCart, 
  ChevronRight, 
  X,
  Calendar,
  DollarSign,
  ArrowLeft,
  Pencil,
  Save,
  Trash2,
  FileText,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface Product {
  id: string;
  name: string;
  price: number;
  checked: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface ShoppingTrip {
  id: string;
  title: string;
  date: string;
  items: Product[];
  total: number;
}

interface Draft {
  id: string;
  title: string;
  date: string;
  items: Product[];
}

type View = 'list' | 'history' | 'drafts';

// --- Main Component ---

export default function App() {
  const [view, setView] = useState<View>('list');
  const [currentList, setCurrentList] = useState<Product[]>([]);
  const [history, setHistory] = useState<ShoppingTrip[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<ShoppingTrip | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  
  // List title state
  const [listTitle, setListTitle] = useState('');
  
  // Form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        } else {
          // Fallback to local storage if not logged in
          const savedList = localStorage.getItem('shopsmart_current_list');
          const savedHistory = localStorage.getItem('shopsmart_history');
          const savedTitle = localStorage.getItem('shopsmart_list_title');
          
          if (savedList) setCurrentList(JSON.parse(savedList));
          if (savedHistory) setHistory(JSON.parse(savedHistory));
          if (savedTitle) setListTitle(savedTitle);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Fetch from backend when user changes
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [listRes, historyRes, draftsRes] = await Promise.all([
          fetch('/api/list'),
          fetch('/api/history'),
          fetch('/api/drafts')
        ]);
        
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.items && listData.items.length > 0) {
            setCurrentList(listData.items);
            setListTitle(listData.title || "");
          }
        }
        
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistory(historyData || []);
        }

        if (draftsRes.ok) {
          const draftsData = await draftsRes.json();
          setDrafts(draftsData || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

  // Sync current list and title
  useEffect(() => {
    if (isLoading) return;
    
    const syncData = async () => {
      if (user) {
        try {
          await fetch('/api/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: currentList, title: listTitle })
          });
        } catch (error) {
          console.error("Error syncing list:", error);
        }
      } else {
        localStorage.setItem('shopsmart_current_list', JSON.stringify(currentList));
        localStorage.setItem('shopsmart_list_title', listTitle);
        localStorage.setItem('shopsmart_history', JSON.stringify(history));
      }
    };
    
    const timeoutId = setTimeout(syncData, 500);
    return () => clearTimeout(timeoutId);
  }, [currentList, listTitle, history, user, isLoading]);

  // Listen for OAuth success
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        // Re-check auth
        fetch('/api/auth/me')
          .then(res => res.json())
          .then(data => {
            if (data.user) {
              setUser(data.user);
              setShowAuthModal(false);
            }
          });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- Handlers ---

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput, name: nameInput })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setEmailInput('');
        setPasswordInput('');
        setNameInput('');
        setShowAuthModal(false);
      } else {
        alert(data.error || 'Autenticación fallida');
      }
    } catch (err) {
      alert('Error de conexión');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      window.open(url, 'google_auth', 'width=500,height=600');
    } catch (err) {
      alert('Error al iniciar Google Login');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      // Reset app state to guest/empty
      setCurrentList([]);
      setHistory([]);
      setDrafts([]);
      setListTitle('');
      setView('list');
      // Clear local storage to ensure a clean state after logout
      localStorage.removeItem('shopsmart_current_list');
      localStorage.removeItem('shopsmart_history');
      localStorage.removeItem('shopsmart_list_title');
    }
  };

  const totalChecked = useMemo(() => {
    return currentList
      .filter(item => item.checked)
      .reduce((sum, item) => sum + item.price, 0);
  }, [currentList]);

  const totalPotential = useMemo(() => {
    return currentList.reduce((sum, item) => sum + item.price, 0);
  }, [currentList]);

  // --- Handlers ---

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: Product = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      price: newItemPrice ? parseFloat(newItemPrice) : 0,
      checked: false,
    };

    setCurrentList([...currentList, newItem]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const toggleItem = (id: string) => {
    setCurrentList(currentList.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const removeItem = (id: string) => {
    setCurrentList(currentList.filter(item => item.id !== id));
    if (editingId === id) cancelEditing();
  };

  const startEditing = (item: Product) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditPrice('');
  };

  const saveEdit = (id: string) => {
    if (!editName.trim() || !editPrice) return;
    
    setCurrentList(currentList.map(item => 
      item.id === id 
      ? { ...item, name: editName.trim(), price: parseFloat(editPrice) } 
      : item
    ));
    cancelEditing();
  };

  const clearList = () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar la lista actual?')) {
      setCurrentList([]);
      setListTitle('');
    }
  };

  const finishShopping = async () => {
    if (currentList.length === 0) return;
    
    const checkedItems = currentList.filter(item => item.checked);
    if (checkedItems.length === 0) {
      alert('Selecciona al menos un producto para finalizar la compra.');
      return;
    }

    const newTrip: ShoppingTrip = {
      id: crypto.randomUUID(),
      title: listTitle.trim() || `Compra del ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      items: [...currentList],
      total: totalChecked,
    };

    try {
      if (user) {
        const res = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip: newTrip })
        });
        
        if (!res.ok) {
          alert('Error al guardar la compra en el servidor.');
          return;
        }
      }
      
      setHistory([newTrip, ...history]);
      setCurrentList([]);
      setListTitle('');
      alert('¡Compra guardada con éxito!');
      setView('history');
      
    } catch (error) {
      console.error("Error finishing shopping:", error);
      alert('Error de conexión con el servidor.');
    }
  };

  const saveAsDraft = async () => {
    if (currentList.length === 0) return;
    
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: listTitle, items: currentList })
      });
      
      if (res.ok) {
        const data = await res.json();
        const newDraft: Draft = {
          id: data.id,
          title: listTitle || "Sin título",
          date: new Date().toISOString(),
          items: [...currentList]
        };
        setDrafts([newDraft, ...drafts]);
        setCurrentList([]);
        setListTitle('');
        setView('drafts');
      }
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  };

  const resumeDraft = async (draft: Draft) => {
    if (currentList.length > 0) {
      if (!window.confirm('Tienes una lista activa. ¿Deseas reemplazarla con este borrador?')) {
        return;
      }
    }
    
    setCurrentList(draft.items);
    setListTitle(draft.title);
    
    if (user) {
      try {
        await fetch(`/api/drafts/${draft.id}`, { method: 'DELETE' });
      } catch (error) {
        console.error("Error deleting draft:", error);
      }
    }
    
    setDrafts(drafts.filter(d => d.id !== draft.id));
    setView('list');
  };

  const deleteDraft = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este borrador?')) return;
    
    if (user) {
      try {
        await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
      } catch (error) {
        console.error("Error deleting draft:", error);
      }
    }
    setDrafts(drafts.filter(d => d.id !== id));
  };

  // --- Render Helpers ---

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <ShoppingCart className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">ShopSmart</span>
          </div>
          
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'list' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Lista
            </button>
            <button 
              onClick={() => setView('history')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'history' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Historial
            </button>
            <button 
              onClick={() => setView('drafts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'drafts' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Borradores
            </button>
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Hola, {user.name.split(' ')[0]}</span>
                  <button 
                    onClick={handleLogout}
                    className="text-xs font-bold text-indigo-600 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm shrink-0">
                  <img 
                    src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                    alt="User" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-100 transition-colors"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Login Alert Bar */}
      {!user && (
        <div className="bg-amber-50 border-b border-amber-100">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <HistoryIcon className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-sm text-amber-800 font-medium">
                Para guardar tus historiales permanentemente en la nube, es necesario <button onClick={() => { setAuthMode('register'); setShowAuthModal(true); }} className="underline font-bold hover:text-amber-900">registrarte</button> o <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className="underline font-bold hover:text-amber-900">iniciar sesión</button>.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'list' ? (
            <motion.div 
              key="list-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Left Column: Form and List */}
              <div className="lg:col-span-2 space-y-8">
                <section>
                  <h1 className="text-3xl font-black tracking-tight mb-2">Mi Lista de Súper</h1>
                  <p className="text-slate-500 mb-6">Agrega productos y controla tu gasto mientras compras.</p>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Título de la Lista</label>
                    <input 
                      type="text" 
                      value={listTitle}
                      onChange={(e) => setListTitle(e.target.value)}
                      placeholder="Ej: Despensa Mensual, Fiesta de Cumpleaños..."
                      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-semibold"
                    />
                  </div>
                </section>

                {/* Add Item Form */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-6 space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Producto</label>
                      <input 
                        type="text" 
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Ej: Leche deslactosada"
                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Precio (opcional)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full h-12 pl-8 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <button 
                        type="submit"
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
                      >
                        <Plus className="w-5 h-5 group-active:scale-90 transition-transform" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </form>
                </section>

                {/* List Items */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="font-bold text-lg">Productos ({currentList.length})</h2>
                    {currentList.length > 0 && (
                      <button 
                        onClick={clearList}
                        className="text-sm text-slate-400 hover:text-red-500 font-medium transition-colors"
                      >
                        Limpiar lista
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {currentList.length === 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300"
                        >
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShoppingCart className="text-slate-300 w-8 h-8" />
                          </div>
                          <p className="text-slate-400 font-medium">Tu lista está vacía</p>
                          <p className="text-slate-300 text-sm">Comienza agregando algo arriba</p>
                        </motion.div>
                      ) : (
                        currentList.map((item) => (
                          <motion.div 
                            key={item.id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                              item.checked 
                              ? 'bg-slate-50 border-slate-200' 
                              : 'bg-white border-slate-200 hover:border-indigo-200 shadow-sm'
                            }`}
                          >
                            {editingId === item.id ? (
                              <div className="flex-1 flex flex-col md:flex-row gap-3">
                                <input 
                                  type="text" 
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <div className="relative w-24">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                    <input 
                                      type="number" 
                                      step="0.01"
                                      value={editPrice}
                                      onChange={(e) => setEditPrice(e.target.value)}
                                      className="w-full h-10 pl-6 pr-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    />
                                  </div>
                                  <button 
                                    onClick={() => saveEdit(item.id)}
                                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                                  >
                                    <Save className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={cancelEditing}
                                    className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => toggleItem(item.id)}
                                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                                    item.checked 
                                    ? 'bg-indigo-600 border-indigo-600 text-white' 
                                    : 'border-slate-300 hover:border-indigo-400'
                                  }`}
                                >
                                  {item.checked && <CheckCircle2 className="w-4 h-4" />}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                  <p className={`font-semibold truncate transition-all ${
                                    item.checked ? 'text-slate-400 line-through' : 'text-slate-900'
                                  }`}>
                                    {item.name}
                                  </p>
                                  <p 
                                    onClick={() => !item.checked && startEditing(item)}
                                    className={`text-sm font-medium transition-all ${
                                      item.checked 
                                        ? 'text-slate-300' 
                                        : item.price > 0 
                                          ? 'text-indigo-600' 
                                          : 'text-amber-600 font-bold underline cursor-pointer hover:text-amber-700'
                                    }`}
                                  >
                                    {item.price > 0 ? `$${item.price.toFixed(2)}` : 'Definir precio'}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => startEditing(item)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                  >
                                    <Pencil className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => removeItem(item.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </section>
              </div>

              {/* Right Column: Summary */}
              <div className="space-y-6">
                <div className="sticky top-24">
                  <section className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative">
                    {/* Decorative background element */}
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-50 rounded-full blur-3xl" />
                    
                    <h3 className="text-xl font-bold mb-8 relative">Resumen de Compra</h3>
                    
                    <div className="space-y-6 relative">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Seleccionado</p>
                          <p className="text-4xl font-black text-indigo-600">${totalChecked.toFixed(2)}</p>
                        </div>
                        <p className="text-xs font-medium text-slate-400 mb-1">MXN</p>
                      </div>

                      <div className="h-px bg-slate-100 w-full" />

                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Total proyectado</span>
                        <span className="font-bold text-slate-700">${totalPotential.toFixed(2)}</span>
                      </div>

                      <div className="space-y-3 pt-4">
                        <button 
                          onClick={finishShopping}
                          disabled={currentList.length === 0}
                          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Finalizar Compra</span>
                        </button>

                        <button 
                          onClick={saveAsDraft}
                          disabled={currentList.length === 0}
                          className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                          <Save className="w-5 h-5" />
                          <span>Guardar como Borrador</span>
                        </button>
                        
                        <div className="flex items-start gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                          <div className="mt-0.5">
                            <Plus className="w-4 h-4 text-indigo-600" />
                          </div>
                          <p className="text-xs text-indigo-700 leading-relaxed">
                            Al finalizar, la lista actual se guardará en tu historial y se limpiará la vista.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          ) : view === 'history' ? (
            <motion.div 
              key="history-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black tracking-tight mb-2">Historial de Compras</h1>
                  <p className="text-slate-500">Revisa tus gastos pasados y lo que has comprado.</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="text-emerald-600 w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gasto Total</p>
                      <p className="text-xl font-black text-slate-900">
                        ${history.reduce((sum, trip) => sum + trip.total, 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.length === 0 ? (
                  <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                    <HistoryIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No hay compras registradas aún</p>
                    <button 
                      onClick={() => setView('list')}
                      className="mt-4 text-indigo-600 font-bold hover:underline"
                    >
                      Ir a mi lista
                    </button>
                  </div>
                ) : (
                  history.map((trip) => (
                    <motion.div 
                      key={trip.id}
                      whileHover={{ y: -4 }}
                      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                          <Calendar className="text-slate-400 w-6 h-6" />
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-indigo-600">${trip.total.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <p className="font-bold text-slate-900 text-lg mb-1 truncate">{trip.title}</p>
                        <p className="text-sm text-slate-500 mb-1">{formatDate(trip.date)}</p>
                        <p className="text-xs text-slate-400">{trip.items.length} productos</p>
                      </div>

                      <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {trip.items.slice(0, 3).map((item, i) => (
                            <div key={i} className="w-8 h-8 rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600">
                              {item.name.charAt(0)}
                            </div>
                          ))}
                          {trip.items.length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-400">
                              +{trip.items.length - 3}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => setSelectedTrip(trip)}
                          className="text-indigo-600 hover:text-indigo-700 font-bold text-sm flex items-center gap-1 group"
                        >
                          Detalles
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="drafts-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <section>
                <h1 className="text-3xl font-black tracking-tight mb-2">Borradores</h1>
                <p className="text-slate-500">Listas guardadas para completar después.</p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {drafts.length === 0 ? (
                  <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                    <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No tienes borradores guardados</p>
                    <button 
                      onClick={() => setView('list')}
                      className="mt-4 text-indigo-600 font-bold hover:underline"
                    >
                      Crear nueva lista
                    </button>
                  </div>
                ) : (
                  drafts.map((draft) => (
                    <motion.div 
                      key={draft.id}
                      whileHover={{ y: -4 }}
                      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                          <FileText className="text-amber-600 w-6 h-6" />
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {draft.items.length} productos
                          </p>
                        </div>
                      </div>

                      <h3 className="font-black text-xl text-slate-900 mb-1 truncate">{draft.title}</h3>
                      <p className="text-xs text-slate-400 mb-6">{formatDate(draft.date)}</p>

                      <div className="flex gap-2 mt-auto">
                        <button 
                          onClick={() => resumeDraft(draft)}
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all"
                        >
                          Continuar
                        </button>
                        <button 
                          onClick={() => deleteDraft(draft.id)}
                          className="p-3 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trip Details Modal */}
        <AnimatePresence>
          {selectedTrip && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTrip(null)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                  <div>
                    <h3 className="text-xl font-bold truncate max-w-[250px]">{selectedTrip.title}</h3>
                    <p className="text-sm text-slate-400">{formatDate(selectedTrip.date)}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedTrip(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Productos</p>
                    <div className="space-y-2">
                      {selectedTrip.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${item.checked ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                            <span className="font-medium text-slate-700">{item.name}</span>
                          </div>
                          <span className="font-bold text-slate-900">
                            {item.price > 0 ? `$${item.price.toFixed(2)}` : 'Sin precio'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500">Total Pagado</span>
                    <span className="text-3xl font-black text-indigo-600">${selectedTrip.total.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Auth Modal */}
        <AnimatePresence>
          {showAuthModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAuthModal(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="text-indigo-600 w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {authMode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                  </h3>
                  <p className="text-slate-500 mt-2">
                    {authMode === 'login' 
                      ? 'Inicia sesión para sincronizar tus listas.' 
                      : 'Únete a ShopSmart y guarda tus compras.'}
                  </p>
                </div>

                <div className="px-8 pb-8 space-y-6">
                  <form onSubmit={handleAuth} className="space-y-4">
                    {authMode === 'register' && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Nombre</label>
                        <input 
                          type="text" 
                          placeholder="Tu nombre"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          required
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Correo Electrónico</label>
                      <input 
                        type="email" 
                        placeholder="tu@correo.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Contraseña</label>
                      <input 
                        type="password" 
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all disabled:bg-indigo-300 flex items-center justify-center"
                    >
                      {isAuthLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        authMode === 'login' ? 'Iniciar Sesión' : 'Registrarse'
                      )}
                    </button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-400 font-bold">O continúa con</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleGoogleLogin}
                    className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    <span>Google</span>
                  </button>

                  <div className="text-center">
                    <button 
                      onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                      className="text-sm font-bold text-indigo-600 hover:underline"
                    >
                      {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-slate-200 mt-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <ShoppingCart className="w-5 h-5" />
            <span className="font-bold tracking-tight">ShopSmart</span>
          </div>
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} ShopSmart App. Diseñado para compras inteligentes.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors">Privacidad</a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors">Términos</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
