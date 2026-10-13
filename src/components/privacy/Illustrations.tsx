import { useId, type JSX } from "react";

const colors = {
  text: "#e6edf3",
  muted: "#8b949e",
  border: "#30363d",
  panel: "#161b22",
  green: "#7ee787",
  blue: "#58a6ff",
  purple: "#d2a8ff",
  amber: "#d29922",
  red: "#f47067",
  redDeep: "#9F1239",
};

/** The "Unique Singpass Person" badge as apps show it: our red, not a flag or logo. */
function UspBadge({ x, y, label = "Unique Singpass Person" }: { x: number; y: number; label?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="206" height="30" rx="15" fill={colors.redDeep} fillOpacity="0.35" stroke={colors.red} strokeWidth="1.5" />
      <circle cx="16" cy="15" r="10" fill={colors.redDeep} stroke={colors.red} />
      <path d="M11 15 l4 4 7 -8" fill="none" stroke="#ffffff" strokeWidth="2.2" />
      <text x="34" y="20" fontSize="13" fontWeight="600" fill={colors.text}>{label}</text>
    </g>
  );
}

function Arrowhead({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 1 1 L 9 5 L 1 9 Z" fill={color} />
      </marker>
    </defs>
  );
}

function Lock({ x, y, color = colors.green }: {
  x: number;
  y: number;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} fill={colors.panel} stroke={color} strokeWidth="2">
      <path d="M5 11 V7 a7 7 0 0 1 14 0 v4" fill="none" />
      <rect x="1" y="11" width="22" height="18" rx="4" />
      <path d="M12 17 v6" />
    </g>
  );
}

function Fingerprint({ x, y, color = colors.green, size = 1 }: {
  x: number;
  y: number;
  color?: string;
  size?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M2 18 C2 -2 30 -2 30 18 M7 32 C11 26 8 22 8 17 C8 6 24 6 24 17 C24 26 26 29 21 36" />
      <path d="M2 26 L3 22 M13 35 C19 27 13 23 14 17 C14 14 18 14 18 17 C18 24 22 27 16 36 M29 25 L30 31" />
    </g>
  );
}

function Envelope({ x, y, width = 112, sticker = false }: {
  x: number;
  y: number;
  width?: number;
  sticker?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={colors.green} strokeWidth="2">
      <rect width={width} height="44" rx="6" fill={colors.panel} />
      <path d={`M2 4 L${width / 2} 28 L${width - 2} 4`} fill="none" />
      <circle cx={width / 2} cy="27" r="7" fill={colors.green} />
      {sticker && (
        <g>
          <rect x={width - 29} y="24" width="20" height="14" rx="3" fill={colors.panel} />
          <path d={`M${width - 25} 29 h4 m3 4 h4`} />
        </g>
      )}
    </g>
  );
}

export function LockedBoxIllustration(): JSX.Element {
  const arrowId = `locked-box-${useId()}`;
  return (
    <svg
      viewBox="0 0 720 320"
      width="100%"
      role="img"
      aria-label="Singpass's reply travels in a TLS-encrypted locked box. Our verifier carries it and keeps a photocopy of the locked box, but has no key. Only your device can open it."
      fontFamily="Inter, sans-serif"
      fontSize="16"
      fill={colors.text}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Singpass&apos;s reply travels in a locked box</title>
      <Arrowhead id={arrowId} color={colors.green} />
      <text x="360" y="30" textAnchor="middle">Ask Singpass for one page of your account data</text>
      <path d="M59 102 V53 H679 V114" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />

      <text x="117" y="91" textAnchor="middle">Your device</text>
      <rect x="43" y="108" width="148" height="107" rx="10" fill={colors.panel} stroke={colors.green} strokeWidth="2" />
      <rect x="54" y="119" width="126" height="82" rx="4" fill="none" stroke={colors.border} />
      <path d="M34 220 H200 L191 228 H43 Z" fill={colors.panel} stroke={colors.green} strokeWidth="2" />
      <g fill="none" stroke={colors.green} strokeWidth="3">
        <circle cx="97" cy="157" r="12" />
        <path d="M109 157 H145 M132 157 V168 M142 157 V165" />
      </g>
      <text x="117" y="249" textAnchor="middle" fill={colors.green}>
        <tspan x="117">Only your device</tspan>
        <tspan x="117" dy="20">has the key</tspan>
      </text>

      <text x="361" y="91" textAnchor="middle" fill={colors.blue}>Our verifier</text>
      <path d="M543 155 H410" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <path d="M312 155 H207" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <circle cx="362" cy="120" r="14" fill={colors.panel} stroke={colors.blue} strokeWidth="2" />
      <path d="M335 172 V158 Q335 141 351 141 H373 Q389 141 389 158 V172 M349 200 V214 M375 200 V214" fill="none" stroke={colors.blue} strokeWidth="3" />
      <rect x="324" y="158" width="76" height="44" rx="7" fill={colors.panel} stroke={colors.green} strokeWidth="2" />
      <Lock x={350} y={163} />
      <path d="M332 171 H340 M384 171 H392" stroke={colors.blue} strokeWidth="4" />
      <text x="361" y="234" textAnchor="middle" fill={colors.blue}>can carry, can&apos;t open</text>

      <text x="621" y="91" textAnchor="middle">Singpass</text>
      <path d="M553 130 L621 106 L689 130 Z" fill={colors.panel} stroke={colors.border} strokeWidth="2" />
      <rect x="561" y="135" width="120" height="85" rx="7" fill={colors.panel} stroke={colors.border} strokeWidth="2" />
      <path d="M579 149 V202 M663 149 V202 M552 227 H690" stroke={colors.muted} strokeWidth="3" />
      <rect x="603" y="161" width="36" height="59" rx="5" fill="none" stroke={colors.green} strokeWidth="2" />
      <text x="621" y="252" textAnchor="middle" fill={colors.green}>Locked reply</text>
      <text x="621" y="272" textAnchor="middle" fill={colors.muted}>TLS encryption</text>

      <path d="M362 244 V261 H392" fill="none" stroke={colors.blue} strokeWidth="2" strokeDasharray="4 5" />
      <rect x="405" y="253" width="48" height="41" rx="5" fill={colors.panel} stroke={colors.border} />
      <rect x="399" y="248" width="48" height="41" rx="5" fill={colors.panel} stroke={colors.blue} />
      <Lock x={411} y={253} color={colors.blue} />
      <text x="383" y="309" textAnchor="middle" fill={colors.muted}>Keeps a photocopy of the locked box</text>
    </svg>
  );
}

