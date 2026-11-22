// @harness-uid u_nfctcgnv7g
import type { ClipStyleInputs } from './clipInputs.types';

/** Treat only literal CSS as statically closed; preprocessor semantics require fresh recording. */
export function clipStyleInputs(path: string, code: string): ClipStyleInputs {
	const reasons: string[] = [],
		css: string[] = [];
	if (/\.(?:scss|sass|less|styl|stylus)$/i.test(path)) reasons.push(unprovenStyle(path));
	if (path.endsWith('.css')) css.push(code);
	const markup = code.replace(
		/<style\b([^>]*)>([\s\S]*?)<\/style>/g,
		(_whole, attributes: string, body: string) => {
			if (cssAttributes(attributes)) {
				css.push(body);
				return `<style ${attributes}></style>`;
			}
			reasons.push(unprovenStyle(path));
			return '';
		}
	);
	return { css: css.join('\n'), markup, reasons: [...new Set(reasons)] };
}

function cssAttributes(attributes: string): boolean {
	const lang = attribute(attributes, 'lang'),
		type = attribute(attributes, 'type');
	return (
		(lang === undefined || lang.toLowerCase() === 'css') &&
		(type === undefined || type.toLowerCase() === 'text/css')
	);
}

function attribute(attributes: string, name: string): string | undefined {
	const found = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(
		attributes
	);
	return found ? (found[1] ?? found[2] ?? found[3]) : undefined;
}

function unprovenStyle(path: string): string {
	return `Unproven style preprocessor dependency in ${path}; widened to source snapshot; recording required`;
}
