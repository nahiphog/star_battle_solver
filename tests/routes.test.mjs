import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRoutes } from '../src/lib/routes.ts';

for (const base of ['/', '/star_battle_solver/']) {
  test(`navigation and direct routes work under ${base}`, () => {
    const { pageToRoute, routeToPage } = createRoutes(base);
    for (const [page, route] of Object.entries(pageToRoute)) {
      assert.ok(route.startsWith(base));
      assert.equal(routeToPage(route), page);
      assert.equal(routeToPage(`${route}/`), page);
      // Reload and popstate both read the same pathname.
      assert.equal(routeToPage(new URL(route, 'https://nahiphog.github.io').pathname), page);
    }
    assert.equal(pageToRoute['technique-list'], `${base}techniques_list`);
    assert.equal(routeToPage(`${base}technique_list`), 'technique-list');
    assert.equal(routeToPage(base), 'techniques');
  });
}

test('GitHub Pages 404 preserves a deep link for the app to restore', () => {
  const html = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const saved = new Map();
  let destination;
  runInNewContext(script, {
    sessionStorage: { setItem: (key, value) => saved.set(key, value) },
    window: { location: {
      pathname: '/star_battle_solver/techniques_list', search: '?example=1', hash: '#list',
      replace: url => { destination = url; },
    } },
  });
  assert.equal(destination, '/star_battle_solver/');
  const restored = saved.get('star-battle-pages-redirect');
  assert.equal(restored, '/star_battle_solver/techniques_list?example=1#list');
  assert.equal(createRoutes('/star_battle_solver/').routeToPage(new URL(restored, 'https://nahiphog.github.io').pathname), 'technique-list');
});
