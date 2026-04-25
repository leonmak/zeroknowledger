export default function JsonHighlight({ code }) {
  return (
    <pre
      style={{
        margin: 0,
        fontSize: 12.5,
        lineHeight: 1.85,
        fontFamily: "'JetBrains Mono', monospace",
        overflowX: "auto",
      }}
    >
      {code.split("\n").map((line, i) => {
        let html = line;
        // Keys
        html = html.replace(
          /("(?:[^"\\]|\\.)*")(\s*:)/g,
          (_, k, c) => `<span style="color:#7ee787">${k}</span>${c}`,
        );
        // String values
        html = html.replace(
          /:(\s*)("(?:[^"\\]|\\.)*")/g,
          (_, s, v) => `:${s}<span style="color:#a5d6ff">${v}</span>`,
        );
        // Numbers
        html = html.replace(
          /:(\s*)(\d+)/g,
          (_, s, v) => `:${s}<span style="color:#d2a8ff">${v}</span>`,
        );
        return (
          <div key={i} style={{ display: "flex" }}>
            <span
              style={{
                color: "#30363d",
                width: 28,
                display: "inline-block",
                textAlign: "right",
                marginRight: 18,
                userSelect: "none",
                fontSize: 11,
              }}
            >
              {i + 1}
            </span>
            <span
              dangerouslySetInnerHTML={{ __html: html }}
              style={{ color: "#8b949e" }}
            />
          </div>
        );
      })}
    </pre>
  );
}
