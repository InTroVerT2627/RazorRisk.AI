export class PIIMasker {
  /**
   * Masks email address: john.doe@example.com -> joh***@example.com
   */
  public static maskEmail(email?: string): string {
    if (!email) return '---';
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const name = parts[0];
    const domain = parts[1];
    const visiblePrefix = name.slice(0, Math.min(3, name.length));
    return `${visiblePrefix}***@${domain}`;
  }

  /**
   * Masks phone number: +91 9876543210 -> +91 ******3210
   */
  public static maskPhone(phone?: string): string {
    if (!phone) return '---';
    const clean = phone.trim();
    if (clean.length < 4) return '******';
    const last4 = clean.slice(-4);
    const prefix = clean.startsWith('+') ? clean.slice(0, 3) + ' ' : '';
    return `${prefix}******${last4}`;
  }

  /**
   * Masks payment card / account number: 4111222233334242 -> **** **** **** 4242
   */
  public static maskCardOrAccount(identifier?: string): string {
    if (!identifier) return '---';
    const clean = identifier.replace(/[\s-]/g, '');
    if (clean.length < 4) return '****';
    const last4 = clean.slice(-4);
    return `**** **** **** ${last4}`;
  }

  /**
   * Sanitizes prompt context removing internal credentials / injection markers
   */
  public static sanitizeUntrustedText(text?: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]*>?/gm, '') // Remove HTML tags
      .replace(/[\\$"']/g, '') // Remove quotation and shell escapes
      .trim()
      .slice(0, 300);
  }
}
