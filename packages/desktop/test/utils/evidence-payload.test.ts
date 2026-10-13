import { expect, test } from 'vitest';
import { evidencePayload } from '../../src/utils/evidencePayload';

const scope = {
	entityId: 'desktop.page.root',
	commit: 'a'.repeat(40),
	branch: 'main',
	mode: 'current'
};

test('an evidence read keeps its scope; only an artifact read adds a capture binding', () => {
	expect(evidencePayload('evidence:read', { ...scope, side: 'after' })).toEqual(scope);
	expect(() => evidencePayload('evidence:artifact', scope)).toThrow();
	expect(() => evidencePayload('evidence:read', { ...scope, mode: 'both' })).toThrow(
		'Invalid option.'
	);
});
