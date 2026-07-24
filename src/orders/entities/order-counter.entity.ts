import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'order_counters' })
export class OrderCounterEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  key: string;

  @Column({ type: 'integer', default: 0 })
  value: number;
}
