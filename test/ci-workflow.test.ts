import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const verify = readFileSync('.github/workflows/harness-verify.yml', 'utf8');
const publish = readFileSync('.github/workflows/harness-evidence.yml', 'utf8');
const uses = (text: string) => [...text.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]);

test('every external action is pinned to a full commit hash', () => {
	const all = [...uses(verify), ...uses(publish)];
	expect(all.length).toBeGreaterThan(1);
	for (const action of all) expect(action).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
});

test('code under test runs without write credentials', () => {
	expect(verify).toMatch(/^permissions:\n {2}contents: read\n/m);
	expect(verify).not.toMatch(/contents: write|pull_request_target|secrets\./);
	expect(verify).toContain('persist-credentials: false');
	expect(verify).toMatch(/branches-ignore:\n\s+- harness-evidence/);
	expect(verify).toContain('pull_request:');
	expect(verify).toContain('bun run check');
	expect(verify).toContain('refs/harness/module-data:refs/harness/module-data');
	expect(verify).toMatch(/verify run --commit/);
	expect(verify).toMatch(/npm install --global bun@\d+\.\d+\.\d+/);
	expect(verify).toContain('rustup show');
});

test('publication is a separate trusted workflow that never runs the tested code', () => {
	expect(publish).toMatch(/workflow_run:\n\s+workflows: \[Harness verify\]/);
	expect(publish).not.toMatch(/pull_request|verify run|bun run check|bun run build|bun test/);
	expect(publish).toMatch(/permissions:\n {2}contents: read\n/);
	expect(publish).toMatch(/\n {4}permissions:\n {6}actions: read\n {6}contents: write\n/);
	expect(publish).toContain('ref: ${{ github.event.repository.default_branch }}');
	expect(publish).toContain(
		'github.event.workflow_run.head_repository.full_name == github.repository'
	);
	expect(publish).toMatch(/history attach --commit .+ --record/);
	expect(publish).toContain('history sync origin');
});

test('no workflow establishes, approves or relaxes a budget', () => {
	for (const text of [verify, publish]) {
		expect(text).not.toMatch(
			/budget (establish|approve)|HARNESS_PROFILE_LABEL|--force|force-with-lease/
		);
	}
});
