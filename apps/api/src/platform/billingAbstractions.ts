import type {
  BillingCheckoutSessionRequest,
  BillingCheckoutSessionResult,
  BillingProvider,
  BillingProviderDescriptor,
  SubscriptionStatus,
} from '@trackmind/shared';

const now = () => new Date().toISOString();

export class NoopBillingProvider implements BillingProvider {
  readonly descriptor: BillingProviderDescriptor = {
    providerId: 'noop',
    mode: 'noop',
    paymentCollectionImplemented: false,
    webhookImplemented: false,
    summary: 'No-op billing provider for development and contract testing. No payment collection occurs.',
  };

  createCheckoutSession(
    input: BillingCheckoutSessionRequest & { subscriptionId: string },
  ): BillingCheckoutSessionResult {
    return {
      sessionId: `chk_${input.subscriptionId}`,
      provider: this.descriptor.providerId,
      status: 'draft',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      mock: false,
    };
  }

  syncSubscriptionStatus(_externalRef: string): SubscriptionStatus {
    return 'active';
  }
}

export class AbstractBillingProvider implements BillingProvider {
  readonly descriptor: BillingProviderDescriptor;

  constructor(descriptor: Partial<BillingProviderDescriptor> & Pick<BillingProviderDescriptor, 'providerId'>) {
    this.descriptor = {
      mode: 'abstract',
      paymentCollectionImplemented: false,
      webhookImplemented: false,
      summary: 'Abstract billing provider contract; plug in Stripe, Azure Marketplace, or enterprise invoicing.',
      ...descriptor,
    };
  }

  createCheckoutSession(
    input: BillingCheckoutSessionRequest & { subscriptionId: string },
  ): BillingCheckoutSessionResult {
    const sessionId = `${this.descriptor.providerId}_${input.subscriptionId}_${Date.now()}`;
    return {
      sessionId,
      provider: this.descriptor.providerId,
      status: 'redirect-required',
      checkoutUrl: input.successUrl ? `${input.successUrl}?session=${sessionId}` : undefined,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      mock: false,
    };
  }

  syncSubscriptionStatus(_externalRef: string): SubscriptionStatus {
    return 'active';
  }
}

export function createBillingProvider(): BillingProvider {
  const providerId = process.env.TRACKMIND_BILLING_PROVIDER ?? 'abstract';
  if (providerId === 'noop') return new NoopBillingProvider();
  return new AbstractBillingProvider({
    providerId,
    mode: providerId === 'stripe' || providerId === 'azure-marketplace' ? providerId : 'abstract',
    summary: `Configured billing provider: ${providerId}. Payment collection remains adapter-driven.`,
  });
}

export function billingProviderWorkspace(provider: BillingProvider) {
  return {
    generatedAt: now(),
    provider: provider.descriptor,
    checkoutSupported: true,
    webhookEndpoint: `/api/v1/billing/webhooks/${provider.descriptor.providerId}`,
    mock: false,
  };
}
