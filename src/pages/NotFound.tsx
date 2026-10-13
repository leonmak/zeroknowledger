import { Link } from "react-router";
import Nav from "../components/Nav";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "Inter, sans-serif" }}>
      <title>Not found · zeroknowledger</title>
      <Nav />
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "96px 32px", textAlign: "center" }}>
        <h1 style={{ fontSize: 40, letterSpacing: "-1px", marginBottom: 12 }}>404</h1>
        <p style={{ color: "#8b949e", fontSize: 15, marginBottom: 24 }}>This page doesn&apos;t exist.</p>
        <Link to="/" style={{ color: "#7ee787" }}>
          Go home
        </Link>
      </section>
    </main>
  );
}
