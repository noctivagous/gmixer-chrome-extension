import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chipRoleForPreview,
  clampRectToVisible,
  clippedEdgeStub,
  intersectRects,
  linkCurve,
  rectEdgeToward,
} from '../src/lib/hover-link.js';

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

  it('intersects overlapping rects', () => {
    const hit = intersectRects(
      { left: 0, top: 0, right: 50, bottom: 50, width: 50, height: 50 },
      { left: 40, top: 40, right: 80, bottom: 80, width: 40, height: 40 }
    );
    assert.deepEqual(hit, { left: 40, top: 40, right: 50, bottom: 50, width: 10, height: 10 });
    assert.equal(
      intersectRects(
        { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 },
        { left: 20, top: 20, right: 30, bottom: 30, width: 10, height: 10 }
      ),
      null
    );
  });

  it('pins a stub to the top clip edge when the target is above', () => {
    const el = { left: 100, top: -40, right: 200, bottom: -10, width: 100, height: 30 };
    const clip = { left: 0, top: 0, right: 300, bottom: 200, width: 300, height: 200 };
    const stub = clippedEdgeStub(el, clip);
    assert.equal(stub.top, 0);
    assert.ok(stub.bottom <= 2);
    assert.ok(stub.left >= 100 && stub.right <= 200);
  });

  it('pins a stub to the bottom clip edge when the target is below', () => {
    const el = { left: 100, top: 250, right: 200, bottom: 280, width: 100, height: 30 };
    const clip = { left: 0, top: 0, right: 300, bottom: 200, width: 300, height: 200 };
    const stub = clippedEdgeStub(el, clip);
    assert.equal(stub.bottom, 200);
    assert.ok(stub.top >= 198);
  });

  it('clamps partially visible targets to the intersection', () => {
    const el = { left: 10, top: -20, right: 110, bottom: 40, width: 100, height: 60 };
    const clip = { left: 0, top: 0, right: 300, bottom: 200, width: 300, height: 200 };
    const visible = clampRectToVisible(el, [clip], {
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
    });
    assert.deepEqual(visible, { left: 10, top: 0, right: 110, bottom: 40, width: 100, height: 40 });
  });

  it('uses an edge stub when the target is fully clipped by a scrollport', () => {
    const el = { left: 40, top: -80, right: 140, bottom: -20, width: 100, height: 60 };
    const clip = { left: 0, top: 50, right: 300, bottom: 250, width: 300, height: 200 };
    const visible = clampRectToVisible(el, [clip], {
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
    });
    assert.equal(visible.top, 50);
    assert.ok(visible.height <= 2);
  });
});
