import type { LocalizedText } from "../types";

export type SocialPrompt = {
  readonly id: string;
  readonly text: Readonly<LocalizedText>;
};

const traits: readonly (readonly [string, string])[] = [
  ["ينسى أين وضع هاتفه", "forget where they put their phone"],
  ["يصبح مشهوراً", "become famous"], ["يضحك في وقت غير مناسب", "laugh at the wrong moment"],
  ["يسافر حول العالم", "travel around the world"], ["ينام أثناء فيلم", "fall asleep during a movie"],
  ["ينجو في جزيرة مهجورة", "survive on a deserted island"], ["يتأخر عن موعده", "arrive late"],
  ["يفوز في مسابقة طبخ", "win a cooking contest"], ["يتبنى حيواناً غريباً", "adopt an unusual pet"],
  ["يبدأ مشروعاً ناجحاً", "start a successful business"], ["يقرأ كل التعليمات", "read every instruction"],
  ["يرقص في حفلة", "dance at a party"], ["يصبح رائد فضاء", "become an astronaut"],
  ["ينسى عيد ميلاده", "forget their own birthday"], ["يتعلم لغة جديدة", "learn a new language"],
  ["يتحدث مع شخص غريب", "talk to a stranger"], ["يفوز ببرنامج مسابقات", "win a game show"],
  ["يبكي في فيلم كرتون", "cry during a cartoon"], ["يعيش بلا إنترنت", "live without the internet"],
  ["يكتب كتاباً", "write a book"], ["يطلب الحلوى أولاً", "order dessert first"],
  ["يصبح قائداً للفريق", "become the team leader"], ["يخوض مغامرة مفاجئة", "take a surprise adventure"],
  ["يحفظ كلمات أغنية", "memorize song lyrics"], ["يستيقظ قبل المنبه", "wake before the alarm"],
  ["يحل لغزاً صعباً", "solve a difficult mystery"], ["يفقد مفاتيحه", "lose their keys"],
  ["يشارك طعامه", "share their food"], ["يصبح ممثلاً", "become an actor"],
  ["يجرب أكلة غريبة", "try a strange food"], ["يرتب رحلة المجموعة", "plan the group trip"],
  ["يتعثر على أرض مستوية", "trip on flat ground"], ["يفوز بماراثون", "win a marathon"],
  ["يرد بسرعة على الرسائل", "reply quickly to messages"], ["يقتني أكبر مكتبة", "own the biggest library"],
  ["يضحك حتى يبكي", "laugh until they cry"], ["يصلح جهازاً معطلاً", "fix a broken device"],
  ["يتطوع لمساعدة الآخرين", "volunteer to help others"], ["يعيش في بلد آخر", "live in another country"],
  ["يصبح معلماً", "become a teacher"], ["يطلب الاتجاهات", "ask for directions"],
  ["يفوز في لعبة جماعية", "win a party game"], ["يبدأ الغناء فجأة", "start singing unexpectedly"],
  ["يتذكر تفاصيل صغيرة", "remember tiny details"], ["يصور كل شيء", "photograph everything"],
];

export const MOST_LIKELY_TO_PROMPTS: readonly SocialPrompt[] = traits.map(
  ([ar, en], index) => ({
    id: `most-likely-${String(index + 1).padStart(3, "0")}`,
    text: { ar: `من الأكثر احتمالاً أن ${ar}؟`, en: `Who is most likely to ${en}?` },
  }),
);
