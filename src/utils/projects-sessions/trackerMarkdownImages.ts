// @harness-uid u_vfo44tzfa2
const markdownImage = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*)?\)/g;
const htmlImage = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
const imageType: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml'
};

/** @pure Every image source the markdown names, once each, outside fenced code. */
export function trackerMarkdownImages(markdown: string): string[] {
	const prose = markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
	const found = [markdownImage, htmlImage].flatMap((pattern) =>
		[...prose.matchAll(pattern)].map((match) => match[1])
	);
	return [...new Set(found)];
}

/**
 * @pure Where a relative image lives in the repository, with its media type. Web addresses,
 * paths that leave the repository and other file types are null.
 */
export function trackerRepositoryImage(
	documentPath: string,
	source: string
): { path: string; type: string } | null {
	if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(source)) return null;
	const base = new URL(documentPath.split('/').map(encodeURIComponent).join('/'), 'repo:/root/');
	const target = new URL(source.split(/[?#]/)[0], base);
	if (!target.pathname.startsWith('/root/')) return null;
	const path = decodeURIComponent(target.pathname.slice('/root/'.length));
	const type = imageType[path.split('.').at(-1)?.toLowerCase() ?? ''];
	return type ? { path, type } : null;
}
