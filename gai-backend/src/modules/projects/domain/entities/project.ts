import { ProjectStatus } from '../enums/project-status.enum';

export type JsonRecord = Record<string, unknown>;

export interface ProjectProps {
  id: number;
  organizationId: number;
  companyId: number | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  finishedAt: Date | null;
  settings: JsonRecord | null;
  metadata: JsonRecord | null;
  createdById: number | null;
  updatedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Project {
  constructor(private readonly props: ProjectProps) {
    this.assertDateRange(props.startDate, props.endDate);
  }

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get name(): string {
    return this.props.name;
  }

  get companyId(): number | null {
    return this.props.companyId;
  }

  get description(): string | null {
    return this.props.description;
  }

  get status(): ProjectStatus {
    return this.props.status;
  }

  get startDate(): Date | null {
    return this.props.startDate;
  }

  get endDate(): Date | null {
    return this.props.endDate;
  }

  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }

  get settings(): JsonRecord | null {
    return this.props.settings;
  }

  get metadata(): JsonRecord | null {
    return this.props.metadata;
  }

  get createdById(): number | null {
    return this.props.createdById;
  }

  get updatedById(): number | null {
    return this.props.updatedById;
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

  blocksOperationalMutation(): boolean {
    return [
      ProjectStatus.INACTIVE,
      ProjectStatus.FINISHED,
      ProjectStatus.CANCELLED,
      ProjectStatus.ARCHIVED,
    ].includes(this.props.status);
  }

  updateFields(fields: {
    name?: string;
    description?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    settings?: JsonRecord | null;
    metadata?: JsonRecord | null;
    updatedById: number | null;
  }): Record<string, { before: unknown; after: unknown }> {
    if (this.blocksOperationalMutation()) {
      throw new Error('Project status blocks this operation');
    }

    const nextStartDate =
      fields.startDate !== undefined ? fields.startDate : this.props.startDate;
    const nextEndDate =
      fields.endDate !== undefined ? fields.endDate : this.props.endDate;
    this.assertDateRange(nextStartDate, nextEndDate);

    const changes: Record<string, { before: unknown; after: unknown }> = {};

    this.applyChange(changes, 'name', fields.name, (value) => {
      this.props.name = value;
    });
    this.applyChange(changes, 'description', fields.description, (value) => {
      this.props.description = value;
    });
    this.applyChange(changes, 'start_date', fields.startDate, (value) => {
      this.props.startDate = value;
    });
    this.applyChange(changes, 'end_date', fields.endDate, (value) => {
      this.props.endDate = value;
    });
    this.applyChange(changes, 'settings', fields.settings, (value) => {
      this.props.settings = value;
    });
    this.applyChange(changes, 'metadata', fields.metadata, (value) => {
      this.props.metadata = value;
    });

    if (Object.keys(changes).length > 0) {
      this.props.updatedById = fields.updatedById;
    }

    return changes;
  }

  deactivate(
    actorId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.blocksOperationalMutation()) {
      throw new Error('Project status blocks this operation');
    }
    return this.changeStatus(ProjectStatus.INACTIVE, actorId);
  }

  reactivate(
    actorId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== ProjectStatus.INACTIVE) {
      throw new Error('Only inactive projects can be reactivated');
    }
    return this.changeStatus(ProjectStatus.ACTIVE, actorId);
  }

  finish(
    actorId: number | null,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.blocksOperationalMutation()) {
      throw new Error('Project status blocks this operation');
    }
    const changes = this.changeStatus(ProjectStatus.FINISHED, actorId);
    changes.finished_at = { before: this.props.finishedAt, after: now };
    this.props.finishedAt = now;
    return changes;
  }

  cancel(
    actorId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.blocksOperationalMutation()) {
      throw new Error('Project status blocks this operation');
    }
    return this.changeStatus(ProjectStatus.CANCELLED, actorId);
  }

  archive(
    actorId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === ProjectStatus.ARCHIVED) {
      throw new Error('Project status blocks this operation');
    }
    return this.changeStatus(ProjectStatus.ARCHIVED, actorId);
  }

  toProps(): ProjectProps {
    return { ...this.props };
  }

  private changeStatus(
    status: ProjectStatus,
    actorId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    const before = this.props.status;
    if (before === status) {
      throw new Error('Project status blocks this operation');
    }
    this.props.status = status;
    this.props.updatedById = actorId;
    return { status: { before, after: status } };
  }

  private assertDateRange(startDate: Date | null, endDate: Date | null): void {
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      throw new Error('end_date cannot be earlier than start_date');
    }
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
    const current = this.props[this.toPropKey(key)];
    if (JSON.stringify(current) === JSON.stringify(value)) {
      return;
    }
    changes[key] = { before: current, after: value };
    apply(value);
  }

  private toPropKey(key: string): keyof ProjectProps {
    const map: Record<string, keyof ProjectProps> = {
      name: 'name',
      company_id: 'companyId',
      description: 'description',
      start_date: 'startDate',
      end_date: 'endDate',
      settings: 'settings',
      metadata: 'metadata',
    };
    return map[key] ?? 'name';
  }
}
