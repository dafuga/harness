import { expect, test } from 'vitest';
import { preload, runnerCaptures, runnerFixture } from './support/sourceProfileRunners';

test('automatic sampling bounds observer work without replaying or dropping actual calls', async () => {
	const fixture = await runnerFixture(
		'let count=0; export function greet() { return ++count; }',
		'greet',
		'number'
	);
	try {
		await fixture.write(
			'run.ts',
			`import {greet} from './subject';
console.log(JSON.stringify(Array.from({length:100},()=>greet())));`
		);
		const ran = await fixture.run(['bun', '--preload', preload, 'run.ts'], fixture.environment);
		expect(JSON.parse(ran.stdout)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
		const measurements = await runnerCaptures(fixture.directory);
		expect(measurements).toHaveLength(2);
		expect(
			measurements.every((item) => item.samples! <= 10 && item.samples! > 0),
			'automatic observations must be bounded'
		).toBe(true);
		expect(measurements.every((item) => item.workload?.includes('first-10-successes'))).toBe(true);
	} finally {
		await fixture.remove();
	}
}, 30_000);

test('failed async samples release their slots and quota calls retain original results', async () => {
	const fixture = await runnerFixture(
		`let calls=0;
export async function greet(fail: boolean) { const value=++calls; await Promise.resolve(); if(fail)throw new Error('original failure'); return value; }`,
		'greet',
		'Promise<number>'
	);
	try {
		await fixture.write(
			'run.ts',
			`import {greet} from './subject';
const failed=await Promise.allSettled(Array.from({length:10},()=>greet(true)));
const values=await Promise.all(Array.from({length:30},()=>greet(false)));
console.log(JSON.stringify({errors:failed.map(x=>x.reason.message),values}));`
		);
		const ran = await fixture.run(['bun', '--preload', preload, 'run.ts'], fixture.environment);
		expect(JSON.parse(ran.stdout)).toEqual({
			errors: Array(10).fill('original failure'),
			values: Array.from({ length: 30 }, (_, i) => i + 11)
		});
		const measurements = await runnerCaptures(fixture.directory);
		expect(measurements).toHaveLength(2);
		expect(measurements.every((item) => item.samples === 10)).toBe(true);
	} finally {
		await fixture.remove();
	}
}, 30_000);
