const fs = require("fs");

const username = "Mehregan-A";

async function getCommits() {
  const response = await fetch(
    `https://api.github.com/users/${username}/events?per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

function getMonthlyCommits(events) {
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - index));

    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString("en-US", { month: "short" }),
      year: date.getFullYear(),
      count: 0,
    };
  });

  events.forEach((event) => {
    if (event.type !== "PushEvent") return;

    const date = new Date(event.created_at);

    const key = `${date.getFullYear()}-${date.getMonth()}`;

    const month = months.find((item) => item.key === key);

    if (month) {
      month.count += event.payload?.commits?.length || 0;
    }
  });

  return months;
}

function createSVG(months) {
  const width = 700;
  const height = 600;

  const cx = 350;
  const cy = 300;

  const radius = 190;

  const max = Math.max(...months.map((month) => month.count), 1);

  const points = months.map((month, index) => {
    const angle = (Math.PI * 2 * index) / months.length - Math.PI / 2;

    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    return {
      ...month,
      x,
      y,
      angle,
    };
  });

  const dataPoints = months.map((month, index) => {
    const angle = (Math.PI * 2 * index) / months.length - Math.PI / 2;

    const valueRadius = (month.count / max) * radius;

    return {
      x: cx + Math.cos(angle) * valueRadius,
      y: cy + Math.sin(angle) * valueRadius,
    };
  });

  const polygon = dataPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  let axes = "";
  let labels = "";

  points.forEach((point) => {
    axes += `
      <line
        x1="${cx}"
        y1="${cy}"
        x2="${point.x}"
        y2="${point.y}"
        stroke="#d1d5db"
        stroke-width="1"
      />
    `;

    const labelRadius = radius + 30;

    const labelX =
      cx + Math.cos(point.angle) * labelRadius;

    const labelY =
      cy + Math.sin(point.angle) * labelRadius;

    labels += `
      <text
        x="${labelX}"
        y="${labelY}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Arial"
        font-size="14"
        font-weight="600"
        fill="#374151"
      >
        ${point.label}
      </text>
    `;
  });

  let rings = "";

  [0.25, 0.5, 0.75, 1].forEach((level) => {
    const ringPoints = months
      .map((_, index) => {
        const angle =
          (Math.PI * 2 * index) / months.length - Math.PI / 2;

        const r = radius * level;

        return `${cx + Math.cos(angle) * r},${
          cy + Math.sin(angle) * r
        }`;
      })
      .join(" ");

    rings += `
      <polygon
        points="${ringPoints}"
        fill="none"
        stroke="#e5e7eb"
        stroke-width="1"
      />
    `;
  });

  const circles = dataPoints
    .map(
      (point) => `
        <circle
          cx="${point.x}"
          cy="${point.y}"
          r="5"
          fill="#06b6d4"
        />
      `
    )
    .join("");

  const total = months.reduce(
    (sum, month) => sum + month.count,
    0
  );

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <rect
    width="100%"
    height="100%"
    rx="20"
    fill="#ffffff"
  />

  <text
    x="${cx}"
    y="45"
    text-anchor="middle"
    font-family="Arial"
    font-size="22"
    font-weight="700"
    fill="#111827"
  >
    Commit Activity
  </text>

  <text
    x="${cx}"
    y="70"
    text-anchor="middle"
    font-family="Arial"
    font-size="13"
    fill="#6b7280"
  >
    ${total} commits in the last 12 months
  </text>

  ${rings}

  ${axes}

  <polygon
    points="${polygon}"
    fill="#06b6d4"
    fill-opacity="0.18"
    stroke="#06b6d4"
    stroke-width="3"
  />

  ${circles}

  ${labels}

  <text
    x="${cx}"
    y="${height - 25}"
    text-anchor="middle"
    font-family="Arial"
    font-size="11"
    fill="#9ca3af"
  >
    Mehregan-A
  </text>
</svg>
`;
}

async function main() {
  const events = await getCommits();

  const months = getMonthlyCommits(events);

  const svg = createSVG(months);

  fs.mkdirSync("assets", { recursive: true });

  fs.writeFileSync(
    "assets/spider.svg",
    svg.trim()
  );

  console.log("Spider chart generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
