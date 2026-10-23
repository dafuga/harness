import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityReasons from '../../src/components/explorer-ui/entity-reasons/EntityReasons.svelte';
import type { HarnessExplanation } from '../../src/models/Harness.types';
import { entityReasons } from '../../src/utils/entityReasons';
import { disclosed, words } from '../entityRender';

const tried = 'Registration only; implementation unchanged.';
const reason = (symbol: string, outcome = 'not-applicable'): HarnessExplanation => ({
	unit: 'app.function.cpu-client',
	symbol,
	file: 'src/utils/cpuClient.ts',
	change: 'modified',
	behavior: `${symbol} reads one sample.`,
	simplification: { attempt: tried, outcome },
	performance: { attempt: tried, outcome: 'not-applicable' }
});
const shown = (reasons: HarnessExplanation[], open = false) =>
	render(EntityReasons, { props: { reasons: entityReasons(reasons), open, id: 'full' } }).body;

test('a summary that says everything has nothing to open beside it', () => {
	expect(shown([reason('cpuSample')])).not.toContain('<details');
	expect(shown([])).not.toContain('<details');
});

test('the reasons of several functions are a closed disclosure that names what it holds', () => {
	const body = shown([reason('cpuSample'), reason('cpuClient', 'improved')]);
	expect(body).toMatch(/<details class="ex-full" id="full">/);
	// Closed, only its summary is read; a keyboard opens it as it opens any disclosure.
	expect(words(body).trim()).toBe('Full reasons 2 notes, 1 attempt');
	expect(disclosed(body)).toContain('cpuSample reads one sample. cpu sample');
	expect(disclosed(body)).toContain('cpuClient reads one sample. cpu client');
	// The attempt both share is written once, with the outcome it had for each of them.
	expect(disclosed(body).split(tried).length - 1).toBe(1);
	expect(disclosed(body)).toContain('simplification, not applicable · cpu sample');
	expect(disclosed(body)).toContain('simplification, improved · cpu client');
	expect(disclosed(body)).toContain('performance, not applicable · cpu sample, cpu client');
	expect(body).not.toContain('src/utils');
});

test('it is drawn open when the reader asked for the full reasons', () => {
	const body = shown([reason('cpuSample'), reason('cpuClient')], true);
	expect(body).toMatch(/<details class="ex-full" id="full" open(="")?>/);
	expect(words(body)).toContain('cpuClient reads one sample.');
});
