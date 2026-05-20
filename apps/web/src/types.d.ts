/**
 * Ambient declarations for non-TypeScript asset imports used by Next.js.
 * Without these, `tsc --noEmit` cannot resolve CSS imports.
 */

// Side-effect CSS imports (e.g. `import './globals.css'`)
declare module '*.css' {
  // Intentionally empty: App Router imports CSS for side-effects only.
}
