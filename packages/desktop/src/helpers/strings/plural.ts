// @harness-uid u_5oh2kzpy56
/** @pure */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