export function SealedEnvelopesIllustration(): JSX.Element {
  const arrowId = `sealed-envelopes-${useId()}`;
  const revealedArrowId = `${arrowId}-revealed`;
  return (
    <svg
      viewBox="0 0 720 320"
      width="100%"
      role="img"
      aria-label="On your device, Singpass ID and mobile each go into a sealed envelope with a random sticker. Only their fingerprints and the revealed status SUCCESS leave for our verifier, which confirms they came from Singpass. Name and email stay on your device. The random stickers prevent guessing the contents from the fingerprints."
      fontFamily="Inter, sans-serif"
      fontSize="16"
      fill={colors.text}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Your ID and number go into sealed envelopes</title>
      <Arrowhead id={arrowId} color={colors.green} />
      <Arrowhead id={revealedArrowId} color={colors.amber} />
      <rect x="16" y="36" width="456" height="227" rx="14" fill={colors.panel} stroke={colors.green} strokeWidth="2" />
      <text x="32" y="25" fill={colors.green}>Your device</text>
      <text x="34" y="65">Singpass page opened here</text>
      <rect x="33" y="81" width="172" height="118" rx="8" fill="none" stroke={colors.border} />
      <text x="46" y="109" fill={colors.muted}>Name</text>
      <text x="46" y="135" fill={colors.muted}>Email</text>
      <text x="46" y="178" fill={colors.muted}>stays here</text>
      <path d="M112 105 H189 M112 131 H189" stroke={colors.border} strokeWidth="5" />

      <text x="238" y="91">singpass_id</text>
      <Envelope x={238} y={101} sticker />
      <text x="354" y="118" fill={colors.green} fontSize="14">
        <tspan x="362">random</tspan>
        <tspan x="362" dy="18">sticker</tspan>
      </text>
      <text x="238" y="174">Mobile</text>
      <Envelope x={238} y={184} sticker />
      <text x="354" y="201" fill={colors.green} fontSize="14">
        <tspan x="362">random</tspan>
        <tspan x="362" dy="18">sticker</tspan>
      </text>

      <text x="525" y="65" textAnchor="middle" fill={colors.green} fontSize="14">
        <tspan x="525">Only</tspan>
        <tspan x="525" dy="18">fingerprints</tspan>
      </text>
      <path d="M440 124 H495 M440 205 H495" fill="none" stroke={colors.green} strokeWidth="2" />
      <path d="M538 124 H578" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <path d="M538 205 H578" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <Fingerprint x={501} y={105} />
      <Fingerprint x={501} y={186} />
      <rect x="583" y="96" width="121" height="153" rx="12" fill={colors.panel} stroke={colors.blue} strokeWidth="2" />
      <text x="644" y="136" textAnchor="middle" fill={colors.blue}>
        <tspan x="644">Our verifier</tspan>
      </text>
      <path d="M622 164 l14 14 26 -29" fill="none" stroke={colors.blue} strokeWidth="3" />
      <text x="644" y="206" textAnchor="middle" fill={colors.muted} fontSize="13">
        <tspan x="644">Confirms they</tspan>
        <tspan x="644" dy="16">came from</tspan>
        <tspan x="644" dy="16">Singpass</tspan>
      </text>

      <text x="34" y="247" fill={colors.amber}>status: SUCCESS, revealed</text>
      <path d="M252 242 H578" fill="none" stroke={colors.amber} strokeWidth="2" markerEnd={`url(#${revealedArrowId})`} />
      <text x="360" y="286" textAnchor="middle">
        <tspan x="360">We see each envelope&apos;s fingerprint, never what&apos;s inside.</tspan>
        <tspan x="360" dy="23" fill={colors.muted}>The random sticker stops guesses from the fingerprint.</tspan>
      </text>
    </svg>
  );
}

