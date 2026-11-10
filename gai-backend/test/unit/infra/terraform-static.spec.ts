import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Static safety net while `terraform validate` is unavailable locally (the CI
// infra workflow still runs fmt/validate/plan). Catches undeclared variables,
// references to missing resources/locals and unbalanced blocks.
const dir = join(__dirname, '../../../../infra/terraform');
const files = readdirSync(dir).filter((f) => f.endsWith('.tf'));
const sources = Object.fromEntries(
  files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]),
);
const all = Object.values(sources).join('\n');
const stripComments = (text: string) => text.replace(/^\s*#.*$/gm, '');

describe('Terraform static checks (Onda 5.1)', () => {
  it('has balanced blocks in every file', () => {
    for (const [file, text] of Object.entries(sources)) {
      const code = stripComments(text);
      for (const [open, close] of [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ])
        expect([file, code.split(open).length]).toEqual([
          file,
          code.split(close).length,
        ]);
    }
  });

  it('references only declared variables, resources and locals', () => {
    // `moved { from = ... }` intentionally names old addresses.
    const code = stripComments(all).replace(/^\s*from\s*=.*$/gm, '');
    const declaredVars = new Set(
      [...all.matchAll(/^variable "([a-z0-9_]+)"/gm)].map((m) => m[1]),
    );
    const usedVars = new Set(
      [...code.matchAll(/\bvar\.([a-z0-9_]+)/g)].map((m) => m[1]),
    );
    expect([...usedVars].filter((v) => !declaredVars.has(v))).toEqual([]);

    const resources = new Set(
      [...all.matchAll(/^resource "([a-z0-9_]+)" "([a-z0-9_]+)"/gm)].map(
        (m) => `${m[1]}.${m[2]}`,
      ),
    );
    const refs = new Set(
      [
        ...code.matchAll(
          /(?<![\w."/-])(aws_[a-z0-9_]+|random_[a-z0-9_]+)\.([a-z0-9_]+)(?=[.[\s,)\]}])/g,
        ),
      ].map((m) => `${m[1]}.${m[2]}`),
    );
    expect([...refs].filter((r) => !resources.has(r))).toEqual([]);

    const locals = new Set<string>();
    for (const block of all.matchAll(/^locals \{([\s\S]*?)^\}/gm))
      for (const m of block[1].matchAll(/^ {2}([a-z0-9_]+)\s*=/gm))
        locals.add(m[1]);
    const usedLocals = new Set(
      [...code.matchAll(/\blocal\.([a-z0-9_]+)/g)].map((m) => m[1]),
    );
    expect([...usedLocals].filter((l) => !locals.has(l))).toEqual([]);
  });

  it('keeps risky switches off by default and backups on', () => {
    const variable = (name: string) =>
      all.match(new RegExp(`variable "${name}" \\{[\\s\\S]*?\\n\\}`))![0];
    expect(variable('alb_enforce_origin_header')).toMatch(
      /default\s*=\s*false/,
    );
    expect(variable('mobile_retention_schedule_enabled')).toMatch(
      /default\s*=\s*false/,
    );
    expect(variable('alb_http_origin_enabled')).toMatch(/default\s*=\s*true/);
    expect(variable('db_backup_retention_days')).toMatch(/production/);
    for (const env of ['homolog', 'production']) {
      const tfvars = readFileSync(join(dir, 'env', `${env}.tfvars`), 'utf8');
      expect(
        Number(tfvars.match(/^db_backup_retention_days\s*=\s*(\d+)/m)![1]),
      ).toBeGreaterThanOrEqual(7);
    }
    // The CloudFront API origin always sends the active secret; the ALB
    // accepts both slots so a rotation never rejects in-flight traffic.
    expect(sources['cloudfront.tf']).toMatch(
      /custom_header \{[\s\S]*?value = local\.origin_verify_active/,
    );
    const origin = sources['origin_protection.tf'];
    expect(origin).toMatch(
      /origin_verify_values = \[random_password\.origin_verify_a\.result, random_password\.origin_verify_b\.result\]/,
    );
    expect(
      origin.match(/values\s+= local\.origin_verify_values/g),
    ).toHaveLength(2);
    // Secrets never leave the state: no outputs or SSM parameters carry them.
    for (const [file, text] of Object.entries(sources))
      if (file !== 'origin_protection.tf')
        expect([file, /origin_verify_(a|b)\.result/.test(text)]).toEqual([
          file,
          false,
        ]);
  });

  it('confines snapshot deletion to non-production pre-release snapshots', () => {
    const iam = sources['iam_github_oidc.tf'];
    const retention = iam.match(
      /resource "aws_iam_role_policy" "github_actions_snapshot_retention" \{[\s\S]*?\n\}/,
    )![0];
    expect(retention).toMatch(
      /count = var\.environment == "production" \? 0 : 1/,
    );
    expect(retention).toMatch(/pre-release-\*/);
    expect(retention).toMatch(/"aws:ResourceTag\/Purpose" = "pre-release"/);
    expect(iam.match(/rds:DeleteDBSnapshot/g)).toHaveLength(1);
  });
});
