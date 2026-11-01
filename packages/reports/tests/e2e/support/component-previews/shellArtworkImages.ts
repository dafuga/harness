import { ids } from '../../../../test/entityUnits';

/** Product-shaped input artwork; the surrounding recording retains fixture provenance. */
export function shellImage(id: string, viewport = 'desktop', before = false, incomparable = false) {
	const [width, height] =
		viewport === 'mobile'
			? [390, 844]
			: viewport === 'tablet'
				? [768, 1024]
				: [incomparable ? 1120 : 1440, 900];
	const pad = width < 500 ? 24 : 48;
	const font = width < 500 ? 18 : 28;
	const layout = id === 'app.shell.orders-frame';
	const { heading, rows } = imageText(id, before);
	const body = layout
		? `<rect x="${pad}" y="160" width="${width - 2 * pad}" height="${height - 208}" rx="12" fill="#142b3e" stroke="#f3c33b" stroke-width="2" stroke-dasharray="8 6"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#f3c33b" font-size="${font}">Child content</text>`
		: rows
				.map(
					(row, n) =>
						`<rect x="${pad}" y="${160 + n * 88}" width="${width - 2 * pad}" height="64" rx="8" fill="#142b3e"/><text x="${pad + 16}" y="${201 + n * 88}" font-size="${font}">${row}</text>`
				)
				.join('');
	return (
		'data:image/svg+xml,' +
		encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0e1c29"/><g font-family="sans-serif" fill="#d8e4ee"><text x="${pad}" y="52" fill="#f3c33b" font-size="18">Order management</text><text x="${pad}" y="110" fill="#f4f7fb" font-size="${font + 12}">${heading}</text>${body}</g></svg>`
		)
	);
}

/** Decode only the explicitly declared shell fixture media names. */
export function shellMedia(file: string): string | undefined {
	const match = /^sol8-shell-(.+)-(desktop|tablet|mobile)-(before|after)\.svg$/.exec(file);
	return match
		? decodeURIComponent(
				shellImage(decodeURIComponent(match[1]), match[2], match[3] === 'before').split(',')[1]
			)
		: undefined;
}

function imageText(id: string, before: boolean) {
	const search = id === ids.search;
	const card = id === ids.card;
	const heading =
		(
			{
				'app.shell.orders-frame': 'Orders workspace',
				[ids.search]: 'Search orders',
				[ids.card]: 'Order A-1048'
			} as Record<string, string>
		)[id] ?? 'Orders';
	const status = before ? 'Processing' : 'Ready to ship';
	const rows = search
		? ['Find a customer or reference', 'Search']
		: card
			? ['2 items · Standard delivery', '$128.00 · Paid', `Status: ${status}`]
			: [`Order A-1048 · ${status}`, 'Order A-1047 · Delivered'];
	return { heading, rows };
}
