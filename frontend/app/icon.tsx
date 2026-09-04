import { ImageResponse } from 'next/og';

// Next.js App Router file convention: this automatically becomes
// /icon.png and is wired into <head> by Next — no manual <link> needed,
// and no binary asset to keep in sync in public/. Matches the diamond
// mark used in ProtectedShell's sidebar logo.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#071813',
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L16 9L9 16L2 9L9 2Z" stroke="#10B981" strokeWidth="1.6" fill="none" />
          <path d="M9 5L13 9L9 13L5 9L9 5Z" fill="#06B6D4" opacity="0.85" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
