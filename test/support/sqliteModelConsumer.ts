/** Runs in a real generated project with Bun's SQLite driver. */
export const sqliteModelConsumer = `
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { BlogPost } from './src/models/BlogPost';
import { createSqliteAdapter } from './src/models/adapters/sqlite';
const db = new Database('consumer.sqlite');
db.exec(readFileSync('db/migrations/create_blog_posts.sql', 'utf8'));
let adapter = createSqliteAdapter(db, [BlogPost.definition]);
const input = {title: "A 'quoted' title", ownerName: 'Daniel', active: true, metadata: {tags: ['local']}};
const created = await BlogPost.create(adapter, input);
if (created.ownerName !== input.ownerName || created.active !== true || created.metadata.tags[0] !== 'local')
  throw new Error('Generated model did not round trip its field types');
if (!created.createdAt || !created.updatedAt) throw new Error('Missing generated timestamps');
const changed = await BlogPost.update(adapter, created.id, {active: false, title: 'Updated'});
if (changed?.active !== false) throw new Error('Update did not preserve booleans');
if ((await BlogPost.findBy(adapter, {ownerName: 'Daniel'})).length !== 1) throw new Error('findBy failed');
db.close();
const reopened = new Database('consumer.sqlite');
adapter = createSqliteAdapter(reopened, [BlogPost.definition]);
const persisted = (await BlogPost.find(adapter, created.id))?.title === 'Updated';
const deleted = await BlogPost.delete(adapter, created.id);
if (await BlogPost.delete(adapter, created.id)) throw new Error('Missing rows must not report deletion');
reopened.close();
console.log(JSON.stringify({persisted, deleted}));
`;
