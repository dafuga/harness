import type { Step } from './repository.analytics.test.types';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_PATH = fileURLToPath(
	new URL('../../src/repositories/reports-media/AnalyticsRepository.ts', import.meta.url)
);

export function meta(symbol: string, state: string) {
	return {
		unitId: 'repository.analytics',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function childScript(): string {
	return `const { AnalyticsRepository } = await import(${JSON.stringify(REPOSITORY_PATH)});
const { Database } = await import('bun:sqlite');
const steps = JSON.parse(process.argv[2]);
let repo;
function sql(step) {
  const db = new Database(step.home + "/analytics.sqlite");
  try { db.exec(step.sql); } finally { db.close(); }
}
async function run(step) {
  try {
    if (step.op === 'open') repo = await AnalyticsRepository.open(step.home);
    else if (step.op === 'construct') repo = new AnalyticsRepository(step.home, step.options);
    else if (step.op === 'record') repo.record(step.event);
    else if (step.op === 'recordImported') repo.recordImported(step.event);
    else if (step.op === 'events') return repo.events();
    else if (step.op === 'prune') return repo.prune(step.before, step.apply);
    else if (step.op === 'reconcile') await repo.reconcileHistorical(step.root, step.project);
    else if (step.op === 'close') repo.close();
    else if (step.op === 'sql') sql(step);
    return null;
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
}
const results = [];
for (const step of steps) results.push(await run(step));
process.stdout.write(JSON.stringify(results));`;
}

export function runSteps(directory: string, steps: Step[]): unknown[] {
	const script = join(directory, 'steps.mjs');
	writeFileSync(script, childScript());
	const run = spawnSync('bun', [script, JSON.stringify(steps)], {
		encoding: 'utf8',
		timeout: 15_000
	});
	if (run.status !== 0)
		throw new Error(`bun step runner exited with ${run.status}: ${run.stderr.slice(-800)}`);
	return JSON.parse(run.stdout) as unknown[];
}

export function errorOf(error: Error): { error: { name: string; message: string } } {
	return { error: { name: error.name, message: error.message } };
}
