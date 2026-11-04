const { spawnSync } = require("node:child_process");

// Public, multi-platform OCI index for Silo RELEASE.2026-10-26T00-00-00Z.
// Silo preserves MinIO's S3 API, MINIO_* configuration and health routes.
const IMAGE =
  "docker.io/pgsty/silo:RELEASE.2026-10-26T00-00-00Z@sha256:7bb2aff6b89efe1cb1303c10fc21d579447434ed06649ac9ec05a5e2dbf30ad7";
const CONTAINER = "gai-ci-s3";
const ENDPOINT = "http://127.0.0.1:33318";
const OWNER_LABEL = "io.gai.ci.s3";
const ACCESS_KEY = "gai-validation";
const SECRET_KEY = "gai-validation-only";
const redact = (text) => String(text).replaceAll(SECRET_KEY, "[REDACTED]");

function runDocker(args, timeout = 10000) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      redact(
        `docker ${args[0]} failed: ${result.error?.message || result.stderr || `exit ${result.status}`}`,
      ),
    );
  }
  return args[0] === "logs"
    ? result.stdout + result.stderr
    : result.stdout.trim();
}

function createService({
  docker = runDocker,
  probe = async () => {
    const response = await fetch(`${ENDPOINT}/minio/health/ready`, {
      signal: AbortSignal.timeout(2000),
      redirect: "error",
    });
    return response.status;
  },
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = (message) => console.log(redact(message)),
} = {}) {
  const exists = () =>
    !!docker([
      "container",
      "ls",
      "-a",
      "--filter",
      `name=^/${CONTAINER}$`,
      "--format",
      "{{.ID}}",
    ]);
  const owned = () =>
    docker([
      "inspect",
      "--type",
      "container",
      "--format",
      `{{index .Config.Labels "${OWNER_LABEL}"}}`,
      CONTAINER,
    ]) === "disposable";

  function diagnostics() {
    if (!exists()) {
      log(
        "No disposable S3 container exists. Check the pull/start error above.",
      );
      return;
    }
    if (!owned())
      throw new Error(`Refusing to inspect unrelated container ${CONTAINER}`);
    // Never dump Config.Env or the complete docker inspect response.
    log(
      docker([
        "inspect",
        "--type",
        "container",
        "--format",
        "{{json .State}}",
        CONTAINER,
      ]),
    );
    log(redact(docker(["logs", "--tail", "80", CONTAINER])));
  }

  function cleanup() {
    if (!exists()) return;
    if (!owned())
      throw new Error(`Refusing to remove unrelated container ${CONTAINER}`);
    docker(["rm", "-f", "-v", CONTAINER], 20000);
    log("Disposable S3 container and volumes removed.");
  }

  async function start() {
    if (exists())
      throw new Error(
        `Container ${CONTAINER} already exists; refusing to replace it`,
      );
    log(`Pulling pinned CI storage image: ${IMAGE}`);
    // Explicit pull validates registry availability even on hosts with a cache.
    docker(["pull", IMAGE], 120000);
    try {
      docker(
        [
          "run",
          "-d",
          "--name",
          CONTAINER,
          "--label",
          `${OWNER_LABEL}=disposable`,
          "--tmpfs",
          "/data:rw,size=1073741824",
          "-p",
          "127.0.0.1:33318:9000",
          "-e",
          `MINIO_ROOT_USER=${ACCESS_KEY}`,
          "-e",
          `MINIO_ROOT_PASSWORD=${SECRET_KEY}`,
          IMAGE,
          "server",
          "/data",
        ],
        30000,
      );
      for (let attempt = 1; attempt <= 30; attempt++) {
        const state = JSON.parse(
          docker([
            "inspect",
            "--type",
            "container",
            "--format",
            "{{json .State}}",
            CONTAINER,
          ]),
        );
        if (!state.Running)
          throw new Error(
            `Disposable S3 exited before readiness (exit ${state.ExitCode})`,
          );
        let status;
        try {
          status = await probe();
        } catch {
          status = "connection unavailable";
        }
        if (status === 200) {
          log(`Disposable S3 ready at ${ENDPOINT} (attempt ${attempt}/30).`);
          return;
        }
        log(
          `Waiting for disposable S3: attempt ${attempt}/30, HTTP ${status}.`,
        );
        if (attempt < 30) await sleep(1000);
      }
      throw new Error(
        `Disposable S3 readiness failed after 30 bounded attempts at ${ENDPOINT}`,
      );
    } catch (error) {
      for (const action of [diagnostics, cleanup]) {
        try {
          action();
        } catch (failure) {
          log(redact(failure.message));
        }
      }
      throw error;
    }
  }
  return { start, cleanup, diagnostics };
}

if (require.main === module) {
  const command = process.argv[2];
  if (!["start", "diagnostics", "cleanup"].includes(command)) {
    console.error("Usage: node ci-s3.cjs start|diagnostics|cleanup");
    process.exitCode = 1;
  } else {
    Promise.resolve()
      .then(() => createService()[command]())
      .catch((error) => {
        console.error(redact(error.message));
        process.exitCode = 1;
      });
  }
}

module.exports = { createService, IMAGE, CONTAINER, ENDPOINT };
