#!/usr/bin/env node
// Retention of the manual pre-release RDS snapshots created by
// rds-pre-release-snapshot.sh. A snapshot is deletable only when ALL hold:
//   - manual snapshot of RDS_INSTANCE_ID, status "available"
//   - identifier exactly "<instance>-pre-release-<run>-<attempt>"
//   - tags Purpose=pre-release and Environment=<ENV_NAME>
//   - older than RETENTION_DAYS (default 30) and not among the KEEP_LATEST
//     (default 3) newest pre-release snapshots
// Production is refused. Dry-run unless APPLY=1 (the workflow sets it only
// after the operator typed APLICAR). Prints a JSON report (job log + summary).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

function aws(args) {
  // Identifiers never contain spaces; the shell is only needed on Windows (.cmd).
  return execFileSync('aws', args, { encoding: 'utf8', shell: process.platform === 'win32' });
}

function plan({ snapshots, instance, env, retentionDays, keepLatest, now }) {
  const pattern = new RegExp(`^${instance.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-pre-release-\\d+-\\d+$`);
  const tag = (s, key) => (s.TagList ?? []).find((t) => t.Key === key)?.Value;
  const ours = snapshots
    .filter(
      (s) =>
        s.SnapshotType === 'manual' &&
        s.DBInstanceIdentifier === instance &&
        pattern.test(s.DBSnapshotIdentifier) &&
        tag(s, 'Purpose') === 'pre-release' &&
        tag(s, 'Environment') === env,
    )
    .sort((a, b) => new Date(b.SnapshotCreateTime) - new Date(a.SnapshotCreateTime));
  const cutoff = now - retentionDays * 86400000;
  const keptIds = new Set(ours.slice(0, keepLatest).map((s) => s.DBSnapshotIdentifier));
  const decisions = ours.map((s) => {
    const reason = keptIds.has(s.DBSnapshotIdentifier)
      ? 'keep: among the newest'
      : s.Status !== 'available'
        ? `keep: status ${s.Status}`
        : new Date(s.SnapshotCreateTime).getTime() >= cutoff
          ? 'keep: within retention'
          : 'delete';
    return { id: s.DBSnapshotIdentifier, created: s.SnapshotCreateTime, action: reason };
  });
  const ignored = snapshots.length - ours.length;
  return { decisions, ignored };
}

function main() {
  const instance = process.env.RDS_INSTANCE_ID;
  const env = process.env.ENV_NAME;
  if (!instance || !env) throw new Error('RDS_INSTANCE_ID and ENV_NAME are required');
  if (env === 'production' || /prod/i.test(instance))
    throw new Error('Refusing to manage production snapshots');
  const retentionDays = Number(process.env.RETENTION_DAYS ?? 30);
  const keepLatest = Number(process.env.KEEP_LATEST ?? 3);
  if (!Number.isInteger(retentionDays) || retentionDays < 7) throw new Error('RETENTION_DAYS must be an integer >= 7');
  if (!Number.isInteger(keepLatest) || keepLatest < 1) throw new Error('KEEP_LATEST must be >= 1');
  const apply = process.env.APPLY === '1';

  const snapshots = JSON.parse(
    aws(['rds', 'describe-db-snapshots', '--db-instance-identifier', instance, '--snapshot-type', 'manual', '--output', 'json']),
  ).DBSnapshots;
  const { decisions, ignored } = plan({ snapshots, instance, env, retentionDays, keepLatest, now: Date.now() });
  for (const d of decisions)
    if (d.action === 'delete' && apply) {
      aws(['rds', 'delete-db-snapshot', '--db-snapshot-identifier', d.id, '--output', 'json']);
      d.action = 'deleted';
    }
  const report = { env, instance, apply, retention_days: retentionDays, keep_latest: keepLatest, ignored_not_pre_release: ignored, decisions };
  const text = JSON.stringify(report, null, 2);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### RDS pre-release snapshots\n\`\`\`json\n${text}\n\`\`\`\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { plan };
