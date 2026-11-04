const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createService, IMAGE, ENDPOINT } = require("./ci-s3.cjs");

function fixture(options = {}) {
  const calls = [],
    messages = [],
    delays = [];
  let present = options.present ?? false;
  let probes = 0;
  const docker = (args) => {
    calls.push(args);
    switch (args[0]) {
      case "container":
        return present ? "isolated-container-id" : "";
      case "pull":
        if (options.pullFailure) throw new Error("Registry unavailable");
        return "";
      case "run":
        present = true;
        if (options.runFailure) throw new Error("Port is already allocated");
        return "isolated-container-id";
      case "inspect":
        return args.includes("{{json .State}}")
          ? JSON.stringify({ Running: options.running ?? true, ExitCode: 7 })
          : (options.owner ?? "disposable");
      case "logs":
        return "fixture diagnostic gai-validation-only";
      case "rm":
        if (options.cleanupFailure)
          throw new Error("Docker removal unavailable");
        present = false;
        return "";
      default:
        throw new Error("Unexpected docker command");
    }
  };
  const service = createService({
    docker,
    probe: async () => {
      probes++;
      const status = options.statuses?.[probes - 1] ?? options.status ?? 200;
      if (status instanceof Error) throw status;
      return status;
    },
    sleep: async (ms) => {
      delays.push(ms);
    },
    log: (message) => messages.push(message),
  });
  return {
    service,
    calls,
    messages,
    delays,
    probes: () => probes,
    present: () => present,
  };
}

test("pulls an immutable release and starts only loopback storage with synthetic credentials", async () => {
  const f = fixture();
  await f.service.start();
  assert.match(
    IMAGE,
    /^docker\.io\/pgsty\/silo:RELEASE\.[^@]+@sha256:[0-9a-f]{64}$/,
  );
  assert.deepEqual(
    f.calls.find((c) => c[0] === "pull"),
    ["pull", IMAGE],
  );
  const run = f.calls.find((c) => c[0] === "run");
  assert.equal(run[run.indexOf("-p") + 1], "127.0.0.1:33318:9000");
  assert.ok(run.includes("MINIO_ROOT_USER=gai-validation"));
  assert.ok(run.includes("MINIO_ROOT_PASSWORD=gai-validation-only"));
  assert.ok(run.includes("/data:rw,size=1073741824"));
  assert.ok(run.includes("io.gai.ci.s3=disposable"));
  assert.deepEqual(run.slice(-3), [IMAGE, "server", "/data"]);
  assert.equal(ENDPOINT, "http://127.0.0.1:33318");
  assert.ok(f.calls.findIndex((c) => c[0] === "pull") < f.calls.indexOf(run));
  assert.equal(f.probes(), 1);
  assert.equal(f.present(), true);
});

test("retries connection errors and non-ready responses before accepting HTTP 200", async () => {
  const f = fixture({ statuses: [new Error("Connection refused"), 503, 200] });
  await f.service.start();
  assert.equal(f.probes(), 3);
  assert.deepEqual(f.delays, [1000, 1000]);
  assert.ok(f.messages.some((m) => m.includes("attempt 3/30")));
});

test("bounds readiness to 30 attempts, diagnoses and removes failed storage", async () => {
  const f = fixture({ status: 503 });
  await assert.rejects(
    f.service.start(),
    /readiness failed after 30 bounded attempts/,
  );
  assert.equal(f.probes(), 30);
  assert.equal(f.delays.length, 29);
  assert.equal(f.present(), false);
  assert.ok(f.calls.some((c) => c[0] === "logs"));
  assert.ok(f.messages.join("\n").includes("[REDACTED]"));
  assert.ok(!f.messages.join("\n").includes("gai-validation-only"));
});

test("detects an exited container before probing and preserves its failure", async () => {
  const f = fixture({ running: false });
  await assert.rejects(f.service.start(), /exited before readiness \(exit 7\)/);
  assert.equal(f.probes(), 0);
  assert.equal(f.present(), false);
});

test("cleans a container left by a failed docker run", async () => {
  const f = fixture({ runFailure: true });
  await assert.rejects(f.service.start(), /Port is already allocated/);
  assert.equal(f.present(), false);
});

test("fails on registry errors without starting a container", async () => {
  const f = fixture({ pullFailure: true });
  await assert.rejects(f.service.start(), /Registry unavailable/);
  assert.ok(!f.calls.some((c) => c[0] === "run"));
});

test("refuses to replace an existing container", async () => {
  const f = fixture({ present: true });
  await assert.rejects(f.service.start(), /already exists/);
  assert.ok(!f.calls.some((c) => ["run", "pull", "rm"].includes(c[0])));
});

test("cleanup is idempotent and removes volumes only for marked CI storage", () => {
  const absent = fixture();
  absent.service.cleanup();
  assert.ok(!absent.calls.some((c) => c[0] === "rm"));
  const own = fixture({ present: true });
  own.service.cleanup();
  assert.deepEqual(
    own.calls.find((c) => c[0] === "rm"),
    ["rm", "-f", "-v", "gai-ci-s3"],
  );
  own.service.cleanup();
  assert.equal(own.calls.filter((c) => c[0] === "rm").length, 1);
  const unrelated = fixture({ present: true, owner: "unrelated" });
  assert.throws(
    () => unrelated.service.cleanup(),
    /Refusing to remove unrelated/,
  );
  assert.ok(!unrelated.calls.some((c) => c[0] === "rm"));
});

test("cleanup errors fail explicitly and do not hide an earlier startup failure", async () => {
  const f = fixture({ status: 503, cleanupFailure: true });
  await assert.rejects(f.service.start(), /readiness failed/);
  assert.ok(f.messages.some((m) => m.includes("Docker removal unavailable")));
  assert.throws(() => f.service.cleanup(), /Docker removal unavailable/);
});
