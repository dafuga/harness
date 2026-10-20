import { expect, test } from 'vitest';
import { cloudflareSafety } from '../../src/utils/cloudflareSafety';
import type { CloudflareTarget } from '../../src/models/Deployment.types';
const target = {
	kind: 'workers',
	environment: 'stage',
	wranglerEnvironment: 'stage'
} as CloudflareTarget;
test('a distinct Worker name never makes inherited production routing safe', () => {
	expect(() =>
		cloudflareSafety(
			{ routes: ['example.com/*'], env: { stage: { name: 'stage-only' } } },
			{ stage: target }
		)
	).toThrow(/production route/);
	expect(() =>
		cloudflareSafety(
			{ routes: ['example.com/*'], env: { stage: { routes: ['stage.example.com/*'] } } },
			{ stage: target }
		)
	).not.toThrow();
	expect(() =>
		cloudflareSafety({ env: { stage: { routes: ['*.example.com/*'] } } }, { stage: target })
	).toThrow(/production route/);
});
