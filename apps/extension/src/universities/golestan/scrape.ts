import { browser } from "#imports";
import type { PagingInfo, ScrapeResult } from "../../lib/types";

/**
 * Self-contained paging reader for Golestan report framesets.
 * Inspects only the active and visible report iframe in FacArea.
 */
export function readGolestanPaging(): PagingInfo {
    function toEnglishDigits(text: string): string {
        return text.replace(/[۰-۹٠-٩]/g, (ch) => {
            const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch);
            if (persian !== -1) return String(persian);
            return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
        });
    }

    function getDocs(win: Window): Document[] {
        let docs: Document[] = [];
        try {
            // Inspect FacArea to locate the topmost active report iframe and ignore hidden ones
            const facArea = win.document?.getElementById("FacArea");
            if (facArea && facArea.children.length > 0) {
                const divs = Array.from(facArea.children) as HTMLElement[];
                const visibleDivs = divs.filter(
                    (d) => d.style.display !== "none" && d.style.visibility !== "hidden",
                );
                visibleDivs.sort((a, b) => {
                    const zA = parseInt(a.style.zIndex || "0", 10);
                    const zB = parseInt(b.style.zIndex || "0", 10);
                    return zB - zA;
                });
                const activeIframe = visibleDivs[0]?.querySelector("iframe");
                if (activeIframe && activeIframe.contentWindow) {
                    return getDocs(activeIframe.contentWindow);
                }
            }
        } catch { }

        try {
            if (win && win.document) docs.push(win.document);
        } catch { }
        try {
            if (win && win.frames) {
                for (let i = 0; i < win.frames.length; i++) {
                    docs = docs.concat(getDocs(win.frames[i] as Window));
                }
            }
        } catch { }
        return docs;
    }

    const docs = getDocs(window);
    let hasNext = false;
    let hasPrev = false;
    let page: number | null = null;
    let totalPages: number | null = null;

    for (const doc of docs) {
        // Page counter rendered in Commander/Form frame (e.g. "صفحه 3 از 15")
        if (page === null) {
            const counter = toEnglishDigits(doc.body?.innerText ?? "").match(
                /صفحه\s*(\d+)\s*از\s*(\d+)/,
            );
            if (counter) {
                page = parseInt(counter[1]!, 10);
                totalPages = parseInt(counter[2]!, 10);
            }
        }

        const nextBtn = doc.querySelector<HTMLInputElement | HTMLImageElement>(
            '[title*="صفحه بعد"], [title*="صفحه بعدي"], [src*="MoveLeft"]',
        );
        if (nextBtn) {
            const src = nextBtn.getAttribute("src") || "";
            const disabled =
                (nextBtn as HTMLInputElement).disabled ||
                src.includes("_d.") ||
                nextBtn.getAttribute("disabled") !== null ||
                nextBtn.classList.contains("disabled");
            if (!disabled) hasNext = true;
        }

        const prevBtn = doc.querySelector<HTMLInputElement | HTMLImageElement>(
            '[title*="صفحه قبل"], [title*="صفحه قبلي"], [src*="MoveRight"]',
        );
        if (prevBtn) {
            const src = prevBtn.getAttribute("src") || "";
            const disabled =
                (prevBtn as HTMLInputElement).disabled ||
                src.includes("_d.") ||
                prevBtn.getAttribute("disabled") !== null ||
                prevBtn.classList.contains("disabled");
            if (!disabled) hasPrev = true;
        }
    }

    return {
        totalRecords: null,
        from: null,
        to: null,
        hasNext,
        hasPrev,
        page,
        totalPages,
    };
}

/**
 * Scrapes offering records from Golestan report 102.
 * Fully self-contained: serialized via chrome.scripting.executeScript.
 */
