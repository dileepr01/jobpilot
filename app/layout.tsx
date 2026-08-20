import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'JobPilot — Your AI Career Copilot',
    template: '%s · JobPilot'
  },
  description: 'Discover relevant jobs, understand your match, tailor your resume, and track applications in one AI-powered career workspace.',
  applicationName: 'JobPilot',
  keywords: ['job search', 'AI career copilot', 'resume tailoring', 'job matching', 'application tracker'],
  openGraph: {
    title: 'JobPilot — Your AI Career Copilot',
    description: 'Discover relevant jobs, understand your match, tailor your resume, and track applications in one career workspace.',
    type: 'website',
    siteName: 'JobPilot'
  },
  twitter: {
    card: 'summary',
    title: 'JobPilot — Your AI Career Copilot',
    description: 'Smarter job discovery, explainable matching, resume tailoring, and application tracking.'
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
