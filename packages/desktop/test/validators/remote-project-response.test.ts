import { test, expect } from 'vitest';
import { RemoteProjectResponseValidator } from '../../src/validators/RemoteProjectResponseValidator';
test('server responses cannot relabel another project or signed-in principal', () => {
	const validator = new RemoteProjectResponseValidator();
	expect(() =>
		validator.actor({ actor: { id: 'another', emailVerified: true } }, 'expected')
	).toThrow('principal');
	expect(() =>
		validator.snapshot(
			{
				project: { id: 'another' },
				revision: { commit: 'a'.repeat(40) },
				entities: [],
				branches: [],
				commits: []
			},
			'expected'
		)
	).toThrow('snapshot');
	expect(() =>
		validator.entity({ id: 'another', sources: [], versions: [], threads: [] }, 'expected')
	).toThrow('entity');
});
