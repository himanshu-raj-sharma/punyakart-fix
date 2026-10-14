import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { CONTENT_SECURITY_POLICY } from '../backend/contentSecurityPolicy';

const gatewayOrigins = [
  'https://md-eecad2978f7a43f5b7838c919258e6de.ecs.us-east-2.on.aws',
  'https://bded8a3c6ae-1-1053047382554.us-central1.run.app',
  // Exact hosts observed in live production DevTools on 2026-10-14.
  'https://mpc-prod-28-1053047382554.us-central1.run.app',
  'https://mpc-prod-21-1053047382554.us-central1.run.app',
  'https://5z-2b6b7616f94640c2840d1841e1ac24c3.ecs.us-east-1.on.aws',
];
const metaSetupScript = 'https://www.facebook.com/signals/iwl.js';
const originalConnectSources = [
  "'self'",
  'https://api.razorpay.com',
  'https://lumberjack.razorpay.com',
  'https://connect.facebook.net',
  'https://www.facebook.com',
  'https://graph.facebook.com',
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://analytics.google.com',
  'https://www.google.com',
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://pagead2.googlesyndication.com',
  'https://ad.doubleclick.net',
];
const clarityScriptOrigin = 'https://www.clarity.ms';
const clarityNestedScriptOrigin = 'https://scripts.clarity.ms';
const metaParamBuilderScripts = [
  'https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js',
  'https://unpkg.com/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js',
];
const clarityConnectSources = ['https://*.clarity.ms', 'https://c.bing.com'];
const directives = CONTENT_SECURITY_POLICY.split('; ').map(value => value.split(/\s+/));
const connectSources = directives.find(([name]) => name === 'connect-src')!.slice(1);

test('connect-src permits Clarity telemetry and the exact observed Meta Pixel event endpoint', () => {
  assert.deepEqual(connectSources, [...originalConnectSources.slice(0, 6), ...clarityConnectSources, ...originalConnectSources.slice(6), ...gatewayOrigins]);
  assert.equal(directives.filter(([name]) => name === 'connect-src').length, 1);
  assert.ok(connectSources.includes('https://*.clarity.ms'));
  for (const origin of gatewayOrigins) {
    assert.ok(connectSources.includes(new URL('/events?cee=no', origin).origin));
  }
  for (const unrelated of ['https://unrelated.run.app', 'https://unrelated.ecs.us-east-2.on.aws']) {
    assert.ok(!connectSources.includes(unrelated));
  }
});

test('script directives allow exact Clarity and Meta parameter-builder scripts without broad CDN trust', () => {
  const originalScripts = "'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com https://connect.facebook.net https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://www.google.com";
  assert.ok(!directives.find(([name]) => name === 'script-src')!.includes('https://cdn.jsdelivr.net'));
  assert.ok(!directives.find(([name]) => name === 'script-src-elem')!.includes('https://unpkg.com'));
  assert.ok(!directives.find(([name]) => name === 'script-src-elem')!.includes("'unsafe-eval'"));
  assert.deepEqual(directives.filter(([name]) => name !== 'connect-src').map(parts => parts.join(' ')), [
    "default-src 'self' https://*.clarity.ms https://c.bing.com",
    "base-uri 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `script-src ${originalScripts.split(' https://www.googletagmanager.com')[0]} ${clarityScriptOrigin} ${clarityNestedScriptOrigin} https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://www.google.com ${metaSetupScript} ${metaParamBuilderScripts.join(' ')}`,
    `script-src-elem ${originalScripts.split(' https://www.googletagmanager.com')[0]} ${clarityScriptOrigin} ${clarityNestedScriptOrigin} https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://www.google.com ${metaSetupScript} ${metaParamBuilderScripts.join(' ')}`,
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com https://www.facebook.com",
  ]);
});

test('frame-src permits only the observed Facebook frame origin without a wildcard', () => {
  const frameSources = directives.find(([name]) => name === 'frame-src')!.slice(1);
  assert.equal(directives.filter(([name]) => name === 'frame-src').length, 1);
  assert.ok(frameSources.includes('https://www.facebook.com'));
  assert.ok(!frameSources.includes('https://*.facebook.com'));
  assert.ok(!frameSources.includes('https://facebook.com'));
});

test('Clarity script and privacy disclosure are present', async () => {
  const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
  assert.match(html, /https:\/\/www\.clarity\.ms\/tag\/"\+i/);
  assert.match(html, /yxk5cp47bk/);
  const legalSource = await readFile(new URL('../frontend/src/pages/LegalPage.tsx', import.meta.url), 'utf8');
  assert.match(legalSource, /Microsoft Clarity/);
});

test('Meta setup bootstrap is permitted for either Pixel without trusting all Facebook scripts', () => {
  for (const directive of ['script-src', 'script-src-elem']) {
    const sources = directives.find(([name]) => name === directive)!.slice(1);
    assert.ok(sources.includes(metaSetupScript), `${directive} must allow the setup script`);
    assert.ok(!sources.includes('https://www.facebook.com'));
    assert.ok(!sources.includes('https://*.facebook.com'));
    assert.ok(!sources.includes("'unsafe-eval'"));
    for (const pixel of ['922745934005234', '1112592431188643']) {
      // CSP path sources allow the same script with query parameters. No real token needed.
      const request = new URL(`${metaSetupScript}?pixel_id=${pixel}&from_extension=true`);
      assert.ok(sources.includes(`${request.origin}${request.pathname}`));
    }
    const previousPolicySources = sources.filter(source => source !== metaSetupScript);
    assert.ok(!previousPolicySources.includes(metaSetupScript), 'previous policy blocked the bootstrap');
  }
});

test('server wires the shared policy and retains frame protection', async () => {
  const serverSource = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /import\s*\{\s*CONTENT_SECURITY_POLICY\s*\}\s*from\s*['"]\.\/backend\/contentSecurityPolicy(?:\.js)?['"]/);
  assert.match(serverSource, /res\.setHeader\('Content-Security-Policy', CONTENT_SECURITY_POLICY\)/);
  assert.match(serverSource, /res\.setHeader\('X-Frame-Options', 'DENY'\)/);
});

test('both existing Pixels remain initialized with one shared PageView call', async () => {
  const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
  for (const id of ['922745934005234', '1112592431188643']) {
    assert.ok(html.includes(`fbq('init', '${id}')`));
  }
  assert.equal((html.match(/fbq\('track', 'PageView'\)/g) || []).length, 1);
});

test('Express can emit the complete policy as a response header', async () => {
  // Isolated HTTP fixture: no application startup, MongoDB, payments, or tracking calls.
  const app = express();
  app.get('/', (_req, res) => {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.send('CSP test');
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-security-policy'), CONTENT_SECURITY_POLICY);
    await response.text();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
