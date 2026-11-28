import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import type { ModuleTaskInput } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import { expect } from '../../verificationExpect';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';

test('worker prompt gives a compact Harness-only repository brief', async () => {
	const fixture = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(fixture.root);
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		const input = JSON.parse(await readFile(await fixture.input(), 'utf8')) as ModuleTaskInput;
		await service.add(input);
		const prompt = await service.prompt(input.id);
		const brief = prompt.split('\n')[2] ?? '';

		expect(brief.length).toBeLessThanOrEqual(1500);
		expect(brief).toContain('Edit only the allowed task files in this prompt');
		expect(brief).toContain('never edit specification/units/; contracts are read-only');
		expect(brief).toContain('Do not delegate, commit, push, deploy or access credentials');
		expect(brief).toContain("repository's line and naming limits");
		expect(brief).toContain("repository's test and lint commands");
		expect(brief).toContain('Report verification performed and remaining gaps');
		expect(brief).toContain('root AGENTS.md');
		expect(brief).toContain(
			'Your only channel is Harness: put questions, blockers and contract doubts in your final message; do not contact anyone or any other service.'
		);
		expect(brief).not.toContain('Follow AGENTS.md');
		expect(prompt).toContain('use the `mock-mode` skill');
		expect(prompt).toContain('an automated test proving zero paid calls in mock mode');
	} finally {
		await fixture.dispose();
	}
});
