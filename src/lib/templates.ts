// TLSNotary badge templates, bundled at build time from docs/tlsnotary/templates.
import index from "../../docs/tlsnotary/templates/index.json";

export type TemplateStatus = "draft" | "tested" | "production" | "deprecated";

export type TemplateIndexEntry = {
  name: string;
  file: string;
  status: TemplateStatus;
  category: string;
};

export type Template = {
  name: string;
  version: string;
  status: TemplateStatus;
  risk?: "low" | "medium" | "high";
  claim: string;
  target: {
    api_url: string;
    method: string;
    host: string;
    window_url: string;
    auth: {
      strategy: string;
      intercept_filter: string;
      required_headers: string[];
      required_cookie?: string;
    };
    tls_min?: string;
  };
  prove_params: {
    max_recv_data: number;
    max_sent_data: number;
    reveal_fields: string[];
    /** Hash-committed, never revealed; opened only in a zero-knowledge proof on the device (lib/personProof.ts). */
    commit_fields?: string[];
    reveal_regex?: { regex: string; flags?: string }[];
    notes?: string;
  };
  badge: { label: string; icon: string; color: string };
  freshness?: { max_age_days: number; stale_after_days: number };
  issue_when?: { person_proof?: { circuit: string; scope: string } };
  tags?: string[];
};

const files = import.meta.glob<Template>("../../docs/tlsnotary/templates/*.json", {
  eager: true,
  import: "default",
});

export const templates: { category: string; template: Template }[] = (
  index.templates as TemplateIndexEntry[]
).map((entry) => ({
  category: entry.category,
  template: files[`../../docs/tlsnotary/templates/${entry.file}`],
}));

export const getTemplate = (name: string) => templates.find((t) => t.template.name === name);

/** Templates are looked up by file stem, so registry ids like "dev/github-account-age" resolve too. */
export const getTemplateByStem = (name: string) =>
  files[`../../docs/tlsnotary/templates/${name.split("/").pop()}.json`];

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
