export function createMap() {
  return Object.create(null);
}

export function die(message: string): never {
  throw new Error(message);
}
