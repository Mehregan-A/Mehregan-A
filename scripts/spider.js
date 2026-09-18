const fs = require("fs");

const username = "Mehregan-A";
const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("GITHUB_TOKEN is not available.");
}

const query = `
query($username: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $username) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}
`;

async function getData() {
  const to = new Date();
  const from = new Date();

  from.setFullYear(from.getFullYear() - 1);

  const response = await fetch(
    "https://api.github.com/graphql",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          username,
          from: from.toISOString(),
          to: to.toISOString(),
        },
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || result.errors) {
    console.error(result);
    throw new Error("GitHub GraphQL request failed.");
  }

  return result.data.user.contributionsCollection;
}

function getMonthlyData(calendar) {
  const months = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleString("en-US", {
        month: "short",
      }),
      count: 0,
    });
  }

  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      const date = new Date(day.date);

      const month = months.find(
        (item) =>
          item.year === date.getFullYear() &&
          item.month === date.getMonth()
      );

      if (month) {
        month.count += day.contributionCount;
      }
    }
  }

  return months;
}

function createSVG(months) {
  /*
   * Compact dimensions
   */

  const width = 320;
  const height = 300;

  const cx = 160;
  const cy = 158;

  const radius = 76;

  const max = Math.max(
    ...months.map((item) => item.count),
    1
  );

  const points = months.map((month, index) => {
    const angle =
      (Math.PI * 2 * index) / months.length -
      Math.PI / 2;

    return {
      ...month,
      angle,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });

  const dataPoints = months.map((month, index) => {
    const angle =
      (Math.PI * 2 * index) / months.length -
      Math.PI / 2;

    const valueRadius =
      (month.count / max) * radius;

    return {
      x: cx + Math.cos(angle) * valueRadius,
      y: cy + Math.sin(angle) * valueRadius,
    };
  });

  const polygon = dataPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  /*
   * Radar rings
   */

  let rings = "";

  [0.25, 0.5, 0.75, 1].forEach(
    (level, index) => {
      const ringPoints = months
        .map((_, monthIndex) => {
          const angle =
            (Math.PI * 2 * monthIndex) /
              months.length -
            Math.PI / 2;

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
          stroke="${
            index === 3
              ? "#155e75"
              : "#12384a"
          }"
          stroke-width="${
            index === 3 ? "1.1" : "0.8"
          }"
        />
      `;
    }
  );

  /*
   * Inner radar dots
   */

  let radarDots = "";

  [0.25, 0.5, 0.75, 1].forEach(
    (level) => {
      months.forEach((_, index) => {
        const angle =
          (Math.PI * 2 * index) /
            months.length -
          Math.PI / 2;

        const r = radius * level;

        const x =
          cx + Math.cos(angle) * r;

        const y =
          cy + Math.sin(angle) * r;

        radarDots += `
          <circle
            cx="${x}"
            cy="${y}"
            r="0.9"
            fill="#164e63"
          />
        `;
      });
    }
  );

  /*
   * Axis lines
   */

  let axes = "";

  points.forEach((point) => {
    axes += `
      <line
        x1="${cx}"
        y1="${cy}"
        x2="${point.x}"
        y2="${point.y}"
        stroke="#164e63"
        stroke-width="0.7"
      />
    `;
  });

  /*
   * Month labels
   */

  let labels = "";

  points.forEach((point) => {
    const labelRadius = radius + 27;

    const labelX =
      cx +
      Math.cos(point.angle) *
        labelRadius;

    const labelY =
      cy +
      Math.sin(point.angle) *
        labelRadius;

    const lineStartX =
      cx +
      Math.cos(point.angle) *
        (radius + 2);

    const lineStartY =
      cy +
      Math.sin(point.angle) *
        (radius + 2);

    const lineEndX =
      cx +
      Math.cos(point.angle) *
        (radius + 17);

    const lineEndY =
      cy +
      Math.sin(point.angle) *
        (radius + 17);

    labels += `
      <!-- Month connector -->

      <line
        x1="${lineStartX}"
        y1="${lineStartY}"
        x2="${lineEndX}"
        y2="${lineEndY}"
        stroke="#155e75"
        stroke-width="0.8"
      />

      <!-- Month node -->

      <circle
        cx="${lineEndX}"
        cy="${lineEndY}"
        r="1.7"
        fill="#22d3ee"
        opacity="0.9"
        filter="url(#glow)"
      />

      <!-- Month name -->

      <text
        x="${labelX}"
        y="${labelY}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Arial, sans-serif"
        font-size="7"
        font-weight="600"
        letter-spacing="0.2"
        fill="#bae6fd"
      >
        ${point.label}
      </text>
    `;
  });

  /*
   * Contribution values
   */

  const circles = dataPoints
    .map(
      (point, index) => `
        <circle
          cx="${point.x}"
          cy="${point.y}"
          r="2.5"
          fill="#082f49"
          stroke="#22d3ee"
          stroke-width="1"
        />

        <circle
          cx="${point.x}"
          cy="${point.y}"
          r="1"
          fill="#67e8f9"
        />

        <text
          x="${point.x}"
          y="${point.y - 7}"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="6"
          font-weight="600"
          fill="#a5f3fc"
        >
          ${months[index].count}
        </text>
      `
    )
    .join("");

  const total = months.reduce(
    (sum, month) =>
      sum + month.count,
    0
  );

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>

  <defs>

    <!-- Background gradient -->

    <linearGradient
      id="background"
      x1="0"
      y1="0"
      x2="0"
      y2="1"
    >
      <stop
        offset="0%"
        stop-color="#071a2b"
      />

      <stop
        offset="100%"
        stop-color="#020b14"
      />
    </linearGradient>

    <!-- Radar glow -->

    <filter
      id="glow"
      x="-100%"
      y="-100%"
      width="300%"
      height="300%"
    >
      <feGaussianBlur
        stdDeviation="1.8"
        result="blur"
      />

      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Strong glow -->

    <filter
      id="strongGlow"
      x="-100%"
      y="-100%"
      width="300%"
      height="300%"
    >
      <feGaussianBlur
        stdDeviation="4"
        result="blur"
      />

      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Subtle center glow -->

    <radialGradient
      id="centerGlow"
    >
      <stop
        offset="0%"
        stop-color="#22d3ee"
        stop-opacity="0.16"
      />

      <stop
        offset="100%"
        stop-color="#22d3ee"
        stop-opacity="0"
      />
    </radialGradient>

  </defs>

  <!-- Background -->

  <rect
    width="100%"
    height="100%"
    rx="14"
    fill="url(#background)"
  />

  <!-- Subtle center light -->

  <circle
    cx="${cx}"
    cy="${cy}"
    r="90"
    fill="url(#centerGlow)"
  />

  <!-- Header -->

  <text
    x="${cx}"
    y="24"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="11"
    font-weight="700"
    letter-spacing="0.3"
    fill="#e0f2fe"
  >
    GitHub Contributions
  </text>

  <text
    x="${cx}"
    y="39"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="6.5"
    fill="#67e8f9"
  >
    ${total} contributions · last 12 months
  </text>

  <!-- Small header line -->

  <line
    x1="${cx - 38}"
    y1="49"
    x2="${cx + 38}"
    y2="49"
    stroke="#164e63"
    stroke-width="0.7"
  />

  <circle
    cx="${cx - 40}"
    cy="49"
    r="1.3"
    fill="#22d3ee"
  />

  <circle
    cx="${cx + 40}"
    cy="49"
    r="1.3"
    fill="#22d3ee"
  />

  <!-- Radar -->

  <g>

    ${rings}

    ${axes}

    ${radarDots}

  </g>

  <!-- Outer radar glow -->

  <polygon
    points="${points
      .map(
        (point) =>
          `${point.x},${point.y}`
      )
      .join(" ")}"
    fill="none"
    stroke="#0891b2"
    stroke-width="2"
    opacity="0.18"
    filter="url(#strongGlow)"
  />

  <!-- Main data shape -->

  <polygon
    points="${polygon}"
    fill="#06b6d4"
    fill-opacity="0.13"
    stroke="#22d3ee"
    stroke-width="1.2"
    stroke-linejoin="round"
  />

  <!-- Data shape glow -->

  <polygon
    points="${polygon}"
    fill="none"
    stroke="#22d3ee"
    stroke-width="3"
    opacity="0.18"
    stroke-linejoin="round"
    filter="url(#strongGlow)"
  />

  <!-- Slow cyan electric pulse -->

  <polygon
    points="${polygon}"
    pathLength="1000"
    fill="none"
    stroke="#22d3ee"
    stroke-width="3"
    opacity="0.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-dasharray="18 982"
    filter="url(#strongGlow)"
  >
    <animate
      attributeName="stroke-dashoffset"
      from="0"
      to="-1000"
      dur="8s"
      repeatCount="indefinite"
    />
  </polygon>

  <!-- Bright white pulse -->

  <polygon
    points="${polygon}"
    pathLength="1000"
    fill="none"
    stroke="#ffffff"
    stroke-width="1.5"
    opacity="0.95"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-dasharray="8 992"
    filter="url(#glow)"
  >
    <animate
      attributeName="stroke-dashoffset"
      from="0"
      to="-1000"
      dur="8s"
      repeatCount="indefinite"
    />
  </polygon>

  <!-- Data points -->

  ${circles}

  <!-- Month labels -->

  ${labels}

  <!-- Center node -->

  <circle
    cx="${cx}"
    cy="${cy}"
    r="4"
    fill="#06141f"
    stroke="#22d3ee"
    stroke-width="1"
    filter="url(#glow)"
  />

  <circle
    cx="${cx}"
    cy="${cy}"
    r="1.5"
    fill="#67e8f9"
  />

  <!-- Footer -->

  <text
    x="${cx}"
    y="${height - 14}"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="6"
    letter-spacing="0.8"
    fill="#164e63"
  >
    MEHREGAN-A
  </text>

</svg>
`;
}

async function main() {
  const data = await getData();

  const months = getMonthlyData(
    data.contributionCalendar
  );

  const svg = createSVG(months);

  fs.mkdirSync("assets", {
    recursive: true,
  });

  fs.writeFileSync(
    "assets/spider.svg",
    svg.trim()
  );

  console.log(
    "Futuristic spider chart generated successfully."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
