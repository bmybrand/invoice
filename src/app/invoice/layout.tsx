import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Invoice' },
  applicationName: 'Invoice',
  icons: {
    icon: [{ url: '/invoice-favicon.svg?v=2', type: 'image/svg+xml' }],
    shortcut: [{ url: '/invoice-favicon.svg?v=2', type: 'image/svg+xml' }],
  },
}

export default function InvoiceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
