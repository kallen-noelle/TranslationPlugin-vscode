/**
 * Inline SVG icons copied exactly from the legacy wordBookWebview.html
 * sprite (`<symbol>` definitions), so the React version renders identical
 * paths, stroke widths and engine brand colors.
 */
import * as React from 'react';
import { cn } from '../lib/utils';

function Svg({
  children,
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('block size-[15px] flex-shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ── stroke icons ── */
export const IconSort = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4.5 6.5L8 10l3.5-3.5" />
  </Svg>
);

export const IconRefresh = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M13.7 9.1A5.7 5.7 0 1 1 11.2 3.7 M13.6 2.3v3.4h-3.4" />
  </Svg>
);

export const IconSearch = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={1.5} {...p}>
    <circle cx="6.5" cy="6.5" r="5" />
    <path d="M10.5 10.5L14 14" strokeLinecap="round" />
  </Svg>
);

export const IconClose = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" {...p}>
    <path d="M4 4l8 8M12 4L4 12" />
  </Svg>
);

export const IconCopy = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="currentColor" {...p}>
    <path fillRule="evenodd" d="M5 2.5A1.5 1.5 0 0 1 6.5 1h4A1.5 1.5 0 0 1 12 2.5V3h.5A1.5 1.5 0 0 1 14 4.5v8A1.5 1.5 0 0 1 12.5 14h-6A1.5 1.5 0 0 1 5 12.5V12h-.5A1.5 1.5 0 0 1 3 10.5v-8A1.5 1.5 0 0 1 4.5 1H5zM4.5 2.5v8H5v-6A1.5 1.5 0 0 1 6.5 3H11v-.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0-.5.5zM6.5 4a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5z" />
  </Svg>
);

export const IconSpeech = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="currentColor" {...p}>
    <path fillRule="evenodd" d="M8.5 1.5a.5.5 0 0 1 .8.4v12.2a.5.5 0 0 1-.8.4L5.6 12H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.6zM8.3 3.1 6 4.9v6.2l2.3 1.8zM11 5.3a.5.5 0 0 1 .7-.1 4.2 4.2 0 0 1 0 6.6.5.5 0 0 1-.6-.8 3.2 3.2 0 0 0 0-5 .5.5 0 0 1-.1-.7zm1.7-2a.5.5 0 0 1 .7-.1 7 7 0 0 1 0 9.6.5.5 0 1 1-.6-.8 6 6 0 0 0 0-8 .5.5 0 0 1-.1-.7z" />
  </Svg>
);

export const IconStarOff = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" {...p}>
    <path d="M8 1.6l1.85 3.75 4.14.6-3 2.92.71 4.13L8 11.37l-3.7 1.63.71-4.13-3-2.92 4.14-.6z" />
  </Svg>
);

/* ── fill icons ── */
export const IconLightbulb = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="currentColor" {...p}>
    <path d="M8 1a4.5 4.5 0 0 0-2.6 8.16c.42.37.72.86.85 1.4.02.1.05.2.05.3h3.4c0-.1.03-.2.05-.3.13-.54.43-1.03.85-1.4A4.5 4.5 0 0 0 8 1zm0 1.5a3 3 0 0 1 1.78 5.42 3.7 3.7 0 0 0-1.16 2.08H7.38a3.7 3.7 0 0 0-1.16-2.08A3 3 0 0 1 8 2.5zM6.5 11.5h3a.55.55 0 1 1 0 1.1h-3a.55.55 0 1 1 0-1.1zm.6 1.85h1.8a.5.5 0 0 1 .15.02.45.45 0 0 1-.05.88H7a.45.45 0 0 1-.05-.88.5.5 0 0 1 .15-.02z" />
  </Svg>
);

export const IconGear = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="currentColor" {...p}>
    <path fillRule="evenodd" d="M7.06.63l.7-.01c.13 0 .24.05.32.15l.35 1.03c.24.09.46.2.67.32l1.05-.5c.13-.06.27-.04.37.06l.98.98c.1.1.12.24.06.37l-.5 1.05c.12.21.23.43.32.67l1.03.35c.1.08.15.19.15.32v1.4c0 .13-.05.24-.15.32l-1.03.35c-.09.24-.2.46-.32.67l.5 1.05c.06.13.04.27-.06.37l-.98.98a.33.33 0 0 1-.37.06l-1.05-.5c-.21.12-.43.23-.67.32l-.35 1.03a.33.33 0 0 1-.32.15h-1.4a.33.33 0 0 1-.32-.15l-.35-1.03a4.4 4.4 0 0 1-.67-.32l-1.05.5a.33.33 0 0 1-.37-.06l-.98-.98a.33.33 0 0 1-.06-.37l.5-1.05a4.4 4.4 0 0 1-.32-.67l-1.03-.35a.33.33 0 0 1-.15-.32V6.37c0-.13.05-.24.15-.32l1.03-.35c.09-.24.2-.46.32-.67l-.5-1.05a.33.33 0 0 1 .06-.37l.98-.98c.1-.1.24-.12.37-.06l1.05.5c.21-.11.43-.23.67-.32l.35-1.03A.33.33 0 0 1 7.06.63zM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
  </Svg>
);

export const IconMore = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="currentColor" {...p}>
    <circle cx="3" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="13" cy="8" r="1.5" />
  </Svg>
);

export const IconImport = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="currentColor" {...p}>
    <path fillRule="evenodd" d="M8 15a.5.5 0 0 1-.5-.5V7.7L5.35 9.85a.5.5 0 1 1-.7-.7l3-3a.5.5 0 0 1 .7 0l3 3a.5.5 0 1 1-.7.7L8.5 7.7v6.8a.5.5 0 0 1-.5.5zM2.5 6a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-3a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" />
  </Svg>
);

