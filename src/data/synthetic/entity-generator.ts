import { SeededPRNG } from './prng';
import { MerchantRecord, CustomerProfile, DeviceSessionSignal } from '@/types';

export class EntityGraphGenerator {
  public static generateMerchants(count: number, prng: SeededPRNG): MerchantRecord[] {
    const industries: MerchantRecord['industry'][] = ['ECOMMERCE', 'SAAS', 'GAMING', 'B2B_WHOLESALE', 'HEALTHCARE'];
    const tiers: MerchantRecord['tier'][] = ['ENTERPRISE', 'MID_MARKET', 'SMB'];
    const names = [
      'Razorpay Cloud Labs', 'Zomato Merchant Fleet', 'Swiggy Direct Eats', 'Zepto Quick Store',
      'Flipkart SuperMart', 'Nykaa Beauty Hub', 'Urban Company Services', 'Blinkit Express',
      'Cred Luxury Club', 'Ola Mobility Pass', 'Paytm Mall Hub', 'Dunzo Daily Fresh',
      'Groww Capital Tech', 'Zerodha Traders Desk', 'Tata Neu Mega Store', 'Reliance Digital B2B'
    ];

    const merchants: MerchantRecord[] = [];
    for (let i = 0; i < count; i++) {
      const name = i < names.length ? names[i] : `Merchant Partner ${i + 1}`;
      const industry = prng.pick(industries);
      const tier = prng.sampleWeighted(tiers, [0.15, 0.35, 0.50]);

      merchants.push({
        id: `merch_${(i + 1).toString().padStart(4, '0')}`,
        name,
        industry,
        tier,
        settlementCycleHours: tier === 'ENTERPRISE' ? 12 : tier === 'MID_MARKET' ? 24 : 48,
        mdrBps: industry === 'GAMING' ? 250 : industry === 'SAAS' ? 180 : 150,
        gstBps: 1800, // 18% GST on MDR
        maxDiscountBps: tier === 'ENTERPRISE' ? 1500 : 1000,
        maxRetriesAllowed: 3,
      });
    }

    return merchants;
  }

  public static generateCustomerPopulation(
    count: number,
    fraudRingCount: number,
    prng: SeededPRNG
  ): {
    customers: CustomerProfile[];
    fraudRings: Map<string, string[]>;
    devices: Map<string, DeviceSessionSignal>;
  } {
    const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Diya', 'Ananya', 'Aadhya', 'Pari', 'Saanvi', 'Myra', 'Anika', 'Navya', 'Riya', 'Pooja', 'Rahul', 'Vikram', 'Rohit', 'Suresh', 'Kavita', 'Deepa', 'Amit', 'Priya', 'Neha', 'Sunil'];
    const lastNames = ['Sharma', 'Verma', 'Patel', 'Nair', 'Iyer', 'Menon', 'Gupta', 'Singh', 'Malhotra', 'Reddy', 'Rao', 'Chopra', 'Kapoor', 'Bose', 'Das', 'Sen', 'Banerjee', 'Mehta', 'Jain', 'Kulkarni'];

    const customers: CustomerProfile[] = [];
    const fraudRings = new Map<string, string[]>();
    const devices = new Map<string, DeviceSessionSignal>();

    // 1. Setup Fraud Rings (Coordinated multi-account rings)
    for (let r = 0; r < fraudRingCount; r++) {
      const ringId = `ring_${(r + 1).toString().padStart(3, '0')}`;
      const ringSize = prng.rangeInt(3, 8);
      const sharedDeviceId = `dev_ring_${ringId}`;
      const sharedSubnet = `103.${prng.rangeInt(10, 250)}.${prng.rangeInt(1, 250)}`;

      devices.set(sharedDeviceId, {
        deviceId: sharedDeviceId,
        ipAddress: `${sharedSubnet}.${prng.rangeInt(2, 250)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 FraudAutomator/2.1',
        geoCountry: 'IN',
        vpnProxyDetected: true,
        fingerprintVelocity24h: prng.rangeInt(15, 60),
        linkedAccountCount: ringSize,
      });

      const memberIds: string[] = [];
      for (let m = 0; m < ringSize; m++) {
        const custId = `cust_fraud_${ringId}_${m + 1}`;
        memberIds.push(custId);

        const first = prng.pick(firstNames);
        const last = prng.pick(lastNames);
        customers.push({
          id: custId,
          name: `${first} ${last}`,
          email: `burner_${prng.rangeInt(1000, 9999)}_${m}@tempinbox.net`,
          phone: `+9199${prng.rangeInt(10000000, 99999999)}`,
          historicalTransactionsCount: prng.rangeInt(0, 2),
          historicalChargebackCount: prng.rangeInt(1, 4),
          historicalDisputeRatio: prng.range(0.4, 0.9),
          accountAgeDays: prng.rangeInt(1, 7),
          isHighLtv: false,
          isKnownFraudster: true,
          fraudRingId: ringId,
          primaryDeviceId: sharedDeviceId,
          ipSubnet: sharedSubnet,
        });
      }
      fraudRings.set(ringId, memberIds);
    }

    // 2. Setup Legitimate Population
    const remainingCount = Math.max(0, count - customers.length);
    for (let i = 0; i < remainingCount; i++) {
      const custId = `cust_${(i + 1).toString().padStart(6, '0')}`;
      const first = prng.pick(firstNames);
      const last = prng.pick(lastNames);
      const isHighLtv = prng.chance(0.08); // 8% enterprise / high LTV
      const deviceId = `dev_${custId}`;
      const ipSubnet = `49.${prng.rangeInt(10, 250)}.${prng.rangeInt(1, 250)}`;

      devices.set(deviceId, {
        deviceId,
        ipAddress: `${ipSubnet}.${prng.rangeInt(2, 250)}`,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
        geoCountry: 'IN',
        vpnProxyDetected: false,
        fingerprintVelocity24h: prng.rangeInt(1, 4),
        linkedAccountCount: 1,
      });

      const txHistory = isHighLtv ? prng.rangeInt(40, 300) : prng.rangeInt(1, 35);
      const cbCount = prng.chance(0.03) ? 1 : 0;

      customers.push({
        id: custId,
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${prng.rangeInt(10, 999)}@gmail.com`,
        phone: `+9198${prng.rangeInt(10000000, 99999999)}`,
        historicalTransactionsCount: txHistory,
        historicalChargebackCount: cbCount,
        historicalDisputeRatio: txHistory > 0 ? cbCount / txHistory : 0,
        accountAgeDays: prng.rangeInt(30, 1200),
        isHighLtv,
        isKnownFraudster: false,
        primaryDeviceId: deviceId,
        ipSubnet,
      });
    }

    return {
      customers,
      fraudRings,
      devices,
    };
  }
}
