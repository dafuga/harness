import { z } from 'zod';
import type { MockupDocument } from './mockupSource.types';

export const mockupMarker = 'harness-html-mockup-v1\n';
export const beforeState = 'before-';

const css = z
	.string()
	.max(25000)
	.refine((value) => !/<\/style/i.test(value));
const html = z
	.string()
	.trim()
	.min(1)
	.max(25000)
	.refine((value) => {
		return !/<\/?(?:script|iframe|frame|embed|object|link|meta|base|head|html|body|style)\b/i.test(
			value
		);
	});
const document = z.object({ html, css });
const paths = z.array(z.string().min(1).max(240)).max(20);
const options = z
	.array(document.extend({ direction: z.string().trim().min(1).max(2000) }))
	.min(1)
	.max(10);

export const answerSchema = z.object({
	sources: paths,
	stylesheets: paths,
	before: document.nullable(),
	options
});

const state = z.object({
	id: z
		.string()
		.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
		.max(40)
		.refine((value) => value !== 'default' && !value.startsWith(beforeState)),
	before: document.nullable(),
	options: z.array(document).min(1).max(10)
});

const widths = z.array(z.number().int().min(240).max(2560)).max(8);
export const variationSchema = z.object({ widths, states: z.array(state).max(4) });

export const sourceSchema = answerSchema.extend({
	projectCss: z
		.string()
		.max(250000)
		.refine((value) => !/<\/style/i.test(value)),
	widths,
	states: z.array(state).max(4),
	author: z.string(),
	enhancer: z.string().nullable()
});

export function mockupSource(notes: string | undefined) {
	if (!notes?.startsWith(mockupMarker)) return null;
	return sourceSchema.parse(JSON.parse(notes.slice(mockupMarker.length)));
}

export function mockupHtml(document: Pick<MockupDocument, 'html' | 'css'>, projectCss: string) {
	return (
		'<!doctype html><html><head><meta charset="utf-8">' +
		'<meta name="viewport" content="width=device-width, initial-scale=1">' +
		'<style>' +
		projectCss +
		'\n' +
		document.css +
		'</style></head><body>' +
		document.html +
		'</body></html>'
	);
}
