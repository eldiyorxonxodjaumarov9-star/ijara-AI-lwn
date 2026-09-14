/**
 * Reference DOCX → sanitized placeholder template (PII yo‘q).
 * Faqat lokal ishga tushirish: node scripts/sanitize-contract-templates.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const extract = join(root, "scripts", ".tmp-docx-extract");
const outDir = join(root, "server", "contract-templates", "v1");

function unzip(srcZip, dest) {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  // PowerShell Expand-Archive needs .zip
  const zipCopy = srcZip.replace(/\.docx$/i, ".zip");
  cpSync(srcZip, zipCopy);
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
}

function rezip(srcDir, destDocx) {
  const tmpZip = destDocx.replace(/\.docx$/i, ".zip");
  if (existsSync(tmpZip)) rmSync(tmpZip);
  if (existsSync(destDocx)) rmSync(destDocx);
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${join(srcDir, '*').replace(/'/g, "''")}' -DestinationPath '${tmpZip.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
  cpSync(tmpZip, destDocx);
  rmSync(tmpZip, { force: true });
}

function sanitizeXml(xml, kind) {
  let s = xml;

  // Strip known PII from reference (do not keep in repo)
  const pii = [
    /RAXIMOVA\s+DILNOZA\s+KOMILJON\s+QIZI/gi,
    /Рахимова\s+Дилноза/gi,
    /АА0286455/gi,
    /AA0286455/gi,
    /42501920211418/g,
    /207\s*275\s*139/g,
    /01158/g,
    /2312\s*0000\s*0000\s*0115\s*8004/g,
    /8600\s*4904\s*5715\s*2163/g,
    /\+998\s*99\s*791\s*07\s*91/g,
    /Kapitalbank[^<]{0,80}Filiali/gi,
    /Тошкент\s+шаҳри,\s+Юнусобод\s+тумани,\s+Боғишамол\s+кўчаси,\s+105-уй/g,
    /Barhayot\s+MFY[^<]{0,60}/gi,
    /4277340/g,
    /01\.08\.2026/g,
    /31\.12\.2026/g,
    /6\s*526\s*880/g,
    /8\s*664\s*000/g,
    /1\s*732\s*800/g,
    /91\s*200/g,
    /1\s*000\s*000/g,
  ];
  for (const re of pii) s = s.replace(re, "____");

  // Inject docxtemplater tags as plain text runs where blanks remain —
  // wrap common sections with explicit placeholders via simple markers.
  // Replace long underscore runs with a generic blank first.
  s = s.replace(/_{3,}/g, "____");

  // Title / header dynamics — replace first № blank and city line carefully
  // Insert a preamble paragraph of placeholders by replacing a known header fragment.
  if (kind === "individual") {
    s = s.replace(
      /ИЖАРА ШАРТНОМАСИ № ____/,
      "ИЖАРА ШАРТНОМАСИ № {{contractNumber}}"
    );
    s = s.replace(
      /____\s*Тошкент\s+шаҳри/,
      "{{contractDate}} {{contractCity}}"
    );
  } else {
    s = s.replace(
      /ИЖАРА ШАРТНОМАСИ № ____/,
      "ИЖАРА ШАРТНОМАСИ № {{contractNumber}}"
    );
    s = s.replace(
      /____\s*Тошкент\s+шаҳри/,
      "{{contractDate}} {{contractCity}}"
    );
  }

  // Opening party sentence — lessor + tenant
  s = s.replace(
    /бино эгаси ____\s*\(\s*____\s*\)/,
    "бино эгаси {{lessorFullName}} (паспорт {{lessorPassport}})"
  );
  s = s.replace(
    /бино эгаси ____/,
    "бино эгаси {{lessorFullName}} (паспорт {{lessorPassport}})"
  );

  if (kind === "legal") {
    s = s.replace(
      /иккинчи томондан\s*"?____"?\s*MCHJ\s+устави\s+асосида\s+иш\s+юритувчи\s+жамият\s+директори\s+____/,
      'иккинчи томондан "{{companyFullName}}" {{legalForm}} {{authorityBasis}} асосида иш юритувчи жамият директори {{directorFullName}}'
    );
  } else {
    s = s.replace(
      /иккинчи томондан\s+____\s+\(кейинги ўринларда “ИЖАРАГА ОЛУВЧИ”/,
      "иккинчи томондан {{tenantFullName}} (кейинги ўринларда “ИЖАРАГА ОЛУВЧИ”"
    );
  }

  // Property / area
  s = s.replace(
    /____да жойлашган бино/,
    "{{propertyAddress}}да жойлашган бино"
  );
  s = s.replace(
    /жойлашган бинонинг\s*____/,
    "жойлашган бинонинг {{area}}"
  );
  s = s.replace(
    /105-уй\s*____\s*метр/,
    "{{propertyAddress}} {{area}} метр"
  );
  s = s.replace(/__ метр/, "{{area}} метр");
  s = s.replace(/____ метр/, "{{area}} метр");

  // Table-ish values (after PII wipe many became ____)
  // Service / pricing — replace sequential blanks in pricing area carefully via unique nearby context
  s = s.replace(/Офис ижараси/, "{{serviceName}}");

  // Payment due day
  s = s.replace(/(\d{2}|____)-\s*санасига/g, "{{paymentDueDay}}- санасига");
  s = s.replace(/05-\s*санасига/, "{{paymentDueDay}}- санасига");
  s = s.replace(/24-\s*санасига/, "{{paymentDueDay}}- санасига");

  // Deposit clause
  s = s.replace(
    /амалга кирган санада\s+____\s*\([^)]*\)\s*сўм депозит/,
    "амалга кирган санада {{deposit}} ({{depositWords}}) сўм депозит"
  );
  s = s.replace(
    /амалга кирган санада\s+____\s*сўм депозит/,
    "амалга кирган санада {{deposit}} ({{depositWords}}) сўм депозит"
  );

  // Duration
  s = s.replace(
    /шартнома\s+____\s+бошлаб\s+қонуний\s+кучга\s+кириб,\s+____\s+кунигача/,
    "шартнома {{startDate}} бошлаб қонуний кучга кириб, {{endDate}} кунигача"
  );
  s = s.replace(
    /шартнома\s+\{\{startDate\}\}\s+бошлаб/,
    "шартнома {{startDate}} бошлаб"
  );

  // Total amount sentence
  s = s.replace(
    /умумий суммаси\s+____\s*сўмни/,
    "умумий суммаси {{totalAmount}} ({{totalAmountWords}}) сўмни"
  );

  // Lessor block labels
  s = s.replace(/ЖШШИР:\s*____/g, "ЖШШИР: {{lessorJshshir}}");
  s = s.replace(/Банк СТИР:\s*____/g, "Банк СТИР: {{lessorBankStir}}");
  s = s.replace(/Банк МФО\s*:\s*____/g, "Банк МФО : {{lessorBankMfo}}");
  s = s.replace(/МФО\s*:\s*____/g, "МФО : {{lessorBankMfo}}");
  s = s.replace(/Банк:\s*____/g, "Банк: {{lessorBankName}}");
  s = s.replace(/Х\/р:\s*____/g, "Х/р: {{lessorAccount}}");
  s = s.replace(/Карта рақами:\s*____/g, "Карта рақами: {{lessorCardNumber}}");
  s = s.replace(/Тел:\s*____/g, "Тел: {{lessorPhone}}");
  s = s.replace(
    /Манзил:\s*Тошкент шаҳри/g,
    "Манзил: {{lessorAddress}}"
  );
  s = s.replace(/Манзил:\s*____/g, "Манзил: {{tenantAddress}}");

  if (kind === "individual") {
    // Tenant column leftovers
    s = s.replace(
      /ИЖАРАГА ОЛУВЧИ:[\s\S]{0,200}?____/,
      "ИЖАРАГА ОЛУВЧИ:\n{{tenantFullName}}\nМанзил: {{tenantAddress}}\nЖШШИР: {{tenantJshshir}}\nПаспорт: {{passportOrId}}\nТел: {{tenantPhone}}\n"
    );
  } else {
    s = s.replace(
      /"----------------"\s*MCHJ|"____"\s*MCHJ|____"\s*MCHJ/,
      '"{{companyFullName}}" {{legalForm}}'
    );
    s = s.replace(/СТИР:\s*____/g, "СТИР: {{stir}}");
    s = s.replace(
      /ИЖАРАГА ОЛУВЧИ:[\s\S]{0,120}?____/,
      "ИЖАРАГА ОЛУВЧИ:\n{{companyFullName}} {{legalForm}}\nМанзил: {{legalAddress}}\nСТИР: {{stir}}\nБанк: {{bankName}}\nМФО: {{mfo}}\nХ/р: {{accountNumber}}\nДиректор: {{directorFullName}}\nАсос: {{authorityBasis}}\nТел: {{phone}}\n"
    );
  }

  // Pricing table cells — inject placeholders for remaining blanks near tariff
  // Ensure required money placeholders appear at least once
  const required = [
    "area",
    "ratePerSqm",
    "monthCount",
    "monthlyPayment",
    "totalAmount",
    "roomName",
  ];
  for (const key of required) {
    if (!s.includes(`{{${key}}}`)) {
      // append hidden paragraph at end of body
      s = s.replace(
        /<\/w:body>/,
        `<w:p><w:r><w:t>{{${key}}}</w:t></w:r></w:p></w:body>`
      );
    }
  }

  // Ensure core lessor/tenant placeholders exist
  const always = [
    "contractNumber",
    "contractDate",
    "contractCity",
    "lessorFullName",
    "lessorPassport",
    "lessorAddress",
    "lessorJshshir",
    "lessorBankStir",
    "lessorBankMfo",
    "lessorBankName",
    "lessorAccount",
    "lessorCardNumber",
    "lessorPhone",
    "propertyAddress",
    "serviceName",
    "paymentDueDay",
    "deposit",
    "depositWords",
    "startDate",
    "endDate",
    "totalAmountWords",
    "tenantType",
  ];
  for (const key of always) {
    if (!s.includes(`{{${key}}}`)) {
      s = s.replace(
        /<\/w:body>/,
        `<w:p><w:r><w:t>{{${key}}}</w:t></w:r></w:p></w:body>`
      );
    }
  }

  if (kind === "individual") {
    for (const key of [
      "tenantFullName",
      "passportOrId",
      "tenantJshshir",
      "tenantAddress",
      "tenantPhone",
    ]) {
      if (!s.includes(`{{${key}}}`)) {
        s = s.replace(
          /<\/w:body>/,
          `<w:p><w:r><w:t>{{${key}}}</w:t></w:r></w:p></w:body>`
        );
      }
    }
  } else {
    for (const key of [
      "companyFullName",
      "legalForm",
      "directorFullName",
      "authorityBasis",
      "legalAddress",
      "stir",
      "bankName",
      "mfo",
      "accountNumber",
      "phone",
    ]) {
      if (!s.includes(`{{${key}}}`)) {
        s = s.replace(
          /<\/w:body>/,
          `<w:p><w:r><w:t>{{${key}}}</w:t></w:r></w:p></w:body>`
        );
      }
    }
  }

  // Final safety: no leftover real card-like 16 digit sequences
  s = s.replace(/\b\d{16}\b/g, "{{lessorCardNumber}}");
  return s;
}

function processOne(kind, srcName, outName) {
  const src = join(extract, srcName);
  if (!existsSync(src)) {
    throw new Error(`Missing source: ${src}`);
  }
  const dest = join(extract, `sanitized-${kind}`);
  unzip(src, dest);
  const xmlPath = join(dest, "word", "document.xml");
  const xml = readFileSync(xmlPath, "utf8");
  const cleaned = sanitizeXml(xml, kind);
  // Ensure no raw PII remnants
  if (/RAXIMOVA|42501920211418|8600490457152163|Дилноза/i.test(cleaned)) {
    throw new Error(`PII still present in ${kind}`);
  }
  writeFileSync(xmlPath, cleaned, "utf8");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, outName);
  rezip(dest, out);
  console.log("Wrote", out);
}

processOne("individual", "individual.docx", "individual.docx");
processOne("legal", "legal.docx", "legal.docx");
console.log("Done");
