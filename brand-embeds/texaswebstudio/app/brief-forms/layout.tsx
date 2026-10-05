import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brief form | Texas Web Studio',
}

export default function BriefFormsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-[100dvh] bg-white">{children}</div>
}
