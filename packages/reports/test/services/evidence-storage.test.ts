import { expect, test } from 'vitest';
import { EvidenceStorageService } from '../../src/services/EvidenceStorageService';
import type { Report } from '../../src/models/Report.types';

test('metadata-only updates never need a Cloudflare connection', async () => {
	await expect(
		new EvidenceStorageService().store({ evidence: [] } as unknown as Report, '/nonexistent')
	).resolves.toBeUndefined();
});
