import type { SourceTree } from '../core/sourceTypes';

/** Read in bounded groups so snapshot adapters can batch Git objects without losing path order. */
export async function readTreeTexts(
	tree: Pick<SourceTree, 'read'>,
	paths: string[]
): Promise<string[]> {
	const texts: string[] = [];
	for (let start = 0; start < paths.length; start += 64) {
		texts.push(
			...(await Promise.all(paths.slice(start, start + 64).map((path) => tree.read(path))))
		);
	}
	return texts;
}
