// @harness-uid u_ohctlckx5a
/** @pure */
export const plural = (count: number, word: string): string =>
	`${count} ${word}${count === 1 ? '' : 's'}`;
