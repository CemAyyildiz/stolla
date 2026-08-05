"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { LiveStatus } from "@/components/ui/LiveStatus";
import {
  COMMUNITY_LIMITS,
  type CommunityMetadataDraft,
  type CommunityMetadataDraftErrors,
  validateCommunityMetadataDraft,
} from "@/lib/community/schema";

const STORAGE_KEY = "stolla:community-wizard:metadata:v1";

const EMPTY_DRAFT: CommunityMetadataDraft = {
  name: "",
  symbol: "",
  description: "",
  collectionUri: "",
  metadataUri: "",
  logo: "",
  externalLinkLabel: "",
  externalLinkUrl: "",
};

const FIELD_ORDER: (keyof CommunityMetadataDraft)[] = [
  "name",
  "symbol",
  "description",
  "collectionUri",
  "metadataUri",
  "logo",
  "externalLinkLabel",
  "externalLinkUrl",
];

function readStoredDraft(): CommunityMetadataDraft | null {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "");
    if (
      typeof stored !== "object" ||
      stored === null ||
      !FIELD_ORDER.every(
        (field) => typeof (stored as Record<string, unknown>)[field] === "string",
      )
    ) {
      return null;
    }
    return stored as CommunityMetadataDraft;
  } catch {
    return null;
  }
}

function ErrorMessage({
  field,
  errors,
}: {
  field: keyof CommunityMetadataDraft;
  errors: CommunityMetadataDraftErrors;
}) {
  const error = errors[field];
  return error ? (
    <p id={`${field}-error`} role="alert" className="mt-1 text-xs text-rose-300">
      {error}
    </p>
  ) : null;
}

const inputClassName =
  "mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600";

