const fs = require("fs");

const query = `
query {
  viewer {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
  }
}
`;

async function main() {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();

  if (result.errors) {
    throw new Error(JSON.stringify(result.errors));
  }

  const calendar =
    result.data.viewer.contributionsCollection.contributionCalendar;

  const weeks = calendar.weeks;
  const total = calendar.totalContributions;

  const cellSize = 12;
  const gap = 3;
  const left = 40;
  const top = 35;

  const width = left + weeks.length * (cellSize + gap) + 20;
  const height = top + 7 * (cellSize + gap) + 35;

  const max = Math.max(
    ...weeks.flatMap((week) =>
      week.contributionDays.map((day) => day.contributionCount)
    )
  );

  function getColor(count) {
    if (count === 0) return "#ebedf0";
    if (count <= Math.max(1, max * 0.25)) return "#9be9a8";
    if (count <= Math.max(2, max * 0.5)) return "#40c463";
    if (count <= Math.max(3, max * 0.75)) return "#30a14e";
    return "#216e39";
  }

  let cells = "";

  weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      const date = new Date(`${day.date}T00:00:00`);
      const row = date.getDay();

      const x = left + weekIndex * (cellSize + gap);
      const y = top + row * (cellSize + gap);

      cells += `
        <rect
          x="${x}"
          y="${y}"
          width="${cellSize}"
          height="${cellSize}"
          rx="3"
          fill="${getColor(day.contributionCount)}"
        >
          <title>${day.date}: ${day.contributionCount} contributions</title>
        </rect>
      `;
    });
  });

  const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <style>
    text {
      font-family: Arial, sans-serif;
    }
  </style>

  <text
    x="${left}"
    y="20"
    font-size="14"
    font-weight="600"
    fill="#24292f"
  >
    ${total} contributions in the last year
  </text>

  ${cells}

  <text x="${left}" y="${height - 8}" font-size="11" fill="#57606a">
    Less
  </text>

  <rect x="${left + 30}" y="${height - 18}" width="12" height="12" rx="3" fill="#ebedf0"/>
  <rect x="${left + 48}" y="${height - 18}" width="12" height="12" rx="3" fill="#9be9a8"/>
  <rect x="${left + 66}" y="${height - 18}" width="12" height="12" rx="3" fill="#40c463"/>
  <rect x="${left + 84}" y="${height - 18}" width="12" height="12" rx="3" fill="#30a14e"/>
  <rect x="${left + 102}" y="${height - 18}" width="12" height="12" rx="3" fill="#216e39"/>

  <text x="${left + 122}" y="${height - 8}" font-size="11" fill="#57606a">
    More
  </text>
</svg>
`;

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/activity.svg", svg.trim());

  console.log("Activity graph generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
