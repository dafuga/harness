import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The Project Overview reads synthetic snapshots. Its Explorer link needs only an empty history. */
export function seedProjectOverview(consoleHome: string): void {
	const data = join(consoleHome, 'data');
	mkdirSync(data, { recursive: true });
	writeFileSync(join(consoleHome, 'meta.json'), '{}');
	writeFileSync(
		join(data, 'index.json'),
		JSON.stringify({
			branches: [],
			revisions: [],
			units: [],
			benchmarks: [],
			profiles: [],
			legacy: [],
			truncated: false,
			problems: []
		})
	);
	writeFileSync(
		join(data, 'activity.json'),
		JSON.stringify({ repository: { name: 'Synthetic Harness' } })
	);
}