export const IconExport = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="currentColor" {...p}>
    <path fillRule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v6.8l2.15-2.15a.5.5 0 0 1 .7.7l-3 3a.5.5 0 0 1-.7 0l-3-3a.5.5 0 1 1 .7-.7L7.5 8.3V1.5A.5.5 0 0 1 8 1zM2.5 10a.5.5 0 0 1 .5.5v2.5h10V10.5a.5.5 0 0 1 1 0v3a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5z" />
  </Svg>
);

/* ── engine brand icons (colored, as in the legacy sprite) ── */
export const IconEngineMicrosoft = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="1" y="1" width="6.5" height="6.5" fill="#F25326" />
    <rect x="8.5" y="1" width="6.5" height="6.5" fill="#81BC0A" />
    <rect x="1" y="8.5" width="6.5" height="6.5" fill="#07A6F0" />
    <rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#FFBA0F" />
  </Svg>
);

export const IconEngineGoogle = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path fill="#fbbb00" d="M4.66,9.25l-.42,1.56-1.52,0A5.9,5.9,0,0,1,2,8a6,6,0,0,1,.67-2.76h0L4,5.49l.6,1.35A3.41,3.41,0,0,0,4.43,8,3.47,3.47,0,0,0,4.66,9.25Z" />
    <path fill="#518ef8" d="M13.9,6.88A6.86,6.86,0,0,1,14,8a6.38,6.38,0,0,1-.13,1.25,6,6,0,0,1-2.11,3.43h0L10,12.59,9.8,11.08a3.6,3.6 0 0 0 1.54-1.83H8.13V6.88H13.9Z" />
    <path fill="#28b446" d="M11.76,12.68h0a6,6,0,0,1-9-1.84L4.66,9.25A3.56,3.56,0,0,0 9.8,11.08Z" />
    <path fill="#f14336" d="M11.83,3.38,9.89,5A3.57,3.57,0,0,0,4.63,6.84l-2-1.6h0a6,6,0,0,1,9.16-1.86Z" />
  </Svg>
);

export const IconEngineOpenAI = (p: React.SVGProps<SVGSVGElement>) => (
  <Svg fill="currentColor" {...p}>
    <path d="M14.08,6.71L14.08,6.71c0.32-0.97,0.21-2.03-0.3-2.91C13,2.46,11.44,1.77,9.93,2.09C9.25,1.33,8.28,0.9,7.26,0.9c-1.55,0-2.93,1-3.41,2.47c-1,0.21-1.86,0.83-2.36,1.72C0.7,6.44,0.88,8.13,1.92,9.29c-0.32,0.97-0.21,2.02,0.3,2.9C3,13.53,4.56,14.23,6.08,13.9c0.67,0.76,1.64,1.2,2.66,1.19c1.55,0,2.93-1,3.41-2.47c1-0.21,1.86-0.83,2.36-1.72C15.3,9.56,15.12,7.87,14.08,6.71z M10.66,2.94L10.66,2.94c0.95,0,1.83,0.51,2.31,1.33c0.31,0.54,0.42,1.17,0.32,1.78C13.27,6.04,13.23,6.02,13.21,6l-2.83-1.63c-0.14-0.08-0.32-0.08-0.47,0L6.6,6.28v-1.4L9.34,3.3C9.74,3.06,10.2,2.94,10.66,2.94z M8,6.38l1.39,0.81V8.8L8,9.61L6.6,8.8V7.19L8,6.38z M4.6,4.49c0-1.47,1.19-2.66,2.66-2.66v0l0,0c0.62,0,1.23,0.22,1.71,0.62C8.94,2.46,8.9,2.48,8.87,2.5L6.05,4.12C5.9,4.21,5.82,4.36,5.82,4.53v3.83L4.6,7.65V4.49z M2.29,5.56c0.31-0.54,0.8-0.95,1.38-1.17v0v3.36c0,0.17,0.09,0.32,0.23,0.4l3.31,1.91l-1.22,0.71L3.26,9.19C1.99,8.46,1.56,6.83,2.29,5.56z M3.03,11.73L3.03,11.73c-0.31-0.53-0.42-1.17-0.31-1.78C2.74,9.96,2.77,9.98,2.8,10l2.83,1.63c0.14,0.08,0.32,0.08,0.47,0L9.4,9.72v1.4L6.66,12.7C5.39,13.43,3.76,13,3.03,11.73z M11.41,11.51c0,1.47-1.19,2.66-2.66,2.66v0c-0.62,0-1.23-0.22-1.7-0.62c0.02-0.01,0.06-0.03,0.09-0.05l2.83-1.63c0.14-0.08,0.24-0.24,0.23-0.4l0-3.82l1.22,0.7V11.51z M13.71,10.43L13.71,10.43c-0.31,0.54-0.8,0.96-1.38,1.17V8.24c0-0.17-0.09-0.32-0.23-0.4L8.79,5.93l1.22-0.7l2.73,1.58C14.01,7.54,14.45,9.16,13.71,10.43z" />
  </Svg>
);

/** Maps an engine key to its brand icon. */
export function EngineIcon({ engine, ...p }: { engine: string } & React.SVGProps<SVGSVGElement>) {
  switch (engine) {
    case 'microsoft':
    case 'edge':
      return <IconEngineMicrosoft {...p} />;
    case 'google':
      return <IconEngineGoogle {...p} />;
    case 'openai':
      return <IconEngineOpenAI {...p} />;
    default:
      return <IconEngineMicrosoft {...p} />;
  }
}
