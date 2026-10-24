import { expect, test } from 'vitest';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { readFile } from 'node:fs/promises';
import { taskSelection } from '../../../src/services/agents-providers/module-task-service/taskPrompt';
test('admission rejects missing contracts, unknown modules and mutable task identities', async () => {
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root);
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		const input = JSON.parse(await readFile(await f.input(), 'utf8'));
		await expect(service.add({ ...input, wantedContract: undefined })).rejects.toThrow(
			'wantedContract'
		);
		await expect(service.add({ ...input, module: 'service.missing' })).rejects.toThrow(
			'active and registered'
		);
		await service.add(input);
		await expect(service.add(input)).rejects.toThrow('already exists');
		await expect(
			service.feature({ id: 'checkout', goal: 'Changed goal', tldr: 'Changed context' })
		).rejects.toThrow('immutable');
		expect((await service.show(input.id)).task.wantedContract).toEqual(input.wantedContract);
		expect(
			(await service.prompt(input.id)).startsWith(
				'Overall goal: Reliable checkout\nFeature TLDR: Build validated orders.\n'
			)
		).toBe(true);
	} finally {
		await f.dispose();
	}
});
test('auto owns model and intelligence, while exact model choices retain their effort', () => {
	expect(taskSelection({ model: 'auto' })).toEqual({
		provider: 'claude',
		model: 'claude-haiku-5-5',
		intelligence: 'medium'
	});
	expect(taskSelection({ model: 'gpt-6-luna', intelligence: 'max' })).toEqual({
		provider: 'codex',
		model: 'gpt-6-luna',
		intelligence: 'max'
	});
	expect(() => taskSelection({ model: 'auto', intelligence: 'high' })).toThrow('explicit model');
	expect(() => taskSelection({ model: 'claude-haiku-5-5', intelligence: 'ultra' })).toThrow(
		'does not support'
	);
});
