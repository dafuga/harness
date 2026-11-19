// Source of the packed consumer project that imports the installed tarball.
export const packagedConsumerSource = `
import {
	componentManifestSchema,
	scenarioManifestSchema,
	verificationRecordSchema,
	performanceTolerance,
	ComponentManifestValidator,
	type ComponentManifest,
	type ScenarioManifest,
	type VerificationRecord
} from '@dafuga01/harness/contracts';
import {
	HttpRuntimeAdapter,
	ModuleRuntimeAdapter,
	ProcessRuntimeAdapter,
	WasmRuntimeAdapter,
	UnitRuntimeService,
	RuntimeServerService,
	impactKernel,
	kernelArtifacts,
	type RuntimeRequest,
	type RuntimeResponse,
	type UnitRuntime,
	type ExecutionTarget
} from '@dafuga01/harness/runtime';
import { resourceConfigSchema, resourceRequestSchema, type ResourceRequest } from '@dafuga01/harness/resources';
import * as root from '@dafuga01/harness';
import { consolePolicy, consoleAccess, consoleRoutePath } from '@dafuga01/harness/console';
const sdkPolicy = consolePolicy({ mode: 'loopback', bind: '127.0.0.1' });
const sdkAccess = consoleAccess({ policy: sdkPolicy, data: { json: async () => undefined, media: async () => undefined } });
const sdkRoute: string = consoleRoutePath({ branch: null, commit: 'a', view: 'map' });
void [sdkAccess, sdkRoute];
const resourceRequest: ResourceRequest = resourceRequestSchema.parse({ priority: 'agent-test' });

const request: RuntimeRequest = { operation: 'version' };
const manifest: ComponentManifest = componentManifestSchema.parse(JSON.parse(process.argv[2]));
const scenario: ScenarioManifest | undefined = scenarioManifestSchema.safeParse({}).data;
const record: VerificationRecord | undefined = verificationRecordSchema.safeParse({}).data;
const validator = new ComponentManifestValidator();
const invalid = {
	...manifest,
	contract: { ...manifest.contract, inputs: [{ name: 'unsupported', type: 'unknown', required: true }] }
};
const wasm: ExecutionTarget = { kind: 'wasm', entry: kernelArtifacts().wasm ?? '' };
const service = new UnitRuntimeService(process.cwd());
const served = await new RuntimeServerService().serve(service.forTarget(wasm), { port: 0 });
const runtimes: UnitRuntime[] = [
	new ModuleRuntimeAdapter(impactKernel),
	new WasmRuntimeAdapter(wasm.entry),
	new ProcessRuntimeAdapter({ command: process.argv[3] }),
	new HttpRuntimeAdapter(served.url)
];
const responses: RuntimeResponse[] = [];
for (const runtime of runtimes) responses.push(await runtime.invoke(request));
await Promise.all(runtimes.map((runtime) => runtime.close()));
await served.close();
console.log(JSON.stringify({
	resources: { request: resourceRequest.priority, reserve: resourceConfigSchema.parse({}).cpuReservePercent },
	id: manifest.id,
	errors: validator.validate(manifest, manifest.id + '.json').errors,
	invalidErrors: validator.validate(invalid, manifest.id + '.json').errors,
	scenario: scenario === undefined,
	record: record === undefined,
	tolerance: performanceTolerance,
	kinds: runtimes.map((runtime) => runtime.kind),
	responses,
	rootExports: Object.keys(root).sort(),
	cli: typeof (globalThis as { harnessCliRan?: boolean }).harnessCliRan
}));
`;
