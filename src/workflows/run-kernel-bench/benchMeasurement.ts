import type { MeasureContext, Value, Artifact } from '../../utils/benchMeasurement';
import { benchMeasurement } from '../../utils/benchMeasurement';
import type { BenchMeasurement } from '../../core/benchmarkTypes';
import type { RuntimeKind } from '../../core/unitTypes';
import type { KernelBuild } from '../../utils/kernelArtifacts';

const separate = 'The reference ships inside the CLI bundle and has no separate artifact.';

const transport = 'HTTP is a transport in front of a served unit; it emits no artifact.';

/** Emitted artifact sizes and owned source sizes, straight from the kernel build record. */
export function sizeMeasurements(context: MeasureContext, build: KernelBuild): BenchMeasurement[] {
	const size = (target: RuntimeKind, metric: string, value: Value, artifacts: Artifact[] = []) =>
		benchMeasurement(context, {
			target,
			metric,
			unitOfMeasure: 'bytes',
			value,
			method: 'Byte size recorded by the kernel build.',
			artifacts
		});
	const file = (path: string, item: { bytes: number; sha256: string }) => [{ path, ...item }];
	return [
		size('module', 'artifact-bytes', { unavailable: separate }),
		size('http', 'artifact-bytes', { unavailable: transport }),
		size('wasm', 'artifact-bytes', build.wasm.bytes, file('impact-kernel.wasm', build.wasm)),
		size('process', 'artifact-bytes', build.native.bytes, file('impact-kernel', build.native)),
		size('module', 'source-bytes', build.sources.reference.bytes, build.sources.reference.files),
		size('wasm', 'source-bytes', build.sources.crate.bytes, build.sources.crate.files),
		size('process', 'source-bytes', build.sources.crate.bytes, build.sources.crate.files)
	];
}
