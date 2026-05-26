import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const prompt = getArg("--prompt") || args[0] || "生成一个电商大促活动页";
const outDir = resolve(getArg("--out") || `var/generated/activity-${timestamp()}`);
const name = getArg("--name") || inferName(prompt);
const width = Number.parseInt(getArg("--width") || "750", 10);
const height = Number.parseInt(getArg("--height") || "1500", 10);
const shouldSubmit = args.includes("--submit");
const shouldWait = args.includes("--wait");
const bridgeUrl = getArg("--bridge-url") || "http://localhost:39217";
const sourceImage = getArg("--source-image") ? resolve(getArg("--source-image")) : null;
const sourceImageName = sourceImage ? `image2-${basename(sourceImage)}` : "image2-screen.svg";

const theme = buildTheme(prompt);
const packageData = buildPackage({ name, prompt, width, height, theme, sourceImageName });

await writePackage(outDir, packageData, sourceImage);

console.log(`Generated activity package: ${outDir}`);
console.log(`page.json: ${outDir}/page.json`);

if (shouldSubmit) {
  const submitArgs = [
    "packages/bridge/src/submit-page.mjs",
    `${outDir}/page.json`,
    "--bridge-url",
    bridgeUrl
  ];
  if (shouldWait) {
    submitArgs.push("--wait");
  }
  const { spawn } = await import("node:child_process");
  await new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(process.execPath, submitArgs, {
      cwd: process.cwd(),
      stdio: "inherit"
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveProcess();
      } else {
        rejectProcess(new Error(`submit-page exited with ${code}`));
      }
    });
  });
}

function buildPackage({ name, prompt, width, height, theme, sourceImageName }) {
  const sections = [
    {
      id: "hero",
      type: "section",
      name: "Hero",
      x: 0,
      y: 0,
      width,
      height: 720,
      children: [
        imageNode("hero_bg", "backgroundImage", "assets/backgrounds/hero-bg.svg", 0, 0, width, 720),
        imageNode("main_title_art", "textImage", "assets/text-images/main-title.svg", 70, 92, 610, 218, "contain"),
        textNode("date_text", theme.dateText, 176, 326, 398, 38, 26, 600, "#FFFFFF", "CENTER"),
        imageNode("product_cluster", "foregroundImage", "assets/foregrounds/product-cluster.svg", 90, 384, 570, 286, "contain")
      ]
    },
    {
      id: "benefits",
      type: "section",
      name: "Benefits",
      x: 0,
      y: 720,
      width,
      height: 440,
      children: [
        imageNode("benefits_bg", "backgroundImage", "assets/backgrounds/benefits-bg.svg", 0, 0, width, 440),
        textNode("benefits_title", theme.benefitTitle, 226, 42, 298, 46, 34, 700, theme.darkText, "CENTER"),
        couponNodes("coupon_01", 56, 122, theme.couponOne, theme),
        couponNodes("coupon_02", 394, 122, theme.couponTwo, theme)
      ].flat()
    },
    {
      id: "conversion",
      type: "section",
      name: "Conversion",
      x: 0,
      y: 1160,
      width,
      height: height - 1160,
      children: [
        imageNode("conversion_bg", "backgroundImage", "assets/backgrounds/conversion-bg.svg", 0, 0, width, height - 1160),
        shapeNode("cta_button", 188, 210, 374, 86, theme.primary, 43),
        textNode("cta_text", theme.ctaText, 282, 230, 186, 46, 36, 700, "#FFFFFF", "CENTER"),
        {
          id: "cta_hotspot",
          type: "hotspot",
          x: 188,
          y: 210,
          width: 374,
          height: 86,
          action: "primary-cta"
        }
      ]
    }
  ];

  return {
    page: {
      schemaVersion: "activity-page.v0.1",
      name,
      canvas: {
        width,
        height,
        background: theme.pageBg,
        sourceImage: `source/${sourceImageName}`
      },
      metadata: {
        id: `pkg_${randomUUID()}`,
        prompt,
        generator: "generate-activity-package.mjs",
        note: "This is a structured package scaffold. Replace source/image2-screen.svg and assets with image2/parser outputs for production fidelity."
      },
      sections
    },
    assets: {
      "assets/backgrounds/hero-bg.svg": heroBg(theme),
      "assets/text-images/main-title.svg": titleArt(theme),
      "assets/foregrounds/product-cluster.svg": productCluster(theme),
      "assets/backgrounds/benefits-bg.svg": benefitsBg(theme),
      "assets/backgrounds/conversion-bg.svg": conversionBg(theme),
      ...(sourceImageName === "image2-screen.svg" ? { "source/image2-screen.svg": sourcePreview(theme) } : {})
    }
  };
}

