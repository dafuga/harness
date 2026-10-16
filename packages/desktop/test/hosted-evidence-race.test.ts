import { expect, test } from 'vitest';
import type { CacheStatus } from '../src/models/ProjectContext.types';
import { asked, captureOf, hubFixture, png } from './hosted-evidence-fixture';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { resolve, promise };
}

test.each(['evidence', 'artifact'] as const)(
	'a principal that changes while the %s is read gets nothing, and nothing stays kept',
	async (operation) => {
		const f = await hubFixture();
		const entering = deferred(),
			holding = deferred();
		const held = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const response = await fetch(input, init);
			if (String(input).includes(`/${operation}?`)) {
				entering.resolve();
				await holding.promise;
			}
			return response;
		}) as typeof fetch;
		try {
			const events: CacheStatus[] = [];
			const adapter = f.adapter(events, held);
			const shot = captureOf(png);
			// The capture is of an answer that was read, so only the change keeps it from being kept.
			if (operation === 'artifact') await adapter.evidence(asked);
			const pending = operation === 'evidence' ? adapter.evidence(asked) : adapter.artifact(shot);
			await entering.promise;
			f.state.principal = 'bob';
			holding.resolve();
			await expect(pending).rejects.toThrow('Hosted authority changed during the read.');
			expect(events.at(-1)).toEqual({ projectId: '$projects', status: 'denied' });
			expect(await f.files()).toEqual([]);
		} finally {
			holding.resolve();
			await f.cleanup();
		}
	}
);
