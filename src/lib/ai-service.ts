// -------------------------------------------------------------------------------------------------
// AI Tailoring Service
// Configurable LLM provider (OpenAI / Anthropic) via env vars.
// Falls back to a smart mock if no API key is configured.
// ---------------------------------------------------------------------------
// Environment variables:
//   LLM_PROVIDER  - "openai" (default) or "anthropic"
//   LLM_API_KEY   - API key for the chosen provider
//   LLM_MODEL     - model name (defaults per provider)
// ---------------------------------------------------------------------------

export interface TailorInput {
  resume: string;
  jobDesc: string;
}

export interface TailorResult {
  tailored: string;
  provider: string;
  model: string;
}

// ─── Prompt template ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert resume writer and ATS (Applicant Tracking System) optimization specialist. Your task is to tailor a candidate's master resume to a specific job description.

RULES:
1. PRIORITIZE keywords, skills, and experience from the job description
2. KEEP the same overall section structure as the original resume
3. REWRITE bullet points to emphasize relevant achievements - use strong action verbs and quantify results where possible
4. Remove or de-emphasize experience that is not relevant to the target role
5. Add relevant keywords and phrases from the job description naturally
6. NEVER fabricate experience, titles, degrees, or dates - only work with what the candidate provided
7. Maintain truthful content throughout
8. Format the output in clean markdown-like plain text

OUTPUT FORMAT (use exactly this structure):
## Professional Summary
2-3 sentences tailored to the target role, highlighting the most relevant qualifications.

## Core Competencies
A comma-separated list of 8-12 relevant skills matching both the resume and job description.

## Professional Experience

### [Job Title] | [Company] | [Dates]
- Rewritten bullet point focusing on relevant achievements
- Another bullet emphasizing transferable skills
- Another result-oriented bullet

[Repeat for each relevant position]

## Education
[As listed in original resume]

## Certifications & Additional (if relevant)
[Only if present in the original resume]

IMPORTANT: The output must be truthful - do not add credentials, titles, or experience the candidate does not claim.`;

const USER_PROMPT_TEMPLATE = `CANDIDATE'S MASTER RESUME:
---
{resume}
---

TARGET JOB DESCRIPTION:
---
{jobDesc}
---

Please produce a tailored, ATS-optimized version of this resume following all the rules above.`;

// ─── Provider implementations ────────────────────────────────────────

interface ProviderConfig {
  apiKey: string;
  model: string;
  endpoint: string;
}

function getProviderConfig(): ProviderConfig | null {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const apiKey = process.env.LLM_API_KEY || "";

  if (!apiKey) return null;

  if (provider === "anthropic") {
    return {
      apiKey,
      model: process.env.LLM_MODEL || "claude-sonnet-4-20250514",
      endpoint: "https://api.anthropic.com/v1/messages",
    };
  }

  // Default: OpenAI
  return {
    apiKey,
    model: process.env.LLM_MODEL || "gpt-4o",
    endpoint: "https://api.openai.com/v1/chat/completions",
  };
}

async function callOpenAI(
  cfg: ProviderConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return json.choices[0]?.message?.content ?? "";
}

async function callAnthropic(
  cfg: ProviderConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      system,
      messages: [{ role: "user", content: user }],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    content: { text: string }[];
  };
  return json.content?.[0]?.text ?? "";
}

// ─── Smart fallback mock ──────────────────────────────────────────────

function smartMock(input: TailorInput): string {
  const { resume, jobDesc } = input;
  const resumeLines = resume.split("\n").filter((l) => l.trim());
  const jobLines = jobDesc.split("\n").filter((l) => l.trim());

  // Extract job title from JD
  const jobTitle =
    jobLines.find(
      (l) =>
        l.match(/title|role|position/i) &&
        !l.match(/requirement|responsibilit|qualification/i),
    )?.replace(/^(title|role|position):?\s*/i, "") || "the target role";

  // Extract key skills from JD
  const skillKeywords = jobDesc
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 2 &&
        /[A-Za-z]/.test(s) &&
        !s.match(
          /^(and|or|the|for|with|from|years|experience|required|preferred)$/i,
        ),
    )
    .slice(0, 12);

  // Extract resume sections
  const sections = resumeLines
    .filter((l) => l.match(/^[A-Z\s]{3,}:?$|^##?\s+/))
    .map((l) => l.replace(/^##?\s*/, "").replace(/:$/, ""));

  const summarySection = resumeLines
    .filter(
      (l) =>
        l.match(/summary|profile|about|objective/i) ||
        sections.includes("Summary") ||
        sections.includes("Profile"),
    )
    .slice(0, 3);

  const experienceSection = resumeLines.filter(
    (l) =>
      l.match(/experience|employment|work|history/i) ||
      (l.match(/^[•\-–—]\s+/) && !l.match(/education|skill|summary|profile/i)),
  );

  const eduSection = resumeLines.filter(
    (l) =>
      l.match(/education|university|college|degree|bachelor|master|phd/i) &&
      !l.match(/^[•\-–—]/),
  );

  const skillSection = resumeLines.filter(
    (l) => l.match(/skill|technology|competenc|expertise|proficien/i) && !l.match(/^[•\-–—]/),
  );

  // Build tailored summary
  const summary =
    summarySection.length > 0
      ? summarySection
          .join(" ")
          .replace(/summary|profile|objective/i, "")
          .trim()
      : `Experienced professional seeking to leverage expertise in a ${jobTitle} role.`;

  // Build competencies
  const existingSkills = skillSection
    .join(" ")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  const competencies = [
    ...new Set([...skillKeywords.slice(0, 6), ...existingSkills.slice(0, 6)]),
  ].slice(0, 12);

  // Build experience bullets
  const relevantBullets = experienceSection.filter(
    (b) =>
      skillKeywords.some((k) =>
        b.toLowerCase().includes(k.toLowerCase()),
      ) || b.match(/^[•\-–—]\s+/),
  );

  return [
    "## Professional Summary",
    summary.length > 100
      ? summary
      : `Dedicated professional with expertise in ${competencies.slice(0, 3).join(", ")}, seeking to contribute to a ${jobTitle} position. Proven track record of delivering results and driving impact.`,
    "",
    "## Core Competencies",
    competencies.join(", "),
    "",
    "## Professional Experience",
    ...(relevantBullets.length > 0
      ? relevantBullets.slice(0, 8)
      : [
          "- [Relevant experience bullet tailored to target role]",
          "- [Achievement highlighting key skills from job description]",
        ]),
    "",
    "## Education",
    ...(eduSection.length > 0 ? eduSection : ["[Education details as listed in master resume]"]),
    "",
  ].join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────

export async function tailorResume(input: TailorInput): Promise<TailorResult> {
  const cfg = getProviderConfig();

  if (!cfg) {
    // No API key configured — use smart mock
    return {
      tailored: smartMock(input),
      provider: "mock",
      model: "smart-fallback",
    };
  }

  const provider = process.env.LLM_PROVIDER || "openai";
  const userPrompt = USER_PROMPT_TEMPLATE.replace(
    "{resume}",
    input.resume,
  ).replace("{jobDesc}", input.jobDesc);

  try {
    let tailored: string;

    if (provider === "anthropic") {
      tailored = await callAnthropic(cfg, SYSTEM_PROMPT, userPrompt);
    } else {
      tailored = await callOpenAI(cfg, SYSTEM_PROMPT, userPrompt);
    }

    return { tailored, provider, model: cfg.model };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`AI tailoring failed: ${message}`);
  }
}