async function writePackage(outDirPath, packageData, sourceImagePath) {
  await mkdir(outDirPath, { recursive: true });
  await mkdir(resolve(outDirPath, "assets/backgrounds"), { recursive: true });
  await mkdir(resolve(outDirPath, "assets/foregrounds"), { recursive: true });
  await mkdir(resolve(outDirPath, "assets/text-images"), { recursive: true });
  await mkdir(resolve(outDirPath, "source"), { recursive: true });

  await writeFile(resolve(outDirPath, "page.json"), JSON.stringify(packageData.page, null, 2));
  for (const [path, content] of Object.entries(packageData.assets)) {
    await writeFile(resolve(outDirPath, path), content);
  }
  if (sourceImagePath) {
    await copyFile(sourceImagePath, resolve(outDirPath, "source", `image2-${basename(sourceImagePath)}`));
  }
}

function buildTheme(promptText) {
  const lower = promptText.toLowerCase();
  const isValentine = /七夕|情人|valentine/.test(promptText);
  const isNewYear = /新年|春节|年货|dragon|lunar/.test(promptText);
  const isSummer = /夏|summer|618|大促|电商|sale/.test(lower) || /夏|大促|电商/.test(promptText);

  if (isValentine) {
    return {
      titleLine1: "心动礼遇",
      titleLine2: "浪漫限时购",
      benefitTitle: "专属浪漫福利",
      dateText: "限时开启 · 今日 20:00",
      ctaText: "立即领取",
      couponOne: { price: "¥52", desc: "满299可用" },
      couponTwo: { price: "¥131", desc: "满999可用" },
      primary: "#E9346F",
      secondary: "#FF8FB8",
      accent: "#FFE37A",
      pageBg: "#FFF0F6",
      darkText: "#6F1838"
    };
  }

  if (isNewYear) {
    return {
      titleLine1: "新年开门红",
      titleLine2: "好礼抢先购",
      benefitTitle: "年货专属福利",
      dateText: "新春限时 · 20:00 开抢",
      ctaText: "马上抢福",
      couponOne: { price: "¥88", desc: "满499可用" },
      couponTwo: { price: "¥188", desc: "满1299可用" },
      primary: "#D71920",
      secondary: "#FFB000",
      accent: "#FFE27A",
      pageBg: "#FFF2D9",
      darkText: "#74190E"
    };
  }

  if (isSummer) {
    return {
      titleLine1: "夏日狂欢节",
      titleLine2: "全场低至 5 折",
      benefitTitle: "限时专属福利",
      dateText: "6.18 20:00 - 6.20 23:59",
      ctaText: "立即抢购",
      couponOne: { price: "¥50", desc: "满399可用" },
      couponTwo: { price: "¥120", desc: "满899可用" },
      primary: "#E63820",
      secondary: "#FF7A5E",
      accent: "#FFC947",
      pageBg: "#FFF1EC",
      darkText: "#6E1B12"
    };
  }

  return {
    titleLine1: "品牌惊喜日",
    titleLine2: "限时福利开启",
    benefitTitle: "专属活动福利",
    dateText: "今日 20:00 准时开抢",
    ctaText: "立即参与",
    couponOne: { price: "¥30", desc: "满199可用" },
    couponTwo: { price: "¥80", desc: "满599可用" },
    primary: "#245DFF",
    secondary: "#53D3B9",
    accent: "#FFD75A",
    pageBg: "#EEF7FF",
    darkText: "#12315E"
  };
}

