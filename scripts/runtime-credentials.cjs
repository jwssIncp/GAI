'use strict';

// No dotenv loading or hardcoded fallback: callers supply credentials at runtime.
function requireCredential(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing runtime credential: ${name}`);
  return value;
}

function adminPassword() {
  return requireCredential(
    process.env.SEED_ORG_ADMIN_PASSWORD
      ? 'SEED_ORG_ADMIN_PASSWORD'
      : 'SEED_ADMIN_PASSWORD',
  );
}

module.exports = { requireCredential, adminPassword };
