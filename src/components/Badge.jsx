export default function Badge({ label, color, icon, size = "md" }) {
  const s = {
    sm: { p: "3px 10px", f: 11, i: 10, g: 5 },
    md: { p: "5px 14px", f: 13, i: 12, g: 6 },
    lg: { p: "7px 18px", f: 14, i: 14, g: 7 },
  }[size];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.g,
        padding: s.p,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: 20,
        fontSize: s.f,
        color,
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        letterSpacing: "-0.2px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: s.i }}>{icon}</span>
      {label}
      <svg
        width={s.i}
        height={s.i}
        viewBox="0 0 16 16"
        fill="none"
        style={{ marginLeft: 2 }}
      >
        <path
          d="M13.5 4.5L6.5 11.5L2.5 7.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
