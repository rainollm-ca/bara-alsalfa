export type Locale = "ar" | "en";
export type LocalizedText = { ar: string; en: string };

export type Category = {
  id: string;
  title: LocalizedText;
  emoji: string;
  words: LocalizedText[];
};

export type PlayerRole = {
  player: string;
  isOutsider: boolean;
  word: string | null;
};

export type GameRound = {
  category: Category;
  categoryTitle: string;
  word: string;
  outsider: string;
  roles: PlayerRole[];
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

export function normalizePlayers(players: string[]): string[] {
  const seen = new Set<string>();
  return players
    .map((name) => name.trim())
    .filter((name) => {
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

export function buildRound(
  players: string[],
  category: Category,
  locale: Locale = "ar",
  random: () => number = Math.random,
): GameRound {
  const cleanPlayers = normalizePlayers(players);
  if (cleanPlayers.length < 3) throw new Error("تحتاج اللعبة إلى 3 لاعبين على الأقل");
  const outsiderIndex = Math.floor(random() * cleanPlayers.length);
  const word = category.words[Math.floor(random() * category.words.length)][locale];
  const outsider = cleanPlayers[outsiderIndex];
  return {
    category,
    categoryTitle: category.title[locale],
    word,
    outsider,
    roles: cleanPlayers.map((player, index) => ({
      player,
      isOutsider: index === outsiderIndex,
      word: index === outsiderIndex ? null : word,
    })),
  };
}

export function calculateVote(votes: Record<string, string>) {
  const counts = Object.values(votes).reduce<Record<string, number>>((acc, name) => {
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
  const max = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter((name) => counts[name] === max);
  return { leaders, tied: leaders.length > 1 };
}
