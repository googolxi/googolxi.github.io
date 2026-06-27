const fs = require("fs");
const path = require("path");
const rough = require("roughjs");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "content", "attachments");
const gen = rough.generator({
  options: {
    roughness: 1.35,
    bowing: 1.2,
    strokeWidth: 2.2,
    maxRandomnessOffset: 2,
    fixedDecimalPlaceDigits: 1,
    seed: 11
  }
});

const colors = {
  ink: "#20211d",
  muted: "#746d61",
  paper: "#fffdf8",
  bg: "#fbf7ef",
  line: "#c4ae93",
  blue: "#183d65",
  blueSoft: "#e7eef4",
  green: "#526f5b",
  greenSoft: "#e7efe3",
  clay: "#a55d42",
  claySoft: "#f2e1d8",
  gold: "#b48539",
  goldSoft: "#f5ead2"
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roughPaths(drawable, attrs = "") {
  return gen
    .toPaths(drawable)
    .map((item) => {
      const stroke = item.stroke ? ` stroke="${item.stroke}"` : "";
      const fill = item.fill ? ` fill="${item.fill}"` : ' fill="none"';
      const width = item.strokeWidth ? ` stroke-width="${item.strokeWidth}"` : "";
      return `<path d="${item.d}"${stroke}${fill}${width} ${attrs}/>`;
    })
    .join("\n");
}

function rect(x, y, w, h, options = {}) {
  return roughPaths(
    gen.rectangle(x, y, w, h, {
      stroke: colors.line,
      fillStyle: "solid",
      fill: colors.paper,
      ...options
    }),
    'stroke-linecap="round" stroke-linejoin="round"'
  );
}

function ellipse(x, y, w, h, options = {}) {
  return roughPaths(
    gen.ellipse(x, y, w, h, {
      stroke: colors.line,
      fillStyle: "solid",
      fill: colors.paper,
      ...options
    }),
    'stroke-linecap="round" stroke-linejoin="round"'
  );
}

function line(x1, y1, x2, y2, options = {}) {
  return roughPaths(
    gen.line(x1, y1, x2, y2, {
      stroke: colors.blue,
      strokeWidth: 2.4,
      ...options
    }),
    'stroke-linecap="round"'
  );
}

function curve(points, options = {}) {
  return roughPaths(
    gen.curve(points, {
      stroke: colors.green,
      strokeWidth: 2.6,
      fill: "none",
      ...options
    }),
    'stroke-linecap="round"'
  );
}

function arrowHead(x, y, rotation = 0, color = colors.blue) {
  const points = [
    [x, y],
    [x - 14, y - 7],
    [x - 10, y],
    [x - 14, y + 7]
  ];
  const transformed = points.map(([px, py]) => {
    const dx = px - x;
    const dy = py - y;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return [x + dx * cos - dy * sin, y + dx * sin + dy * cos];
  });
  return roughPaths(
    gen.polygon(transformed, {
      stroke: color,
      fill: color,
      fillStyle: "solid",
      strokeWidth: 1.6
    })
  );
}

function text(lines, x, y, options = {}) {
  const {
    size = 24,
    weight = 600,
    color = colors.ink,
    anchor = "start",
    lineHeight = Math.round(size * 1.45),
    family = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  } = options;

  return lines
    .map((line, index) => {
      return `<text x="${x}" y="${y + index * lineHeight}" fill="${color}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" font-family="${family}">${escapeHtml(line)}</text>`;
    })
    .join("\n");
}

function note(x, y, w, h, title, body, options = {}) {
  const fill = options.fill || colors.paper;
  const stroke = options.stroke || colors.line;
  const titleColor = options.titleColor || colors.ink;
  return `<g>
    ${rect(x, y, w, h, { fill, stroke, strokeWidth: 2.3, roughness: 1.65 })}
    ${text([title], x + 24, y + 44, { size: 27, weight: 800, color: titleColor })}
    ${text(body, x + 24, y + 82, { size: 19, weight: 540, color: colors.ink, lineHeight: 29 })}
  </g>`;
}

function svgWrap({ width, height, title, desc, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(title)}</title>
  <desc id="desc">${escapeHtml(desc)}</desc>
  <rect width="${width}" height="${height}" rx="34" fill="${colors.bg}"/>
  <g opacity="0.38">
    ${Array.from({ length: Math.floor(width / 120) }, (_, i) => `<path d="M${80 + i * 120} 60V${height - 55}" stroke="${colors.line}" stroke-width="1"/>`).join("\n")}
    ${Array.from({ length: Math.floor(height / 120) }, (_, i) => `<path d="M60 ${120 + i * 120}H${width - 65}" stroke="${colors.line}" stroke-width="1"/>`).join("\n")}
  </g>
  ${body}
</svg>
`;
}

function workflowDiagram() {
  const width = 1400;
  const height = 820;
  const body = `
  ${text(["从线性执行，到验证闭环"], 82, 94, { size: 46, weight: 850 })}
  ${text(["AI 把实现成本压低后，真正关键的动作从“排期交付”迁移到“发现机会、快速验证、持续校正”。"], 84, 136, { size: 21, weight: 520, color: colors.muted })}

  ${text(["旧流程：一条很长的交付线"], 106, 216, { size: 29, weight: 800, color: colors.clay })}
  ${note(96, 246, 182, 110, "需求", ["写清楚"], { fill: colors.claySoft, stroke: colors.clay, titleColor: colors.clay })}
  ${line(286, 302, 366, 302, { stroke: colors.clay })}
  ${arrowHead(366, 302, 0, colors.clay)}
  ${note(386, 246, 182, 110, "排期", ["等资源"], { fill: colors.claySoft, stroke: colors.clay, titleColor: colors.clay })}
  ${line(576, 302, 656, 302, { stroke: colors.clay })}
  ${arrowHead(656, 302, 0, colors.clay)}
  ${note(676, 246, 182, 110, "实现", ["做功能"], { fill: colors.claySoft, stroke: colors.clay, titleColor: colors.clay })}
  ${line(866, 302, 946, 302, { stroke: colors.clay })}
  ${arrowHead(946, 302, 0, colors.clay)}
  ${note(966, 246, 182, 110, "上线", ["等反馈"], { fill: colors.claySoft, stroke: colors.clay, titleColor: colors.clay })}
  ${line(1156, 302, 1238, 302, { stroke: colors.clay })}
  ${arrowHead(1238, 302, 0, colors.clay)}
  ${text(["反馈来得太晚"], 1230, 306, { size: 21, weight: 750, color: colors.clay })}

  ${text(["新闭环：先把市场反馈拉进来"], 106, 455, { size: 29, weight: 800, color: colors.green })}
  ${ellipse(264, 570, 205, 132, { fill: colors.greenSoft, stroke: colors.green, strokeWidth: 2.5 })}
  ${text(["市场信号"], 264, 562, { size: 27, weight: 850, color: colors.green, anchor: "middle" })}
  ${text(["真实问题"], 264, 596, { size: 18, weight: 560, color: colors.muted, anchor: "middle" })}

  ${ellipse(700, 570, 205, 132, { fill: colors.blueSoft, stroke: colors.blue, strokeWidth: 2.5 })}
  ${text(["AI 原型"], 700, 562, { size: 27, weight: 850, color: colors.blue, anchor: "middle" })}
  ${text(["低成本验证"], 700, 596, { size: 18, weight: 560, color: colors.muted, anchor: "middle" })}

  ${ellipse(1136, 570, 205, 132, { fill: colors.goldSoft, stroke: colors.gold, strokeWidth: 2.5 })}
  ${text(["小范围试点"], 1136, 562, { size: 27, weight: 850, color: colors.gold, anchor: "middle" })}
  ${text(["拿结果"], 1136, 596, { size: 18, weight: 560, color: colors.muted, anchor: "middle" })}

  ${curve([[370, 565], [480, 500], [560, 500], [610, 565]], { stroke: colors.green })}
  ${arrowHead(612, 565, 0.1, colors.green)}
  ${curve([[790, 565], [910, 500], [980, 500], [1040, 565]], { stroke: colors.green })}
  ${arrowHead(1043, 565, 0.1, colors.green)}
  ${curve([[1118, 650], [900, 750], [520, 750], [288, 650]], { stroke: colors.green })}
  ${arrowHead(287, 650, 3.05, colors.green)}

  ${rect(412, 694, 575, 62, { fill: colors.paper, stroke: colors.line, strokeWidth: 1.8, roughness: 1.8 })}
  ${text(["每一轮都在问：值得做吗？商业成立吗？能拿到分发吗？"], 700, 734, { size: 22, weight: 760, color: colors.blue, anchor: "middle" })}
  `;
  return svgWrap({
    width,
    height,
    title: "从线性执行到验证闭环",
    desc: "手绘风流程图，展示 AI 时代工作方式从线性交付变成市场信号、AI 原型、小范围试点之间的验证闭环。",
    body
  });
}

function capabilityMap() {
  const width = 1400;
  const height = 920;
  const body = `
  ${text(["AI 时代的生存能力地图"], 82, 94, { size: 46, weight: 850 })}
  ${text(["真正抗替代的不是岗位名，而是这些能迁移到不同场景里的能力。"], 84, 136, { size: 21, weight: 520, color: colors.muted })}

  ${line(700, 445, 700, 250, { stroke: colors.line, strokeWidth: 2 })}
  ${line(700, 445, 1040, 310, { stroke: colors.line, strokeWidth: 2 })}
  ${line(700, 445, 1080, 655, { stroke: colors.line, strokeWidth: 2 })}
  ${line(700, 445, 350, 655, { stroke: colors.line, strokeWidth: 2 })}
  ${line(700, 445, 350, 310, { stroke: colors.line, strokeWidth: 2 })}

  ${ellipse(700, 445, 250, 176, { fill: colors.paper, stroke: colors.line, strokeWidth: 2.8, roughness: 1.6 })}
  ${ellipse(700, 445, 196, 126, { fill: colors.blueSoft, stroke: colors.blue, strokeWidth: 2 })}
  ${text(["创造机会"], 700, 432, { size: 32, weight: 850, color: colors.blue, anchor: "middle" })}
  ${text(["不等任务出现", "主动完成闭环"], 700, 468, { size: 19, weight: 590, color: colors.ink, anchor: "middle", lineHeight: 28 })}

  ${note(154, 230, 340, 150, "机会判断", ["什么值得做？", "谁真的需要？"], { fill: colors.blueSoft, stroke: colors.blue, titleColor: colors.blue })}
  ${note(530, 170, 340, 150, "商业闭环", ["用户为什么来、留、付费？", "价值交换能不能成立？"], { fill: colors.greenSoft, stroke: colors.green, titleColor: colors.green })}
  ${note(906, 230, 340, 150, "流程重构", ["不是给旧流程加插件", "而是重新定义工作方式"], { fill: colors.claySoft, stroke: colors.clay, titleColor: colors.clay })}
  ${note(906, 610, 340, 150, "分发影响力", ["让市场、用户和资源看见", "流量本质是验证机制"], { fill: colors.goldSoft, stroke: colors.gold, titleColor: colors.gold })}
  ${note(154, 610, 340, 150, "作品积累", ["文章、产品、案例、方法论", "把能力变成外部证据"], { fill: colors.paper, stroke: colors.line, titleColor: colors.ink })}

  ${rect(430, 812, 540, 56, { fill: colors.blue, stroke: colors.blue, strokeWidth: 1.6 })}
  ${text(["核心不是抗替代，而是持续制造新的位置"], 700, 849, { size: 22, weight: 780, color: "#fffdf8", anchor: "middle" })}
  `;
  return svgWrap({
    width,
    height,
    title: "AI 时代的生存能力地图",
    desc: "手绘风能力地图，围绕创造机会展开机会判断、商业闭环、流程重构、分发影响力和作品积累五项能力。",
    body
  });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "ai-era-workflow-shift.svg"), workflowDiagram());
fs.writeFileSync(path.join(outDir, "ai-era-capability-map.svg"), capabilityMap());

console.log("Generated hand-drawn article diagrams.");
