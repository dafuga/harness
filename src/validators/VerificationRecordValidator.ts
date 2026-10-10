import { verificationRecordSchema, type VerificationRecord } from '../core/verificationTypes';
import { schemaErrors, type ManifestValidation } from './ComponentManifestValidator';

/** Checks that a verification record is well formed and self-sufficient. */
export class VerificationRecordValidator {
	validate(value: unknown): ManifestValidation<VerificationRecord> {
		const label = recordLabel(value);
		const parsed = verificationRecordSchema.safeParse(value);
		if (!parsed.success) return { errors: schemaErrors(parsed.error, label) };
		const record = parsed.data;
		const errors = [...this.measurementErrors(record), ...this.unrecordedUnits(record)];
		return { value: record, errors: errors.map((error) => `${label}: ${error}`) };
	}

	/** A metric is reported as a number or as an explicit reason it is unavailable. */
	private measurementErrors(record: VerificationRecord): string[] {
		return record.measurements.flatMap((measurement) => {
			const name = `measurement ${measurement.unit} ${measurement.metric}`;
			const explained = Boolean(measurement.unavailable?.trim());
			if (measurement.value === null && !explained) {
				return [`${name} has no value and no unavailable reason`];
			}
			if (measurement.value !== null && explained) {
				return [`${name} has both a value and an unavailable reason`];
			}
			return [];
		});
	}

	/** Every measured or budgeted unit must have its exact version in the same record. */
	private unrecordedUnits(record: VerificationRecord): string[] {
		const recorded = new Set(record.components.map((component) => component.unit));
		const missing = (kind: string, units: string[]) =>
			[...new Set(units)]
				.filter((unit) => !recorded.has(unit))
				.map((unit) => `${kind} names ${unit}, which has no recorded component version`);
		return [
			...missing(
				'measurement',
				record.measurements.map((measurement) => measurement.unit)
			),
			...missing(
				'budget finding',
				record.budgets.findings.map((finding) => finding.unit)
			)
		];
	}
}

function recordLabel(value: unknown): string {
	const id = (value as { id?: unknown } | null)?.id;
	return typeof id === 'string' && id ? id : 'record';
}
