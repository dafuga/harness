import type { ReviewSnapshot } from '../../src/audit/verification-evidence/cleanCodeSnapshot.types';

export const key = '8b7f5247e2937405454a84258cbe9bdcdb83604e7892f0ddc46618814d0ace78';

export const target = {
	path: 'src/audit/development-tooling/cleanCodeCache.ts',
	contents: 'export const enabled = true;\n',
	hash: 'db1242f0e836edaa9533cb367264cc3624520f3576b72d407ed0d1677545c26a'
};

export const snapshot: ReviewSnapshot = {
	target,
	inputs: [target],
	contextHash: '40be9bbee81c0ccae949dc2586d0b3764f61e60f4e0580a2901fe83f37976248',
	state:
		'{"target":{"path":"src/audit/development-tooling/cleanCodeCache.ts","language":".ts","code":"export const enabled = true;\\n"},"related":[],"conventions":[],"omittedContext":[],"auditFindings":[]}',
	contextPaths: [],
	omittedContext: []
};
