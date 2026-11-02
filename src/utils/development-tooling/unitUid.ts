const annotation = /@harness-uid\s+(u_[a-z2-7]{10})(?![a-z2-7])/;
const head = 1000;

/** @pure The uid a file announces in its first lines, if any. */
export function readUid(code: string): string | undefined {
	return annotation.exec(code.slice(0, head))?.[1];
}

/** @pure The comment line that carries a uid in this kind of file; none when it takes no comment. */
export function uidComment(path: string, uid: string): string | undefined {
	if (/\.svelte$/.test(path)) return `<!-- @harness-uid ${uid} -->`;
	if (/\.(?:[cm]?[jt]sx?)$/.test(path)) return `// @harness-uid ${uid}`;
	if (/\.css$/.test(path)) return `/* @harness-uid ${uid} */`;
	return undefined;
}

/**
 * @pure The source with the uid line added, after a shebang or the leading harness comments of a
 * component. A file that already announces a uid, or takes no comment, is returned as it is.
 */
export function withUid(path: string, code: string, uid: string): string {
	const comment = uidComment(path, uid);
	if (!comment || readUid(code)) return code;
	const lines = code.split('\n');
	let at = lines[0]?.startsWith('#!') ? 1 : 0;
	if (path.endsWith('.svelte')) while (lines[at]?.startsWith('<!-- @harness-')) at += 1;
	lines.splice(at, 0, comment);
	return lines.join('\n');
}
