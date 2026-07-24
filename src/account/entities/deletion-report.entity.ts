import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

@Entity({ name: 'deletion_reports' })
export class DeletionReportEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  protocol: string;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt: Date;

  @Column({ name: 'masked_id', type: 'varchar', length: 30 })
  maskedId: string;
}
