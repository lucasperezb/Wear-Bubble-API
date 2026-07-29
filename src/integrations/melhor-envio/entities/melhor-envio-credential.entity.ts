import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../../../persistence/timestamped.entity';

@Entity({ name: 'melhor_envio_credentials' })
export class MelhorEnvioCredentialEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ name: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted: string;

  @Column({ name: 'refresh_token_encrypted', type: 'text' })
  refreshTokenEncrypted: string;

  @Column({
    name: 'token_type',
    type: 'varchar',
    length: 32,
    default: 'Bearer',
  })
  tokenType: string;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
