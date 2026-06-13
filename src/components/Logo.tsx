'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// sm = navbars (32px container) | md = landing header | lg = login/cadastro
const SIZES = {
  sm: { img: 26, text: 'text-base' },
  md: { img: 32, text: 'text-xl' },
  lg: { img: 44, text: 'text-3xl' },
};

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/agrolexi-logo.png"
        alt="AgrolexI"
        width={s.img}
        height={s.img}
        style={{ width: s.img, height: s.img, objectFit: 'contain' }}
      />
      <span className={`font-bold ${s.text}`}>
        A<span style={{ textTransform: 'lowercase' }}>grole</span>x<span style={{ textTransform: 'uppercase' }}>I</span>
      </span>
    </div>
  );
}
