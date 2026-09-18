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
      totalCommitContributions
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

  const response = await fetch("https://api.github.com/graphql", {
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
  });

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
  const width = 800;
  const height = 650;

  const cx = 400;
  const cy = 330;

  const radius = 220;

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

  let rings = "";

  [0.25, 0.5, 0.75, 1].forEach((level) => {
    const ringPoints = months
      .map((_, index) => {
        const angle =
          (Math.PI * 2 * index) / months.length -
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
        stroke="#e5e7eb"
        stroke-width="1"
      />
    `;
  });

  let axes = "";
  let labels = "";

  points.forEach((point) => {
    axes += `
      <line
        x1="${cx}"
        y1="${cy}"
        x2="${point.x}"
        y2="${point.y}"
        stroke="#e5e7eb"
        stroke-width="1"
      />
    `;

    const labelRadius = radius + 35;

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

  const circles = dataPoints
    .map(
      (point, index) => `
        <circle
          cx="${point.x}"
          cy="${point.y}"
          r="6"
          fill="#06b6d4"
        />

        <text
          x="${point.x}"
          y="${point.y - 12}"
          text-anchor="middle"
          font-family="Arial"
          font-size="11"
          font-weight="600"
          fill="#374151"
        >
          ${months[index].count}
        </text>
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
    rx="24"
    fill="#ffffff"
  />

  <text
    x="${cx}"
    y="45"
    text-anchor="middle"
    font-family="Arial"
    font-size="23"
    font-weight="700"
    fill="#111827"
  >
    Commit Activity
  </text>

  <text
    x="${cx}"
    y="72"
    text-anchor="middle"
    font-family="Arial"
    font-size="13"
    fill="#6b7280"
  >
    ${total} contributions in the last 12 months
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

  console.log("Spider chart generated successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
