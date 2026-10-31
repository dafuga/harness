import { expect } from '@playwright/test';
import { catalogFixtureMedia, verifyCatalogFixtureMedia } from './catalogFixtureMedia';

/** The normal catalog admission case proves that bad bytes cannot enter any preview state. */
export function assertCatalogFixtureMedia(home: string): void {
	const data = catalogFixtureMedia(home);
	const hash = Object.values(data.bindings)[0];
	const corrupted = structuredClone(data);
	corrupted.bytes[hash].data[0] ^= 1;
	expect(() => verifyCatalogFixtureMedia(corrupted)).toThrow('Fixture media hash mismatch');
	const missing = structuredClone(data);
	delete missing.bytes[hash];
	expect(() => verifyCatalogFixtureMedia(missing)).toThrow('Fixture media unavailable');
}
