import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
	kernelBenchmarkSchema,
	measurementsDirectory,
	type KernelBenchmark
} from '../../core/development-tooling/benchmarkTypes';
import { fail } from '../../core/development-tooling/errors';
import { kernelArtifacts } from '../../utils/execution-runtimes/kernelArtifacts';
import { stableJson } from '../../utils/development-tooling/stableJson';

/** Stores kernel benchmark runs, one file per hardware and runtime profile. */
export class MeasurementRepository {
	constructor(private readonly root: string) {}

	/** Writes a run to an explicit file, or to the profile file in the repository. */
	async write(benchmark: KernelBenchmark, file?: string): Promise<string> {
		const path = file ? resolve(this.root, file) : this.profilePath(benchmark.profile.id);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, stableJson(benchmark));
		return path;
	}

	read(file: string): KernelBenchmark {
		const path = resolve(this.root, file);
		if (!existsSync(path)) return fail(`Measurement file ${file} does not exist.`);
		const parsed = kernelBenchmarkSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
		if (parsed.success) return parsed.data;
		const issue = parsed.error.issues[0];
		return fail(`Measurement file ${file} is malformed: ${issue.path.join('.')} ${issue.message}`);
	}

	/** The run recorded for a profile: this repository first, then the shipped measurements. */
	forProfile(profile: string): KernelBenchmark | undefined {
		const shipped = kernelArtifacts().directory;
		const paths = [
			this.profilePath(profile),
			...(shipped ? [join(shipped, 'measurements', `${profile}.json`)] : [])
		];
		const found = paths.find((path) => existsSync(path));
		return found ? this.read(found) : undefined;
	}

	private profilePath(profile: string): string {
		return join(this.root, measurementsDirectory, `${profile}.json`);
	}
}
