import { ProjectFieldAgentStatus } from '../enums/project-field-agent-status.enum';

export interface ProjectFieldAgentProps {
  id: number;
  organizationId: number;
  projectId: number;
  fieldAgentId: number;
  role: string | null;
  status: ProjectFieldAgentStatus;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectFieldAgent {
  constructor(private readonly props: ProjectFieldAgentProps) {
    this.assertDateRange(props.startDate, props.endDate);
  }

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get projectId(): number {
    return this.props.projectId;
  }

  get fieldAgentId(): number {
    return this.props.fieldAgentId;
  }

  get role(): string | null {
    return this.props.role;
  }

  get status(): ProjectFieldAgentStatus {
    return this.props.status;
  }

  get startDate(): Date | null {
    return this.props.startDate;
  }

  get endDate(): Date | null {
    return this.props.endDate;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateFields(fields: {
    role?: string | null;
    status?: ProjectFieldAgentStatus;
    startDate?: Date | null;
    endDate?: Date | null;
    notes?: string | null;
  }): Record<string, { before: unknown; after: unknown }> {
    const nextStartDate =
      fields.startDate !== undefined ? fields.startDate : this.props.startDate;
    const nextEndDate =
      fields.endDate !== undefined ? fields.endDate : this.props.endDate;
    this.assertDateRange(nextStartDate, nextEndDate);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    this.applyChange(changes, 'role', fields.role, (value) => {
      this.props.role = value;
    });
    this.applyChange(changes, 'status', fields.status, (value) => {
      this.props.status = value;
    });
    this.applyChange(changes, 'start_date', fields.startDate, (value) => {
      this.props.startDate = value;
    });
    this.applyChange(changes, 'end_date', fields.endDate, (value) => {
      this.props.endDate = value;
    });
    this.applyChange(changes, 'notes', fields.notes, (value) => {
      this.props.notes = value;
    });
    return changes;
  }

  remove(): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === ProjectFieldAgentStatus.FINISHED) {
      throw new Error('Project field agent is already finished');
    }
    const before = this.props.status;
    this.props.status = ProjectFieldAgentStatus.FINISHED;
    return {
      status: { before, after: ProjectFieldAgentStatus.FINISHED },
    };
  }

  toProps(): ProjectFieldAgentProps {
    return { ...this.props };
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

  private toPropKey(key: string): keyof ProjectFieldAgentProps {
    const map: Record<string, keyof ProjectFieldAgentProps> = {
      role: 'role',
      status: 'status',
      start_date: 'startDate',
      end_date: 'endDate',
      notes: 'notes',
    };
    return map[key] ?? 'role';
  }
}
