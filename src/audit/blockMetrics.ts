export function parameterCount(line: string): number {
	const match = line.match(/\(([^)]*)\)/);
	if (!match?.[1].trim()) return 0;
	return match[1].split(',').filter(Boolean).length;
}

export function complexityPoints(line: string): number {
	if (line.includes('return /')) return 0;
	const branchTokens = line.match(/\b(if|for|while|case|catch)\b|\?\s/g);
	return branchTokens?.length ?? 0;
}

export function maxDepth(lines: string[]): number {
	let depth = 0;
	let maximum = 0;

	for (const line of lines) {
		if (startsControlBlock(line)) {
			depth += 1;
			maximum = Math.max(maximum, depth);
		}

		if (line.includes('}')) {
			depth = Math.max(0, depth - count(line, '}'));
		}
	}

	return maximum;
}

export function count(value: string, token: string): number {
	return value.split(token).length - 1;
}

export function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function startsControlBlock(line: string): boolean {
	return /\b(if|for|while|switch|catch)\b.*\{/.test(line);
}