export function scrapeGolestanOfferings(): ScrapeResult {
    function toEnglishDigits(text: string): string {
        return text.replace(/[۰-۹٠-٩]/g, (ch) => {
            const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch);
            if (persian !== -1) return String(persian);
            return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
        });
    }

    function unifyPersian(text: string): string {
        return text
            .replace(/\u0643/g, "\u06A9")
            .replace(/\u064A/g, "\u06CC")
            .replace(/\u0649/g, "\u06CC");
    }

    function cleanText(text: string): string {
        return unifyPersian(
            toEnglishDigits(
                text
                    .replace(/[\u200c\u200d\u200e\u200f\u00a0\u2060\ufeff]/g, " ")
                    .replace(/\s+/g, " "),
            ).replace(/\u00a0/g, " "),
        )
            .replace(/\s+/g, " ")
            .trim();
    }

    // Zero-width/invisible marks (ZWSP, ZWNJ..RLM, bidi controls, word
    // joiner, soft hyphen) hide inside Golestan table cells and silently
    // break numeric parsing - JS \s does not match them.
    const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;

    function toInt(value: string): number | null {
        if (!value) return null;
        const normalized = value
            .replace(INVISIBLE_RE, "")
            .replace(/[,،\s]/g, "");
        return /^\d+$/.test(normalized) ? Number(normalized) : null;
    }

    function toFloat(value: string): number | null {
        if (!value) return null;
        // Fractional units are written with a slash (۰/۵ = 0.5). The slash
        // may arrive as any unicode variant (fraction ⁄, division ∕,
        // fullwidth ／) next to the Arabic decimal mark (٫) and middle dot (·).
        const normalized = value
            .replace(INVISIBLE_RE, "")
            .replace(/[,،\u066C\s]/g, "")
            .replace(/[\u066B\u00B7\u2044\u2215\uFF0F/]/g, ".");
        return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
    }

    function getDocs(win: Window): Document[] {
        let docs: Document[] = [];
        try {
            const facArea = win.document?.getElementById("FacArea");
            if (facArea && facArea.children.length > 0) {
                const divs = Array.from(facArea.children) as HTMLElement[];
                const visibleDivs = divs.filter(
                    (d) => d.style.display !== "none" && d.style.visibility !== "hidden",
                );
                visibleDivs.sort((a, b) => {
                    const zA = parseInt(a.style.zIndex || "0", 10);
                    const zB = parseInt(b.style.zIndex || "0", 10);
                    return zB - zA;
                });
                const activeIframe = visibleDivs[0]?.querySelector("iframe");
                if (activeIframe && activeIframe.contentWindow) {
                    return getDocs(activeIframe.contentWindow);
                }
            }
        } catch { }

        try {
            if (win && win.document) docs.push(win.document);
        } catch { }
        try {
            if (win && win.frames) {
                for (let i = 0; i < win.frames.length; i++) {
                    docs = docs.concat(getDocs(win.frames[i] as Window));
                }
            }
        } catch { }
        return docs;
    }

    const allDocs = getDocs(window);
    let targetTable: HTMLTableElement | null = null;

    for (const doc of allDocs) {
        const tables = doc.querySelectorAll("table");
        for (const tbl of tables) {
            const rows = tbl.querySelectorAll("tr");
            for (let r = 0; r < Math.min(rows.length, 3); r++) {
                const txt = cleanText(
                    rows[r]?.querySelector("td, th")?.textContent ?? "",
                );
                if (/\d{4,10}[_\-\/\u2044\u2215\uFF0F]\d+/.test(txt)) {
                    targetTable = tbl;
                    break;
                }
            }
            if (targetTable) break;
        }
        if (targetTable) break;
    }

    if (!targetTable) {
        return {
            rows: [],
            matchedFields: 0,
            totalFields: 15,
            duplicateCount: 0,
            paging: {
                totalRecords: null,
                from: null,
                to: null,
                hasNext: false,
                hasPrev: false,
                page: null,
                totalPages: null,
            },
            pageTitle: document.title,
            pageUrl: location.href,
        };
    }

    const rows: ScrapeResult["rows"] = [];
    const seenIndexes = new Set<string>();
    let duplicateCount = 0;

    /**
     * Resolve the unit sub-columns (كل = total, ع = practical) from the
     * header table (Table3Prim) by walking its rowspan/colspan grid. Column
     * order differs between Golestan deployments, so fixed positions are
     * only a fallback. -1 means the column does not exist in this report.
     */
    function findUnitColumns(): { total: number; practical: number } {
        try {
            for (const doc of allDocs) {
                for (const tbl of Array.from(doc.querySelectorAll("table"))) {
                    const hRows = Array.from(tbl.querySelectorAll("tr"));
                    const occupied: boolean[][] = hRows.map(() => []);
                    let totalIdx = -1;
                    let practicalIdx = -1;
                    for (let r = 0; r < hRows.length; r++) {
                        const hCells = Array.from(
                            hRows[r]!.querySelectorAll("td, th"),
                        ) as HTMLTableCellElement[];
                        let col = 0;
                        for (const cell of hCells) {
                            while (occupied[r]![col]) col++;
                            const colspan =
                                parseInt(cell.getAttribute("colspan") || "1", 10) || 1;
                            const rowspan =
                                parseInt(cell.getAttribute("rowspan") || "1", 10) || 1;
                            const text = cleanText(cell.textContent ?? "");
                            if (text === "کل") totalIdx = col;
                            else if (text === "ع") practicalIdx = col;
                            for (
                                let rr = r;
                                rr < Math.min(r + rowspan, hRows.length);
                                rr++
                            ) {
                                for (let cc = col; cc < col + colspan; cc++) {
                                    occupied[rr]![cc] = true;
                                }
                            }
                            col += colspan;
                        }
                    }
                    if (totalIdx !== -1 || practicalIdx !== -1) {
                        return { total: totalIdx, practical: practicalIdx };
                    }
                }
            }
        } catch { }
        // Classic layout: cells[2]=واحد(كل), cells[3]=واحد(ع)
        return { total: 2, practical: 3 };
    }

    const unitCols = findUnitColumns();

    const rowElements = Array.from(targetTable.querySelectorAll("tr"));
    rowElements.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 5) return;

        const rawCode = cleanText(cells[0]?.textContent ?? "");
        const codeMatch = rawCode.match(/(\d{4,10})[_\-\/\u2044\u2215\uFF0F](\d+)/);
        if (!codeMatch) return;

        const courseCode = codeMatch[1]!;
        const classCode = codeMatch[2]!;
        const index = `${courseCode}-${classCode}`;

        if (seenIndexes.has(index)) {
            duplicateCount++;
            return;
        }
        seenIndexes.add(index);

        const courseName = cleanText(cells[1]?.textContent ?? "");
        // واحد columns resolved dynamically: كل = total, ع = practical
        const totalUnits =
            unitCols.total === -1
                ? 0
                : (toFloat(cleanText(cells[unitCols.total]?.textContent ?? "")) ?? 0);
        const practicalUnits =
            unitCols.practical === -1
                ? 0
                : (toFloat(cleanText(cells[unitCols.practical]?.textContent ?? "")) ?? 0);
        const theoreticalUnits = Math.max(0, totalUnits - practicalUnits);
        const maxCapacity = toInt(cleanText(cells[4]?.textContent ?? ""));
        const currentEnrollment = toInt(cleanText(cells[5]?.textContent ?? ""));
        const professor = cleanText(cells[8]?.textContent ?? "") || null;

        const schedRaw = cleanText(cells[9]?.textContent ?? "");
        const examRaw = cleanText(cells[10]?.textContent ?? "");

        let classSchedule: string[] = [];
        let locationStr: Array<string | null> = [];

        if (schedRaw) {
            // Golestan format: "شنبه از 07:30 تا 10:05; مکان: فنی مهندسی-2106"
            // or "شنبه از 07:30 تا 10:05". Location may trail after a
            // semicolon/newline - strip it from the schedule text.
            const locMatch = schedRaw.match(/مکان:\s*([^;,\n]+)/);
            if (locMatch) {
                locationStr = [locMatch[1]!.trim()];
            }

            // Cut any trailing location portion (everything from ";" / newline onward).
            const schedPart = schedRaw.split(/[;\n]/)[0]!.trim();

            const dayMatch = schedPart.match(
                /(شنبه|یکشنبه|دوشنبه|سه شنبه|چهارشنبه|پنج شنبه|جمعه)\s*(?:از\s*)?(\d{1,2}[:.]\d{2})\s*(?:تا|الی|[-_])\s*(\d{1,2}[:.]\d{2})/,
            );
            if (dayMatch) {
                classSchedule = [`${dayMatch[1]} از ${dayMatch[2]!.replace(/[:.]/g, ":")} تا ${dayMatch[3]!.replace(/[:.]/g, ":")}`];
            } else if (schedPart) {
                classSchedule = [schedPart];
            }
        }

        rows.push({
            index,
            courseCode,
            courseName,
            courseType: null,
            theoreticalUnits,
            practicalUnits,
            classCode,
            degree: "کارشناسی",
            presentationType: null,
            minCapacity: null,
            maxCapacity,
            currentEnrollment,
            classSchedule,
            examSchedule: examRaw ? cleanText(examRaw) : null,
            professor,
            location: locationStr,
        });
    });

    let hasNext = false;
    let hasPrev = false;

    for (const doc of allDocs) {
        const nextBtn = doc.querySelector<HTMLInputElement | HTMLImageElement>(
            '[title*="صفحه بعد"], [title*="صفحه بعدي"], [src*="MoveLeft"]',
        );
        if (nextBtn) {
            const src = nextBtn.getAttribute("src") || "";
            const disabled =
                (nextBtn as HTMLInputElement).disabled ||
                src.includes("_d.") ||
                nextBtn.getAttribute("disabled") !== null ||
                nextBtn.classList.contains("disabled");
            if (!disabled) hasNext = true;
        }

        const prevBtn = doc.querySelector<HTMLInputElement | HTMLImageElement>(
            '[title*="صفحه قبل"], [title*="صفحه قبلي"], [src*="MoveRight"]',
        );
        if (prevBtn) {
            const src = prevBtn.getAttribute("src") || "";
            const disabled =
                (prevBtn as HTMLInputElement).disabled ||
                src.includes("_d.") ||
                prevBtn.getAttribute("disabled") !== null ||
                prevBtn.classList.contains("disabled");
            if (!disabled) hasPrev = true;
        }
    }

    // Page counter rendered in Commander/Form frame (e.g. "صفحه 3 از 15") -
    // feeds the popup progress bar (page/totalPages).
    let currentPage: number | null = null;
    let reportTotalPages: number | null = null;
    for (const doc of allDocs) {
        const counter = toEnglishDigits(doc.body?.innerText ?? "").match(
            /صفحه\s*(\d+)\s*از\s*(\d+)/,
        );
        if (counter) {
            currentPage = parseInt(counter[1]!, 10);
            reportTotalPages = parseInt(counter[2]!, 10);
            break;
        }
    }

    return {
        rows,
        matchedFields: 10,
        totalFields: 15,
        duplicateCount,
        paging: {
            totalRecords: null,
            from: null,
            to: null,
            hasNext,
            hasPrev,
            page: currentPage,
            totalPages: reportTotalPages,
        },
        pageTitle: document.title,
        pageUrl: location.href,
    };
}

