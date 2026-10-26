import { expect } from '../../verificationExpect';
import type { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';

export async function assertPersistedDependencies(
	service: ModuleTaskService,
	input: Record<string, unknown>
) {
	const dependsOn = ['orders-design', 'orders-contract'];
	const definition = { ...input, dependsOn };
	const added = await service.add(definition);
	const id = added.task.id;
	const shown = await service.show(id);
	const listed = await service.list();
	expect([
		added.task.dependsOn,
		shown.task.dependsOn,
		listed.tasks.find((task) => task.id === id)?.dependsOn
	]).toEqual([dependsOn, dependsOn, dependsOn]);
	expect([shown.commit, listed.commit]).toEqual([added.commit, added.commit]);
	const before = await service.repository.read();
	await expect(
		service.add({ ...definition, dependsOn: ['different-prerequisite'] })
	).rejects.toThrow('already exists');
	expect(await service.repository.read()).toEqual(before);
	expect((await service.show(id)).task.dependsOn).toEqual(dependsOn);
	return added;
}