function inferName(promptText) {
  const clean = promptText.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
  return clean ? clean.slice(0, 36) : "Activity Page";
}

function imageNode(id, type, asset, x, y, width, height, fit = "cover") {
  return { id, type, asset, x, y, width, height, fit };
}

function textNode(id, text, x, y, width, height, fontSize, fontWeight, color, align = "LEFT") {
  return {
    id,
    type: "editableText",
    text,
    x,
    y,
    width,
    height,
    fontFamily: "Inter",
    fontWeight,
    fontSize,
    lineHeight: Math.round(fontSize * 1.2),
    letterSpacing: 0,
    color,
    align
  };
}

function shapeNode(id, x, y, width, height, fill, cornerRadius) {
  return {
    id,
    type: "shape",
    x,
    y,
    width,
    height,
    fill,
    cornerRadius,
    effects: [
      {
        type: "dropShadow",
        color: "#8F1E11",
        opacity: 0.2,
        x: 0,
        y: 8,
        blur: 18
      }
    ]
  };
}

function couponNodes(prefix, x, y, coupon, theme) {
  return [
    shapeNode(`${prefix}_card`, x, y, 300, 176, "#FFFFFF", 28),
    textNode(`${prefix}_price`, coupon.price, x + 36, y + 30, 150, 70, 56, 700, theme.primary),
    textNode(`${prefix}_desc`, coupon.desc, x + 40, y + 106, 180, 32, 24, 500, theme.darkText)
  ];
}

function heroBg(theme) {
  return svg(750, 720, `
    <rect width="750" height="720" fill="url(#bg)"/>
    <circle cx="112" cy="120" r="82" fill="${theme.accent}" opacity="0.55"/>
    <circle cx="624" cy="142" r="116" fill="${theme.secondary}" opacity="0.35"/>
    <circle cx="620" cy="568" r="132" fill="${theme.pageBg}" opacity="0.75"/>
    <path d="M0 565C116 522 214 532 326 590C462 660 578 655 750 594V720H0V565Z" fill="${theme.pageBg}"/>
    <path d="M46 40H704C729 40 750 61 750 86V500C616 567 481 563 347 505C239 458 126 452 0 490V86C0 61 21 40 46 40Z" fill="url(#panel)" opacity="0.72"/>
    <defs>
      <linearGradient id="bg" x1="375" y1="0" x2="375" y2="720" gradientUnits="userSpaceOnUse">
        <stop stop-color="${theme.primary}"/>
        <stop offset="0.58" stop-color="${theme.secondary}"/>
        <stop offset="1" stop-color="${theme.pageBg}"/>
      </linearGradient>
      <linearGradient id="panel" x1="375" y1="40" x2="375" y2="584" gradientUnits="userSpaceOnUse">
        <stop stop-color="${theme.accent}"/>
        <stop offset="1" stop-color="${theme.secondary}" stop-opacity="0"/>
      </linearGradient>
    </defs>
  `);
}

function titleArt(theme) {
  return svg(610, 218, `
    <path d="M34 30H576C595 30 610 45 610 64V154C610 173 595 188 576 188H34C15 188 0 173 0 154V64C0 45 15 30 34 30Z" fill="#FFFFFF" opacity="0.26"/>
    <text x="305" y="96" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="72" font-weight="900" fill="#FFF9C7" stroke="${theme.darkText}" stroke-width="8" paint-order="stroke">${escapeXml(theme.titleLine1)}</text>
    <text x="305" y="166" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="54" font-weight="900" fill="#FFFFFF" stroke="${theme.darkText}" stroke-width="6" paint-order="stroke">${escapeXml(theme.titleLine2)}</text>
    <circle cx="44" cy="42" r="16" fill="${theme.accent}"/>
    <circle cx="566" cy="174" r="18" fill="${theme.accent}"/>
  `);
}