export function VaultIllustration(): JSX.Element {
  const arrowId = `vault-${useId()}`;
  return (
    <svg
      viewBox="0 0 720 510"
      width="100%"
      role="img"
      aria-label="On your device, a calculator turns the contents of the two sealed envelopes into a code and a certificate (a zero-knowledge proof). The envelopes, your Singpass ID and mobile, never leave the device. Only the code and certificate leave, in a locked box that only the vault can open. Our badge registry passes the box on without opening it. Inside the vault, an attested enclave, the certificate is checked against the fingerprints from step 2 and the code is combined with the vault's secret key into your code for this app."
      fontFamily="Inter, sans-serif"
      fontSize="16"
      fill={colors.text}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Your Singpass ID and mobile never leave your device</title>
      <Arrowhead id={arrowId} color={colors.green} />

      <text x="32" y="27" fill={colors.green}>Your device</text>
      <rect x="16" y="40" width="688" height="150" rx="14" fill={colors.panel} stroke={colors.green} strokeWidth="2" />
      <text x="40" y="74">singpass_id</text>
      <Envelope x={40} y={84} width={96} />
      <text x="170" y="74">Mobile</text>
      <Envelope x={170} y={84} width={96} />
      <text x="40" y="164" fill={colors.green} fontSize="14">Never leave this device</text>
      <path d="M274 106 H306" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <rect x="312" y="62" width="92" height="88" rx="10" fill={colors.panel} stroke={colors.green} strokeWidth="2" />
      <rect x="322" y="72" width="72" height="28" rx="4" fill="none" stroke={colors.border} />
      <text x="358" y="92" textAnchor="middle" fill={colors.green}>f( , )</text>
      <path d="M326 118 H336 M352 118 H362 M378 118 H388 M326 134 H336 M352 134 H362 M378 134 H388" stroke={colors.muted} strokeWidth="4" />
      <text x="358" y="170" textAnchor="middle" fontSize="12" fill={colors.muted}>Proof made here</text>
      <path d="M410 106 H442" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <rect x="448" y="58" width="150" height="96" rx="10" fill={colors.panel} stroke={colors.amber} strokeWidth="2" />
      <Lock x={460} y={70} color={colors.amber} />
      <text x="494" y="84" fontSize="12">Code 7f3a…</text>
      <text x="494" y="102" fontSize="12">+ certificate</text>
      <text x="523" y="140" textAnchor="middle" fontSize="12" fill={colors.amber}>Locked box</text>
      <text x="523" y="178" textAnchor="middle" fontSize="13" fill={colors.green}>Only this leaves</text>

      <path d="M523 184 V218" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <text x="32" y="214" fill={colors.purple}>Our badge registry</text>
      <rect x="16" y="224" width="688" height="52" rx="14" fill={colors.panel} stroke={colors.purple} strokeWidth="2" />
      <text x="40" y="255" fontSize="14" fill={colors.muted}>Passes the locked box on without opening it: it has no key</text>
      <Lock x={656} y={235} color={colors.purple} />

      <path d="M523 276 V318" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <text x="32" y="312" fill={colors.blue}>The vault: an attested enclave (Intel TDX)</text>
      <rect x="16" y="322" width="688" height="116" rx="14" fill={colors.panel} stroke={colors.blue} strokeWidth="2" />
      <rect x="36" y="348" width="140" height="42" rx="7" fill={colors.panel} stroke={colors.green} />
      <text x="106" y="374" textAnchor="middle" fontSize="13" fill={colors.green}>Code + certificate</text>
      <text x="40" y="420" fontSize="13" fill={colors.muted}>No Singpass ID or mobile in here either</text>
      <path d="M182 369 H214" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <text x="222" y="350" fontSize="12" fill={colors.muted}>certificate matches step 2?</text>
      <Fingerprint x={228} y={358} size={0.62} color={colors.purple} />
      <Fingerprint x={258} y={358} size={0.62} color={colors.purple} />
      <path d="M296 370 l8 8 16 -18" fill="none" stroke={colors.green} strokeWidth="3" />
      <path d="M332 369 H364" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <text x="372" y="374" fontSize="14" fill={colors.amber}>+ secret key</text>
      <path d="M472 369 H540" fill="none" stroke={colors.green} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
      <rect x="546" y="348" width="146" height="42" rx="7" fill={colors.panel} stroke={colors.green} />
      <text x="619" y="374" textAnchor="middle" fill={colors.green} fontSize="13">This app&apos;s code</text>

      <text x="360" y="472" textAnchor="middle" fontSize="14">
        <tspan x="360">Your Singpass ID and mobile never reach the vault, the registry or any app.</tspan>
        <tspan x="360" dy="21" fill={colors.muted}>Your browser checks Google&apos;s proof of the vault&apos;s code before locking the box.</tspan>
      </text>
    </svg>
  );
}

