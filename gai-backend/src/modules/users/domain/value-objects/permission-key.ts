const PERMISSION_KEY_PATTERN = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;

export class PermissionKey {
  private constructor(private readonly value: string) {}

  static create(key: string): PermissionKey {
    const normalized = key.trim().toLowerCase();
    if (!PERMISSION_KEY_PATTERN.test(normalized)) {
      throw new Error(`Invalid permission key format: ${key}`);
    }
    return new PermissionKey(normalized);
  }

  static fromPersisted(key: string): PermissionKey {
    return new PermissionKey(key);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: PermissionKey): boolean {
    return this.value === other.value;
  }
}
