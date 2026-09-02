declare module "culori" {
  export function formatHex(color: unknown): string | undefined;
  export function oklch(color: { mode: "oklch"; l: number; c: number; h: number }): unknown;
}
