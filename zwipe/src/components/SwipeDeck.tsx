"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Heart, X } from 'lucide-react';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;

interface SwipeDeckProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onSwipe: (item: T, direction: 'like' | 'pass') => void;
  emptyState: React.ReactNode;
}

export default function SwipeDeck<T>({ items, keyExtractor, renderCard, onSwipe, emptyState }: SwipeDeckProps<T>) {
  const [index, setIndex] = useState(0);
  const topFlingRef = useRef<((direction: 'like' | 'pass') => void) | null>(null);

  if (index >= items.length) {
    return <div className="w-full max-w-sm mx-auto">{emptyState}</div>;
  }

  const visible = items.slice(index, index + 3);

  const handleDecision = (item: T, direction: 'like' | 'pass') => {
    setIndex((i) => i + 1);
    onSwipe(item, direction);
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="relative h-[480px]">
        <AnimatePresence>
          {visible
            .map((item, i) => (
              <SwipeCard
                key={keyExtractor(item)}
                depth={i}
                isTop={i === 0}
                registerFling={i === 0 ? (fn) => { topFlingRef.current = fn; } : undefined}
                onDecision={(direction) => handleDecision(item, direction)}
              >
                {renderCard(item)}
              </SwipeCard>
            ))
            .reverse()}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => topFlingRef.current?.('pass')}
          aria-label="Passar"
          className="w-16 h-16 rounded-full bg-[#151521] border border-rose-500/40 text-rose-500 flex items-center justify-center hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <X size={28} />
        </button>
        <button
          onClick={() => topFlingRef.current?.('like')}
          aria-label="Curtir"
          className="w-16 h-16 rounded-full bg-[#151521] border border-emerald-400/40 text-emerald-400 flex items-center justify-center hover:bg-emerald-400/10 transition-colors cursor-pointer"
        >
          <Heart size={28} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}

function SwipeCard({
  children,
  depth,
  isTop,
  registerFling,
  onDecision,
}: {
  children: React.ReactNode;
  depth: number;
  isTop: boolean;
  registerFling?: (fn: (direction: 'like' | 'pass') => void) => void;
  onDecision: (direction: 'like' | 'pass') => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);

  const fling = (direction: 'like' | 'pass') => {
    animate(x, direction === 'like' ? 600 : -600, {
      duration: 0.25,
      ease: 'easeIn',
      onComplete: () => onDecision(direction),
    });
  };

  useEffect(() => {
    registerFling?.(fling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerFling]);

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 10 - depth,
        scale: 1 - depth * 0.04,
        top: depth * 10,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) {
          fling('like');
        } else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) {
          fling('pass');
        } else {
          animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 });
        }
      }}
      initial={{ scale: 1 - depth * 0.04, opacity: depth === 2 ? 0 : 1 }}
      animate={{ scale: 1 - depth * 0.04, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-[#151521] border border-white/10">
        {children}

        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute top-8 right-6 border-4 border-emerald-400 text-emerald-400 font-black text-2xl uppercase px-4 py-1 rounded-xl -rotate-12 flex items-center gap-2"
            >
              <Heart size={22} fill="currentColor" /> Curti
            </motion.div>
            <motion.div
              style={{ opacity: passOpacity }}
              className="absolute top-8 left-6 border-4 border-rose-500 text-rose-500 font-black text-2xl uppercase px-4 py-1 rounded-xl rotate-12 flex items-center gap-2"
            >
              <X size={22} /> Passei
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
