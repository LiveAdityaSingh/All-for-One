// Small dependency-free id generator so lib/ doesn't need an extra package
// just for random ids.
export function nanoid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
