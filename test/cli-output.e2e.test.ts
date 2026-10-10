import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { runHarness } from './support/cli';

const root = resolve(import.meta.dirname, '..');

test('JSON larger than a pipe buffer reaches a piped reader whole', async () => {
	const graph = await runHarness(['units', 'graph', '--json'], root);
	expect(graph.stdout.length).toBeGreaterThan(65_536);
	const parsed = JSON.parse(graph.stdout) as { nodes: unknown[] };
	expect(parsed.nodes.length).toBeGreaterThan(100);
	expect(graph.stdout.endsWith('}\n')).toBe(true);
}, 60_000);
