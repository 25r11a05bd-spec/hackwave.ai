import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        }}
      >
        <svg width="108" height="108" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L16 9L9 16L2 9L9 2Z" stroke="#10B981" strokeWidth="1.4" fill="none" />
          <path d="M9 5L13 9L9 13L5 9L9 5Z" fill="#06B6D4" opacity="0.85" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
