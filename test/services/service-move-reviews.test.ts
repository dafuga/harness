import { expect, test } from 'vitest';
import migration from '../../specification/loops/shared-service-ownership/migration.json';
import { relocatedSource } from '../support/memoryTree';
import { serviceMoveReviews } from '../support/serviceMoveReviews';

test('changed service definitions require committed review evidence', () => {
	const file = migration.files.find((entry) => entry.unit === 'workflow.build-history');
	expect(file).toBeDefined();
	if (!file) return;

	const gaps = serviceMoveReviews({
		originalProof: migration.originalProof,
		moves: migration.moves,
		files: [{ from: file.from, to: file.to, definition: relocatedSource(file.to, migration.moves) }]
	});

	expect(gaps).toContain(`${file.to}: changed definition lacks a committed review`);
});
