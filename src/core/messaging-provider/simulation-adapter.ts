import {
  MessagingExecutionProvider,
  MessagingStatusProvider,
  MessagingChannel,
  MessageRecipient,
  MessagePayload,
  SendMessageResponse,
  MessageStatusResult,
  FaultInjectionMessagingConfig,
  MessagingProviderMode,
  MessageDeliveryStatus,
} from './types';

export class SimulationMessagingAdapter implements MessagingExecutionProvider, MessagingStatusProvider {
  private idempotencyStore = new Map<string, SendMessageResponse>();
  private messageStore = new Map<string, MessageStatusResult>();
  private faultConfig: FaultInjectionMessagingConfig = {};
  public readonly providerMode: MessagingProviderMode = 'SIMULATION';

  constructor(faults?: FaultInjectionMessagingConfig) {
    if (faults) this.faultConfig = faults;
  }

  public setFaultConfig(config: FaultInjectionMessagingConfig): void {
    this.faultConfig = config;
  }

  public async sendMessage(
    channel: MessagingChannel,
    recipient: MessageRecipient,
    payload: MessagePayload,
    idempotencyKey?: string,
    caseId: string = 'unknown_case'
  ): Promise<SendMessageResponse> {
    const key = idempotencyKey || `msg_idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Idempotency Check
    if (this.idempotencyStore.has(key)) {
      return this.idempotencyStore.get(key)!;
    }

    // 2. Fault Injection Check: Timeout
    if (this.faultConfig.simulateTimeout) {
      throw new Error('MESSAGING_TIMEOUT_504: Gateway connection to messaging provider timed out');
    }

    const providerMessageId = `msg_sim_${channel.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const createdAt = now.toISOString();

    // 3. Fault Injection Check: Delivery Failure
    if (this.faultConfig.simulateDeliveryFailure) {
      const failedResponse: SendMessageResponse = {
        success: false,
        providerMessageId,
        channel,
        status: 'FAILED',
        providerMode: this.providerMode,
        costCents: 0,
        createdAt,
        errorMessage: `MESSAGING_DELIVERY_FAILED: Recipient unreachable on channel ${channel}`,
      };

      this.messageStore.set(providerMessageId, {
        providerMessageId,
        caseId,
        channel,
        status: 'FAILED',
        sentAt: createdAt,
        errorCode: 'ERR_DELIVERY_FAILED',
        errorDescription: 'Recipient endpoint rejected message or device offline',
      });

      this.idempotencyStore.set(key, failedResponse);
      return failedResponse;
    }

    // 4. Successful Delivery Simulation
    // In simulated environment: delivered immediately or after slight offset
    const deliveredTime = new Date(now.getTime() + (this.faultConfig.deliveryDelayMs ?? 150));
    const deliveredAt = deliveredTime.toISOString();

    // Read receipt timing (WhatsApp provides read receipts; Email may omit if simulateNoReadReceipt)
    let readAt: string | undefined;
    let finalStatus: MessageDeliveryStatus = 'DELIVERED';

    if (!this.faultConfig.simulateNoReadReceipt) {
      // Typically read 500ms after delivery in simulation
      const readTime = new Date(deliveredTime.getTime() + 500);
      readAt = readTime.toISOString();
      finalStatus = 'READ';
    }

    // Channel-specific cost simulation (WhatsApp: ₹0.80 / 80 cents, Email: ₹0.10 / 10 cents, SMS: ₹0.25 / 25 cents)
    const costCents = channel === 'WHATSAPP' ? 80 : channel === 'SMS' ? 25 : 10;

    const response: SendMessageResponse = {
      success: true,
      providerMessageId,
      channel,
      status: finalStatus,
      providerMode: this.providerMode,
      deliveredAt,
      readAt,
      costCents,
      createdAt,
    };

    this.messageStore.set(providerMessageId, {
      providerMessageId,
      caseId,
      channel,
      status: finalStatus,
      sentAt: createdAt,
      deliveredAt,
      readAt,
    });

    this.idempotencyStore.set(key, response);
    return response;
  }

  public async getMessageStatus(providerMessageId: string): Promise<MessageStatusResult> {
    const existing = this.messageStore.get(providerMessageId);
    if (!existing) {
      return {
        providerMessageId,
        caseId: 'unknown',
        channel: 'WHATSAPP',
        status: 'FAILED',
        sentAt: new Date().toISOString(),
        errorCode: 'ERR_NOT_FOUND',
        errorDescription: `Message '${providerMessageId}' not found in simulation store`,
      };
    }
    return existing;
  }

  public getAllMessages(): MessageStatusResult[] {
    return Array.from(this.messageStore.values());
  }

  public clear(): void {
    this.idempotencyStore.clear();
    this.messageStore.clear();
  }
}
