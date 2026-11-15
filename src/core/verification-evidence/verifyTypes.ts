// @harness-uid u_wwu3xgisul
import type { VerifyConfig } from './verifyTypes.types';
import { z } from 'zod';
import { videoCaptureSchema } from '../../utils/verification-evidence/videoClipSchema';
import { posix } from 'node:path';
import { comparisonSchema } from '../development-tooling/comparisonTypes';
import { runtimeKinds, unitIdPattern } from '../development-tooling/unitTypes';
import { captureRegionSchema } from './verificationTypes';

export const verifyConfigFile = 'harness.verify.json';
/** Scratch store for verification drafts until they are persisted as Git evidence. */
export const verificationsDirectory = '.cache/harness/verifications';
export const snapshotsDirectory = '.cache/harness/snapshots';
export const captureIndex = 'captures.ndjson';

const text = z.string().min(1);
const identifier = z.string().regex(unitIdPattern);
const checkProfileSchema = z.strictObject({
	command: text.optional(),
	timeoutMs: z.number().int().positive().optional()
});
const checkSchema = z.strictObject({
	path: text,
	profile: text.min(1).optional(),
	command: text.optional(),
	timeoutMs: z.number().int().positive().optional()
});

/** How this repository's checks run inside a verification snapshot. */
const verifyConfigInputSchema = z.strictObject({
	schemaVersion: z.literal(1),
	/** New task contracts require profiling even when no performance budget is declared. */
	performanceRequired: z.literal(1).optional(),
	/**
	 * The version of the writing limits this revision is held to: its reasons must be as short
	 * as that version says, 20 words an attempt under 1 and 15 under 2. A revision that declares
	 * none is held to none.
	 */
	writing: z.union([z.literal(1), z.literal(2)]).optional(),
	/**
	 * Commands run in the snapshot before any check, for example a locked install. A step may
	 * name the `builds` it produces; every name must be declared in `builds`.
	 */
	setup: z.array(
		z.strictObject({
			command: text,
			timeoutMs: z.number().int().positive().optional(),
			builds: z.array(text).optional()
		})
	),
	/** Paths shared from the checkout instead of rebuilt, for example node_modules. */
	link: z.array(text),
	/**
	 * Paths setup commands and checks may create inside the snapshot: build output, caches and
	 * reports. A trailing slash names a directory. Everything else must stay exactly as
	 * committed, and a declaration may not cover a tracked file.
	 */
	outputs: z.array(text).default([]),
	/**
	 * Compiled output that setup produces and a server then serves. Its identity is computed in
	 * the snapshot, and evidence that names the build must have been served by exactly it.
	 */
	builds: z.array(z.strictObject({ id: identifier, directory: text })).default([]),
	/**
	 * Tools the checks depend on. Each command runs in the snapshot after setup and the first
	 * line it prints is recorded, so a record says which versions produced it.
	 */
	tools: z.array(z.strictObject({ id: identifier, command: text })).default([]),
	/** Command templates per runner; `{target}` is replaced by the test file. */
	runners: z.record(z.string(), text),
	/**
	 * Test files that need a command of their own, for example another configuration of the
	 * same runner. `path` is the tracked file; the command runs in its workspace. Profiles provide
	 * shared defaults and check-local command/timeout fields override them.
	 */
	profiles: z.record(z.string().min(1), checkProfileSchema).default({}),
	checks: z.array(checkSchema).default([]),
	timeouts: z.strictObject({ test: z.number().int().positive() }),
	/**
	 * Optional byte caps on captured evidence; with neither declared nothing is capped. A single
	 * capture file over `maxCaptureBytes` is not recorded, and neither is one that takes the
	 * whole record's captures past `maxRecordBytes`; each is reported as a failure of its check.
	 */
	maxCaptureBytes: z.number().int().positive().optional(),
	maxRecordBytes: z.number().int().positive().optional()
});

