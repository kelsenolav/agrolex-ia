export const CATEGORIES = [
  'Imóveis',
  'Veículos',
  'Máquinas e Equipamentos',
  'Eletrônicos',
  'Móveis e Casa',
  'Outros',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type ListingStatus = 'active' | 'paused' | 'sold';

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  category: Category;
  price: number | null;
  city: string | null;
  state: string | null;
  photos: string[];
  status: ListingStatus;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  avatar_url: string | null;
}

export interface Match {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  seller_decision: 'accepted' | 'rejected';
  created_at: string;
}
