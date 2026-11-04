export const syntheticStorageEnv = () => ({
  ...process.env,
  NODE_ENV: 'test',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'gai-validation',
  AWS_SECRET_ACCESS_KEY: 'gai-validation-only',
  AWS_SESSION_TOKEN: undefined,
  STORAGE_PROVIDER: 's3',
  STORAGE_BUCKET: 'gai-isolated-tests',
  INVENTORY_ITEM_IMAGE_STORAGE_BUCKET: 'gai-isolated-tests',
  STORAGE_ENDPOINT_URL: 'http://127.0.0.1:33318',
  STORAGE_FORCE_PATH_STYLE: 'true',
  STORAGE_MAX_SIZE_BYTES: '52428800',
  STORAGE_PRESIGNED_URL_TTL_SECONDS: '300',
  STORAGE_ALLOWED_MIME_TYPES:
    'image/png,application/pdf,application/json,text/plain,application/octet-stream',
});