function productCluster(theme) {
  return svg(570, 286, `
    <ellipse cx="285" cy="246" rx="230" ry="32" fill="${theme.darkText}" opacity="0.16"/>
    <rect x="70" y="68" width="150" height="168" rx="30" fill="#FFE8D8"/>
    <rect x="92" y="92" width="106" height="106" rx="24" fill="${theme.secondary}"/>
    <rect x="112" y="210" width="70" height="12" rx="6" fill="${theme.primary}"/>
    <rect x="206" y="22" width="170" height="214" rx="34" fill="#FFF9EA"/>
    <rect x="232" y="52" width="118" height="132" rx="30" fill="${theme.accent}"/>
    <path d="M260 196H322C331 196 338 203 338 212V244H244V212C244 203 251 196 260 196Z" fill="${theme.primary}"/>
    <rect x="356" y="82" width="146" height="154" rx="28" fill="#FFD9C8"/>
    <rect x="378" y="108" width="102" height="92" rx="24" fill="${theme.secondary}"/>
    <rect x="398" y="214" width="64" height="12" rx="6" fill="${theme.primary}"/>
    <path d="M38 78L72 38L106 78H38Z" fill="${theme.accent}"/>
    <path d="M488 48L536 18L528 76L488 48Z" fill="${theme.accent}"/>
  `);
}

function benefitsBg(theme) {
  return svg(750, 440, `
    <rect width="750" height="440" fill="${theme.pageBg}"/>
    <path d="M0 42C140 6 272 14 392 58C520 105 636 104 750 50V440H0V42Z" fill="#FFFFFF" opacity="0.42"/>
    <circle cx="90" cy="350" r="74" fill="${theme.secondary}" opacity="0.24"/>
    <circle cx="675" cy="116" r="92" fill="${theme.accent}" opacity="0.4"/>
  `);
}

function conversionBg(theme) {
  return svg(750, 340, `
    <rect width="750" height="340" fill="#FFF9EA"/>
    <rect x="48" y="34" width="654" height="236" rx="34" fill="#FFFFFF"/>
    <rect x="80" y="70" width="170" height="130" rx="26" fill="${theme.pageBg}"/>
    <rect x="290" y="70" width="170" height="130" rx="26" fill="${theme.pageBg}"/>
    <rect x="500" y="70" width="170" height="130" rx="26" fill="${theme.pageBg}"/>
    <circle cx="165" cy="135" r="44" fill="${theme.secondary}"/>
    <circle cx="375" cy="135" r="44" fill="${theme.accent}"/>
    <circle cx="585" cy="135" r="44" fill="${theme.secondary}"/>
  `);
}

function sourcePreview(theme) {
  return svg(750, 1500, `
    <rect width="750" height="1500" fill="${theme.pageBg}"/>
    <image href="assets/backgrounds/hero-bg.svg" x="0" y="0" width="750" height="720"/>
    <image href="assets/text-images/main-title.svg" x="70" y="92" width="610" height="218"/>
    <text x="375" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">${escapeXml(theme.dateText)}</text>
    <image href="assets/foregrounds/product-cluster.svg" x="90" y="384" width="570" height="286"/>
    <image href="assets/backgrounds/benefits-bg.svg" x="0" y="720" width="750" height="440"/>
    <text x="375" y="812" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="${theme.darkText}">${escapeXml(theme.benefitTitle)}</text>
    <rect x="56" y="842" width="300" height="176" rx="28" fill="#FFFFFF"/>
    <rect x="394" y="842" width="300" height="176" rx="28" fill="#FFFFFF"/>
    <text x="92" y="920" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="${theme.primary}">${escapeXml(theme.couponOne.price)}</text>
    <text x="430" y="920" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="${theme.primary}">${escapeXml(theme.couponTwo.price)}</text>
    <text x="96" y="970" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="${theme.darkText}">${escapeXml(theme.couponOne.desc)}</text>
    <text x="434" y="970" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="${theme.darkText}">${escapeXml(theme.couponTwo.desc)}</text>
    <image href="assets/backgrounds/conversion-bg.svg" x="0" y="1160" width="750" height="340"/>
    <rect x="188" y="1370" width="374" height="86" rx="43" fill="${theme.primary}"/>
    <text x="375" y="1425" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#FFFFFF">${escapeXml(theme.ctaText)}</text>
  `);
}

function svg(width, height, content) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">${content}</svg>\n`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}
