import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JobPilot — AI job search assistant',
  description: 'Human-in-the-loop job discovery, matching, and application preparation.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
