// ─── Stripe payment links (pre-created in Stripe Dashboard) ────────
export const STRIPE_URLS: Record<string, string> = {
  single: "https://buy.stripe.com/bJe8wOh2pcGmgqdbx157W00",
  monthly: "https://buy.stripe.com/4gM5kC8vT0XEei5dF957W01",
  bundle: "https://buy.stripe.com/dRmeVcbI59ua7THcB557W02",
};

export interface CheckoutResult {
  configured: boolean;
  url?: string;
  message?: string;
}

/**
 * Returns the Stripe payment link URL for a given plan.
 * No server call needed — payment links are static.
 */
export function getCheckoutUrl(planId: string): CheckoutResult {
  const url = STRIPE_URLS[planId];
  if (!url) {
    return { configured: false, message: `Unknown plan: ${planId}` };
  }
  return { configured: true, url };
}
