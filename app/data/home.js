export const METHODS = [
  {
    id: "stripe",
    name: "stripe/verified-merchant",
    desc: "Prove active Stripe merchant status with live transactions",
    author: "finproof",
    avatar: "F",
    likes: 342,
    downloads: "58.2K",
    updated: "3d ago",
    tags: ["finance", "popular"],
    badge: { label: "Stripe Merchant", color: "#635bff", icon: "⚡" },
  },
  {
    id: "github",
    name: "github/active-contributor",
    desc: "Verify 50+ contributions in the last year on GitHub",
    author: "devproof",
    avatar: "D",
    likes: 891,
    downloads: "112K",
    updated: "1d ago",
    tags: ["developer", "trending"],
    badge: { label: "OSS Contributor", color: "#7ee787", icon: "◆" },
  },
  {
    id: "linkedin",
    name: "linkedin/current-role",
    desc: "Prove current employment status and company via LinkedIn",
    author: "idwright",
    avatar: "I",
    likes: 567,
    downloads: "89.1K",
    updated: "5d ago",
    tags: ["identity", "popular"],
    badge: { label: "Verified Employee", color: "#0a66c2", icon: "●" },
  },
  {
    id: "alumni",
    name: "edu/university-alumni",
    desc: "Verify alumni status through university portal",
    author: "academicanon",
    avatar: "A",
    likes: 445,
    downloads: "41.3K",
    updated: "1w ago",
    tags: ["education"],
    badge: { label: "University Alumni", color: "#d2a8ff", icon: "▲" },
  },
  {
    id: "strava",
    name: "strava/active-athlete",
    desc: "Verify 100+ activities logged in the past year",
    author: "fitproof",
    avatar: "P",
    likes: 289,
    downloads: "22.7K",
    updated: "2d ago",
    tags: ["fitness", "trending"],
    badge: { label: "Active Athlete", color: "#fc4c02", icon: "◎" },
  },
  {
    id: "aws",
    name: "aws/certification-holder",
    desc: "Verify AWS certification from Credly portal",
    author: "cloudwright",
    avatar: "C",
    likes: 678,
    downloads: "72.8K",
    updated: "4d ago",
    tags: ["developer", "popular"],
    badge: { label: "AWS Certified", color: "#ff9900", icon: "☁" },
  },
  {
    id: "costco",
    name: "costco/executive-member",
    desc: "Prove Costco Executive membership status",
    author: "retailprover",
    avatar: "R",
    likes: 156,
    downloads: "12.1K",
    updated: "6d ago",
    tags: ["retail"],
    badge: { label: "Costco Member", color: "#e31837", icon: "★" },
  },
  {
    id: "airbnb",
    name: "airbnb/superhost",
    desc: "Prove Superhost status on Airbnb hosting profile",
    author: "travelwright",
    avatar: "T",
    likes: 312,
    downloads: "18.9K",
    updated: "3d ago",
    tags: ["travel"],
    badge: { label: "Superhost", color: "#ff385c", icon: "♦" },
  },
];

export const PROFILE_BADGES = [
  { label: "OSS Contributor", color: "#7ee787", icon: "◆" },
  { label: "AWS Certified", color: "#ff9900", icon: "☁" },
  { label: "Stripe Merchant", color: "#635bff", icon: "⚡" },
  { label: "Active Athlete", color: "#fc4c02", icon: "◎" },
  { label: "University Alumni", color: "#d2a8ff", icon: "▲" },
];

export const UNLOCKS = [
  {
    badge: { label: "Stripe Merchant", color: "#635bff", icon: "⚡" },
    unlocks: [
      {
        type: "defi",
        title: "Undercollateralized loans on 3Jane",
        desc: "Prove revenue → borrow USDC without locking up assets",
      },
      {
        type: "perks",
        title: "Stripe partner discounts",
        desc: "SaaS tools offering deals to verified merchants",
      },
      {
        type: "access",
        title: "Founder communities",
        desc: "Gate-checked access to revenue-verified founder groups",
      },
    ],
  },
  {
    badge: { label: "OSS Contributor", color: "#7ee787", icon: "◆" },
    unlocks: [
      {
        type: "airdrop",
        title: "Developer airdrops",
        desc: "Protocols rewarding real builders, not bots farming wallets",
      },
      {
        type: "access",
        title: "Gated dev DAOs",
        desc: "Communities that require proof of real contribution history",
      },
      {
        type: "signal",
        title: "Verified freelance profiles",
        desc: "Show clients you're a real developer, cryptographically",
      },
    ],
  },
  {
    badge: { label: "Active Athlete", color: "#fc4c02", icon: "◎" },
    unlocks: [
      {
        type: "perks",
        title: "Insurance premium reduction",
        desc: "Prove consistent exercise → lower your health insurance rate",
      },
      {
        type: "perks",
        title: "Brand offers",
        desc: "Fitness brands reaching verified athletes with relevant gear",
      },
      {
        type: "access",
        title: "Athlete communities",
        desc: "Training groups gated to people who actually show up",
      },
    ],
  },
];

export const METHOD_SPEC = `{
  "name": "github/active-contributor",
  "version": "3.0.1",
  "claim": "50+ contributions in past 12 months",

  "target": {
    "url": "https://github.com/{username}",
    "auth": "session"
  },

  "extract": {
    "selector": ".js-yearly-contributions h2",
    "pattern": "([\\\\d,]+)\\\\s+contributions"
  },

  "disclose": {
    "mode": "threshold",
    "value": 50,
    "output": "boolean"
  },

  "redact": [
    ".avatar", ".vcard-names",
    "[data-hovercard-url]"
  ]
}`;

export const CATEGORIES = [
  "All",
  "developer",
  "finance",
  "identity",
  "fitness",
  "education",
  "travel",
  "retail",
];
