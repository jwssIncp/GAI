// Deploy safety contract (Onda 5.1): approval, verified RDS snapshot before
// migrations, migrations before the ECS update, no concurrent release/ops
// tasks, and fail-closed scripts. Runs the real bash scripts against a fake
// `aws`/`jq` on PATH (no AWS call).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const yaml = require(require.resolve('js-yaml', { paths: [path.join(root, 'gai-backend')] }));
const workflow = (name) =>
  yaml.load(fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8'));

test('deploy requires approval, then snapshot -> release -> ECS update, in one release lane', () => {
  const app = workflow('deploy-app.yml');
  const call = app.on.workflow_call ?? app[true]?.workflow_call;
  assert.equal(call.inputs.release_confirmation.required, true);
  const job = app.jobs.deploy;
  assert.equal(job.concurrency.group, 'gai-release-${{ inputs.environment }}');
  assert.equal(job.concurrency['cancel-in-progress'], false);
  const names = job.steps.map((s) => s.name ?? s.uses);
  const at = (needle) => names.findIndex((n) => String(n).includes(needle));
  assert.equal(at('Require explicit release approval'), 0);
  assert.ok(job.steps[0].run.includes('APLICAR'));
  const snapshot = at('Verified RDS snapshot');
  const release = at('Release (migrations');
  const update = at('Update ECS service');
  assert.ok(snapshot > 0 && snapshot < release && release < update, names.join(' | '));
  assert.ok(job.steps[snapshot].run.includes('rds-pre-release-snapshot.sh'));
  for (const s of job.steps.slice(0, update)) assert.notEqual(s['continue-on-error'], true);

  for (const name of ['deploy-homolog.yml', 'deploy-production.yml']) {
    const wf = workflow(name);
    const dispatch = (wf.on ?? wf[true]).workflow_dispatch;
    assert.equal(dispatch.inputs.confirm.required, true, name);
    assert.equal(wf.jobs.deploy.with.release_confirmation, '${{ inputs.confirm }}', name);
  }
  for (const name of ['ops-mobile.yml', 'ops-reset-admin.yml'])
    assert.equal(workflow(name).concurrency.group, 'gai-release-${{ inputs.environment }}', name);
  const ops = workflow('ops-mobile.yml');
  assert.deepEqual((ops.on ?? ops[true]).workflow_dispatch.inputs.environment.options, ['homolog']);
});

function fakeBin() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gai-fake-aws-'));
  const log = path.join(dir, 'calls.log');
  fs.writeFileSync(
    path.join(dir, 'aws'),
    `#!/usr/bin/env bash
echo "$*" >> "${log.replace(/\\/g, '/')}"
case "$*" in
  *"ecs list-tasks"*"--family"*) echo "\${FAKE_RUNNING_FAMILY:-0}" ;;
  *"ecs list-tasks"*) echo "\${FAKE_RUNNING:-0}" ;;
  *"rds describe-db-snapshots"*"--snapshot-type"*) cat "\${FAKE_SNAPSHOTS_JSON}" ;;
  *"rds delete-db-snapshot"*) echo "{}" ;;
  *"ecs run-task"*) echo "arn:aws:ecs:us-east-1:1:task/c/fake" ;;
  *"ecs describe-tasks"*lastStatus*) echo "\${FAKE_LAST_STATUS:-STOPPED}" ;;
  *"ecs describe-tasks"*exitCode*) echo "\${FAKE_EXIT_CODE:-0}" ;;
  *"ecs describe-tasks"*stoppedReason*) echo "Essential container exited" ;;
  *"logs get-log-events"*) echo "fake log" ;;
  *"rds describe-db-instances"*) echo "\${FAKE_DB_STATUS:-available}" ;;
  *"rds create-db-snapshot"*) [[ -n "\${FAKE_CREATE_FAIL:-}" ]] && exit 254; echo "snap" ;;
  *"rds describe-db-snapshots"*) echo "\${FAKE_SNAPSHOT_STATUS:-available}" ;;
  *) echo "unexpected aws call: $*" >&2; exit 99 ;;
esac
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(dir, 'jq'), '#!/usr/bin/env bash\necho "{}"\n', { mode: 0o755 });
  // Windows: lets Node-launched commands (retention CLI) reach the bash fake.
  fs.writeFileSync(path.join(dir, 'aws.cmd'), '@bash "%~dp0aws" %*\r\n');
  return { dir, log };
}

function run(script, env) {
  const { dir, log } = fakeBin();
  const output = path.join(dir, 'github-output');
  const result = spawnSync('bash', [path.join(__dirname, script)], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}${path.delimiter}${process.env.PATH}`,
      ECS_CLUSTER: 'c',
      ECS_TASK_DEFINITION: 'fam-release',
      ECS_SUBNETS: 's1',
      ECS_SECURITY_GROUPS: 'g1',
      AWS_REGION: 'us-east-1',
      RDS_INSTANCE_ID: 'gai-homolog-db',
      ENV_NAME: 'homolog',
      GITHUB_RUN_ID: '42',
      GITHUB_OUTPUT: output,
      RELEASE_POLL_SECONDS: '0',
      SNAPSHOT_POLL_SECONDS: '0',
      ...env,
    },
  });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  const out = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
  return { status: result.status, stdout: result.stdout + result.stderr, calls, out };
}

