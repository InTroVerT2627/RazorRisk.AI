import { RecoveryChannel } from '@/types';

export type MessagingChannel = 'WHATSAPP' | 'EMAIL' | 'SMS';

export type MessageDeliveryStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

export type MessagingProviderMode = 'SIMULATION' | 'TWILIO_TEST' | 'SES_TEST';

export interface MessageRecipient {
  name: string;
  phone?: string;
  email?: string;
  customerId?: string;
}

export interface MessagePayload {
  templateId?: string;
  subject?: string;
  body: string;
  mediaUrl?: string;
  attachmentBuffer?: Buffer;
  attachmentFilename?: string;
  paymentLinkUrl?: string;
  metadata?: Record<string, any>;
}

export interface SendMessageRequest {
  idempotencyKey: string;
  caseId: string;
  channel: MessagingChannel;
  recipient: MessageRecipient;
  payload: MessagePayload;
}

export interface SendMessageResponse {
  success: boolean;
  providerMessageId: string;
  channel: MessagingChannel;
  status: MessageDeliveryStatus;
  providerMode: MessagingProviderMode;
  deliveredAt?: string;
  readAt?: string;
  costCents: number;
  createdAt: string;
  errorMessage?: string;
}

export interface MessageStatusResult {
  providerMessageId: string;
  caseId: string;
  channel: MessagingChannel;
  status: MessageDeliveryStatus;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  errorCode?: string;
  errorDescription?: string;
}

export interface FaultInjectionMessagingConfig {
  simulateTimeout?: boolean;
  simulateDeliveryFailure?: boolean;
  simulateNoReadReceipt?: boolean;
  deliveryDelayMs?: number;
}

export interface MessagingExecutionProvider {
  sendMessage(
    channel: MessagingChannel,
    recipient: MessageRecipient,
    payload: MessagePayload,
    idempotencyKey?: string,
    caseId?: string
  ): Promise<SendMessageResponse>;
}

export interface MessagingStatusProvider {
  getMessageStatus(providerMessageId: string): Promise<MessageStatusResult>;
}
