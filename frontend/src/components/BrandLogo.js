'use client';

/** Logo de La Granjita (foto en /public/la-granjita.png) */
export default function BrandLogo({
  size = 40,
  className = '',
  rounded = 'rounded-2xl',
  ring = true,
}) {
  const style = { width: size, height: size };
  return (
    <div
      className={`relative overflow-hidden ${rounded} shrink-0 bg-primary-100 ${
        ring ? 'ring-2 ring-white/80 shadow-md shadow-primary-200/60' : ''
      } ${className}`}
      style={style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/la-granjita.png"
        alt="La Granjita"
        className="w-full h-full object-cover"
        width={size}
        height={size}
      />
    </div>
  );
}
