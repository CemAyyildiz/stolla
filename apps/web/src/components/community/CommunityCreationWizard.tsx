"use client";

import { useMemo, useState } from "react";
import { useCommunityDeployment } from "@/lib/communityFactory/useCommunityDeployment";
import type { CommunityWizardState } from "@/lib/communityFactory/types";
import { config, contractIds } from "@/lib/stellar";

const initialState: CommunityWizardState = {
  metadata: {
    name: "",
    symbol: "",
    baseUri: "ipfs://",
    description: "",
    externalUrl: "",
  },
  governance: {
    votingDelay: "1",
    votingPeriod: "17280",
    proposalThreshold: "1",
    quorum: "1",
  },
};

const steps = ["Metadata", "Governance", "Review"];

export function CommunityCreationWizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<CommunityWizardState>(initialState);
  const deployment = useCommunityDeployment();

  const canDeploy = Boolean(contractIds.communityFactory) && !deployment.isSubmitting;

  const summary = useMemo(
    () => [
      ["Factory", contractIds.communityFactory || "Not configured"],
      ["Network", config.networkPassphrase],
      ["Function", "deploy_community"],
      ["Name", state.metadata.name || "-"],
      ["Symbol", state.metadata.symbol || "-"],
      ["Base URI", state.metadata.baseUri || "-"],
      ["Voting delay", `${state.governance.votingDelay} ledgers`],
      ["Voting period", `${state.governance.votingPeriod} ledgers`],
      ["Proposal threshold", state.governance.proposalThreshold],
      ["Quorum", state.governance.quorum],
    ],
    [state],
  );

  return (
    <section className="rounded-lg border border-slate-800 bg-[#151b2b] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-100">Create community</h2>
          <p className="mt-1 text-sm text-slate-400">
            Deploy a new NFT membership and Governor pair through CommunityFactory.
          </p>
        </div>
        <ol className="flex gap-2 text-xs">
          {steps.map((label, index) => (
            <li
              key={label}
              className={`rounded-md border px-2 py-1 ${
                index === step
                  ? "border-indigo-400 bg-indigo-500/20 text-indigo-100"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              {label}
            </li>
          ))}
        </ol>
      </div>

      {!contractIds.communityFactory && (
        <p className="mt-4 rounded-md border border-amber-800/60 bg-amber-950/50 p-3 text-sm text-amber-200">
          Set <code className="font-mono">NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID</code>{" "}
          before deploying a community.
        </p>
      )}

      <div className="mt-5">
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Community name"
              value={state.metadata.name}
              onChange={(name) =>
                setState((current) => ({
                  ...current,
                  metadata: { ...current.metadata, name },
                }))
              }
            />
            <TextField
              label="NFT symbol"
              value={state.metadata.symbol}
              onChange={(symbol) =>
                setState((current) => ({
                  ...current,
                  metadata: { ...current.metadata, symbol },
                }))
              }
            />
            <TextField
              label="Base metadata URI"
              value={state.metadata.baseUri}
              mono
              onChange={(baseUri) =>
                setState((current) => ({
                  ...current,
                  metadata: { ...current.metadata, baseUri },
                }))
              }
            />
            <TextField
              label="External URL"
              value={state.metadata.externalUrl}
              mono
              onChange={(externalUrl) =>
                setState((current) => ({
                  ...current,
                  metadata: { ...current.metadata, externalUrl },
                }))
              }
            />
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-400">Description</span>
              <textarea
                value={state.metadata.description}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    metadata: {
                      ...current.metadata,
                      description: event.target.value,
                    },
                  }))
                }
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Voting delay"
              value={state.governance.votingDelay}
              mono
              onChange={(votingDelay) =>
                setState((current) => ({
                  ...current,
                  governance: { ...current.governance, votingDelay },
                }))
              }
            />
            <TextField
              label="Voting period"
              value={state.governance.votingPeriod}
              mono
              onChange={(votingPeriod) =>
                setState((current) => ({
                  ...current,
                  governance: { ...current.governance, votingPeriod },
                }))
              }
            />
            <TextField
              label="Proposal threshold"
              value={state.governance.proposalThreshold}
              mono
              onChange={(proposalThreshold) =>
                setState((current) => ({
                  ...current,
                  governance: { ...current.governance, proposalThreshold },
                }))
              }
            />
            <TextField
              label="Quorum"
              value={state.governance.quorum}
              mono
              onChange={(quorum) =>
                setState((current) => ({
                  ...current,
                  governance: { ...current.governance, quorum },
                }))
              }
            />
          </div>
        )}

        {step === 2 && (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {summary.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-slate-500">{label}</dt>
                <dd className="break-words font-mono text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || deployment.isSubmitting}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
            disabled={deployment.isSubmitting}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void deployment.deploy(state)}
            disabled={!canDeploy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {deployment.isSubmitting ? "Deploying..." : "Deploy community"}
          </button>
        )}
      </div>

      <p className="mt-4 rounded-md border border-slate-800 bg-[#0b0f19] p-3 text-sm text-slate-200">
        {deployment.status}
      </p>
      {deployment.transactionHash && (
        <p className="mt-2 break-all font-mono text-xs text-slate-400">
          {deployment.transactionHash}
        </p>
      )}
    </section>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
};

function TextField({ label, value, onChange, mono }: TextFieldProps) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full rounded-md border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}
