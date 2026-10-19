import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export async function projectionCacheDiscard(directory: string, scope: string) {
	const lookup = join(directory, `lookup-${digest(scope)}.json`);
	const entry = await readFile(lookup, 'utf8')
		.then((text) => JSON.parse(text))
		.catch(() => null);
	if (entry?.identity)
		await unlink(
			join(
				directory,
				`projection-${digest(JSON.stringify(Object.entries(entry.identity).sort(([a], [b]) => a.localeCompare(b))))}.json`
			)
		).catch(() => undefined);
	await unlink(lookup).catch(() => undefined);
}
