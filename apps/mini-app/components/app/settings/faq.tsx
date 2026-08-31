"use client"

import { useState } from "react"
import { HelpCircle } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { SettingsRow } from "@/components/app/theme/settings-row"

const FAQS = [
  {
    value: "what-is",
    q: "این اپلیکیشن چیه؟",
    a: "یه ابزار آنلاین برای دانشجوهاست که باهاش می‌تونید برنامه کلاسی، برنامه امتحانی، دروس پاس‌شده و وضعیت فارغ‌التحصیلی‌تون رو ببینید و مدیریت کنید.",
  },
  {
    value: "incomplete",
    q: "چرا جلوی نوار پیشرفت «چارت ناقص» نوشته؟",
    a: "یعنی هنوز لیست کامل درس‌های رشته شما توی سیستم ثبت نشده. مثلاً یه سری درس‌ها یا ترم‌ها هنوز اضافه نشده. ولی خیالتون راحت باشه — هر درسی که خودتون پاس کردید درست حساب می‌شه و فقط عدد کل واحدها مشخص نیست.",
  },
  {
    value: "progress-zero",
    q: "چرا پیشرفت من عدد عجیبی نشون می‌ده؟",
    a: "وقتی چارت رشته شما کامل نیست، سیستم نمی‌دونه مجموعاً چند واحد لازم دارید. برای همین به‌جای عدد مشخص، علامت سوال نشون می‌ده. ولی تعداد واحدهایی که پاس کردید درسته و نوار پیشرفت هم درست رنگش عوض می‌شه.",
  },
  {
    value: "prereq-units",
    q: "یه درس نوشته «پیش‌نیاز: گذراندن ۱۰۰ واحد» یعنی چی؟",
    a: "یعنی باید حداقل ۱۰۰ واحد درس پاس کرده باشید تا بتونید اون درس رو انتخاب کنید. این یه شرط کلیه — فرقی نداره چه درسی پاس کردید، فقط تعداد واحدها مهمه.",
  },

  {
    value: "noted-courses",
    q: "لیست یادداشت چیه و چه فایده‌ای داره؟",
    a: "هر درسی که دوست دارید می‌تونید به لیست یادداشت اضافه کنید. اینجوری همه دروس مورد علاقه‌تون یه‌جا جمعه و راحت‌تر می‌تونید مقایسه کنید و برنامه‌ریزی کنید. موقع انتخاب واحد می‌تونید سریع از لیستتون کد درسارو بردارید، سریع جستجو کنید و درستونو انتخاب کنید. می‌تونید از لیست یادداشت خروجی عکس هم بگیرید.",
  },
  {
    value: "export-image",
    q: "خروجی عکس چیه؟",
    a: "می‌تونید برنامه کلاسی یا امتحانی‌تون رو به صورت عکس داشته باشید. کافیه توی بخش برنامه هفتگی یا امتحانی، دکمه «خروجی عکس» رو بزنید و حالت روشن یا تیره رو انتخاب کنید. عکس توی تلگرامتون ارسال می‌شه.",
  },
  {
    value: "gpa",
    q: "ثبت معدل چیه و چه فایده‌ای داره؟",
    a: "می‌تونید معدل نیم‌سال خودتون رو ثبت کنید. بر اساس معدلتون، سیستم بهتون می‌گه چند واحد می‌تونید انتخاب کنید (مثلاً ۱۴ یا ۲۰ یا ۲۴ واحد). اینجوری وقتی دارید درس انتخاب می‌کنید، اگه از حد مجاز رد بشید بهتون هشدار می‌ده.",
  },
  {
    value: "passed-courses",
    q: "دروس پاس‌شده رو از کجا تغییر بدم؟",
    a: "توی صفحه پروفایل، بخش فارغ‌التحصیلی رو کلیک کنید. اونجا می‌تونید درس‌هایی که پاس کردید رو تیک بزنید یا بردارید. همچنین توی لیست یادداشت هم می‌تونید همه درس‌ها رو یه‌جا به پاس‌شده اضافه کنید.",
  },
  {
    value: "conflicts",
    q: "آیا اگه دو درس ساعتشون تداخل داشته باشه بهم می‌گه؟",
    a: "بله! اگه دو درس انتخاب کنید که ساعت کلاسشون یکی باشه، یا درسی انتخاب کنید که پیش‌نیازش رو پاس نکردید، سیستم بهتون هشدار می‌ده تا مشکلی پیش نیاد.",
  },
  {
    value: "data-source",
    q: "اطلاعات از کجا میاد؟",
    a: "اطلاعات دروس و اساتید به صورت دستی از آموزشیار استخراج و بروزرسانی می‌شه. فقط کافیه رشته و دانشگاه خودتون رو توی تنظیمات انتخاب کنید.",
  },
] as const

export default function Faq() {
  const [open, setOpen] = useState(false)
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<HelpCircle className="size-5" />}
            title="سوالات متداول"
            description="پاسخ پرسش‌های پرتکرار"
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        {" "}
        <DrawerHeader>
          <DrawerTitle>سوالات متداول</DrawerTitle>
          <DrawerDescription>
            اگه سوالی دارید اینجا رو نگاه کنید
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <div className="p-4">
            <Accordion className="w-full">
              {FAQS.map((item) => (
                <AccordionItem key={item.value} value={item.value}>
                  <AccordionTrigger className="text-sm">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-6 text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
