import { pathToFileURL } from 'node:url';
import {
	defaultRuntimeTimeoutMs,
	runtimeFailure,
	type RuntimeHandler,
	type RuntimeOptions,
	type RuntimeRequest,
	type RuntimeResponse,
	type UnitRuntime
} from '../core/runtimeTypes';
import { notPortable, portableJson } from '../utils/portableJson';
import { runtimeDeadline, runtimeResponse } from '../utils/runtimeResponse';

/** Runs a unit in this process by calling an exported handler function. */
export class ModuleRuntimeAdapter implements UnitRuntime {
	readonly kind = 'module' as const;
	private readonly timeoutMs: number;

	constructor(
		private readonly handler: RuntimeHandler,
		options: RuntimeOptions = {}
	) {
		this.timeoutMs = options.timeoutMs ?? defaultRuntimeTimeoutMs;
	}

	/** Loads `handlerName` from a module file the first time the runtime is invoked. */
	static load(
		file: string,
		handlerName: string,
		options: RuntimeOptions & { label?: string } = {}
	): ModuleRuntimeAdapter {
		let loaded: Promise<RuntimeHandler | undefined> | undefined;
		const label = options.label ?? file;
		return new ModuleRuntimeAdapter(async (request) => {
			loaded ??= importHandler(file, handlerName);
			const handler = await loaded;
			if (handler) return handler(request);
			const message = `${label} does not export a function named ${handlerName}`;
			return runtimeFailure('runtime-unavailable', message);
		}, options);
	}

	/** A handler that blocks the thread cannot be interrupted; its late result is rejected. */
	async invoke(request: RuntimeRequest): Promise<RuntimeResponse> {
		if (!portableJson(request)) return notPortable;
		const deadline = runtimeDeadline(this.timeoutMs);
		const result = Promise.resolve()
			.then(() => this.handler(request))
			.then(runtimeResponse, (error: unknown) =>
				runtimeFailure('runtime-failed', error instanceof Error ? error.message : String(error))
			);
		return deadline.settle(await Promise.race([result, deadline.expired]));
	}

	close(): Promise<void> {
		return Promise.resolve();
	}
}

async function importHandler(file: string, name: string): Promise<RuntimeHandler | undefined> {
	try {
		const module = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
		return typeof module[name] === 'function' ? (module[name] as RuntimeHandler) : undefined;
	} catch {
		return undefined;
	}
}
