const ENCODER = new TextEncoder();

function writeVec(bytes) {
  const result = new Uint8Array(8 + bytes.length);
  const view = new DataView(result.buffer);
  view.setBigUint64(0, BigInt(bytes.length), true);
  result.set(bytes, 8);
  return result;
}

function concat(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

export default async function initAntlerCoreShim() {
  return;
}

export function generate_session_key() {
  const publicKey = crypto.getRandomValues(new Uint8Array(32));
  const privateKey = crypto.getRandomValues(new Uint8Array(64));
  return concat([writeVec(publicKey), writeVec(privateKey)]);
}

export function sign_with_session_key(privateKey, context) {
  const privateBytes =
    privateKey instanceof Uint8Array
      ? privateKey
      : new Uint8Array(privateKey ?? []);
  const contextBytes =
    context instanceof Uint8Array
      ? context
      : new Uint8Array(context ?? []);
  const seed = concat([privateBytes, contextBytes, ENCODER.encode("antler")]);
  const signature = new Uint8Array(64);

  for (let index = 0; index < signature.length; index += 1) {
    const value = seed[index % seed.length] ?? 0;
    signature[index] = (value + index * 17) % 256;
  }

  return signature;
}
