import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { img: 28, text: 'text-lg' },
  md: { img: 36, text: 'text-xl' },
  lg: { img: 48, text: 'text-3xl' },
};

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/agrolexi-logo.png"
        alt="AgrolexI"
        width={s.img}
        height={s.img}
        className="object-contain"
        priority
      />
      <span className={`font-bold ${s.text}`}>
        A<span className="lowercase">grole</span>x<span className="uppercase">I</span>
      </span>
    </div>
  );
}
