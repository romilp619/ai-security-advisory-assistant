import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// next/font downloads and self-hosts these at build time, so the running page makes
// no request to a third-party font host. Both are variable fonts, so weight is free.
const sans = Inter({subsets: ['latin'], variable: '--font-sans', display: 'swap', axes: ['opsz']});
const mono = JetBrains_Mono({subsets: ['latin'], variable: '--font-mono', display: 'swap'});

export const metadata: Metadata = {
  title: 'AI Security Advisory Assistant',
  description: 'Source-grounded vulnerability research, powered by Sanity Context.',
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en" className={sans.variable + ' ' + mono.variable}><body>{children}</body></html>;
}