test('release task: success only with exit code 0; failures stop the deploy', () => {
  const ok = run('ecs-run-migrations.sh', {});
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.calls, /run-task .*--started-by gai-release/);

  const failed = run('ecs-run-migrations.sh', { FAKE_EXIT_CODE: '1' });
  assert.equal(failed.status, 1);
  const neverStarted = run('ecs-run-migrations.sh', { FAKE_EXIT_CODE: 'None' });
  assert.equal(neverStarted.status, 1);
});

test('release task refuses to run concurrently and never proceeds on timeout', () => {
  const busy = run('ecs-run-migrations.sh', { FAKE_RUNNING: '1' });
  assert.equal(busy.status, 1);
  assert.doesNotMatch(busy.calls, /run-task/);

  // A scheduled retention run (same -release family, no started-by tag).
  const scheduled = run('ecs-run-migrations.sh', { FAKE_RUNNING_FAMILY: '1', ECS_TASK_FAMILY: 'gai-homolog' });
  assert.equal(scheduled.status, 1);
  assert.match(scheduled.calls, /list-tasks .*--family gai-homolog-release/);
  assert.doesNotMatch(scheduled.calls, /run-task/);

  const stuck = run('ecs-run-migrations.sh', {
    FAKE_LAST_STATUS: 'RUNNING',
    RELEASE_TIMEOUT_SECONDS: '0',
  });
  assert.equal(stuck.status, 1);
  assert.match(stuck.stdout, /Not updating the service/);
});

test('snapshot is verified available before the release, otherwise fails closed', () => {
  const ok = run('rds-pre-release-snapshot.sh', {});
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.calls, /create-db-snapshot .*gai-homolog-db-pre-release-42-1/);
  assert.match(ok.out, /snapshot_id=gai-homolog-db-pre-release-42-1/);

  for (const env of [
    { FAKE_DB_STATUS: 'modifying' },
    { FAKE_CREATE_FAIL: '1' },
    { FAKE_SNAPSHOT_STATUS: 'failed' },
    { FAKE_SNAPSHOT_STATUS: 'creating', SNAPSHOT_TIMEOUT_SECONDS: '0' },
  ]) {
    const failed = run('rds-pre-release-snapshot.sh', env);
    assert.notEqual(failed.status, 0, JSON.stringify(env));
    assert.doesNotMatch(failed.out, /snapshot_id=/);
  }
  const missing = run('rds-pre-release-snapshot.sh', { RDS_INSTANCE_ID: '' });
  assert.notEqual(missing.status, 0);
});

// ---- Pre-release snapshot retention (Onda 5.2) ----
const { plan } = require('./rds-snapshot-retention.cjs');
const day = 86400000;
const NOW = Date.parse('2026-12-31T00:00:00Z');
const snap = (id, daysAgo, extra = {}) => ({
  DBSnapshotIdentifier: id,
  DBInstanceIdentifier: 'gai-homolog-db',
  SnapshotType: 'manual',
  Status: 'available',
  SnapshotCreateTime: new Date(NOW - daysAgo * day).toISOString(),
  TagList: [
    { Key: 'Purpose', Value: 'pre-release' },
    { Key: 'Environment', Value: 'homolog' },
  ],
  ...extra,
});
const fixtureSnapshots = () => [
  snap('gai-homolog-db-pre-release-10-1', 1),
  snap('gai-homolog-db-pre-release-9-1', 2),
  snap('gai-homolog-db-pre-release-8-1', 3),
  snap('gai-homolog-db-pre-release-7-1', 45), // old: delete
  snap('gai-homolog-db-pre-release-6-2', 60, { Status: 'creating' }), // not available
  snap('gai-homolog-db-pre-release-5-1', 90, { TagList: [] }), // untagged: ignored
  snap('gai-homolog-db-pre-release-4-1', 90, { TagList: [{ Key: 'Purpose', Value: 'pre-release' }, { Key: 'Environment', Value: 'production' }] }),
  snap('gai-homolog-db-manual-backup', 400, {}), // other name: ignored
  snap('rds:gai-homolog-db-2026-10-01', 90, { SnapshotType: 'automated' }), // automated: ignored
];

