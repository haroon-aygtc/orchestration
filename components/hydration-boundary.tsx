"use client"

import { useEffect } from 'react'
import { useHydrationFix, suppressHydrationWarnings } from '@/lib/hydration-fix'

interface HydrationBoundaryProps {
  children: React.ReactNode
}

export function HydrationBoundary({ children }: HydrationBoundaryProps) {
  useHydrationFix()

  useEffect(() => {
    suppressHydrationWarnings()
  }, [])

  return <>{children}</>
}
