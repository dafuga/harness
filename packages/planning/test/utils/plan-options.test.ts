import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { AddDesignInput, DesignImageInput } from '../../src/models/PlanningBridge.types';
import type { DesignImage, DesignVersion } from '../../src/models/Planning.types';
import { hash } from '../../src/utils/planData';
import { approvable, optionOf, type WriteImages } from '../../src/utils/planOptions';
import { checkOptions } from '../../src/utils/plan-read/checkOptions';
import { planOptions } from '../../src/services/planning-service/planOptions';

/**
 * The rules of design options apart from Git: how options are numbered and written, what they
 * must differ in, what flat images beside them must be, and what a stored version must hold.
 */
const generator = { provider: 'codex', model: 'selected' };

test.each([
	['src/utils/planOptions.ts', 'planOptions'],
	['src/services/planning-service/planOptions.ts', 'planOptions'],
	['src/utils/planOptions.ts', 'checkOptions'],
	['src/utils/plan-read/checkOptions.ts', 'checkOptions'],
	['src/utils/planOptions.ts', 'heldBy'],
	['src/utils/plan-design/heldBy.ts', 'heldBy']
])('design option runtime cold-imports %s and calls %s', (entry, symbol) => {
	const code = `
import {pathToFileURL} from 'node:url';
const api = await import(pathToFileURL(process.argv[1]).href);
const symbol = process.argv[2], sha256 = 'a'.repeat(64);
const image = {state:'default',viewport:'desktop',bytes:new Uint8Array([1])};
const write = (images,prefix) => images.map(item => ({file:prefix+'default-desktop.png',sha256,state:item.state,viewport:item.viewport}));
const generator = {provider:'codex',model:'selected'};
const binding = {file:'o1-default-desktop.png',sha256};
const version = {images:[binding],options:[{id:'o1',direction:'One option',prompt:null,revisedPrompt:null,generator,images:[binding]}]};
let result;
if (symbol === 'planOptions') {
 const output = api.planOptions({generator,options:[{direction:'One option',images:[image]}]},'base',{},write);
 result = {files:output.images.map(item => item.file),ids:output.options.map(item => item.id)};
} else if (symbol === 'checkOptions') {api.checkOptions(version);result = {valid:true};}
else result = api.heldBy(version,binding.file,'o1');
console.log(JSON.stringify(result));`;
	const output = JSON.parse(
		execFileSync('bun', ['-e', code, resolve(entry), symbol], { encoding: 'utf8' })
	);
	const expected = {
		planOptions: { files: ['o1-default-desktop.png'], ids: ['o1'] },
		checkOptions: { valid: true },
		heldBy: { option: 'o1' }
	};
	expect(output).toEqual(expected[symbol as keyof typeof expected]);
});
const image = (n: number): DesignImageInput => ({
	state: 'default',
	viewport: 'desktop',
	bytes: new Uint8Array([n])
});
const write: WriteImages = (images, prefix) =>
	images.map((item) => ({
		file: `${prefix}${item.state}-${item.viewport}.png`,
		sha256: hash(item.bytes),
		state: item.state,
		viewport: item.viewport,
		bytes: 1,
		width: 2,
		height: 2,
		mediaType: 'image/png',
		content: 'present'
	})) as DesignImage[];
const input = (extra: Partial<AddDesignInput>) =>
	({ unitId: 'page.home', prompt: 'Home', generator, ...extra }) as AddDesignInput;
const two = [
	{
		direction: 'Dense table',
		images: [image(1)],
		prompt: 'Draw a dense table',
		revisedPrompt: 'Dense'
	},
	{ direction: 'Card grid', images: [image(2)] }
];

test('a single design is written as before, with no options and unprefixed files', () => {
	const made = planOptions(input({ images: [image(1)] }), 'base', {}, write);
	expect(made).toEqual({ images: [expect.objectContaining({ file: 'default-desktop.png' })] });
});

test('options are numbered within the version and keep direction, prompt and provenance', () => {
	const files: Record<string, string | Uint8Array> = {};
	const { images, options } = planOptions(input({ options: two }), 'base', files, write);
	expect(images.map((item) => item.file)).toEqual([
		'o1-default-desktop.png',
		'o2-default-desktop.png'
	]);
	expect(options?.map((option) => [option.id, option.direction, option.revisedPrompt])).toEqual([
		['o1', 'Dense table', 'Dense'],
		['o2', 'Card grid', null]
	]);
	expect(options?.[0].prompt).toEqual({ file: 'o1-prompt.md', sha256: hash('Draw a dense table') });
	expect([files['base/o1-prompt.md'], options?.[1].prompt, options?.[1].generator]).toEqual([
		'Draw a dense table',
		null,
		generator
	]);
});

test('flat images beside options must be exactly their union', () => {
	expect(() => planOptions(input({ options: two, images: [image(1)] }), 'b', {}, write)).toThrow(
		/union/
	);
	const both = planOptions(input({ options: two, images: [image(2), image(1)] }), 'b', {}, write);
	expect(both.options).toHaveLength(2);
});

test('options must differ in direction, and an option needs images', () => {
	const same = [two[0], { ...two[1], direction: ' dense TABLE ' }];
	expect(() => planOptions(input({ options: same }), 'b', {}, write)).toThrow(/distinct/);
	const empty = [two[0], { ...two[1], images: [] }];
	expect(() => planOptions(input({ options: empty }), 'b', {}, write)).toThrow(/needs images/);
});

test('a stored version whose options do not divide its images exactly is refused', () => {
	const { images, options } = planOptions(input({ options: two }), 'b', {}, write);
	const version = { images, options } as unknown as DesignVersion;
	expect(() => checkOptions(version)).not.toThrow();
	const tampered = [
		{ images, options: [options![1], options![0]] },
		{ images, options: [options![0]] },
		{ images, options: [options![0], { ...options![1], images: [options![0].images[0]] }] }
	];
	for (const value of tampered)
		expect(() => checkOptions(value as unknown as DesignVersion)).toThrow(/do not match/);
});

test('an approval binds one option, a single design binds all, and membership is stored', () => {
	const { images, options } = planOptions(input({ options: two }), 'b', {}, write);
	const optioned = { images, options } as unknown as DesignVersion;
	const single = { images: write([image(3)], '') } as unknown as DesignVersion;
	expect(approvable(optioned, 'o2')).toEqual(options![1].images);
	expect([approvable(optioned), approvable(optioned, 'o3'), approvable(single, 'o1')]).toEqual([
		null,
		null,
		null
	]);
	expect(approvable(single)).toEqual([
		{ file: 'default-desktop.png', sha256: single.images[0].sha256 }
	]);
	expect([
		optionOf(optioned, 'o2-default-desktop.png'),
		optionOf(single, 'default-desktop.png')
	]).toEqual(['o2', undefined]);
});

test('a stored file held by two options, or twice by one, or a blank direction or provenance is refused', () => {
	const { images, options } = planOptions(input({ options: two }), 'b', {}, write);
	const [a, b] = options!.map((option) => option.images[0]);
	const tampered = [
		[
			{ ...options![0], images: [a] },
			{ ...options![1], images: [a, b] }
		],
		[
			{ ...options![0], images: [a, a] },
			{ ...options![1], images: [b] }
		],
		[{ ...options![0], direction: ' ' }, options![1]],
		[options![0], { ...options![1], generator: { provider: 'codex', model: '' } }]
	];
	for (const value of tampered)
		expect(() => checkOptions({ images, options: value } as unknown as DesignVersion)).toThrow(
			/do not match|Expected non-empty text/
		);
});
