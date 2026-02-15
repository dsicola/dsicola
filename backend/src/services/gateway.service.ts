/**
 * Service para integração com gateways de pagamento
 * - Manual: transferência bancária, depósito (sem integração)
 * - Angola: Multicaixa, Paymente
 * - Internacional: Stripe, PayPal, Tazapay
 */

export enum GatewayType {
  /** Pagamento manual (transferência, depósito, multicaixa físico) - sem gateway */
  MANUAL = 'MANUAL',
  /** Angola: Multicaixa Express / referência */
  MULTICAIXA = 'MULTICAIXA',
  /** Angola: Paymente (online) */
  PAYMENTE = 'PAYMENTE',
  /** Internacional */
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  TAZAPAY = 'TAZAPAY',
}

export interface GatewayConfig {
  /** Angola - Multicaixa (referência para depósito) */
  multicaixa?: {
    entidade?: string;
    referenciaPrefix?: string;
  };
  /** Angola - Paymente API */
  paymente?: {
    apiKey: string;
    apiSecret: string;
    environment: 'sandbox' | 'production';
  };
  stripe?: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
  };
  paypal?: {
    clientId: string;
    clientSecret: string;
    mode: 'sandbox' | 'live';
  };
  tazapay?: {
    apiKey: string;
    apiSecret: string;
    environment: 'sandbox' | 'production';
  };
}

/**
 * Classe abstrata para gateways de pagamento
 */
export abstract class PaymentGateway {
  abstract createPaymentIntent(amount: number, currency: string, metadata: any): Promise<{
    id: string;
    clientSecret?: string;
    redirectUrl?: string;
    data: any;
  }>;

  abstract verifyWebhook(payload: any, signature: string): Promise<boolean>;

  abstract parseWebhookEvent(payload: any): Promise<{
    paymentId: string;
    status: 'PAID' | 'FAILED';
    gatewayData: any;
  }>;
}

/**
 * Implementação do Stripe
 */
export class StripeGateway extends PaymentGateway {
  private stripe: any;

  constructor(secretKey: string) {
    super();
    // Stripe será importado dinamicamente se disponível
    // this.stripe = require('stripe')(secretKey);
  }

  async createPaymentIntent(amount: number, currency: string, metadata: any): Promise<{
    id: string;
    clientSecret?: string;
    redirectUrl?: string;
    data: any;
  }> {
    // Implementação real requer biblioteca Stripe
    // Por enquanto, retorna estrutura mockada
    throw new Error('Stripe integration not yet implemented. Install stripe package and configure.');
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    // Implementação real requer biblioteca Stripe
    throw new Error('Stripe webhook verification not yet implemented.');
  }

  async parseWebhookEvent(payload: any): Promise<{
    paymentId: string;
    status: 'PAID' | 'FAILED';
    gatewayData: any;
  }> {
    // Implementação real requer biblioteca Stripe
    throw new Error('Stripe webhook parsing not yet implemented.');
  }
}

/**
 * Factory para criar instância de gateway
 * MANUAL não usa gateway - confirmação manual pelo SUPER_ADMIN
 */
export function createGateway(gatewayType: GatewayType, config: GatewayConfig): PaymentGateway {
  switch (gatewayType) {
    case GatewayType.MANUAL:
      throw new Error('MANUAL não usa gateway. Use confirmação manual via SUPER_ADMIN.');
    case GatewayType.MULTICAIXA:
      throw new Error('MULTICAIXA: integração futura. Por agora use método TRANSFERENCIA/DEPOSITO e confirmação manual.');
    case GatewayType.PAYMENTE:
      throw new Error('Paymente (Angola): integração futura. Configure PAYMENTE_API_KEY quando disponível.');
    case GatewayType.STRIPE:
      if (!config.stripe?.secretKey) {
        throw new Error('Stripe secret key not configured');
      }
      return new StripeGateway(config.stripe.secretKey);
    case GatewayType.PAYPAL:
      throw new Error('PayPal integration not yet implemented');
    case GatewayType.TAZAPAY:
      throw new Error('Tazapay integration not yet implemented');
    default:
      throw new Error(`Unsupported gateway type: ${gatewayType}`);
  }
}

/**
 * Obter configuração do gateway a partir de variáveis de ambiente
 * Angola: MULTICAIXA_ENTIDADE, PAYMENTE_*, Internacional: STRIPE_*, PAYPAL_*, TAZAPAY_*
 */
export function getGatewayConfig(): GatewayConfig {
  return {
    multicaixa: process.env.MULTICAIXA_ENTIDADE
      ? {
          entidade: process.env.MULTICAIXA_ENTIDADE,
          referenciaPrefix: process.env.MULTICAIXA_REFERENCIA_PREFIX || '',
        }
      : undefined,
    paymente: process.env.PAYMENTE_API_KEY
      ? {
          apiKey: process.env.PAYMENTE_API_KEY,
          apiSecret: process.env.PAYMENTE_API_SECRET || '',
          environment: (process.env.PAYMENTE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
        }
      : undefined,
    stripe: process.env.STRIPE_SECRET_KEY
      ? {
          secretKey: process.env.STRIPE_SECRET_KEY,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        }
      : undefined,
    paypal: process.env.PAYPAL_CLIENT_ID
      ? {
          clientId: process.env.PAYPAL_CLIENT_ID,
          clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
          mode: (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox',
        }
      : undefined,
    tazapay: process.env.TAZAPAY_API_KEY
      ? {
          apiKey: process.env.TAZAPAY_API_KEY,
          apiSecret: process.env.TAZAPAY_API_SECRET || '',
          environment: (process.env.TAZAPAY_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
        }
      : undefined,
  };
}

