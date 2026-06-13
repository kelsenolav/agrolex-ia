'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { img: 100 },
  md: { img: 120 },
  lg: { img: 150 },
};

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const s = SIZES[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-white px-2 py-1 shadow-sm ${className}`}
      style={{ lineHeight: 0 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/agrolexi-logo.png"
        alt="AgrolexI"
        width={s.img}
        style={{ width: s.img, height: 'auto', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}
