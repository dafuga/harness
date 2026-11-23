import type { Index } from './repository.catalog.test.types';

export const HEAD = '8c41e2f09a7b3d56c1e4f80a29b7d3e61c5a0f42';

export const BASE = '3f0b7d19e6a2c48b5d0e91f7a3c6b2d8e4f51a09';

const RECORD_ID = '9d4f0c2a7e1b83f56a0d9c4e2b7a1f38c5e60d7b2a94f1c8e3d5b6a7f0e1c2d9';

const PROFILE = '5e0a7c19b3d24f86';

export const INDEX = {
	schemaVersion: 1,
	refs: {},
	branches: [{ name: 'main', head: HEAD }],
	revisions: [
		{
			commit: HEAD,
			tree: 'd4a09c7e3b18f2a6c5e0d9b47a1f83e26c0d5b91',
			parents: [BASE],
			subject: 'Index catalog records by commit',
			author: 'Lena Okafor',
			authoredAt: '2026-11-12T09:38:02+01:00',
			committedAt: '2026-11-12T09:40:55+01:00',
			branches: ['main'],
			retained: false,
			coverage: 'verified',
			gaps: [],
			records: [
				{
					id: RECORD_ID,
					status: 'passed',
					profile: PROFILE,
					finishedAt: '2026-11-12T09:41:17.206Z',
					base: BASE,
					valid: true,
					problems: []
				}
			],
			reasons: 2,
			legacy: [],
			changes: { base: BASE, direct: ['repository.catalog'], added: [], removed: [] },
			detail: `revisions/${HEAD}.json`
		},
		{
			commit: BASE,
			tree: '07e6b2c49f1a8d3e5b0c7a92f4d61e8b3a5c0f27',
			parents: [],
			subject: 'Keep unavailable registries out of the catalog',
			author: 'Tomas Berger',
			authoredAt: '2026-11-11T16:05:31+01:00',
			committedAt: '2026-11-11T16:07:12+01:00',
			branches: ['main'],
			retained: false,
			coverage: 'unverified',
			gaps: ['no verification record is attached to this commit'],
			records: [],
			reasons: 0,
			legacy: [],
			changes: { base: BASE, direct: ['service.catalog-write'], added: [], removed: [] },
			detail: `revisions/${BASE}.json`
		}
	],
	units: [],
	benchmarks: [],
	profiles: [],
	legacy: [],
	truncated: true,
	problems: []
} as unknown as Index;
