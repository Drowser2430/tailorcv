import { createServerFn } from "@tanstack/react-start";

// ─── Pricing map (in cents for Square) ──────────────────────────────
const PRICES: Record<string, { label: string; amountCents: number }> = {
  single: { label: "Tailored Resume", amountCents: 299 },
  monthly: { label: "Unlimited Monthly", amountCents: 999 },
  bundle: { label: "Job Hunt Kit", amountCents: 1999 },
};

const SQUARE_API = "https://connect.squareupsandbox.com/v2/checkouts";
const REDIRECT_URL = "https://a595c1087e0e61e8e72f1580dfb437e0.ctonew.app";

export interface CheckoutResult {
  configured: boolean;
  url?: string;
  message?: string;
}

export const createCheckout = createServerFn({ method: "POST" })
  .validator((data: { plan: string }) => data)
  .handler(async ({ data }) => {
    const token = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;

    if (!token || !locationId) {
      return {
        configured: false,
        message: "Payments coming soon — sign up for early access.",
      } as CheckoutResult;
    }

    const price = PRICES[data.plan];
    if (!price) {
      return {
        configured: false,
        message: `Unknown plan: ${data.plan}`,
      } as CheckoutResult;
    }

    const res = await fetch(SQUARE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        order: {
          order: {
            location_id: locationId,
            line_items: [
              {
                name: price.label,
                quantity: "1",
                base_price_money: {
                  amount: price.amountCents,
                  currency: "USD",
                },
              },
            ],
          },
        },
        redirect_url: REDIRECT_URL,
        pre_populate: {},
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        configured: false,
        message: `Square error: ${text}`,
      } as CheckoutResult;
    }

    const json = (await res.json()) as { checkout: { checkout_page_url: string } };
    return {
      configured: true,
      url: json.checkout.checkout_page_url,
    } as CheckoutResult;
  });
