import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { OrderRecord } from '../orders/order.types';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Avisa a equipe no Telegram quando uma venda é paga.
 * Falhas nunca interrompem o fluxo do pedido — apenas são registradas no log.
 */
@Injectable()
export class SaleNotifierService {
  constructor(private readonly config: AppConfigService) {}

  async notifySale(order: OrderRecord) {
    const { telegramBotToken: token, telegramChatIds: chatIds } = this.config;
    if (!token || !chatIds.length) return;
    const text = this.saleMessage(order);
    await Promise.all(
      chatIds.map(async (chatId) => {
        try {
          const response = await fetch(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
              }),
              signal: AbortSignal.timeout(10_000),
            },
          );
          if (!response.ok)
            throw new Error(
              `HTTP ${response.status}: ${await response.text()}`,
            );
        } catch (error) {
          console.error(
            `[telegram] falha ao avisar venda ${order.number}`,
            error instanceof Error ? error.message : error,
          );
        }
      }),
    );
  }

  saleMessage(order: OrderRecord) {
    const lines = order.items.map((item) => {
      const variant = [item.color, item.size].filter(Boolean).join(' / ');
      return `• ${item.qty}x ${this.escape(item.name)}${variant ? ` (${this.escape(variant)})` : ''} — ${money.format(item.price * item.qty)}`;
    });
    const pieces = order.items.reduce((total, item) => total + item.qty, 0);
    const place = order.delivery
      ? `${order.delivery.city}/${order.delivery.state}`
      : '';
    const extras = [
      order.shipping
        ? `Frete: ${this.escape(order.shipping.name)} ${money.format(order.shipping.price)}`
        : '',
      order.coupon
        ? `Cupom: ${this.escape(order.coupon)} (-${order.couponPct}%)`
        : '',
      order.progressiveDiscount
        ? `Desconto progressivo: -${money.format(order.progressiveDiscount)}`
        : '',
    ].filter(Boolean);

    return [
      `🛍️ <b>Nova venda!</b> Pedido ${this.escape(order.number)}`,
      place ? `Destino: ${this.escape(place)}` : '',
      '',
      `<b>${pieces} peça${pieces === 1 ? '' : 's'}:</b>`,
      ...lines,
      '',
      ...extras,
      `<b>Total: ${money.format(order.total)}</b> (${this.escape(order.method)})`,
    ]
      .filter((line, index, all) => line !== '' || all[index - 1] !== '')
      .join('\n')
      .slice(0, 4000);
  }

  private escape(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
