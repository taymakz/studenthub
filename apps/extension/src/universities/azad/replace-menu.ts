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
export function replaceMainMenu() {
  function findMainMenu(): HTMLElement | null {
    let mainMenuDiv = document.getElementById("mainmenu");

    // Check Shadow DOMs
    if (!mainMenuDiv) {
      document.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) {
          const shadowElement = el.shadowRoot.getElementById("mainmenu");
          if (shadowElement) {
            mainMenuDiv = shadowElement;
          }
        }
      });
    }

    // Check inside iframes
    if (!mainMenuDiv) {
      document.querySelectorAll("iframe").forEach((iframe) => {
        try {
          const iframeDoc =
            iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const iframeElement = iframeDoc.getElementById("mainmenu");
            if (iframeElement) {
              mainMenuDiv = iframeElement;
            }
          }
        } catch {
          // cross-origin iframe - unreachable by design
        }
      });
    }

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
          </script>
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

        </script>
      </form>

      <script type="text/javascript" src="/EServices/js/menu/menu.js"></script>
      <script type="text/javascript" src="/EServices/js/PersianKeyboard/jquery.farsiInput.js"></script>
          </div>

      `;
      mainMenuDiv.parentNode?.replaceChild(newElement, mainMenuDiv);
    } else {
      console.error('Element with ID "mainmenu" not found.');
    }
  }

  // Ensure the script runs after the DOM is fully loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", replaceElement);
  } else {
    replaceElement();
  }

  // Observe dynamic changes
  const observer = new MutationObserver(() => {
    replaceElement();
    observer.disconnect(); // Stop observing once replaced
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
