import type { Page } from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeCapture } from '../tests/e2e/native-capture';
import type { NativeExpected } from '../tests/e2e/native-readiness';

const calls = vi.hoisted(() => [] as string[]);
const ready = vi.hoisted(() => ({ failure: null as Error | null }));
vi.mock('../tests/e2e/native-readiness', () => ({
	nativeReady: async (_page: unknown, expected: NativeExpected) => {
		calls.push(`ready:${expected.state}`);
		if (ready.failure) throw ready.failure;
	}
}));
vi.mock('../tests/e2e/desktop-evidence', () => ({
	desktopEvidence: async (_page: unknown, state: string) => {
		calls.push(`evidence:${state}`);
	}
}));

/** A page that records what a capture asks of it, in order, and renders nothing. */
function fakePage(): Page {
	const record = (name: string) => async () => void calls.push(name);
	return {
		setViewportSize: record('viewport'),
		locator: () => ({ waitFor: record('wait') }),
		evaluate: record('evaluate'),
		mouse: { move: record('mouse') },
		screenshot: record('screenshot')
	} as unknown as Page;
}
const states: NativeExpected['state'][] = ['draft', 'design', 'approved', 'history'];
const expected = (state: NativeExpected['state']) => ({ state, unitId: 'unit', commit: 'c0ffee' });

afterEach(() => {
	calls.length = 0;
	ready.failure = null;
	vi.unstubAllEnvs();
});
describe('native capture order', () => {
	it.each(states)('proves %s ready before its required evidence', async (state) => {
		vi.stubEnv('TAKE_SCREENSHOT', '');
		await nativeCapture(fakePage(), expected(state));
		expect(calls).toEqual(['viewport', `ready:${state}`, `evidence:${state}`]);
	});
	it('takes the optional screenshot only after readiness and the required evidence', async () => {
		vi.stubEnv('TAKE_SCREENSHOT', 'true');
		await nativeCapture(fakePage(), expected('history'));
		expect(calls.slice(0, 2)).toEqual(['viewport', 'ready:history']);
		expect(calls.indexOf('evidence:history')).toBe(2);
		expect(calls.at(-1)).toBe('screenshot');
	});
	it('records nothing when a state never becomes ready, and keeps its decode error', async () => {
		vi.stubEnv('TAKE_SCREENSHOT', 'true');
		ready.failure = new Error('EncodingError: The source image cannot be decoded.');
		await expect(nativeCapture(fakePage(), expected('approved'))).rejects.toBe(ready.failure);
		expect(calls).toEqual(['viewport', 'ready:approved']);
	});
});
