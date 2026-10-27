import { afterEach, expect, test, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { ComponentManifest } from '../../../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import manifest from '../../../../specification/units/reports.service.audio-upload.json' with { type: 'json' };
import { cleanupAudioFixtures, fixture } from './audio-upload-fixture';

afterEach(cleanupAudioFixtures);

async function upload(
	context: Awaited<ReturnType<typeof fixture>>,
	details = context.details,
	files = context.files,
	id = context.run.id
) {
	return context.pair
		? context.service.uploadComparison(id, { ...details, before: files.before, after: files.after })
		: context.service.upload(id, { ...details, audio: files.audio });
}

async function active(
	row: (typeof manifest.testing.cases)[number],
	context: Awaited<ReturnType<typeof fixture>>
) {
	const result = await upload(context);
	const items = result.evidence;
	const originals = context.pair ? [context.first, context.second] : [context.first];
	const contents = await Promise.all(
		items.map((item) =>
			readFile(join(context.store.directory(context.run.id), 'assets', item.file))
		)
	);
	const main = {
		count: items.length,
		mediaTypes: items.map((item) => item.mediaType),
		durationSeconds: items.map((item) => item.durationSeconds),
		statuses: items.map((item) => item.status),
		notes: items.map((item) => item.note),
		sources: items.map((item) => item.source),
		capturedAtAbsent: items.every((item) => item.capturedAt === undefined),
		originalBytes: contents.every((bytes, index) => bytes.equals(originals[index])),
		contentAddressed: contents.every(
			(bytes, index) =>
				items[index].file === createHash('sha256').update(bytes).digest('hex') + '.wav'
		),
		...(context.pair
			? {
					phases: items.map((item) => item.phase),
					sharedComparison:
						Boolean(items[0].comparison) && items[0].comparison === items[1].comparison
				}
			: {})
	};
	return { main, ...(await exerciseLimits(row, context)) };
}

async function exerciseLimits(
	row: (typeof manifest.testing.cases)[number],
	context: Awaited<ReturnType<typeof fixture>>
) {
	const limits = row.input.limits;
	const atLimit = {
		title: 'T'.repeat(limits.title),
		note: 'N'.repeat(limits.note),
		source: 'S'.repeat(limits.source)
	};
	const bounded = (await upload(context, atLimit)).evidence.at(-1)!;
	expect([bounded.title, bounded.note, bounded.source]).toEqual([
		atLimit.title,
		atLimit.note,
		atLimit.source
	]);
	const defaulted = (await upload(context, { ...context.details, source: '' })).evidence.at(-1)!;
	return {
		boundary: {
			titleLength: bounded.title.length,
			noteLength: bounded.note!.length,
			sourceLength: bounded.source!.length
		},
		defaultSource: defaulted.source
	};
}

async function invalid(
	row: (typeof manifest.testing.cases)[number],
	context: Awaited<ReturnType<typeof fixture>>
) {
	const observed = [];
	for (const variant of row.input.variants) {
		const details = { ...context.details },
			files = { ...context.files };
		let id = context.run.id;
		if (variant.field === 'reportId') id = variant.value;
		else if (variant.field === 'title' || variant.field === 'note' || variant.field === 'source')
			details[variant.field] =
				variant.mode === 'repeat' ? variant.value.repeat(variant.count) : variant.value;
		else files[variant.field as keyof typeof files] = invalidFile(variant, context.first);
		const error = await rejected(() => upload(context, details, files, id));
		observed.push({
			name: variant.name,
			error: error?.message ?? null,
			evidence: (await context.store.get(context.run.id)).evidence.length
		});
	}
	await context.store.seal(context.run.id);
	await context.store.finish(context.run.id, {
		html: 'index.html',
		pdf: 'report.pdf',
		zip: 'report.zip'
	});
	await expect(upload(context)).rejects.toThrow(/finaliz/);
	expect((await context.store.get(context.run.id)).evidence).toHaveLength(0);
	return observed;
}

function invalidFile(
	variant: (typeof manifest.testing.cases)[number]['input']['variants'][number],
	bytes: Buffer
) {
	if (variant.mode === 'empty') return new File([], 'empty.wav');
	if (variant.mode === 'fake') return new File(['fake'], 'fake.wav');
	if (variant.mode === 'unsupported') return new File([Uint8Array.from(bytes)], 'sound.txt');
	// The method rejects this size before reading bytes; the fixture avoids allocating 50 MB.
	const file = new File([Uint8Array.from(bytes)], 'oversize.wav');
	Object.defineProperty(file, 'size', { value: variant.count });
	return file;
}

async function rejected(run: () => Promise<unknown>) {
	try {
		await run();
		return undefined;
	} catch (error) {
		return error as NodeJS.ErrnoException;
	}
}

async function unavailable(
	row: (typeof manifest.testing.cases)[number],
	context: Awaited<ReturnType<typeof fixture>>
) {
	if (row.state === 'finalizing' || row.state === 'finalized')
		await context.store.seal(context.run.id);
	if (row.state === 'finalized')
		await context.store.finish(context.run.id, {
			html: 'index.html',
			pdf: 'report.pdf',
			zip: 'report.zip'
		});
	if (row.state === 'storage-failure')
		vi.spyOn(context.store, 'mutateActive').mockRejectedValueOnce(
			new Error('Synthetic storage failure')
		);
	const error = await rejected(() =>
		upload(
			context,
			context.details,
			context.files,
			row.state === 'missing-report' ? 'missing-run' : context.run.id
		)
	);
	const saved = await context.store.get(context.run.id);
	return {
		...(row.state === 'missing-report'
			? { code: error?.code ?? null }
			: { error: error?.message ?? null }),
		state: saved.state,
		evidence: saved.evidence.length
	};
}

const implementations = Object.fromEntries(
	manifest.testing.cases.map((row) => [
		row.id,
		() =>
			measureWorkload(manifest.id, `${row.subject}-${row.state}`, async () => {
				const context = await fixture(row);
				if (row.state === 'active') return active(row, context);
				if (row.state === 'invalid-input') return invalid(row, context);
				return unavailable(row, context);
			})
	])
);
new TestExpectationService().registerCases(
	test,
	manifest as unknown as ComponentManifest,
	'packages/reports/test/services/audio-upload.test.ts',
	implementations
);
