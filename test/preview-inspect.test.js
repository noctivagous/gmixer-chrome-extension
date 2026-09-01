import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREVIEW_COLOR_ROLES,
  PREVIEW_FONT_SLOTS,
  PREVIEW_MEDIA_LABEL,
  fontIdForPreviewSlot,
  fontsPatchForPreviewSlot,
  previewRoleLabel,
  resolvePreviewTarget,
  samePreviewTarget,
} from '../src/popup/components/preview-inspect.js';

function el(attrs = {}, parent = null) {
  const attributes = { ...attrs };
  const node = {
    parentElement: parent,
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name);
    },
  };
  return node;
}

describe('preview-inspect', () => {
  it('exposes BG:Primary / BG:Secondary labels', () => {
    assert.equal(previewRoleLabel('background'), 'BG:Primary');
    assert.equal(previewRoleLabel('backgroundSecondary'), 'BG:Secondary');
    assert.equal(previewRoleLabel('surfaceGui'), 'Surface: GUI');
    assert.equal(previewRoleLabel('headingMedium'), 'Accent:Heading-Medium');
    assert.equal(previewRoleLabel('headingSmall'), 'Accent:Heading-Small');
    assert.ok(PREVIEW_COLOR_ROLES.some((role) => role.id === 'accent'));
  });

  it('resolves the deepest annotated role', () => {
    const root = el({});
    const outer = el({ 'data-gmixer-preview-role': 'background' }, root);
    const title = el(
      {
        'data-gmixer-preview-role': 'accent',
        'data-gmixer-preview-font': 'headings.h1',
      },
      outer
    );
    const hit = resolvePreviewTarget(title, root);
    assert.equal(hit.roleId, 'accent');
    assert.equal(hit.fontSlot, 'headings.h1');
    assert.equal(hit.media, null);
    assert.equal(hit.label, 'Accent');
    assert.equal(hit.el, title);
  });

  it('resolves media targets without a color role', () => {
    const img = el({ 'data-gmixer-preview-media': 'image' });
    const hit = resolvePreviewTarget(img);
    assert.equal(hit.media, 'image');
    assert.equal(hit.label, PREVIEW_MEDIA_LABEL);
    assert.equal(hit.roleId, null);
  });

  it('ignores nodes inside the inspect chrome', () => {
    const text = el({ 'data-gmixer-preview-role': 'text' });
    const chrome = el({ 'data-gmixer-preview-inspect': '' }, text);
    const button = el({}, chrome);
    assert.equal(resolvePreviewTarget(button), null);
  });

  it('compares targets by role/font/media', () => {
    const a = { roleId: 'text', fontSlot: 'paragraph', media: null, label: 'Text' };
    const b = { roleId: 'text', fontSlot: 'paragraph', media: null, label: 'Text' };
    const c = { roleId: 'muted', fontSlot: 'captions', media: null, label: 'Muted' };
    assert.equal(samePreviewTarget(a, b), true);
    assert.equal(samePreviewTarget(a, c), false);
  });

  it('reads and patches font slots including heading compat', () => {
    const fonts = {
      headers: { fontId: 'legacy-header' },
      paragraph: { fontId: 'body-face' },
      headings: { h2: { fontId: 'sub-face' } },
    };
    assert.equal(fontIdForPreviewSlot(fonts, 'paragraph'), 'body-face');
    assert.equal(fontIdForPreviewSlot(fonts, 'headings.h1'), 'legacy-header');
    assert.equal(fontIdForPreviewSlot(fonts, 'headings.h2'), 'sub-face');
    assert.equal(fontIdForPreviewSlot(fonts, 'headings.h3'), 'legacy-header');
    assert.deepEqual(fontsPatchForPreviewSlot('paragraph', 'new-body'), {
      paragraph: { fontId: 'new-body' },
    });
    assert.deepEqual(fontsPatchForPreviewSlot('headings.h1', 'hero'), {
      headings: { h1: { fontId: 'hero' } },
    });
  });

  it('exposes inspectable h3–h6 font slots', () => {
    for (const tag of ['h3', 'h4', 'h5', 'h6']) {
      const key = `headings.${tag}`;
      assert.equal(PREVIEW_FONT_SLOTS[key].path, key);
      assert.equal(PREVIEW_FONT_SLOTS[key].label, tag.toUpperCase());
    }
    const fonts = {
      subheadings: { fontId: 'legacy-sub' },
      headings: { h5: { fontId: 'small-face' } },
    };
    assert.equal(fontIdForPreviewSlot(fonts, 'headings.h3'), 'legacy-sub');
    assert.equal(fontIdForPreviewSlot(fonts, 'headings.h5'), 'small-face');
    assert.deepEqual(fontsPatchForPreviewSlot('headings.h4', 'outfit'), {
      headings: { h4: { fontId: 'outfit' } },
    });
    assert.deepEqual(fontsPatchForPreviewSlot('headings.h6', 'tippa'), {
      headings: { h6: { fontId: 'tippa' } },
    });
  });
});
