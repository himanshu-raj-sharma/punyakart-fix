import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { Header } from '../frontend/src/components/Header';
import { Footer } from '../frontend/src/components/Footer';
import { DonorAuthProvider } from '../frontend/src/components/DonorAuthContext';

const source = (path: string) => readFile(new URL(`../frontend/src/${path}`, import.meta.url), 'utf8');
const noop = () => {};

test('shared header renders fixed above page widgets but below checkout modals', () => {
  const html = renderToStaticMarkup(React.createElement(DonorAuthProvider, null,
    React.createElement(Header, {
      language: 'en', onLanguageChange: noop, onOpenQuickDonate: noop,
      onOpen80GSearch: noop, onOpenAbout: noop, onOpenLogin: noop,
    })));
  const header = html.match(/<header[^>]*>/)?.[0];
  assert.ok(header);
  assert.match(header, /id="main-header"/);
  assert.match(header, /fixed inset-x-0 top-0 z-\[45\]/);
  assert.doesNotMatch(header, /\bsticky\b/);
  for (const id of ['header-quick-donate-btn', 'header-menu-btn', 'header-login-btn']) {
    assert.ok(html.includes(`id="${id}"`));
  }
});

test('mobile header keeps Donate beside the menu button', async () => {
  const header = await source('components/Header.tsx');
  assert.match(header, /className="header-donate ml-auto inline-flex/);
});

test('shared footer has home-qualified section links on every public route', () => {
  const html = renderToStaticMarkup(React.createElement(Footer, {
    language: 'en', onOpen80GSearch: noop, onOpenAbout: noop, onQuickDonate: noop,
  }));
  assert.equal((html.match(/<footer\b/g) || []).length, 1);
  assert.match(html, /id="main-footer"/);
  assert.match(html, /href="\/#what-we-do-section"/);
  assert.match(html, /href="\/#shelter-census-section"/);
});

test('public header and footer are single shared siblings outside lazy-page Suspense', async () => {
  const app = ts.createSourceFile('App.tsx', await source('App.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const occurrences: Record<string, ts.Node[]> = { Header: [], Footer: [] };
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(app) in occurrences) {
      occurrences[node.tagName.getText(app)].push(node);
      let ancestor = node.parent;
      while (ancestor) {
        if (ts.isJsxElement(ancestor)) {
          assert.notEqual(ancestor.openingElement.tagName.getText(app), 'Suspense');
        }
        ancestor = ancestor.parent;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(app);
  assert.equal(occurrences.Header.length, 1);
  assert.equal(occurrences.Footer.length, 1);
  assert.equal(occurrences.Header[0].parent, occurrences.Footer[0].parent);
});

test('public pages do not add duplicate site headers or footers', async () => {
  const pages = await readdir(new URL('../frontend/src/pages/', import.meta.url));
  for (const page of pages.filter((name) => name.endsWith('.tsx') && name !== 'AdminPage.tsx')) {
    assert.doesNotMatch(await source(`pages/${page}`), /<(?:header|footer|Header|Footer)\b/, page);
  }
});

test('header row measurement drives page spacing, secondary bars and mobile scroll bounds', async () => {
  const [header, app, css, campaign, tabs] = await Promise.all([
    source('components/Header.tsx'), source('App.tsx'), source('index.css'),
    source('pages/TuesdayCampaignPage.tsx'), source('components/campaign/NavigationTabs.tsx'),
  ]);
  assert.match(header, /ref=\{headerRowRef\}/);
  assert.match(header, /row\.getBoundingClientRect\(\)\.height/);
  assert.match(header, /observer\?\.observe\(row\)/);
  assert.match(header, /observer\?\.disconnect\(\)/);
  assert.match(app, /pt-\[var\(--site-header-height\)\]/);
  assert.match(app, /<CampaignPageChrome/);
  assert.match(await source('components/campaign/CampaignPageChrome.tsx'), /top-\[var\(--site-header-height\)\]/);
  assert.doesNotMatch(campaign, /sticky top-\[var\(--site-header-height\)\]/);
  assert.match(tabs, /top-\[var\(--site-header-height\)\]/);
  assert.match(css, /scroll-padding-top: calc\(var\(--site-header-height\) \+ 12px\)/);
  assert.match(css, /\.header-mobile-panel\s*\{[^}]*100vh[^}]*100dvh[^}]*overflow-y: auto/s);
  assert.doesNotMatch(css, /overflow-x: hidden/);
});
