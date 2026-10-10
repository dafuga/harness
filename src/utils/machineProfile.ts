import { createHash } from 'node:crypto';
import { arch, cpus, platform, totalmem } from 'node:os';
import type { VerificationProfile } from '../core/verificationTypes';

/** Hardware and runtime a measurement was taken on; measurements compare only within one. */
export function machineProfile(): VerificationProfile {
	const processors = cpus();
	const versions = process.versions as Record<string, string | undefined>;
	const facts = {
		platform: platform(),
		arch: arch(),
		cpu: processors[0]?.model.trim() ?? 'unknown',
		cores: processors.length || 1,
		memoryBytes: totalmem(),
		runtime: versions.bun ? `bun ${versions.bun}` : `node ${versions.node}`
	};
	const id = createHash('sha256').update(JSON.stringify(facts)).digest('hex').slice(0, 16);
	return { id, ...facts };
}
