"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Flame, LogOut, Heart, Store, Sparkles, Loader2, Plus, MapPin,
  Trash2, Pause, Play, Users, MessageCircle, ImagePlus, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, type BuyIntent, type Category, type Listing } from '@/lib/types';
import SwipeDeck from '@/components/SwipeDeck';

type Tab = 'comprar' | 'anuncios' | 'matches';

export default function AppHomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('comprar');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);
      setChecking(false);
    });
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (checking || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-pink" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <nav className="border-b border-white/10 sticky top-0 z-40 bg-brand-dark/90 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/app" className="flex items-center gap-2 text-brand-pink">
            <Flame size={26} fill="currentColor" />
            <span className="text-lg font-black tracking-tight">Zwipe</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex gap-2 bg-[#151521] border border-white/10 rounded-2xl p-1.5 mb-8">
          <TabButton active={tab === 'comprar'} onClick={() => setTab('comprar')} icon={<Sparkles size={16} />} label="Comprar" />
          <TabButton active={tab === 'anuncios'} onClick={() => setTab('anuncios')} icon={<Store size={16} />} label="Meus Anúncios" />
          <TabButton active={tab === 'matches'} onClick={() => setTab('matches')} icon={<Heart size={16} />} label="Matches" />
        </div>

        {tab === 'comprar' && <ComprarTab userId={userId} />}
        {tab === 'anuncios' && <AnunciosTab userId={userId} />}
        {tab === 'matches' && <MatchesTab userId={userId} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${
        active ? 'bg-brand-pink text-white' : 'text-white/50 hover:text-white'
      }`}
    >
      {icon} {label}
    </button>
  );
}

// ---------- Comprar ----------

function ComprarTab({ userId }: { userId: string }) {
  const [intents, setIntents] = useState<BuyIntent[] | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [showIntentForm, setShowIntentForm] = useState(false);

  const loadIntents = async () => {
    const { data } = await supabase
      .from('buy_intents')
      .select('*')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });
    setIntents(data ?? []);
  };

  useEffect(() => {
    loadIntents();
  }, [userId]);

  useEffect(() => {
    if (!intents || intents.length === 0) {
      setListings(intents ? [] : null);
      return;
    }

    const load = async () => {
      const { data: swiped } = await supabase.from('swipes').select('listing_id').eq('buyer_id', userId);
      const swipedIds = new Set((swiped ?? []).map((s) => s.listing_id));

      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('status', 'active')
        .neq('seller_id', userId)
        .order('created_at', { ascending: false });

      const matched = (data ?? []).filter(
        (l) =>
          !swipedIds.has(l.id) &&
          intents.some(
            (intent) =>
              intent.category === l.category &&
              intent.state === l.state &&
              (!intent.city || intent.city === l.city)
          )
      );

      setListings(matched);
    };
    load();
  }, [userId, intents]);

  const handleSwipe = async (item: Listing, direction: 'like' | 'pass') => {
    await supabase
      .from('swipes')
      .upsert({ listing_id: item.id, buyer_id: userId, direction }, { onConflict: 'listing_id,buyer_id' });
  };

  const removeIntent = async (id: string) => {
    await supabase.from('buy_intents').delete().eq('id', id);
    loadIntents();
  };

  if (intents === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-pink" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#151521] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-white/50">O que você procura</p>
          <button
            onClick={() => setShowIntentForm((v) => !v)}
            className="text-xs font-bold text-brand-pink hover:underline cursor-pointer flex items-center gap-1"
          >
            <Plus size={13} /> {showIntentForm ? 'Fechar' : 'Nova busca'}
          </button>
        </div>

        {intents.length === 0 && !showIntentForm && (
          <p className="text-sm text-white/40">
            Cadastre o que você quer comprar (categoria + região) e o Zwipe cruza automaticamente com
            quem está vendendo. Você não precisa procurar nada.
          </p>
        )}

        {intents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {intents.map((intent) => (
              <span
                key={intent.id}
                className="text-xs bg-black/30 border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2"
              >
                {intent.category} · {[intent.city, intent.state].filter(Boolean).join(', ')}
                <button onClick={() => removeIntent(intent.id)} className="cursor-pointer text-white/40 hover:text-rose-400">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {showIntentForm && (
          <IntentForm
            userId={userId}
            onCreated={() => {
              setShowIntentForm(false);
              loadIntents();
            }}
          />
        )}
      </div>

      {intents.length === 0 ? (
        <div className="text-center py-16 text-white/40 space-y-2">
          <Sparkles size={40} className="mx-auto opacity-30" />
          <p className="font-semibold">Cadastre uma busca acima para começar.</p>
        </div>
      ) : listings === null ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand-pink" size={28} />
        </div>
      ) : (
        <SwipeDeck
          items={listings}
          keyExtractor={(l) => l.id}
          onSwipe={handleSwipe}
          renderCard={(l) => <ListingCard listing={l} />}
          emptyState={
            <div className="text-center py-20 text-white/40 space-y-2">
              <Sparkles size={40} className="mx-auto opacity-30" />
              <p className="font-semibold">Nenhum anúncio bateu com sua busca ainda.</p>
              <p className="text-sm">Assim que alguém anunciar algo compatível, aparece aqui.</p>
            </div>
          }
        />
      )}
    </div>
  );
}

function IntentForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error } = await supabase.from('buy_intents').insert({
      buyer_id: userId,
      category,
      city: city || null,
      state,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCity('');
    setState('');
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-white/10">
      {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Field label="Categoria">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade (opcional)">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </Field>
        <Field label="Estado (UF)">
          <input
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase())}
            maxLength={2}
            required
            className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full h-11 rounded-xl bg-brand-pink text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : 'Cadastrar busca'}
      </button>
    </form>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 bg-black/40 relative">
        {listing.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <ImagePlus size={48} />
          </div>
        )}
      </div>
      <div className="p-5 space-y-1.5 bg-[#151521]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-pink">{listing.category}</span>
        <h3 className="text-lg font-black leading-tight">{listing.title}</h3>
        {listing.price != null && (
          <p className="text-xl font-black text-emerald-400">
            {listing.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
        {(listing.city || listing.state) && (
          <p className="text-xs text-white/40 flex items-center gap-1">
            <MapPin size={12} /> {[listing.city, listing.state].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- Meus Anúncios ----------

function AnunciosTab({ userId }: { userId: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });
    setListings(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId]);

  const toggleStatus = async (listing: Listing) => {
    const next = listing.status === 'active' ? 'paused' : 'active';
    await supabase.from('listings').update({ status: next }).eq('id', listing.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este anúncio?')) return;
    await supabase.from('listings').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => setShowForm((v) => !v)}
        className="w-full flex items-center justify-center gap-2 bg-brand-pink text-white font-bold py-3 rounded-xl hover:brightness-110 transition-all cursor-pointer"
      >
        <Plus size={18} /> {showForm ? 'Fechar' : 'Novo Anúncio'}
      </button>

      {showForm && (
        <NovoAnuncioForm
          userId={userId}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-brand-pink" size={28} />
        </div>
      ) : listings.length === 0 ? (
        <p className="text-center text-white/40 py-16">Você ainda não tem anúncios.</p>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <div key={l.id} className="bg-[#151521] border border-white/10 rounded-2xl p-4 flex gap-4">
              <div className="w-20 h-20 rounded-xl bg-black/40 overflow-hidden shrink-0">
                {l.photos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0]} alt={l.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold truncate">{l.title}</h3>
                  <StatusPill status={l.status} />
                </div>
                <p className="text-xs text-white/40">{l.category}</p>
                {l.price != null && (
                  <p className="text-sm font-bold text-emerald-400">
                    {l.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <Link
                    href={`/app/anuncios/${l.id}/interessados`}
                    className="text-xs font-semibold text-brand-pink hover:underline flex items-center gap-1"
                  >
                    <Users size={13} /> Ver interessados
                  </Link>
                  <button
                    onClick={() => toggleStatus(l)}
                    className="text-xs font-semibold text-white/50 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {l.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                    {l.status === 'active' ? 'Pausar' : 'Reativar'}
                  </button>
                  <button
                    onClick={() => remove(l.id)}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Listing['status'] }) {
  const map = {
    active: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    paused: { label: 'Pausado', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    sold: { label: 'Vendido', className: 'bg-white/10 text-white/50 border-white/20' },
  } as const;
  const s = map[status];
  return (
    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${s.className}`}>{s.label}</span>
  );
}

function NovoAnuncioForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files ?? []).slice(0, 5));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const photoUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('listing-photos').upload(path, file);
        if (uploadError) throw new Error('Erro ao enviar foto: ' + uploadError.message);
        const { data } = supabase.storage.from('listing-photos').getPublicUrl(path);
        photoUrls.push(data.publicUrl);
      }

      const { error: insertError } = await supabase.from('listings').insert({
        seller_id: userId,
        title,
        description: description || null,
        category,
        price: price ? Number(price) : null,
        city: city || null,
        state: state || null,
        photos: photoUrls,
      });
      if (insertError) throw new Error(insertError.message);

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar anúncio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#151521] border border-white/10 rounded-2xl p-6 space-y-4">
      {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Field label="Título">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </Field>

      <Field label="Descrição">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </Field>

      <Field label="Categoria">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço (R$)">
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </Field>
        <Field label="Cidade">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </Field>
      </div>

      <Field label="Estado (UF)">
        <input
          value={state}
          onChange={(e) => setState(e.target.value.toUpperCase())}
          maxLength={2}
          className="w-24 bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </Field>

      <Field label="Fotos (até 5)">
        <label className="w-full flex items-center justify-center h-24 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:border-brand-pink/50 transition-colors text-white/40 text-sm gap-2">
          <ImagePlus size={20} />
          {files.length > 0 ? `${files.length} foto(s) selecionada(s)` : 'Selecionar fotos'}
          <input type="file" accept="image/*" multiple onChange={handleFileChange} className="sr-only" />
        </label>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {files.map((f, i) => (
              <span key={i} className="text-xs bg-black/30 rounded-full px-3 py-1 flex items-center gap-1.5">
                {f.name}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>

      <button
        type="submit"
        disabled={saving}
        className="w-full h-11 rounded-xl bg-brand-pink text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : 'Publicar anúncio'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-white/50">{label}</label>
      {children}
    </div>
  );
}

// ---------- Matches ----------

interface MatchWithContext {
  id: string;
  listing: Listing;
  other: { name: string; whatsapp: string | null } | null;
  role: 'comprador' | 'vendedor';
}

function MatchesTab({ userId }: { userId: string }) {
  const [matches, setMatches] = useState<MatchWithContext[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const [asBuyer, asSeller] = await Promise.all([
        supabase
          .from('matches')
          .select('id, listing:listings(*), other:profiles!matches_seller_id_fkey(name, whatsapp)')
          .eq('buyer_id', userId)
          .eq('seller_decision', 'accepted'),
        supabase
          .from('matches')
          .select('id, listing:listings(*), other:profiles!matches_buyer_id_fkey(name, whatsapp)')
          .eq('seller_id', userId)
          .eq('seller_decision', 'accepted'),
      ]);

      type MatchRow = { id: string; listing: Listing; other: { name: string; whatsapp: string | null } | null };

      const buyerRows = ((asBuyer.data ?? []) as unknown as MatchRow[]).map((m) => ({ ...m, role: 'comprador' as const }));
      const sellerRows = ((asSeller.data ?? []) as unknown as MatchRow[]).map((m) => ({ ...m, role: 'vendedor' as const }));

      setMatches([...buyerRows, ...sellerRows]);
    };
    load();
  }, [userId]);

  if (matches === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-pink" size={28} />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-20 text-white/40 space-y-2">
        <Heart size={40} className="mx-auto opacity-30" />
        <p className="font-semibold">Nenhum match ainda.</p>
        <p className="text-sm">Continue dando swipe para encontrar negócios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <div key={m.id} className="bg-[#151521] border border-white/10 rounded-2xl p-4 flex gap-4 items-center">
          <div className="w-16 h-16 rounded-xl bg-black/40 overflow-hidden shrink-0">
            {m.listing?.photos?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.listing.photos[0]} alt={m.listing.title} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{m.listing?.title}</p>
            <p className="text-xs text-white/40">
              Você é o {m.role} · com {m.other?.name}
            </p>
          </div>
          {m.other?.whatsapp && (
            <a
              href={`https://wa.me/${m.other.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-full hover:brightness-110 transition-all shrink-0"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
