import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { tailorResume as aiTailor } from "~/lib/ai-service";
import { createCheckout } from "~/lib/checkout";

// ---------------------------------------------------------------------------
// Server function — uses the AI service module (supports OpenAI, Anthropic & AI21).
// Falls back to a smart mock when no API key is configured.
// ---------------------------------------------------------------------------
const tailorResume = createServerFn({ method: "GET" })
  .validator((data: { resume: string; jobDesc: string }) => data)
  .handler(async ({ data }) => {
    const result = await aiTailor(data);
    return { tailored: result.tailored, provider: result.provider };
  });

export const Route = createFileRoute("/")({
  component: Home,
});

// ─── Plans ──────────────────────────────────────────────────────────
const PLANS = [
  { id: "single", label: "Single Resume", price: "$2.99", period: "/ resume" },
  { id: "monthly", label: "Unlimited Monthly", price: "$9.99", period: "/ month", featured: true },
  { id: "bundle", label: "Job Hunt Kit", price: "$19.99", period: "/ bundle" },
] as const;

// ─── Component ──────────────────────────────────────────────────────
function Home() {
  const [resume, setResume] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Check for ?paid=true on page load
  // Check for successful payment redirect (Square adds transactionId)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const transactionId = params.get("transactionId");
    if (params.get("paid") === "true" || transactionId) {
      setPaid(true);
      sessionStorage.setItem("tailorcv_paid", "true");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const handleTailor = async () => {
    if (!resume.trim() || !jobDesc.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { tailored } = await tailorResume({ data: { resume, jobDesc } });
      setResult(tailored);
    } catch {
      setResult("⚠️ Something went wrong. Please try again or contact support.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tailored-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCheckout = useCallback(async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const result = await createCheckout({ data: { plan: planId } });
      if (!result.configured) {
        alert(result.message || "Payments coming soon — sign up for early access.");
        return;
      }
      if (result.url) {
        sessionStorage.setItem("tailorcv_checkout_plan", planId);
        window.location.href = result.url;
      }
    } catch {
      alert("Payment service is temporarily unavailable. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  }, []);

  const handlePayAndDownload = useCallback(async () => {
    await handleCheckout("single");
  }, [handleCheckout]);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white">
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600">
            TailorCV
          </span>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            <a href="#form" className="hover:text-indigo-600">Try It</a>
            <a href="#pricing" className="hover:text-indigo-600">Pricing</a>
          </nav>
          <a
            href="#form"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Get Started
          </a>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-8 pt-20 text-center sm:pt-28">
        <span className="mb-6 inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700">
          AI-Powered Resume Tailoring
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Land More Interviews.{" "}
          <span className="text-indigo-600">Tailor Your Resume</span> in Seconds.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
          Stop spending hours rewriting your resume for every application.
          TailorCV analyzes your master resume against any job description and
          instantly produces an ATS-optimized version highlighting your most
          relevant experience — so you get more callbacks with less effort.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href="#form"
            className="rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
          >
            Try It Free →
          </a>
          <a
            href="#pricing"
            className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            See Pricing
          </a>
        </div>

        {/* Social proof */}
        <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-3">
          {[
            { stat: "10×", label: "Faster Edits" },
            { stat: "3.4×", label: "More Callbacks" },
            { stat: "2 min", label: "Per Resume" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="text-2xl font-bold text-indigo-600">{item.stat}</div>
              <div className="mt-1 text-sm text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold text-slate-900">How It Works</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            { step: "1", title: "Paste Your Resume", desc: "Copy your master resume into the left panel — the one you're proud of." },
            { step: "2", title: "Paste the Job Description", desc: "Paste any job posting into the right panel. We'll analyze every keyword." },
            { step: "3", title: "Get Your Tailored Resume", desc: "Hit 'Tailor My Resume' and download an ATS-optimized version in seconds." },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">{item.step}</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Input Form ──────────────────────────────────────────── */}
      <section id="form" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
          Tailor Your Resume Now
        </h2>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label htmlFor="resume" className="mb-2 block text-sm font-semibold text-slate-700">
              Your Master Resume
            </label>
            <textarea
              id="resume"
              rows={14}
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder={`Paste your full master resume here...\ne.g.\n\nJohn Doe\njohn@example.com\n\nEXPERIENCE\nSenior Software Engineer, Acme Corp (2020–Present)`}
              className="w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label htmlFor="jobDesc" className="mb-2 block text-sm font-semibold text-slate-700">
              Job Description
            </label>
            <textarea
              id="jobDesc"
              rows={14}
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder={`Paste the job description here...\n\ne.g.\n\nTitle: Senior Frontend Engineer\n\nWe're looking for an experienced React engineer...`}
              className="w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-8 text-center">
          <button
            onClick={handleTailor}
            disabled={loading || !resume.trim() || !jobDesc.trim()}
            className="rounded-xl bg-indigo-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Tailoring...
              </span>
            ) : (
              "🎯 Tailor My Resume"
            )}
          </button>
          <p className="mt-3 text-xs text-slate-400">
            {paid ? "✓ Payment confirmed — download unlocked" : "Free preview. Pay only when you download."}
          </p>
        </div>

        {/* Result */}
        {result && (
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Your Tailored Resume
              </h3>
              <div className="flex gap-3">
                {paid ? (
                  <>
                    <button
                      onClick={handleCopy}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {copied ? "✓ Copied!" : "📋 Copy"}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      ⬇ Download
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handlePayAndDownload}
                    disabled={checkoutLoading === "single"}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {checkoutLoading === "single" ? "Opening Checkout..." : "🔓 Unlock Download — $2.99"}
                  </button>
                )}
              </div>
            </div>

            {/* Preview */}
            <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm leading-relaxed text-slate-800">
              {result}
            </pre>

            {/* Paywall gate (shown when not paid) */}
            {!paid && (
              <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-6 text-center">
                <div className="mb-2 text-2xl">🔒</div>
                <h4 className="text-lg font-semibold text-amber-900">Preview Ready — Unlock to Download</h4>
                <p className="mx-auto mt-2 max-w-md text-sm text-amber-700">
                  Your tailored resume is ready. Pay once to download, copy, and use it for this application.
                </p>
                <button
                  onClick={handlePayAndDownload}
                  disabled={checkoutLoading === "single"}
                  className="mt-5 rounded-xl bg-amber-600 px-8 py-3 font-semibold text-white shadow-lg shadow-amber-200 hover:bg-amber-700 disabled:opacity-50"
                >
                  {checkoutLoading === "single" ? "Opening..." : "🔓 Unlock for $2.99"}
                </button>
                <p className="mt-3 text-xs text-amber-500">
                  or{" "}
                  <button onClick={() => handleCheckout("monthly")} className="underline hover:text-amber-700">
                    subscribe for $9.99/month
                  </button>{" "}
                  for unlimited access
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <section id="pricing" className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold text-slate-900">Simple, Transparent Pricing</h2>
          <p className="mt-4 text-lg text-slate-600">
            Start with a single resume or go unlimited. No hidden fees.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border bg-white p-8 shadow-sm ${
                  plan.featured
                    ? "relative border-2 border-indigo-500 shadow-xl shadow-indigo-100"
                    : "border-slate-200"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-900">{plan.label}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3 text-left text-sm text-slate-600">
                  {plan.id === "single" && (
                    <>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> One tailored resume</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> ATS-optimized output</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> Copy &amp; download</li>
                      <li className="flex items-start gap-2"><span className="text-slate-300">—</span> No account required</li>
                    </>
                  )}
                  {plan.id === "monthly" && (
                    <>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> Unlimited tailored resumes</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> Version history</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> Priority processing</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> Cancel anytime</li>
                    </>
                  )}
                  {plan.id === "bundle" && (
                    <>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> 5 tailored resumes</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> 1 cover letter</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> ATS-optimized</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500">✓</span> Best value</li>
                    </>
                  )}
                </ul>
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={checkoutLoading === plan.id}
                  className={`mt-8 w-full rounded-xl px-6 py-3 font-semibold disabled:opacity-50 ${
                    plan.featured
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {checkoutLoading === plan.id
                    ? "Opening..."
                    : plan.id === "single"
                      ? "Buy — $2.99"
                      : plan.id === "monthly"
                        ? "Subscribe — $9.99/mo"
                        : "Get the Kit — $19.99"
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white px-6 py-12">
        <div className="mx-auto max-w-5xl text-center text-sm text-slate-400">
          <p className="font-semibold text-indigo-600">TailorCV</p>
          <p className="mt-2">Land more interviews. Tailor your resume in seconds.</p>
          <p className="mt-4">
            Built with{" "}
            <a href="https://cto.new" className="underline hover:text-slate-600">cto.new</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