/**
 * Injects a click on the next-page control inside the Commander frame of the active report.
 */
export async function navigateGolestanNext(tabId: number): Promise<boolean> {
    try {
        const [result] = await browser.scripting.executeScript({
            target: { tabId },
            func: async () => {
                function toEn(str: unknown): string {
                    return String(str ?? "").replace(/[۰-۹]/g, (d: string) =>
                        String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
                    );
                }
                function getDocs(win: Window): Document[] {
                    let docs: Document[] = [];
                    try {
                        const facArea = win.document?.getElementById("FacArea");
                        if (facArea && facArea.children.length > 0) {
                            const divs = Array.from(facArea.children) as HTMLElement[];
                            const visibleDivs = divs.filter(
                                (d) =>
                                    d.style.display !== "none" && d.style.visibility !== "hidden",
                            );
                            visibleDivs.sort((a, b) => {
                                const zA = parseInt(a.style.zIndex || "0", 10);
                                const zB = parseInt(b.style.zIndex || "0", 10);
                                return zB - zA;
                            });
                            const activeIframe = visibleDivs[0]?.querySelector("iframe");
                            if (activeIframe && activeIframe.contentWindow) {
                                return getDocs(activeIframe.contentWindow);
                            }
                        }
                    } catch { }

                    try {
                        if (win && win.document) docs.push(win.document);
                    } catch { }
                    try {
                        if (win && win.frames) {
                            for (let i = 0; i < win.frames.length; i++) {
                                docs = docs.concat(getDocs(win.frames[i] as Window));
                            }
                        }
                    } catch { }
                    return docs;
                }

                const docs = getDocs(window);

                // 1. Gather a snapshot fingerprint of all course codes currently visible on the page
                const codesBefore: string[] = [];
                for (const doc of docs) {
                    const tables = doc.querySelectorAll("table");
                    for (const tbl of tables) {
                        const trs = tbl.querySelectorAll("tr");
                        for (let r = 0; r < trs.length; r++) {
                            const txt = toEn(
                                trs[r]?.querySelector("td, th")?.textContent ?? "",
                            ).trim();
                            const m = txt.match(/\d{4,10}[_\-\/\u2044\u2215\uFF0F]\d+/);
                            if (m) {
                                codesBefore.push(m[0]);
                            }
                        }
                    }
                }
                const snapshotBefore = codesBefore.join(",");

                // 2. Check page counter if rendered in Commander or Form frame (e.g. "صفحه 15 از 15")
                for (const doc of docs) {
                    const txt = toEn(doc.body?.innerText ?? "");
                    const match = txt.match(/صفحه\s*(\d+)\s*از\s*(\d+)/);
                    if (match && match[1] && match[2]) {
                        const currentP = parseInt(match[1], 10);
                        const totalP = parseInt(match[2], 10);
                        if (currentP >= totalP && totalP > 0) {
                            return false; // Last page reached
                        }
                    }
                }

                // 3. Locate the active next button
                let nextBtn: HTMLElement | null = null;
                for (const doc of docs) {
                    const btn = doc.querySelector<HTMLInputElement | HTMLImageElement>(
                        '[title*="صفحه بعد"], [title*="صفحه بعدي"], [src*="MoveLeft"]',
                    );
                    if (btn) {
                        const src = btn.getAttribute("src") || "";
                        const disabled =
                            (btn as HTMLInputElement).disabled ||
                            src.includes("_d.") ||
                            btn.getAttribute("disabled") !== null ||
                            btn.classList.contains("disabled");
                        if (!disabled) {
                            nextBtn = btn;
                            break;
                        }
                    }
                }

                if (!nextBtn) return false;
                nextBtn.click();

                // 4. Poll until the visible course dataset mutates to a new set of records
                for (let i = 0; i < 20; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    const currentDocs = getDocs(window);
                    const codesAfter: string[] = [];
                    for (const doc of currentDocs) {
                        const tables = doc.querySelectorAll("table");
                        for (const tbl of tables) {
                            const trs = tbl.querySelectorAll("tr");
                            for (let r = 0; r < trs.length; r++) {
                                const txt = toEn(
                                    trs[r]?.querySelector("td, th")?.textContent ?? "",
                                ).trim();
                                const m = txt.match(/\d{4,10}[_\-\/\u2044\u2215\uFF0F]\d+/);
                                if (m) {
                                    codesAfter.push(m[0]);
                                }
                            }
                        }
                    }
                    const snapshotAfter = codesAfter.join(",");
                    if (snapshotAfter && snapshotAfter !== snapshotBefore) {
                        return true; // The page content changed successfully
                    }
                }
                return false; // No content change after timeout -> reached end of report
            },
        });
        return (result?.result as boolean) ?? false;
    } catch {
        return false;
    }
}

