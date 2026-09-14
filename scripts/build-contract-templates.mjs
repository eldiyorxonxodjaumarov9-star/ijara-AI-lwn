/**
 * Builds sanitized DOCX templates (no reference PII) for contract MVP.
 * Layout is simplified OOXML; legal section text preserved in Cyrillic.
 */
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import PizZip from "pizzip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "server", "contract-templates", "v1");

function esc(t) {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function p(text) {
  return `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function h(text) {
  return `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function cell(text) {
  return `<w:tc><w:tcPr><w:tcW w:w="1400" w:type="dxa"/></w:tcPr>${p(text)}</w:tc>`;
}

function tableRow(cells) {
  return `<w:tr>${cells.map(cell).join("")}</w:tr>`;
}

function pricingTable() {
  return `<w:tbl>
  <w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>
  ${tableRow(["№", "Хизмат номланиши", "Умумий майдон ҳажми (м. кв.)", "Бир м. кв. учун бир ойга белгиланган тариф (сўм)", "Ойлар сони", "Бир ойлик тўлов (сўм)", "Жами суммаси (сўм)"])}
  ${tableRow(["1", "{{serviceName}}", "{{area}}", "{{ratePerSqm}}", "{{monthCount}}", "{{monthlyPayment}}", "{{totalAmount}}"])}
</w:tbl>`;
}

const SHARED_CLAUSES = `
${h("ШАРТНОМА ПРЕДМЕТИ")}
${p("“ИЖАРАГА БЕРУВЧИ” {{propertyAddress}} да жойлашган бинонинг {{area}} метр квадрат майдонини (хона: {{roomName}}) “ИЖАРАГА ОЛУВЧИ” га шартноманинг 2.1-бандида кўрсатилган нархлар эвазига ижарага беради. “ИЖАРАГА ОЛУВЧИ” эса кўрсатилган хизматлар ҳақини шартномада белгиланган муддатлар ва ҳажмларда тўлайди.")}
${h("ИЖАРА НАРХИ")}
${pricingTable()}
${p("Шартноманинг умумий суммаси {{totalAmount}} ({{totalAmountWords}}) сўмни ташкил этади.")}
${p("2.2 Бир метр квадрат учун белгиланган хизмат ҳақи жисмоний шахслардан олинадиган даромад солиғини ўз ичига олади. Ўзбекистон Республикаси Солиқ кодексининг 388-моддасига асосан Солиқ агенти ҳисобланган “ИЖАРАГА ОЛУВЧИ” солиқ тўловчининг ушбу Кодекснинг 387-моддасида кўрсатилган даромадларидан ҳисобланган солиқ суммасини ушлаб қолиши шарт ва ушбу сумма Солиқ агентининг солиқ солинадиган даромадларига киради.")}
${h("ЎЗАРО ҲИСОБ-КИТОБЛАР ТАРТИБИ")}
${p("“ИЖАРАГА ОЛУВЧИ” ҳар ойлик кўрсатилган ижара хизмати учун “ИЖАРАГА БЕРУВЧИ” нинг шартномада кўрсатилган ҳисоб рақамига {{paymentDueDay}}- санасига қадар олдиндан тўловларни амалга оширади. Агар бу кун банк иш кунига тўғри келмаса кейинги банк иш куни охирги тўлов санаси ҳисобланади.")}
${p("Ижара ҳақи ставкасига бинодан фойдаланиш (эксплуатация) харажатлари, коммунал хизматлар ҳақи, ер солиғи, мол-мулк солиғи, сифатли интернет хизматлари киради.")}
${h("ТАРАФЛАРНИНГ ҲУҚУҚ ВА МАЖБУРИЯТЛАРИ")}
${p("“ИЖАРАГА БЕРУВЧИ” нинг ҳуқуқлари: ижара ҳудудидан мақсадли фойдаланишни текшириш; коммунал хизматлар даражасини мониторинг қилиш; тўловларни талаб қилиш; тизимли хизмат кўрсатиш; кетма-кет икки марта тўлов амалга оширилмаса муҳрлаш, электр тармоғидан узиш ёки бир томонлама шартномани бекор қилиш.")}
${p("“ИЖАРАГА БЕРУВЧИ” нинг мажбуриятлари: маъмурий тўсиқлар қўлламаслик (байрам/дам олиш хавфсизлик чекловлари мустасно); аварияларни бартараф этиш; профилактика ҳақида олдиндан хабардор қилиш; депозитни шартларга мувофиқ қайтариш.")}
${p("“ИЖАРАГА ОЛУВЧИ” нинг ҳуқуқлари: хизмат сифатини талаб қилиш; шартнома бўйича маълумот олиш.")}
${p("“ИЖАРАГА ОЛУВЧИ” нинг мажбуриятлари: тўловларни ўз вақтида амалга ошириш; ҳудуддан мақсадли фойдаланиш; санитария-гигиена ва ёнғин хавфсизлиги қоидаларига риоя қилиш; учинчи шахсларга ҳуқуқ бермаслик; вакилларни киритиш; иш вақтидан сўнг электр асбобларини ўчириш; мол-мулкни бут сақлаш.")}
${p("Ижара шартнома амалга кирган санада {{deposit}} ({{depositWords}}) сўм депозит маблағ топшириш.")}
${p("“ИЖАРАГА ОЛУВЧИ” ижара шартномасини олдиндан бекор қилиш бўйича қарор қилган ҳолда тўлов санасига қадар 10 кун олдин “ИЖАРАГА БЕРУВЧИ”ни огоҳлантириш.")}
${h("ТАРАФЛАРНИНГ ЖАВОБГАРЛИГИ")}
${p("Тарафлар мазкур шартномага кўра ўз мажбуриятларини бажармаганлиги ёки лозим даражада бажармаганлиги оқибатида иккинчи тарафга етказилган моддий зарарни қонунда белгиланган тартибда ва ҳажмда қоплайди.")}
${p("Тарафларнинг мазкур шартномада кўрсатилмаган мулкий жавобгарликлари Ўзбекистон Республикасининг амалдаги қонунлари билан тартибга солинади.")}
${p("Барча эътирозлар ва келишмовчиликлар музокаралар йўли билан ҳал қилинади. Тарафлар ўртасида келишувга эришилмаган тақдирда низо “ИЖАРАГА БЕРУВЧИ” жойлашган судда ҳал қилинади.")}
${p("Ушбу шартнома шартлари тўлиқ бажарилмаган тақдирда солиштирма далолатномасиз иқтисодий судга мурожаат қилинади.")}
${p("Мазкур шартномани бекор қилишга қарор қилган тараф иккинчи тарафга ўн кун олдин хат билан ёзма билдиришнома юбориши шарт.")}
${h("ШАРТНОМАНИНГ МУДДАТИ")}
${p("Мазкур шартнома {{startDate}} бошлаб қонуний кучга кириб, {{endDate}} кунигача амал қилади. Шартнома тугатилгандан кейин ҳам тўланмай қолган қарздорлик зиммаси бекор қилинмайди.")}
${h("ҚЎШИМЧА ШАРТЛАР")}
${p("Мазкур шартномага киритилиши мумкин бўлган барча қўшимчалар ва ўзгартиришлар ёзма равишда расмийлаштирилиб, тарафларнинг ваколатли шахслари томонидан имзоланганидан сўнг кучга киради ҳамда шартноманинг ажралмас қисми ҳисобланади.")}
${p("Мазкур шартнома бир хил юридик кучга эга бўлган икки нусхада тузилди. Шартнома нусхалари тарафларга топширилади.")}
`;

function lessorBlock() {
  return `
${h("ТАРАФЛАРНИНГ ЮРИДИК МАНЗИЛИ ВА РЕКВИЗИТЛАРИ")}
${h("ИЖАРАГА БЕРУВЧИ:")}
${p("{{lessorFullName}}")}
${p("Манзил: {{lessorAddress}}")}
${p("ЖШШИР: {{lessorJshshir}}")}
${p("Паспорт: {{lessorPassport}}")}
${p("Банк СТИР: {{lessorBankStir}}")}
${p("Банк МФО: {{lessorBankMfo}}")}
${p("Банк: {{lessorBankName}}")}
${p("Х/р: {{lessorAccount}}")}
${p("Карта рақами: {{lessorCardNumber}}")}
${p("Тел: {{lessorPhone}}")}
${p("Имзо: ____________________")}
`;
}

function individualBody() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${h("ИЖАРА ШАРТНОМАСИ № {{contractNumber}}")}
${p("{{contractDate}}  {{contractCity}}")}
${p("{{propertyAddress}} да жойлашган бино эгаси {{lessorFullName}} (паспорт {{lessorPassport}}) (кейинги ўринларда “ИЖАРАГА БЕРУВЧИ” деб юритилади) ҳамда иккинчи томондан {{tenantFullName}} (кейинги ўринларда “ИЖАРАГА ОЛУВЧИ” деб юритилади) иккинчи томондан, ушбу шартномани қуйидагилар тўғрисида туздик. Мимоз тури: {{tenantType}}.")}
${SHARED_CLAUSES}
${lessorBlock()}
${h("ИЖАРАГА ОЛУВЧИ:")}
${p("{{tenantFullName}}")}
${p("Манзил: {{tenantAddress}}")}
${p("ЖШШИР: {{tenantJshshir}}")}
${p("Паспорт/ID: {{passportOrId}}")}
${p("Тел: {{tenantPhone}}")}
${p("Имзо: ____________________")}
</w:body></w:document>`;
}

function legalBody() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${h("ИЖАРА ШАРТНОМАСИ № {{contractNumber}}")}
${p("{{contractDate}}  {{contractCity}}")}
${p("{{propertyAddress}} да жойлашган бино эгаси {{lessorFullName}} (паспорт {{lessorPassport}}) (кейинги ўринларда “ИЖАРАГА БЕРУВЧИ” деб юритилади) ҳамда иккинчи томондан “{{companyFullName}}” {{legalForm}} {{authorityBasis}} асосида иш юритувчи жамият директори {{directorFullName}} (кейинги ўринларда “ИЖАРАГА ОЛУВЧИ” деб юритилади) иккинчи томондан, ушбу шартномани қуйидагилар тўғрисида туздик. Мимоз тури: {{tenantType}}.")}
${SHARED_CLAUSES}
${lessorBlock()}
${h("ИЖАРАГА ОЛУВЧИ:")}
${p("“{{companyFullName}}” {{legalForm}}")}
${p("Манзил: {{legalAddress}}")}
${p("СТИР: {{stir}}")}
${p("Банк: {{bankName}}")}
${p("МФО: {{mfo}}")}
${p("Х/р: {{accountNumber}}")}
${p("Директор: {{directorFullName}}")}
${p("Асос: {{authorityBasis}}")}
${p("Тел: {{phone}}")}
${p("Имзо: ____________________")}
</w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCRELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

function writeDocx(name, documentXml) {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels").file(".rels", RELS);
  zip.folder("word").file("document.xml", documentXml);
  zip.folder("word").folder("_rels").file("document.xml.rels", DOCRELS);
  const buf = zip.generate({ type: "nodebuffer" });
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, name);
  writeFileSync(out, buf);
  // sanity: no reference PII
  const asText = buf.toString("utf8");
  if (/RAXIMOVA|42501920211418|8600\s*4904|Дилноза/i.test(asText)) {
    throw new Error(`PII leaked into ${name}`);
  }
  console.log("Wrote", out, buf.length);
}

writeDocx("individual.docx", individualBody());
writeDocx("legal.docx", legalBody());
console.log("Templates ready");
