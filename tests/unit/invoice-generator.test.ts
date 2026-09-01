import { describe, it, expect } from 'vitest';
import { InvoiceGenerator } from '@/core/documents/invoice-generator';
import { FinOpsCase, TransactionRecord } from '@/types';

describe('Unit Test: Document & PDF Invoice Generator', () => {
  const sampleCase: FinOpsCase = {
    id: 'case_inv_test_001',
    caseNumber: 'CASE-INV-9988',
    transactionId: 'tx_inv_test_001',
    merchantId: 'MERCHANT_DEFAULT',
    status: 'RECOVERING',
    amountAtRiskCents: 1180000, // ₹11,800.00
    recoveredAmountCents: 0,
    reconStatus: 'UNMATCHED_TRANSACTION',
    retryCount: 1,
    maxRetriesAllowed: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleTransaction: TransactionRecord = {
    id: 'tx_inv_test_001',
    merchantId: 'MERCHANT_DEFAULT',
    externalRef: 'order_test_9988',
    customerName: 'Enterprise Client Corp',
    amountCents: 1180000,
    currency: 'INR',
    customerEmail: 'finance@enterprise-client.com',
    customerPhone: '+919876543210',
    customerSegment: 'ENTERPRISE',
    paymentMethod: 'NET_BANKING',
    gatewayCode: 'HDFC_PG',
    status: 'FAILED',
    errorCode: 'GATEWAY_TIMEOUT_504',
    createdAt: new Date().toISOString(),
  };

  it('1. generates a valid standard PDF tax invoice buffer', async () => {
    const result = await InvoiceGenerator.generateInvoicePdf({
      finOpsCase: sampleCase,
      transaction: sampleTransaction,
      merchantName: 'Acme SaaS Solutions Pvt Ltd',
      merchantGstin: '29AAACA1234A1Z5',
      customerName: 'Enterprise Client Corp',
      dueDateDays: 7,
      taxRatePercent: 18,
    });

    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
    expect(result.pdfBuffer.length).toBeGreaterThan(500);

    // Verify PDF Magic Bytes (%PDF-)
    const pdfHeader = result.pdfBuffer.subarray(0, 5).toString('ascii');
    expect(pdfHeader).toBe('%PDF-');

    expect(result.invoiceNumber).toBe(`INV-CASE-INV-9988-${new Date().getFullYear()}`);
    expect(result.grossAmountCents).toBe(1180000); // ₹11,800
    expect(result.netAmountCents).toBe(1000000);   // ₹10,000 base
    expect(result.taxAmountCents).toBe(180000);    // ₹1,800 GST (18%)
    expect(result.paymentLinkUrl).toContain('rzp.io');
    expect(result.dueDate).toBeDefined();
  });

  it('2. generates invoice with custom payment link URL and correct tax calculations', async () => {
    const customLink = 'https://pay.razorpay.com/invoice/custom_link_123';
    const result = await InvoiceGenerator.generateInvoicePdf({
      finOpsCase: {
        ...sampleCase,
        amountAtRiskCents: 590000, // ₹5,900 (₹5,000 + 18% GST)
      },
      transaction: sampleTransaction,
      paymentLinkUrl: customLink,
      taxRatePercent: 18,
    });

    expect(result.pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.paymentLinkUrl).toBe(customLink);
    expect(result.grossAmountCents).toBe(590000);
    expect(result.netAmountCents).toBe(500000);
    expect(result.taxAmountCents).toBe(90000);
  });
});
