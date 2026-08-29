import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chipRoleForPreview, linkCurve, rectEdgeToward } from '../src/lib/hover-link.js';

describe('hover-link', () => {
  it('maps preview hover roles onto swatch chips', () => {
    assert.equal(chipRoleForPreview('linkHover'), 'link');
    assert.equal(chipRoleForPreview('navLinkHover'), 'navLink');
    assert.equal(chipRoleForPreview('text'), 'text');
    assert.equal(chipRoleForPreview(null), null);
  });

  it('places the start point on the origin rect edge', () => {
    const from = { left: 0, top: 0, width: 20, height: 20, right: 20, bottom: 20 };
    const toward = rectEdgeToward(from, 100, 10);
    assert.equal(toward.x, 20);
    assert.equal(toward.y, 10);
  });

  it('builds a cubic path from one rect to another', () => {
    const from = { left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10 };
    const to = { left: 90, top: 0, width: 10, height: 10, right: 100, bottom: 10 };
    const curve = linkCurve(from, to);
    assert.match(curve.d, /^M /);
    assert.ok(curve.end.x > curve.start.x);
  });
});
