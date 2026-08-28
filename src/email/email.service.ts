import {
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
  }>;
};

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly transporter?: Transporter;

  constructor(private readonly config: AppConfigService) {
    if (this.config.smtpConfigured) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPassword,
        },
        tls: {
          minVersion: 'TLSv1.2',
          servername: this.config.smtpHost,
        },
      });
    }
  }

  async onModuleInit() {
    if (!this.transporter) {
      const message =
        '[email] SMTP não configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD e SMTP_FROM_EMAIL.';
      if (this.config.isProduction) console.error(message);
      else console.warn(message);
      return;
    }

    try {
      await this.transporter.verify();
      console.log(
        `[email] SMTP conectado a ${this.config.smtpHost}:${this.config.smtpPort}`,
      );
    } catch (error) {
      console.error(
        `[email] não foi possível conectar a ${this.config.smtpHost}:${this.config.smtpPort}`,
        this.smtpError(error),
      );
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
        `${this.greeting(order)}
         <p>Recebemos o pedido <strong>${this.escape(order.number)}</strong>. Ele foi registrado e está aguardando a confirmação do pagamento.</p>
         ${this.statusTimeline(0)}
         ${this.orderDetails(order)}
         ${this.nextStep('Assim que o pagamento for confirmado, iniciaremos a separação das suas peças e enviaremos uma nova atualização.')}
         ${this.accountButton()}`,
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
        `${this.greeting(order)}
         <p>O pagamento do pedido <strong>${this.escape(order.number)}</strong> foi aprovado. Suas peças agora entram na fila de separação.</p>
         ${this.statusTimeline(1)}
         ${this.orderDetails(order)}
         ${this.nextStep('Nossa equipe vai conferir produto, cor, tamanho e quantidade antes de preparar a embalagem.')}
         ${this.accountButton()}`,
      ),
      tag: 'payment-confirmed',
      idempotencyKey: `payment-confirmed-${order.id}`,
    });
  }

  async sendShippingUpdate(order: OrderRecord) {
    if (!order.delivery?.email) return;
    const status = this.shippingStatus(order.shipStage);
    await this.safeSend({
      to: order.delivery.email,
      name: order.delivery.name,
      subject: `${status.subject} · ${order.number}`,
      content: this.layout(
        status.title,
        `${this.greeting(order)}
         <p>${status.message.replace('{order}', `<strong>${this.escape(order.number)}</strong>`)}</p>
         ${this.statusTimeline(order.shipStage)}
         ${order.tracking ? this.trackingBlock(order.tracking) : ''}
         ${this.orderDetails(order)}
         ${this.nextStep(status.next)}
         ${this.accountButton()}`,
      ),
      tag: 'shipping-update',
      idempotencyKey: `shipping-${order.id}-${order.shipStage}-${order.tracking || 'none'}`,
    });
  }

  async sendReturnUpdate(
    email: string,
    name: string,
    protocol: string,
    status: string,
    note = '',
  ) {
    await this.safeSend({
      to: email,
      name,
      subject: `Atualização da solicitação ${protocol}`,
      content: this.layout(
        'Troca ou devolução atualizada',
        `<p>A solicitação <strong>${this.escape(protocol)}</strong> foi atualizada para:</p>
         <p style="font-size:18px;font-weight:700">${this.escape(status)}</p>
         ${note ? `<p>${this.escape(note)}</p>` : ''}
         <p>Acompanhe todos os detalhes em Minha Conta.</p>`,
      ),
      tag: 'return-update',
      idempotencyKey: `return-${protocol}-${status}-${Date.now()}`,
    });
  }

  async sendReturnPostingInstructions(input: {
    email: string;
    name: string;
    orderNumber: string;
    protocol: string;
    kind: 'exchange' | 'return' | 'defect';
    postingCode: string;
    expiresAt: Date | null;
    printUrl: string | null;
    sandbox: boolean;
  }) {
    const kind = input.kind === 'exchange' ? 'troca' : 'devolução';
    const expires = input.expiresAt
      ? `<p><strong>Validade:</strong> ${this.date(input.expiresAt.getTime())}</p>`
      : '';
    const sandboxWarning = input.sandbox
      ? '<div style="margin:18px 0;border:2px solid #a33;padding:14px;color:#8b1e1e"><strong>TESTE SANDBOX:</strong> este código é simulado e não será aceito em uma agência dos Correios.</div>'
      : '';
    const providerDocument = input.printUrl
      ? `<p><a href="${this.escape(input.printUrl)}" style="font-weight:700">Abrir documento disponibilizado pelo Melhor Envio</a></p>`
      : '';
    await this.safeSend({
      to: input.email,
      name: input.name,
      subject: `Código de postagem da ${kind} · ${input.orderNumber}`,
      content: this.layout(
        `Postagem da ${kind} autorizada`,
        `<p>Olá, <strong>${this.escape(input.name.trim().split(/\s+/)[0] || input.name)}</strong>.</p>
         <p>A postagem referente à solicitação <strong>${this.escape(input.protocol)}</strong>, do pedido <strong>${this.escape(input.orderNumber)}</strong>, está disponível.</p>
         ${sandboxWarning}
         <div style="margin:22px 0;background:#171410;color:#fff;padding:20px;text-align:center">
           <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#f0b9cd">Código de autorização de postagem</div>
           <div style="margin-top:8px;font-size:22px;font-weight:800;letter-spacing:.06em">${this.escape(input.postingCode)}</div>
         </div>
         ${expires}
         <ol>
           <li>Embale as peças em um único pacote.</li>
           <li>Leve o pacote a uma agência própria ou franqueada dos Correios.</li>
           <li>Apresente o código acima no atendimento.</li>
         </ol>
         <p><strong>Não é necessário colar uma etiqueta física no pacote.</strong></p>
         ${providerDocument}
         ${this.accountButton()}`,
      ),
      tag: 'return-posting',
      idempotencyKey: `return-posting-${input.protocol}-${input.postingCode}`,
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
      if (this.config.isProduction) {
        throw new ServiceUnavailableException(
          'O serviço de e-mail não está configurado.',
        );
      }
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
        attachments: message.attachments,
        headers: {
          'X-Wear-Bubble-Event': message.tag,
          'X-Wear-Bubble-Idempotency-Key': message.idempotencyKey,
        },
      });
      return { messageId: result.messageId };
    } catch (error) {
      console.error(
        `[email] erro SMTP ao enviar ${message.tag}`,
        this.smtpError(error),
      );
      throw new ServiceUnavailableException(
        'Não foi possível enviar o e-mail.',
      );
    }
  }

  private smtpError(error: unknown) {
    if (!(error instanceof Error)) return { message: String(error) };
    const smtpError = error as Error & {
      code?: string;
      command?: string;
      responseCode?: number;
    };
    return {
      name: smtpError.name,
      message: smtpError.message,
      code: smtpError.code,
      command: smtpError.command,
      responseCode: smtpError.responseCode,
    };
  }

  private orderDetails(order: OrderRecord) {
    return `<div style="margin:26px 0;border:1px solid #d8d0c0">
      <div style="background:#171410;color:#ffffff;padding:14px 18px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Detalhes do pedido ${this.escape(order.number)}</div>
      <div style="padding:18px">
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:13px">
          <tr>
            <td style="padding:0 12px 8px 0;color:#777064">Compra realizada</td>
            <td style="padding:0 0 8px;text-align:right;font-weight:700">${this.date(order.date)}</td>
          </tr>
          <tr>
            <td style="padding:0 12px 8px 0;color:#777064">Pagamento</td>
            <td style="padding:0 0 8px;text-align:right;font-weight:700">${this.paymentMethod(order.method)}</td>
          </tr>
          ${order.shipping ? `<tr><td style="padding:0 12px;color:#777064">Entrega</td><td style="padding:0;text-align:right;font-weight:700">${this.escape(order.shipping.company)} · ${this.escape(order.shipping.name)}${order.shipping.deliveryTime ? ` · até ${order.shipping.deliveryTime} dias úteis` : ''}</td></tr>` : ''}
        </table>
        ${this.productTable(order)}
        ${this.financialSummary(order)}
        ${this.deliveryAddress(order)}
      </div>
    </div>`;
  }

  private productTable(order: OrderRecord) {
    const rows = order.items
      .map(
        (item) => `<tr>
          <td style="padding:13px 8px 13px 0;border-top:1px solid #e8e1d4">
            <div style="font-weight:700">${this.escape(item.name)}</div>
            <div style="margin-top:4px;font-size:12px;color:#777064">${item.color ? `Cor: ${this.escape(item.color)} · ` : ''}Tamanho: ${this.escape(item.size)}</div>
          </td>
          <td style="padding:13px 8px;border-top:1px solid #e8e1d4;text-align:center;white-space:nowrap">${item.qty} un.</td>
          <td style="padding:13px 0 13px 8px;border-top:1px solid #e8e1d4;text-align:right;white-space:nowrap">
            <div>${this.money(item.price * item.qty)}</div>
            ${item.qty > 1 ? `<div style="font-size:11px;color:#777064">${this.money(item.price)} cada</div>` : ''}
          </td>
        </tr>`,
      )
      .join('');
    return `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr><th style="padding:0 8px 9px 0;text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#777064">Produto e variação</th><th style="padding:0 8px 9px;text-align:center;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#777064">Qtd.</th><th style="padding:0 0 9px 8px;text-align:right;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#777064">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private financialSummary(order: OrderRecord) {
    const products = order.items.reduce(
      (total, item) => total + item.price * item.qty,
      0,
    );
    const shipping = order.shipping?.price || 0;
    const storeCredit = order.storeCreditAmount || 0;
    const discounts = Math.max(
      0,
      products + shipping - order.total - storeCredit,
    );
    return `<table role="presentation" style="width:100%;border-collapse:collapse;border-top:2px solid #171410;margin-top:4px;padding-top:10px;font-size:13px">
      <tr><td style="padding-top:12px;color:#777064">Produtos</td><td style="padding-top:12px;text-align:right">${this.money(products)}</td></tr>
      <tr><td style="padding-top:7px;color:#777064">Frete</td><td style="padding-top:7px;text-align:right">${shipping > 0 ? this.money(shipping) : 'Grátis'}</td></tr>
      ${order.coupon ? `<tr><td style="padding-top:7px;color:#777064">Cupom ${this.escape(order.coupon)}</td><td style="padding-top:7px;text-align:right">Aplicado</td></tr>` : ''}
      ${storeCredit > 0 ? `<tr><td style="padding-top:7px;color:#777064">Crédito da loja</td><td style="padding-top:7px;text-align:right">-${this.money(storeCredit)}</td></tr>` : ''}
      ${discounts > 0 ? `<tr><td style="padding-top:7px;color:#777064">Descontos</td><td style="padding-top:7px;text-align:right">-${this.money(discounts)}</td></tr>` : ''}
      <tr><td style="padding-top:12px;font-size:16px;font-weight:700">Total do pedido</td><td style="padding-top:12px;text-align:right;font-size:18px;font-weight:800">${this.money(order.total)}</td></tr>
    </table>`;
  }

  private deliveryAddress(order: OrderRecord) {
    if (!order.delivery) return '';
    const delivery = order.delivery;
    return `<div style="margin-top:22px;background:#f4efe3;padding:16px">
      <div style="margin-bottom:7px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#777064">Endereço de entrega</div>
      <div style="font-weight:700">${this.escape(delivery.name)}</div>
      <div>${this.escape(delivery.street)}, ${this.escape(delivery.number)} · ${this.escape(delivery.neighborhood)}</div>
      ${delivery.reference ? `<div>${this.escape(delivery.reference)}</div>` : ''}
      <div>${this.escape(delivery.city)} - ${this.escape(delivery.state)} · CEP ${this.escape(delivery.cep)}</div>
    </div>`;
  }

  private statusTimeline(stage: number) {
    const labels = [
      'Recebido',
      'Pagamento',
      'Separação',
      'Enviado',
      'Em trânsito',
      'Entregue',
    ];
    const safeStage = Math.max(0, Math.min(5, Number(stage) || 0));
    const cells = labels
      .map(
        (label, index) =>
          `<td style="width:16.66%;padding:8px 2px;border-top:4px solid ${index <= safeStage ? '#c94e82' : '#d8d0c0'};font-size:9px;font-weight:${index === safeStage ? '800' : '500'};text-align:center;color:${index <= safeStage ? '#171410' : '#999184'}">${label}</td>`,
      )
      .join('');
    return `<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:3px;margin:24px 0"><tr>${cells}</tr></table>`;
  }

  private shippingStatus(stage: number) {
    const statuses = [
      {
        subject: 'Pedido confirmado',
        title: 'Pedido confirmado',
        message:
          'O pedido {order} foi confirmado e será encaminhado para pagamento.',
        next: 'A próxima etapa é a confirmação do pagamento.',
      },
      {
        subject: 'Pagamento confirmado',
        title: 'Pagamento confirmado',
        message: 'O pagamento do pedido {order} foi confirmado.',
        next: 'A próxima etapa é a separação e conferência das peças.',
      },
      {
        subject: 'Pedido em separação',
        title: 'Estamos preparando suas peças',
        message:
          'O pedido {order} está em separação. Estamos conferindo produto, cor, tamanho e quantidade.',
        next: 'Depois da conferência, o pedido será embalado e entregue à transportadora.',
      },
      {
        subject: 'Pedido enviado',
        title: 'Seu pedido foi enviado',
        message:
          'O pedido {order} foi entregue à transportadora e iniciou o processo de envio.',
        next: 'O rastreio pode levar algumas horas para apresentar a primeira movimentação.',
      },
      {
        subject: 'Pedido em trânsito',
        title: 'Seu pedido está a caminho',
        message:
          'O pedido {order} está em trânsito para o endereço informado na compra.',
        next: 'Acompanhe o código de rastreio e certifique-se de que haverá alguém no endereço para receber.',
      },
      {
        subject: 'Pedido entregue',
        title: 'Pedido entregue',
        message: 'O pedido {order} foi marcado como entregue.',
        next: 'Confira suas peças ao receber. Se precisar de troca ou devolução, abra a solicitação em Minha Conta.',
      },
    ];
    return statuses[Math.max(0, Math.min(5, Number(stage) || 0))];
  }

  private trackingBlock(tracking: string) {
    return `<div style="margin:22px 0;background:#171410;color:#ffffff;padding:18px;text-align:center">
      <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#f0b9cd">Código de rastreio</div>
      <div style="margin-top:8px;font-size:20px;font-weight:800;letter-spacing:.08em">${this.escape(tracking)}</div>
    </div>`;
  }

  private nextStep(message: string) {
    return `<div style="margin:22px 0;border-left:4px solid #c94e82;background:#f9f5ec;padding:14px 16px"><strong>Próximo passo</strong><br>${message}</div>`;
  }

  private greeting(order: OrderRecord) {
    const firstName = order.delivery?.name?.trim().split(/\s+/)[0];
    return firstName
      ? `<p>Olá, <strong>${this.escape(firstName)}</strong>.</p>`
      : '';
  }

  private accountButton() {
    const url = `${this.config.storeUrl.replace(/\/$/, '')}/conta`;
    return `<p style="margin:28px 0 4px;text-align:center"><a href="${this.escape(url)}" style="display:inline-block;background:#171410;color:#ffffff;padding:14px 22px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase">Acompanhar meu pedido</a></p>`;
  }

  private paymentMethod(method: string) {
    const methods: Record<string, string> = {
      pix: 'Pix',
      PIX: 'Pix',
      credit_card: 'Cartão de crédito',
      CREDIT_CARD: 'Cartão de crédito',
      card: 'Cartão de crédito',
    };
    return methods[method] || this.escape(method || 'Não informado');
  }

  private date(value: number) {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(value));
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
            <p style="font-size:12px;color:#777064;margin-top:20px">Wear Bubble · E-mail transacional</p>
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
