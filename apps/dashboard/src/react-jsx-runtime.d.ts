declare namespace JSX {
  interface IntrinsicElements {
    main: Record<string, unknown>;
    h1: Record<string, unknown>;
    section: Record<string, unknown>;
    article: Record<string, unknown>;
    h2: Record<string, unknown>;
    p: Record<string, unknown>;
  }
}

declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
  export function jsxs(type: unknown, props: unknown, key?: unknown): unknown;
  export const Fragment: unknown;
}
