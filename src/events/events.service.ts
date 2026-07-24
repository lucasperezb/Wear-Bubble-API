import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventEntity } from './entities/event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly events: Repository<EventEntity>,
    private readonly products: ProductsService,
  ) {}

  async create(actor: string, dto: CreateEventDto) {
    const requestedProductId = dto?.pid == null ? null : Number(dto.pid);
    const productId =
      requestedProductId && (await this.products.findEntity(requestedProductId))
        ? requestedProductId
        : null;
    const actorUid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        actor,
      )
        ? actor
        : null;
    await this.events.save(
      this.events.create({
        type: String(dto?.type || 'click'),
        productId,
        occurredAt: new Date(),
        actorUid,
        actorLabel: actor,
      }),
    );
    return { ok: true };
  }

  async list() {
    return (await this.events.find({ order: { occurredAt: 'DESC' } })).map(
      (row) => ({
        type: row.type,
        pid: row.productId,
        ts: row.occurredAt.getTime(),
        actor: row.actorLabel,
      }),
    );
  }
}
