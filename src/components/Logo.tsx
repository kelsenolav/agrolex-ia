'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { img: 110 },
  md: { img: 130 },
  lg: { img: 160 },
};

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const s = SIZES[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/agrolexi-logo.png"
      alt="AgrolexI"
      width={s.img}
      height={32}
      style={{ width: s.img, height: 'auto', objectFit: 'contain' }}
      className={className}
    />
  );
}
