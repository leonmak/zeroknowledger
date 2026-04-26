import Link from "next/link";

export default function Nav({ activeTab = "/" }) {
  const normalizeTab = function (value) {
    if (!value) return "/";

    const cleaned = String(value).replace(/^\/+|\/+$/g, "");
    return cleaned ? `/${cleaned}` : "/";
  };

  const isTabActive = function (tabValue) {
    const currentTab = normalizeTab(activeTab);
    const targetTab = normalizeTab(tabValue);

    return (
      currentTab === targetTab ||
      (targetTab !== "/" && currentTab.startsWith(`${targetTab}/`))
    );
  };

  const activeStyle = function (tabValue) {
    return isTabActive(tabValue)
      ? {
          fontWeight: "bold",
          opacity: 0.8,
          color: "#56d364",
        }
      : {};
  };

  return (
    <nav
      className="zk-nav"
      style={{
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "18px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(13,17,23,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid #1f2937",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Link
          href="/"
          className="nav-link"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: "linear-gradient(135deg, #7ee787, #56d364)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "#0d1117",
            }}
          >
            Z
          </div>
          <span
            className="zk-hide-mobile"
            style={{
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "-0.5px",
            }}
          >
            zeroknowledger
          </span>
        </Link>
        <div
          className="zk-hide-mobile"
          style={{
            display: "flex",
            gap: 20,
            fontSize: 14,
            color: "#8b949e",
            fontWeight: 500,
          }}
        >
          <Link
            href="/badges"
            className="nav-link"
            style={activeStyle("/badges")}
          >
            Badges
          </Link>
          <Link
            href="/cases"
            className="nav-link"
            style={activeStyle("/cases")}
          >
            Cases
          </Link>
          <Link
            href="/unlocks"
            className="nav-link"
            style={activeStyle("/unlocks")}
          >
            Unlocks
          </Link>
          <span style={{ cursor: "pointer" }}>Docs</span>
        </div>
      </div>
      <div className="zk-hide-mobile" style={{ display: "flex", gap: 12 }}>
        <button
          className="btn2"
          style={{ padding: "7px 16px", fontSize: 13, borderRadius: 6 }}
        >
          Sign in
        </button>
        <button
          className="btn1"
          style={{ padding: "7px 16px", fontSize: 13, borderRadius: 6 }}
        >
          Sign up
        </button>
      </div>
    </nav>
  );
}
