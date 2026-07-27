import type { LocalizedText } from "../types";

export type Category = {
  id: string;
  title: LocalizedText;
  emoji: string;
  words: LocalizedText[];
};

export const DEFAULT_PLAYERS: string[] = [];

export const CATEGORIES: Category[] = [
  { id: "cities", title: { ar: "مدن عربية", en: "Cities" }, emoji: "🏙️", words: [["دمشق","Damascus"],["بيروت","Beirut"],["عمّان","Amman"],["القاهرة","Cairo"],["دبي","Dubai"],["الدوحة","Doha"],["مراكش","Marrakesh"],["بغداد","Baghdad"],["القدس","Jerusalem"],["جدة","Jeddah"],["مسقط","Muscat"],["تونس","Tunis"]].map(([ar,en]) => ({ar,en})) },
  { id: "food", title: { ar: "أكلات", en: "Food" }, emoji: "🍽️", words: [["مقلوبة","Maqluba"],["كبسة","Kabsa"],["منسف","Mansaf"],["كبة","Kibbeh"],["شاورما","Shawarma"],["فتوش","Fattoush"],["محشي","Mahshi"],["مسخّن","Musakhan"],["فلافل","Falafel"],["ورق عنب","Stuffed vine leaves"],["برياني","Biryani"],["كنافة","Kunafa"]].map(([ar,en]) => ({ar,en})) },
  { id: "places", title: { ar: "أماكن", en: "Places" }, emoji: "📍", words: [["المطار","Airport"],["المستشفى","Hospital"],["الجامعة","University"],["الشاطئ","Beach"],["المكتبة","Library"],["السوق","Market"],["الملعب","Stadium"],["المتحف","Museum"],["المطعم","Restaurant"],["الحديقة","Park"],["السينما","Cinema"],["الفندق","Hotel"]].map(([ar,en]) => ({ar,en})) },
  { id: "jobs", title: { ar: "مهن", en: "Jobs" }, emoji: "🧑‍💼", words: [["طبيب","Doctor"],["مهندس","Engineer"],["طيار","Pilot"],["معلّم","Teacher"],["محامي","Lawyer"],["صيدلي","Pharmacist"],["صحفي","Journalist"],["مصمم","Designer"],["طباخ","Chef"],["مصور","Photographer"],["ممرض","Nurse"],["مترجم","Translator"]].map(([ar,en]) => ({ar,en})) },
  { id: "animals", title: { ar: "حيوانات", en: "Animals" }, emoji: "🦁", words: [["أسد","Lion"],["زرافة","Giraffe"],["دلفين","Dolphin"],["بطريق","Penguin"],["حصان","Horse"],["فيل","Elephant"],["نمر","Tiger"],["قرد","Monkey"],["سلحفاة","Turtle"],["جمل","Camel"],["طاووس","Peacock"],["كنغر","Kangaroo"]].map(([ar,en]) => ({ar,en})) },
  { id: "objects", title: { ar: "أشياء يومية", en: "Everyday things" }, emoji: "🎒", words: [["مفتاح","Key"],["مرآة","Mirror"],["مظلة","Umbrella"],["وسادة","Pillow"],["ساعة","Watch"],["نظارة","Glasses"],["حقيبة","Bag"],["شمعة","Candle"],["هاتف","Phone"],["مقص","Scissors"],["زجاجة","Bottle"],["دفتر","Notebook"]].map(([ar,en]) => ({ar,en})) },
  { id: "sports", title: { ar: "رياضة", en: "Sports" }, emoji: "⚽", words: [["كرة القدم","Football"],["سباحة","Swimming"],["تنس","Tennis"],["كرة سلة","Basketball"],["ملاكمة","Boxing"],["ركوب الخيل","Horse riding"],["تزلج","Skiing"],["كرة طائرة","Volleyball"],["جري","Running"],["غولف","Golf"],["رماية","Archery"],["دراجات","Cycling"]].map(([ar,en]) => ({ar,en})) },
  { id: "movies", title: { ar: "ترفيه", en: "Entertainment" }, emoji: "🎬", words: [["مسلسل","TV series"],["فيلم","Movie"],["مسرحية","Play"],["حفلة","Concert"],["بودكاست","Podcast"],["لعبة فيديو","Video game"],["أغنية","Song"],["رواية","Novel"],["سيرك","Circus"],["مهرجان","Festival"],["كرتون","Cartoon"],["مسابقة","Competition"]].map(([ar,en]) => ({ar,en})) },
];
