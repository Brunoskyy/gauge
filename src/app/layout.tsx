import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { IBM_Plex_Mono, Inter } from 'next/font/google'

import { Nav } from '@/components/nav'

import './globals.css'

const inter = Inter({ variable: '--font-sans-var', subsets: ['latin'] })
const mono = IBM_Plex_Mono({
  variable: '--font-mono-var',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: { default: 'Gauge', template: '%s · Gauge' },
  description: 'Product analytics for Northwind Notes.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main"
          className="bg-surface sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  )
}
