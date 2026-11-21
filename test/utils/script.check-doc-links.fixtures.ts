const doc = (...lines: string[]) => lines.join('\n');
export const readme = doc(
	'# Demo',
	'',
	'See [the guide](docs/guide.md#setup-steps) and [home](#demo).',
	'Inline `[not a link](nowhere.md)` stays as written.',
	'```md',
	'[fenced](fenced.md)',
	'```',
	'Read [the boundaries](ARCHITECTURE-BOUNDARIES.md "Owners") or [the site](https://example.com).'
);
export const onlyInCode = doc('Run `[x](y.md)` here:', '```md', '[z](w.md)', '```');
export const boundaries = doc(
	'# Architecture Boundaries',
	'',
	'| Owner | File |',
	'| --- | --- |',
	'| Files | `src/core/files.ts` and `scripts/check-doc-links.ts` |',
	'| Notes | docs/plain.md and `README.md` are not repository paths |'
);
export const pathNotes = doc(
	'Run the check on `packages/reports/src/index.ts` and `test/examples/x.test.ts`.',
	'`src/no-extension` is not a file path.',
	'```ts',
	'`src/inside/fence.ts`',
	'```'
);
export const guide = doc(
	'# Setup',
	'## Setup',
	'## Setup ##',
	'### Run `files` & check: Café!',
	'#hashtag is not a heading',
	'```md',
	'# Inside a fence',
	'```'
);
export const prose = doc(
	'Just prose with a `# not a heading` code span.',
	'```',
	'# fenced',
	'```'
);
export const resolvingProject = {
	'README.md': doc(
		'# Demo',
		'See [the guide](docs/guide.md#setup-steps) and [the boundaries](ARCHITECTURE-BOUNDARIES.md#owners).',
		'Back to [home](#demo). The [site](https://example.com) is never fetched.'
	),
	'docs/guide.md': doc('# Guide', '## Setup steps', 'Back to [the readme](../README.md#demo).'),
	'ARCHITECTURE-BOUNDARIES.md': doc('# Boundaries', '## Owners', 'See `src/core/files.ts`.'),
	'src/core/files.ts': 'export {};'
};
export const brokenProject = {
	'README.md': doc(
		'# Demo',
		'Read [the missing page](docs/missing.md) and [the guide](docs/guide.md#no-such-heading).',
		'Outside the repository: [secret](../secret.md). External: [site](https://example.com).'
	),
	'docs/guide.md': doc(
		'# Guide',
		'## Setup steps',
		'Back to [the readme](../README.md#missing-anchor).'
	),
	'ARCHITECTURE-BOUNDARIES.md': doc(
		'# Boundaries',
		'Owners: `src/core/files.ts` and `src/missing/owner.ts`.'
	),
	'src/core/files.ts': 'export {};'
};
export const missingProject = {
	'README.md': doc('# Demo', 'Owners are in [the boundaries](ARCHITECTURE-BOUNDARIES.md).')
};
