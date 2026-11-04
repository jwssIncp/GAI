import { registerDecorator, ValidationOptions } from 'class-validator';

// Preserve existing integration JSON without interpreting it as authoritative data.
const normalizeKey = (key: string) => key.replace(/[_-]/g, '').toLowerCase();
const protectedKeys = new Set(
  [
    '__proto__',
    'constructor',
    'prototype',
    'organization_id',
    'organizationId',
    'company_id',
    'companyId',
    'permissions',
    'systemRoles',
    'status',
    'password',
    'password_hash',
    'access_token',
    'refresh_token',
    'token',
    'authorization',
    'api_key',
    'secret',
    'client_secret',
    'private_key',
    'credentials',
  ].map(normalizeKey),
);
export function isProjectJson(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const visit = (node: unknown, depth: number): boolean => {
    if (depth > 8) return false;
    if (node === null || typeof node === 'string' || typeof node === 'boolean')
      return true;
    if (typeof node === 'number') return Number.isFinite(node);
    if (Array.isArray(node))
      return node.every((item) => visit(item, depth + 1));
    return (
      typeof node === 'object' &&
      Object.entries(node).every(
        ([key, item]) =>
          !protectedKeys.has(normalizeKey(key)) && visit(item, depth + 1),
      )
    );
  };
  try {
    return (
      Buffer.byteLength(JSON.stringify(value), 'utf8') <= 16384 &&
      visit(value, 0)
    );
  } catch {
    return false;
  }
}
export function IsProjectJson(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isProjectJson',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message:
          'Invalid project JSON: protected keys, excessive size/depth or unsupported values',
        ...options,
      },
      validator: { validate: isProjectJson },
    });
}
