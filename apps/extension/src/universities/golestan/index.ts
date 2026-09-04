import type { UniversityAdapter } from "../types";
import {
    scrapeGolestanOfferings,
    readGolestanPaging,
    navigateGolestanNext,
    navigateGolestanPrev,
} from "./scrape";

/**
 * Golestan comprehensive academic portal adapter.
 * Used by most state-run Iranian universities (including Lorestan University).
 */
export const golestan: UniversityAdapter = {
    id: "golestan",
    name: "سامانه جامع گلستان",
    detect: (url) => /golestan|lu\.ac\.ir|\/forms\/f0240|\/forms\/f\d+/i.test(url),

    scrape: scrapeGolestanOfferings,
    readPaging: readGolestanPaging,

    nextPageSelector: "",
    prevPageSelector: "",

    navigateNext: navigateGolestanNext,
    navigatePrev: navigateGolestanPrev,
};