import { resolve } from 'node:path';
import { HttpRuntimeAdapter } from '../adapters/HttpRuntimeAdapter';
import { ModuleRuntimeAdapter } from '../adapters/ModuleRuntimeAdapter';
import { ProcessRuntimeAdapter } from '../adapters/ProcessRuntimeAdapter';
import { WasmRuntimeAdapter } from '../adapters/WasmRuntimeAdapter';
import { representativeWorkload } from '../core/benchmarkTypes';
import { fail } from '../core/errors';
import type { RuntimeOptions, UnitRuntime } from '../core/runtimeTypes';
import type { ComponentManifest, ExecutionTarget, RuntimeKind } from '../core/unitTypes';
import { MeasurementRepository } from '../repositories/MeasurementRepository';
import { chooseRuntime, type RuntimeChoice } from '../utils/chooseRuntime';
import { impactKernelPortable } from '../utils/impactKernel';
import { kernelArtifacts, type Environment } from '../utils/kernelArtifacts';
import { machineProfile } from '../utils/machineProfile';

export interface RuntimeServiceOptions extends RuntimeOptions {
	env?: Environment;
}

/** Turns declared execution targets into working runtimes behind the one typed contract. */
export class UnitRuntimeService {
	private readonly env: Environment;

	constructor(
		private readonly root = process.cwd(),
		private readonly options: RuntimeServiceOptions = {}
	) {
		this.env = options.env ?? process.env;
	}

	forTarget(target: ExecutionTarget): UnitRuntime {
		const { timeoutMs } = this.options;
		if (target.kind === 'http') return new HttpRuntimeAdapter(target.entry, { timeoutMs });
		if (target.kind === 'wasm') {
			return new WasmRuntimeAdapter(resolve(this.root, target.entry), { timeoutMs });
		}
		if (target.kind === 'process') {
			const command = target.entry.includes('/') ? resolve(this.root, target.entry) : target.entry;
			return new ProcessRuntimeAdapter({ command, timeoutMs });
		}
		const file = resolve(this.root, target.entry);
		const label = target.entry;
		return ModuleRuntimeAdapter.load(file, target.handler ?? 'invoke', { timeoutMs, label });
	}

	/** Selects the unit's default target, or the declared target of the requested kind. */
	forUnit(manifest: ComponentManifest, kind: RuntimeKind = manifest.runtime.kind): UnitRuntime {
		const target = manifest.runtime.targets.find((candidate) => candidate.kind === kind);
		if (target) return this.forTarget(target);
		return fail(`${manifest.id} does not declare a ${kind} execution target`);
	}

	/** The default for this machine, chosen from recorded measurements. */
	kernelDefault(): RuntimeChoice {
		const profile = machineProfile().id;
		const recorded = new MeasurementRepository(this.root).forProfile(profile);
		const measurements = recorded?.measurements ?? [];
		return chooseRuntime({ measurements, workload: representativeWorkload, profile });
	}

	/** An impact kernel runtime: the measured default unless one is requested. */
	kernel(kind: RuntimeKind | 'default' = 'default'): UnitRuntime {
		const resolved = kind === 'default' ? this.kernelDefault().runtime : kind;
		// The adapter has already refused a request that is not portable, so the kernel need not.
		if (resolved === 'module') return new ModuleRuntimeAdapter(impactKernelPortable, this.options);
		const artifacts = kernelArtifacts(this.env);
		if (resolved === 'wasm') {
			return new WasmRuntimeAdapter(artifacts.wasm ?? notBuilt('wasm'), this.options);
		}
		if (resolved === 'process') {
			const command = artifacts.native ?? notBuilt('process');
			return new ProcessRuntimeAdapter({ command, timeoutMs: this.options.timeoutMs });
		}
		const url = this.env.HARNESS_KERNEL_URL;
		if (url) return new HttpRuntimeAdapter(url, this.options);
		return fail(
			'The http runtime needs a served kernel: start harness kernel serve and set HARNESS_KERNEL_URL.'
		);
	}
}

function notBuilt(runtime: string): never {
	return fail(`The ${runtime} runtime is not built; run bun run build:kernel.`);
}
