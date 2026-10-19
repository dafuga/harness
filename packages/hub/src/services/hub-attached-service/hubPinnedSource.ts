

/** A character below space, or delete: nothing a stored path may hold. */
function controlled(path: string): boolean {
	for (let index = 0; index < path.length; index += 1) {
		const code = path.charCodeAt(index);
		if (code <= 0x1f || code === 0x7f) return true;
	}
	return false;
}

/** A repository-relative stored path with no traversal or ambiguous separators. */
export function hubEvidencePath(path: string): boolean {
	return (
		path.length > 0 &&
		!path.includes('\\') &&
		!controlled(path) &&
		path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
	);
}
