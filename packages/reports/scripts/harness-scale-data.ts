/**
 * Copies the console data of the synthetic history and gives its newest revision a registry
 * of several hundred generated units, so the map can be exercised at the size of a real
 * repository. The failed record of another revision gets one more failure for each of those
 * units, as a first record of a real repository has one for every unit without a baseline.
 * The units and those failures are plainly generated: nothing here describes real source.
 */
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface Unit {
	id: string;
	title: string;
	responsibility: string;
	dependencies: Array<{ unit: string; via: string }>;
	owns: { source: string[]; symbols: string[] };
	scenarios: string[];
}
interface Detail {
	registry: { units: Unit[]; graph: { edges: Array<{ from: string; to: string; via: string }> } };
	records: Array<{ status: string; failures: string[] }>;
}

export const generatedUnits = 480;
const perLayer = 120;
const name = (index: number) => `function.generated-${String(index).padStart(3, '0')}`;

/** Each generated unit depends on two units of the layer below it. */
function generated(template: Unit): Unit[] {
	return Array.from({ length: generatedUnits }, (_, index) => {
		const below = index < perLayer ? [] : [index - perLayer, index - perLayer + 1];
		return {
			...template,
			id: name(index),
			title: `Generated ${index}`,
			responsibility: `Generated unit ${index} of the scale fixture; it describes no real source.`,
			dependencies: below.map((target) => ({ unit: name(target), via: 'import' })),
			owns: { source: [`generated/unit-${index}.ts`], symbols: [`unit${index}`] },
			scenarios: []
		};
	});
}

/** The failure a unit without a baseline has in a record, once for every generated unit. */
export const generatedFailures = Array.from(
	{ length: generatedUnits },
	(_, index) => `${name(index)}: no baseline is established; a reviewer must establish one`
);

/** A record that already failed keeps its failures and its outcome, and gains the generated ones. */
async function overloaded(to: string, commit: string): Promise<void> {
	const path = join(to, 'revisions', `${commit}.json`);
	const detail = JSON.parse(await readFile(path, 'utf8')) as Detail;
	const failed = detail.records.find((record) => record.status === 'failed');
	if (!failed) throw new Error(`the synthetic history has no failed record at ${commit}`);
	failed.failures.push(...generatedFailures);
	await writeFile(path, JSON.stringify(detail));
}

export async function writeScaleData(
	from: string,
	to: string,
	commits: { map: string; failed: string }
): Promise<void> {
	await rm(to, { recursive: true, force: true });
	await cp(from, to, { recursive: true });
	await overloaded(to, commits.failed);
	const path = join(to, 'revisions', `${commits.map}.json`);
	const detail = JSON.parse(await readFile(path, 'utf8')) as Detail;
	const template = detail.registry.units.find((unit) => unit.id === 'function.slugify');
	if (!template) throw new Error('the synthetic history has no function.slugify to copy');
	const added = generated(template);
	detail.registry.units.push(...added);
	for (const unit of added) {
		for (const dependency of unit.dependencies) {
			detail.registry.graph.edges.push({ from: unit.id, to: dependency.unit, via: 'import' });
		}
	}
	await writeFile(path, JSON.stringify(detail));
}