/** Test files named literally in file-runner commands must agree with the check's tracked path. */
function literalTestPaths(command: string): string[] {
	const tokens = command.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g) ?? [];
	return tokens
		.map((token) => token.replace(/^["']|["']$/g, ''))
		.filter((token) => !token.startsWith('-') && /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(token));
}

function matchesCheckPath(literal: string, checkPath: string): boolean {
	const normalize = (path: string) => posix.normalize(path.replace(/^\.\//, ''));
	const actual = normalize(literal);
	const expected = normalize(checkPath);
	if (actual === expected || actual === normalize(posix.basename(expected))) return true;
	const workspaceRelative = expected.replace(/^packages\/[^/]+\//, '');
	return actual === workspaceRelative;
}

export const verifyConfigSchema = verifyConfigInputSchema
	.superRefine((config, context) => {
		for (const [index, step] of config.setup.entries()) {
			for (const id of step.builds ?? []) {
				if (!config.builds.some((build) => build.id === id)) {
					context.addIssue({
						code: 'custom',
						path: ['setup', index, 'builds'],
						message:
							`Unknown verify build "${id}" named by a setup step. ` +
							'Declare it in builds or remove it from the step.'
					});
				}
			}
		}
		for (const [name, profile] of Object.entries(config.profiles)) {
			const inherited = config.checks.filter((check) => check.profile === name && !check.command);
			if (profile.command && !profile.command.includes('{target}') && inherited.length > 1)
				context.addIssue({
					code: 'custom',
					path: ['profiles', name, 'command'],
					message:
						`Profile "${name}" has no {target} in its command and ${inherited.length} checks inherit it, ` +
						'so each would run the same command. Add {target} or give each check its own command.'
				});
		}
		for (const [index, check] of config.checks.entries()) {
			const profile = check.profile ? config.profiles[check.profile] : undefined;
			if (check.profile && !profile) {
				context.addIssue({
					code: 'custom',
					path: ['checks', index, 'profile'],
					message: `Unknown verify check profile "${check.profile}".`
				});
			}
			const command = check.command ?? profile?.command;
			if (!command) {
				context.addIssue({
					code: 'custom',
					path: ['checks', index, 'command'],
					message: 'A check command or profile command is required.'
				});
				continue;
			}
			for (const literal of literalTestPaths(command)) {
				if (!matchesCheckPath(literal, check.path)) {
					context.addIssue({
						code: 'custom',
						path: ['checks', index, 'command'],
						message: `Command test path "${literal}" does not match check path "${check.path}".`
					});
				}
			}
		}
	})
	.transform((config) => ({
		...config,
		checks: config.checks.map((check) => {
			const profile = check.profile ? config.profiles[check.profile] : undefined;
			return {
				...profile,
				...check,
				command: check.command ?? profile?.command ?? ''
			};
		})
	}));

export const defaultVerifyConfig: VerifyConfig = {
	schemaVersion: 1,
	setup: [],
	link: [],
	outputs: [],
	builds: [],
	tools: [],
	profiles: {},
	checks: [],
	runners: {
		vitest: 'bun x vitest run {target}',
		playwright: 'bun x playwright test {target}'
	},
	timeouts: { test: 600_000 }
};

/** One line a check writes to `captures.ndjson` in `HARNESS_EVIDENCE_DIR`. */
export const captureLineSchema = z.strictObject({
	video: videoCaptureSchema.optional(),
	evidence: identifier,
	kind: z.enum(['screenshot', 'video', 'audio', 'output', 'assertions', 'trace', 'benchmark']),
	state: identifier,
	viewport: identifier.optional(),
	clip: captureRegionSchema.optional(),
	/** File name inside the evidence directory. */
	file: z.string().regex(/^[\w.-]+$/, 'must be a plain file name'),
	mediaType: text,
	provenance: z.enum(['fixture', 'actual-capture']).optional(),
	transcript: z.string().optional(),
	durationSeconds: z.number().positive().optional(),
	server: z.strictObject({ buildId: text, revision: text }).optional(),
	note: z.string().optional()
});

/** One measurement a benchmark capture reports; the run adds its profile and revision. */
export const reportedMeasurementSchema = z.object({
	unit: text,
	/** Selected exported callable when a module contains several helpers. */
	callable: text.optional(),
	metric: text,
	unitOfMeasure: text,
	value: z.number().nullable(),
	unavailable: z.string().optional(),
	method: text,
	workload: z.string().nullable(),
	target: z.enum(runtimeKinds).optional(),
	samples: z.number().int().positive().optional(),
	/** Explicit and validated: a budget never compares a measurement that only has a label. */
	comparison: comparisonSchema.optional()
});

/** The file a benchmark capture names: its measurements, plus whatever else the check adds. */
export const benchmarkCaptureSchema = z.object({
	measurements: z.array(reportedMeasurementSchema)
});

/** A request to send repeatedly through a unit's declared execution target. */
export const workloadSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: identifier,
	request: z.strictObject({ operation: text, input: z.unknown().optional() }),
	rounds: z.number().int().min(1).max(50),
	iterations: z.number().int().min(1).max(100_000)
});

export type { VerifyConfig, CaptureLine, Workload } from './verifyTypes.types';
