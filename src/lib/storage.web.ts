// expo-sqlite needs wasm on web; localStorage is enough for the web preview.
const Storage = {
  getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  removeItem: async (key: string) => globalThis.localStorage?.removeItem(key),
  getItemSync: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItemSync: (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
};

export default Storage;
