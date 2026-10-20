import { pathToFileURL } from 'node:url';
import { runtimeFailure, type RuntimeHandler, type RuntimeOptions } from '../core/runtimeTypes';
import { HandlerRuntimeAdapter } from '../../packages/reports/src/components/harness/harness-compare/HandlerRuntimeAdapter';

/** Runs a unit in this process by calling an exported handler function. */
export class ModuleRuntimeAdapter extends HandlerRuntimeAdapter {
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
}

async function importHandler(file: string, name: string): Promise<RuntimeHandler | undefined> {
	try {
		const module = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
		return typeof module[name] === 'function' ? (module[name] as RuntimeHandler) : undefined;
	} catch {
		return undefined;
	}
}
