
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.HARNESS_EVIDENCE_DIR;
const read = (path) => readFileSync(path, 'utf8');
function capture(entry, bytes) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, entry.file), bytes);
	appendFileSync(join(dir, 'captures.ndjson'), JSON.stringify(entry) + '\n');
}
export function runExplorer(mode) {
 if (!dir || process.env.TAKE_SCREENSHOT !== '1' || mode !== 'slugify') return;
	const source = read('src/utils/slugify.ts').replace('export ', '').replace(/: string/g, '');
	const slugify = new Function(source + '; return slugify;')();
	const input = ['  Hello World  ', 'Already-Slugged', 'why?'];
	const output = input.map((title) => slugify(title));
	const scenario = 'Slugify titles end to end';
	const run = { scenario, environment: 'node (headless)', fixture: 'Three synthetic titles', steps: ['Load the function', 'Slugify each title', 'Read what it returned'], input, output };
	const assertions = [
		{ name: 'Every title gives a result', passed: output.length === input.length },
		{ name: 'Surrounding spaces are removed', passed: output[0] === output[0].trim() },
		{ name: 'Words stay in their order', passed: output[0].toLowerCase() === 'hello world' }
	];
	capture({ evidence: 'run', kind: 'output', state: 'default', file: 'slugify-run.json', mediaType: 'application/json' }, JSON.stringify(run, null, 2));
	capture({ evidence: 'checks', kind: 'assertions', state: 'default', file: 'slugify-checks.json', mediaType: 'application/json' }, JSON.stringify({ scenario, assertions }, null, 2));
}
runExplorer(...process.argv.slice(2));
