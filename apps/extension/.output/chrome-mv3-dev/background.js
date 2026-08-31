var background = (function() {
	//#region \0rolldown/runtime.js
	var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
	//#endregion
	//#region ../../node_modules/.pnpm/wxt@0.21.4_esbuild@0.28.2_e_2dc64793a3b18a717ab037cfed8ce19d/node_modules/wxt/dist/utils/define-background.mjs
	function defineBackground(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region ../../node_modules/.pnpm/@wxt-dev+browser@0.2.7/node_modules/@wxt-dev/browser/src/index.mjs
	var browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
	//#endregion
	//#region ../../node_modules/.pnpm/wxt@0.21.4_esbuild@0.28.2_e_2dc64793a3b18a717ab037cfed8ce19d/node_modules/wxt/dist/browser.mjs
	/**
	* Contains the `browser` export which you should use to access the extension
	* APIs in your project:
	*
	* ```ts
	* import { browser } from 'wxt/browser';
	*
	* browser.runtime.onInstalled.addListener(() => {
	*   // ...
	* });
	* ```
	*
	* @module wxt/browser
	*/
	var browser = browser$1;
	//#endregion
	//#region src/lib/export-doc.ts
	/**
	* Merge freshly scraped rows into stored rows. Existing rows win on index
	* collision (re-scraping a page refreshes its rows instead of duplicating).
	* Rows without an index have no identity - they are dropped (they would all
	* collide on "" and collapse the whole page into one row).
	*/
	function mergeRows(stored, incoming) {
		const byIndex = /* @__PURE__ */ new Map();
		for (const row of stored) if (row.index) byIndex.set(row.index, row);
		let added = 0;
		let refreshed = 0;
		for (const row of incoming) {
			if (!row.index) continue;
			if (byIndex.has(row.index)) refreshed++;
			else added++;
			byIndex.set(row.index, row);
		}
		return {
			merged: [...byIndex.values()],
			added,
			refreshed
		};
	}
	//#endregion
	//#region src/universities/azad/scrape.ts
	function scrapeOfferingsFromPage() {
		function toEnglishDigits(text) {
			return text.replace(/[۰-۹٠-٩]/g, (ch) => {
				const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch);
				if (persian !== -1) return String(persian);
				return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
			});
		}
		/**
		* Unify Arabic/Persian homoglyphs. The target site writes headers with
		* Arabic ك/ي (كدرس، نظري، حداكر ظرفيت) while aliases and the registry use
		* Persian ک/ی - without this, every match silently fails.
		*/
		function unifyPersian(text) {
			return text.replace(/\u0643/g, "ک").replace(/\u064A/g, "ی").replace(/\u0649/g, "ی");
		}
		function cleanText(text) {
			return unifyPersian(toEnglishDigits(text.replace(/\s+/g, " ")).replace(/\u00a0/g, " ")).trim();
		}
		/** Header normalization: drop ZWNJ, punctuation, collapse spaces. */
		function normalizeHeader(text) {
			return cleanText(text).replace(/[\u200c\u200f\u200e]/g, "").replace(/[«»()\-_/]/g, "").replace(/\s+/g, " ").trim();
		}
		const FIELD_ALIASES = [
			["courseCode", ["کد درس"]],
			["courseName", ["نام درس", "عنوان درس"]],
			["courseType", ["نوع درس"]],
			["theoreticalUnits", ["تعداد واحد نظری", "واحد نظری"]],
			["practicalUnits", ["تعداد واحد عملی", "واحد عملی"]],
			["classCode", [
				"کد ارائه کلاس درس",
				"کد ارائه",
				"کد کلاس",
				"گروه درس",
				"شماره کلاس"
			]],
			["degree", ["مقطع", "درجه"]],
			["presentationType", ["نوع ارائه"]],
			["minCapacity", ["حداقل ظرفیت"]],
			["maxCapacity", ["حداکثر ظرفیت"]],
			["currentEnrollment", [
				"ثبت نام",
				"ثبت نام شده",
				"ظرفیت پر"
			]],
			["classSchedule", [
				"زمانبندی تشکیل کلاس",
				"زمان تشکیل کلاس",
				"ساعات کلاس"
			]],
			["examSchedule", ["زمان امتحان"]],
			["professor", ["استاد", "نام استاد"]],
			["location", [
				"مکان برگزاری",
				"مکان",
				"محل تشکیل",
				"محل کلاس"
			]]
		];
		const totalFields = FIELD_ALIASES.length;
		const headers = Array.from(document.querySelectorAll("tr th")).map((th) => cleanText(th.textContent ?? ""));
		const headerByField = /* @__PURE__ */ new Map();
		const claimedHeaders = /* @__PURE__ */ new Set();
		for (const [field, aliases] of FIELD_ALIASES) {
			let bestIdx = -1;
			let bestScore = 0;
			headers.forEach((header, idx) => {
				if (claimedHeaders.has(idx) || !header) return;
				const norm = normalizeHeader(header);
				for (const alias of aliases) if (norm === alias) {
					if (bestScore < 3) {
						bestScore = 3;
						bestIdx = idx;
					}
				} else if (norm.includes(alias) && bestScore < 2) {
					bestScore = 2;
					bestIdx = idx;
				} else if (alias.includes(norm) && norm.length >= 3 && bestScore < 1) {
					bestScore = 1;
					bestIdx = idx;
				}
			});
			if (bestIdx !== -1) {
				headerByField.set(field, bestIdx);
				claimedHeaders.add(bestIdx);
			}
		}
		function cell(cells, field) {
			const idx = headerByField.get(field);
			return idx === void 0 ? "" : cleanText(cells[idx]?.textContent ?? "");
		}
		const PERSIAN_DAYS = [
			"شنبه",
			"یکشنبه",
			"دوشنبه",
			"سه شنبه",
			"چهارشنبه",
			"پنج شنبه",
			"جمعه"
		];
		function extractFirstSchedule(scheduleText) {
			if (!scheduleText) return "";
			const cleaned = unifyPersian(scheduleText).replace(/[\u200c]/g, " ").replace(/\s+/g, " ");
			for (const day of PERSIAN_DAYS) {
				const pattern = new RegExp(`${day}\\s*(?:از)?\\s*\\d{1,2}:\\d{2}\\s*تا\\s*\\d{1,2}:\\d{2}`);
				const match = cleaned.match(pattern);
				if (match) return match[0];
			}
			return cleaned;
		}
		function toInt(value) {
			if (!value) return null;
			const normalized = value.replace(/[,،\s]/g, "");
			return /^\d+$/.test(normalized) ? Number(normalized) : null;
		}
		const rows = [];
		const seenIndexes = /* @__PURE__ */ new Set();
		let duplicateCount = 0;
		document.querySelectorAll("tr.even, tr.odd").forEach((row) => {
			const cells = row.querySelectorAll("td");
			if (cells.length === 0) return;
			const courseCode = cell(cells, "courseCode");
			const classCode = cell(cells, "classCode");
			const index = [courseCode, classCode].filter(Boolean).join("-");
			if (seenIndexes.has(index)) {
				duplicateCount++;
				return;
			}
			seenIndexes.add(index);
			rows.push({
				index,
				courseCode,
				courseName: cell(cells, "courseName"),
				courseType: cell(cells, "courseType") || null,
				theoreticalUnits: toInt(cell(cells, "theoreticalUnits")) ?? 0,
				practicalUnits: toInt(cell(cells, "practicalUnits")) ?? 0,
				classCode,
				degree: cell(cells, "degree"),
				presentationType: cell(cells, "presentationType") || null,
				minCapacity: toInt(cell(cells, "minCapacity")),
				maxCapacity: toInt(cell(cells, "maxCapacity")),
				currentEnrollment: toInt(cell(cells, "currentEnrollment")),
				classSchedule: extractFirstSchedule(cell(cells, "classSchedule")) || null,
				examSchedule: cell(cells, "examSchedule") || null,
				professor: cell(cells, "professor") || null,
				location: cell(cells, "location") || null
			});
		});
		const pagingText = toEnglishDigits(document.querySelector(".paging")?.textContent ?? "").replace(/\s+/g, " ");
		const pageMatch = /(\d+)\s*تا\s*(\d+)\s*از\s*(\d+)/.exec(pagingText);
		const totalFromSpan = Number(document.querySelector("#totalSearchCount")?.textContent?.trim() ?? "");
		const nextBtn = document.querySelector("span#nextPage button");
		const prevBtn = document.querySelector("span#prePage button");
		return {
			rows,
			matchedFields: headerByField.size,
			totalFields,
			duplicateCount,
			paging: {
				totalRecords: pageMatch ? Number(pageMatch[3]) : Number.isFinite(totalFromSpan) && totalFromSpan > 0 ? totalFromSpan : null,
				from: pageMatch ? Number(pageMatch[1]) : null,
				to: pageMatch ? Number(pageMatch[2]) : null,
				hasNext: nextBtn !== null && !nextBtn.disabled,
				hasPrev: prevBtn !== null && !prevBtn.disabled
			},
			pageTitle: document.title,
			pageUrl: location.href
		};
	}
	//#endregion
	//#region src/universities/azad/replace-menu.ts
	/**
	* Ported 1:1 from the legacy extension's `replaceMenu.ts` (same element
	* discovery - including shadow DOM and iframes - same HTML structure, same
	* data-commandurl values, same handleUrl/gotoUrl wiring, same one-shot
	* MutationObserver).
	*
	* NOTE: the legacy file's Persian labels were destroyed by an encoding loss
	* before the initial commit (every letter became '?'). The labels below are
	* reconstructed; every URL/command attribute is byte-identical to the
	* original. Labels are cosmetic - behavior comes from data-commandurl.
	*
	* Self-contained: injected via browser.scripting.executeScript, so it must
	* not close over any import.
	*/
	function replaceMainMenu() {
		function findMainMenu() {
			let mainMenuDiv = document.getElementById("mainmenu");
			if (!mainMenuDiv) document.querySelectorAll("*").forEach((el) => {
				if (el.shadowRoot) {
					const shadowElement = el.shadowRoot.getElementById("mainmenu");
					if (shadowElement) mainMenuDiv = shadowElement;
				}
			});
			if (!mainMenuDiv) document.querySelectorAll("iframe").forEach((iframe) => {
				try {
					const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
					if (iframeDoc) {
						const iframeElement = iframeDoc.getElementById("mainmenu");
						if (iframeElement) mainMenuDiv = iframeElement;
					}
				} catch {}
			});
			return mainMenuDiv;
		}
		function replaceElement() {
			const mainMenuDiv = findMainMenu();
			if (mainMenuDiv) {
				const newElement = document.createElement("div");
				newElement.innerHTML = `
      <div id="mainmenu" dojotype="itorbit.ui.TestMenu" singleopeneditem="false" dir="rtl" widgetid="mainmenu">




      <link href="/EServices/js/menu/menu.css" type="text/css" rel="stylesheet">

      <form name="itoForm" method="post" action="/EServices/startAction.do" onsubmit="return false" target="_top"><input type="hidden" name="org.apache.struts.taglib.html.TOKEN" value="8ba9ee466905a1aad6d7761ff267ea23">

      <input type="text" id="autoCompleteBox" placeholder="جستجوی درس..." class="myautocompl ui-autocomplete-input" autocomplete="off" role="textbox" aria-autocomplete="list" aria-haspopup="true">
          <script type="text/javascript">
              $(function () {
                  $("#autoCompleteBox").farsiInput();
              });
          <\/script>
      <ul class="l1">

      <li class="l1 current"><strong><span>جستجوی کلاسهای ارائه شده ترم</span></strong><ul style="height: auto;">


      <li class="first"><a id="mi_0_0" style="background-image: url(Pages/images/icons/jostejooye-kelase-dars.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="handleCourseClassSearchAction.do?parameter%28menuItem%29=0_0&amp;dispatch=selectStudentParameter&amp;subject=CourseClass&amp;editable=false&amp;previewable=false&amp;parameter%28f%5EtermRef%29=%24%7BuserProperty%28operationalTerm.id%29%7D&amp;addable=false&amp;refParameter%28selectedText%29=parameter%28courseClassText%29&amp;form=CourseClassList2student&amp;selection=0&amp;parameter%28groupIndex%29=0&amp;deleteable=false&amp;parameter%28f%5EstudentRef%29=%24%7BuserProperty%28studentDto.id%29%7D&amp;parameter%28finder%29=findCourseClass4Student&amp;refParameter%28selectedId%29=parameter%28courseClassRef%29&amp;parameter(menuItem)=0_0&amp;parameter(groupIndex)=0&amp;__rp=1411137381&amp;menuGroup=Planning&amp;menuItemName=StudentCourseClassAllSearch&amp;_H0__=-7" onmouseover="null" onmouseout="null">
      <span>جستجوی کلاس درسهای ارائه شده</span></a></li>

      </ul></li>
      <li class="l1"><strong><span>ثبت نام دروس نیمسال جاری</span></strong><ul>



      <li class="first"><a id="mi_1_0" style="background-image: url(Pages/images/icons/moshahede-akharin-vazeyate-entekhab-vahed.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="confirmSelectStudentAction.do?parameter%28menuItem%29=1_0&amp;form=LastStatusConfirmStudentList&amp;parameter%28f%5EcurrentTerm%29=%24%7BuserProperty%28operationalTerm.id%29%7D&amp;parameter%28groupIndex%29=1&amp;subject=ConfirmStudent&amp;reset=true&amp;finder=findForLastStatusReport&amp;parameter(menuItem)=1_0&amp;parameter(groupIndex)=1&amp;__rp=1411137381&amp;menuGroup=Student_Registration&amp;menuItemName=LastStatus_Verification&amp;_H0__=130" onmouseover="null" onmouseout="null">
      <span>مشاهده آخرین وضعیت ثبت نام (ثبت نهایی)</span></a></li>



      <li><a id="mi_1_1" style="background-image: url(Pages/images/icons/modiriyate-nimsalhaye-tahsili.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="studentLastStatusAction.do?parameter%28menuItem%29=1_1&amp;nextForward=%2FshowFormAction.do%3Fsubject%3DStdStatusForm4Student&amp;selection=1&amp;form=LaststdTermfromwbk4ExtendedStudentList&amp;parameter%28groupIndex%29=1&amp;parameter%28finder%29=findLaststudentTermfromworkbook&amp;selectForward=%2FshowFormAction.do%3Fsubject%3DStdStatusForm&amp;parameter%28menuItem%29=1_1&amp;parameter%28groupIndex%29=1&amp;__rp=1411137381&amp;menuGroup=Student_Registration&amp;menuItemName=StudentLastStatus&amp;_H0__=280" onmouseover="null" onmouseout="null">
      <span>مشاهده لیست نیمسالهای تحصیلی گذشته</span></a></li>



      <li><a id="mi_1_2" style="background-image: url(Pages/images/icons/doroose-ghabele-eraeh.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="atiehWalletEPaymentAction.do?parameter%28menuItem%29=1_2&amp;dispatch=goToWalletApp&amp;parameter%28groupIndex%29=1&amp;parameter%28menuItem%29=1_2&amp;parameter%28groupIndex%29=1&amp;newWindow=true&amp;__rp=1411137381&amp;menuGroup=Student_Registration&amp;menuItemName=Wallet&amp;_H0__=402" onmouseover="null" onmouseout="null">
      <span>کیف پول اپلیکیشن همراه</span></a></li>


      <li><a id="mi_1_3" style="background-image: url(Pages/images/icons/doroose-ghabele-eraeh.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="studentLastStatusAction.do?parameter%28menuItem%29=1_3&amp;nextForward=%2FhandleEPaymentAction.do%3Fdispatch%3DshowAllPayments&amp;selection=1&amp;form=LaststdTermfromwbk4ExtendedStudentList&amp;parameter%28groupIndex%29=1&amp;parameter%28finder%29=find4Manage&amp;parameter%28menuItem%29=1_3&amp;parameter%28groupIndex%29=1&amp;__rp=1411137381&amp;menuGroup=Student_Registration&amp;menuItemName=StudentRequirements4Payment&amp;_H0__=268" onmouseover="null" onmouseout="null">
      <span>پرداخت اقساط</span></a></li>



      <li><a id="mi_1_4" style="background-image: url(Pages/images/icons/modiriyate-nimsalhaye-tahsili.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="studentLastStatusAction.do?parameter%28menuItem%29=1_4&amp;termRef=%24%7BuserProperty%28operationalTerm.id%29%7D&amp;nextForward=%2FshowFormAction.do%3Fsubject%3DstudentRegCourseForm4Objection&amp;selection=0&amp;form=StudentList4CurrentObjection&amp;parameter%28groupIndex%29=1&amp;parameter%28finder%29=findByCondition&amp;checkDebitOperation=showGrades&amp;parameter%28menuItem%29=1_4&amp;parameter%28groupIndex%29=1&amp;__rp=1411137381&amp;menuGroup=Evaluation&amp;menuItemName=ObjectionGradeCurrent&amp;_H0__=56" onmouseover="null" onmouseout="null">
      <span>مشاهده وضعیت اعتراض به نمره در ترم جاری</span></a></li>



      <li><a id="mi_1_5" style="background-image: url(Pages/images/icons/information.gif)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="studentLastStatusAction.do?parameter%28menuItem%29=1_5&amp;nextForward=%2FshowPageAction.do%3Fpage%3D%2FPages%2Foffice%2FstudentRequest.jsp&amp;selection=0&amp;form=StudentList4Activities&amp;parameter%28groupIndex%29=1&amp;parameter%28finder%29=findByCondition&amp;parameter%28menuItem%29=1_5&amp;parameter%28groupIndex%29=1&amp;__rp=1411137381&amp;menuGroup=Office&amp;menuItemName=StudentEducationalActivities&amp;_H0__=242" onmouseover="null" onmouseout="null">
      <span>فعالیت های آموزشی دانشجو</span></a></li>



      <li><a id="mi_1_6" style="background-image: url(Pages/images/icons/moshahede-karname-daneshjooei.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="LoadWorkSheetAction.do?dispatch=View&amp;parameter%28menuItem%29=1_6&amp;parameter%28flag%29=false&amp;parameter%28groupIndex%29=1&amp;subject=LoadStudentWorkBook&amp;studentRequest=true&amp;parameter%28menuItem%29=1_6&amp;parameter%28groupIndex%29=1&amp;__rp=1411137381&amp;menuGroup=Student_Registration&amp;menuItemName=ViewStudentWorkBook&amp;_H0__=747" onmouseover="null" onmouseout="null">
      <span>مشاهده کارنامه دانشجویی</span></a></li>

      </ul></li>
      <li class="l1"><strong><span>صندوق رفاه دانشجویی</span></strong><ul>



      <li class="first"><a id="mi_2_0" style="background-image: url(Pages/images/icons/noIcon.gif)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="studentLastStatusAction.do?parameter%28menuItem%29=2_0&amp;nextForward=%2FshowFormAction.do%3Fsubject%3DStdLoanForm&amp;selection=0&amp;form=StudentList4LoanRequest&amp;parameter%28groupIndex%29=2&amp;need2SetViewableSubjectAttribute=true&amp;parameter%28finder%29=findByCondition&amp;requestSubjectCategory=LOAN&amp;parameter%28menuItem%29=2_0&amp;parameter%28groupIndex%29=2&amp;__rp=1411137381&amp;menuGroup=StudentWelfareFund&amp;menuItemName=StudentLoanRequest&amp;_H0__=269" onmouseover="null" onmouseout="null">
      <span>وام/استخدام دانشجویی</span></a></li>

      </ul></li>
      <li class="l1"><strong><span>درخواست مدارک دانشجو</span></strong><ul>

      <li class="first"><a id="mi_3_0" style="background-image: url(Pages/images/icons/noIcon.gif)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="studentLastStatusAction.do?parameter%28menuItem%29=3_0&amp;nextForward=%2FshowFormAction.do%3Fsubject%3DStdAlumniDocForm&amp;selection=0&amp;form=StudentList4AlumniDocRequest&amp;parameter%28groupIndex%29=3&amp;need2SetViewableSubjectAttribute=true&amp;requestSubjectDispatchType=CREATE_ALUMNI_RECORD&amp;parameter%28finder%29=findByCondition&amp;parameter%28menuItem%29=3_0&amp;parameter%28groupIndex%29=3&amp;__rp=1411137381&amp;menuGroup=AlumniRecord&amp;menuItemName=StudentAlumniRecordRequest&amp;_H0__=213" onmouseover="null" onmouseout="null">
      <span>ثبت/پیگیری درخواست مدارک فارغ التحصیل</span></a></li>

      </ul></li>
      <li class="l1"><strong><span>درخواست/سایر</span></strong><ul>

      <li class="first"><a id="mi_4_0" style="background-image: url(Pages/images/icons/sabte-darkhast.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="studentLastStatusAction.do?parameter%28menuItem%29=4_0&amp;nextForward=%2FshowPageAction.do%3Fpage%3D%2FPages%2Foffice%2FstudentRequest.jsp&amp;selection=0&amp;form=StudentList4Request&amp;parameter%28groupIndex%29=4&amp;need2SetViewableSubjectAttribute=true&amp;parameter%28finder%29=findByCondition&amp;requestSubjectCategory=LOAN&amp;parameter%28menuItem%29=4_0&amp;parameter%28groupIndex%29=4&amp;__rp=1411137381&amp;menuGroup=Office&amp;menuItemName=StudentRequest&amp;_H0__=385" onmouseover="null" onmouseout="null">
      <span>ثبت/ پیگیری درخواست های اداری</span></a></li>

      </ul></li>
      <li class="l1"><strong><span>ارزشیابی استاد</span></strong><ul>

      <li class="first"><a id="mi_5_0" style="background-image: url(Pages/images/icons/modiriyate-nimsalhaye-tahsili.png)" href="javascript: void(0);" onclick="handleUrl(this)" data-commandurl="studentLastStatusAction.do?parameter%28menuItem%29=5_0&amp;termRef=%24%7BuserProperty%28operationalTerm.id%29%7D&amp;nextForward=%2FshowFormAction.do%3Fsubject%3DstudentRegCourseForm4Eval&amp;selection=0&amp;form=StudentList4CurrentEvaluation&amp;parameter%28groupIndex%29=5&amp;parameter%28finder%29=findByCondition&amp;parameter%28menuItem%29=5_0&amp;parameter%28groupIndex%29=5&amp;__rp=1411137381&amp;menuGroup=Evaluation&amp;menuItemName=EvaluationProffCurrent&amp;_H0__=109" onmouseover="null" onmouseout="null">
      <span>ارزشیابی استاد در ترم جاری</span></a></li>

      </ul></li></ul>
       <script type="text/javascript">
          function handleUrl(elem){
             // rightClick();
             //alert("handler called:\\n"+url);
             var cmd = elem.getAttribute("data-commandUrl");
              gotoUrl("itoForm",cmd);
              return false;
          }

        <\/script>
      </form>

      <script type="text/javascript" src="/EServices/js/menu/menu.js"><\/script>
      <script type="text/javascript" src="/EServices/js/PersianKeyboard/jquery.farsiInput.js"><\/script>
          </div>

      `;
				mainMenuDiv.parentNode?.replaceChild(newElement, mainMenuDiv);
			} else console.error("Element with ID \"mainmenu\" not found.");
		}
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", replaceElement);
		else replaceElement();
		const observer = new MutationObserver(() => {
			replaceElement();
			observer.disconnect();
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}
	//#endregion
	//#region src/universities/azad/index.ts
	/**
	* Islamic Azad University - the EServices (آموزشیار) student portal.
	* The same software is used by many Iranian universities, so the generic
	* fallback adapter reuses these functions.
	*/
	var azad = {
		id: "azad",
		name: "دانشگاه آزاد اسلامی",
		detect: (url) => /iau\.ir|eservices|amoozesh|sanjesh/i.test(url),
		scrape: scrapeOfferingsFromPage,
		readPaging: readAzadPaging,
		nextPageSelector: "span#nextPage button",
		prevPageSelector: "span#prePage button",
		replaceMenu: replaceMainMenu
	};
	/** Self-contained injected paging reader (ركورد X تا Y از Z). */
	function readAzadPaging() {
		function toEnglishDigits(text) {
			return text.replace(/[۰-۹٠-٩]/g, (ch) => {
				const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch);
				if (persian !== -1) return String(persian);
				return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
			});
		}
		const pagingText = toEnglishDigits(document.querySelector(".paging")?.textContent ?? "").replace(/\s+/g, " ");
		const match = /(\d+)\s*تا\s*(\d+)\s*از\s*(\d+)/.exec(pagingText);
		const totalFromSpan = Number(document.querySelector("#totalSearchCount")?.textContent?.trim() ?? "");
		const nextBtn = document.querySelector("span#nextPage button");
		const prevBtn = document.querySelector("span#prePage button");
		return {
			totalRecords: match ? Number(match[3]) : Number.isFinite(totalFromSpan) && totalFromSpan > 0 ? totalFromSpan : null,
			from: match ? Number(match[1]) : null,
			to: match ? Number(match[2]) : null,
			hasNext: nextBtn !== null && !nextBtn.disabled,
			hasPrev: prevBtn !== null && !prevBtn.disabled
		};
	}
	//#endregion
	//#region src/universities/index.ts
	/**
	* Registry of supported university portals. Add new universities as a folder
	* under src/universities/<id>/ and list the adapter here - first match wins,
	* so put specific portals before the generic fallback.
	*/
	var UNIVERSITIES = [azad];
	/** Structural fallback: the azad scraper is table-driven and works on any
	*  آموزشیار-style portal, so unknown hosts still extract fine. */
	var generic = {
		id: "generic",
		name: "سایت ناشناس (حالت عمومی)",
		detect: () => true,
		scrape: scrapeOfferingsFromPage,
		readPaging: readAzadPaging,
		nextPageSelector: "span#nextPage button",
		prevPageSelector: "span#prePage button"
	};
	function getUniversityAdapter(id) {
		return UNIVERSITIES.find((u) => u.id === id) ?? generic;
	}
	//#endregion
	//#region ../../node_modules/.pnpm/superlock@1.3.5/node_modules/superlock/src/create.js
	var require_create = /* @__PURE__ */ __commonJSMin(((exports, module) => {
		var Node = class {
			constructor(data) {
				this.data = data;
			}
		};
		var LinkedList = class {
			constructor() {
				this.length = 0;
			}
			enqueue(data) {
				const node = new Node(data);
				node.prev = this.tail;
				if (this.tail) this.tail.next = node;
				else this.head = node;
				this.tail = node;
				this.length++;
				return node;
			}
			dequeue() {
				if (!this.head) return;
				const { data } = this.head;
				this.remove(this.head);
				return data;
			}
			remove(node) {
				if (node.prev) node.prev.next = node.next;
				else this.head = node.next;
				if (node.next) node.next.prev = node.prev;
				else this.tail = node.prev;
				this.length--;
			}
			size() {
				return this.length;
			}
		};
		module.exports = (slots = 1) => {
			const queue = new LinkedList();
			const release = () => {
				++slots;
				const waiter = queue.dequeue();
				if (waiter) return waiter.acquire();
			};
			const acquire = (resolve) => {
				--slots;
				resolve(release);
			};
			const lock = (signal) => new Promise((resolve) => {
				if (signal != null && typeof signal.addEventListener !== "function") throw new TypeError("`signal` needs to be an AbortSignal.");
				if (signal?.aborted) return resolve(null);
				if (!lock.isLocked()) return acquire(resolve);
				const waiter = { acquire: () => acquire(resolve) };
				const node = queue.enqueue(waiter);
				if (signal != null) {
					const onAbort = () => {
						queue.remove(node);
						resolve(null);
					};
					waiter.acquire = () => {
						signal.removeEventListener("abort", onAbort);
						acquire(resolve);
					};
					signal.addEventListener("abort", onAbort, { once: true });
				}
			});
			lock.isLocked = () => slots === 0;
			lock.awaiting = () => queue.size();
			return lock;
		};
	}));
	//#endregion
	//#region ../../node_modules/.pnpm/@wxt-dev+storage@1.2.9/node_modules/@wxt-dev/storage/dist/index.mjs
	var import_src = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
		var createLock = require_create();
		var withLock = (opts) => {
			const lock = createLock(opts);
			const withLock = async (fn, signal) => {
				const release = await lock(signal);
				if (!release) return;
				try {
					return await fn();
				} finally {
					release();
				}
			};
			withLock.isLocked = lock.isLocked;
			withLock.awaiting = lock.awaiting;
			return withLock;
		};
		module.exports = {
			withLock,
			createLock
		};
	})))();
	var has = Object.prototype.hasOwnProperty;
	function dequal(foo, bar) {
		var ctor, len;
		if (foo === bar) return true;
		if (foo && bar && (ctor = foo.constructor) === bar.constructor) {
			if (ctor === Date) return foo.getTime() === bar.getTime();
			if (ctor === RegExp) return foo.toString() === bar.toString();
			if (ctor === Array) {
				if ((len = foo.length) === bar.length) while (len-- && dequal(foo[len], bar[len]));
				return len === -1;
			}
			if (!ctor || typeof foo === "object") {
				len = 0;
				for (ctor in foo) {
					if (has.call(foo, ctor) && ++len && !has.call(bar, ctor)) return false;
					if (!(ctor in bar) || !dequal(foo[ctor], bar[ctor])) return false;
				}
				return Object.keys(bar).length === len;
			}
		}
		return foo !== foo && bar !== bar;
	}
	/**
	* Simplified storage APIs with support for versioned fields, snapshots,
	* metadata, and item definitions.
	*
	* See [the guide](https://wxt.dev/storage.html) for more information.
	*
	* @module @wxt-dev/storage
	*/
	var storage = createStorage();
	function createStorage() {
		const drivers = {
			local: createDriver("local"),
			session: createDriver("session"),
			sync: createDriver("sync"),
			managed: createDriver("managed")
		};
		const getDriver = (area) => {
			const driver = drivers[area];
			if (driver == null) {
				const areaNames = Object.keys(drivers).join(", ");
				throw Error(`Invalid area "${area}". Options: ${areaNames}`);
			}
			return driver;
		};
		const resolveKey = (key) => {
			const deliminatorIndex = key.indexOf(":");
			const driverArea = key.substring(0, deliminatorIndex);
			const driverKey = key.substring(deliminatorIndex + 1);
			if (driverKey == null) throw Error(`Storage key should be in the form of "area:key", but received "${key}"`);
			return {
				driverArea,
				driverKey,
				driver: getDriver(driverArea)
			};
		};
		const getMetaKey = (key) => key + "$";
		const mergeMeta = (oldMeta, newMeta) => {
			const newFields = { ...oldMeta };
			Object.entries(newMeta).forEach(([key, value]) => {
				if (value == null) delete newFields[key];
				else newFields[key] = value;
			});
			return newFields;
		};
		const getValueOrFallback = (value, fallback) => value ?? fallback ?? null;
		const getMetaValue = (properties) => typeof properties === "object" && !Array.isArray(properties) ? properties : {};
		const getItem = async (driver, driverKey, opts) => {
			return getValueOrFallback(await driver.getItem(driverKey), opts?.fallback ?? opts?.defaultValue);
		};
		const getMeta = async (driver, driverKey) => {
			const metaKey = getMetaKey(driverKey);
			return getMetaValue(await driver.getItem(metaKey));
		};
		const setItem = async (driver, driverKey, value) => {
			await driver.setItem(driverKey, value ?? null);
		};
		const setMeta = async (driver, driverKey, properties) => {
			const metaKey = getMetaKey(driverKey);
			const existingFields = getMetaValue(await driver.getItem(metaKey));
			await driver.setItem(metaKey, mergeMeta(existingFields, properties));
		};
		const removeItem = async (driver, driverKey, opts) => {
			await driver.removeItem(driverKey);
			if (opts?.removeMeta) {
				const metaKey = getMetaKey(driverKey);
				await driver.removeItem(metaKey);
			}
		};
		const removeMeta = async (driver, driverKey, properties) => {
			const metaKey = getMetaKey(driverKey);
			if (properties == null) await driver.removeItem(metaKey);
			else {
				const newFields = getMetaValue(await driver.getItem(metaKey));
				[properties].flat().forEach((field) => delete newFields[field]);
				await driver.setItem(metaKey, newFields);
			}
		};
		const watch = (driver, driverKey, cb) => driver.watch(driverKey, cb);
		return {
			getItem: async (key, opts) => {
				const { driver, driverKey } = resolveKey(key);
				return await getItem(driver, driverKey, opts);
			},
			getItems: async (keys) => {
				const areaToKeyMap = /* @__PURE__ */ new Map();
				const keyToOptsMap = /* @__PURE__ */ new Map();
				const orderedKeys = [];
				keys.forEach((key) => {
					let keyStr;
					let opts;
					if (typeof key === "string") keyStr = key;
					else if ("getValue" in key) {
						keyStr = key.key;
						opts = { fallback: key.fallback };
					} else {
						keyStr = key.key;
						opts = key.options;
					}
					orderedKeys.push(keyStr);
					const { driverArea, driverKey } = resolveKey(keyStr);
					const areaKeys = areaToKeyMap.get(driverArea) ?? [];
					areaToKeyMap.set(driverArea, areaKeys.concat(driverKey));
					keyToOptsMap.set(keyStr, opts);
				});
				const resultsMap = /* @__PURE__ */ new Map();
				await Promise.all(Array.from(areaToKeyMap.entries()).map(async ([driverArea, keys]) => {
					(await drivers[driverArea].getItems(keys)).forEach((driverResult) => {
						const key = `${driverArea}:${driverResult.key}`;
						const opts = keyToOptsMap.get(key);
						const value = getValueOrFallback(driverResult.value, opts?.fallback ?? opts?.defaultValue);
						resultsMap.set(key, value);
					});
				}));
				return orderedKeys.map((key) => ({
					key,
					value: resultsMap.get(key)
				}));
			},
			getMeta: async (key) => {
				const { driver, driverKey } = resolveKey(key);
				return await getMeta(driver, driverKey);
			},
			getMetas: async (args) => {
				const keys = args.map((arg) => {
					const key = typeof arg === "string" ? arg : arg.key;
					const { driverArea, driverKey } = resolveKey(key);
					return {
						key,
						driverArea,
						driverKey,
						driverMetaKey: getMetaKey(driverKey)
					};
				});
				const areaToDriverMetaKeysMap = keys.reduce((map, key) => {
					map[key.driverArea] ??= [];
					map[key.driverArea].push(key);
					return map;
				}, {});
				const resultsMap = {};
				await Promise.all(Object.entries(areaToDriverMetaKeysMap).map(async ([area, keys]) => {
					const areaRes = await browser$1.storage[area].get(keys.map((key) => key.driverMetaKey));
					keys.forEach((key) => {
						resultsMap[key.key] = areaRes[key.driverMetaKey] ?? {};
					});
				}));
				return keys.map((key) => ({
					key: key.key,
					meta: resultsMap[key.key]
				}));
			},
			setItem: async (key, value) => {
				const { driver, driverKey } = resolveKey(key);
				await setItem(driver, driverKey, value);
			},
			setItems: async (items) => {
				const areaToKeyValueMap = {};
				items.forEach((item) => {
					const { driverArea, driverKey } = resolveKey("key" in item ? item.key : item.item.key);
					areaToKeyValueMap[driverArea] ??= [];
					areaToKeyValueMap[driverArea].push({
						key: driverKey,
						value: item.value
					});
				});
				await Promise.all(Object.entries(areaToKeyValueMap).map(async ([driverArea, values]) => {
					await getDriver(driverArea).setItems(values);
				}));
			},
			setMeta: async (key, properties) => {
				const { driver, driverKey } = resolveKey(key);
				await setMeta(driver, driverKey, properties);
			},
			setMetas: async (items) => {
				const areaToMetaUpdatesMap = {};
				items.forEach((item) => {
					const { driverArea, driverKey } = resolveKey("key" in item ? item.key : item.item.key);
					areaToMetaUpdatesMap[driverArea] ??= [];
					areaToMetaUpdatesMap[driverArea].push({
						key: driverKey,
						properties: item.meta
					});
				});
				await Promise.all(Object.entries(areaToMetaUpdatesMap).map(async ([storageArea, updates]) => {
					const driver = getDriver(storageArea);
					const metaKeys = updates.map(({ key }) => getMetaKey(key));
					const existingMetas = await driver.getItems(metaKeys);
					const existingMetaMap = Object.fromEntries(existingMetas.map(({ key, value }) => [key, getMetaValue(value)]));
					const metaUpdates = updates.map(({ key, properties }) => {
						const metaKey = getMetaKey(key);
						return {
							key: metaKey,
							value: mergeMeta(existingMetaMap[metaKey] ?? {}, properties)
						};
					});
					await driver.setItems(metaUpdates);
				}));
			},
			removeItem: async (key, opts) => {
				const { driver, driverKey } = resolveKey(key);
				await removeItem(driver, driverKey, opts);
			},
			removeItems: async (keys) => {
				const areaToKeysMap = {};
				keys.forEach((key) => {
					let keyStr;
					let opts;
					if (typeof key === "string") keyStr = key;
					else if ("getValue" in key) keyStr = key.key;
					else if ("item" in key) {
						keyStr = key.item.key;
						opts = key.options;
					} else {
						keyStr = key.key;
						opts = key.options;
					}
					const { driverArea, driverKey } = resolveKey(keyStr);
					areaToKeysMap[driverArea] ??= [];
					areaToKeysMap[driverArea].push(driverKey);
					if (opts?.removeMeta) areaToKeysMap[driverArea].push(getMetaKey(driverKey));
				});
				await Promise.all(Object.entries(areaToKeysMap).map(async ([driverArea, keys]) => {
					await getDriver(driverArea).removeItems(keys);
				}));
			},
			clear: async (base) => {
				await getDriver(base).clear();
			},
			removeMeta: async (key, properties) => {
				const { driver, driverKey } = resolveKey(key);
				await removeMeta(driver, driverKey, properties);
			},
			snapshot: async (base, opts) => {
				const data = await getDriver(base).snapshot();
				opts?.excludeKeys?.forEach((key) => {
					delete data[key];
					delete data[getMetaKey(key)];
				});
				return data;
			},
			restoreSnapshot: async (base, data) => {
				await getDriver(base).restoreSnapshot(data);
			},
			watch: (key, cb) => {
				const { driver, driverKey } = resolveKey(key);
				return watch(driver, driverKey, cb);
			},
			unwatch() {
				Object.values(drivers).forEach((driver) => {
					driver.unwatch();
				});
			},
			defineItem: (key, opts) => {
				const { driver, driverKey } = resolveKey(key);
				const { version: targetVersion = 1, migrations = {}, onMigrationComplete, debug = false } = opts ?? {};
				if (targetVersion < 1) throw Error("Storage item version cannot be less than 1. Initial versions should be set to 1, not 0.");
				let needsVersionSet = false;
				const migrate = async () => {
					const driverMetaKey = getMetaKey(driverKey);
					const [{ value }, { value: meta }] = await driver.getItems([driverKey, driverMetaKey]);
					needsVersionSet = value == null && meta?.v == null && !!targetVersion;
					if (value == null) return;
					const currentVersion = meta?.v ?? 1;
					if (currentVersion > targetVersion) throw Error(`Version downgrade detected (v${currentVersion} -> v${targetVersion}) for "${key}"`);
					if (currentVersion === targetVersion) return;
					if (debug) console.debug(`[@wxt-dev/storage] Running storage migration for ${key}: v${currentVersion} -> v${targetVersion}`);
					const migrationsToRun = Array.from({ length: targetVersion - currentVersion }, (_, i) => currentVersion + i + 1);
					let migratedValue = value;
					for (const migrateToVersion of migrationsToRun) try {
						migratedValue = await migrations?.[migrateToVersion]?.(migratedValue) ?? migratedValue;
						if (debug) console.debug(`[@wxt-dev/storage] Storage migration processed for version: v${migrateToVersion}`);
					} catch (err) {
						throw new MigrationError(key, migrateToVersion, { cause: err });
					}
					await driver.setItems([{
						key: driverKey,
						value: migratedValue
					}, {
						key: driverMetaKey,
						value: {
							...meta,
							v: targetVersion
						}
					}]);
					if (debug) console.debug(`[@wxt-dev/storage] Storage migration completed for ${key} v${targetVersion}`, { migratedValue });
					onMigrationComplete?.(migratedValue, targetVersion);
				};
				const migrationsDone = opts?.migrations == null ? Promise.resolve() : migrate().catch((err) => {
					console.error(`[@wxt-dev/storage] Migration failed for ${key}`, err);
				});
				const initLock = (0, import_src.withLock)();
				const getFallback = () => opts?.fallback ?? opts?.defaultValue ?? null;
				const getOrInitValue = () => initLock(async () => {
					const value = await driver.getItem(driverKey);
					if (value != null || opts?.init == null) return value;
					const newValue = await opts.init();
					await driver.setItem(driverKey, newValue);
					if (value == null && targetVersion > 1) await setMeta(driver, driverKey, { v: targetVersion });
					return newValue;
				});
				migrationsDone.then(getOrInitValue);
				return {
					key,
					get defaultValue() {
						return getFallback();
					},
					get fallback() {
						return getFallback();
					},
					getValue: async () => {
						await migrationsDone;
						if (opts?.init) return await getOrInitValue();
						else return await getItem(driver, driverKey, opts);
					},
					getMeta: async () => {
						await migrationsDone;
						return await getMeta(driver, driverKey);
					},
					setValue: async (value) => {
						await migrationsDone;
						if (needsVersionSet) {
							needsVersionSet = false;
							await Promise.all([setItem(driver, driverKey, value), setMeta(driver, driverKey, { v: targetVersion })]);
						} else await setItem(driver, driverKey, value);
					},
					setMeta: async (properties) => {
						await migrationsDone;
						return await setMeta(driver, driverKey, properties);
					},
					removeValue: async (opts) => {
						await migrationsDone;
						return await removeItem(driver, driverKey, opts);
					},
					removeMeta: async (properties) => {
						await migrationsDone;
						return await removeMeta(driver, driverKey, properties);
					},
					watch: (cb) => watch(driver, driverKey, (newValue, oldValue) => cb(newValue ?? getFallback(), oldValue ?? getFallback())),
					migrate
				};
			}
		};
	}
	function createDriver(storageArea) {
		const getStorageArea = () => {
			if (browser$1.runtime == null) throw Error(`'wxt/storage' must be loaded in a web extension environment

 - If thrown during a build, see https://github.com/wxt-dev/wxt/issues/371
 - If thrown during tests, mock 'wxt/browser' correctly. See https://wxt.dev/guide/go-further/testing.html
`);
			if (browser$1.storage == null) throw Error("You must add the 'storage' permission to your manifest to use 'wxt/storage'");
			const area = browser$1.storage[storageArea];
			if (area == null) throw Error(`"browser.storage.${storageArea}" is undefined`);
			return area;
		};
		const watchListeners = /* @__PURE__ */ new Set();
		return {
			getItem: async (key) => {
				return (await getStorageArea().get(key))[key];
			},
			getItems: async (keys) => {
				const result = await getStorageArea().get(keys);
				return keys.map((key) => ({
					key,
					value: result[key] ?? null
				}));
			},
			setItem: async (key, value) => {
				if (value == null) await getStorageArea().remove(key);
				else await getStorageArea().set({ [key]: value });
			},
			setItems: async (values) => {
				const map = values.reduce((map, { key, value }) => {
					map[key] = value;
					return map;
				}, {});
				await getStorageArea().set(map);
			},
			removeItem: async (key) => {
				await getStorageArea().remove(key);
			},
			removeItems: async (keys) => {
				await getStorageArea().remove(keys);
			},
			clear: async () => {
				await getStorageArea().clear();
			},
			snapshot: async () => {
				return await getStorageArea().get();
			},
			restoreSnapshot: async (data) => {
				await getStorageArea().set(data);
			},
			watch(key, cb) {
				const listener = (changes) => {
					const change = changes[key];
					if (change == null || dequal(change.newValue, change.oldValue)) return;
					cb(change.newValue ?? null, change.oldValue ?? null);
				};
				getStorageArea().onChanged.addListener(listener);
				watchListeners.add(listener);
				return () => {
					getStorageArea().onChanged.removeListener(listener);
					watchListeners.delete(listener);
				};
			},
			unwatch() {
				watchListeners.forEach((listener) => {
					getStorageArea().onChanged.removeListener(listener);
				});
				watchListeners.clear();
			}
		};
	}
	var MigrationError = class extends Error {
		constructor(key, version, options) {
			super(`v${version} migration failed for "${key}"`, options);
			this.key = key;
			this.version = version;
		}
	};
	//#endregion
	//#region src/lib/storage.ts
	var offeringsStorage = storage.defineItem("local:offerings", { fallback: [] });
	/** Survives service-worker restarts within the browser session. */
	var extractStateStorage = storage.defineItem("session:extractState", { fallback: null });
	/**
	* Dedicated stop flag - the loop rewrites `running: true` after every page,
	* so a stop request must not live inside the same document.
	*/
	var extractStopStorage = storage.defineItem("session:extractStop", { fallback: false });
	//#endregion
	//#region src/lib/extractor.ts
	/**
	* Drives multi-page extraction from the background worker.
	*
	* The target site does FULL page reloads for pagination (a form submit
	* re-renders everything, no URL change), so the injected function dies with
	* every page. Only the worker survives - it re-injects on each page:
	*
	*   rewind: click "صفحه قبل" until disabled  (user may start on page 3)
	*   collect: scrape -> auto-save -> click "صفحه بعد" -> wait -> ...
	*
	* Waiting is the tricky part: the tab's status stays "complete" for a moment
	* AFTER the click (the submit starts asynchronously), so waiting on tab
	* status alone resolves against the OLD page. Instead we fingerprint the
	* document with performance.timeOrigin - it changes when the new page's
	* document is created - and only then wait for its readyState.
	*
	* activeTab keeps the injection grant across same-origin navigations, which
	* paging always is.
	*/
	var LOAD_TIMEOUT_MS = 25e3;
	var POLL_INTERVAL_MS = 350;
	var SETTLE_DELAY_MS = 600;
	var StopSignal = class extends Error {
		constructor() {
			super("stopped");
			this.name = "StopSignal";
		}
	};
	var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	async function broadcast(event) {
		try {
			await browser.runtime.sendMessage(event);
		} catch {}
	}
	async function setState(state) {
		await extractStateStorage.setValue(state);
	}
	async function isStopped() {
		return extractStopStorage.getValue();
	}
	/** Friendly message for the two failure modes users actually hit. */
	function friendlyInjectError(raw) {
		if (/cannot access contents|cannot be scripted|chrome:\/\//i.test(raw)) return "این صفحه قابل اسکریپت نیست - روی صفحه لیست دروس (آموزشیار) باشید";
		if (/has not been invoked|activeTab/i.test(raw)) return "دسترسی به صفحه داده نشد - پنجره افزونه را روی همان صفحه باز کنید و دوباره تلاش کنید";
		return raw;
	}
	async function inject(tabId, func) {
		let result;
		try {
			const [entry] = await browser.scripting.executeScript({
				target: { tabId },
				func
			});
			result = entry?.result;
		} catch (error) {
			const raw = error instanceof Error ? error.message : String(error);
			throw new Error(friendlyInjectError(raw));
		}
		if (result === null || result === void 0) throw new Error("اسکریپت تزریق‌شده نتیجه‌ای برنگرداند - صفحه را دوباره باز کنید");
		return result;
	}
	/** Best-effort read - used for polling where a throw just means "not yet". */
	async function tryInject(tabId, func) {
		try {
			return await inject(tabId, func);
		} catch {
			return null;
		}
	}
	async function readDocState(tabId) {
		return tryInject(tabId, () => ({
			epoch: performance.timeOrigin,
			readyState: document.readyState
		}));
	}
	/**
	* Wait until the tab shows a NEW document (epoch differs from prevEpoch) and
	* that document finished loading. Falls back to the timeout on pathological
	* hosts so the loop always makes progress or fails loudly.
	*/
	async function waitForNewPage(tabId, prevEpoch) {
		const deadline = Date.now() + LOAD_TIMEOUT_MS;
		while (Date.now() < deadline) {
			if (await isStopped()) throw new StopSignal();
			const state = await readDocState(tabId);
			if (state && state.epoch !== prevEpoch) break;
			await sleep(POLL_INTERVAL_MS);
		}
		while (Date.now() < deadline) {
			const state = await readDocState(tabId);
			if (!state || state.readyState === "complete") break;
			await sleep(POLL_INTERVAL_MS);
		}
		await sleep(SETTLE_DELAY_MS);
	}
	async function clickPaginator(tabId, selector) {
		try {
			const [result] = await browser.scripting.executeScript({
				target: { tabId },
				func: (sel) => {
					const btn = document.querySelector(sel);
					if (!btn || btn.disabled) return false;
					btn.click();
					return true;
				},
				args: [selector]
			});
			return result?.result ?? false;
		} catch {
			return true;
		}
	}
	async function readPaging(tabId, readFn) {
		return await tryInject(tabId, readFn) ?? {
			totalRecords: null,
			from: null,
			to: null,
			hasNext: false,
			hasPrev: false
		};
	}
	async function runExtraction(tabId, universityId) {
		const adapter = getUniversityAdapter(universityId ?? "generic");
		if ((await extractStateStorage.getValue())?.running) {
			await broadcast({
				type: "EXTRACTION_ERROR",
				error: "استخراج در حال اجراست"
			});
			return;
		}
		await extractStopStorage.setValue(false);
		await setState({
			running: true,
			progress: null
		});
		await broadcast({
			type: "EXTRACTION_STARTED",
			tabId
		});
		let pages = 0;
		let totalDuplicateCount = 0;
		let lastProgress = null;
		try {
			const initialPaging = await readPaging(tabId, adapter.readPaging);
			const direction = !initialPaging.hasNext || initialPaging.to !== null && initialPaging.totalRecords !== null && initialPaging.to >= initialPaging.totalRecords ? "backward" : "forward";
			if (direction === "forward") {
				let paging = initialPaging;
				let guard = 0;
				while (paging?.hasPrev && guard < 50) {
					if (await isStopped()) throw new StopSignal();
					await broadcast({
						type: "EXTRACTION_PROGRESS",
						progress: {
							phase: "rewind",
							page: 0,
							totalPages: null,
							collectedRows: 0,
							addedRows: 0,
							message: "برگشت به صفحه اول…"
						}
					});
					const epoch = (await readDocState(tabId))?.epoch ?? 0;
					if (!await clickPaginator(tabId, "span#prePage button")) break;
					await waitForNewPage(tabId, epoch);
					paging = await readPaging(tabId, adapter.readPaging);
					guard++;
				}
			}
			let pageSize = 0;
			let anchorSeen = false;
			while (true) {
				if (await isStopped()) throw new StopSignal();
				const result = await inject(tabId, adapter.scrape);
				if (result.rows.length === 0 && result.matchedFields === 0) throw new Error("جدول دروس در این صفحه پیدا نشد");
				if (result.paging.from === 1) anchorSeen = true;
				if (result.paging.to && result.paging.from) pageSize = Math.max(pageSize, result.paging.to - result.paging.from + 1);
				pages++;
				totalDuplicateCount += result.duplicateCount;
				const { merged, added } = mergeRows(await offeringsStorage.getValue(), result.rows);
				await offeringsStorage.setValue(merged);
				const isLastPage = result.paging.totalRecords !== null && result.paging.to !== null && result.paging.to >= result.paging.totalRecords;
				const totalPages = result.paging.totalRecords && pageSize > 0 ? Math.ceil(result.paging.totalRecords / pageSize) : null;
				const computedPage = result.paging.from !== null && pageSize > 0 ? Math.ceil(result.paging.from / pageSize) : pages;
				const showNumbers = !isLastPage || anchorSeen;
				lastProgress = {
					phase: "collect",
					page: showNumbers ? computedPage : 0,
					totalPages: showNumbers ? totalPages : null,
					collectedRows: merged.length,
					addedRows: added,
					message: showNumbers ? `استخراج صفحه ${computedPage} از ${totalPages ?? "?"}…` : "استخراج صفحه آخر…"
				};
				await setState({
					running: true,
					progress: lastProgress
				});
				await broadcast({
					type: "EXTRACTION_PROGRESS",
					progress: lastProgress
				});
				if (!(direction === "forward" ? result.paging.hasNext : result.paging.hasPrev)) break;
				if (await isStopped()) throw new StopSignal();
				const epoch = (await readDocState(tabId))?.epoch ?? 0;
				if (!await clickPaginator(tabId, direction === "forward" ? "span#nextPage button" : "span#prePage button")) break;
				await waitForNewPage(tabId, epoch);
			}
			const stored = await offeringsStorage.getValue();
			if (stored.some((row) => !row.index)) await offeringsStorage.setValue(stored.filter((row) => row.index));
			await setState({
				running: false,
				progress: null
			});
			await broadcast({
				type: "EXTRACTION_DONE",
				totalRows: (await offeringsStorage.getValue()).length,
				pages,
				duplicateCount: totalDuplicateCount
			});
		} catch (error) {
			if (error instanceof StopSignal) {
				const totalRows = (await offeringsStorage.getValue()).length;
				await setState({
					running: false,
					progress: null
				});
				await broadcast({
					type: "EXTRACTION_STOPPED",
					totalRows
				});
				return;
			}
			const message = error instanceof Error ? error.message : "خطای ناشناخته در استخراج";
			await setState({
				running: false,
				progress: null
			});
			await broadcast({
				type: "EXTRACTION_ERROR",
				error: message
			});
		}
	}
	//#endregion
	//#region src/entrypoints/background.ts
	var background_default = defineBackground(() => {
		browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
			handleMessage(message).then(sendResponse);
			return true;
		});
	});
	async function handleMessage(message) {
		switch (message.type) {
			case "START_EXTRACTION": {
				let tabId = message.tabId;
				if (!tabId) {
					const [tab] = await browser.tabs.query({
						active: true,
						currentWindow: true
					});
					tabId = tab?.id;
				}
				if (!tabId) return {
					ok: false,
					error: "تب فعالی پیدا نشد"
				};
				runExtraction(tabId, message.universityId);
				return {
					ok: true,
					tabId
				};
			}
			case "STOP_EXTRACTION":
				await extractStopStorage.setValue(true);
				return { ok: true };
			case "GET_EXTRACTION_STATE": return {
				ok: true,
				state: await extractStateStorage.getValue()
			};
		}
	}
	//#endregion
	//#region ../../node_modules/.pnpm/@webext-core+match-patterns@2.0.0/node_modules/@webext-core/match-patterns/dist/index.mjs
	/**
	* Class for parsing and performing operations on match patterns.
	*
	* @example
	*   const pattern = new MatchPattern('*://google.com/*');
	*
	*   pattern.includes('https://google.com'); // true
	*   pattern.includes('http://youtube.com/watch?v=123'); // false
	*/
	var MatchPattern = class MatchPattern {
		static {
			this.PROTOCOLS = [
				"http",
				"https",
				"file",
				"ftp",
				"urn",
				"ws",
				"wss"
			];
		}
		/**
		* Parse a match pattern string. If it is invalid, the constructor will throw an
		* `InvalidMatchPattern` error.
		*
		* @param matchPattern The match pattern to parse.
		*/
		constructor(matchPattern) {
			if (matchPattern === "<all_urls>") {
				this.isAllUrls = true;
				this.protocolMatches = [...MatchPattern.PROTOCOLS];
				this.hostnameMatch = "*";
				this.pathnameMatch = "*";
			} else {
				const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
				if (groups == null) throw new InvalidMatchPattern(matchPattern, "Incorrect format");
				const [_, protocol, hostname, pathname] = groups;
				validateProtocol(matchPattern, protocol);
				validateHostname(matchPattern, hostname);
				this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
				this.hostnameMatch = hostname;
				this.pathnameMatch = pathname;
			}
		}
		/** Check if a URL is included in a pattern. */
		includes(url) {
			const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
			if (this.isAllUrls) return !this.isUnknownProtocol(u);
			return !!this.protocolMatches.find((protocol) => {
				if (protocol === "http") return this.isHttpMatch(u);
				if (protocol === "https") return this.isHttpsMatch(u);
				if (protocol === "file") return this.isFileMatch(u);
				if (protocol === "ftp") return this.isFtpMatch(u);
				if (protocol === "urn") return this.isUrnMatch(u);
			});
		}
		isHttpMatch(url) {
			return url.protocol === "http:" && this.isHostPathMatch(url);
		}
		isHttpsMatch(url) {
			return url.protocol === "https:" && this.isHostPathMatch(url);
		}
		isHostPathMatch(url) {
			if (!this.hostnameMatch || !this.pathnameMatch) return false;
			const hostnameMatchRegexs = [this.convertPatternToRegex(this.hostnameMatch), this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))];
			const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
			return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
		}
		isUnknownProtocol(url) {
			return !this.protocolMatches.includes(url.protocol.slice(0, -1));
		}
		isPathMatch(url) {
			if (!this.pathnameMatch) return false;
			return this.convertPatternToRegex(this.pathnameMatch).test(url.pathname);
		}
		isFileMatch(url) {
			return url.protocol === "file:" && this.isPathMatch(url);
		}
		isFtpMatch(_url) {
			throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
		}
		isUrnMatch(_url) {
			throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
		}
		convertPatternToRegex(pattern) {
			const starsReplaced = this.escapeForRegex(pattern).replace(/\\\*/g, ".*");
			return RegExp(`^${starsReplaced}$`);
		}
		escapeForRegex(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
	};
	var InvalidMatchPattern = class extends Error {
		constructor(matchPattern, reason) {
			super(`Invalid match pattern "${matchPattern}": ${reason}`);
		}
	};
	function validateProtocol(matchPattern, protocol) {
		if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*") throw new InvalidMatchPattern(matchPattern, `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`);
	}
	function validateHostname(matchPattern, hostname) {
		if (hostname.includes(":")) throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
		if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*.")) throw new InvalidMatchPattern(matchPattern, `If using a wildcard (*), it must go at the start of the hostname`);
	}
	//#endregion
	//#region \0virtual:wxt-background-entrypoint?D:/Codes/studenthub-beta/apps/extension/src/entrypoints/background.ts
	function print(method, ...args) {
		if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
		else method("[wxt]", ...args);
	}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => print(console.debug, ...args),
		log: (...args) => print(console.log, ...args),
		warn: (...args) => print(console.warn, ...args),
		error: (...args) => print(console.error, ...args)
	};
	var ws;
	/** Connect to the websocket and listen for messages. */
	function getDevServerWebSocket() {
		if (ws == null) {
			const serverUrl = "ws://localhost:3000";
			logger.debug("Connecting to dev server @", serverUrl);
			ws = new WebSocket(serverUrl, "vite-hmr");
			ws.addWxtEventListener = ws.addEventListener.bind(ws);
			ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({
				type: "custom",
				event,
				payload
			}));
			ws.addEventListener("open", () => {
				logger.debug("Connected to dev server");
			});
			ws.addEventListener("close", () => {
				logger.debug("Disconnected from dev server");
			});
			ws.addEventListener("error", (event) => {
				logger.error("Failed to connect to dev server", event);
			});
			ws.addEventListener("message", (e) => {
				try {
					const message = JSON.parse(e.data);
					if (message.type === "custom") ws?.dispatchEvent(new CustomEvent(message.event, { detail: message.data }));
				} catch (err) {
					logger.error("Failed to handle message", err);
				}
			});
		}
		return ws;
	}
	/** https://developer.chrome.com/blog/longer-esw-lifetimes/ */
	function keepServiceWorkerAlive() {
		setInterval(async () => {
			await browser.runtime.getPlatformInfo();
		}, 5e3);
	}
	function reloadContentScript(payload) {
		if (browser.runtime.getManifest().manifest_version == 2) reloadContentScriptMv2(payload);
		else reloadContentScriptMv3(payload);
	}
	async function reloadContentScriptMv3({ registration, contentScript }) {
		if (registration === "runtime") await reloadRuntimeContentScriptMv3(contentScript);
		else await reloadManifestContentScriptMv3(contentScript);
	}
	async function reloadManifestContentScriptMv3(contentScript) {
		const id = `wxt:${contentScript.js[0]}`;
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const existing = registered.find((cs) => cs.id === id);
		if (existing) {
			logger.debug("Updating content script", existing);
			await browser.scripting.updateContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		} else {
			logger.debug("Registering new content script...");
			await browser.scripting.registerContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		}
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadRuntimeContentScriptMv3(contentScript) {
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const matches = registered.filter((cs) => {
			const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
			const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
			return hasJs || hasCss;
		});
		if (matches.length === 0) {
			logger.log("Content script is not registered yet, nothing to reload", contentScript);
			return;
		}
		await browser.scripting.updateContentScripts(matches);
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadTabsForContentScript(contentScript) {
		const allTabs = await browser.tabs.query({});
		const matchPatterns = contentScript.matches.map((match) => new MatchPattern(match));
		const matchingTabs = allTabs.filter((tab) => {
			const url = tab.url;
			if (!url) return false;
			return !!matchPatterns.find((pattern) => pattern.includes(url));
		});
		await Promise.all(matchingTabs.map(async (tab) => {
			try {
				await browser.tabs.reload(tab.id);
			} catch (err) {
				logger.warn("Failed to reload tab:", err);
			}
		}));
	}
	async function reloadContentScriptMv2(_payload) {
		throw Error("TODO: reloadContentScriptMv2");
	}
	try {
		const ws = getDevServerWebSocket();
		ws.addWxtEventListener("wxt:reload-extension", () => {
			browser.runtime.reload();
		});
		ws.addWxtEventListener("wxt:reload-content-script", (event) => {
			reloadContentScript(event.detail);
		});
		ws.addEventListener("open", () => ws.sendCustom("wxt:background-initialized"));
		keepServiceWorkerAlive();
	} catch (err) {
		logger.error("Failed to setup web socket connection with dev server", err);
	}
	browser.commands.onCommand.addListener((command) => {
		if (command === "wxt:reload-extension") browser.runtime.reload();
	});
	var result;
	try {
		result = background_default.main();
		if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
	} catch (err) {
		logger.error("The background crashed on startup!");
		throw err;
	}
	//#endregion
	return result;
})();

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsIm5hbWVzIjpbImJyb3dzZXIiLCJicm93c2VyIiwid2l0aExvY2siXSwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjEuNF9lc2J1aWxkQDAuMjguMl9lXzJkYzY0NzkzYTNiMThhNzE3YWIwMzdjZmVkOGNlMTlkL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtYmFja2dyb3VuZC5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjIuNy9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIxLjRfZXNidWlsZEAwLjI4LjJfZV8yZGM2NDc5M2EzYjE4YTcxN2FiMDM3Y2ZlZDhjZTE5ZC9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2V4cG9ydC1kb2MudHMiLCIuLi8uLi9zcmMvdW5pdmVyc2l0aWVzL2F6YWQvc2NyYXBlLnRzIiwiLi4vLi4vc3JjL3VuaXZlcnNpdGllcy9hemFkL3JlcGxhY2UtbWVudS50cyIsIi4uLy4uL3NyYy91bml2ZXJzaXRpZXMvYXphZC9pbmRleC50cyIsIi4uLy4uL3NyYy91bml2ZXJzaXRpZXMvaW5kZXgudHMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vc3VwZXJsb2NrQDEuMy41L25vZGVfbW9kdWxlcy9zdXBlcmxvY2svc3JjL2NyZWF0ZS5qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9zdXBlcmxvY2tAMS4zLjUvbm9kZV9tb2R1bGVzL3N1cGVybG9jay9zcmMvaW5kZXguanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrc3RvcmFnZUAxLjIuOS9ub2RlX21vZHVsZXMvQHd4dC1kZXYvc3RvcmFnZS9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uL3NyYy9saWIvc3RvcmFnZS50cyIsIi4uLy4uL3NyYy9saWIvZXh0cmFjdG9yLnRzIiwiLi4vLi4vc3JjL2VudHJ5cG9pbnRzL2JhY2tncm91bmQudHMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHdlYmV4dC1jb3JlK21hdGNoLXBhdHRlcm5zQDIuMC4wL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvZGlzdC9pbmRleC5tanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy91dGlscy9kZWZpbmUtYmFja2dyb3VuZC50c1xuZnVuY3Rpb24gZGVmaW5lQmFja2dyb3VuZChhcmcpIHtcblx0aWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHsgbWFpbjogYXJnIH07XG5cdHJldHVybiBhcmc7XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGRlZmluZUJhY2tncm91bmQgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgYnJvd3NlciQxIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvYnJvd3Nlci50c1xuLyoqXG4qIENvbnRhaW5zIHRoZSBgYnJvd3NlcmAgZXhwb3J0IHdoaWNoIHlvdSBzaG91bGQgdXNlIHRvIGFjY2VzcyB0aGUgZXh0ZW5zaW9uXG4qIEFQSXMgaW4geW91ciBwcm9qZWN0OlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuKlxuKiBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xuKiAgIC8vIC4uLlxuKiB9KTtcbiogYGBgXG4qXG4qIEBtb2R1bGUgd3h0L2Jyb3dzZXJcbiovXG5jb25zdCBicm93c2VyID0gYnJvd3NlciQxO1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBicm93c2VyIH07XG4iLCJpbXBvcnQgdHlwZSB7IFNjcmFwZWRPZmZlcmluZywgU2VtZXN0ZXIgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vKiogQ2Fub25pY2FsIGtleSBvcmRlciBmb3Igc2VyaWFsaXplZCBvZmZlcmluZ3MgKHJlYWRhYmxlIGRpZmZzIGluIFBScykuICovXG5jb25zdCBPRkZFUklOR19LRVlfT1JERVIgPSBbXG4gIFwiaW5kZXhcIixcbiAgXCJjb3Vyc2VDb2RlXCIsXG4gIFwiY291cnNlTmFtZVwiLFxuICBcImNvdXJzZVR5cGVcIixcbiAgXCJ0aGVvcmV0aWNhbFVuaXRzXCIsXG4gIFwicHJhY3RpY2FsVW5pdHNcIixcbiAgXCJjbGFzc0NvZGVcIixcbiAgXCJkZWdyZWVcIixcbiAgXCJwcmVzZW50YXRpb25UeXBlXCIsXG4gIFwibWluQ2FwYWNpdHlcIixcbiAgXCJtYXhDYXBhY2l0eVwiLFxuICBcImN1cnJlbnRFbnJvbGxtZW50XCIsXG4gIFwiY2xhc3NTY2hlZHVsZVwiLFxuICBcImV4YW1TY2hlZHVsZVwiLFxuICBcInByb2Zlc3NvclwiLFxuICBcImxvY2F0aW9uXCIsXG5dIGFzIGNvbnN0O1xuXG5jb25zdCBOVUxMQUJMRV9LRVlTID0gbmV3IFNldChbXG4gIFwiY291cnNlVHlwZVwiLFxuICBcInByZXNlbnRhdGlvblR5cGVcIixcbiAgXCJtaW5DYXBhY2l0eVwiLFxuICBcIm1heENhcGFjaXR5XCIsXG4gIFwiY3VycmVudEVucm9sbG1lbnRcIixcbiAgXCJjbGFzc1NjaGVkdWxlXCIsXG4gIFwiZXhhbVNjaGVkdWxlXCIsXG4gIFwicHJvZmVzc29yXCIsXG4gIFwibG9jYXRpb25cIixcbl0pO1xuXG5mdW5jdGlvbiBvcmRlck9mZmVyaW5nKG9mZmVyaW5nOiBTY3JhcGVkT2ZmZXJpbmcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IHJlY29yZCA9IG9mZmVyaW5nIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IG91dDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgZm9yIChjb25zdCBrZXkgb2YgT0ZGRVJJTkdfS0VZX09SREVSKSB7XG4gICAgY29uc3QgdmFsdWUgPSByZWNvcmRba2V5XTtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgY29udGludWU7XG4gICAgaWYgKE5VTExBQkxFX0tFWVMuaGFzKGtleSkgJiYgdmFsdWUgPT09IG51bGwpIHtcbiAgICAgIG91dFtrZXldID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBvdXRba2V5XSA9IHZhbHVlO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2ZmZXJpbmdEb2Mge1xuICB5ZWFyOiBudW1iZXI7XG4gIHNlbWVzdGVyOiBTZW1lc3RlcjtcbiAgc2NyYXBlZEF0OiBzdHJpbmc7XG4gIG9mZmVyaW5nczogQXJyYXk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+O1xufVxuXG4vKiogQnVpbGQgdGhlIHJlZ2lzdHJ5IGRvY3VtZW50IChgY291cnNlcy88eWVhcj4vPHNlbWVzdGVyPi5qc29uYCkuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRPZmZlcmluZ0RvYyhcbiAgcm93czogU2NyYXBlZE9mZmVyaW5nW10sXG4gIHllYXI6IG51bWJlcixcbiAgc2VtZXN0ZXI6IFNlbWVzdGVyLFxuKTogT2ZmZXJpbmdEb2Mge1xuICByZXR1cm4ge1xuICAgIHllYXIsXG4gICAgc2VtZXN0ZXIsXG4gICAgc2NyYXBlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgb2ZmZXJpbmdzOiByb3dzLm1hcChvcmRlck9mZmVyaW5nKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZU9mZmVyaW5nRG9jKGRvYzogT2ZmZXJpbmdEb2MpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7SlNPTi5zdHJpbmdpZnkoZG9jLCBudWxsLCAyKX1cXG5gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gb2ZmZXJpbmdGaWxlTmFtZSh5ZWFyOiBudW1iZXIsIHNlbWVzdGVyOiBTZW1lc3Rlcik6IHN0cmluZyB7XG4gIHJldHVybiBgJHt5ZWFyfS0ke3NlbWVzdGVyLnRvTG93ZXJDYXNlKCl9Lmpzb25gO1xufVxuXG4vKipcbiAqIE1lcmdlIGZyZXNobHkgc2NyYXBlZCByb3dzIGludG8gc3RvcmVkIHJvd3MuIEV4aXN0aW5nIHJvd3Mgd2luIG9uIGluZGV4XG4gKiBjb2xsaXNpb24gKHJlLXNjcmFwaW5nIGEgcGFnZSByZWZyZXNoZXMgaXRzIHJvd3MgaW5zdGVhZCBvZiBkdXBsaWNhdGluZykuXG4gKiBSb3dzIHdpdGhvdXQgYW4gaW5kZXggaGF2ZSBubyBpZGVudGl0eSAtIHRoZXkgYXJlIGRyb3BwZWQgKHRoZXkgd291bGQgYWxsXG4gKiBjb2xsaWRlIG9uIFwiXCIgYW5kIGNvbGxhcHNlIHRoZSB3aG9sZSBwYWdlIGludG8gb25lIHJvdykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZVJvd3MoXG4gIHN0b3JlZDogU2NyYXBlZE9mZmVyaW5nW10sXG4gIGluY29taW5nOiBTY3JhcGVkT2ZmZXJpbmdbXSxcbik6IHsgbWVyZ2VkOiBTY3JhcGVkT2ZmZXJpbmdbXTsgYWRkZWQ6IG51bWJlcjsgcmVmcmVzaGVkOiBudW1iZXIgfSB7XG4gIGNvbnN0IGJ5SW5kZXggPSBuZXcgTWFwPHN0cmluZywgU2NyYXBlZE9mZmVyaW5nPigpO1xuICBmb3IgKGNvbnN0IHJvdyBvZiBzdG9yZWQpIGlmIChyb3cuaW5kZXgpIGJ5SW5kZXguc2V0KHJvdy5pbmRleCwgcm93KTtcblxuICBsZXQgYWRkZWQgPSAwO1xuICBsZXQgcmVmcmVzaGVkID0gMDtcbiAgZm9yIChjb25zdCByb3cgb2YgaW5jb21pbmcpIHtcbiAgICBpZiAoIXJvdy5pbmRleCkgY29udGludWU7XG4gICAgaWYgKGJ5SW5kZXguaGFzKHJvdy5pbmRleCkpIHJlZnJlc2hlZCsrO1xuICAgIGVsc2UgYWRkZWQrKztcbiAgICBieUluZGV4LnNldChyb3cuaW5kZXgsIHJvdyk7XG4gIH1cblxuICByZXR1cm4geyBtZXJnZWQ6IFsuLi5ieUluZGV4LnZhbHVlcygpXSwgYWRkZWQsIHJlZnJlc2hlZCB9O1xufVxuIiwiaW1wb3J0IHR5cGUgeyBQYWdpbmdJbmZvLCBTY3JhcGVSZXN1bHQgfSBmcm9tIFwiLi4vLi4vbGliL3R5cGVzXCI7XG5cbi8qKlxuICogSW5qZWN0ZWQgdmlhIGNocm9tZS5zY3JpcHRpbmcuZXhlY3V0ZVNjcmlwdCAtIE1VU1QgYmUgZnVsbHkgc2VsZi1jb250YWluZWQuXG4gKiBDaHJvbWUgc2VyaWFsaXplcyB0aGVzZSBmdW5jdGlvbnMnIHNvdXJjZXMgKGZ1bmMudG9TdHJpbmcoKSksIHNvIHRoZXkgY2FuXG4gKiBub3QgcmVmZXJlbmNlIEFOWSBtb2R1bGUtc2NvcGUgYmluZGluZzogYWZ0ZXIgbWluaWZpY2F0aW9uIHRoZSByZWZlcmVuY2VcbiAqIGJlY29tZXMgYSByZW5hbWVkIGlkZW50aWZpZXIgdGhhdCBkb2VzIG5vdCBleGlzdCBpbiB0aGUgcGFnZSBjb250ZXh0XG4gKiAoc3ltcHRvbTogXCJSZWZlcmVuY2VFcnJvcjogYSBpcyBub3QgZGVmaW5lZFwiIGF0IGluamVjdGlvbiB0aW1lKS4gRXZlcnlcbiAqIGhlbHBlciBsaXZlcyBpbnNpZGUgdGhlIGZ1bmN0aW9uIGJvZHkuXG4gKlxuICogSW1wcm92ZW1lbnRzIG92ZXIgdGhlIGxlZ2FjeSBjb250ZW50IHNjcmlwdDpcbiAqICAgLSBmdXp6eSBQZXJzaWFuIGhlYWRlciBtYXRjaGluZyAoYWxpYXNlcyArIG5vcm1hbGl6YXRpb24gKyBjb250YWlubWVudClcbiAqICAgLSBQZXJzaWFuL0FyYWJpYy1JbmRpYyBkaWdpdCBjb252ZXJzaW9uIGV2ZXJ5d2hlcmVcbiAqICAgLSBkdXBsaWNhdGUgZGV0ZWN0aW9uIHdpdGhvdXQgc2lsZW50bHkgYXBwZW5kaW5nIGR1cGxpY2F0ZXNcbiAqICAgLSByb3dzIGFscmVhZHkga2V5ZWQgYnkgY2Fub25pY2FsIGZpZWxkIG5hbWVzXG4gKiAgIC0gcGFnaW5hdGlvbiBhd2FyZW5lc3MgKNix2YPZiNix2K8gWCDYqtinIFkg2KfYsiBaICsgbmV4dFBhZ2UgYnV0dG9uIHN0YXRlKVxuICovXG5cbi8qKiBSZWFkIHRoZSBhbW9vemVzaHlhciBwYWdpbmcgYmFyLiBEaWdpdHMgYXJlIG5vcm1hbGl6ZWQsIHNvIHRoZSBBcmFiaWMtdnMtXG4gKiAgUGVyc2lhbiDZgy/aqSBzcGVsbGluZyBvZiBcItix2YPZiNix2K9cIiBuZXZlciBtYXR0ZXJzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFBhZ2luZ0luZm8oKTogUGFnaW5nSW5mbyB7XG4gIGZ1bmN0aW9uIHRvRW5nbGlzaERpZ2l0cyh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0ZXh0LnJlcGxhY2UoL1vbsC3budmgLdmpXS9nLCAoY2gpID0+IHtcbiAgICAgIGNvbnN0IHBlcnNpYW4gPSBcItuw27Hbstuz27Tbtdu227fbuNu5XCIuaW5kZXhPZihjaCk7XG4gICAgICBpZiAocGVyc2lhbiAhPT0gLTEpIHJldHVybiBTdHJpbmcocGVyc2lhbik7XG4gICAgICByZXR1cm4gU3RyaW5nKFwi2aDZodmi2aPZpNml2abZp9mo2alcIi5pbmRleE9mKGNoKSk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBwYWdpbmdUZXh0ID0gdG9FbmdsaXNoRGlnaXRzKFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGFnaW5nXCIpPy50ZXh0Q29udGVudCA/PyBcIlwiLFxuICApLnJlcGxhY2UoL1xccysvZywgXCIgXCIpO1xuXG4gIGNvbnN0IG1hdGNoID0gLyhcXGQrKVxccyrYqtinXFxzKihcXGQrKVxccyrYp9iyXFxzKihcXGQrKS8uZXhlYyhwYWdpbmdUZXh0KTtcbiAgY29uc3QgdG90YWxGcm9tU3BhbiA9IE51bWJlcihcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3RvdGFsU2VhcmNoQ291bnRcIik/LnRleHRDb250ZW50Py50cmltKCkgPz8gXCJcIixcbiAgKTtcblxuICBjb25zdCBuZXh0QnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MQnV0dG9uRWxlbWVudD4oXG4gICAgXCJzcGFuI25leHRQYWdlIGJ1dHRvblwiLFxuICApO1xuICBjb25zdCBwcmV2QnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MQnV0dG9uRWxlbWVudD4oXG4gICAgXCJzcGFuI3ByZVBhZ2UgYnV0dG9uXCIsXG4gICk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFJlY29yZHM6IG1hdGNoXG4gICAgICA/IE51bWJlcihtYXRjaFszXSlcbiAgICAgIDogTnVtYmVyLmlzRmluaXRlKHRvdGFsRnJvbVNwYW4pICYmIHRvdGFsRnJvbVNwYW4gPiAwXG4gICAgICAgID8gdG90YWxGcm9tU3BhblxuICAgICAgICA6IG51bGwsXG4gICAgZnJvbTogbWF0Y2ggPyBOdW1iZXIobWF0Y2hbMV0pIDogbnVsbCxcbiAgICB0bzogbWF0Y2ggPyBOdW1iZXIobWF0Y2hbMl0pIDogbnVsbCxcbiAgICBoYXNOZXh0OiBuZXh0QnRuICE9PSBudWxsICYmICFuZXh0QnRuLmRpc2FibGVkLFxuICAgIGhhc1ByZXY6IHByZXZCdG4gIT09IG51bGwgJiYgIXByZXZCdG4uZGlzYWJsZWQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzY3JhcGVPZmZlcmluZ3NGcm9tUGFnZSgpOiBTY3JhcGVSZXN1bHQge1xuICBmdW5jdGlvbiB0b0VuZ2xpc2hEaWdpdHModGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGV4dC5yZXBsYWNlKC9b27At27nZoC3ZqV0vZywgKGNoKSA9PiB7XG4gICAgICBjb25zdCBwZXJzaWFuID0gXCLbsNux27Lbs9u027Xbttu327jbuVwiLmluZGV4T2YoY2gpO1xuICAgICAgaWYgKHBlcnNpYW4gIT09IC0xKSByZXR1cm4gU3RyaW5nKHBlcnNpYW4pO1xuICAgICAgcmV0dXJuIFN0cmluZyhcItmg2aHZotmj2aTZpdmm2afZqNmpXCIuaW5kZXhPZihjaCkpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVuaWZ5IEFyYWJpYy9QZXJzaWFuIGhvbW9nbHlwaHMuIFRoZSB0YXJnZXQgc2l0ZSB3cml0ZXMgaGVhZGVycyB3aXRoXG4gICAqIEFyYWJpYyDZgy/ZiiAo2YPYr9ix2LPYjCDZhti42LHZitiMINit2K/Yp9mD2LEg2LjYsdmB2YrYqikgd2hpbGUgYWxpYXNlcyBhbmQgdGhlIHJlZ2lzdHJ5IHVzZVxuICAgKiBQZXJzaWFuINqpL9uMIC0gd2l0aG91dCB0aGlzLCBldmVyeSBtYXRjaCBzaWxlbnRseSBmYWlscy5cbiAgICovXG4gIGZ1bmN0aW9uIHVuaWZ5UGVyc2lhbih0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0ZXh0XG4gICAgICAucmVwbGFjZSgvXFx1MDY0My9nLCBcIlxcdTA2QTlcIikgLy8g2YMgLT4g2qlcbiAgICAgIC5yZXBsYWNlKC9cXHUwNjRBL2csIFwiXFx1MDZDQ1wiKSAvLyDZiiAtPiDbjFxuICAgICAgLnJlcGxhY2UoL1xcdTA2NDkvZywgXCJcXHUwNkNDXCIpOyAvLyDZiSAtPiDbjFxuICB9XG5cbiAgZnVuY3Rpb24gY2xlYW5UZXh0KHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHVuaWZ5UGVyc2lhbihcbiAgICAgIHRvRW5nbGlzaERpZ2l0cyh0ZXh0LnJlcGxhY2UoL1xccysvZywgXCIgXCIpKS5yZXBsYWNlKC9cXHUwMGEwL2csIFwiIFwiKSxcbiAgICApLnRyaW0oKTtcbiAgfVxuXG4gIC8qKiBIZWFkZXIgbm9ybWFsaXphdGlvbjogZHJvcCBaV05KLCBwdW5jdHVhdGlvbiwgY29sbGFwc2Ugc3BhY2VzLiAqL1xuICBmdW5jdGlvbiBub3JtYWxpemVIZWFkZXIodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY2xlYW5UZXh0KHRleHQpXG4gICAgICAucmVwbGFjZSgvW1xcdTIwMGNcXHUyMDBmXFx1MjAwZV0vZywgXCJcIilcbiAgICAgIC5yZXBsYWNlKC9bwqvCuygpXFwtXy9dL2csIFwiXCIpXG4gICAgICAucmVwbGFjZSgvXFxzKy9nLCBcIiBcIilcbiAgICAgIC50cmltKCk7XG4gIH1cblxuICAvLyBDYW5vbmljYWwgZmllbGQgLT4gaGVhZGVyIGFsaWFzZXMgKG5vcm1hbGl6ZWQgY29udGFpbm1lbnQgbWF0Y2hpbmcpLlxuICBjb25zdCBGSUVMRF9BTElBU0VTOiBBcnJheTxbc3RyaW5nLCBzdHJpbmdbXV0+ID0gW1xuICAgIFtcImNvdXJzZUNvZGVcIiwgW1wi2qnYryDYr9ix2LNcIl1dLFxuICAgIFtcImNvdXJzZU5hbWVcIiwgW1wi2YbYp9mFINiv2LHYs1wiLCBcIti52YbZiNin2YYg2K/YsdizXCJdXSxcbiAgICBbXCJjb3Vyc2VUeXBlXCIsIFtcItmG2YjYuSDYr9ix2LNcIl1dLFxuICAgIFtcInRoZW9yZXRpY2FsVW5pdHNcIiwgW1wi2KrYudiv2KfYryDZiNin2K3YryDZhti42LHbjFwiLCBcItmI2KfYrdivINmG2LjYsduMXCJdXSxcbiAgICBbXCJwcmFjdGljYWxVbml0c1wiLCBbXCLYqti52K/Yp9ivINmI2KfYrdivINi52YXZhNuMXCIsIFwi2YjYp9it2K8g2LnZhdmE24xcIl1dLFxuICAgIFtcbiAgICAgIFwiY2xhc3NDb2RlXCIsXG4gICAgICBbXCLaqdivINin2LHYp9im2Ycg2qnZhNin2LMg2K/YsdizXCIsIFwi2qnYryDYp9ix2KfYptmHXCIsIFwi2qnYryDaqdmE2KfYs1wiLCBcItqv2LHZiNmHINiv2LHYs1wiLCBcIti02YXYp9ix2Ycg2qnZhNin2LNcIl0sXG4gICAgXSxcbiAgICBbXCJkZWdyZWVcIiwgW1wi2YXZgti32LlcIiwgXCLYr9ix2KzZh1wiXV0sXG4gICAgW1wicHJlc2VudGF0aW9uVHlwZVwiLCBbXCLZhtmI2Lkg2KfYsdin2KbZh1wiXV0sXG4gICAgW1wibWluQ2FwYWNpdHlcIiwgW1wi2K3Yr9in2YLZhCDYuNix2YHbjNiqXCJdXSxcbiAgICBbXCJtYXhDYXBhY2l0eVwiLCBbXCLYrdiv2Kfaqdir2LEg2LjYsdmB24zYqlwiXV0sXG4gICAgW1wiY3VycmVudEVucm9sbG1lbnRcIiwgW1wi2KvYqNiqINmG2KfZhVwiLCBcItir2KjYqiDZhtin2YUg2LTYr9mHXCIsIFwi2LjYsdmB24zYqiDZvtixXCJdXSxcbiAgICBbXG4gICAgICBcImNsYXNzU2NoZWR1bGVcIixcbiAgICAgIFtcItiy2YXYp9mG2KjZhtiv24wg2KrYtNqp24zZhCDaqdmE2KfYs1wiLCBcItiy2YXYp9mGINiq2LTaqduM2YQg2qnZhNin2LNcIiwgXCLYs9in2LnYp9iqINqp2YTYp9izXCJdLFxuICAgIF0sXG4gICAgW1wiZXhhbVNjaGVkdWxlXCIsIFtcItiy2YXYp9mGINin2YXYqtit2KfZhlwiXV0sXG4gICAgW1wicHJvZmVzc29yXCIsIFtcItin2LPYqtin2K9cIiwgXCLZhtin2YUg2KfYs9iq2KfYr1wiXV0sXG4gICAgW1wibG9jYXRpb25cIiwgW1wi2YXaqdin2YYg2KjYsdqv2LLYp9ix24xcIiwgXCLZhdqp2KfZhlwiLCBcItmF2K3ZhCDYqti02qnbjNmEXCIsIFwi2YXYrdmEINqp2YTYp9izXCJdXSxcbiAgXTtcbiAgY29uc3QgdG90YWxGaWVsZHMgPSBGSUVMRF9BTElBU0VTLmxlbmd0aDtcblxuICBjb25zdCBoZWFkZXJzID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwidHIgdGhcIikpLm1hcCgodGgpID0+XG4gICAgY2xlYW5UZXh0KHRoLnRleHRDb250ZW50ID8/IFwiXCIpLFxuICApO1xuXG4gIC8vIEdyZWVkeSBjbGFpbTogZWFjaCBmaWVsZCB0YWtlcyB0aGUgYmVzdCB1bmNsYWltZWQgaGVhZGVyLlxuICBjb25zdCBoZWFkZXJCeUZpZWxkID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgY29uc3QgY2xhaW1lZEhlYWRlcnMgPSBuZXcgU2V0PG51bWJlcj4oKTtcblxuICBmb3IgKGNvbnN0IFtmaWVsZCwgYWxpYXNlc10gb2YgRklFTERfQUxJQVNFUykge1xuICAgIGxldCBiZXN0SWR4ID0gLTE7XG4gICAgbGV0IGJlc3RTY29yZSA9IDA7XG5cbiAgICBoZWFkZXJzLmZvckVhY2goKGhlYWRlciwgaWR4KSA9PiB7XG4gICAgICBpZiAoY2xhaW1lZEhlYWRlcnMuaGFzKGlkeCkgfHwgIWhlYWRlcikgcmV0dXJuO1xuICAgICAgY29uc3Qgbm9ybSA9IG5vcm1hbGl6ZUhlYWRlcihoZWFkZXIpO1xuICAgICAgZm9yIChjb25zdCBhbGlhcyBvZiBhbGlhc2VzKSB7XG4gICAgICAgIGlmIChub3JtID09PSBhbGlhcykge1xuICAgICAgICAgIGlmIChiZXN0U2NvcmUgPCAzKSB7XG4gICAgICAgICAgICBiZXN0U2NvcmUgPSAzO1xuICAgICAgICAgICAgYmVzdElkeCA9IGlkeDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobm9ybS5pbmNsdWRlcyhhbGlhcykgJiYgYmVzdFNjb3JlIDwgMikge1xuICAgICAgICAgIGJlc3RTY29yZSA9IDI7XG4gICAgICAgICAgYmVzdElkeCA9IGlkeDtcbiAgICAgICAgfSBlbHNlIGlmIChhbGlhcy5pbmNsdWRlcyhub3JtKSAmJiBub3JtLmxlbmd0aCA+PSAzICYmIGJlc3RTY29yZSA8IDEpIHtcbiAgICAgICAgICBiZXN0U2NvcmUgPSAxO1xuICAgICAgICAgIGJlc3RJZHggPSBpZHg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChiZXN0SWR4ICE9PSAtMSkge1xuICAgICAgaGVhZGVyQnlGaWVsZC5zZXQoZmllbGQsIGJlc3RJZHgpO1xuICAgICAgY2xhaW1lZEhlYWRlcnMuYWRkKGJlc3RJZHgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNlbGwoY2VsbHM6IE5vZGVMaXN0T2Y8SFRNTFRhYmxlQ2VsbEVsZW1lbnQ+LCBmaWVsZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBpZHggPSBoZWFkZXJCeUZpZWxkLmdldChmaWVsZCk7XG4gICAgcmV0dXJuIGlkeCA9PT0gdW5kZWZpbmVkID8gXCJcIiA6IGNsZWFuVGV4dChjZWxsc1tpZHhdPy50ZXh0Q29udGVudCA/PyBcIlwiKTtcbiAgfVxuXG4gIGNvbnN0IFBFUlNJQU5fREFZUyA9IFtcbiAgICBcIti02YbYqNmHXCIsXG4gICAgXCLbjNqp2LTZhtio2YdcIixcbiAgICBcItiv2YjYtNmG2KjZh1wiLFxuICAgIFwi2LPZhyDYtNmG2KjZh1wiLFxuICAgIFwi2obZh9in2LHYtNmG2KjZh1wiLFxuICAgIFwi2b7ZhtisINi02YbYqNmHXCIsXG4gICAgXCLYrNmF2LnZh1wiLFxuICBdO1xuXG4gIGZ1bmN0aW9uIGV4dHJhY3RGaXJzdFNjaGVkdWxlKHNjaGVkdWxlVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoIXNjaGVkdWxlVGV4dCkgcmV0dXJuIFwiXCI7XG4gICAgLy8gWldOSi1mcmVlLCBob21vZ2x5cGgtdW5pZmllZCBjb3B5IGZvciBtYXRjaGluZyBvbmx5ICjYs9mH4oCM2LTZhtio2YcgLT4g2LPZhyDYtNmG2KjZhyxcbiAgICAvLyDZitmD2LTZhtio2YcgLT4g24zaqdi02YbYqNmHKS5cbiAgICBjb25zdCBjbGVhbmVkID0gdW5pZnlQZXJzaWFuKHNjaGVkdWxlVGV4dClcbiAgICAgIC5yZXBsYWNlKC9bXFx1MjAwY10vZywgXCIgXCIpXG4gICAgICAucmVwbGFjZSgvXFxzKy9nLCBcIiBcIik7XG4gICAgZm9yIChjb25zdCBkYXkgb2YgUEVSU0lBTl9EQVlTKSB7XG4gICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlZ0V4cChcbiAgICAgICAgYCR7ZGF5fVxcXFxzKig/Otin2LIpP1xcXFxzKlxcXFxkezEsMn06XFxcXGR7Mn1cXFxccyrYqtinXFxcXHMqXFxcXGR7MSwyfTpcXFxcZHsyfWAsXG4gICAgICApO1xuICAgICAgY29uc3QgbWF0Y2ggPSBjbGVhbmVkLm1hdGNoKHBhdHRlcm4pO1xuICAgICAgaWYgKG1hdGNoKSByZXR1cm4gbWF0Y2hbMF07XG4gICAgfVxuICAgIHJldHVybiBjbGVhbmVkO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9JbnQodmFsdWU6IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICAgIGlmICghdmFsdWUpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB2YWx1ZS5yZXBsYWNlKC9bLNiMXFxzXS9nLCBcIlwiKTtcbiAgICByZXR1cm4gL15cXGQrJC8udGVzdChub3JtYWxpemVkKSA/IE51bWJlcihub3JtYWxpemVkKSA6IG51bGw7XG4gIH1cblxuICBjb25zdCByb3dzOiBTY3JhcGVSZXN1bHRbXCJyb3dzXCJdID0gW107XG4gIGNvbnN0IHNlZW5JbmRleGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGxldCBkdXBsaWNhdGVDb3VudCA9IDA7XG5cbiAgY29uc3Qgcm93RWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwidHIuZXZlbiwgdHIub2RkXCIpO1xuICByb3dFbGVtZW50cy5mb3JFYWNoKChyb3cpID0+IHtcbiAgICBjb25zdCBjZWxscyA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKFwidGRcIik7XG4gICAgaWYgKGNlbGxzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgY29uc3QgY291cnNlQ29kZSA9IGNlbGwoY2VsbHMsIFwiY291cnNlQ29kZVwiKTtcbiAgICBjb25zdCBjbGFzc0NvZGUgPSBjZWxsKGNlbGxzLCBcImNsYXNzQ29kZVwiKTtcbiAgICBjb25zdCBpbmRleCA9IFtjb3Vyc2VDb2RlLCBjbGFzc0NvZGVdLmZpbHRlcihCb29sZWFuKS5qb2luKFwiLVwiKTtcblxuICAgIGlmIChzZWVuSW5kZXhlcy5oYXMoaW5kZXgpKSB7XG4gICAgICBkdXBsaWNhdGVDb3VudCsrO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZWVuSW5kZXhlcy5hZGQoaW5kZXgpO1xuXG4gICAgcm93cy5wdXNoKHtcbiAgICAgIGluZGV4LFxuICAgICAgY291cnNlQ29kZSxcbiAgICAgIGNvdXJzZU5hbWU6IGNlbGwoY2VsbHMsIFwiY291cnNlTmFtZVwiKSxcbiAgICAgIGNvdXJzZVR5cGU6IGNlbGwoY2VsbHMsIFwiY291cnNlVHlwZVwiKSB8fCBudWxsLFxuICAgICAgdGhlb3JldGljYWxVbml0czogdG9JbnQoY2VsbChjZWxscywgXCJ0aGVvcmV0aWNhbFVuaXRzXCIpKSA/PyAwLFxuICAgICAgcHJhY3RpY2FsVW5pdHM6IHRvSW50KGNlbGwoY2VsbHMsIFwicHJhY3RpY2FsVW5pdHNcIikpID8/IDAsXG4gICAgICBjbGFzc0NvZGUsXG4gICAgICBkZWdyZWU6IGNlbGwoY2VsbHMsIFwiZGVncmVlXCIpLFxuICAgICAgcHJlc2VudGF0aW9uVHlwZTogY2VsbChjZWxscywgXCJwcmVzZW50YXRpb25UeXBlXCIpIHx8IG51bGwsXG4gICAgICBtaW5DYXBhY2l0eTogdG9JbnQoY2VsbChjZWxscywgXCJtaW5DYXBhY2l0eVwiKSksXG4gICAgICBtYXhDYXBhY2l0eTogdG9JbnQoY2VsbChjZWxscywgXCJtYXhDYXBhY2l0eVwiKSksXG4gICAgICBjdXJyZW50RW5yb2xsbWVudDogdG9JbnQoY2VsbChjZWxscywgXCJjdXJyZW50RW5yb2xsbWVudFwiKSksXG4gICAgICBjbGFzc1NjaGVkdWxlOiBleHRyYWN0Rmlyc3RTY2hlZHVsZShjZWxsKGNlbGxzLCBcImNsYXNzU2NoZWR1bGVcIikpIHx8IG51bGwsXG4gICAgICBleGFtU2NoZWR1bGU6IGNlbGwoY2VsbHMsIFwiZXhhbVNjaGVkdWxlXCIpIHx8IG51bGwsXG4gICAgICBwcm9mZXNzb3I6IGNlbGwoY2VsbHMsIFwicHJvZmVzc29yXCIpIHx8IG51bGwsXG4gICAgICBsb2NhdGlvbjogY2VsbChjZWxscywgXCJsb2NhdGlvblwiKSB8fCBudWxsLFxuICAgIH0pO1xuICB9KTtcblxuICAvLyDilIDilIAgcGFnaW5nIChzYW1lIGxvZ2ljIGFzIGdldFBhZ2luZ0luZm8sIGtlcHQgaW5saW5lOiBzZXJpYWxpemVkIGZuKSDilIDilIDilIDilIBcbiAgY29uc3QgcGFnaW5nVGV4dCA9IHRvRW5nbGlzaERpZ2l0cyhcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBhZ2luZ1wiKT8udGV4dENvbnRlbnQgPz8gXCJcIixcbiAgKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKTtcbiAgY29uc3QgcGFnZU1hdGNoID0gLyhcXGQrKVxccyrYqtinXFxzKihcXGQrKVxccyrYp9iyXFxzKihcXGQrKS8uZXhlYyhwYWdpbmdUZXh0KTtcbiAgY29uc3QgdG90YWxGcm9tU3BhbiA9IE51bWJlcihcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3RvdGFsU2VhcmNoQ291bnRcIik/LnRleHRDb250ZW50Py50cmltKCkgPz8gXCJcIixcbiAgKTtcbiAgY29uc3QgbmV4dEJ0biA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEJ1dHRvbkVsZW1lbnQ+KFxuICAgIFwic3BhbiNuZXh0UGFnZSBidXR0b25cIixcbiAgKTtcbiAgY29uc3QgcHJldkJ0biA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEJ1dHRvbkVsZW1lbnQ+KFxuICAgIFwic3BhbiNwcmVQYWdlIGJ1dHRvblwiLFxuICApO1xuXG4gIHJldHVybiB7XG4gICAgcm93cyxcbiAgICBtYXRjaGVkRmllbGRzOiBoZWFkZXJCeUZpZWxkLnNpemUsXG4gICAgdG90YWxGaWVsZHMsXG4gICAgZHVwbGljYXRlQ291bnQsXG4gICAgcGFnaW5nOiB7XG4gICAgICB0b3RhbFJlY29yZHM6IHBhZ2VNYXRjaFxuICAgICAgICA/IE51bWJlcihwYWdlTWF0Y2hbM10pXG4gICAgICAgIDogTnVtYmVyLmlzRmluaXRlKHRvdGFsRnJvbVNwYW4pICYmIHRvdGFsRnJvbVNwYW4gPiAwXG4gICAgICAgICAgPyB0b3RhbEZyb21TcGFuXG4gICAgICAgICAgOiBudWxsLFxuICAgICAgZnJvbTogcGFnZU1hdGNoID8gTnVtYmVyKHBhZ2VNYXRjaFsxXSkgOiBudWxsLFxuICAgICAgdG86IHBhZ2VNYXRjaCA/IE51bWJlcihwYWdlTWF0Y2hbMl0pIDogbnVsbCxcbiAgICAgIGhhc05leHQ6IG5leHRCdG4gIT09IG51bGwgJiYgIW5leHRCdG4uZGlzYWJsZWQsXG4gICAgICBoYXNQcmV2OiBwcmV2QnRuICE9PSBudWxsICYmICFwcmV2QnRuLmRpc2FibGVkLFxuICAgIH0sXG4gICAgcGFnZVRpdGxlOiBkb2N1bWVudC50aXRsZSxcbiAgICBwYWdlVXJsOiBsb2NhdGlvbi5ocmVmLFxuICB9O1xufVxuIiwiLyoqXG4gKiBQb3J0ZWQgMToxIGZyb20gdGhlIGxlZ2FjeSBleHRlbnNpb24ncyBgcmVwbGFjZU1lbnUudHNgIChzYW1lIGVsZW1lbnRcbiAqIGRpc2NvdmVyeSAtIGluY2x1ZGluZyBzaGFkb3cgRE9NIGFuZCBpZnJhbWVzIC0gc2FtZSBIVE1MIHN0cnVjdHVyZSwgc2FtZVxuICogZGF0YS1jb21tYW5kdXJsIHZhbHVlcywgc2FtZSBoYW5kbGVVcmwvZ290b1VybCB3aXJpbmcsIHNhbWUgb25lLXNob3RcbiAqIE11dGF0aW9uT2JzZXJ2ZXIpLlxuICpcbiAqIE5PVEU6IHRoZSBsZWdhY3kgZmlsZSdzIFBlcnNpYW4gbGFiZWxzIHdlcmUgZGVzdHJveWVkIGJ5IGFuIGVuY29kaW5nIGxvc3NcbiAqIGJlZm9yZSB0aGUgaW5pdGlhbCBjb21taXQgKGV2ZXJ5IGxldHRlciBiZWNhbWUgJz8nKS4gVGhlIGxhYmVscyBiZWxvdyBhcmVcbiAqIHJlY29uc3RydWN0ZWQ7IGV2ZXJ5IFVSTC9jb21tYW5kIGF0dHJpYnV0ZSBpcyBieXRlLWlkZW50aWNhbCB0byB0aGVcbiAqIG9yaWdpbmFsLiBMYWJlbHMgYXJlIGNvc21ldGljIC0gYmVoYXZpb3IgY29tZXMgZnJvbSBkYXRhLWNvbW1hbmR1cmwuXG4gKlxuICogU2VsZi1jb250YWluZWQ6IGluamVjdGVkIHZpYSBicm93c2VyLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0LCBzbyBpdCBtdXN0XG4gKiBub3QgY2xvc2Ugb3ZlciBhbnkgaW1wb3J0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVwbGFjZU1haW5NZW51KCkge1xuICBmdW5jdGlvbiBmaW5kTWFpbk1lbnUoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgICBsZXQgbWFpbk1lbnVEaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm1haW5tZW51XCIpO1xuXG4gICAgLy8gQ2hlY2sgU2hhZG93IERPTXNcbiAgICBpZiAoIW1haW5NZW51RGl2KSB7XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKS5mb3JFYWNoKChlbCkgPT4ge1xuICAgICAgICBpZiAoZWwuc2hhZG93Um9vdCkge1xuICAgICAgICAgIGNvbnN0IHNoYWRvd0VsZW1lbnQgPSBlbC5zaGFkb3dSb290LmdldEVsZW1lbnRCeUlkKFwibWFpbm1lbnVcIik7XG4gICAgICAgICAgaWYgKHNoYWRvd0VsZW1lbnQpIHtcbiAgICAgICAgICAgIG1haW5NZW51RGl2ID0gc2hhZG93RWxlbWVudDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGluc2lkZSBpZnJhbWVzXG4gICAgaWYgKCFtYWluTWVudURpdikge1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImlmcmFtZVwiKS5mb3JFYWNoKChpZnJhbWUpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBpZnJhbWVEb2MgPVxuICAgICAgICAgICAgaWZyYW1lLmNvbnRlbnREb2N1bWVudCB8fCBpZnJhbWUuY29udGVudFdpbmRvdz8uZG9jdW1lbnQ7XG4gICAgICAgICAgaWYgKGlmcmFtZURvYykge1xuICAgICAgICAgICAgY29uc3QgaWZyYW1lRWxlbWVudCA9IGlmcmFtZURvYy5nZXRFbGVtZW50QnlJZChcIm1haW5tZW51XCIpO1xuICAgICAgICAgICAgaWYgKGlmcmFtZUVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgbWFpbk1lbnVEaXYgPSBpZnJhbWVFbGVtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gY3Jvc3Mtb3JpZ2luIGlmcmFtZSAtIHVucmVhY2hhYmxlIGJ5IGRlc2lnblxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWFpbk1lbnVEaXY7XG4gIH1cblxuICBmdW5jdGlvbiByZXBsYWNlRWxlbWVudCgpIHtcbiAgICBjb25zdCBtYWluTWVudURpdiA9IGZpbmRNYWluTWVudSgpO1xuICAgIGlmIChtYWluTWVudURpdikge1xuICAgICAgY29uc3QgbmV3RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cbiAgICAgIG5ld0VsZW1lbnQuaW5uZXJIVE1MID0gYFxuICAgICAgPGRpdiBpZD1cIm1haW5tZW51XCIgZG9qb3R5cGU9XCJpdG9yYml0LnVpLlRlc3RNZW51XCIgc2luZ2xlb3BlbmVkaXRlbT1cImZhbHNlXCIgZGlyPVwicnRsXCIgd2lkZ2V0aWQ9XCJtYWlubWVudVwiPlxuXG5cblxuXG4gICAgICA8bGluayBocmVmPVwiL0VTZXJ2aWNlcy9qcy9tZW51L21lbnUuY3NzXCIgdHlwZT1cInRleHQvY3NzXCIgcmVsPVwic3R5bGVzaGVldFwiPlxuXG4gICAgICA8Zm9ybSBuYW1lPVwiaXRvRm9ybVwiIG1ldGhvZD1cInBvc3RcIiBhY3Rpb249XCIvRVNlcnZpY2VzL3N0YXJ0QWN0aW9uLmRvXCIgb25zdWJtaXQ9XCJyZXR1cm4gZmFsc2VcIiB0YXJnZXQ9XCJfdG9wXCI+PGlucHV0IHR5cGU9XCJoaWRkZW5cIiBuYW1lPVwib3JnLmFwYWNoZS5zdHJ1dHMudGFnbGliLmh0bWwuVE9LRU5cIiB2YWx1ZT1cIjhiYTllZTQ2NjkwNWExYWFkNmQ3NzYxZmYyNjdlYTIzXCI+XG5cbiAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwiYXV0b0NvbXBsZXRlQm94XCIgcGxhY2Vob2xkZXI9XCLYrNiz2KrYrNmI24wg2K/YsdizLi4uXCIgY2xhc3M9XCJteWF1dG9jb21wbCB1aS1hdXRvY29tcGxldGUtaW5wdXRcIiBhdXRvY29tcGxldGU9XCJvZmZcIiByb2xlPVwidGV4dGJveFwiIGFyaWEtYXV0b2NvbXBsZXRlPVwibGlzdFwiIGFyaWEtaGFzcG9wdXA9XCJ0cnVlXCI+XG4gICAgICAgICAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCI+XG4gICAgICAgICAgICAgICQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgJChcIiNhdXRvQ29tcGxldGVCb3hcIikuZmFyc2lJbnB1dCgpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICA8L3NjcmlwdD5cbiAgICAgIDx1bCBjbGFzcz1cImwxXCI+XG5cbiAgICAgIDxsaSBjbGFzcz1cImwxIGN1cnJlbnRcIj48c3Ryb25nPjxzcGFuPtis2LPYqtis2YjbjCDaqdmE2KfYs9mH2KfbjCDYp9ix2KfYptmHINi02K/ZhyDYqtix2YU8L3NwYW4+PC9zdHJvbmc+PHVsIHN0eWxlPVwiaGVpZ2h0OiBhdXRvO1wiPlxuXG5cbiAgICAgIDxsaSBjbGFzcz1cImZpcnN0XCI+PGEgaWQ9XCJtaV8wXzBcIiBzdHlsZT1cImJhY2tncm91bmQtaW1hZ2U6IHVybChQYWdlcy9pbWFnZXMvaWNvbnMvam9zdGVqb295ZS1rZWxhc2UtZGFycy5wbmcpXCIgaHJlZj1cImphdmFzY3JpcHQ6IHZvaWQoMCk7XCIgb25jbGljaz1cImhhbmRsZVVybCh0aGlzKVwiIGRhdGEtY29tbWFuZHVybD1cImhhbmRsZUNvdXJzZUNsYXNzU2VhcmNoQWN0aW9uLmRvP3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTBfMCZhbXA7ZGlzcGF0Y2g9c2VsZWN0U3R1ZGVudFBhcmFtZXRlciZhbXA7c3ViamVjdD1Db3Vyc2VDbGFzcyZhbXA7ZWRpdGFibGU9ZmFsc2UmYW1wO3ByZXZpZXdhYmxlPWZhbHNlJmFtcDtwYXJhbWV0ZXIlMjhmJTVFdGVybVJlZiUyOT0lMjQlN0J1c2VyUHJvcGVydHklMjhvcGVyYXRpb25hbFRlcm0uaWQlMjklN0QmYW1wO2FkZGFibGU9ZmFsc2UmYW1wO3JlZlBhcmFtZXRlciUyOHNlbGVjdGVkVGV4dCUyOT1wYXJhbWV0ZXIlMjhjb3Vyc2VDbGFzc1RleHQlMjkmYW1wO2Zvcm09Q291cnNlQ2xhc3NMaXN0MnN0dWRlbnQmYW1wO3NlbGVjdGlvbj0wJmFtcDtwYXJhbWV0ZXIlMjhncm91cEluZGV4JTI5PTAmYW1wO2RlbGV0ZWFibGU9ZmFsc2UmYW1wO3BhcmFtZXRlciUyOGYlNUVzdHVkZW50UmVmJTI5PSUyNCU3QnVzZXJQcm9wZXJ0eSUyOHN0dWRlbnREdG8uaWQlMjklN0QmYW1wO3BhcmFtZXRlciUyOGZpbmRlciUyOT1maW5kQ291cnNlQ2xhc3M0U3R1ZGVudCZhbXA7cmVmUGFyYW1ldGVyJTI4c2VsZWN0ZWRJZCUyOT1wYXJhbWV0ZXIlMjhjb3Vyc2VDbGFzc1JlZiUyOSZhbXA7cGFyYW1ldGVyKG1lbnVJdGVtKT0wXzAmYW1wO3BhcmFtZXRlcihncm91cEluZGV4KT0wJmFtcDtfX3JwPTE0MTExMzczODEmYW1wO21lbnVHcm91cD1QbGFubmluZyZhbXA7bWVudUl0ZW1OYW1lPVN0dWRlbnRDb3Vyc2VDbGFzc0FsbFNlYXJjaCZhbXA7X0gwX189LTdcIiBvbm1vdXNlb3Zlcj1cIm51bGxcIiBvbm1vdXNlb3V0PVwibnVsbFwiPlxuICAgICAgPHNwYW4+2KzYs9iq2KzZiNuMINqp2YTYp9izINiv2LHYs9mH2KfbjCDYp9ix2KfYptmHINi02K/Zhzwvc3Bhbj48L2E+PC9saT5cblxuICAgICAgPC91bD48L2xpPlxuICAgICAgPGxpIGNsYXNzPVwibDFcIj48c3Ryb25nPjxzcGFuPtir2KjYqiDZhtin2YUg2K/YsdmI2LMg2YbbjNmF2LPYp9mEINis2KfYsduMPC9zcGFuPjwvc3Ryb25nPjx1bD5cblxuXG5cbiAgICAgIDxsaSBjbGFzcz1cImZpcnN0XCI+PGEgaWQ9XCJtaV8xXzBcIiBzdHlsZT1cImJhY2tncm91bmQtaW1hZ2U6IHVybChQYWdlcy9pbWFnZXMvaWNvbnMvbW9zaGFoZWRlLWFraGFyaW4tdmF6ZXlhdGUtZW50ZWtoYWItdmFoZWQucG5nKVwiIGhyZWY9XCJqYXZhc2NyaXB0OiB2b2lkKDApO1wiIG9uY2xpY2s9XCJoYW5kbGVVcmwodGhpcylcIiBkYXRhLWNvbW1hbmR1cmw9XCJjb25maXJtU2VsZWN0U3R1ZGVudEFjdGlvbi5kbz9wYXJhbWV0ZXIlMjhtZW51SXRlbSUyOT0xXzAmYW1wO2Zvcm09TGFzdFN0YXR1c0NvbmZpcm1TdHVkZW50TGlzdCZhbXA7cGFyYW1ldGVyJTI4ZiU1RWN1cnJlbnRUZXJtJTI5PSUyNCU3QnVzZXJQcm9wZXJ0eSUyOG9wZXJhdGlvbmFsVGVybS5pZCUyOSU3RCZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT0xJmFtcDtzdWJqZWN0PUNvbmZpcm1TdHVkZW50JmFtcDtyZXNldD10cnVlJmFtcDtmaW5kZXI9ZmluZEZvckxhc3RTdGF0dXNSZXBvcnQmYW1wO3BhcmFtZXRlcihtZW51SXRlbSk9MV8wJmFtcDtwYXJhbWV0ZXIoZ3JvdXBJbmRleCk9MSZhbXA7X19ycD0xNDExMTM3MzgxJmFtcDttZW51R3JvdXA9U3R1ZGVudF9SZWdpc3RyYXRpb24mYW1wO21lbnVJdGVtTmFtZT1MYXN0U3RhdHVzX1ZlcmlmaWNhdGlvbiZhbXA7X0gwX189MTMwXCIgb25tb3VzZW92ZXI9XCJudWxsXCIgb25tb3VzZW91dD1cIm51bGxcIj5cbiAgICAgIDxzcGFuPtmF2LTYp9mH2K/ZhyDYotiu2LHbjNmGINmI2LbYuduM2Kog2KvYqNiqINmG2KfZhSAo2KvYqNiqINmG2YfYp9uM24wpPC9zcGFuPjwvYT48L2xpPlxuXG5cblxuICAgICAgPGxpPjxhIGlkPVwibWlfMV8xXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOiB1cmwoUGFnZXMvaW1hZ2VzL2ljb25zL21vZGlyaXlhdGUtbmltc2FsaGF5ZS10YWhzaWxpLnBuZylcIiBocmVmPVwiamF2YXNjcmlwdDogdm9pZCgwKTtcIiBvbmNsaWNrPVwiaGFuZGxlVXJsKHRoaXMpXCIgZGF0YS1jb21tYW5kdXJsPVwic3R1ZGVudExhc3RTdGF0dXNBY3Rpb24uZG8/cGFyYW1ldGVyJTI4bWVudUl0ZW0lMjk9MV8xJmFtcDtuZXh0Rm9yd2FyZD0lMkZzaG93Rm9ybUFjdGlvbi5kbyUzRnN1YmplY3QlM0RTdGRTdGF0dXNGb3JtNFN0dWRlbnQmYW1wO3NlbGVjdGlvbj0xJmFtcDtmb3JtPUxhc3RzdGRUZXJtZnJvbXdiazRFeHRlbmRlZFN0dWRlbnRMaXN0JmFtcDtwYXJhbWV0ZXIlMjhncm91cEluZGV4JTI5PTEmYW1wO3BhcmFtZXRlciUyOGZpbmRlciUyOT1maW5kTGFzdHN0dWRlbnRUZXJtZnJvbXdvcmtib29rJmFtcDtzZWxlY3RGb3J3YXJkPSUyRnNob3dGb3JtQWN0aW9uLmRvJTNGc3ViamVjdCUzRFN0ZFN0YXR1c0Zvcm0mYW1wO3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTFfMSZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT0xJmFtcDtfX3JwPTE0MTExMzczODEmYW1wO21lbnVHcm91cD1TdHVkZW50X1JlZ2lzdHJhdGlvbiZhbXA7bWVudUl0ZW1OYW1lPVN0dWRlbnRMYXN0U3RhdHVzJmFtcDtfSDBfXz0yODBcIiBvbm1vdXNlb3Zlcj1cIm51bGxcIiBvbm1vdXNlb3V0PVwibnVsbFwiPlxuICAgICAgPHNwYW4+2YXYtNin2YfYr9mHINmE24zYs9iqINmG24zZhdiz2KfZhNmH2KfbjCDYqtit2LXbjNmE24wg2q/YsNi02KrZhzwvc3Bhbj48L2E+PC9saT5cblxuXG5cbiAgICAgIDxsaT48YSBpZD1cIm1pXzFfMlwiIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTogdXJsKFBhZ2VzL2ltYWdlcy9pY29ucy9kb3Jvb3NlLWdoYWJlbGUtZXJhZWgucG5nKVwiIGhyZWY9XCJqYXZhc2NyaXB0OiB2b2lkKDApO1wiIG9uY2xpY2s9XCJoYW5kbGVVcmwodGhpcylcIiBkYXRhLWNvbW1hbmR1cmw9XCJhdGllaFdhbGxldEVQYXltZW50QWN0aW9uLmRvP3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTFfMiZhbXA7ZGlzcGF0Y2g9Z29Ub1dhbGxldEFwcCZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT0xJmFtcDtwYXJhbWV0ZXIlMjhtZW51SXRlbSUyOT0xXzImYW1wO3BhcmFtZXRlciUyOGdyb3VwSW5kZXglMjk9MSZhbXA7bmV3V2luZG93PXRydWUmYW1wO19fcnA9MTQxMTEzNzM4MSZhbXA7bWVudUdyb3VwPVN0dWRlbnRfUmVnaXN0cmF0aW9uJmFtcDttZW51SXRlbU5hbWU9V2FsbGV0JmFtcDtfSDBfXz00MDJcIiBvbm1vdXNlb3Zlcj1cIm51bGxcIiBvbm1vdXNlb3V0PVwibnVsbFwiPlxuICAgICAgPHNwYW4+2qnbjNmBINm+2YjZhCDYp9m+2YTbjNqp24zYtNmGINmH2YXYsdin2Yc8L3NwYW4+PC9hPjwvbGk+XG5cblxuICAgICAgPGxpPjxhIGlkPVwibWlfMV8zXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOiB1cmwoUGFnZXMvaW1hZ2VzL2ljb25zL2Rvcm9vc2UtZ2hhYmVsZS1lcmFlaC5wbmcpXCIgaHJlZj1cImphdmFzY3JpcHQ6IHZvaWQoMCk7XCIgb25jbGljaz1cImhhbmRsZVVybCh0aGlzKVwiIGRhdGEtY29tbWFuZHVybD1cInN0dWRlbnRMYXN0U3RhdHVzQWN0aW9uLmRvP3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTFfMyZhbXA7bmV4dEZvcndhcmQ9JTJGaGFuZGxlRVBheW1lbnRBY3Rpb24uZG8lM0ZkaXNwYXRjaCUzRHNob3dBbGxQYXltZW50cyZhbXA7c2VsZWN0aW9uPTEmYW1wO2Zvcm09TGFzdHN0ZFRlcm1mcm9td2JrNEV4dGVuZGVkU3R1ZGVudExpc3QmYW1wO3BhcmFtZXRlciUyOGdyb3VwSW5kZXglMjk9MSZhbXA7cGFyYW1ldGVyJTI4ZmluZGVyJTI5PWZpbmQ0TWFuYWdlJmFtcDtwYXJhbWV0ZXIlMjhtZW51SXRlbSUyOT0xXzMmYW1wO3BhcmFtZXRlciUyOGdyb3VwSW5kZXglMjk9MSZhbXA7X19ycD0xNDExMTM3MzgxJmFtcDttZW51R3JvdXA9U3R1ZGVudF9SZWdpc3RyYXRpb24mYW1wO21lbnVJdGVtTmFtZT1TdHVkZW50UmVxdWlyZW1lbnRzNFBheW1lbnQmYW1wO19IMF9fPTI2OFwiIG9ubW91c2VvdmVyPVwibnVsbFwiIG9ubW91c2VvdXQ9XCJudWxsXCI+XG4gICAgICA8c3Bhbj7Zvtix2K/Yp9iu2Kog2KfZgtiz2KfYtzwvc3Bhbj48L2E+PC9saT5cblxuXG5cbiAgICAgIDxsaT48YSBpZD1cIm1pXzFfNFwiIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTogdXJsKFBhZ2VzL2ltYWdlcy9pY29ucy9tb2Rpcml5YXRlLW5pbXNhbGhheWUtdGFoc2lsaS5wbmcpXCIgaHJlZj1cImphdmFzY3JpcHQ6IHZvaWQoMCk7XCIgb25jbGljaz1cImhhbmRsZVVybCh0aGlzKVwiIGRhdGEtY29tbWFuZHVybD1cInN0dWRlbnRMYXN0U3RhdHVzQWN0aW9uLmRvP3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTFfNCZhbXA7dGVybVJlZj0lMjQlN0J1c2VyUHJvcGVydHklMjhvcGVyYXRpb25hbFRlcm0uaWQlMjklN0QmYW1wO25leHRGb3J3YXJkPSUyRnNob3dGb3JtQWN0aW9uLmRvJTNGc3ViamVjdCUzRHN0dWRlbnRSZWdDb3Vyc2VGb3JtNE9iamVjdGlvbiZhbXA7c2VsZWN0aW9uPTAmYW1wO2Zvcm09U3R1ZGVudExpc3Q0Q3VycmVudE9iamVjdGlvbiZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT0xJmFtcDtwYXJhbWV0ZXIlMjhmaW5kZXIlMjk9ZmluZEJ5Q29uZGl0aW9uJmFtcDtjaGVja0RlYml0T3BlcmF0aW9uPXNob3dHcmFkZXMmYW1wO3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTFfNCZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT0xJmFtcDtfX3JwPTE0MTExMzczODEmYW1wO21lbnVHcm91cD1FdmFsdWF0aW9uJmFtcDttZW51SXRlbU5hbWU9T2JqZWN0aW9uR3JhZGVDdXJyZW50JmFtcDtfSDBfXz01NlwiIG9ubW91c2VvdmVyPVwibnVsbFwiIG9ubW91c2VvdXQ9XCJudWxsXCI+XG4gICAgICA8c3Bhbj7Zhdi02KfZh9iv2Ycg2YjYtti524zYqiDYp9i52KrYsdin2LYg2KjZhyDZhtmF2LHZhyDYr9ixINiq2LHZhSDYrNin2LHbjDwvc3Bhbj48L2E+PC9saT5cblxuXG5cbiAgICAgIDxsaT48YSBpZD1cIm1pXzFfNVwiIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTogdXJsKFBhZ2VzL2ltYWdlcy9pY29ucy9pbmZvcm1hdGlvbi5naWYpXCIgaHJlZj1cImphdmFzY3JpcHQ6IHZvaWQoMCk7XCIgb25jbGljaz1cImhhbmRsZVVybCh0aGlzKVwiIGRhdGEtY29tbWFuZHVybD1cInN0dWRlbnRMYXN0U3RhdHVzQWN0aW9uLmRvP3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTFfNSZhbXA7bmV4dEZvcndhcmQ9JTJGc2hvd1BhZ2VBY3Rpb24uZG8lM0ZwYWdlJTNEJTJGUGFnZXMlMkZvZmZpY2UlMkZzdHVkZW50UmVxdWVzdC5qc3AmYW1wO3NlbGVjdGlvbj0wJmFtcDtmb3JtPVN0dWRlbnRMaXN0NEFjdGl2aXRpZXMmYW1wO3BhcmFtZXRlciUyOGdyb3VwSW5kZXglMjk9MSZhbXA7cGFyYW1ldGVyJTI4ZmluZGVyJTI5PWZpbmRCeUNvbmRpdGlvbiZhbXA7cGFyYW1ldGVyJTI4bWVudUl0ZW0lMjk9MV81JmFtcDtwYXJhbWV0ZXIlMjhncm91cEluZGV4JTI5PTEmYW1wO19fcnA9MTQxMTEzNzM4MSZhbXA7bWVudUdyb3VwPU9mZmljZSZhbXA7bWVudUl0ZW1OYW1lPVN0dWRlbnRFZHVjYXRpb25hbEFjdGl2aXRpZXMmYW1wO19IMF9fPTI0MlwiIG9ubW91c2VvdmVyPVwibnVsbFwiIG9ubW91c2VvdXQ9XCJudWxsXCI+XG4gICAgICA8c3Bhbj7Zgdi52KfZhNuM2Kog2YfYp9uMINii2YXZiNiy2LTbjCDYr9in2YbYtNis2Yg8L3NwYW4+PC9hPjwvbGk+XG5cblxuXG4gICAgICA8bGk+PGEgaWQ9XCJtaV8xXzZcIiBzdHlsZT1cImJhY2tncm91bmQtaW1hZ2U6IHVybChQYWdlcy9pbWFnZXMvaWNvbnMvbW9zaGFoZWRlLWthcm5hbWUtZGFuZXNoam9vZWkucG5nKVwiIGhyZWY9XCJqYXZhc2NyaXB0OiB2b2lkKDApO1wiIG9uY2xpY2s9XCJoYW5kbGVVcmwodGhpcylcIiBkYXRhLWNvbW1hbmR1cmw9XCJMb2FkV29ya1NoZWV0QWN0aW9uLmRvP2Rpc3BhdGNoPVZpZXcmYW1wO3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTFfNiZhbXA7cGFyYW1ldGVyJTI4ZmxhZyUyOT1mYWxzZSZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT0xJmFtcDtzdWJqZWN0PUxvYWRTdHVkZW50V29ya0Jvb2smYW1wO3N0dWRlbnRSZXF1ZXN0PXRydWUmYW1wO3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTFfNiZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT0xJmFtcDtfX3JwPTE0MTExMzczODEmYW1wO21lbnVHcm91cD1TdHVkZW50X1JlZ2lzdHJhdGlvbiZhbXA7bWVudUl0ZW1OYW1lPVZpZXdTdHVkZW50V29ya0Jvb2smYW1wO19IMF9fPTc0N1wiIG9ubW91c2VvdmVyPVwibnVsbFwiIG9ubW91c2VvdXQ9XCJudWxsXCI+XG4gICAgICA8c3Bhbj7Zhdi02KfZh9iv2Ycg2qnYp9ix2YbYp9mF2Ycg2K/Yp9mG2LTYrNmI24zbjDwvc3Bhbj48L2E+PC9saT5cblxuICAgICAgPC91bD48L2xpPlxuICAgICAgPGxpIGNsYXNzPVwibDFcIj48c3Ryb25nPjxzcGFuPti12YbYr9mI2YIg2LHZgdin2Ycg2K/Yp9mG2LTYrNmI24zbjDwvc3Bhbj48L3N0cm9uZz48dWw+XG5cblxuXG4gICAgICA8bGkgY2xhc3M9XCJmaXJzdFwiPjxhIGlkPVwibWlfMl8wXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOiB1cmwoUGFnZXMvaW1hZ2VzL2ljb25zL25vSWNvbi5naWYpXCIgaHJlZj1cImphdmFzY3JpcHQ6IHZvaWQoMCk7XCIgb25jbGljaz1cImhhbmRsZVVybCh0aGlzKVwiIGRhdGEtY29tbWFuZHVybD1cInN0dWRlbnRMYXN0U3RhdHVzQWN0aW9uLmRvP3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTJfMCZhbXA7bmV4dEZvcndhcmQ9JTJGc2hvd0Zvcm1BY3Rpb24uZG8lM0ZzdWJqZWN0JTNEU3RkTG9hbkZvcm0mYW1wO3NlbGVjdGlvbj0wJmFtcDtmb3JtPVN0dWRlbnRMaXN0NExvYW5SZXF1ZXN0JmFtcDtwYXJhbWV0ZXIlMjhncm91cEluZGV4JTI5PTImYW1wO25lZWQyU2V0Vmlld2FibGVTdWJqZWN0QXR0cmlidXRlPXRydWUmYW1wO3BhcmFtZXRlciUyOGZpbmRlciUyOT1maW5kQnlDb25kaXRpb24mYW1wO3JlcXVlc3RTdWJqZWN0Q2F0ZWdvcnk9TE9BTiZhbXA7cGFyYW1ldGVyJTI4bWVudUl0ZW0lMjk9Ml8wJmFtcDtwYXJhbWV0ZXIlMjhncm91cEluZGV4JTI5PTImYW1wO19fcnA9MTQxMTEzNzM4MSZhbXA7bWVudUdyb3VwPVN0dWRlbnRXZWxmYXJlRnVuZCZhbXA7bWVudUl0ZW1OYW1lPVN0dWRlbnRMb2FuUmVxdWVzdCZhbXA7X0gwX189MjY5XCIgb25tb3VzZW92ZXI9XCJudWxsXCIgb25tb3VzZW91dD1cIm51bGxcIj5cbiAgICAgIDxzcGFuPtmI2KfZhS/Yp9iz2KrYrtiv2KfZhSDYr9in2YbYtNis2YjbjNuMPC9zcGFuPjwvYT48L2xpPlxuXG4gICAgICA8L3VsPjwvbGk+XG4gICAgICA8bGkgY2xhc3M9XCJsMVwiPjxzdHJvbmc+PHNwYW4+2K/Ysdiu2YjYp9iz2Kog2YXYr9in2LHaqSDYr9in2YbYtNis2Yg8L3NwYW4+PC9zdHJvbmc+PHVsPlxuXG4gICAgICA8bGkgY2xhc3M9XCJmaXJzdFwiPjxhIGlkPVwibWlfM18wXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOiB1cmwoUGFnZXMvaW1hZ2VzL2ljb25zL25vSWNvbi5naWYpXCIgaHJlZj1cImphdmFzY3JpcHQ6IHZvaWQoMCk7XCIgb25jbGljaz1cImhhbmRsZVVybCh0aGlzKVwiIGRhdGEtY29tbWFuZHVybD1cInN0dWRlbnRMYXN0U3RhdHVzQWN0aW9uLmRvP3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTNfMCZhbXA7bmV4dEZvcndhcmQ9JTJGc2hvd0Zvcm1BY3Rpb24uZG8lM0ZzdWJqZWN0JTNEU3RkQWx1bW5pRG9jRm9ybSZhbXA7c2VsZWN0aW9uPTAmYW1wO2Zvcm09U3R1ZGVudExpc3Q0QWx1bW5pRG9jUmVxdWVzdCZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT0zJmFtcDtuZWVkMlNldFZpZXdhYmxlU3ViamVjdEF0dHJpYnV0ZT10cnVlJmFtcDtyZXF1ZXN0U3ViamVjdERpc3BhdGNoVHlwZT1DUkVBVEVfQUxVTU5JX1JFQ09SRCZhbXA7cGFyYW1ldGVyJTI4ZmluZGVyJTI5PWZpbmRCeUNvbmRpdGlvbiZhbXA7cGFyYW1ldGVyJTI4bWVudUl0ZW0lMjk9M18wJmFtcDtwYXJhbWV0ZXIlMjhncm91cEluZGV4JTI5PTMmYW1wO19fcnA9MTQxMTEzNzM4MSZhbXA7bWVudUdyb3VwPUFsdW1uaVJlY29yZCZhbXA7bWVudUl0ZW1OYW1lPVN0dWRlbnRBbHVtbmlSZWNvcmRSZXF1ZXN0JmFtcDtfSDBfXz0yMTNcIiBvbm1vdXNlb3Zlcj1cIm51bGxcIiBvbm1vdXNlb3V0PVwibnVsbFwiPlxuICAgICAgPHNwYW4+2KvYqNiqL9m+24zar9uM2LHbjCDYr9ix2K7ZiNin2LPYqiDZhdiv2KfYsdqpINmB2KfYsdi6INin2YTYqtit2LXbjNmEPC9zcGFuPjwvYT48L2xpPlxuXG4gICAgICA8L3VsPjwvbGk+XG4gICAgICA8bGkgY2xhc3M9XCJsMVwiPjxzdHJvbmc+PHNwYW4+2K/Ysdiu2YjYp9iz2Kov2LPYp9uM2LE8L3NwYW4+PC9zdHJvbmc+PHVsPlxuXG4gICAgICA8bGkgY2xhc3M9XCJmaXJzdFwiPjxhIGlkPVwibWlfNF8wXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOiB1cmwoUGFnZXMvaW1hZ2VzL2ljb25zL3NhYnRlLWRhcmtoYXN0LnBuZylcIiBocmVmPVwiamF2YXNjcmlwdDogdm9pZCgwKTtcIiBvbmNsaWNrPVwiaGFuZGxlVXJsKHRoaXMpXCIgZGF0YS1jb21tYW5kdXJsPVwic3R1ZGVudExhc3RTdGF0dXNBY3Rpb24uZG8/cGFyYW1ldGVyJTI4bWVudUl0ZW0lMjk9NF8wJmFtcDtuZXh0Rm9yd2FyZD0lMkZzaG93UGFnZUFjdGlvbi5kbyUzRnBhZ2UlM0QlMkZQYWdlcyUyRm9mZmljZSUyRnN0dWRlbnRSZXF1ZXN0LmpzcCZhbXA7c2VsZWN0aW9uPTAmYW1wO2Zvcm09U3R1ZGVudExpc3Q0UmVxdWVzdCZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT00JmFtcDtuZWVkMlNldFZpZXdhYmxlU3ViamVjdEF0dHJpYnV0ZT10cnVlJmFtcDtwYXJhbWV0ZXIlMjhmaW5kZXIlMjk9ZmluZEJ5Q29uZGl0aW9uJmFtcDtyZXF1ZXN0U3ViamVjdENhdGVnb3J5PUxPQU4mYW1wO3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTRfMCZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT00JmFtcDtfX3JwPTE0MTExMzczODEmYW1wO21lbnVHcm91cD1PZmZpY2UmYW1wO21lbnVJdGVtTmFtZT1TdHVkZW50UmVxdWVzdCZhbXA7X0gwX189Mzg1XCIgb25tb3VzZW92ZXI9XCJudWxsXCIgb25tb3VzZW91dD1cIm51bGxcIj5cbiAgICAgIDxzcGFuPtir2KjYqi8g2b7bjNqv24zYsduMINiv2LHYrtmI2KfYs9iqINmH2KfbjCDYp9iv2KfYsduMPC9zcGFuPjwvYT48L2xpPlxuXG4gICAgICA8L3VsPjwvbGk+XG4gICAgICA8bGkgY2xhc3M9XCJsMVwiPjxzdHJvbmc+PHNwYW4+2KfYsdiy2LTbjNin2KjbjCDYp9iz2KrYp9ivPC9zcGFuPjwvc3Ryb25nPjx1bD5cblxuICAgICAgPGxpIGNsYXNzPVwiZmlyc3RcIj48YSBpZD1cIm1pXzVfMFwiIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTogdXJsKFBhZ2VzL2ltYWdlcy9pY29ucy9tb2Rpcml5YXRlLW5pbXNhbGhheWUtdGFoc2lsaS5wbmcpXCIgaHJlZj1cImphdmFzY3JpcHQ6IHZvaWQoMCk7XCIgb25jbGljaz1cImhhbmRsZVVybCh0aGlzKVwiIGRhdGEtY29tbWFuZHVybD1cInN0dWRlbnRMYXN0U3RhdHVzQWN0aW9uLmRvP3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTVfMCZhbXA7dGVybVJlZj0lMjQlN0J1c2VyUHJvcGVydHklMjhvcGVyYXRpb25hbFRlcm0uaWQlMjklN0QmYW1wO25leHRGb3J3YXJkPSUyRnNob3dGb3JtQWN0aW9uLmRvJTNGc3ViamVjdCUzRHN0dWRlbnRSZWdDb3Vyc2VGb3JtNEV2YWwmYW1wO3NlbGVjdGlvbj0wJmFtcDtmb3JtPVN0dWRlbnRMaXN0NEN1cnJlbnRFdmFsdWF0aW9uJmFtcDtwYXJhbWV0ZXIlMjhncm91cEluZGV4JTI5PTUmYW1wO3BhcmFtZXRlciUyOGZpbmRlciUyOT1maW5kQnlDb25kaXRpb24mYW1wO3BhcmFtZXRlciUyOG1lbnVJdGVtJTI5PTVfMCZhbXA7cGFyYW1ldGVyJTI4Z3JvdXBJbmRleCUyOT01JmFtcDtfX3JwPTE0MTExMzczODEmYW1wO21lbnVHcm91cD1FdmFsdWF0aW9uJmFtcDttZW51SXRlbU5hbWU9RXZhbHVhdGlvblByb2ZmQ3VycmVudCZhbXA7X0gwX189MTA5XCIgb25tb3VzZW92ZXI9XCJudWxsXCIgb25tb3VzZW91dD1cIm51bGxcIj5cbiAgICAgIDxzcGFuPtin2LHYsti024zYp9io24wg2KfYs9iq2KfYryDYr9ixINiq2LHZhSDYrNin2LHbjDwvc3Bhbj48L2E+PC9saT5cblxuICAgICAgPC91bD48L2xpPjwvdWw+XG4gICAgICAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCI+XG4gICAgICAgICAgZnVuY3Rpb24gaGFuZGxlVXJsKGVsZW0pe1xuICAgICAgICAgICAgIC8vIHJpZ2h0Q2xpY2soKTtcbiAgICAgICAgICAgICAvL2FsZXJ0KFwiaGFuZGxlciBjYWxsZWQ6XFxcXG5cIit1cmwpO1xuICAgICAgICAgICAgIHZhciBjbWQgPSBlbGVtLmdldEF0dHJpYnV0ZShcImRhdGEtY29tbWFuZFVybFwiKTtcbiAgICAgICAgICAgICAgZ290b1VybChcIml0b0Zvcm1cIixjbWQpO1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgIDwvc2NyaXB0PlxuICAgICAgPC9mb3JtPlxuXG4gICAgICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBzcmM9XCIvRVNlcnZpY2VzL2pzL21lbnUvbWVudS5qc1wiPjwvc2NyaXB0PlxuICAgICAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgc3JjPVwiL0VTZXJ2aWNlcy9qcy9QZXJzaWFuS2V5Ym9hcmQvanF1ZXJ5LmZhcnNpSW5wdXQuanNcIj48L3NjcmlwdD5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgYDtcbiAgICAgIG1haW5NZW51RGl2LnBhcmVudE5vZGU/LnJlcGxhY2VDaGlsZChuZXdFbGVtZW50LCBtYWluTWVudURpdik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0VsZW1lbnQgd2l0aCBJRCBcIm1haW5tZW51XCIgbm90IGZvdW5kLicpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEVuc3VyZSB0aGUgc2NyaXB0IHJ1bnMgYWZ0ZXIgdGhlIERPTSBpcyBmdWxseSBsb2FkZWRcbiAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgcmVwbGFjZUVsZW1lbnQpO1xuICB9IGVsc2Uge1xuICAgIHJlcGxhY2VFbGVtZW50KCk7XG4gIH1cblxuICAvLyBPYnNlcnZlIGR5bmFtaWMgY2hhbmdlc1xuICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICByZXBsYWNlRWxlbWVudCgpO1xuICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTsgLy8gU3RvcCBvYnNlcnZpbmcgb25jZSByZXBsYWNlZFxuICB9KTtcblxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xufVxuIiwiaW1wb3J0IHR5cGUgeyBQYWdpbmdJbmZvIH0gZnJvbSBcIi4uLy4uL2xpYi90eXBlc1wiO1xuaW1wb3J0IHR5cGUgeyBVbml2ZXJzaXR5QWRhcHRlciB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHsgc2NyYXBlT2ZmZXJpbmdzRnJvbVBhZ2UgfSBmcm9tIFwiLi9zY3JhcGVcIjtcbmltcG9ydCB7IHJlcGxhY2VNYWluTWVudSB9IGZyb20gXCIuL3JlcGxhY2UtbWVudVwiO1xuXG4vKipcbiAqIElzbGFtaWMgQXphZCBVbml2ZXJzaXR5IC0gdGhlIEVTZXJ2aWNlcyAo2KLZhdmI2LLYtNuM2KfYsSkgc3R1ZGVudCBwb3J0YWwuXG4gKiBUaGUgc2FtZSBzb2Z0d2FyZSBpcyB1c2VkIGJ5IG1hbnkgSXJhbmlhbiB1bml2ZXJzaXRpZXMsIHNvIHRoZSBnZW5lcmljXG4gKiBmYWxsYmFjayBhZGFwdGVyIHJldXNlcyB0aGVzZSBmdW5jdGlvbnMuXG4gKi9cbmV4cG9ydCBjb25zdCBhemFkOiBVbml2ZXJzaXR5QWRhcHRlciA9IHtcbiAgaWQ6IFwiYXphZFwiLFxuICBuYW1lOiBcItiv2KfZhti02q/Yp9mHINii2LLYp9ivINin2LPZhNin2YXbjFwiLFxuICBkZXRlY3Q6ICh1cmwpID0+IC9pYXVcXC5pcnxlc2VydmljZXN8YW1vb3plc2h8c2FuamVzaC9pLnRlc3QodXJsKSxcblxuICBzY3JhcGU6IHNjcmFwZU9mZmVyaW5nc0Zyb21QYWdlLFxuICByZWFkUGFnaW5nOiByZWFkQXphZFBhZ2luZyxcblxuICBuZXh0UGFnZVNlbGVjdG9yOiBcInNwYW4jbmV4dFBhZ2UgYnV0dG9uXCIsXG4gIHByZXZQYWdlU2VsZWN0b3I6IFwic3BhbiNwcmVQYWdlIGJ1dHRvblwiLFxuXG4gIHJlcGxhY2VNZW51OiByZXBsYWNlTWFpbk1lbnUsXG59O1xuXG4vKiogU2VsZi1jb250YWluZWQgaW5qZWN0ZWQgcGFnaW5nIHJlYWRlciAo2LHZg9mI2LHYryBYINiq2KcgWSDYp9iyIFopLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRBemFkUGFnaW5nKCk6IFBhZ2luZ0luZm8ge1xuICBmdW5jdGlvbiB0b0VuZ2xpc2hEaWdpdHModGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGV4dC5yZXBsYWNlKC9b27At27nZoC3ZqV0vZywgKGNoKSA9PiB7XG4gICAgICBjb25zdCBwZXJzaWFuID0gXCLbsNux27Lbs9u027Xbttu327jbuVwiLmluZGV4T2YoY2gpO1xuICAgICAgaWYgKHBlcnNpYW4gIT09IC0xKSByZXR1cm4gU3RyaW5nKHBlcnNpYW4pO1xuICAgICAgcmV0dXJuIFN0cmluZyhcItmg2aHZotmj2aTZpdmm2afZqNmpXCIuaW5kZXhPZihjaCkpO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgcGFnaW5nVGV4dCA9IHRvRW5nbGlzaERpZ2l0cyhcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBhZ2luZ1wiKT8udGV4dENvbnRlbnQgPz8gXCJcIixcbiAgKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKTtcblxuICBjb25zdCBtYXRjaCA9IC8oXFxkKylcXHMq2KrYp1xccyooXFxkKylcXHMq2KfYslxccyooXFxkKykvLmV4ZWMocGFnaW5nVGV4dCk7XG4gIGNvbnN0IHRvdGFsRnJvbVNwYW4gPSBOdW1iZXIoXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiN0b3RhbFNlYXJjaENvdW50XCIpPy50ZXh0Q29udGVudD8udHJpbSgpID8/IFwiXCIsXG4gICk7XG5cbiAgY29uc3QgbmV4dEJ0biA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEJ1dHRvbkVsZW1lbnQ+KFxuICAgIFwic3BhbiNuZXh0UGFnZSBidXR0b25cIixcbiAgKTtcbiAgY29uc3QgcHJldkJ0biA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEJ1dHRvbkVsZW1lbnQ+KFxuICAgIFwic3BhbiNwcmVQYWdlIGJ1dHRvblwiLFxuICApO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxSZWNvcmRzOiBtYXRjaFxuICAgICAgPyBOdW1iZXIobWF0Y2hbM10pXG4gICAgICA6IE51bWJlci5pc0Zpbml0ZSh0b3RhbEZyb21TcGFuKSAmJiB0b3RhbEZyb21TcGFuID4gMFxuICAgICAgICA/IHRvdGFsRnJvbVNwYW5cbiAgICAgICAgOiBudWxsLFxuICAgIGZyb206IG1hdGNoID8gTnVtYmVyKG1hdGNoWzFdKSA6IG51bGwsXG4gICAgdG86IG1hdGNoID8gTnVtYmVyKG1hdGNoWzJdKSA6IG51bGwsXG4gICAgaGFzTmV4dDogbmV4dEJ0biAhPT0gbnVsbCAmJiAhbmV4dEJ0bi5kaXNhYmxlZCxcbiAgICBoYXNQcmV2OiBwcmV2QnRuICE9PSBudWxsICYmICFwcmV2QnRuLmRpc2FibGVkLFxuICB9O1xufVxuIiwiaW1wb3J0IHR5cGUgeyBVbml2ZXJzaXR5QWRhcHRlciB9IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQge1xuICBhemFkLFxuICByZWFkQXphZFBhZ2luZyxcbn0gZnJvbSBcIi4vYXphZFwiO1xuaW1wb3J0IHsgc2NyYXBlT2ZmZXJpbmdzRnJvbVBhZ2UgfSBmcm9tIFwiLi9hemFkL3NjcmFwZVwiO1xuXG5leHBvcnQgdHlwZSB7IFVuaXZlcnNpdHlBZGFwdGVyIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLyoqXG4gKiBSZWdpc3RyeSBvZiBzdXBwb3J0ZWQgdW5pdmVyc2l0eSBwb3J0YWxzLiBBZGQgbmV3IHVuaXZlcnNpdGllcyBhcyBhIGZvbGRlclxuICogdW5kZXIgc3JjL3VuaXZlcnNpdGllcy88aWQ+LyBhbmQgbGlzdCB0aGUgYWRhcHRlciBoZXJlIC0gZmlyc3QgbWF0Y2ggd2lucyxcbiAqIHNvIHB1dCBzcGVjaWZpYyBwb3J0YWxzIGJlZm9yZSB0aGUgZ2VuZXJpYyBmYWxsYmFjay5cbiAqL1xuZXhwb3J0IGNvbnN0IFVOSVZFUlNJVElFUzogVW5pdmVyc2l0eUFkYXB0ZXJbXSA9IFtcbiAgYXphZCxcbl07XG5cbi8qKiBTdHJ1Y3R1cmFsIGZhbGxiYWNrOiB0aGUgYXphZCBzY3JhcGVyIGlzIHRhYmxlLWRyaXZlbiBhbmQgd29ya3Mgb24gYW55XG4gKiAg2KLZhdmI2LLYtNuM2KfYsS1zdHlsZSBwb3J0YWwsIHNvIHVua25vd24gaG9zdHMgc3RpbGwgZXh0cmFjdCBmaW5lLiAqL1xuY29uc3QgZ2VuZXJpYzogVW5pdmVyc2l0eUFkYXB0ZXIgPSB7XG4gIGlkOiBcImdlbmVyaWNcIixcbiAgbmFtZTogXCLYs9in24zYqiDZhtin2LTZhtin2LMgKNit2KfZhNiqINi52YXZiNmF24wpXCIsXG4gIGRldGVjdDogKCkgPT4gdHJ1ZSxcblxuICBzY3JhcGU6IHNjcmFwZU9mZmVyaW5nc0Zyb21QYWdlLFxuICByZWFkUGFnaW5nOiByZWFkQXphZFBhZ2luZyxcblxuICBuZXh0UGFnZVNlbGVjdG9yOiBcInNwYW4jbmV4dFBhZ2UgYnV0dG9uXCIsXG4gIHByZXZQYWdlU2VsZWN0b3I6IFwic3BhbiNwcmVQYWdlIGJ1dHRvblwiLFxufTtcblxuLyoqIFBpY2sgdGhlIGFkYXB0ZXIgZm9yIGEgdGFiIFVSTCAtIGFsd2F5cyByZXR1cm5zIG9uZSAoZ2VuZXJpYyBmYWxsYmFjaykuICovXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0VW5pdmVyc2l0eSh1cmw6IHN0cmluZyk6IFVuaXZlcnNpdHlBZGFwdGVyIHtcbiAgcmV0dXJuIFVOSVZFUlNJVElFUy5maW5kKCh1KSA9PiB1LmRldGVjdCh1cmwpKSA/PyBnZW5lcmljO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pdmVyc2l0eUFkYXB0ZXIoaWQ6IHN0cmluZyk6IFVuaXZlcnNpdHlBZGFwdGVyIHtcbiAgcmV0dXJuIFVOSVZFUlNJVElFUy5maW5kKCh1KSA9PiB1LmlkID09PSBpZCkgPz8gZ2VuZXJpYztcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG5jbGFzcyBOb2RlIHtcbiAgY29uc3RydWN0b3IgKGRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhXG4gIH1cbn1cblxuY2xhc3MgTGlua2VkTGlzdCB7XG4gIGNvbnN0cnVjdG9yICgpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDBcbiAgfVxuXG4gIGVucXVldWUgKGRhdGEpIHtcbiAgICBjb25zdCBub2RlID0gbmV3IE5vZGUoZGF0YSlcbiAgICBub2RlLnByZXYgPSB0aGlzLnRhaWxcbiAgICBpZiAodGhpcy50YWlsKSB0aGlzLnRhaWwubmV4dCA9IG5vZGVcbiAgICBlbHNlIHRoaXMuaGVhZCA9IG5vZGVcbiAgICB0aGlzLnRhaWwgPSBub2RlXG4gICAgdGhpcy5sZW5ndGgrK1xuICAgIHJldHVybiBub2RlXG4gIH1cblxuICBkZXF1ZXVlICgpIHtcbiAgICBpZiAoIXRoaXMuaGVhZCkgcmV0dXJuXG4gICAgY29uc3QgeyBkYXRhIH0gPSB0aGlzLmhlYWRcbiAgICB0aGlzLnJlbW92ZSh0aGlzLmhlYWQpXG4gICAgcmV0dXJuIGRhdGFcbiAgfVxuXG4gIHJlbW92ZSAobm9kZSkge1xuICAgIGlmIChub2RlLnByZXYpIG5vZGUucHJldi5uZXh0ID0gbm9kZS5uZXh0XG4gICAgZWxzZSB0aGlzLmhlYWQgPSBub2RlLm5leHRcbiAgICBpZiAobm9kZS5uZXh0KSBub2RlLm5leHQucHJldiA9IG5vZGUucHJldlxuICAgIGVsc2UgdGhpcy50YWlsID0gbm9kZS5wcmV2XG4gICAgdGhpcy5sZW5ndGgtLVxuICB9XG5cbiAgc2l6ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMubGVuZ3RoXG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSAoc2xvdHMgPSAxKSA9PiB7XG4gIGNvbnN0IHF1ZXVlID0gbmV3IExpbmtlZExpc3QoKVxuXG4gIGNvbnN0IHJlbGVhc2UgPSAoKSA9PiB7XG4gICAgKytzbG90c1xuICAgIGNvbnN0IHdhaXRlciA9IHF1ZXVlLmRlcXVldWUoKVxuICAgIGlmICh3YWl0ZXIpIHJldHVybiB3YWl0ZXIuYWNxdWlyZSgpXG4gIH1cblxuICBjb25zdCBhY3F1aXJlID0gcmVzb2x2ZSA9PiB7XG4gICAgLS1zbG90c1xuICAgIHJlc29sdmUocmVsZWFzZSlcbiAgfVxuXG4gIGNvbnN0IGxvY2sgPSBzaWduYWwgPT5cbiAgICBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgIGlmIChzaWduYWwgIT0gbnVsbCAmJiB0eXBlb2Ygc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYHNpZ25hbGAgbmVlZHMgdG8gYmUgYW4gQWJvcnRTaWduYWwuJylcbiAgICAgIH1cbiAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHJldHVybiByZXNvbHZlKG51bGwpXG4gICAgICBpZiAoIWxvY2suaXNMb2NrZWQoKSkgcmV0dXJuIGFjcXVpcmUocmVzb2x2ZSlcblxuICAgICAgY29uc3Qgd2FpdGVyID0geyBhY3F1aXJlOiAoKSA9PiBhY3F1aXJlKHJlc29sdmUpIH1cbiAgICAgIGNvbnN0IG5vZGUgPSBxdWV1ZS5lbnF1ZXVlKHdhaXRlcilcblxuICAgICAgaWYgKHNpZ25hbCAhPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IG9uQWJvcnQgPSAoKSA9PiB7XG4gICAgICAgICAgcXVldWUucmVtb3ZlKG5vZGUpXG4gICAgICAgICAgcmVzb2x2ZShudWxsKVxuICAgICAgICB9XG4gICAgICAgIHdhaXRlci5hY3F1aXJlID0gKCkgPT4ge1xuICAgICAgICAgIHNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKCdhYm9ydCcsIG9uQWJvcnQpXG4gICAgICAgICAgYWNxdWlyZShyZXNvbHZlKVxuICAgICAgICB9XG4gICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIG9uQWJvcnQsIHsgb25jZTogdHJ1ZSB9KVxuICAgICAgfVxuICAgIH0pXG5cbiAgbG9jay5pc0xvY2tlZCA9ICgpID0+IHNsb3RzID09PSAwXG5cbiAgbG9jay5hd2FpdGluZyA9ICgpID0+IHF1ZXVlLnNpemUoKVxuXG4gIHJldHVybiBsb2NrXG59XG4iLCIndXNlIHN0cmljdCdcblxuY29uc3QgY3JlYXRlTG9jayA9IHJlcXVpcmUoJy4vY3JlYXRlJylcblxuY29uc3Qgd2l0aExvY2sgPSBvcHRzID0+IHtcbiAgY29uc3QgbG9jayA9IGNyZWF0ZUxvY2sob3B0cylcblxuICBjb25zdCB3aXRoTG9jayA9IGFzeW5jIChmbiwgc2lnbmFsKSA9PiB7XG4gICAgY29uc3QgcmVsZWFzZSA9IGF3YWl0IGxvY2soc2lnbmFsKVxuICAgIGlmICghcmVsZWFzZSkgcmV0dXJuXG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBmbigpXG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHJlbGVhc2UoKVxuICAgIH1cbiAgfVxuXG4gIHdpdGhMb2NrLmlzTG9ja2VkID0gbG9jay5pc0xvY2tlZFxuICB3aXRoTG9jay5hd2FpdGluZyA9IGxvY2suYXdhaXRpbmdcblxuICByZXR1cm4gd2l0aExvY2tcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHdpdGhMb2NrLCBjcmVhdGVMb2NrIH1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuaW1wb3J0IHsgd2l0aExvY2sgfSBmcm9tIFwic3VwZXJsb2NrXCI7XG4vLyNyZWdpb24gLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vZGVxdWFsQDIuMC4zL25vZGVfbW9kdWxlcy9kZXF1YWwvbGl0ZS9pbmRleC5tanNcbnZhciBoYXMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuZnVuY3Rpb24gZGVxdWFsKGZvbywgYmFyKSB7XG5cdHZhciBjdG9yLCBsZW47XG5cdGlmIChmb28gPT09IGJhcikgcmV0dXJuIHRydWU7XG5cdGlmIChmb28gJiYgYmFyICYmIChjdG9yID0gZm9vLmNvbnN0cnVjdG9yKSA9PT0gYmFyLmNvbnN0cnVjdG9yKSB7XG5cdFx0aWYgKGN0b3IgPT09IERhdGUpIHJldHVybiBmb28uZ2V0VGltZSgpID09PSBiYXIuZ2V0VGltZSgpO1xuXHRcdGlmIChjdG9yID09PSBSZWdFeHApIHJldHVybiBmb28udG9TdHJpbmcoKSA9PT0gYmFyLnRvU3RyaW5nKCk7XG5cdFx0aWYgKGN0b3IgPT09IEFycmF5KSB7XG5cdFx0XHRpZiAoKGxlbiA9IGZvby5sZW5ndGgpID09PSBiYXIubGVuZ3RoKSB3aGlsZSAobGVuLS0gJiYgZGVxdWFsKGZvb1tsZW5dLCBiYXJbbGVuXSkpO1xuXHRcdFx0cmV0dXJuIGxlbiA9PT0gLTE7XG5cdFx0fVxuXHRcdGlmICghY3RvciB8fCB0eXBlb2YgZm9vID09PSBcIm9iamVjdFwiKSB7XG5cdFx0XHRsZW4gPSAwO1xuXHRcdFx0Zm9yIChjdG9yIGluIGZvbykge1xuXHRcdFx0XHRpZiAoaGFzLmNhbGwoZm9vLCBjdG9yKSAmJiArK2xlbiAmJiAhaGFzLmNhbGwoYmFyLCBjdG9yKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIShjdG9yIGluIGJhcikgfHwgIWRlcXVhbChmb29bY3Rvcl0sIGJhcltjdG9yXSkpIHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyhiYXIpLmxlbmd0aCA9PT0gbGVuO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gZm9vICE9PSBmb28gJiYgYmFyICE9PSBiYXI7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvaW5kZXgudHNcbi8qKlxuKiBTaW1wbGlmaWVkIHN0b3JhZ2UgQVBJcyB3aXRoIHN1cHBvcnQgZm9yIHZlcnNpb25lZCBmaWVsZHMsIHNuYXBzaG90cyxcbiogbWV0YWRhdGEsIGFuZCBpdGVtIGRlZmluaXRpb25zLlxuKlxuKiBTZWUgW3RoZSBndWlkZV0oaHR0cHM6Ly93eHQuZGV2L3N0b3JhZ2UuaHRtbCkgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4qXG4qIEBtb2R1bGUgQHd4dC1kZXYvc3RvcmFnZVxuKi9cbmNvbnN0IHN0b3JhZ2UgPSBjcmVhdGVTdG9yYWdlKCk7XG5mdW5jdGlvbiBjcmVhdGVTdG9yYWdlKCkge1xuXHRjb25zdCBkcml2ZXJzID0ge1xuXHRcdGxvY2FsOiBjcmVhdGVEcml2ZXIoXCJsb2NhbFwiKSxcblx0XHRzZXNzaW9uOiBjcmVhdGVEcml2ZXIoXCJzZXNzaW9uXCIpLFxuXHRcdHN5bmM6IGNyZWF0ZURyaXZlcihcInN5bmNcIiksXG5cdFx0bWFuYWdlZDogY3JlYXRlRHJpdmVyKFwibWFuYWdlZFwiKVxuXHR9O1xuXHRjb25zdCBnZXREcml2ZXIgPSAoYXJlYSkgPT4ge1xuXHRcdGNvbnN0IGRyaXZlciA9IGRyaXZlcnNbYXJlYV07XG5cdFx0aWYgKGRyaXZlciA9PSBudWxsKSB7XG5cdFx0XHRjb25zdCBhcmVhTmFtZXMgPSBPYmplY3Qua2V5cyhkcml2ZXJzKS5qb2luKFwiLCBcIik7XG5cdFx0XHR0aHJvdyBFcnJvcihgSW52YWxpZCBhcmVhIFwiJHthcmVhfVwiLiBPcHRpb25zOiAke2FyZWFOYW1lc31gKTtcblx0XHR9XG5cdFx0cmV0dXJuIGRyaXZlcjtcblx0fTtcblx0Y29uc3QgcmVzb2x2ZUtleSA9IChrZXkpID0+IHtcblx0XHRjb25zdCBkZWxpbWluYXRvckluZGV4ID0ga2V5LmluZGV4T2YoXCI6XCIpO1xuXHRcdGNvbnN0IGRyaXZlckFyZWEgPSBrZXkuc3Vic3RyaW5nKDAsIGRlbGltaW5hdG9ySW5kZXgpO1xuXHRcdGNvbnN0IGRyaXZlcktleSA9IGtleS5zdWJzdHJpbmcoZGVsaW1pbmF0b3JJbmRleCArIDEpO1xuXHRcdGlmIChkcml2ZXJLZXkgPT0gbnVsbCkgdGhyb3cgRXJyb3IoYFN0b3JhZ2Uga2V5IHNob3VsZCBiZSBpbiB0aGUgZm9ybSBvZiBcImFyZWE6a2V5XCIsIGJ1dCByZWNlaXZlZCBcIiR7a2V5fVwiYCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRyaXZlckFyZWEsXG5cdFx0XHRkcml2ZXJLZXksXG5cdFx0XHRkcml2ZXI6IGdldERyaXZlcihkcml2ZXJBcmVhKVxuXHRcdH07XG5cdH07XG5cdGNvbnN0IGdldE1ldGFLZXkgPSAoa2V5KSA9PiBrZXkgKyBcIiRcIjtcblx0Y29uc3QgbWVyZ2VNZXRhID0gKG9sZE1ldGEsIG5ld01ldGEpID0+IHtcblx0XHRjb25zdCBuZXdGaWVsZHMgPSB7IC4uLm9sZE1ldGEgfTtcblx0XHRPYmplY3QuZW50cmllcyhuZXdNZXRhKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHRcdGlmICh2YWx1ZSA9PSBudWxsKSBkZWxldGUgbmV3RmllbGRzW2tleV07XG5cdFx0XHRlbHNlIG5ld0ZpZWxkc1trZXldID0gdmFsdWU7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIG5ld0ZpZWxkcztcblx0fTtcblx0Y29uc3QgZ2V0VmFsdWVPckZhbGxiYWNrID0gKHZhbHVlLCBmYWxsYmFjaykgPT4gdmFsdWUgPz8gZmFsbGJhY2sgPz8gbnVsbDtcblx0Y29uc3QgZ2V0TWV0YVZhbHVlID0gKHByb3BlcnRpZXMpID0+IHR5cGVvZiBwcm9wZXJ0aWVzID09PSBcIm9iamVjdFwiICYmICFBcnJheS5pc0FycmF5KHByb3BlcnRpZXMpID8gcHJvcGVydGllcyA6IHt9O1xuXHRjb25zdCBnZXRJdGVtID0gYXN5bmMgKGRyaXZlciwgZHJpdmVyS2V5LCBvcHRzKSA9PiB7XG5cdFx0cmV0dXJuIGdldFZhbHVlT3JGYWxsYmFjayhhd2FpdCBkcml2ZXIuZ2V0SXRlbShkcml2ZXJLZXkpLCBvcHRzPy5mYWxsYmFjayA/PyBvcHRzPy5kZWZhdWx0VmFsdWUpO1xuXHR9O1xuXHRjb25zdCBnZXRNZXRhID0gYXN5bmMgKGRyaXZlciwgZHJpdmVyS2V5KSA9PiB7XG5cdFx0Y29uc3QgbWV0YUtleSA9IGdldE1ldGFLZXkoZHJpdmVyS2V5KTtcblx0XHRyZXR1cm4gZ2V0TWV0YVZhbHVlKGF3YWl0IGRyaXZlci5nZXRJdGVtKG1ldGFLZXkpKTtcblx0fTtcblx0Y29uc3Qgc2V0SXRlbSA9IGFzeW5jIChkcml2ZXIsIGRyaXZlcktleSwgdmFsdWUpID0+IHtcblx0XHRhd2FpdCBkcml2ZXIuc2V0SXRlbShkcml2ZXJLZXksIHZhbHVlID8/IG51bGwpO1xuXHR9O1xuXHRjb25zdCBzZXRNZXRhID0gYXN5bmMgKGRyaXZlciwgZHJpdmVyS2V5LCBwcm9wZXJ0aWVzKSA9PiB7XG5cdFx0Y29uc3QgbWV0YUtleSA9IGdldE1ldGFLZXkoZHJpdmVyS2V5KTtcblx0XHRjb25zdCBleGlzdGluZ0ZpZWxkcyA9IGdldE1ldGFWYWx1ZShhd2FpdCBkcml2ZXIuZ2V0SXRlbShtZXRhS2V5KSk7XG5cdFx0YXdhaXQgZHJpdmVyLnNldEl0ZW0obWV0YUtleSwgbWVyZ2VNZXRhKGV4aXN0aW5nRmllbGRzLCBwcm9wZXJ0aWVzKSk7XG5cdH07XG5cdGNvbnN0IHJlbW92ZUl0ZW0gPSBhc3luYyAoZHJpdmVyLCBkcml2ZXJLZXksIG9wdHMpID0+IHtcblx0XHRhd2FpdCBkcml2ZXIucmVtb3ZlSXRlbShkcml2ZXJLZXkpO1xuXHRcdGlmIChvcHRzPy5yZW1vdmVNZXRhKSB7XG5cdFx0XHRjb25zdCBtZXRhS2V5ID0gZ2V0TWV0YUtleShkcml2ZXJLZXkpO1xuXHRcdFx0YXdhaXQgZHJpdmVyLnJlbW92ZUl0ZW0obWV0YUtleSk7XG5cdFx0fVxuXHR9O1xuXHRjb25zdCByZW1vdmVNZXRhID0gYXN5bmMgKGRyaXZlciwgZHJpdmVyS2V5LCBwcm9wZXJ0aWVzKSA9PiB7XG5cdFx0Y29uc3QgbWV0YUtleSA9IGdldE1ldGFLZXkoZHJpdmVyS2V5KTtcblx0XHRpZiAocHJvcGVydGllcyA9PSBudWxsKSBhd2FpdCBkcml2ZXIucmVtb3ZlSXRlbShtZXRhS2V5KTtcblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IG5ld0ZpZWxkcyA9IGdldE1ldGFWYWx1ZShhd2FpdCBkcml2ZXIuZ2V0SXRlbShtZXRhS2V5KSk7XG5cdFx0XHRbcHJvcGVydGllc10uZmxhdCgpLmZvckVhY2goKGZpZWxkKSA9PiBkZWxldGUgbmV3RmllbGRzW2ZpZWxkXSk7XG5cdFx0XHRhd2FpdCBkcml2ZXIuc2V0SXRlbShtZXRhS2V5LCBuZXdGaWVsZHMpO1xuXHRcdH1cblx0fTtcblx0Y29uc3Qgd2F0Y2ggPSAoZHJpdmVyLCBkcml2ZXJLZXksIGNiKSA9PiBkcml2ZXIud2F0Y2goZHJpdmVyS2V5LCBjYik7XG5cdHJldHVybiB7XG5cdFx0Z2V0SXRlbTogYXN5bmMgKGtleSwgb3B0cykgPT4ge1xuXHRcdFx0Y29uc3QgeyBkcml2ZXIsIGRyaXZlcktleSB9ID0gcmVzb2x2ZUtleShrZXkpO1xuXHRcdFx0cmV0dXJuIGF3YWl0IGdldEl0ZW0oZHJpdmVyLCBkcml2ZXJLZXksIG9wdHMpO1xuXHRcdH0sXG5cdFx0Z2V0SXRlbXM6IGFzeW5jIChrZXlzKSA9PiB7XG5cdFx0XHRjb25zdCBhcmVhVG9LZXlNYXAgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuXHRcdFx0Y29uc3Qga2V5VG9PcHRzTWFwID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcblx0XHRcdGNvbnN0IG9yZGVyZWRLZXlzID0gW107XG5cdFx0XHRrZXlzLmZvckVhY2goKGtleSkgPT4ge1xuXHRcdFx0XHRsZXQga2V5U3RyO1xuXHRcdFx0XHRsZXQgb3B0cztcblx0XHRcdFx0aWYgKHR5cGVvZiBrZXkgPT09IFwic3RyaW5nXCIpIGtleVN0ciA9IGtleTtcblx0XHRcdFx0ZWxzZSBpZiAoXCJnZXRWYWx1ZVwiIGluIGtleSkge1xuXHRcdFx0XHRcdGtleVN0ciA9IGtleS5rZXk7XG5cdFx0XHRcdFx0b3B0cyA9IHsgZmFsbGJhY2s6IGtleS5mYWxsYmFjayB9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGtleVN0ciA9IGtleS5rZXk7XG5cdFx0XHRcdFx0b3B0cyA9IGtleS5vcHRpb25zO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG9yZGVyZWRLZXlzLnB1c2goa2V5U3RyKTtcblx0XHRcdFx0Y29uc3QgeyBkcml2ZXJBcmVhLCBkcml2ZXJLZXkgfSA9IHJlc29sdmVLZXkoa2V5U3RyKTtcblx0XHRcdFx0Y29uc3QgYXJlYUtleXMgPSBhcmVhVG9LZXlNYXAuZ2V0KGRyaXZlckFyZWEpID8/IFtdO1xuXHRcdFx0XHRhcmVhVG9LZXlNYXAuc2V0KGRyaXZlckFyZWEsIGFyZWFLZXlzLmNvbmNhdChkcml2ZXJLZXkpKTtcblx0XHRcdFx0a2V5VG9PcHRzTWFwLnNldChrZXlTdHIsIG9wdHMpO1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCByZXN1bHRzTWFwID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKEFycmF5LmZyb20oYXJlYVRvS2V5TWFwLmVudHJpZXMoKSkubWFwKGFzeW5jIChbZHJpdmVyQXJlYSwga2V5c10pID0+IHtcblx0XHRcdFx0KGF3YWl0IGRyaXZlcnNbZHJpdmVyQXJlYV0uZ2V0SXRlbXMoa2V5cykpLmZvckVhY2goKGRyaXZlclJlc3VsdCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGtleSA9IGAke2RyaXZlckFyZWF9OiR7ZHJpdmVyUmVzdWx0LmtleX1gO1xuXHRcdFx0XHRcdGNvbnN0IG9wdHMgPSBrZXlUb09wdHNNYXAuZ2V0KGtleSk7XG5cdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSBnZXRWYWx1ZU9yRmFsbGJhY2soZHJpdmVyUmVzdWx0LnZhbHVlLCBvcHRzPy5mYWxsYmFjayA/PyBvcHRzPy5kZWZhdWx0VmFsdWUpO1xuXHRcdFx0XHRcdHJlc3VsdHNNYXAuc2V0KGtleSwgdmFsdWUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pKTtcblx0XHRcdHJldHVybiBvcmRlcmVkS2V5cy5tYXAoKGtleSkgPT4gKHtcblx0XHRcdFx0a2V5LFxuXHRcdFx0XHR2YWx1ZTogcmVzdWx0c01hcC5nZXQoa2V5KVxuXHRcdFx0fSkpO1xuXHRcdH0sXG5cdFx0Z2V0TWV0YTogYXN5bmMgKGtleSkgPT4ge1xuXHRcdFx0Y29uc3QgeyBkcml2ZXIsIGRyaXZlcktleSB9ID0gcmVzb2x2ZUtleShrZXkpO1xuXHRcdFx0cmV0dXJuIGF3YWl0IGdldE1ldGEoZHJpdmVyLCBkcml2ZXJLZXkpO1xuXHRcdH0sXG5cdFx0Z2V0TWV0YXM6IGFzeW5jIChhcmdzKSA9PiB7XG5cdFx0XHRjb25zdCBrZXlzID0gYXJncy5tYXAoKGFyZykgPT4ge1xuXHRcdFx0XHRjb25zdCBrZXkgPSB0eXBlb2YgYXJnID09PSBcInN0cmluZ1wiID8gYXJnIDogYXJnLmtleTtcblx0XHRcdFx0Y29uc3QgeyBkcml2ZXJBcmVhLCBkcml2ZXJLZXkgfSA9IHJlc29sdmVLZXkoa2V5KTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRrZXksXG5cdFx0XHRcdFx0ZHJpdmVyQXJlYSxcblx0XHRcdFx0XHRkcml2ZXJLZXksXG5cdFx0XHRcdFx0ZHJpdmVyTWV0YUtleTogZ2V0TWV0YUtleShkcml2ZXJLZXkpXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGFyZWFUb0RyaXZlck1ldGFLZXlzTWFwID0ga2V5cy5yZWR1Y2UoKG1hcCwga2V5KSA9PiB7XG5cdFx0XHRcdG1hcFtrZXkuZHJpdmVyQXJlYV0gPz89IFtdO1xuXHRcdFx0XHRtYXBba2V5LmRyaXZlckFyZWFdLnB1c2goa2V5KTtcblx0XHRcdFx0cmV0dXJuIG1hcDtcblx0XHRcdH0sIHt9KTtcblx0XHRcdGNvbnN0IHJlc3VsdHNNYXAgPSB7fTtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGFyZWFUb0RyaXZlck1ldGFLZXlzTWFwKS5tYXAoYXN5bmMgKFthcmVhLCBrZXlzXSkgPT4ge1xuXHRcdFx0XHRjb25zdCBhcmVhUmVzID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlW2FyZWFdLmdldChrZXlzLm1hcCgoa2V5KSA9PiBrZXkuZHJpdmVyTWV0YUtleSkpO1xuXHRcdFx0XHRrZXlzLmZvckVhY2goKGtleSkgPT4ge1xuXHRcdFx0XHRcdHJlc3VsdHNNYXBba2V5LmtleV0gPSBhcmVhUmVzW2tleS5kcml2ZXJNZXRhS2V5XSA/PyB7fTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KSk7XG5cdFx0XHRyZXR1cm4ga2V5cy5tYXAoKGtleSkgPT4gKHtcblx0XHRcdFx0a2V5OiBrZXkua2V5LFxuXHRcdFx0XHRtZXRhOiByZXN1bHRzTWFwW2tleS5rZXldXG5cdFx0XHR9KSk7XG5cdFx0fSxcblx0XHRzZXRJdGVtOiBhc3luYyAoa2V5LCB2YWx1ZSkgPT4ge1xuXHRcdFx0Y29uc3QgeyBkcml2ZXIsIGRyaXZlcktleSB9ID0gcmVzb2x2ZUtleShrZXkpO1xuXHRcdFx0YXdhaXQgc2V0SXRlbShkcml2ZXIsIGRyaXZlcktleSwgdmFsdWUpO1xuXHRcdH0sXG5cdFx0c2V0SXRlbXM6IGFzeW5jIChpdGVtcykgPT4ge1xuXHRcdFx0Y29uc3QgYXJlYVRvS2V5VmFsdWVNYXAgPSB7fTtcblx0XHRcdGl0ZW1zLmZvckVhY2goKGl0ZW0pID0+IHtcblx0XHRcdFx0Y29uc3QgeyBkcml2ZXJBcmVhLCBkcml2ZXJLZXkgfSA9IHJlc29sdmVLZXkoXCJrZXlcIiBpbiBpdGVtID8gaXRlbS5rZXkgOiBpdGVtLml0ZW0ua2V5KTtcblx0XHRcdFx0YXJlYVRvS2V5VmFsdWVNYXBbZHJpdmVyQXJlYV0gPz89IFtdO1xuXHRcdFx0XHRhcmVhVG9LZXlWYWx1ZU1hcFtkcml2ZXJBcmVhXS5wdXNoKHtcblx0XHRcdFx0XHRrZXk6IGRyaXZlcktleSxcblx0XHRcdFx0XHR2YWx1ZTogaXRlbS52YWx1ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXMoYXJlYVRvS2V5VmFsdWVNYXApLm1hcChhc3luYyAoW2RyaXZlckFyZWEsIHZhbHVlc10pID0+IHtcblx0XHRcdFx0YXdhaXQgZ2V0RHJpdmVyKGRyaXZlckFyZWEpLnNldEl0ZW1zKHZhbHVlcyk7XG5cdFx0XHR9KSk7XG5cdFx0fSxcblx0XHRzZXRNZXRhOiBhc3luYyAoa2V5LCBwcm9wZXJ0aWVzKSA9PiB7XG5cdFx0XHRjb25zdCB7IGRyaXZlciwgZHJpdmVyS2V5IH0gPSByZXNvbHZlS2V5KGtleSk7XG5cdFx0XHRhd2FpdCBzZXRNZXRhKGRyaXZlciwgZHJpdmVyS2V5LCBwcm9wZXJ0aWVzKTtcblx0XHR9LFxuXHRcdHNldE1ldGFzOiBhc3luYyAoaXRlbXMpID0+IHtcblx0XHRcdGNvbnN0IGFyZWFUb01ldGFVcGRhdGVzTWFwID0ge307XG5cdFx0XHRpdGVtcy5mb3JFYWNoKChpdGVtKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgZHJpdmVyQXJlYSwgZHJpdmVyS2V5IH0gPSByZXNvbHZlS2V5KFwia2V5XCIgaW4gaXRlbSA/IGl0ZW0ua2V5IDogaXRlbS5pdGVtLmtleSk7XG5cdFx0XHRcdGFyZWFUb01ldGFVcGRhdGVzTWFwW2RyaXZlckFyZWFdID8/PSBbXTtcblx0XHRcdFx0YXJlYVRvTWV0YVVwZGF0ZXNNYXBbZHJpdmVyQXJlYV0ucHVzaCh7XG5cdFx0XHRcdFx0a2V5OiBkcml2ZXJLZXksXG5cdFx0XHRcdFx0cHJvcGVydGllczogaXRlbS5tZXRhXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyhhcmVhVG9NZXRhVXBkYXRlc01hcCkubWFwKGFzeW5jIChbc3RvcmFnZUFyZWEsIHVwZGF0ZXNdKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGRyaXZlciA9IGdldERyaXZlcihzdG9yYWdlQXJlYSk7XG5cdFx0XHRcdGNvbnN0IG1ldGFLZXlzID0gdXBkYXRlcy5tYXAoKHsga2V5IH0pID0+IGdldE1ldGFLZXkoa2V5KSk7XG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nTWV0YXMgPSBhd2FpdCBkcml2ZXIuZ2V0SXRlbXMobWV0YUtleXMpO1xuXHRcdFx0XHRjb25zdCBleGlzdGluZ01ldGFNYXAgPSBPYmplY3QuZnJvbUVudHJpZXMoZXhpc3RpbmdNZXRhcy5tYXAoKHsga2V5LCB2YWx1ZSB9KSA9PiBba2V5LCBnZXRNZXRhVmFsdWUodmFsdWUpXSkpO1xuXHRcdFx0XHRjb25zdCBtZXRhVXBkYXRlcyA9IHVwZGF0ZXMubWFwKCh7IGtleSwgcHJvcGVydGllcyB9KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbWV0YUtleSA9IGdldE1ldGFLZXkoa2V5KTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0a2V5OiBtZXRhS2V5LFxuXHRcdFx0XHRcdFx0dmFsdWU6IG1lcmdlTWV0YShleGlzdGluZ01ldGFNYXBbbWV0YUtleV0gPz8ge30sIHByb3BlcnRpZXMpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IGRyaXZlci5zZXRJdGVtcyhtZXRhVXBkYXRlcyk7XG5cdFx0XHR9KSk7XG5cdFx0fSxcblx0XHRyZW1vdmVJdGVtOiBhc3luYyAoa2V5LCBvcHRzKSA9PiB7XG5cdFx0XHRjb25zdCB7IGRyaXZlciwgZHJpdmVyS2V5IH0gPSByZXNvbHZlS2V5KGtleSk7XG5cdFx0XHRhd2FpdCByZW1vdmVJdGVtKGRyaXZlciwgZHJpdmVyS2V5LCBvcHRzKTtcblx0XHR9LFxuXHRcdHJlbW92ZUl0ZW1zOiBhc3luYyAoa2V5cykgPT4ge1xuXHRcdFx0Y29uc3QgYXJlYVRvS2V5c01hcCA9IHt9O1xuXHRcdFx0a2V5cy5mb3JFYWNoKChrZXkpID0+IHtcblx0XHRcdFx0bGV0IGtleVN0cjtcblx0XHRcdFx0bGV0IG9wdHM7XG5cdFx0XHRcdGlmICh0eXBlb2Yga2V5ID09PSBcInN0cmluZ1wiKSBrZXlTdHIgPSBrZXk7XG5cdFx0XHRcdGVsc2UgaWYgKFwiZ2V0VmFsdWVcIiBpbiBrZXkpIGtleVN0ciA9IGtleS5rZXk7XG5cdFx0XHRcdGVsc2UgaWYgKFwiaXRlbVwiIGluIGtleSkge1xuXHRcdFx0XHRcdGtleVN0ciA9IGtleS5pdGVtLmtleTtcblx0XHRcdFx0XHRvcHRzID0ga2V5Lm9wdGlvbnM7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0a2V5U3RyID0ga2V5LmtleTtcblx0XHRcdFx0XHRvcHRzID0ga2V5Lm9wdGlvbnM7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgeyBkcml2ZXJBcmVhLCBkcml2ZXJLZXkgfSA9IHJlc29sdmVLZXkoa2V5U3RyKTtcblx0XHRcdFx0YXJlYVRvS2V5c01hcFtkcml2ZXJBcmVhXSA/Pz0gW107XG5cdFx0XHRcdGFyZWFUb0tleXNNYXBbZHJpdmVyQXJlYV0ucHVzaChkcml2ZXJLZXkpO1xuXHRcdFx0XHRpZiAob3B0cz8ucmVtb3ZlTWV0YSkgYXJlYVRvS2V5c01hcFtkcml2ZXJBcmVhXS5wdXNoKGdldE1ldGFLZXkoZHJpdmVyS2V5KSk7XG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGFyZWFUb0tleXNNYXApLm1hcChhc3luYyAoW2RyaXZlckFyZWEsIGtleXNdKSA9PiB7XG5cdFx0XHRcdGF3YWl0IGdldERyaXZlcihkcml2ZXJBcmVhKS5yZW1vdmVJdGVtcyhrZXlzKTtcblx0XHRcdH0pKTtcblx0XHR9LFxuXHRcdGNsZWFyOiBhc3luYyAoYmFzZSkgPT4ge1xuXHRcdFx0YXdhaXQgZ2V0RHJpdmVyKGJhc2UpLmNsZWFyKCk7XG5cdFx0fSxcblx0XHRyZW1vdmVNZXRhOiBhc3luYyAoa2V5LCBwcm9wZXJ0aWVzKSA9PiB7XG5cdFx0XHRjb25zdCB7IGRyaXZlciwgZHJpdmVyS2V5IH0gPSByZXNvbHZlS2V5KGtleSk7XG5cdFx0XHRhd2FpdCByZW1vdmVNZXRhKGRyaXZlciwgZHJpdmVyS2V5LCBwcm9wZXJ0aWVzKTtcblx0XHR9LFxuXHRcdHNuYXBzaG90OiBhc3luYyAoYmFzZSwgb3B0cykgPT4ge1xuXHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IGdldERyaXZlcihiYXNlKS5zbmFwc2hvdCgpO1xuXHRcdFx0b3B0cz8uZXhjbHVkZUtleXM/LmZvckVhY2goKGtleSkgPT4ge1xuXHRcdFx0XHRkZWxldGUgZGF0YVtrZXldO1xuXHRcdFx0XHRkZWxldGUgZGF0YVtnZXRNZXRhS2V5KGtleSldO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9LFxuXHRcdHJlc3RvcmVTbmFwc2hvdDogYXN5bmMgKGJhc2UsIGRhdGEpID0+IHtcblx0XHRcdGF3YWl0IGdldERyaXZlcihiYXNlKS5yZXN0b3JlU25hcHNob3QoZGF0YSk7XG5cdFx0fSxcblx0XHR3YXRjaDogKGtleSwgY2IpID0+IHtcblx0XHRcdGNvbnN0IHsgZHJpdmVyLCBkcml2ZXJLZXkgfSA9IHJlc29sdmVLZXkoa2V5KTtcblx0XHRcdHJldHVybiB3YXRjaChkcml2ZXIsIGRyaXZlcktleSwgY2IpO1xuXHRcdH0sXG5cdFx0dW53YXRjaCgpIHtcblx0XHRcdE9iamVjdC52YWx1ZXMoZHJpdmVycykuZm9yRWFjaCgoZHJpdmVyKSA9PiB7XG5cdFx0XHRcdGRyaXZlci51bndhdGNoKCk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXHRcdGRlZmluZUl0ZW06IChrZXksIG9wdHMpID0+IHtcblx0XHRcdGNvbnN0IHsgZHJpdmVyLCBkcml2ZXJLZXkgfSA9IHJlc29sdmVLZXkoa2V5KTtcblx0XHRcdGNvbnN0IHsgdmVyc2lvbjogdGFyZ2V0VmVyc2lvbiA9IDEsIG1pZ3JhdGlvbnMgPSB7fSwgb25NaWdyYXRpb25Db21wbGV0ZSwgZGVidWcgPSBmYWxzZSB9ID0gb3B0cyA/PyB7fTtcblx0XHRcdGlmICh0YXJnZXRWZXJzaW9uIDwgMSkgdGhyb3cgRXJyb3IoXCJTdG9yYWdlIGl0ZW0gdmVyc2lvbiBjYW5ub3QgYmUgbGVzcyB0aGFuIDEuIEluaXRpYWwgdmVyc2lvbnMgc2hvdWxkIGJlIHNldCB0byAxLCBub3QgMC5cIik7XG5cdFx0XHRsZXQgbmVlZHNWZXJzaW9uU2V0ID0gZmFsc2U7XG5cdFx0XHRjb25zdCBtaWdyYXRlID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBkcml2ZXJNZXRhS2V5ID0gZ2V0TWV0YUtleShkcml2ZXJLZXkpO1xuXHRcdFx0XHRjb25zdCBbeyB2YWx1ZSB9LCB7IHZhbHVlOiBtZXRhIH1dID0gYXdhaXQgZHJpdmVyLmdldEl0ZW1zKFtkcml2ZXJLZXksIGRyaXZlck1ldGFLZXldKTtcblx0XHRcdFx0bmVlZHNWZXJzaW9uU2V0ID0gdmFsdWUgPT0gbnVsbCAmJiBtZXRhPy52ID09IG51bGwgJiYgISF0YXJnZXRWZXJzaW9uO1xuXHRcdFx0XHRpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuO1xuXHRcdFx0XHRjb25zdCBjdXJyZW50VmVyc2lvbiA9IG1ldGE/LnYgPz8gMTtcblx0XHRcdFx0aWYgKGN1cnJlbnRWZXJzaW9uID4gdGFyZ2V0VmVyc2lvbikgdGhyb3cgRXJyb3IoYFZlcnNpb24gZG93bmdyYWRlIGRldGVjdGVkICh2JHtjdXJyZW50VmVyc2lvbn0gLT4gdiR7dGFyZ2V0VmVyc2lvbn0pIGZvciBcIiR7a2V5fVwiYCk7XG5cdFx0XHRcdGlmIChjdXJyZW50VmVyc2lvbiA9PT0gdGFyZ2V0VmVyc2lvbikgcmV0dXJuO1xuXHRcdFx0XHRpZiAoZGVidWcpIGNvbnNvbGUuZGVidWcoYFtAd3h0LWRldi9zdG9yYWdlXSBSdW5uaW5nIHN0b3JhZ2UgbWlncmF0aW9uIGZvciAke2tleX06IHYke2N1cnJlbnRWZXJzaW9ufSAtPiB2JHt0YXJnZXRWZXJzaW9ufWApO1xuXHRcdFx0XHRjb25zdCBtaWdyYXRpb25zVG9SdW4gPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiB0YXJnZXRWZXJzaW9uIC0gY3VycmVudFZlcnNpb24gfSwgKF8sIGkpID0+IGN1cnJlbnRWZXJzaW9uICsgaSArIDEpO1xuXHRcdFx0XHRsZXQgbWlncmF0ZWRWYWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRmb3IgKGNvbnN0IG1pZ3JhdGVUb1ZlcnNpb24gb2YgbWlncmF0aW9uc1RvUnVuKSB0cnkge1xuXHRcdFx0XHRcdG1pZ3JhdGVkVmFsdWUgPSBhd2FpdCBtaWdyYXRpb25zPy5bbWlncmF0ZVRvVmVyc2lvbl0/LihtaWdyYXRlZFZhbHVlKSA/PyBtaWdyYXRlZFZhbHVlO1xuXHRcdFx0XHRcdGlmIChkZWJ1ZykgY29uc29sZS5kZWJ1ZyhgW0B3eHQtZGV2L3N0b3JhZ2VdIFN0b3JhZ2UgbWlncmF0aW9uIHByb2Nlc3NlZCBmb3IgdmVyc2lvbjogdiR7bWlncmF0ZVRvVmVyc2lvbn1gKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IE1pZ3JhdGlvbkVycm9yKGtleSwgbWlncmF0ZVRvVmVyc2lvbiwgeyBjYXVzZTogZXJyIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF3YWl0IGRyaXZlci5zZXRJdGVtcyhbe1xuXHRcdFx0XHRcdGtleTogZHJpdmVyS2V5LFxuXHRcdFx0XHRcdHZhbHVlOiBtaWdyYXRlZFZhbHVlXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRrZXk6IGRyaXZlck1ldGFLZXksXG5cdFx0XHRcdFx0dmFsdWU6IHtcblx0XHRcdFx0XHRcdC4uLm1ldGEsXG5cdFx0XHRcdFx0XHR2OiB0YXJnZXRWZXJzaW9uXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XSk7XG5cdFx0XHRcdGlmIChkZWJ1ZykgY29uc29sZS5kZWJ1ZyhgW0B3eHQtZGV2L3N0b3JhZ2VdIFN0b3JhZ2UgbWlncmF0aW9uIGNvbXBsZXRlZCBmb3IgJHtrZXl9IHYke3RhcmdldFZlcnNpb259YCwgeyBtaWdyYXRlZFZhbHVlIH0pO1xuXHRcdFx0XHRvbk1pZ3JhdGlvbkNvbXBsZXRlPy4obWlncmF0ZWRWYWx1ZSwgdGFyZ2V0VmVyc2lvbik7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgbWlncmF0aW9uc0RvbmUgPSBvcHRzPy5taWdyYXRpb25zID09IG51bGwgPyBQcm9taXNlLnJlc29sdmUoKSA6IG1pZ3JhdGUoKS5jYXRjaCgoZXJyKSA9PiB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoYFtAd3h0LWRldi9zdG9yYWdlXSBNaWdyYXRpb24gZmFpbGVkIGZvciAke2tleX1gLCBlcnIpO1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBpbml0TG9jayA9IHdpdGhMb2NrKCk7XG5cdFx0XHRjb25zdCBnZXRGYWxsYmFjayA9ICgpID0+IG9wdHM/LmZhbGxiYWNrID8/IG9wdHM/LmRlZmF1bHRWYWx1ZSA/PyBudWxsO1xuXHRcdFx0Y29uc3QgZ2V0T3JJbml0VmFsdWUgPSAoKSA9PiBpbml0TG9jayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgZHJpdmVyLmdldEl0ZW0oZHJpdmVyS2V5KTtcblx0XHRcdFx0aWYgKHZhbHVlICE9IG51bGwgfHwgb3B0cz8uaW5pdCA9PSBudWxsKSByZXR1cm4gdmFsdWU7XG5cdFx0XHRcdGNvbnN0IG5ld1ZhbHVlID0gYXdhaXQgb3B0cy5pbml0KCk7XG5cdFx0XHRcdGF3YWl0IGRyaXZlci5zZXRJdGVtKGRyaXZlcktleSwgbmV3VmFsdWUpO1xuXHRcdFx0XHRpZiAodmFsdWUgPT0gbnVsbCAmJiB0YXJnZXRWZXJzaW9uID4gMSkgYXdhaXQgc2V0TWV0YShkcml2ZXIsIGRyaXZlcktleSwgeyB2OiB0YXJnZXRWZXJzaW9uIH0pO1xuXHRcdFx0XHRyZXR1cm4gbmV3VmFsdWU7XG5cdFx0XHR9KTtcblx0XHRcdG1pZ3JhdGlvbnNEb25lLnRoZW4oZ2V0T3JJbml0VmFsdWUpO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2V5LFxuXHRcdFx0XHRnZXQgZGVmYXVsdFZhbHVlKCkge1xuXHRcdFx0XHRcdHJldHVybiBnZXRGYWxsYmFjaygpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXQgZmFsbGJhY2soKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGdldEZhbGxiYWNrKCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldFZhbHVlOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgbWlncmF0aW9uc0RvbmU7XG5cdFx0XHRcdFx0aWYgKG9wdHM/LmluaXQpIHJldHVybiBhd2FpdCBnZXRPckluaXRWYWx1ZSgpO1xuXHRcdFx0XHRcdGVsc2UgcmV0dXJuIGF3YWl0IGdldEl0ZW0oZHJpdmVyLCBkcml2ZXJLZXksIG9wdHMpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRNZXRhOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgbWlncmF0aW9uc0RvbmU7XG5cdFx0XHRcdFx0cmV0dXJuIGF3YWl0IGdldE1ldGEoZHJpdmVyLCBkcml2ZXJLZXkpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXRWYWx1ZTogYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgbWlncmF0aW9uc0RvbmU7XG5cdFx0XHRcdFx0aWYgKG5lZWRzVmVyc2lvblNldCkge1xuXHRcdFx0XHRcdFx0bmVlZHNWZXJzaW9uU2V0ID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbc2V0SXRlbShkcml2ZXIsIGRyaXZlcktleSwgdmFsdWUpLCBzZXRNZXRhKGRyaXZlciwgZHJpdmVyS2V5LCB7IHY6IHRhcmdldFZlcnNpb24gfSldKTtcblx0XHRcdFx0XHR9IGVsc2UgYXdhaXQgc2V0SXRlbShkcml2ZXIsIGRyaXZlcktleSwgdmFsdWUpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXRNZXRhOiBhc3luYyAocHJvcGVydGllcykgPT4ge1xuXHRcdFx0XHRcdGF3YWl0IG1pZ3JhdGlvbnNEb25lO1xuXHRcdFx0XHRcdHJldHVybiBhd2FpdCBzZXRNZXRhKGRyaXZlciwgZHJpdmVyS2V5LCBwcm9wZXJ0aWVzKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVtb3ZlVmFsdWU6IGFzeW5jIChvcHRzKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgbWlncmF0aW9uc0RvbmU7XG5cdFx0XHRcdFx0cmV0dXJuIGF3YWl0IHJlbW92ZUl0ZW0oZHJpdmVyLCBkcml2ZXJLZXksIG9wdHMpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZW1vdmVNZXRhOiBhc3luYyAocHJvcGVydGllcykgPT4ge1xuXHRcdFx0XHRcdGF3YWl0IG1pZ3JhdGlvbnNEb25lO1xuXHRcdFx0XHRcdHJldHVybiBhd2FpdCByZW1vdmVNZXRhKGRyaXZlciwgZHJpdmVyS2V5LCBwcm9wZXJ0aWVzKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0d2F0Y2g6IChjYikgPT4gd2F0Y2goZHJpdmVyLCBkcml2ZXJLZXksIChuZXdWYWx1ZSwgb2xkVmFsdWUpID0+IGNiKG5ld1ZhbHVlID8/IGdldEZhbGxiYWNrKCksIG9sZFZhbHVlID8/IGdldEZhbGxiYWNrKCkpKSxcblx0XHRcdFx0bWlncmF0ZVxuXHRcdFx0fTtcblx0XHR9XG5cdH07XG59XG5mdW5jdGlvbiBjcmVhdGVEcml2ZXIoc3RvcmFnZUFyZWEpIHtcblx0Y29uc3QgZ2V0U3RvcmFnZUFyZWEgPSAoKSA9PiB7XG5cdFx0aWYgKGJyb3dzZXIucnVudGltZSA9PSBudWxsKSB0aHJvdyBFcnJvcihgJ3d4dC9zdG9yYWdlJyBtdXN0IGJlIGxvYWRlZCBpbiBhIHdlYiBleHRlbnNpb24gZW52aXJvbm1lbnRcblxuIC0gSWYgdGhyb3duIGR1cmluZyBhIGJ1aWxkLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3d4dC1kZXYvd3h0L2lzc3Vlcy8zNzFcbiAtIElmIHRocm93biBkdXJpbmcgdGVzdHMsIG1vY2sgJ3d4dC9icm93c2VyJyBjb3JyZWN0bHkuIFNlZSBodHRwczovL3d4dC5kZXYvZ3VpZGUvZ28tZnVydGhlci90ZXN0aW5nLmh0bWxcbmApO1xuXHRcdGlmIChicm93c2VyLnN0b3JhZ2UgPT0gbnVsbCkgdGhyb3cgRXJyb3IoXCJZb3UgbXVzdCBhZGQgdGhlICdzdG9yYWdlJyBwZXJtaXNzaW9uIHRvIHlvdXIgbWFuaWZlc3QgdG8gdXNlICd3eHQvc3RvcmFnZSdcIik7XG5cdFx0Y29uc3QgYXJlYSA9IGJyb3dzZXIuc3RvcmFnZVtzdG9yYWdlQXJlYV07XG5cdFx0aWYgKGFyZWEgPT0gbnVsbCkgdGhyb3cgRXJyb3IoYFwiYnJvd3Nlci5zdG9yYWdlLiR7c3RvcmFnZUFyZWF9XCIgaXMgdW5kZWZpbmVkYCk7XG5cdFx0cmV0dXJuIGFyZWE7XG5cdH07XG5cdGNvbnN0IHdhdGNoTGlzdGVuZXJzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcblx0cmV0dXJuIHtcblx0XHRnZXRJdGVtOiBhc3luYyAoa2V5KSA9PiB7XG5cdFx0XHRyZXR1cm4gKGF3YWl0IGdldFN0b3JhZ2VBcmVhKCkuZ2V0KGtleSkpW2tleV07XG5cdFx0fSxcblx0XHRnZXRJdGVtczogYXN5bmMgKGtleXMpID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldFN0b3JhZ2VBcmVhKCkuZ2V0KGtleXMpO1xuXHRcdFx0cmV0dXJuIGtleXMubWFwKChrZXkpID0+ICh7XG5cdFx0XHRcdGtleSxcblx0XHRcdFx0dmFsdWU6IHJlc3VsdFtrZXldID8/IG51bGxcblx0XHRcdH0pKTtcblx0XHR9LFxuXHRcdHNldEl0ZW06IGFzeW5jIChrZXksIHZhbHVlKSA9PiB7XG5cdFx0XHRpZiAodmFsdWUgPT0gbnVsbCkgYXdhaXQgZ2V0U3RvcmFnZUFyZWEoKS5yZW1vdmUoa2V5KTtcblx0XHRcdGVsc2UgYXdhaXQgZ2V0U3RvcmFnZUFyZWEoKS5zZXQoeyBba2V5XTogdmFsdWUgfSk7XG5cdFx0fSxcblx0XHRzZXRJdGVtczogYXN5bmMgKHZhbHVlcykgPT4ge1xuXHRcdFx0Y29uc3QgbWFwID0gdmFsdWVzLnJlZHVjZSgobWFwLCB7IGtleSwgdmFsdWUgfSkgPT4ge1xuXHRcdFx0XHRtYXBba2V5XSA9IHZhbHVlO1xuXHRcdFx0XHRyZXR1cm4gbWFwO1xuXHRcdFx0fSwge30pO1xuXHRcdFx0YXdhaXQgZ2V0U3RvcmFnZUFyZWEoKS5zZXQobWFwKTtcblx0XHR9LFxuXHRcdHJlbW92ZUl0ZW06IGFzeW5jIChrZXkpID0+IHtcblx0XHRcdGF3YWl0IGdldFN0b3JhZ2VBcmVhKCkucmVtb3ZlKGtleSk7XG5cdFx0fSxcblx0XHRyZW1vdmVJdGVtczogYXN5bmMgKGtleXMpID0+IHtcblx0XHRcdGF3YWl0IGdldFN0b3JhZ2VBcmVhKCkucmVtb3ZlKGtleXMpO1xuXHRcdH0sXG5cdFx0Y2xlYXI6IGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IGdldFN0b3JhZ2VBcmVhKCkuY2xlYXIoKTtcblx0XHR9LFxuXHRcdHNuYXBzaG90OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgZ2V0U3RvcmFnZUFyZWEoKS5nZXQoKTtcblx0XHR9LFxuXHRcdHJlc3RvcmVTbmFwc2hvdDogYXN5bmMgKGRhdGEpID0+IHtcblx0XHRcdGF3YWl0IGdldFN0b3JhZ2VBcmVhKCkuc2V0KGRhdGEpO1xuXHRcdH0sXG5cdFx0d2F0Y2goa2V5LCBjYikge1xuXHRcdFx0Y29uc3QgbGlzdGVuZXIgPSAoY2hhbmdlcykgPT4ge1xuXHRcdFx0XHRjb25zdCBjaGFuZ2UgPSBjaGFuZ2VzW2tleV07XG5cdFx0XHRcdGlmIChjaGFuZ2UgPT0gbnVsbCB8fCBkZXF1YWwoY2hhbmdlLm5ld1ZhbHVlLCBjaGFuZ2Uub2xkVmFsdWUpKSByZXR1cm47XG5cdFx0XHRcdGNiKGNoYW5nZS5uZXdWYWx1ZSA/PyBudWxsLCBjaGFuZ2Uub2xkVmFsdWUgPz8gbnVsbCk7XG5cdFx0XHR9O1xuXHRcdFx0Z2V0U3RvcmFnZUFyZWEoKS5vbkNoYW5nZWQuYWRkTGlzdGVuZXIobGlzdGVuZXIpO1xuXHRcdFx0d2F0Y2hMaXN0ZW5lcnMuYWRkKGxpc3RlbmVyKTtcblx0XHRcdHJldHVybiAoKSA9PiB7XG5cdFx0XHRcdGdldFN0b3JhZ2VBcmVhKCkub25DaGFuZ2VkLnJlbW92ZUxpc3RlbmVyKGxpc3RlbmVyKTtcblx0XHRcdFx0d2F0Y2hMaXN0ZW5lcnMuZGVsZXRlKGxpc3RlbmVyKTtcblx0XHRcdH07XG5cdFx0fSxcblx0XHR1bndhdGNoKCkge1xuXHRcdFx0d2F0Y2hMaXN0ZW5lcnMuZm9yRWFjaCgobGlzdGVuZXIpID0+IHtcblx0XHRcdFx0Z2V0U3RvcmFnZUFyZWEoKS5vbkNoYW5nZWQucmVtb3ZlTGlzdGVuZXIobGlzdGVuZXIpO1xuXHRcdFx0fSk7XG5cdFx0XHR3YXRjaExpc3RlbmVycy5jbGVhcigpO1xuXHRcdH1cblx0fTtcbn1cbnZhciBNaWdyYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihrZXksIHZlcnNpb24sIG9wdGlvbnMpIHtcblx0XHRzdXBlcihgdiR7dmVyc2lvbn0gbWlncmF0aW9uIGZhaWxlZCBmb3IgXCIke2tleX1cImAsIG9wdGlvbnMpO1xuXHRcdHRoaXMua2V5ID0ga2V5O1xuXHRcdHRoaXMudmVyc2lvbiA9IHZlcnNpb247XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IE1pZ3JhdGlvbkVycm9yLCBzdG9yYWdlIH07XG4iLCJpbXBvcnQgeyBzdG9yYWdlIH0gZnJvbSBcIiNpbXBvcnRzXCI7XG5cbmltcG9ydCB0eXBlIHsgRXh0cmFjdGlvblByb2dyZXNzLCBTY3JhcGVkT2ZmZXJpbmcgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vKiogU2NyYXBlZCByb3dzLCBhdXRvLXNhdmVkIGFmdGVyIGV2ZXJ5IHBhZ2UuICovXG5leHBvcnQgY29uc3Qgb2ZmZXJpbmdzU3RvcmFnZSA9IHN0b3JhZ2UuZGVmaW5lSXRlbTxTY3JhcGVkT2ZmZXJpbmdbXT4oXG4gIFwibG9jYWw6b2ZmZXJpbmdzXCIsXG4gIHsgZmFsbGJhY2s6IFtdIH0sXG4pO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4dHJhY3RTdGF0ZSB7XG4gIHJ1bm5pbmc6IGJvb2xlYW47XG4gIHByb2dyZXNzOiBFeHRyYWN0aW9uUHJvZ3Jlc3MgfCBudWxsO1xufVxuXG4vKiogU3Vydml2ZXMgc2VydmljZS13b3JrZXIgcmVzdGFydHMgd2l0aGluIHRoZSBicm93c2VyIHNlc3Npb24uICovXG5leHBvcnQgY29uc3QgZXh0cmFjdFN0YXRlU3RvcmFnZSA9IHN0b3JhZ2UuZGVmaW5lSXRlbTxFeHRyYWN0U3RhdGUgfCBudWxsPihcbiAgXCJzZXNzaW9uOmV4dHJhY3RTdGF0ZVwiLFxuICB7IGZhbGxiYWNrOiBudWxsIH0sXG4pO1xuXG4vKipcbiAqIERlZGljYXRlZCBzdG9wIGZsYWcgLSB0aGUgbG9vcCByZXdyaXRlcyBgcnVubmluZzogdHJ1ZWAgYWZ0ZXIgZXZlcnkgcGFnZSxcbiAqIHNvIGEgc3RvcCByZXF1ZXN0IG11c3Qgbm90IGxpdmUgaW5zaWRlIHRoZSBzYW1lIGRvY3VtZW50LlxuICovXG5leHBvcnQgY29uc3QgZXh0cmFjdFN0b3BTdG9yYWdlID0gc3RvcmFnZS5kZWZpbmVJdGVtPGJvb2xlYW4+KFxuICBcInNlc3Npb246ZXh0cmFjdFN0b3BcIixcbiAgeyBmYWxsYmFjazogZmFsc2UgfSxcbik7XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcIiNpbXBvcnRzXCI7XG5cbmltcG9ydCB7IG1lcmdlUm93cyB9IGZyb20gXCIuLi9saWIvZXhwb3J0LWRvY1wiO1xuaW1wb3J0IHsgZ2V0VW5pdmVyc2l0eUFkYXB0ZXIgfSBmcm9tIFwiLi4vdW5pdmVyc2l0aWVzXCI7XG5pbXBvcnQge1xuICBleHRyYWN0U3RhdGVTdG9yYWdlLFxuICBleHRyYWN0U3RvcFN0b3JhZ2UsXG4gIG9mZmVyaW5nc1N0b3JhZ2UsXG4gIHR5cGUgRXh0cmFjdFN0YXRlLFxufSBmcm9tIFwiLi4vbGliL3N0b3JhZ2VcIjtcbmltcG9ydCB0eXBlIHtcbiAgRXh0cmFjdGlvbkV2ZW50LFxuICBFeHRyYWN0aW9uUHJvZ3Jlc3MsXG4gIFBhZ2luZ0luZm8sXG59IGZyb20gXCIuLi9saWIvdHlwZXNcIjtcblxuLyoqXG4gKiBEcml2ZXMgbXVsdGktcGFnZSBleHRyYWN0aW9uIGZyb20gdGhlIGJhY2tncm91bmQgd29ya2VyLlxuICpcbiAqIFRoZSB0YXJnZXQgc2l0ZSBkb2VzIEZVTEwgcGFnZSByZWxvYWRzIGZvciBwYWdpbmF0aW9uIChhIGZvcm0gc3VibWl0XG4gKiByZS1yZW5kZXJzIGV2ZXJ5dGhpbmcsIG5vIFVSTCBjaGFuZ2UpLCBzbyB0aGUgaW5qZWN0ZWQgZnVuY3Rpb24gZGllcyB3aXRoXG4gKiBldmVyeSBwYWdlLiBPbmx5IHRoZSB3b3JrZXIgc3Vydml2ZXMgLSBpdCByZS1pbmplY3RzIG9uIGVhY2ggcGFnZTpcbiAqXG4gKiAgIHJld2luZDogY2xpY2sgXCLYtdmB2K3ZhyDZgtio2YRcIiB1bnRpbCBkaXNhYmxlZCAgKHVzZXIgbWF5IHN0YXJ0IG9uIHBhZ2UgMylcbiAqICAgY29sbGVjdDogc2NyYXBlIC0+IGF1dG8tc2F2ZSAtPiBjbGljayBcIti12YHYrdmHINio2LnYr1wiIC0+IHdhaXQgLT4gLi4uXG4gKlxuICogV2FpdGluZyBpcyB0aGUgdHJpY2t5IHBhcnQ6IHRoZSB0YWIncyBzdGF0dXMgc3RheXMgXCJjb21wbGV0ZVwiIGZvciBhIG1vbWVudFxuICogQUZURVIgdGhlIGNsaWNrICh0aGUgc3VibWl0IHN0YXJ0cyBhc3luY2hyb25vdXNseSksIHNvIHdhaXRpbmcgb24gdGFiXG4gKiBzdGF0dXMgYWxvbmUgcmVzb2x2ZXMgYWdhaW5zdCB0aGUgT0xEIHBhZ2UuIEluc3RlYWQgd2UgZmluZ2VycHJpbnQgdGhlXG4gKiBkb2N1bWVudCB3aXRoIHBlcmZvcm1hbmNlLnRpbWVPcmlnaW4gLSBpdCBjaGFuZ2VzIHdoZW4gdGhlIG5ldyBwYWdlJ3NcbiAqIGRvY3VtZW50IGlzIGNyZWF0ZWQgLSBhbmQgb25seSB0aGVuIHdhaXQgZm9yIGl0cyByZWFkeVN0YXRlLlxuICpcbiAqIGFjdGl2ZVRhYiBrZWVwcyB0aGUgaW5qZWN0aW9uIGdyYW50IGFjcm9zcyBzYW1lLW9yaWdpbiBuYXZpZ2F0aW9ucywgd2hpY2hcbiAqIHBhZ2luZyBhbHdheXMgaXMuXG4gKi9cblxuY29uc3QgTE9BRF9USU1FT1VUX01TID0gMjVfMDAwO1xuY29uc3QgUE9MTF9JTlRFUlZBTF9NUyA9IDM1MDtcbmNvbnN0IFNFVFRMRV9ERUxBWV9NUyA9IDYwMDtcblxuY2xhc3MgU3RvcFNpZ25hbCBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJzdG9wcGVkXCIpO1xuICAgIHRoaXMubmFtZSA9IFwiU3RvcFNpZ25hbFwiO1xuICB9XG59XG5cbmNvbnN0IHNsZWVwID0gKG1zOiBudW1iZXIpID0+IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIG1zKSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGJyb2FkY2FzdChldmVudDogRXh0cmFjdGlvbkV2ZW50KSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKGV2ZW50KTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gUG9wdXAgY2xvc2VkIC0gbm90aGluZyB0byB1cGRhdGUuXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2V0U3RhdGUoc3RhdGU6IEV4dHJhY3RTdGF0ZSkge1xuICBhd2FpdCBleHRyYWN0U3RhdGVTdG9yYWdlLnNldFZhbHVlKHN0YXRlKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaXNTdG9wcGVkKCkge1xuICByZXR1cm4gZXh0cmFjdFN0b3BTdG9yYWdlLmdldFZhbHVlKCk7XG59XG5cbi8qKiBGcmllbmRseSBtZXNzYWdlIGZvciB0aGUgdHdvIGZhaWx1cmUgbW9kZXMgdXNlcnMgYWN0dWFsbHkgaGl0LiAqL1xuZnVuY3Rpb24gZnJpZW5kbHlJbmplY3RFcnJvcihyYXc6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICgvY2Fubm90IGFjY2VzcyBjb250ZW50c3xjYW5ub3QgYmUgc2NyaXB0ZWR8Y2hyb21lOlxcL1xcLy9pLnRlc3QocmF3KSkge1xuICAgIHJldHVybiBcItin24zZhiDYtdmB2K3ZhyDZgtin2KjZhCDYp9iz2qnYsduM2b7YqiDZhtuM2LPYqiAtINix2YjbjCDYtdmB2K3ZhyDZhNuM2LPYqiDYr9ix2YjYsyAo2KLZhdmI2LLYtNuM2KfYsSkg2KjYp9i024zYr1wiO1xuICB9XG4gIGlmICgvaGFzIG5vdCBiZWVuIGludm9rZWR8YWN0aXZlVGFiL2kudGVzdChyYXcpKSB7XG4gICAgcmV0dXJuIFwi2K/Ys9iq2LHYs9uMINio2Ycg2LXZgdit2Ycg2K/Yp9iv2Ycg2YbYtNivIC0g2b7Zhtis2LHZhyDYp9mB2LLZiNmG2Ycg2LHYpyDYsdmI24wg2YfZhdin2YYg2LXZgdit2Ycg2KjYp9iyINqp2YbbjNivINmIINiv2YjYqNin2LHZhyDYqtmE2KfYtCDaqdmG24zYr1wiO1xuICB9XG4gIHJldHVybiByYXc7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGluamVjdDxUPih0YWJJZDogbnVtYmVyLCBmdW5jOiAoKSA9PiBUKTogUHJvbWlzZTxUPiB7XG4gIGxldCByZXN1bHQ6IFQgfCBudWxsIHwgdW5kZWZpbmVkO1xuICB0cnkge1xuICAgIGNvbnN0IFtlbnRyeV0gPSBhd2FpdCBicm93c2VyLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KHtcbiAgICAgIHRhcmdldDogeyB0YWJJZCB9LFxuICAgICAgZnVuYyxcbiAgICB9KTtcbiAgICByZXN1bHQgPSBlbnRyeT8ucmVzdWx0IGFzIFQgfCBudWxsIHwgdW5kZWZpbmVkO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IHJhdyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZnJpZW5kbHlJbmplY3RFcnJvcihyYXcpKTtcbiAgfVxuXG4gIC8vIEEgdGhyb3duL3NlcmlhbGl6ZWQtYXdheSBwYWdlLXNpZGUgZnVuY3Rpb24gcmVzb2x2ZXMgd2l0aCBudWxsIGhlcmUgLVxuICAvLyBmYWlsIGxvdWRseSBpbnN0ZWFkIG9mIGxlYWtpbmcgbnVsbCBpbnRvIGNhbGxlcnMgKG51bGwuaGFzUHJldiBldGMpLlxuICBpZiAocmVzdWx0ID09PSBudWxsIHx8IHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCLYp9iz2qnYsduM2b7YqiDYqtiy2LHbjNmC4oCM2LTYr9mHINmG2KrbjNis2YfigIzYp9uMINio2LHZhtqv2LHYr9in2YbYryAtINi12YHYrdmHINix2Kcg2K/ZiNio2KfYsdmHINio2KfYsiDaqdmG24zYr1wiLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIEJlc3QtZWZmb3J0IHJlYWQgLSB1c2VkIGZvciBwb2xsaW5nIHdoZXJlIGEgdGhyb3cganVzdCBtZWFucyBcIm5vdCB5ZXRcIi4gKi9cbmFzeW5jIGZ1bmN0aW9uIHRyeUluamVjdDxUPih0YWJJZDogbnVtYmVyLCBmdW5jOiAoKSA9PiBUKTogUHJvbWlzZTxUIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBpbmplY3Q8VD4odGFiSWQsIGZ1bmMpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5pbnRlcmZhY2UgRG9jU3RhdGUge1xuICBlcG9jaDogbnVtYmVyO1xuICByZWFkeVN0YXRlOiBzdHJpbmc7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWREb2NTdGF0ZSh0YWJJZDogbnVtYmVyKTogUHJvbWlzZTxEb2NTdGF0ZSB8IG51bGw+IHtcbiAgcmV0dXJuIHRyeUluamVjdDxEb2NTdGF0ZT4odGFiSWQsICgpID0+ICh7XG4gICAgZXBvY2g6IHBlcmZvcm1hbmNlLnRpbWVPcmlnaW4sXG4gICAgcmVhZHlTdGF0ZTogZG9jdW1lbnQucmVhZHlTdGF0ZSxcbiAgfSkpO1xufVxuXG4vKipcbiAqIFdhaXQgdW50aWwgdGhlIHRhYiBzaG93cyBhIE5FVyBkb2N1bWVudCAoZXBvY2ggZGlmZmVycyBmcm9tIHByZXZFcG9jaCkgYW5kXG4gKiB0aGF0IGRvY3VtZW50IGZpbmlzaGVkIGxvYWRpbmcuIEZhbGxzIGJhY2sgdG8gdGhlIHRpbWVvdXQgb24gcGF0aG9sb2dpY2FsXG4gKiBob3N0cyBzbyB0aGUgbG9vcCBhbHdheXMgbWFrZXMgcHJvZ3Jlc3Mgb3IgZmFpbHMgbG91ZGx5LlxuICovXG5hc3luYyBmdW5jdGlvbiB3YWl0Rm9yTmV3UGFnZShcbiAgdGFiSWQ6IG51bWJlcixcbiAgcHJldkVwb2NoOiBudW1iZXIsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgTE9BRF9USU1FT1VUX01TO1xuXG4gIC8vIFBoYXNlIDE6IGEgZG9jdW1lbnQgd2l0aCBhIGRpZmZlcmVudCB0aW1lT3JpZ2luIG11c3QgYXBwZWFyLlxuICB3aGlsZSAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lKSB7XG4gICAgaWYgKGF3YWl0IGlzU3RvcHBlZCgpKSB0aHJvdyBuZXcgU3RvcFNpZ25hbCgpO1xuICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgcmVhZERvY1N0YXRlKHRhYklkKTtcbiAgICBpZiAoc3RhdGUgJiYgc3RhdGUuZXBvY2ggIT09IHByZXZFcG9jaCkgYnJlYWs7XG4gICAgYXdhaXQgc2xlZXAoUE9MTF9JTlRFUlZBTF9NUyk7XG4gIH1cblxuICAvLyBQaGFzZSAyOiB0aGF0IGRvY3VtZW50IG11c3QgcmVhY2ggcmVhZHlTdGF0ZSBjb21wbGV0ZS5cbiAgd2hpbGUgKERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgcmVhZERvY1N0YXRlKHRhYklkKTtcbiAgICBpZiAoIXN0YXRlIHx8IHN0YXRlLnJlYWR5U3RhdGUgPT09IFwiY29tcGxldGVcIikgYnJlYWs7XG4gICAgYXdhaXQgc2xlZXAoUE9MTF9JTlRFUlZBTF9NUyk7XG4gIH1cblxuICAvLyBMZXQgdGhlIHRhYmxlIHJlbmRlci5cbiAgYXdhaXQgc2xlZXAoU0VUVExFX0RFTEFZX01TKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY2xpY2tQYWdpbmF0b3IoXG4gIHRhYklkOiBudW1iZXIsXG4gIHNlbGVjdG9yOiBzdHJpbmcsXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBbcmVzdWx0XSA9IGF3YWl0IGJyb3dzZXIuc2NyaXB0aW5nLmV4ZWN1dGVTY3JpcHQoe1xuICAgICAgdGFyZ2V0OiB7IHRhYklkIH0sXG4gICAgICBmdW5jOiAoc2VsOiBzdHJpbmcpID0+IHtcbiAgICAgICAgY29uc3QgYnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MQnV0dG9uRWxlbWVudD4oc2VsKTtcbiAgICAgICAgaWYgKCFidG4gfHwgYnRuLmRpc2FibGVkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGJ0bi5jbGljaygpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICBhcmdzOiBbc2VsZWN0b3JdLFxuICAgIH0pO1xuICAgIHJldHVybiAocmVzdWx0Py5yZXN1bHQgYXMgYm9vbGVhbikgPz8gZmFsc2U7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB0cnVlOyAvLyBuYXZpZ2F0aW9uIHN0YXJ0ZWQgbWlkLWluamVjdGlvbiAtIHRoZSBjbGljayBsYW5kZWRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZWFkUGFnaW5nKFxuICB0YWJJZDogbnVtYmVyLFxuICByZWFkRm46ICgpID0+IFBhZ2luZ0luZm8sXG4pOiBQcm9taXNlPFBhZ2luZ0luZm8+IHtcbiAgcmV0dXJuIChcbiAgICAoYXdhaXQgdHJ5SW5qZWN0PFBhZ2luZ0luZm8+KHRhYklkLCByZWFkRm4pKSA/PyB7XG4gICAgICB0b3RhbFJlY29yZHM6IG51bGwsXG4gICAgICBmcm9tOiBudWxsLFxuICAgICAgdG86IG51bGwsXG4gICAgICBoYXNOZXh0OiBmYWxzZSxcbiAgICAgIGhhc1ByZXY6IGZhbHNlLFxuICAgIH1cbiAgKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bkV4dHJhY3Rpb24oXG4gIHRhYklkOiBudW1iZXIsXG4gIHVuaXZlcnNpdHlJZD86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBhZGFwdGVyID0gZ2V0VW5pdmVyc2l0eUFkYXB0ZXIodW5pdmVyc2l0eUlkID8/IFwiZ2VuZXJpY1wiKTtcbiAgY29uc3QgY3VycmVudCA9IGF3YWl0IGV4dHJhY3RTdGF0ZVN0b3JhZ2UuZ2V0VmFsdWUoKTtcbiAgaWYgKGN1cnJlbnQ/LnJ1bm5pbmcpIHtcbiAgICBhd2FpdCBicm9hZGNhc3Qoe1xuICAgICAgdHlwZTogXCJFWFRSQUNUSU9OX0VSUk9SXCIsXG4gICAgICBlcnJvcjogXCLYp9iz2KrYrtix2KfYrCDYr9ixINit2KfZhCDYp9is2LHYp9iz2KpcIixcbiAgICB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBhd2FpdCBleHRyYWN0U3RvcFN0b3JhZ2Uuc2V0VmFsdWUoZmFsc2UpO1xuICBhd2FpdCBzZXRTdGF0ZSh7IHJ1bm5pbmc6IHRydWUsIHByb2dyZXNzOiBudWxsIH0pO1xuICBhd2FpdCBicm9hZGNhc3QoeyB0eXBlOiBcIkVYVFJBQ1RJT05fU1RBUlRFRFwiLCB0YWJJZCB9KTtcblxuICBsZXQgcGFnZXMgPSAwO1xuICBsZXQgdG90YWxEdXBsaWNhdGVDb3VudCA9IDA7XG4gIGxldCBsYXN0UHJvZ3Jlc3M6IEV4dHJhY3Rpb25Qcm9ncmVzcyB8IG51bGwgPSBudWxsO1xuXG4gIHRyeSB7XG4gICAgLy8g4pSA4pSAIERpcmVjdGlvbjogbGFzdCBwYWdlIGNvbGxlY3RzIGJhY2t3YXJkLCBvdGhlcndpc2UgcmV3aW5kK2ZvcndhcmQg4pSA4pSAXG4gICAgY29uc3QgaW5pdGlhbFBhZ2luZyA9IGF3YWl0IHJlYWRQYWdpbmcodGFiSWQsIGFkYXB0ZXIucmVhZFBhZ2luZyk7XG4gICAgLy8gTGFzdCBwYWdlID0gdGhlIG5leHQgYnV0dG9uIGlzIGRpc2FibGVkLCBvciB0aGUgcmVjb3JkIHJhbmdlIGVuZHMgYXRcbiAgICAvLyB0aGUgdG90YWwgKFwi2LHZg9mI2LHYryAyMDEg2KrYpyAyMjIg2KfYsiAyMjJcIikuXG4gICAgY29uc3Qgc3RhcnRPbkxhc3RQYWdlID1cbiAgICAgICFpbml0aWFsUGFnaW5nLmhhc05leHQgfHxcbiAgICAgIChpbml0aWFsUGFnaW5nLnRvICE9PSBudWxsICYmXG4gICAgICAgIGluaXRpYWxQYWdpbmcudG90YWxSZWNvcmRzICE9PSBudWxsICYmXG4gICAgICAgIGluaXRpYWxQYWdpbmcudG8gPj0gaW5pdGlhbFBhZ2luZy50b3RhbFJlY29yZHMpO1xuICAgIGNvbnN0IGRpcmVjdGlvbjogXCJmb3J3YXJkXCIgfCBcImJhY2t3YXJkXCIgPSBzdGFydE9uTGFzdFBhZ2VcbiAgICAgID8gXCJiYWNrd2FyZFwiXG4gICAgICA6IFwiZm9yd2FyZFwiO1xuXG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gXCJmb3J3YXJkXCIpIHtcbiAgICAgIC8vIOKUgOKUgCBSZXdpbmQgdG8gcGFnZSAxIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICAgICAgbGV0IHBhZ2luZyA9IGluaXRpYWxQYWdpbmc7XG4gICAgICBsZXQgZ3VhcmQgPSAwO1xuXG4gICAgICB3aGlsZSAocGFnaW5nPy5oYXNQcmV2ICYmIGd1YXJkIDwgNTApIHtcbiAgICAgICAgaWYgKGF3YWl0IGlzU3RvcHBlZCgpKSB0aHJvdyBuZXcgU3RvcFNpZ25hbCgpO1xuICAgICAgICBhd2FpdCBicm9hZGNhc3Qoe1xuICAgICAgICAgIHR5cGU6IFwiRVhUUkFDVElPTl9QUk9HUkVTU1wiLFxuICAgICAgICAgIHByb2dyZXNzOiB7XG4gICAgICAgICAgICBwaGFzZTogXCJyZXdpbmRcIixcbiAgICAgICAgICAgIHBhZ2U6IDAsXG4gICAgICAgICAgICB0b3RhbFBhZ2VzOiBudWxsLFxuICAgICAgICAgICAgY29sbGVjdGVkUm93czogMCxcbiAgICAgICAgICAgIGFkZGVkUm93czogMCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IFwi2KjYsdqv2LTYqiDYqNmHINi12YHYrdmHINin2YjZhOKAplwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGVwb2NoID0gKGF3YWl0IHJlYWREb2NTdGF0ZSh0YWJJZCkpPy5lcG9jaCA/PyAwO1xuICAgICAgICBjb25zdCBjbGlja2VkID0gYXdhaXQgY2xpY2tQYWdpbmF0b3IodGFiSWQsIFwic3BhbiNwcmVQYWdlIGJ1dHRvblwiKTtcbiAgICAgICAgaWYgKCFjbGlja2VkKSBicmVhaztcbiAgICAgICAgYXdhaXQgd2FpdEZvck5ld1BhZ2UodGFiSWQsIGVwb2NoKTtcbiAgICAgICAgcGFnaW5nID0gYXdhaXQgcmVhZFBhZ2luZyh0YWJJZCwgYWRhcHRlci5yZWFkUGFnaW5nKTtcbiAgICAgICAgZ3VhcmQrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDilIDilIAgQ29sbGVjdCBwYWdlIGJ5IHBhZ2UgaW4gdGhlIGNob3NlbiBkaXJlY3Rpb24g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gICAgLy8gcGFnZVNpemUgPSBsYXJnZXN0IG9ic2VydmVkIHBhZ2UuIEEgc2hvcnQgTEFTVCBwYWdlIChlLmcuIDIwMS4uMjIyIG9mXG4gICAgLy8gMjIyKSBtdXN0IG5vdCBzaHJpbmsgaXQgLSBvdGhlcndpc2UgcGFnZSBtYXRoIGRlcmFpbHMgKGNlaWwoMjAxLzIyKSkuXG4gICAgbGV0IHBhZ2VTaXplID0gMDtcbiAgICBsZXQgYW5jaG9yU2VlbiA9IGZhbHNlOyAvLyBzYXcgYSBwYWdlIHN0YXJ0aW5nIGF0IHJlY29yZCAxXG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKGF3YWl0IGlzU3RvcHBlZCgpKSB0aHJvdyBuZXcgU3RvcFNpZ25hbCgpO1xuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpbmplY3QodGFiSWQsIGFkYXB0ZXIuc2NyYXBlKTtcbiAgICAgIGlmIChyZXN1bHQucm93cy5sZW5ndGggPT09IDAgJiYgcmVzdWx0Lm1hdGNoZWRGaWVsZHMgPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwi2KzYr9mI2YQg2K/YsdmI2LMg2K/YsSDYp9uM2YYg2LXZgdit2Ycg2b7bjNiv2Kcg2YbYtNivXCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdWx0LnBhZ2luZy5mcm9tID09PSAxKSBhbmNob3JTZWVuID0gdHJ1ZTtcbiAgICAgIGlmIChyZXN1bHQucGFnaW5nLnRvICYmIHJlc3VsdC5wYWdpbmcuZnJvbSkge1xuICAgICAgICBwYWdlU2l6ZSA9IE1hdGgubWF4KFxuICAgICAgICAgIHBhZ2VTaXplLFxuICAgICAgICAgIHJlc3VsdC5wYWdpbmcudG8gLSByZXN1bHQucGFnaW5nLmZyb20gKyAxLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcGFnZXMrKztcbiAgICAgIHRvdGFsRHVwbGljYXRlQ291bnQgKz0gcmVzdWx0LmR1cGxpY2F0ZUNvdW50O1xuXG4gICAgICBjb25zdCBzdG9yZWQgPSBhd2FpdCBvZmZlcmluZ3NTdG9yYWdlLmdldFZhbHVlKCk7XG4gICAgICBjb25zdCB7IG1lcmdlZCwgYWRkZWQgfSA9IG1lcmdlUm93cyhzdG9yZWQsIHJlc3VsdC5yb3dzKTtcbiAgICAgIGF3YWl0IG9mZmVyaW5nc1N0b3JhZ2Uuc2V0VmFsdWUobWVyZ2VkKTsgLy8gYXV0by1zYXZlIGFmdGVyIGV2ZXJ5IHBhZ2VcblxuICAgICAgY29uc3QgaXNMYXN0UGFnZSA9XG4gICAgICAgIHJlc3VsdC5wYWdpbmcudG90YWxSZWNvcmRzICE9PSBudWxsICYmXG4gICAgICAgIHJlc3VsdC5wYWdpbmcudG8gIT09IG51bGwgJiZcbiAgICAgICAgcmVzdWx0LnBhZ2luZy50byA+PSByZXN1bHQucGFnaW5nLnRvdGFsUmVjb3JkcztcblxuICAgICAgY29uc3QgdG90YWxQYWdlcyA9XG4gICAgICAgIHJlc3VsdC5wYWdpbmcudG90YWxSZWNvcmRzICYmIHBhZ2VTaXplID4gMFxuICAgICAgICAgID8gTWF0aC5jZWlsKHJlc3VsdC5wYWdpbmcudG90YWxSZWNvcmRzIC8gcGFnZVNpemUpXG4gICAgICAgICAgOiBudWxsO1xuICAgICAgY29uc3QgY29tcHV0ZWRQYWdlID1cbiAgICAgICAgcmVzdWx0LnBhZ2luZy5mcm9tICE9PSBudWxsICYmIHBhZ2VTaXplID4gMFxuICAgICAgICAgID8gTWF0aC5jZWlsKHJlc3VsdC5wYWdpbmcuZnJvbSAvIHBhZ2VTaXplKVxuICAgICAgICAgIDogcGFnZXM7XG5cbiAgICAgIC8vIE51bWJlcnMgYXJlIG9ubHkgdHJ1c3R3b3J0aHkgb25jZSBhIGZ1bGwgcGFnZSBhbmNob3JlZCBwYWdlU2l6ZS5cbiAgICAgIC8vIEJhY2t3YXJkIHJ1bnMgc3RhcnQgT04gdGhlIHNob3J0IGxhc3QgcGFnZSAtIHNob3cgYSBwbGFpbiBsYWJlbFxuICAgICAgLy8gdGhlcmUgaW5zdGVhZCBvZiBcIti12YHYrdmHIDEwINin2LIgMTFcIiBub25zZW5zZS5cbiAgICAgIGNvbnN0IHNob3dOdW1iZXJzID0gIWlzTGFzdFBhZ2UgfHwgYW5jaG9yU2VlbjtcbiAgICAgIGxhc3RQcm9ncmVzcyA9IHtcbiAgICAgICAgcGhhc2U6IFwiY29sbGVjdFwiLFxuICAgICAgICBwYWdlOiBzaG93TnVtYmVycyA/IGNvbXB1dGVkUGFnZSA6IDAsXG4gICAgICAgIHRvdGFsUGFnZXM6IHNob3dOdW1iZXJzID8gdG90YWxQYWdlcyA6IG51bGwsXG4gICAgICAgIGNvbGxlY3RlZFJvd3M6IG1lcmdlZC5sZW5ndGgsXG4gICAgICAgIGFkZGVkUm93czogYWRkZWQsXG4gICAgICAgIG1lc3NhZ2U6IHNob3dOdW1iZXJzXG4gICAgICAgICAgPyBg2KfYs9iq2K7Ysdin2Kwg2LXZgdit2YcgJHtjb21wdXRlZFBhZ2V9INin2LIgJHt0b3RhbFBhZ2VzID8/IFwiP1wifeKApmBcbiAgICAgICAgICA6IFwi2KfYs9iq2K7Ysdin2Kwg2LXZgdit2Ycg2KLYrtix4oCmXCIsXG4gICAgICB9O1xuICAgICAgYXdhaXQgc2V0U3RhdGUoeyBydW5uaW5nOiB0cnVlLCBwcm9ncmVzczogbGFzdFByb2dyZXNzIH0pO1xuICAgICAgYXdhaXQgYnJvYWRjYXN0KHsgdHlwZTogXCJFWFRSQUNUSU9OX1BST0dSRVNTXCIsIHByb2dyZXNzOiBsYXN0UHJvZ3Jlc3MgfSk7XG5cbiAgICAgIGNvbnN0IGhhc01vcmUgPVxuICAgICAgICBkaXJlY3Rpb24gPT09IFwiZm9yd2FyZFwiXG4gICAgICAgICAgPyByZXN1bHQucGFnaW5nLmhhc05leHRcbiAgICAgICAgICA6IHJlc3VsdC5wYWdpbmcuaGFzUHJldjtcbiAgICAgIGlmICghaGFzTW9yZSkgYnJlYWs7IC8vIHJlYWNoZWQgdGhlIGVuZCBpbiB0aGlzIGRpcmVjdGlvblxuICAgICAgaWYgKGF3YWl0IGlzU3RvcHBlZCgpKSB0aHJvdyBuZXcgU3RvcFNpZ25hbCgpO1xuXG4gICAgICAvLyBGaW5nZXJwcmludCBUSElTIGRvY3VtZW50IGJlZm9yZSBjbGlja2luZyBzbyB0aGUgd2FpdCBjYW4gcHJvdmUgdGhlXG4gICAgICAvLyBuZXcgcGFnZSBhY3R1YWxseSBhcnJpdmVkICh0YWIgc3RhdHVzIGFsb25lIGlzIHN0YWxlIGFmdGVyIGNsaWNrcykuXG4gICAgICBjb25zdCBlcG9jaCA9IChhd2FpdCByZWFkRG9jU3RhdGUodGFiSWQpKT8uZXBvY2ggPz8gMDtcbiAgICAgIGNvbnN0IGNsaWNrZWQgPSBhd2FpdCBjbGlja1BhZ2luYXRvcihcbiAgICAgICAgdGFiSWQsXG4gICAgICAgIGRpcmVjdGlvbiA9PT0gXCJmb3J3YXJkXCJcbiAgICAgICAgICA/IFwic3BhbiNuZXh0UGFnZSBidXR0b25cIlxuICAgICAgICAgIDogXCJzcGFuI3ByZVBhZ2UgYnV0dG9uXCIsXG4gICAgICApO1xuICAgICAgaWYgKCFjbGlja2VkKSBicmVhazsgLy8gcGFnaW5hdG9yIHZhbmlzaGVkIC0gdHJlYXQgYXMgbGFzdCBwYWdlXG4gICAgICBhd2FpdCB3YWl0Rm9yTmV3UGFnZSh0YWJJZCwgZXBvY2gpO1xuICAgIH1cblxuICAgIC8vIFBydW5lIGp1bmsgcm93cyAoZW1wdHkgaW5kZXgpIGxlZnQgb3ZlciBmcm9tIG9sZGVyIGJ1Z2d5IHJ1bnMuXG4gICAgY29uc3Qgc3RvcmVkID0gYXdhaXQgb2ZmZXJpbmdzU3RvcmFnZS5nZXRWYWx1ZSgpO1xuICAgIGlmIChzdG9yZWQuc29tZSgocm93KSA9PiAhcm93LmluZGV4KSkge1xuICAgICAgYXdhaXQgb2ZmZXJpbmdzU3RvcmFnZS5zZXRWYWx1ZShzdG9yZWQuZmlsdGVyKChyb3cpID0+IHJvdy5pbmRleCkpO1xuICAgIH1cblxuICAgIGF3YWl0IHNldFN0YXRlKHsgcnVubmluZzogZmFsc2UsIHByb2dyZXNzOiBudWxsIH0pO1xuICAgIGF3YWl0IGJyb2FkY2FzdCh7XG4gICAgICB0eXBlOiBcIkVYVFJBQ1RJT05fRE9ORVwiLFxuICAgICAgdG90YWxSb3dzOiAoYXdhaXQgb2ZmZXJpbmdzU3RvcmFnZS5nZXRWYWx1ZSgpKS5sZW5ndGgsXG4gICAgICBwYWdlcyxcbiAgICAgIGR1cGxpY2F0ZUNvdW50OiB0b3RhbER1cGxpY2F0ZUNvdW50LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIFN0b3BTaWduYWwpIHtcbiAgICAgIGNvbnN0IHRvdGFsUm93cyA9IChhd2FpdCBvZmZlcmluZ3NTdG9yYWdlLmdldFZhbHVlKCkpLmxlbmd0aDtcbiAgICAgIGF3YWl0IHNldFN0YXRlKHsgcnVubmluZzogZmFsc2UsIHByb2dyZXNzOiBudWxsIH0pO1xuICAgICAgYXdhaXQgYnJvYWRjYXN0KHsgdHlwZTogXCJFWFRSQUNUSU9OX1NUT1BQRURcIiwgdG90YWxSb3dzIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2UgPVxuICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcItiu2LfYp9uMINmG2KfYtNmG2KfYrtiq2Ycg2K/YsSDYp9iz2KrYrtix2KfYrFwiO1xuICAgIGF3YWl0IHNldFN0YXRlKHsgcnVubmluZzogZmFsc2UsIHByb2dyZXNzOiBudWxsIH0pO1xuICAgIGF3YWl0IGJyb2FkY2FzdCh7IHR5cGU6IFwiRVhUUkFDVElPTl9FUlJPUlwiLCBlcnJvcjogbWVzc2FnZSB9KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCIjaW1wb3J0c1wiO1xuXG5pbXBvcnQgeyBydW5FeHRyYWN0aW9uIH0gZnJvbSBcIi4uL2xpYi9leHRyYWN0b3JcIjtcbmltcG9ydCB7XG4gIGV4dHJhY3RTdGF0ZVN0b3JhZ2UsXG4gIGV4dHJhY3RTdG9wU3RvcmFnZSxcbn0gZnJvbSBcIi4uL2xpYi9zdG9yYWdlXCI7XG5pbXBvcnQgdHlwZSB7IEJhY2tncm91bmRSZXF1ZXN0IH0gZnJvbSBcIi4uL2xpYi90eXBlc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihcbiAgICAobWVzc2FnZTogQmFja2dyb3VuZFJlcXVlc3QsIF9zZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgICAgdm9pZCBoYW5kbGVNZXNzYWdlKG1lc3NhZ2UpLnRoZW4oc2VuZFJlc3BvbnNlKTtcbiAgICAgIHJldHVybiB0cnVlOyAvLyBhc3luYyByZXNwb25zZVxuICAgIH0sXG4gICk7XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlTWVzc2FnZShtZXNzYWdlOiBCYWNrZ3JvdW5kUmVxdWVzdCk6IFByb21pc2U8dW5rbm93bj4ge1xuICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgIGNhc2UgXCJTVEFSVF9FWFRSQUNUSU9OXCI6IHtcbiAgICAgIC8vIFByZWZlciB0aGUgdGFiIGlkIHRoZSBwb3B1cCBzYXcgKHJlbGlhYmxlKTsgZmFsbCBiYWNrIHRvIHF1ZXJ5aW5nLlxuICAgICAgbGV0IHRhYklkID0gbWVzc2FnZS50YWJJZDtcbiAgICAgIGlmICghdGFiSWQpIHtcbiAgICAgICAgY29uc3QgW3RhYl0gPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoe1xuICAgICAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICBjdXJyZW50V2luZG93OiB0cnVlLFxuICAgICAgICB9KTtcbiAgICAgICAgdGFiSWQgPSB0YWI/LmlkO1xuICAgICAgfVxuICAgICAgaWYgKCF0YWJJZCkge1xuICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBcItiq2Kgg2YHYudin2YTbjCDZvtuM2K/YpyDZhti02K9cIiB9O1xuICAgICAgfVxuICAgICAgLy8gRmlyZSBhbmQgZm9yZ2V0IC0gcHJvZ3Jlc3MgZmxvd3MgdGhyb3VnaCBFWFRSQUNUSU9OXyogZXZlbnRzLlxuICAgICAgdm9pZCBydW5FeHRyYWN0aW9uKHRhYklkLCBtZXNzYWdlLnVuaXZlcnNpdHlJZCk7XG4gICAgICByZXR1cm4geyBvazogdHJ1ZSwgdGFiSWQgfTtcbiAgICB9XG5cbiAgICBjYXNlIFwiU1RPUF9FWFRSQUNUSU9OXCI6IHtcbiAgICAgIGF3YWl0IGV4dHJhY3RTdG9wU3RvcmFnZS5zZXRWYWx1ZSh0cnVlKTtcbiAgICAgIHJldHVybiB7IG9rOiB0cnVlIH07XG4gICAgfVxuXG4gICAgY2FzZSBcIkdFVF9FWFRSQUNUSU9OX1NUQVRFXCI6IHtcbiAgICAgIHJldHVybiB7IG9rOiB0cnVlLCBzdGF0ZTogYXdhaXQgZXh0cmFjdFN0YXRlU3RvcmFnZS5nZXRWYWx1ZSgpIH07XG4gICAgfVxuICB9XG59XG4iLCIvLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vKipcbiogQ2xhc3MgZm9yIHBhcnNpbmcgYW5kIHBlcmZvcm1pbmcgb3BlcmF0aW9ucyBvbiBtYXRjaCBwYXR0ZXJucy5cbipcbiogQGV4YW1wbGVcbiogICBjb25zdCBwYXR0ZXJuID0gbmV3IE1hdGNoUGF0dGVybignKjovL2dvb2dsZS5jb20vKicpO1xuKlxuKiAgIHBhdHRlcm4uaW5jbHVkZXMoJ2h0dHBzOi8vZ29vZ2xlLmNvbScpOyAvLyB0cnVlXG4qICAgcGF0dGVybi5pbmNsdWRlcygnaHR0cDovL3lvdXR1YmUuY29tL3dhdGNoP3Y9MTIzJyk7IC8vIGZhbHNlXG4qL1xudmFyIE1hdGNoUGF0dGVybiA9IGNsYXNzIE1hdGNoUGF0dGVybiB7XG5cdHN0YXRpYyB7XG5cdFx0dGhpcy5QUk9UT0NPTFMgPSBbXG5cdFx0XHRcImh0dHBcIixcblx0XHRcdFwiaHR0cHNcIixcblx0XHRcdFwiZmlsZVwiLFxuXHRcdFx0XCJmdHBcIixcblx0XHRcdFwidXJuXCIsXG5cdFx0XHRcIndzXCIsXG5cdFx0XHRcIndzc1wiXG5cdFx0XTtcblx0fVxuXHQvKipcblx0KiBQYXJzZSBhIG1hdGNoIHBhdHRlcm4gc3RyaW5nLiBJZiBpdCBpcyBpbnZhbGlkLCB0aGUgY29uc3RydWN0b3Igd2lsbCB0aHJvdyBhblxuXHQqIGBJbnZhbGlkTWF0Y2hQYXR0ZXJuYCBlcnJvci5cblx0KlxuXHQqIEBwYXJhbSBtYXRjaFBhdHRlcm4gVGhlIG1hdGNoIHBhdHRlcm4gdG8gcGFyc2UuXG5cdCovXG5cdGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybikge1xuXHRcdGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XG5cdFx0XHR0aGlzLmlzQWxsVXJscyA9IHRydWU7XG5cdFx0XHR0aGlzLnByb3RvY29sTWF0Y2hlcyA9IFsuLi5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcblx0XHRcdHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuXHRcdFx0dGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuXHRcdFx0aWYgKGdyb3VwcyA9PSBudWxsKSB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcblx0XHRcdGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3Vwcztcblx0XHRcdHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG5cdFx0XHR2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuXHRcdFx0dGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuXHRcdFx0dGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG5cdFx0XHR0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcblx0XHR9XG5cdH1cblx0LyoqIENoZWNrIGlmIGEgVVJMIGlzIGluY2x1ZGVkIGluIGEgcGF0dGVybi4gKi9cblx0aW5jbHVkZXModXJsKSB7XG5cdFx0Y29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuXHRcdGlmICh0aGlzLmlzQWxsVXJscykgcmV0dXJuICF0aGlzLmlzVW5rbm93blByb3RvY29sKHUpO1xuXHRcdHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG5cdFx0XHRpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKSByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKSByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG5cdFx0XHRpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKSByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIikgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIikgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcblx0XHR9KTtcblx0fVxuXHRpc0h0dHBNYXRjaCh1cmwpIHtcblx0XHRyZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcblx0fVxuXHRpc0h0dHBzTWF0Y2godXJsKSB7XG5cdFx0cmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuXHR9XG5cdGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcblx0XHRpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKSByZXR1cm4gZmFsc2U7XG5cdFx0Y29uc3QgaG9zdG5hbWVNYXRjaFJlZ2V4cyA9IFt0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLCB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gucmVwbGFjZSgvXlxcKlxcLi8sIFwiXCIpKV07XG5cdFx0Y29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcblx0XHRyZXR1cm4gISFob3N0bmFtZU1hdGNoUmVnZXhzLmZpbmQoKHJlZ2V4KSA9PiByZWdleC50ZXN0KHVybC5ob3N0bmFtZSkpICYmIHBhdGhuYW1lTWF0Y2hSZWdleC50ZXN0KHVybC5wYXRobmFtZSk7XG5cdH1cblx0aXNVbmtub3duUHJvdG9jb2wodXJsKSB7XG5cdFx0cmV0dXJuICF0aGlzLnByb3RvY29sTWF0Y2hlcy5pbmNsdWRlcyh1cmwucHJvdG9jb2wuc2xpY2UoMCwgLTEpKTtcblx0fVxuXHRpc1BhdGhNYXRjaCh1cmwpIHtcblx0XHRpZiAoIXRoaXMucGF0aG5hbWVNYXRjaCkgcmV0dXJuIGZhbHNlO1xuXHRcdHJldHVybiB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpLnRlc3QodXJsLnBhdGhuYW1lKTtcblx0fVxuXHRpc0ZpbGVNYXRjaCh1cmwpIHtcblx0XHRyZXR1cm4gdXJsLnByb3RvY29sID09PSBcImZpbGU6XCIgJiYgdGhpcy5pc1BhdGhNYXRjaCh1cmwpO1xuXHR9XG5cdGlzRnRwTWF0Y2goX3VybCkge1xuXHRcdHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuXHR9XG5cdGlzVXJuTWF0Y2goX3VybCkge1xuXHRcdHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuXHR9XG5cdGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG5cdFx0Y29uc3Qgc3RhcnNSZXBsYWNlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybikucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuXHRcdHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuXHR9XG5cdGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuXHRcdHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuXHR9XG59O1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcblx0XHRzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuXHR9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG5cdGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKSB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYCk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcblx0aWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSkgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBgSG9zdG5hbWUgY2Fubm90IGluY2x1ZGUgYSBwb3J0YCk7XG5cdGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIipcIikgJiYgaG9zdG5hbWUubGVuZ3RoID4gMSAmJiAhaG9zdG5hbWUuc3RhcnRzV2l0aChcIiouXCIpKSB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYCk7XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IEludmFsaWRNYXRjaFBhdHRlcm4sIE1hdGNoUGF0dGVybiB9O1xuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDEsMiw4LDksMTAsMTRdLCJtYXBwaW5ncyI6Ijs7Ozs7Q0FDQSxTQUFTLGlCQUFpQixLQUFLO0VBQzlCLElBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxZQUFZLE9BQU8sRUFBRSxNQUFNLElBQUk7RUFDakUsT0FBTztDQUNSOzs7Q0NIQSxJQUFhQSxZQUFVLFdBQVcsU0FBUyxTQUFTLEtBQ2hELFdBQVcsVUFDWCxXQUFXOzs7Ozs7Ozs7Ozs7Ozs7OztDQ2FmLElBQU0sVUFBVTs7Ozs7Ozs7O0NDb0VoQixTQUFnQixVQUNkLFFBQ0EsVUFDaUU7RUFDakUsTUFBTSwwQkFBVSxJQUFJLElBQTZCO0VBQ2pELEtBQUssTUFBTSxPQUFPLFFBQVEsSUFBSSxJQUFJLE9BQU8sUUFBUSxJQUFJLElBQUksT0FBTyxHQUFHO0VBRW5FLElBQUksUUFBUTtFQUNaLElBQUksWUFBWTtFQUNoQixLQUFLLE1BQU0sT0FBTyxVQUFVO0dBQzFCLElBQUksQ0FBQyxJQUFJLE9BQU87R0FDaEIsSUFBSSxRQUFRLElBQUksSUFBSSxLQUFLLEdBQUc7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QUFBO0VBQ0Y7RUFJQSxJQUFBLFdBQUEsUUFBQSxXQUFBLEtBQUEsR0FDRSxNQUFBLElBQUEsTUFBQSxnRUFBQTtFQUlGLE9BQUE7Q0FDRjs7Q0FHQSxlQUFBLFVBQUEsT0FBQSxNQUFBO0VBQ0UsSUFBQTtHQUNFLE9BQUEsTUFBQSxPQUFBLE9BQUEsSUFBQTtFQUNGLFFBQUE7R0FDRSxPQUFBO0VBQ0Y7Q0FDRjtDQU9BLGVBQUEsYUFBQSxPQUFBO0VBQ0UsT0FBQSxVQUFBLGNBQUE7R0FDRSxPQUFBLFlBQUE7R0FDQSxZQUFBLFNBQUE7RUFDRixFQUFBO0NBQ0Y7Ozs7OztDQU9BLGVBQUEsZUFBQSxPQUFBLFdBQUE7RUFJRSxNQUFBLFdBQUEsS0FBQSxJQUFBLElBQUE7RUFHQSxPQUFBLEtBQUEsSUFBQSxJQUFBLFVBQUE7R0FDRSxJQUFBLE1BQUEsVUFBQSxHQUFBLE1BQUEsSUFBQSxXQUFBO0dBQ0EsTUFBQSxRQUFBLE1BQUEsYUFBQSxLQUFBO0dBQ0EsSUFBQSxTQUFBLE1BQUEsVUFBQSxXQUFBO0dBQ0EsTUFBQSxNQUFBLGdCQUFBO0VBQ0Y7RUFHQSxPQUFBLEtBQUEsSUFBQSxJQUFBLFVBQUE7R0FDRSxNQUFBLFFBQUEsTUFBQSxhQUFBLEtBQUE7R0FDQSxJQUFBLENBQUEsU0FBQSxNQUFBLGVBQUEsWUFBQTtHQUNBLE1BQUEsTUFBQSxnQkFBQTtFQUNGO0VBR0EsTUFBQSxNQUFBLGVBQUE7Q0FDRjtDQUVBLGVBQUEsZUFBQSxPQUFBLFVBQUE7RUFJRSxJQUFBO0dBQ0UsTUFBQSxDQUFBLFVBQUEsTUFBQSxRQUFBLFVBQUEsY0FBQTtJQUNFLFFBQUEsRUFBQSxNQUFBO0lBQ0EsT0FBQSxRQUFBO0tBQ0UsTUFBQSxNQUFBLFNBQUEsY0FBQSxHQUFBO0tBQ0EsSUFBQSxDQUFBLE9BQUEsSUFBQSxVQUFBLE9BQUE7S0FDQSxJQUFBLE1BQUE7S0FDQSxPQUFBO0lBQ0Y7SUFDQSxNQUFBLENBQUEsUUFBQTtHQUNGLENBQUE7R0FDQSxPQUFBLFFBQUEsVUFBQTtFQUNGLFFBQUE7R0FDRSxPQUFBO0VBQ0Y7Q0FDRjtDQUVBLGVBQUEsV0FBQSxPQUFBLFFBQUE7RUFJRSxPQUFBLE1BQUEsVUFBQSxPQUFBLE1BQUEsS0FBQTtHQUVJLGNBQUE7R0FDQSxNQUFBO0dBQ0EsSUFBQTtHQUNBLFNBQUE7R0FDQSxTQUFBO0VBQ0Y7Q0FFSjtDQUVBLGVBQUEsY0FBQSxPQUFBLGNBQUE7RUFJRSxNQUFBLFVBQUEscUJBQUEsZ0JBQUEsU0FBQTtFQUVBLEtBQUEsTUFEQSxvQkFBQSxTQUFBLEVBQUEsRUFDQSxTQUFBO0dBQ0UsTUFBQSxVQUFBO0lBQ0UsTUFBQTtJQUNBLE9BQUE7R0FDRixDQUFBO0dBQ0E7RUFDRjtFQUVBLE1BQUEsbUJBQUEsU0FBQSxLQUFBO0VBQ0EsTUFBQSxTQUFBO0dBQWlCLFNBQUE7R0FBZSxVQUFBO0VBQWUsQ0FBQTtFQUMvQyxNQUFBLFVBQUE7R0FBa0IsTUFBQTtHQUE0QjtFQUFNLENBQUE7RUFFcEQsSUFBQSxRQUFBO0VBQ0EsSUFBQSxzQkFBQTtFQUNBLElBQUEsZUFBQTtFQUVBLElBQUE7R0FFRSxNQUFBLGdCQUFBLE1BQUEsV0FBQSxPQUFBLFFBQUEsVUFBQTtHQVFBLE1BQUEsWUFMQSxDQUFBLGNBQUEsV0FBQSxjQUFBLE9BQUEsUUFBQSxjQUFBLGlCQUFBLFFBQUEsY0FBQSxNQUFBLGNBQUEsZUFLQSxhQUFBO0dBSUEsSUFBQSxjQUFBLFdBQUE7SUFFRSxJQUFBLFNBQUE7SUFDQSxJQUFBLFFBQUE7SUFFQSxPQUFBLFFBQUEsV0FBQSxRQUFBLElBQUE7S0FDRSxJQUFBLE1BQUEsVUFBQSxHQUFBLE1BQUEsSUFBQSxXQUFBO0tBQ0EsTUFBQSxVQUFBO01BQ0UsTUFBQTtNQUNBLFVBQUE7T0FDRSxPQUFBO09BQ0EsTUFBQTtPQUNBLFlBQUE7T0FDQSxlQUFBO09BQ0EsV0FBQTtPQUNBLFNBQUE7TUFDRjtLQUNGLENBQUE7S0FFQSxNQUFBLFNBQUEsTUFBQSxhQUFBLEtBQUEsRUFBQSxFQUFBLFNBQUE7S0FFQSxJQUFBLENBQUEsTUFEQSxlQUFBLE9BQUEscUJBQUEsR0FDQTtLQUNBLE1BQUEsZUFBQSxPQUFBLEtBQUE7S0FDQSxTQUFBLE1BQUEsV0FBQSxPQUFBLFFBQUEsVUFBQTtLQUNBO0lBQ0Y7R0FDRjtHQUtBLElBQUEsV0FBQTtHQUNBLElBQUEsYUFBQTtHQUVBLE9BQUEsTUFBQTtJQUNFLElBQUEsTUFBQSxVQUFBLEdBQUEsTUFBQSxJQUFBLFdBQUE7SUFFQSxNQUFBLFNBQUEsTUFBQSxPQUFBLE9BQUEsUUFBQSxNQUFBO0lBQ0EsSUFBQSxPQUFBLEtBQUEsV0FBQSxLQUFBLE9BQUEsa0JBQUEsR0FDRSxNQUFBLElBQUEsTUFBQSxnQ0FBQTtJQUdGLElBQUEsT0FBQSxPQUFBLFNBQUEsR0FBQSxhQUFBO0lBQ0EsSUFBQSxPQUFBLE9BQUEsTUFBQSxPQUFBLE9BQUEsTUFDRSxXQUFBLEtBQUEsSUFBQSxVQUFBLE9BQUEsT0FBQSxLQUFBLE9BQUEsT0FBQSxPQUFBLENBQUE7SUFLRjtJQUNBLHVCQUFBLE9BQUE7SUFHQSxNQUFBLEVBQUEsUUFBQSxVQUFBLFVBQUEsTUFEQSxpQkFBQSxTQUFBLEdBQ0EsT0FBQSxJQUFBO0lBQ0EsTUFBQSxpQkFBQSxTQUFBLE1BQUE7SUFFQSxNQUFBLGFBQUEsT0FBQSxPQUFBLGlCQUFBLFFBQUEsT0FBQSxPQUFBLE9BQUEsUUFBQSxPQUFBLE9BQUEsTUFBQSxPQUFBLE9BQUE7SUFLQSxNQUFBLGFBQUEsT0FBQSxPQUFBLGdCQUFBLFdBQUEsSUFBQSxLQUFBLEtBQUEsT0FBQSxPQUFBLGVBQUEsUUFBQSxJQUFBO0lBSUEsTUFBQSxlQUFBLE9BQUEsT0FBQSxTQUFBLFFBQUEsV0FBQSxJQUFBLEtBQUEsS0FBQSxPQUFBLE9BQUEsT0FBQSxRQUFBLElBQUE7SUFRQSxNQUFBLGNBQUEsQ0FBQSxjQUFBO0lBQ0EsZUFBQTtLQUNFLE9BQUE7S0FDQSxNQUFBLGNBQUEsZUFBQTtLQUNBLFlBQUEsY0FBQSxhQUFBO0tBQ0EsZUFBQSxPQUFBO0tBQ0EsV0FBQTtLQUNBLFNBQUEsY0FBQSxnQkFBQSxhQUFBLE1BQUEsY0FBQSxJQUFBLEtBQUE7SUFHRjtJ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