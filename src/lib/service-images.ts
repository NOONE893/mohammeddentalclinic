import checkup from "@/assets/services/checkup.jpg";
import cleaning from "@/assets/services/cleaning.jpg";
import filling from "@/assets/services/filling.jpg";
import rootCanal from "@/assets/services/root-canal.jpg";
import extraction from "@/assets/services/extraction.jpg";
import crown from "@/assets/services/crown.jpg";
import implant from "@/assets/services/implant.jpg";
import whitening from "@/assets/services/whitening.jpg";

const RULES: [RegExp, string][] = [
  [/تنظيف|تلميع|جير/, cleaning],
  [/حشو/, filling],
  [/عصب|جذور/, rootCanal],
  [/خلع/, extraction],
  [/تاج|زركون|تركيب|جسر|فينير|ابتسامة/, crown],
  [/زراع/, implant],
  [/تبييض/, whitening],
  [/كشف|استشار|فحص/, checkup],
];

/** Default photo for a service, chosen from its name; uploaded photos override this. */
export function defaultServiceImage(name: string) {
  return RULES.find(([re]) => re.test(name))?.[1] ?? checkup;
}
