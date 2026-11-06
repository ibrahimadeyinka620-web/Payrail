import { useEffect, useState } from 'react';
import {
  User, Link2, Shield, Check, AlertCircle, Plus, Trash2, Package,
  Edit3, X, Save,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchMyProducts, createProduct, deleteProduct, updateProduct } from '@/lib/dataApi';
import { formatCurrency } from '@/lib/format';
import type { Product } from '@/lib/types';

export default function Settings() {
  const { profile, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [handle, setHandle] = useState(profile?.paypal_handle ?? '');
  const [savedName, setSavedName] = useState(false);
  const [savedPp, setSavedPp] = useState(false);

  // Product management
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // New product form
  const [pTitle, setPTitle] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pImageUrl, setPImageUrl] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pStock, setPStock] = useState('1');
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchMyProducts(profile.id)
        .then(setProducts)
        .catch(console.error)
        .finally(() => setProductsLoading(false));
    }
  }, [profile?.id]);

  async function saveName() {
    await updateProfile({ display_name: name.trim() });
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  }

  async function savePayPal() {
    const clean = handle.trim().replace(/^@/, '');
    await updateProfile({ paypal_connected: true, paypal_handle: clean || 'sandbox-user@paypal.example' });
    setSavedPp(true);
    setTimeout(() => setSavedPp(false), 2000);
  }

  function resetProductForm() {
    setPTitle('');
    setPDesc('');
    setPPrice('');
    setPImageUrl('');
    setPCategory('');
    setPStock('1');
    setEditProduct(null);
  }

  async function saveProduct() {
    if (!profile?.id || !pTitle.trim() || !pPrice.trim()) return;
    setSavingProduct(true);
    const priceCents = Math.round(parseFloat(pPrice) * 100);
    if (editProduct) {
      await updateProduct(editProduct.id, {
        title: pTitle.trim(),
        description: pDesc.trim(),
        price_cents: priceCents,
        image_url: pImageUrl.trim() || null,
        category: pCategory.trim() || null,
        stock: parseInt(pStock) || 1,
      });
    } else {
      await createProduct({
        title: pTitle.trim(),
        description: pDesc.trim(),
        price_cents: priceCents,
        currency: 'USD',
        image_url: pImageUrl.trim() || null,
        category: pCategory.trim() || null,
        stock: parseInt(pStock) || 1,
      });
    }
    const updated = await fetchMyProducts(profile.id);
    setProducts(updated);
    setSavingProduct(false);
    setShowAddProduct(false);
    resetProductForm();
  }

  async function handleDeleteProduct(id: string) {
    await deleteProduct(id);
    if (profile?.id) {
      const updated = await fetchMyProducts(profile.id);
      setProducts(updated);
    }
  }

  function startEdit(p: Product) {
    setEditProduct(p);
    setPTitle(p.title);
    setPDesc(p.description);
    setPPrice((p.price_cents / 100).toString());
    setPImageUrl(p.image_url ?? '');
    setPCategory(p.category ?? '');
    setPStock(String(p.stock ?? 1));
    setShowAddProduct(true);
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500 mt-1">Manage your profile, PayPal, and product listings.</p>
      </div>

      {/* Profile */}
      <div className="card p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-rail-50 border border-rail-200 flex items-center justify-center">
            <User className="w-5 h-5 text-rail-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-900">Profile</h2>
            <p className="text-xs text-ink-400">Your display name in Payrail</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Display name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <button onClick={saveName} className="btn-primary">
            {savedName ? <><Check className="w-4 h-4" /> Saved</> : 'Save name'}
          </button>
        </div>
      </div>

      {/* PayPal */}
      <div className="card p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-900">PayPal Connection</h2>
            <p className="text-xs text-ink-400">Used for Auth &amp; Capture escrow</p>
          </div>
        </div>

        {profile?.paypal_connected ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-mint-50 border border-mint-200 mb-4">
            <Check className="w-4 h-4 text-mint-500" />
            <span className="text-sm text-mint-600 font-medium">Connected</span>
            <span className="text-xs text-ink-400 ml-auto">{profile.paypal_handle}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-600">Not connected — sandbox mode active</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">PayPal handle</label>
            <input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="sandbox-user@paypal.example" />
          </div>
          <button onClick={savePayPal} className="btn-amber">
            {savedPp ? <><Check className="w-4 h-4" /> Saved</> : 'Update connection'}
          </button>
        </div>
      </div>

      {/* My Products */}
      <div className="card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-base-100 border border-base-200 flex items-center justify-center">
              <Package className="w-5 h-5 text-ink-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink-900">My Listings</h2>
              <p className="text-xs text-ink-400">Products you're selling on the marketplace</p>
            </div>
          </div>
          {!showAddProduct && (
            <button onClick={() => { resetProductForm(); setShowAddProduct(true); }} className="btn-primary text-xs">
              <Plus className="w-4 h-4" /> Add product
            </button>
          )}
        </div>

        {/* Add/edit product form */}
        {showAddProduct && (
          <div className="rounded-xl bg-base-50 border border-base-200 p-4 mb-4 space-y-3 animate-slide-up">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-800">
                {editProduct ? 'Edit product' : 'New product'}
              </p>
              <button
                onClick={() => { setShowAddProduct(false); resetProductForm(); }}
                className="text-ink-400 hover:text-ink-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Title</label>
                <input className="input" value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="Handmade ceramic mug" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea className="input min-h-[80px]" value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="Describe what you're selling…" />
              </div>
              <div>
                <label className="label">Price (USD)</label>
                <input className="input" type="number" step="0.01" value={pPrice} onChange={(e) => setPPrice(e.target.value)} placeholder="32.00" />
              </div>
              <div>
                <label className="label">Stock</label>
                <input className="input" type="number" value={pStock} onChange={(e) => setPStock(e.target.value)} placeholder="1" />
              </div>
              <div>
                <label className="label">Category (optional)</label>
                <input className="input" value={pCategory} onChange={(e) => setPCategory(e.target.value)} placeholder="Ceramics" />
              </div>
              <div>
                <label className="label">Image URL (optional)</label>
                <input className="input" value={pImageUrl} onChange={(e) => setPImageUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>
            <button onClick={saveProduct} disabled={savingProduct || !pTitle.trim() || !pPrice.trim()} className="btn-primary">
              {savingProduct ? 'Saving…' : (<><Save className="w-4 h-4" /> {editProduct ? 'Update' : 'Publish'}</>)}
            </button>
          </div>
        )}

        {/* Product list */}
        {productsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-base-100 animate-pulse" />)}
          </div>
        ) : products.length === 0 && !showAddProduct ? (
          <div className="text-center py-8">
            <Package className="w-8 h-8 text-ink-300 mx-auto mb-2" />
            <p className="text-sm text-ink-500">No listings yet</p>
            <p className="text-xs text-ink-400 mt-1">Add a product to start selling.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-base-50 border border-base-200">
                <div className="w-11 h-11 rounded-lg bg-white border border-base-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} className="product-img" />
                  ) : (
                    <Package className="w-5 h-5 text-ink-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800 truncate">{p.title}</p>
                  <p className="text-xs text-ink-400">
                    {formatCurrency(p.price_cents, p.currency)}
                    {p.category && ` · ${p.category}`}
                    {p.stock !== null && ` · ${p.stock} in stock`}
                  </p>
                </div>
                <button
                  onClick={() => startEdit(p)}
                  className="text-ink-400 hover:text-rail-600 p-1.5 rounded-lg hover:bg-rail-50 transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteProduct(p.id)}
                  className="text-ink-400 hover:text-ember-500 p-1.5 rounded-lg hover:bg-ember-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security */}
      <div className="card p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-base-100 border border-base-200 flex items-center justify-center">
            <Shield className="w-5 h-5 text-ink-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-900">Security</h2>
            <p className="text-xs text-ink-400">How Payrail protects your trades</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-ink-600">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-rail-500 mt-0.5 flex-shrink-0" />
            Every AI-drafted amount is traced to the conversation context
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-rail-500 mt-0.5 flex-shrink-0" />
            Funds are authorized and held in escrow — never sent directly
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-rail-500 mt-0.5 flex-shrink-0" />
            Deliverables are AI-verified before funds are released
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-rail-500 mt-0.5 flex-shrink-0" />
            Every step is recorded in an immutable, downloadable audit trail
          </li>
        </ul>
      </div>
    </div>
  );
}
