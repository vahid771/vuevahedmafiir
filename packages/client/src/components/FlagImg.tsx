import type { CSSProperties } from 'react';

/**
 * Renders a small country flag image using flagcdn.com.
 * Falls back to the uppercase country code if the image fails to load.
 * code — ISO 3166-1 alpha-2 country code (e.g. "GB", "IR")
 */
export default function FlagImg({ code, className = '', style }: { code: string; className?: string; style?: CSSProperties }) {
  const lower = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w20/${lower}.png`}
      srcSet={`https://flagcdn.com/w40/${lower}.png 2x`}
      width={20}
      height={15}
      alt={code}
      style={style}
      className={`inline-block rounded-[2px] object-cover shrink-0 ${className}`}
      onError={e => {
        // If image fails, show the 2-letter code as text
        const el = e.currentTarget;
        const parent = el.parentElement;
        if (parent) {
          const txt = document.createElement('span');
          txt.className = 'text-xs font-mono text-gray-500';
          txt.textContent = code.toUpperCase();
          parent.replaceChild(txt, el);
        }
      }}
    />
  );
}
