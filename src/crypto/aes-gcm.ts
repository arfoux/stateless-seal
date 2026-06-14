import { getWebCrypto } from "./webcrypto";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toUint8ArrayBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export async function aesGcmEncrypt(params: {
  key: CryptoKey;
  iv: Uint8Array;
  plaintext: Uint8Array;
  aad: Uint8Array;
}): Promise<Uint8Array> {
  const webCrypto = getWebCrypto();
  const encrypted = await webCrypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toUint8ArrayBuffer(params.iv),
      additionalData: toUint8ArrayBuffer(params.aad),
      tagLength: 128
    },
    params.key,
    toArrayBuffer(params.plaintext)
  );

  return new Uint8Array(encrypted);
}

export async function aesGcmDecrypt(params: {
  key: CryptoKey;
  iv: Uint8Array;
  ciphertext: Uint8Array;
  aad: Uint8Array;
}): Promise<Uint8Array> {
  const webCrypto = getWebCrypto();
  const decrypted = await webCrypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toUint8ArrayBuffer(params.iv),
      additionalData: toUint8ArrayBuffer(params.aad),
      tagLength: 128
    },
    params.key,
    toArrayBuffer(params.ciphertext)
  );

  return new Uint8Array(decrypted);
}
