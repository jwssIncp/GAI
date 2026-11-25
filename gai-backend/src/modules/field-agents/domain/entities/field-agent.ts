import { FieldAgentStatus } from '../enums/field-agent-status.enum';

export type JsonRecord = Record<string, unknown>;

export interface FieldAgentProps {
  id: number;
  organizationId: number;
  userId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  state: string | null;
  /** Cidade de residência (texto livre). */
  city?: string | null;
  /** Quem indicou o inventariante (texto livre). */
  referral?: string | null;
  status: FieldAgentStatus;
  metadata: JsonRecord | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class FieldAgent {
  constructor(private readonly props: FieldAgentProps) {
    if (props.name.trim().length < 2) {
      throw new Error('O nome deve ter pelo menos 2 caracteres.');
    }
  }

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get userId(): number | null {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string | null {
    return this.props.email;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get document(): string | null {
    return this.props.document;
  }

  get state(): string | null {
    return this.props.state;
  }

  get city(): string | null {
    return this.props.city ?? null;
  }

  get referral(): string | null {
    return this.props.referral ?? null;
  }

  get status(): FieldAgentStatus {
    return this.props.status;
  }

  get metadata(): JsonRecord | null {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  isActive(): boolean {
    return this.props.status === FieldAgentStatus.ACTIVE;
  }

  updateFields(fields: {
    userId?: number | null;
    name?: string;
    email?: string | null;
    phone?: string | null;
    document?: string | null;
    state?: string | null;
    city?: string | null;
    referral?: string | null;
    metadata?: JsonRecord | null;
  }): Record<string, { before: unknown; after: unknown }> {
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    this.applyChange(changes, 'user_id', fields.userId, (value) => {
      this.props.userId = value;
    });
    this.applyChange(changes, 'name', fields.name, (value) => {
      if (value.trim().length < 2) {
        throw new Error('O nome deve ter pelo menos 2 caracteres.');
      }
      this.props.name = value;
    });
    this.applyChange(changes, 'email', fields.email, (value) => {
      this.props.email = value;
    });
    this.applyChange(changes, 'phone', fields.phone, (value) => {
      this.props.phone = value;
    });
    this.applyChange(changes, 'document', fields.document, (value) => {
      this.props.document = value;
    });
    this.applyChange(changes, 'state', fields.state, (value) => {
      this.props.state = value;
    });
    this.applyChange(changes, 'city', fields.city, (value) => {
      this.props.city = value;
    });
    this.applyChange(changes, 'referral', fields.referral, (value) => {
      this.props.referral = value;
    });
    this.applyChange(changes, 'metadata', fields.metadata, (value) => {
      this.props.metadata = value;
    });

    return changes;
  }

  deactivate(): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === FieldAgentStatus.INACTIVE) {
      throw new Error('O inventariante já está inativo.');
    }
    return this.changeStatus(FieldAgentStatus.INACTIVE);
  }

  reactivate(): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== FieldAgentStatus.INACTIVE) {
      throw new Error('Só inventariantes inativos podem ser reativados.');
    }
    return this.changeStatus(FieldAgentStatus.ACTIVE);
  }

  block(): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === FieldAgentStatus.BLOCKED) {
      throw new Error('O inventariante já está bloqueado.');
    }
    return this.changeStatus(FieldAgentStatus.BLOCKED);
  }

  unblock(): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== FieldAgentStatus.BLOCKED) {
      throw new Error('Só inventariantes bloqueados podem ser desbloqueados.');
    }
    return this.changeStatus(FieldAgentStatus.ACTIVE);
  }

  softDelete(at: Date): Record<string, { before: unknown; after: unknown }> {
    if (this.props.deletedAt)
      throw new Error('O inventariante já foi excluído.');
    const before = this.props.deletedAt;
    this.props.deletedAt = at;
    return { deleted_at: { before, after: at } };
  }

  toProps(): FieldAgentProps {
    return { ...this.props };
  }

  private changeStatus(
    status: FieldAgentStatus,
  ): Record<string, { before: unknown; after: unknown }> {
    const before = this.props.status;
    this.props.status = status;
    return { status: { before, after: status } };
  }

  private applyChange<T>(
    changes: Record<string, { before: unknown; after: unknown }>,
    key: string,
    value: T | undefined,
    apply: (value: T) => void,
  ): void {
    if (value === undefined) {
      return;
    }
    const current = this.props[this.toPropKey(key)] ?? null;
    if (JSON.stringify(current) === JSON.stringify(value)) {
      return;
    }
    changes[key] = { before: current, after: value };
    apply(value);
  }

  private toPropKey(key: string): keyof FieldAgentProps {
    const map: Record<string, keyof FieldAgentProps> = {
      user_id: 'userId',
      name: 'name',
      email: 'email',
      phone: 'phone',
      document: 'document',
      state: 'state',
      city: 'city',
      referral: 'referral',
      metadata: 'metadata',
    };
    return map[key] ?? 'name';
  }
}
