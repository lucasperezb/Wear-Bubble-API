import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { AppConfigService } from '../config/config.service';
import { OrderRecord } from '../orders/order.types';

type EmailMessage = {
  to: string;
  name?: string;
  subject: string;
  content: string;
  tag: string;
  idempotencyKey: string;
};

@Injectable()
export class EmailService {
  private readonly transporter?: Transporter;

  constructor(private readonly config: AppConfigService) {
    if (this.config.smtpPassword) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPassword,
        },
      });
    }
  }

  async sendLoginCode(
    email: string,
    code: string,
    purpose: 'login' | 'verification' = 'login',
  ) {
    const verification = purpose === 'verification';
    await this.send({
      to: email,
      subject: `${code} é o seu código de ${verification ? 'verificação' : 'acesso'} Wear Bubble`,
      content: this.layout(
        verification ? 'Confirme seu e-mail' : 'Seu código de acesso',
        `<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>
         <p>${verification ? 'Use este código para confirmar seu e-mail e ativar sua conta.' : 'Use este código para entrar na sua conta.'}</p>
         <p>Ele expira em 10 minutos e pode ser usado uma única vez.</p>
         <p style="color:#6f6a60">Se você não solicitou este código, ignore esta mensagem.</p>`,
      ),
      tag: verification ? 'email-verification' : 'login-code',
      idempotencyKey: `${purpose}-${email}-${code}`,
    });
  }

  async sendPasswordReset(email: string, resetUrl: string) {
    const safeUrl = this.escape(resetUrl);
    await this.send({
      to: email,
      subject: 'Redefina sua senha da Wear Bubble',
      content: this.layout(
        'Redefinição de senha',
        `<p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
         <p style="margin:28px 0">
           <a href="${safeUrl}" style="display:inline-block;background:#171410;color:#ffffff;padding:14px 24px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Redefinir minha senha</a>
         </p>
         <p>Este link expira em 30 minutos e pode ser usado uma única vez.</p>
         <p style="color:#6f6a60">Se você não solicitou a redefinição, ignore esta mensagem. Sua senha continuará a mesma.</p>`,
      ),
      tag: 'password-reset',
      idempotencyKey: `password-reset-${email}-${Date.now()}`,
    });
  }

  async sendOrderCreated(order: OrderRecord) {
    if (!order.delivery?.email) return;
    await this.safeSend({
      to: order.delivery.email,
      name: order.delivery.name,
      subject: `Recebemos o pedido ${order.number}`,
      content: this.layout(
        'Pedido recebido',
        `<p>O pedido <strong>${this.escape(order.number)}</strong> foi criado e está aguardando a confirmação do pagamento.</p>
         ${this.orderSummary(order)}
         <p>Assim que o pagamento for confirmado, você receberá outro e-mail.</p>`,
      ),
      tag: 'order-created',
      idempotencyKey: `order-created-${order.id}`,
    });
  }

  async sendPaymentConfirmed(order: OrderRecord) {
    if (!order.delivery?.email) return;
    await this.safeSend({
      to: order.delivery.email,
      name: order.delivery.name,
      subject: `Pagamento confirmado · ${order.number}`,
      content: this.layout(
        'Pagamento confirmado',
        `<p>O pagamento do pedido <strong>${this.escape(order.number)}</strong> foi confirmado.</p>
         ${this.orderSummary(order)}
         <p>Agora vamos preparar suas peças para o envio.</p>`,
      ),
      tag: 'payment-confirmed',
      idempotencyKey: `payment-confirmed-${order.id}`,
    });
  }

  async sendShippingUpdate(order: OrderRecord) {
    if (!order.delivery?.email) return;
    const tracking = order.tracking
      ? `<p>Código de rastreio: <strong>${this.escape(order.tracking)}</strong></p>`
      : '';
    await this.safeSend({
      to: order.delivery.email,
      name: order.delivery.name,
      subject: `Atualização do envio · ${order.number}`,
      content: this.layout(
        'Seu pedido foi atualizado',
        `<p>O pedido <strong>${this.escape(order.number)}</strong> avançou para a etapa ${order.shipStage} de 5.</p>
         ${tracking}
         <p>Você pode acompanhar os detalhes entrando na sua conta Bubble.</p>`,
      ),
      tag: 'shipping-update',
      idempotencyKey: `shipping-${order.id}-${order.shipStage}-${order.tracking || 'none'}`,
    });
  }

  private async safeSend(message: EmailMessage) {
    try {
      await this.send(message);
    } catch (error) {
      console.error(
        `[email] falha no envio de ${message.tag} para ${message.to}`,
        error,
      );
    }
  }

  private async send(message: EmailMessage) {
    if (!this.transporter) {
      console.log(
        `[email:dev] ${message.tag} para ${message.to}: ${message.subject}`,
      );
      return { development: true };
    }

    try {
      const result = await this.transporter.sendMail({
        from: {
          address: this.config.smtpFromEmail,
          name: this.config.smtpFromName,
        },
        to: {
          address: message.to,
          name: message.name || message.to,
        },
        subject: message.subject,
        html: message.content,
        headers: {
          'X-Wear-Bubble-Event': message.tag,
          'X-Wear-Bubble-Idempotency-Key': message.idempotencyKey,
        },
      });
      return { messageId: result.messageId };
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível enviar o e-mail.',
      );
    }
  }

  private orderSummary(order: OrderRecord) {
    const lines = order.items
      .map(
        (item) =>
          `<li>${item.qty}x ${this.escape(item.name)}${item.color ? ` · Cor ${this.escape(item.color)}` : ''} · Tam. ${this.escape(item.size)}</li>`,
      )
      .join('');
    return `<div style="background:#f4efe3;padding:18px;margin:22px 0">
      <ul style="padding-left:18px;margin:0 0 14px">${lines}</ul>
      <strong>Total: ${this.money(order.total)}</strong>
    </div>`;
  }

  private layout(title: string, content: string) {
    return `<!doctype html>
      <html lang="pt-BR">
        <body style="margin:0;background:#f4efe3;color:#171410;font-family:Arial,sans-serif">
          <div style="max-width:600px;margin:0 auto;padding:32px 20px">
            <div style="font-size:22px;font-weight:800;letter-spacing:.08em;margin-bottom:28px">BUBBLE</div>
            <div style="background:#fff;padding:30px;border:1px solid #d8d0c0">
              <h1 style="font-size:26px;margin:0 0 20px">${title}</h1>
              <div style="font-size:15px;line-height:1.65">${content}</div>
            </div>
            <p style="font-size:12px;color:#777064;margin-top:20px">Bubble Fitness Wear · E-mail transacional</p>
          </div>
        </body>
      </html>`;
  }

  private money(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private escape(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