export function AppNicknamesIllustration(): JSX.Element {
  const arrowId = `app-badges-${useId()}`;
  const profile = (x: number, app: string, handle: string, nick: string) => (
    <g>
      <rect x={x} y="40" width="320" height="150" rx="14" fill={colors.panel} stroke={colors.amber} strokeWidth="2" />
      <text x={x + 20} y="66" fill={colors.amber} fontSize="14">{app}</text>
      <circle cx={x + 42} cy="108" r="20" fill="none" stroke={colors.muted} strokeWidth="2" />
      <circle cx={x + 42} cy="102" r="7" fill="none" stroke={colors.muted} strokeWidth="2" />
      <path d={`M${x + 29} ${123} a13 11 0 0 1 26 0`} fill="none" stroke={colors.muted} strokeWidth="2" />
      <text x={x + 74} y="104" fontSize="16" fontWeight="600">{handle}</text>
      <text x={x + 74} y="124" fontSize="12" fill={colors.muted}>app&apos;s nickname for them: {nick}</text>
      <UspBadge x={x + 20} y={144} />
    </g>
  );
  return (
    <svg
      viewBox="0 0 720 420"
      width="100%"
      role="img"
      aria-label="The same person shows the Unique Singpass Person badge in a Discord server as @alex and in a dating app as alex_t. Each app has a different nickname for them. Clicking the badge opens a verification page that says the account is a verified unique Singpass person for that app, since a date, without saying who they are."
      fontFamily="Inter, sans-serif"
      fontSize="15"
      fill={colors.text}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>A different nickname for every app</title>
      <Arrowhead id={arrowId} color={colors.red} />
      <text x="24" y="26" fill={colors.muted} fontSize="13">The same person, in two apps</text>
      {profile(24, "Discord server", "@alex", "a91f…")}
      {profile(376, "Dating app", "alex_t", "4c07…")}
      <text x="360" y="120" textAnchor="middle" fill={colors.amber} fontSize="20">≠</text>

      <path d="M150 175 l0 18 l5 -5 l6 11 l4 -2 l-6 -11 l7 0 z" fill={colors.text} stroke={colors.panel} strokeWidth="1" />
      <path d="M160 208 V252 H196" fill="none" stroke={colors.red} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${arrowId})`} />
      <text x="150" y="240" textAnchor="end" fill={colors.red} fontSize="12">click the badge</text>

      <rect x="202" y="222" width="494" height="136" rx="12" fill={colors.panel} stroke={colors.red} strokeWidth="1.5" />
      <rect x="202" y="222" width="494" height="30" rx="12" fill={colors.border} fillOpacity="0.5" />
      <text x="218" y="242" fontSize="12" fill={colors.muted}>zeroknowledger · /singpass/verified/discord…/a91f…</text>
      <circle cx="238" cy="290" r="16" fill={colors.redDeep} stroke={colors.red} />
      <path d="M230 290 l6 6 10 -12" fill="none" stroke="#ffffff" strokeWidth="2.6" />
      <text x="266" y="286" fontSize="16" fontWeight="600">Unique Singpass Person</text>
      <text x="266" y="306" fontSize="13" fill={colors.muted}>Verified for Discord server · since Sep 2026</text>
      <text x="218" y="340" fontSize="13" fill={colors.green}>Doesn&apos;t say who they are, or which other apps they use.</text>

      <text x="360" y="392" textAnchor="middle" fontSize="14" fill={colors.muted}>
        <tspan x="360">Each app&apos;s badge links to its own check page, under that app&apos;s nickname.</tspan>
        <tspan x="360" dy="20">No app gets your Singpass ID, mobile, name or email.</tspan>
      </text>
    </svg>
  );
}
