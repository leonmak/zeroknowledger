export default function TypeIcon({ type }) {
  const map = {
    defi: { icon: "◇", color: "#a5d6ff", label: "DeFi" },
    perks: { icon: "★", color: "#ffa657", label: "Perks" },
    access: { icon: "→", color: "#7ee787", label: "Access" },
    airdrop: { icon: "◈", color: "#d2a8ff", label: "Airdrop" },
    signal: { icon: "◉", color: "#79c0ff", label: "Signal" },
  };
  const t = map[type] || map.access;
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 4,
        background: `${t.color}11`,
        border: `1px solid ${t.color}22`,
        color: t.color,
        fontWeight: 600,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
      }}
    >
      {t.label}
    </span>
  );
}
