// Builds the TLSNotary extension plugin for a template. Runs in the browser; the
// result is handed straight to window.tlsn.execCode.
import type { Template } from "./templates";

import { VERIFIER_URL } from "./config";
import { iconCssUrl } from "./pluginIcons";

export { VERIFIER_URL };

export function buildPlugin(template: Template): string {
  return generatePlugin(template, VERIFIER_URL);
}

function generatePlugin(template: Template, verifierUrl: string): string {
  const { api_url, method, window_url, auth } = template.target;
  const { max_recv_data, max_sent_data, reveal_fields, reveal_regex, commit_fields } = template.prove_params;

  const isCookieAuth = auth.strategy.includes("cookie");
  const authHeaderKey = isCookieAuth ? "Cookie" : "Authorization";
  const interceptFilter = auth.intercept_filter.replace(/\/?\*$/, "/");
  const color1 = template.badge.color;
  const icon = iconCssUrl(template.badge.icon);
  // Which captured header value counts as a usable credential. Checked against
  // every intercepted request, not just the first: pages often hit public
  // endpoints (without the session cookie) before the one we prove.
  const credHeader = isCookieAuth ? "cookie" : "authorization";
  const credCheck = auth.required_cookie
    ? `v.split(';').some(function(c) { return c.trim().toLowerCase().startsWith(${JSON.stringify(auth.required_cookie.toLowerCase() + "=")}); })`
    : "true";

  const u = new URL(api_url);
  // The extension only runs a prove() whose host matches the request URL, and
  // whose proxyUrl is exactly the one it derives from verifierUrl. Proxy mode
  // never opens that proxy, but the check still applies.
  const host = u.hostname;
  const v = new URL(verifierUrl);
  const proxyUrl = `${v.protocol === "https:" ? "wss:" : "ws:"}//${v.host}/proxy?token=${host}`;

  const revealHandlers = [
    // Committed, not revealed: the verifier only gets SHA256(bytes || blinder).
    ...(commit_fields ?? []).map(
      (f) => `    { type: 'RECV', part: 'BODY', action: { kind: 'HASH', algorithm: 'SHA256' }, params: { type: 'json', path: ${JSON.stringify(f)} } }`,
    ),
    ...reveal_fields.map(
      (f) => `    { type: 'RECV', part: 'BODY', action: 'REVEAL', params: { type: 'json', path: ${JSON.stringify(f)} } }`,
    ),
    ...(reveal_regex ?? []).map(
      (r) => `    { type: 'RECV', part: 'ALL', action: 'REVEAL', params: { type: 'regex', regex: ${JSON.stringify(r.regex)}${r.flags ? `, flags: ${JSON.stringify(r.flags)}` : ""} } }`,
    ),
  ].join(",\n");

  const connectedStatusBlock = `
      div({ style: { marginBottom: '16px', padding: '12px', borderRadius: '6px', backgroundColor: _cred ? '#d4edda' : '#f8d7da', color: _cred ? '#155724' : '#721c24', border: '1px solid ' + (_cred ? '#c3e6cb' : '#f5c6cb'), fontWeight: '500' } }, [
        _cred ? '\\u2713 Session detected' : '\\u26A0 No session detected',
      ]),`;

  return `
var _filter = function(h) {
  return h.filter(function(x) { return x.url.startsWith(${JSON.stringify(interceptFilter)}); });
};

var config = {
  name: ${JSON.stringify(template.badge.label)},
  description: ${JSON.stringify(template.claim)},
  version: ${JSON.stringify(template.version)},
  requests: [{ 
    method: ${JSON.stringify(method)}, 
    host: ${JSON.stringify(host)}, 
    pathname: ${JSON.stringify(u.pathname)}, 
    verifierUrl: ${JSON.stringify(verifierUrl)}
  }],
  // openWindow() is only allowed for URLs matching these URLPatterns;
  // "<window_url>/*" wouldn't match window_url itself.
  urls: [${JSON.stringify(new URL(window_url).origin + "/*")}],
};

async function onClick() {
  var _cred = useState('_cred', null);
  if (!_cred || useState('proving', false)) return;
  setState('proving', true);
  setState('error', null);
  var resp;
  try {
  resp = await prove(
    { url: ${JSON.stringify(api_url)},
      method: ${JSON.stringify(method)},
      headers: { Host: ${JSON.stringify(host)}, ${JSON.stringify(authHeaderKey)}:
       _cred, 'Accept-Encoding': 'identity', Connection: 'close' } },
    {
      verifierUrl: ${JSON.stringify(verifierUrl)},
      proxyUrl: ${JSON.stringify(proxyUrl)},
      maxRecvData: ${max_recv_data},
      maxSentData: ${max_sent_data},
      handlers: [
        { type: 'SENT', part: 'START_LINE', action: 'REVEAL' },
        // Never reveal the Cookie/Authorization header: it is a live session credential.
        { type: 'SENT', part: 'HEADERS', action: 'REVEAL', params: { key: 'Host' } },
        { type: 'RECV', part: 'START_LINE', action: 'REVEAL' },
        { type: 'RECV', part: 'HEADERS', action: 'REVEAL', params: { key: 'date' } },
${revealHandlers}
      ],
    }
  );
  } catch (e) {
    setState('proving', false);
    setState('error', String((e && e.message) || e));
    return;
  }
  done(JSON.stringify(resp));
}

function expandUI() { setState('isMinimized', false); }
function minimizeUI() { setState('isMinimized', true); }

function main() {
  var _cred = useState('_cred', null);
  var intercepted = useHeaders(_filter);
  // Use the newest credential, preferring the page's own call to the endpoint
  // we prove: sites can rotate the session (e.g. after a step-up login), and an
  // older value may no longer be allowed to read it.
  var _latest = null, _fromApi = null;
  for (var i = intercepted.length - 1; i >= 0; i--) {
    var _h = intercepted[i].requestHeaders.find(function(h) { return h.name.toLowerCase() === ${JSON.stringify(credHeader)}; });
    var v = _h && _h.value;
    if (!v || !(${credCheck})) continue;
    if (!_latest) _latest = v;
    if (intercepted[i].url.split('?')[0] === ${JSON.stringify(api_url.split("?")[0])}) { _fromApi = v; break; }
  }
  var _best = _fromApi || _latest;
  if (_best && _best !== _cred) setState('_cred', _best);
  useEffect(() => {
    openWindow(${JSON.stringify(window_url)}, '_blank');
  }, []);

  var isMinimized = useState('isMinimized', true);
  var proving = useState('proving', false);
  var error = useState('error', null);
  if (isMinimized) {
    return div({
      style: { position: 'fixed', bottom: '80px', right: '20px', zIndex: '999999', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
      onclick: 'expandUI',
    }, [
      div({ style: { width: '60px', height: '60px', borderRadius: '50%', backgroundColor: ${JSON.stringify(color1)}, backgroundImage: ${JSON.stringify(icon)}, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: '28px 28px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' } }, []),
      div({ style: { padding: '2px 10px', borderRadius: '10px', backgroundColor: ${JSON.stringify(color1)}, color: 'white', fontSize: '12px', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' } }, ['Verify']),
    ]);
  }

  return div({ style: { position: 'fixed', bottom: '0', right: '8px', width: '280px', borderRadius: '8px 8px 0 0', backgroundColor: 'white', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: '999999', fontSize: '14px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflow: 'hidden' } }, [
    div({ style: { background: 'linear-gradient(135deg, ' + ${JSON.stringify(color1)} + ' 0%, ' + ${JSON.stringify(color1)} + 'aa 100%)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' } }, [
      div({ style: { fontWeight: '600', fontSize: '16px' } }, [${JSON.stringify(template.badge.label)}]),
      button({ style: { background: 'transparent', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', padding: '0', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, onclick: 'minimizeUI' }, ['\u2212']),
    ]),
    div({ style: { padding: '20px', backgroundColor: '#f8f9fa' } }, [
      ${connectedStatusBlock}
      _cred
        ? div({}, [
            button({ disabled: proving, style: { width: '100%', padding: '12px 24px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, ' + ${JSON.stringify(color1)} + ' 0%, ' + ${JSON.stringify(color1)} + 'aa 100%)', color: 'white', fontWeight: '600', fontSize: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: proving ? 'wait' : 'pointer', opacity: proving ? '0.7' : '1' }, onclick: 'onClick' }, [proving ? 'Proving\u2026 (up to a minute)' : (error ? 'Try again' : 'Generate Proof')]),
            error ? div({ style: { marginTop: '10px', color: '#721c24', fontSize: '12px', lineHeight: '1.4' } }, [error]) : div({}, []),
          ])
        : div({ style: { textAlign: 'center', color: '#666', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '6px', border: '1px solid #ffeaa7' } }, ['Please login to ' + ${JSON.stringify(template.badge.label)}]),
    ]),
  ]);
}

export default { main, onClick, expandUI, minimizeUI, config };
`.trim();
}