test('snapshot retention deletes only old, tagged, available pre-release snapshots', () => {
  const { decisions, ignored } = plan({
    snapshots: fixtureSnapshots(),
    instance: 'gai-homolog-db',
    env: 'homolog',
    retentionDays: 30,
    keepLatest: 3,
    now: NOW,
  });
  const byId = Object.fromEntries(decisions.map((d) => [d.id, d.action]));
  assert.deepEqual(
    decisions.filter((d) => d.action === 'delete').map((d) => d.id),
    ['gai-homolog-db-pre-release-7-1'],
  );
  assert.equal(byId['gai-homolog-db-pre-release-6-2'], 'keep: status creating');
  assert.equal(byId['gai-homolog-db-pre-release-10-1'], 'keep: among the newest');
  assert.equal(ignored, 4);
  // Even if everything is old, the newest KEEP_LATEST survive.
  const allOld = plan({ snapshots: fixtureSnapshots(), instance: 'gai-homolog-db', env: 'homolog', retentionDays: 30, keepLatest: 3, now: NOW + 365 * day });
  assert.equal(allOld.decisions.filter((d) => d.action.startsWith('keep: among')).length, 3);
});

test('snapshot retention CLI: dry-run by default, deletes only with APPLY=1, refuses production', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gai-snapshots-'));
  const json = path.join(dir, 'snapshots.json');
  // Ages relative to the real clock for the CLI run.
  const live = fixtureSnapshots().map((s) => ({
    ...s,
    SnapshotCreateTime: new Date(Date.now() - (NOW - Date.parse(s.SnapshotCreateTime))).toISOString(),
  }));
  fs.writeFileSync(json, JSON.stringify({ DBSnapshots: live }));
  const cli = (env) => {
    const { dir: bin, log } = fakeBin();
    const r = spawnSync(process.execPath, [path.join(__dirname, 'rds-snapshot-retention.cjs')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        RDS_INSTANCE_ID: 'gai-homolog-db',
        ENV_NAME: 'homolog',
        FAKE_SNAPSHOTS_JSON: json,
        GITHUB_STEP_SUMMARY: '',
        ...env,
      },
    });
    return { status: r.status, out: r.stdout + r.stderr, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
  };
  const dry = cli({});
  assert.equal(dry.status, 0, dry.out);
  assert.doesNotMatch(dry.calls, /delete-db-snapshot/);
  assert.match(dry.out, /"apply": false/);
  const applied = cli({ APPLY: '1' });
  assert.equal(applied.status, 0, applied.out);
  assert.equal((applied.calls.match(/delete-db-snapshot/g) ?? []).length, 1);
  assert.match(applied.calls, /delete-db-snapshot --db-snapshot-identifier gai-homolog-db-pre-release-7-1/);
  for (const env of [{ ENV_NAME: 'production' }, { RDS_INSTANCE_ID: 'gai-production-db' }, { RETENTION_DAYS: '3' }]) {
    const refused = cli({ ...env, APPLY: '1' });
    assert.equal(refused.status, 1, JSON.stringify(env));
    assert.doesNotMatch(refused.calls, /delete-db-snapshot/);
  }
});

test('snapshot retention workflow: homolog only, release lane, deletion only with APLICAR', () => {
  const wf = workflow('ops-rds-snapshots.yml');
  const dispatch = (wf.on ?? wf[true]).workflow_dispatch;
  assert.deepEqual(dispatch.inputs.environment.options, ['homolog']);
  assert.equal(dispatch.inputs.confirm.default, '');
  assert.equal(wf.concurrency.group, 'gai-release-${{ inputs.environment }}');
  const step = wf.jobs.retention.steps.find((s) => s.name === 'Apply retention');
  assert.equal(step.env.APPLY, "${{ inputs.confirm == 'APLICAR' && '1' || '0' }}");
});
