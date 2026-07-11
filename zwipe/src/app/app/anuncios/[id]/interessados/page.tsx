"use client";

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import SwipeDeck from '@/components/SwipeDeck';

interface InterestedBuyer {
  swipeId: string;
  buyerId: string;
  name: string;
  avatarUrl: string | null;
}

export default function InteressadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = use(params);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [listingTitle, setListingTitle] = useState('');
  const [buyers, setBuyers] = useState<InterestedBuyer[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      const { data: listing } = await supabase
        .from('listings')
        .select('title, seller_id')
        .eq('id', listingId)
        .single();

      if (!listing || listing.seller_id !== session.user.id) {
        router.push('/app');
        return;
      }
      setListingTitle(listing.title);

      const { data: decided } = await supabase.from('matches').select('buyer_id').eq('listing_id', listingId);
      const decidedIds = new Set((decided ?? []).map((m) => m.buyer_id));

      const { data: likes } = await supabase
        .from('swipes')
        .select('id, buyer_id, buyer:profiles!swipes_buyer_id_fkey(name, avatar_url)')
        .eq('listing_id', listingId)
        .eq('direction', 'like');

      type LikeRow = { id: string; buyer_id: string; buyer: { name: string; avatar_url: string | null } | null };

      const pending = ((likes ?? []) as unknown as LikeRow[])
        .filter((s) => !decidedIds.has(s.buyer_id))
        .map((s) => ({
          swipeId: s.id,
          buyerId: s.buyer_id,
          name: s.buyer?.name ?? 'Comprador',
          avatarUrl: s.buyer?.avatar_url ?? null,
        }));

      setBuyers(pending);
    };
    load();
  }, [listingId, router]);

  const handleDecision = async (buyer: InterestedBuyer, direction: 'like' | 'pass') => {
    if (!userId) return;
    await supabase.from('matches').insert({
      listing_id: listingId,
      buyer_id: buyer.buyerId,
      seller_id: userId,
      seller_decision: direction === 'like' ? 'accepted' : 'rejected',
    });
  };

  return (
    <div className="min-h-screen pb-16">
      <nav className="border-b border-white/10 sticky top-0 z-40 bg-brand-dark/90 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/app" className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider font-bold">Interessados em</p>
            <p className="font-bold leading-tight">{listingTitle || '...'}</p>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {buyers === null ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-brand-pink" size={28} />
          </div>
        ) : (
          <SwipeDeck
            items={buyers}
            keyExtractor={(b) => b.swipeId}
            onSwipe={handleDecision}
            renderCard={(b) => <BuyerCard buyer={b} />}
            emptyState={
              <div className="text-center py-20 text-white/40 space-y-2">
                <User size={40} className="mx-auto opacity-30" />
                <p className="font-semibold">Nenhum interessado pendente.</p>
                <p className="text-sm">Quando alguém curtir esse anúncio, aparece aqui.</p>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}

function BuyerCard({ buyer }: { buyer: InterestedBuyer }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4 bg-[#151521] p-8 text-center">
      <div className="w-28 h-28 rounded-full bg-black/40 overflow-hidden flex items-center justify-center">
        {buyer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={buyer.avatarUrl} alt={buyer.name} className="w-full h-full object-cover" />
        ) : (
          <User size={48} className="text-white/20" />
        )}
      </div>
      <h3 className="text-2xl font-black">{buyer.name}</h3>
      <p className="text-sm text-white/50">Curtiu seu anúncio. Aceita negociar?</p>
    </div>
  );
}
