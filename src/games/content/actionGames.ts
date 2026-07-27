import type { LocalizedText } from "../types";

export type ActionPrompt = {
  readonly id: string;
  readonly text: Readonly<LocalizedText>;
};

export type ForbiddenWordPrompt = ActionPrompt & {
  readonly forbidden: readonly Readonly<LocalizedText>[];
};

type Seed = readonly [ar: string, en: string, categoryAr: string, categoryEn: string];

const SEEDS: readonly Seed[] = [
  ["أسد", "Lion", "حيوان", "animal"], ["طائرة", "Airplane", "سفر", "travel"],
  ["طبيب", "Doctor", "مهنة", "job"], ["بيتزا", "Pizza", "طعام", "food"],
  ["هاتف", "Phone", "تقنية", "technology"], ["مطر", "Rain", "طقس", "weather"],
  ["كرة القدم", "Soccer", "رياضة", "sport"], ["قمر", "Moon", "فضاء", "space"],
  ["عازف غيتار", "Guitarist", "موسيقى", "music"], ["روبوت", "Robot", "آلة", "machine"],
  ["قرد", "Monkey", "حيوان", "animal"], ["قطار", "Train", "سفر", "travel"],
  ["معلم", "Teacher", "مهنة", "job"], ["آيس كريم", "Ice cream", "طعام", "food"],
  ["حاسوب", "Computer", "تقنية", "technology"], ["ثلج", "Snow", "طقس", "weather"],
  ["كرة السلة", "Basketball", "رياضة", "sport"], ["رائد فضاء", "Astronaut", "فضاء", "space"],
  ["طبال", "Drummer", "موسيقى", "music"], ["كاميرا", "Camera", "جهاز", "device"],
  ["بطريق", "Penguin", "حيوان", "animal"], ["سفينة", "Ship", "سفر", "travel"],
  ["طباخ", "Chef", "مهنة", "job"], ["فشار", "Popcorn", "طعام", "food"],
  ["لعبة فيديو", "Video game", "تقنية", "technology"], ["رياح", "Wind", "طقس", "weather"],
  ["سباحة", "Swimming", "رياضة", "sport"], ["كوكب", "Planet", "فضاء", "space"],
  ["مغنٍ", "Singer", "موسيقى", "music"], ["مصباح", "Lamp", "غرض", "object"],
  ["زرافة", "Giraffe", "حيوان", "animal"], ["سيارة أجرة", "Taxi", "سفر", "travel"],
  ["شرطي", "Police officer", "مهنة", "job"], ["كعكة", "Cake", "طعام", "food"],
  ["لوحة مفاتيح", "Keyboard", "تقنية", "technology"], ["عاصفة", "Storm", "طقس", "weather"],
  ["تنس", "Tennis", "رياضة", "sport"], ["نجم", "Star", "فضاء", "space"],
  ["راقص", "Dancer", "فن", "art"], ["مظلة", "Umbrella", "غرض", "object"],
  ["فيل", "Elephant", "حيوان", "animal"], ["دراجة", "Bicycle", "سفر", "travel"],
  ["رجل إطفاء", "Firefighter", "مهنة", "job"], ["ساندويتش", "Sandwich", "طعام", "food"],
  ["سماعات", "Headphones", "تقنية", "technology"], ["شمس", "Sun", "طقس", "weather"],
  ["ملاكمة", "Boxing", "رياضة", "sport"], ["صاروخ", "Rocket", "فضاء", "space"],
  ["رسام", "Painter", "فن", "art"], ["ساعة منبهة", "Alarm clock", "غرض", "object"],
  ["تمساح", "Crocodile", "حيوان", "animal"], ["حافلة", "Bus", "سفر", "travel"],
  ["مصور", "Photographer", "مهنة", "job"], ["بطيخ", "Watermelon", "طعام", "food"],
  ["جهاز تحكم", "Remote control", "تقنية", "technology"], ["قوس قزح", "Rainbow", "طقس", "weather"],
  ["تزلج", "Skiing", "رياضة", "sport"], ["مذنب", "Comet", "فضاء", "space"],
  ["ساحر", "Magician", "عرض", "performance"], ["مكنسة كهربائية", "Vacuum cleaner", "غرض", "object"],
];

const cloneText = (ar: string, en: string): Readonly<LocalizedText> => ({ ar, en });

const forbiddenByCategory: Readonly<
  Record<string, readonly [Readonly<LocalizedText>, Readonly<LocalizedText>, Readonly<LocalizedText>]>
> = {
  animal: [cloneText("حيوان", "animal"), cloneText("حديقة", "zoo"), cloneText("بري", "wild")],
  travel: [cloneText("سفر", "travel"), cloneText("رحلة", "trip"), cloneText("طريق", "route")],
  job: [cloneText("مهنة", "job"), cloneText("عمل", "work"), cloneText("موظف", "worker")],
  food: [cloneText("طعام", "food"), cloneText("أكل", "eat"), cloneText("مطبخ", "kitchen")],
  technology: [cloneText("تقنية", "technology"), cloneText("إلكتروني", "electronic"), cloneText("جهاز", "device")],
  weather: [cloneText("طقس", "weather"), cloneText("سماء", "sky"), cloneText("درجة الحرارة", "temperature")],
  sport: [cloneText("رياضة", "sport"), cloneText("فريق", "team"), cloneText("لاعب", "player")],
  space: [cloneText("فضاء", "space"), cloneText("سماء", "sky"), cloneText("ناسا", "NASA")],
  music: [cloneText("موسيقى", "music"), cloneText("أغنية", "song"), cloneText("لحن", "melody")],
  machine: [cloneText("آلة", "machine"), cloneText("معدن", "metal"), cloneText("محرك", "motor")],
  device: [cloneText("جهاز", "device"), cloneText("زر", "button"), cloneText("إلكتروني", "electronic")],
  art: [cloneText("فن", "art"), cloneText("إبداع", "creative"), cloneText("عرض", "show")],
  object: [cloneText("غرض", "object"), cloneText("منزل", "home"), cloneText("يستخدم", "use")],
  performance: [cloneText("عرض", "show"), cloneText("جمهور", "audience"), cloneText("مسرح", "stage")],
};

export const CHARADES_PROMPTS: readonly ActionPrompt[] = SEEDS.map(
  ([ar, en], index) => ({
    id: `charades-${String(index + 1).padStart(3, "0")}`,
    text: cloneText(ar, en),
  }),
);

export const WHO_AM_I_PROMPTS: readonly ActionPrompt[] = SEEDS.map(
  ([ar, en], index) => ({
    id: `identity-${String(index + 1).padStart(3, "0")}`,
    text: cloneText(ar, en),
  }),
);

export const RAPID_FIRE_PROMPTS: readonly ActionPrompt[] = SEEDS.map(
  ([ar, en, categoryAr, categoryEn], index) => ({
    id: `rapid-fire-${String(index + 1).padStart(3, "0")}`,
    text: cloneText(
      `اذكر شيئاً مرتبطاً بـ ${ar} أو ${categoryAr}`,
      `Name something associated with ${en} or its ${categoryEn} category`,
    ),
  }),
);

export const FORBIDDEN_WORD_PROMPTS: readonly ForbiddenWordPrompt[] = SEEDS.map(
  ([ar, en, categoryAr, categoryEn], index) => ({
    id: `forbidden-${String(index + 1).padStart(3, "0")}`,
    text: cloneText(ar, en),
    forbidden:
      forbiddenByCategory[categoryEn] ??
      [cloneText(categoryAr, categoryEn), cloneText("وصف", "describe"), cloneText("كلمة", "word")],
  }),
);
