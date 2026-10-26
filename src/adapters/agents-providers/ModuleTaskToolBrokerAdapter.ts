import {
	readBrokerFile,
	writeBrokerFile
} from '../../helpers/agents-providers/moduleTaskBrokerFiles';
import {
	brokerKind,
	brokerUnitId,
	invokeBrokerCli,
	projectBrokerContract,
	projectBrokerList
} from '../../helpers/agents-providers/moduleTaskBrokerContracts';
import type {
	BrokerFileWrite,
	ModuleTaskToolBrokerAdapterConfig,
	ModuleTaskToolBrokerScope
} from './ModuleTaskToolBrokerAdapter.types';

export class ModuleTaskToolBrokerAdapter {
	private readonly scope?: ModuleTaskToolBrokerScope;
	private readonly config: ModuleTaskToolBrokerAdapterConfig | null;
	constructor(
		scopeOrConfig: ModuleTaskToolBrokerScope | ModuleTaskToolBrokerAdapterConfig | null = {},
		config: ModuleTaskToolBrokerAdapterConfig = {}
	) {
		if (scopeOrConfig === null) {
			this.config = null;
			return;
		}
		if (
			!scopeOrConfig ||
			typeof scopeOrConfig !== 'object' ||
			!config ||
			typeof config !== 'object'
		)
			throw new TypeError('Broker configuration must be an object');
		if ('root' in scopeOrConfig) {
			this.scope = structuredClone(scopeOrConfig);
			this.config = { ...config };
		} else {
			this.config = { ...scopeOrConfig };
		}
	}

	connect(): string {
		if (!this.config) throw new TypeError('Broker configuration must be an object');
		return this.config.name ?? 'module-task-tool-broker';
	}

	private context(): ModuleTaskToolBrokerScope {
		if (!this.scope) throw new Error('Trusted task scope required');
		return this.scope;
	}

	private async invoke(argv: string[]) {
		const scope = this.context();
		const value = this.config?.invokeCli
			? await this.config.invokeCli([...argv])
			: await invokeBrokerCli(scope, argv);
		if (Buffer.byteLength(JSON.stringify(value) ?? '') > 1024 * 1024)
			throw new Error('Contract output exceeds 1 MiB');
		return value;
	}

	async readContract(input: { unitId: string }) {
		const unitId = brokerUnitId(input.unitId);
		return projectBrokerContract(await this.invoke(['units', 'show', unitId, '--json']), unitId);
	}

	async listContracts(input: { kind?: string } = {}) {
		const kind = input.kind === undefined ? undefined : brokerKind(input.kind);
		const argv = ['units', 'list', '--json', ...(kind ? ['--kind', kind] : [])];
		return projectBrokerList(await this.invoke(argv), kind);
	}

	readAssigned(input: { path: string }) {
		return readBrokerFile(this.context(), input.path);
	}
	writeAssigned(input: BrokerFileWrite) {
		return writeBrokerFile(this.context(), input);
	}
}

export type {
	ModuleTaskToolBrokerAdapterConfig,
	ModuleTaskToolBrokerScope
} from './ModuleTaskToolBrokerAdapter.types';