/**
 * Injects a click on the previous-page control inside the Commander frame.
 */
export async function navigateGolestanPrev(tabId: number): Promise<boolean> {
    try {
        const [result] = await browser.scripting.executeScript({
            target: { tabId },
            func: async () => {
                function toEn(str: unknown): string {
                    return String(str ?? "").replace(/[۰-۹]/g, (d: string) =>
                        String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
                    );
                }
                function getDocs(win: Window): Document[] {
                    let docs: Document[] = [];
                    try {
                        const facArea = win.document?.getElementById("FacArea");
                        if (facArea && facArea.children.length > 0) {
                            const divs = Array.from(facArea.children) as HTMLElement[];
                            const visibleDivs = divs.filter(
                                (d) =>
                                    d.style.display !== "none" && d.style.visibility !== "hidden",
                            );
                            visibleDivs.sort((a, b) => {
                                const zA = parseInt(a.style.zIndex || "0", 10);
                                const zB = parseInt(b.style.zIndex || "0", 10);
                                return zB - zA;
                            });
                            const activeIframe = visibleDivs[0]?.querySelector("iframe");
                            if (activeIframe && activeIframe.contentWindow) {
                                return getDocs(activeIframe.contentWindow);
                            }
                        }
                    } catch { }

                    try {
                        if (win && win.document) docs.push(win.document);
                    } catch { }
                    try {
                        if (win && win.frames) {
                            for (let i = 0; i < win.frames.length; i++) {
                                docs = docs.concat(getDocs(win.frames[i] as Window));
                            }
                        }
                    } catch { }
                    return docs;
                }

                const docs = getDocs(window);
                // 1. Gather a snapshot fingerprint of all course codes currently visible on the page
                const codesBefore: string[] = [];
                for (const doc of docs) {
                    const tables = doc.querySelectorAll("table");
                    for (const tbl of tables) {
                        const trs = tbl.querySelectorAll("tr");
                        for (let r = 0; r < trs.length; r++) {
                            const txt = toEn(
                                trs[r]?.querySelector("td, th")?.textContent ?? "",
                            ).trim();
                            const m = txt.match(/\d{4,10}[_\-\/\u2044\u2215\uFF0F]\d+/);
                            if (m) {
                                codesBefore.push(m[0]);
                            }
                        }
                    }
                }
                const snapshotBefore = codesBefore.join(",");

                // 2. Check page counter if rendered in Commander or Form frame (e.g. "صفحه 3 از 15")
                for (const doc of docs) {
                    const txt = toEn(doc.body?.innerText ?? "");
                    const match = txt.match(/صفحه\s*(\d+)\s*از\s*(\d+)/);
                    if (match && match[1]) {
                        const currentP = parseInt(match[1], 10);
                        if (currentP <= 1) {
                            return false; // First page reached
                        }
                    }
                }

                // 3. Locate the active previous button (RTL: MoveRight)
                let prevBtn: HTMLElement | null = null;
                for (const doc of docs) {
                    const btn = doc.querySelector<HTMLInputElement | HTMLImageElement>(
                        '[title*="صفحه قبل"], [title*="صفحه قبلي"], [src*="MoveRight"]',
                    );
                    if (btn) {
                        const src = btn.getAttribute("src") || "";
                        const disabled =
                            (btn as HTMLInputElement).disabled ||
                            src.includes("_d.") ||
                            btn.getAttribute("disabled") !== null ||
                            btn.classList.contains("disabled");
                        if (!disabled) {
                            prevBtn = btn;
                            break;
                        }
                    }
                }

                if (!prevBtn) return false;
                prevBtn.click();

                // 4. Poll until the visible course dataset mutates to a new set of records
                for (let i = 0; i < 20; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    const currentDocs = getDocs(window);
                    const codesAfter: string[] = [];
                    for (const doc of currentDocs) {
                        const tables = doc.querySelectorAll("table");
                        for (const tbl of tables) {
                            const trs = tbl.querySelectorAll("tr");
                            for (let r = 0; r < trs.length; r++) {
                                const txt = toEn(
                                    trs[r]?.querySelector("td, th")?.textContent ?? "",
                                ).trim();
                                const m = txt.match(/\d{4,10}[_\-\/\u2044\u2215\uFF0F]\d+/);
                                if (m) {
                                    codesAfter.push(m[0]);
                                }
                            }
                        }
                    }
                    const snapshotAfter = codesAfter.join(",");
                    if (snapshotAfter && snapshotAfter !== snapshotBefore) {
                        return true; // The page content changed successfully
                    }
                }
                return false; // No content change after timeout -> reached end of report
            },
        });
        return (result?.result as boolean) ?? false;
    } catch {
        return false;
    }
}