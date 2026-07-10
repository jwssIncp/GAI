import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PRIMARY_KEY_COLUMN } from '../../../../common/persistence/entity-id.columns';
import { PermissionScope } from '../../domain/enums/permission-scope.enum';

@Entity('permissions')
export class PermissionEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  key!: string;

  @Column({ type: 'varchar', length: 50 })
  resource!: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  scope!: PermissionScope;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
