import type { Data } from './illustratedData.types';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let sealed: { home: string; data: Data } | undefined;

/** Read the same immutable fixture bytes embedded by the catalog build; never render them again. */
export function catalogFixtureMedia(home: string): Data {
	if (sealed?.home !== home) {
		const data = JSON.parse(readFileSync(join(home, 'catalog/preview-data.json'), 'utf8')) as Data;
		verifyCatalogFixtureMedia(data);
		sealed = { home, data };
	}
	return sealed!.data;
}

/** Admit every stored byte and every capture binding before any preview is recorded. */
export function verifyCatalogFixtureMedia(data: Data): void {
	for (const [hash, media] of Object.entries(data.bytes)) {
		if (createHash('sha256').update(Buffer.from(media.data)).digest('hex') !== hash)
			throw new Error(`Fixture media hash mismatch: ${hash}`);
	}
	for (const hash of Object.values(data.bindings)) {
		if (!data.bytes[hash]) throw new Error(`Fixture media unavailable: ${hash}`);
	}
}
