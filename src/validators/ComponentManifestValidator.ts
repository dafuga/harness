import type { z } from 'zod';
import { componentManifestSchema, type ComponentManifest } from '../core/unitTypes';
import { derivedResponsibility } from '../utils/derivedResponsibility';

export interface ManifestValidation<T> {
	value?: T;
	errors: string[];
}

/** Checks one stored unit manifest against the schema and its own file name. */
export class ComponentManifestValidator {
	validate(value: unknown, file: string): ManifestValidation<ComponentManifest> {
		const label =
			file
				.split('/')
				.at(-1)
				?.replace(/\.json$/, '') ?? file;
		const parsed = componentManifestSchema.safeParse(value);
		if (!parsed.success) {
			const errors = schemaErrors(parsed.error, label);
			return wellFormed(parsed.error) ? { value: value as ComponentManifest, errors } : { errors };
		}
		const manifest = parsed.data;
		const errors: string[] = [];
		if (manifest.id !== label)
			errors.push(`${label}: id "${manifest.id}" must match its file name`);
		if (manifest.status === 'retired' && !manifest.retired) {
			errors.push(`${label}: retired units must record a reason`);
		}
		if (manifest.status === 'active' && manifest.owns.source.length === 0) {
			errors.push(`${label}: active units must own at least one source file`);
		}
		return {
			value: manifest,
			errors: [
				...errors,
				...this.targetErrors(manifest, label),
				...this.labelErrors(manifest),
				...this.previewErrors(manifest)
			]
		};
	}
	private previewErrors(manifest: ComponentManifest): string[] {
		return manifest.preview && !['page', 'component'].includes(manifest.kind)
			? [`${manifest.id}: only page and component units may declare a preview`]
			: [];
	}

	/** Text labelled as derived must be the generated placeholder, not an unreviewed edit. */
	private labelErrors(manifest: ComponentManifest): string[] {
		const derived = derivedResponsibility(manifest.kind, manifest.title);
		if (manifest.responsibilityOrigin !== 'derived' || manifest.responsibility === derived)
			return [];
		return [
			`${manifest.id}: responsibility differs from the derived text; set responsibilityOrigin to "declared"`
		];
	}

	/** The default must be one of the listed targets, and each runtime kind appears once. */
	private targetErrors(manifest: ComponentManifest, label: string): string[] {
		const { kind, entry, targets } = manifest.runtime;
		const kinds = targets.map((target) => target.kind);
		const repeated = [...new Set(kinds.filter((item, index) => kinds.indexOf(item) !== index))];
		const listed = targets.some((target) => target.kind === kind && target.entry === entry);
		return [
			...(listed
				? []
				: [`${label}: runtime.targets must include the default ${kind} target ${entry}`]),
			...repeated.map((item) => `${label}: runtime.targets lists ${item} more than once`)
		];
	}
}

const contentIssues = new Set(['too_small', 'too_big', 'invalid_format']);

/** True when the shape is sound and only field contents are wrong, so relationships still apply. */
export function wellFormed(error: z.ZodError): boolean {
	return error.issues.every((issue) => contentIssues.has(issue.code));
}

export function schemaErrors(error: z.ZodError, label: string): string[] {
	return error.issues.map(
		(issue) => `${label}: ${issue.path.join('.') || 'manifest'} ${issue.message}`
	);
}
