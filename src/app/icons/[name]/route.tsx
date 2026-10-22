import { ImageResponse } from 'next/og';

// App icons rendered once at build time: the station mark (a ring on a line) on the navy rail colour.
export const dynamic = 'force-static';

const ICONS = {
  'icon-192.png': { size: 192, maskable: false },
  'icon-512.png': { size: 512, maskable: false },
  'maskable-512.png': { size: 512, maskable: true },
  'apple-touch-icon.png': { size: 180, maskable: true },
} as const;

type IconName = keyof typeof ICONS;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

const NAVY = '#1d2f5c';
const WHITE = '#f7f8fb';

export async function GET(_req: Request, ctx: RouteContext<'/icons/[name]'>) {
  const { name } = await ctx.params;
  const icon = ICONS[name as IconName];
  if (!icon) return new Response('Not found', { status: 404 });
  const { size, maskable } = icon;
  // Maskable icons keep the mark inside the 80 % safe zone.
  const scale = maskable ? 0.62 : 0.78;
  const ring = Math.round(size * 0.34 * scale);
  const stroke = Math.max(4, Math.round(size * 0.075 * scale));
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: NAVY,
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', left: Math.round(size * (1 - scale) / 2), right: Math.round(size * (1 - scale) / 2), height: stroke, background: WHITE, borderRadius: stroke }} />
        <div style={{ width: ring, height: ring, borderRadius: ring, border: `${stroke}px solid ${WHITE}`, background: NAVY }} />
      </div>
    ),
    { width: size, height: size },
  );
}
