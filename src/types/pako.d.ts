declare module 'pako' {
  export function inflate(data: Uint8Array | ArrayBuffer | number[], options?: any): Uint8Array;
  export function deflate(data: Uint8Array | ArrayBuffer | string, options?: any): Uint8Array;
  const pako: {
    inflate: typeof inflate;
    deflate: typeof deflate;
  };
  export default pako;
}
