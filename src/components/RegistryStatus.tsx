import { HEALTH_COLOR, SOUNDNESS_COLOR, type Health, type Soundness } from "../lib/registry";

const HEALTH_HELP: Record<Health, string> = {
  working: "New proofs can be generated",
  degraded: "Proof generation is flaky",
  broken: "New proofs can't be generated right now; existing badges are unaffected",
  untested: "Never run end to end",
};

const SOUNDNESS_HELP: Record<Soundness, string> = {
  audited: "Independently audited",
  reviewed: "Reviewed by maintainers",
  unreviewed: "Not reviewed yet",
  revoked: "Unsafe: badges from this version shouldn't be trusted",
};

function Chip({ color, label, title }: { color: string; label: string; title: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: `1px solid ${color}44`,
        background: `${color}14`,
        color,
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

export function HealthChip({ health }: { health: Health }) {
  return <Chip color={HEALTH_COLOR[health]} label={health} title={`Health: ${HEALTH_HELP[health]}`} />;
}

export function SoundnessChip({ soundness }: { soundness: Soundness }) {
  return (
    <Chip color={SOUNDNESS_COLOR[soundness]} label={soundness} title={`Soundness: ${SOUNDNESS_HELP[soundness]}`} />
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        border: "1px solid #2d3742",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        color: "#9fb3c8",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
