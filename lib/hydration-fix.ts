"use client"

import { useEffect } from 'react'

/**
 * This utility helps prevent hydration mismatches caused by browser extensions
 * that inject attributes into HTML elements after the page loads.
 * 
 * Common attributes added by browser extensions:
 * - bbai-tooltip-injected (Browser AI extensions)
 * - cz-shortcut-listen (ColorZilla extension)
 * - data-new-gr-c-s-check-loaded (Grammarly)
 * - data-gr-ext-installed (Grammarly)
 * - spellcheck (Various spell checkers)
 */

const EXTENSION_ATTRIBUTES = [
  'bbai-tooltip-injected',
  'cz-shortcut-listen',
  'data-new-gr-c-s-check-loaded',
  'data-gr-ext-installed',
  'data-lt-installed',
  'data-gramm',
  'data-gramm_editor',
  'data-enable-grammarly'
]

export function useHydrationFix() {
  useEffect(() => {
    // Remove extension attributes that might cause hydration mismatches
    const removeExtensionAttributes = () => {
      EXTENSION_ATTRIBUTES.forEach(attr => {
        const elements = document.querySelectorAll(`[${attr}]`)
        elements.forEach(el => {
          el.removeAttribute(attr)
        })
      })
    }

    // Run immediately and on DOM mutations
    removeExtensionAttributes()

    // Set up a mutation observer to catch dynamically added attributes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as Element
          const attributeName = mutation.attributeName
          
          if (attributeName && EXTENSION_ATTRIBUTES.includes(attributeName)) {
            target.removeAttribute(attributeName)
          }
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: EXTENSION_ATTRIBUTES
    })

    return () => {
      observer.disconnect()
    }
  }, [])
}

/**
 * Suppress hydration warnings for development
 */
export function suppressHydrationWarnings() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const originalError = console.error
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('Hydration failed') ||
        args[0].includes('hydration mismatch') ||
        args[0].includes('did not match')
      ) {
        // Check if it's a browser extension related error
        const errorMessage = args.join(' ')
        const isExtensionError = EXTENSION_ATTRIBUTES.some(attr => 
          errorMessage.includes(attr)
        )
        
        if (isExtensionError) {
          console.warn('Hydration mismatch caused by browser extension - this is safe to ignore:', ...args)
          return
        }
      }
      originalError.apply(console, args)
    }
  }
}
