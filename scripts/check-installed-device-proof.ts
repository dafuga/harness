// @harness-uid u_qxvhfl3o2e
import { z } from 'zod';

const text = z.string().trim().min(1);
const surfacePlan = z.object({
	entryState: text,
	expectedBuild: text,
	approvalHost: text.nullable(),
	firstAction: text,
	authoritativeSource: text,
	expectedResult: text,
	owner: text
});
const observation = z.discriminatedUnion('status', [
	z.object({ status: z.literal('blocked'), missingHop: text, observations: text }),
	z.object({
		status: z.literal('passed'),
		device: text,
		target: z.literal('physical-device'),
		installedBuild: text,
		signature: z.literal('verified'),
		setup: z.literal('supported-from-entry-state'),
		googleReturn: z.literal('real'),
		approvedOn: text.nullable(),
		action: z.object({ via: z.literal('installed-app'), evidence: text }),
		readback: z.object({ source: text, result: text, evidence: text }),
		cleanup: text
	})
]);
const envelope = z.object({ schemaVersion: z.literal(1), releaseBoundary: text });
const record = envelope.extend({ surfaces: z.record(text, z.unknown()) });
const surface = surfacePlan.extend({ proof: observation }).superRefine((row, ctx) => {
	if (row.proof.status !== 'passed') return;
	const matches = [
		['installedBuild', row.proof.installedBuild, row.expectedBuild],
		['approvedOn', row.proof.approvedOn, row.approvalHost],
		['readback.source', row.proof.readback.source, row.authoritativeSource],
		['readback.result', row.proof.readback.result, row.expectedResult]
	] as const;
	for (const [field, observed, expected] of matches) {
		if (observed !== expected) {
			ctx.addIssue({
				code: 'custom',
				path: ['proof', ...field.split('.')],
				message: 'Does not match the reviewed plan'
			});
		}
	}
});

/** Check every required surface against the independently supplied release scope. */
export function installedDeviceProofBlockers(
	input: unknown,
	releaseBoundary: string,
	expectedSurfaces: string[]
): string[] {
	if (
		!releaseBoundary.trim() ||
		!expectedSurfaces.length ||
		expectedSurfaces.some((name) => !name.trim())
	) {
		return ['Supply the release boundary and all expected surfaces from the reviewed scope'];
	}
	const parsed = record.safeParse(input);
	if (!parsed.success) return ['Expected an installed-device proof record with schemaVersion 1'];
	if (parsed.data.releaseBoundary !== releaseBoundary)
		return ['Record is for a different release boundary'];
	return [...new Set(expectedSurfaces)].flatMap((name) => {
		if (!Object.hasOwn(parsed.data.surfaces, name)) return [`${name}: missing surface proof`];
		const row = surface.safeParse(parsed.data.surfaces[name]);
		if (!row.success) {
			return row.error.issues.map(({ path, message }) => `${name}: ${path.join('.')} — ${message}`);
		}
		return row.data.proof.status === 'blocked' ? [`${name}: ${row.data.proof.missingHop}`] : [];
	});
}

async function main([file, releaseBoundary, ...surfaces]: string[]): Promise<void> {
	if (!file || !releaseBoundary || !surfaces.length) {
		console.error(
			'Usage: bun scripts/check-installed-device-proof.ts <record.json> <release-boundary> <surface>...'
		);
		process.exitCode = 2;
		return;
	}
	let input: unknown;
	try {
		input = await Bun.file(file).json();
	} catch {
		console.error('Could not read the installed-device proof JSON');
		process.exitCode = 2;
		return;
	}
	const blockers = installedDeviceProofBlockers(input, releaseBoundary, surfaces);
	if (blockers.length) {
		console.error(['Installed-device acceptance pending', ...blockers].join('\n'));
		process.exitCode = 1;
		return;
	}
	console.log(`Record complete for ${surfaces.join(', ')} at ${releaseBoundary}`);
}

if (import.meta.main) await main(process.argv.slice(2));
