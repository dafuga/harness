// Small shared pieces of markup.

export const mk = (k = 'active') => `<span class="mk" data-k="${k}"></span>`;

export const pill = (tone, label) =>
	`<span class="pill" data-tone="${tone}">${mk(tone)}${label}</span>`;

export const tag = (label) => `<span class="tag">${label}</span>`;

export const av = (initials, tone) =>
	`<span class="av"${tone ? ` data-tone="${tone}"` : ''}>${initials}</span>`;

export const brandMark = `<svg viewBox="0 0 52 52" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="10" y="10" width="10" height="10" /><rect x="32" y="10" width="10" height="10" /><rect x="21" y="21" width="10" height="10" /><rect x="10" y="32" width="10" height="10" /><rect x="32" y="32" width="10" height="10" /></svg>`;

export const searchIcon = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" stroke-linecap="round" /></svg>`;

export const chatIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>`;

export const meter = (percent, tone) =>
	`<div class="meter"${tone ? ` data-tone="${tone}"` : ''}><i style="width: ${percent}%"></i></div>`;