export default function CreateCommunityPage() {
  const [draft, setDraft] = useState<CommunityMetadataDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<CommunityMetadataDraftErrors>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredDraft();
    if (stored) setDraft(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

  function updateField(field: keyof CommunityMetadataDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCommunityMetadataDraft(draft);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setStep(2);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10">
      <Link
        href="/communities"
        className="text-sm text-indigo-300 hover:text-indigo-200"
      >
        ← Communities
      </Link>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
          Community creation
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-100">
          {step === 1 ? "Describe your community" : "Review deployment inputs"}
        </h1>
        <p className="mt-2 text-slate-400">
          {step === 1
            ? "Step 1 collects version-1 public metadata. No wallet signature or deployment occurs here."
            : "Your metadata is saved for this browser session. Contract deployment will be added in a later step."}
        </p>
      </div>

      <ol
        aria-label="Community creation progress"
        className="mt-6 grid grid-cols-2 gap-2 text-sm"
      >
        <li
          aria-current={step === 1 ? "step" : undefined}
          className={`rounded-lg border p-3 ${
            step === 1
              ? "border-indigo-500 bg-indigo-950/50 text-indigo-200"
              : "border-emerald-800 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          <span className="block text-xs opacity-70">Step 1</span>
          Public metadata
        </li>
        <li
          aria-current={step === 2 ? "step" : undefined}
          className={`rounded-lg border p-3 ${
            step === 2
              ? "border-indigo-500 bg-indigo-950/50 text-indigo-200"
              : "border-slate-800 bg-[#151b2b] text-slate-400"
          }`}
        >
          <span className="block text-xs opacity-70">Step 2</span>
          Governance
        </li>
      </ol>

      {step === 2 ? (
        <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5 sm:p-6">
          <LiveStatus className="rounded-lg border border-emerald-800/70 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            Metadata validated and saved for this wizard session.
          </LiveStatus>
          <dl className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-sm text-slate-500">Name</dt>
              <dd className="mt-1 break-words text-slate-100 [overflow-wrap:anywhere]">
                {draft.name}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-slate-500">Symbol</dt>
              <dd className="mt-1 break-words text-slate-100">
                {draft.symbol}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-sm text-slate-500">Metadata URI</dt>
              <dd className="mt-1 break-all font-mono text-sm text-slate-100">
                {draft.metadataUri}
              </dd>
            </div>
          </dl>
          <div className="mt-6 rounded-lg border border-slate-700 bg-[#0b0f19] p-4">
            <h2 className="font-semibold text-slate-100">
              Governance step placeholder
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Voting delay, voting period, proposal threshold, quorum, owner,
              and deployment confirmation belong to later steps. Continuing
              does not submit a transaction.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-6 min-h-11 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 sm:w-auto"
          >
            Back to metadata
          </button>
        </section>
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit}
          className="mt-6 space-y-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
        >
          <section aria-labelledby="identity-title">
            <h2 id="identity-title" className="font-semibold text-slate-100">
              Identity
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="name" className="block text-sm text-slate-300">
                  Community name{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="name"
                  name="name"
                  value={draft.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  required
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={`name-help${errors.name ? " name-error" : ""}`}
                  className={inputClassName}
                  autoComplete="organization"
                />
                <p id="name-help" className="mt-1 text-xs text-slate-500">
                  Public and immutable after creation. Maximum{" "}
                  {COMMUNITY_LIMITS.nameBytes} UTF-8 bytes.
                </p>
                <ErrorMessage field="name" errors={errors} />
              </div>

              <div className="min-w-0">
                <label htmlFor="symbol" className="block text-sm text-slate-300">
                  NFT symbol{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="symbol"
                  name="symbol"
                  value={draft.symbol}
                  onChange={(event) =>
                    updateField("symbol", event.target.value.toUpperCase())
                  }
                  required
                  aria-invalid={Boolean(errors.symbol)}
                  aria-describedby={`symbol-help${errors.symbol ? " symbol-error" : ""}`}
                  className={inputClassName}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="BUILD"
                />
                <p id="symbol-help" className="mt-1 text-xs text-slate-500">
                  1–12 uppercase letters or numbers. Public and immutable.
                </p>
                <ErrorMessage field="symbol" errors={errors} />
              </div>
            </div>

            <div className="mt-5 min-w-0">
              <label
                htmlFor="description"
                className="block text-sm text-slate-300"
              >
                Description{" "}
                <span className="text-slate-500">(required)</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={draft.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                required
                rows={5}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={`description-help${errors.description ? " description-error" : ""}`}
                className={`${inputClassName} resize-y`}
                placeholder="Explain the community and its governance purpose."
              />
              <p id="description-help" className="mt-1 text-xs text-slate-500">
                Public in the committed metadata document. Maximum{" "}
                {COMMUNITY_LIMITS.descriptionBytes.toLocaleString()} UTF-8
                bytes.
              </p>
              <ErrorMessage field="description" errors={errors} />
            </div>
          </section>

          <section
            aria-labelledby="resources-title"
            className="border-t border-slate-800 pt-6"
          >
            <h2 id="resources-title" className="font-semibold text-slate-100">
              Public resources
            </h2>
            <div className="mt-4 space-y-5">
              <div className="min-w-0">
                <label
                  htmlFor="collectionUri"
                  className="block text-sm text-slate-300"
                >
                  NFT collection URI{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="collectionUri"
                  name="collectionUri"
                  type="url"
                  value={draft.collectionUri}
                  onChange={(event) =>
                    updateField("collectionUri", event.target.value)
                  }
                  required
                  aria-invalid={Boolean(errors.collectionUri)}
                  aria-describedby={`collectionUri-help${errors.collectionUri ? " collectionUri-error" : ""}`}
                  className={`${inputClassName} font-mono`}
                  placeholder="ipfs://bafy.../collection.json"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p
                  id="collectionUri-help"
                  className="mt-1 text-xs text-slate-500"
                >
                  Stored by the NFT contract and immutable. Use ipfs:// or
                  https://.
                </p>
                <ErrorMessage field="collectionUri" errors={errors} />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="metadataUri"
                  className="block text-sm text-slate-300"
                >
                  Community metadata URI{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="metadataUri"
                  name="metadataUri"
                  type="url"
                  value={draft.metadataUri}
                  onChange={(event) =>
                    updateField("metadataUri", event.target.value)
                  }
                  required
                  aria-invalid={Boolean(errors.metadataUri)}
                  aria-describedby={`metadataUri-help${errors.metadataUri ? " metadataUri-error" : ""}`}
                  className={`${inputClassName} font-mono`}
                  placeholder="https://example.org/community.json"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p
                  id="metadataUri-help"
                  className="mt-1 text-xs text-slate-500"
                >
                  Stored in the registry with a SHA-256 commitment. The
                  commitment is generated from the final document later.
                </p>
                <ErrorMessage field="metadataUri" errors={errors} />
              </div>

              <div className="min-w-0">
                <label htmlFor="logo" className="block text-sm text-slate-300">
                  Logo URI <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="logo"
                  name="logo"
                  type="url"
                  value={draft.logo}
                  onChange={(event) => updateField("logo", event.target.value)}
                  aria-invalid={Boolean(errors.logo)}
                  aria-describedby={`logo-help${errors.logo ? " logo-error" : ""}`}
                  className={`${inputClassName} font-mono`}
                  placeholder="ipfs://bafy.../logo.png"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p id="logo-help" className="mt-1 text-xs text-slate-500">
                  Public in the metadata document. Use ipfs:// or https://.
                </p>
                <ErrorMessage field="logo" errors={errors} />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="link-title"
            className="border-t border-slate-800 pt-6"
          >
            <h2 id="link-title" className="font-semibold text-slate-100">
              External link <span className="text-slate-500">(optional)</span>
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Both fields are required when adding a link. Additional links can
              be added in the review step.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="externalLinkLabel"
                  className="block text-sm text-slate-300"
                >
                  Link label
                </label>
                <input
                  id="externalLinkLabel"
                  name="externalLinkLabel"
                  value={draft.externalLinkLabel}
                  onChange={(event) =>
                    updateField("externalLinkLabel", event.target.value)
                  }
                  aria-invalid={Boolean(errors.externalLinkLabel)}
                  aria-describedby={
                    errors.externalLinkLabel
                      ? "externalLinkLabel-error"
                      : undefined
                  }
                  className={inputClassName}
                  placeholder="Website"
                />
                <ErrorMessage field="externalLinkLabel" errors={errors} />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="externalLinkUrl"
                  className="block text-sm text-slate-300"
                >
                  HTTPS URL
                </label>
                <input
                  id="externalLinkUrl"
                  name="externalLinkUrl"
                  type="url"
                  value={draft.externalLinkUrl}
                  onChange={(event) =>
                    updateField("externalLinkUrl", event.target.value)
                  }
                  aria-invalid={Boolean(errors.externalLinkUrl)}
                  aria-describedby={
                    errors.externalLinkUrl ? "externalLinkUrl-error" : undefined
                  }
                  className={`${inputClassName} font-mono`}
                  placeholder="https://community.example"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <ErrorMessage field="externalLinkUrl" errors={errors} />
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-indigo-800/70 bg-indigo-950/30 p-4 text-sm leading-6 text-indigo-100">
            <strong className="font-semibold">Before continuing:</strong> name,
            symbol, collection URI, schema version, metadata URI, and metadata
            hash become immutable registry or contract values. Description,
            logo, and links are public and committed by the immutable hash.
          </aside>

          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400 sm:w-auto"
          >
            Continue to governance
          </button>
        </form>
      )}
    </div>
  );
}
