import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationMessagingAdapter } from '@/core/messaging-provider/simulation-adapter';

describe('Unit Test: Simulation Messaging Provider Abstraction', () => {
  let adapter: SimulationMessagingAdapter;

  beforeEach(() => {
    adapter = new SimulationMessagingAdapter();
  });

  it('1. sends a WhatsApp message and returns valid delivery and read timestamps', async () => {
    const response = await adapter.sendMessage(
      'WHATSAPP',
      { name: 'Rohan Sharma', phone: '+919876543210', email: 'rohan@enterprise.in' },
      {
        body: 'Your payment is due. Pay now: https://rzp.io/i/test_01',
        paymentLinkUrl: 'https://rzp.io/i/test_01',
      },
      'idemp_wa_01',
      'CASE-1001'
    );

    expect(response.success).toBe(true);
    expect(response.channel).toBe('WHATSAPP');
    expect(response.status).toBe('READ');
    expect(response.providerMessageId).toMatch(/^msg_sim_whatsapp_/);
    expect(response.deliveredAt).toBeDefined();
    expect(response.readAt).toBeDefined();
    expect(response.costCents).toBe(80); // ₹0.80

    // Fetch status from store
    const status = await adapter.getMessageStatus(response.providerMessageId);
    expect(status.status).toBe('READ');
    expect(status.caseId).toBe('CASE-1001');
  });

  it('2. sends an Email message with PDF attachment and returns DELIVERED status', async () => {
    const fakePdfBuffer = Buffer.from('%PDF-1.4 Mock Invoice Stream');
    const response = await adapter.sendMessage(
      'EMAIL',
      { name: 'Finance Lead', email: 'ap@corp.com' },
      {
        subject: 'Tax Invoice INV-2026-001',
        body: 'Please find attached tax invoice.',
        attachmentBuffer: fakePdfBuffer,
        attachmentFilename: 'INV-2026-001.pdf',
      },
      'idemp_email_01',
      'CASE-1002'
    );

    expect(response.success).toBe(true);
    expect(response.channel).toBe('EMAIL');
    expect(response.costCents).toBe(10); // ₹0.10
    expect(response.deliveredAt).toBeDefined();
  });

  it('3. enforces idempotency on identical idempotencyKey', async () => {
    const key = 'idemp_unique_key_999';
    const resp1 = await adapter.sendMessage(
      'WHATSAPP',
      { name: 'Test Customer', phone: '+919999999999' },
      { body: 'First attempt' },
      key,
      'CASE-1003'
    );

    const resp2 = await adapter.sendMessage(
      'WHATSAPP',
      { name: 'Test Customer', phone: '+919999999999' },
      { body: 'Second attempt should be deduplicated' },
      key,
      'CASE-1003'
    );

    expect(resp1.providerMessageId).toBe(resp2.providerMessageId);
    expect(resp1.createdAt).toBe(resp2.createdAt);
  });

  it('4. fault injection: simulates delivery failure', async () => {
    adapter.setFaultConfig({ simulateDeliveryFailure: true });

    const response = await adapter.sendMessage(
      'WHATSAPP',
      { name: 'Unreachable Contact', phone: '+910000000000' },
      { body: 'Will fail delivery' },
      'idemp_fail_01',
      'CASE-1004'
    );

    expect(response.success).toBe(false);
    expect(response.status).toBe('FAILED');
    expect(response.errorMessage).toContain('MESSAGING_DELIVERY_FAILED');
  });

  it('5. fault injection: simulates gateway timeout', async () => {
    adapter.setFaultConfig({ simulateTimeout: true });

    await expect(
      adapter.sendMessage(
        'EMAIL',
        { name: 'Timeout Contact', email: 'timeout@test.com' },
        { body: 'Will timeout' },
        'idemp_timeout_01',
        'CASE-1005'
      )
    ).rejects.toThrow('MESSAGING_TIMEOUT_504');
  });

  it('6. fault injection: simulates delivery without read receipts', async () => {
    adapter.setFaultConfig({ simulateNoReadReceipt: true });

    const response = await adapter.sendMessage(
      'EMAIL',
      { name: 'No Read Receipt Contact', email: 'noreceipt@test.com' },
      { body: 'No read receipt available' },
      'idemp_noread_01',
      'CASE-1006'
    );

    expect(response.success).toBe(true);
    expect(response.status).toBe('DELIVERED');
    expect(response.readAt).toBeUndefined();
  });
});
