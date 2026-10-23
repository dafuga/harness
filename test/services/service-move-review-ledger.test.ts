import type { ReviewedFile } from './service-move-review-ledger.test.types';
import { expect, test } from 'vitest';
import migration from '../../specification/loops/shared-service-ownership/migration.json';

test('history catalog changes have committed service-move review entries', () => {
	const files = migration.files as ReviewedFile[];
	const gaps: string[] = [];
	for (const unit of ['workflow.build-history', 'service.history-index']) {
		const file = files.find((entry) => entry.unit === unit);
		if (!file?.review) {
			gaps.push(`${unit}: committed review is missing`);
			continue;
		}
		if (!/^[a-f0-9]{40}$/.test(file.review.commit))
			gaps.push(`${unit}: review commit is incomplete`);
		if (file.review.path !== file.to || file.review.definition !== file.definition)
			gaps.push(`${unit}: review does not identify the current definition`);
		if (!file.review.reason.trim()) gaps.push(`${unit}: review reason is missing`);
	}
	expect(gaps).toEqual([]);
});
