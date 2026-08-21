const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Id corto, ordenable por tiempo y suficiente para un uso personal. */
export function newId(prefix = ''): string {
  const time = Date.now().toString(36);
  let rand = '';
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint8Array(6);
    cryptoObj.getRandomValues(buf);
    for (const b of buf) rand += ALPHABET[b % ALPHABET.length];
  } else {
    for (let i = 0; i < 6; i++) rand += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}${time}${rand}`;
}

export function entryId(habitId: string, date: string): string {
  return `${habitId}:${date}`;
}
