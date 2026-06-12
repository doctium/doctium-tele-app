import Image from 'next/image';

interface Props { src?: string; name?: string; size?: number; ring?: boolean; }

export function Avatar({ src, name, size = 36, ring = true }: Props) {
  const initials = name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
  const ringCls = ring ? 'ring-2 ring-white shadow-[0_2px_8px_rgba(19,49,87,0.14)]' : '';

  if (src) {
    return (
      <Image
        src={src}
        alt={name ?? ''}
        width={size}
        height={size}
        className={`rounded-full object-cover ${ringCls}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-gradient-navy text-white font-bold flex items-center justify-center flex-shrink-0 ${ringCls}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
