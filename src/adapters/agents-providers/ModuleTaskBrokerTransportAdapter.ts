import {
	executeBrokerTask,
	qualifiedBindings,
	snapshotTaskInput,
	throwIfCancelled
} from './module-task-broker-transport-adapter/brokerTaskExecution';
import type {
	ModuleTaskBrokerTransportAdapterConfig,
	TaskRunInput,
	TaskRunResult
} from './ModuleTaskBrokerTransportAdapter.types';

export class ModuleTaskBrokerTransportAdapter {
	constructor(private readonly config: ModuleTaskBrokerTransportAdapterConfig = {}) {}

	async ready(): Promise<void> {
		const bindings = qualifiedBindings(this.config);
		if (!bindings) throw new Error('Broker transport is unqualified');
		await bindings.ready();
	}

	async run(input: TaskRunInput): Promise<TaskRunResult> {
		const snapshot = snapshotTaskInput(input);
		if (!snapshot) throw new Error('Invalid broker task input');
		throwIfCancelled(snapshot.signal);
		const bindings = qualifiedBindings(this.config);
		if (!bindings) throw new Error('Broker transport is unqualified');
		return executeBrokerTask(snapshot, bindings);
	}
}
