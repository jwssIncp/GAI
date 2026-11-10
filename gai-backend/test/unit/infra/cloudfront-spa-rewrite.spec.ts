import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';

const terraform = join(__dirname, '../../../../infra/terraform');

type Handler = (event: { request: { uri: string } }) => { uri: string };
// Runs the exact function source shipped to CloudFront in an isolated context.
const handler = runInNewContext(
  `${readFileSync(join(terraform, 'functions/spa-rewrite.js'), 'utf8')}; handler;`,
) as Handler;
const rewrite = (uri: string) => handler({ request: { uri } }).uri;

describe('CloudFront SPA fallback (static infra regression)', () => {
  it('rewrites client routes to index.html and keeps assets and API paths', () => {
    expect(rewrite('/')).toBe('/index.html');
    expect(rewrite('/app/projects/97')).toBe('/index.html');
    expect(rewrite('/reset-password')).toBe('/index.html');
    expect(rewrite('/assets/index-3f2a.js')).toBe('/assets/index-3f2a.js');
    expect(rewrite('/favicon.ico')).toBe('/favicon.ico');
    expect(rewrite('/api/v1/projects/999')).toBe('/api/v1/projects/999');
  });

  it('never rewrites API errors into HTML', () => {
    const cloudfront = readFileSync(join(terraform, 'cloudfront.tf'), 'utf8');
    // Distribution-wide error pages would also apply to /api/*.
    expect(cloudfront).not.toMatch(/^\s*custom_error_response\s*\{/m);
    const api = cloudfront.match(
      /ordered_cache_behavior\s*\{[^}]*path_pattern\s*=\s*"\/api\/\*"[^}]*\}/,
    );
    expect(api).not.toBeNull();
    expect(api![0]).not.toMatch(/function_association/);
    expect(cloudfront).toMatch(
      /default_cache_behavior[\s\S]*function_association[\s\S]*spa_rewrite/,
    );
  });
});
