import { expect, test } from 'vitest';
import { actor, commit, outsider, project, projectionFixture } from '../support/projectionFixture';

const encode = (text: string) => new TextEncoder().encode(text);
const board = '<meta name="artboard-size" content="390x844"><p>Cards</p>';
function fixture() {
	const f = projectionFixture();
	const add = (path: string, text: string) => f.files.set(path, encode(text));
	add(
		'designs/cards/canvas.json',
		JSON.stringify({
			schemaVersion: 1,
			title: 'Cards',
			artboards: [
				{ file: 'Phone.html', title: 'Phone' },
				{ file: 'Gone.html', title: 'Gone' },
				{ file: 'Huge.html', title: 'Huge' }
			]
		})
	);
	add('designs/cards/Phone.html', board);
	add('designs/cards/Huge.html', board + ' '.repeat(600_000));
	add('designs/broken/canvas.json', '{');
	add('designs/cards/notes/canvas.json', '{');
	return f;
}
const query = { branch: 'feat/a/b', commit: null, canvas: null as string | null };

test('lists the branch tip canvases and reads the asked one; a broken one hides nothing', async () => {
	const f = fixture();
	const page = await f.projection.designs(actor, project.id, { ...query, canvas: 'cards' });
	expect(page).toMatchObject({ commit, branch: 'feat/a/b', branches: ['feat/a/b'] });
	expect(page.canvases).toEqual([
		{ name: 'broken', title: 'broken (unreadable canvas.json)', artboards: 0 },
		{ name: 'cards', title: 'Cards', artboards: 3 }
	]);
	expect(page.canvas?.boards.map((b) => [b.file, b.width, b.problem])).toEqual([
		['Phone.html', 390, null],
		['Gone.html', 1440, 'The artboard file is missing.'],
		['Huge.html', 1440, 'The artboard file is larger than 512 KB.']
	]);
	expect(page.canvas?.boards[0].html).toBe(board);
	await expect(f.projection.designs(actor, project.id, query)).rejects.toMatchObject({
		code: 'artifact-corrupt'
	});
});

test('membership is checked before any canvas is read', async () => {
	const f = fixture();
	await f.projection.designs(actor, project.id, { ...query, canvas: 'cards' });
	await expect(
		f.projection.designs(outsider, project.id, { ...query, canvas: 'cards' })
	).rejects.toThrow();
});

test('the endpoint refuses bad input and answers unknown names as not found', async () => {
	const f = fixture();
	const get = async (search: string) => {
		const url = `https://hub.test/api/projects/${project.id}/designs${search}`;
		const response = await f.controller.handle(new Request(url));
		return [response.status, await response.json()];
	};
	expect((await get('?branch=feat%2Fa%2Fb&canvas=cards'))[0]).toBe(200);
	expect(await get('?canvas=..%2Fsecret')).toEqual([400, { error: 'invalid-input' }]);
	expect(await get('?commit=HEAD')).toEqual([400, { error: 'invalid-input' }]);
	expect(await get('?canvas=nope')).toEqual([404, { error: 'not-found' }]);
	expect(await get('?branch=gone')).toEqual([404, { error: 'not-found' }]);
	f.setActor(null);
	expect((await get(''))[0]).toBe(401);
});
