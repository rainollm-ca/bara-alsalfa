export type Category = {
  id: string;
  title: string;
  emoji: string;
  words: string[];
};

export type PlayerRole = {
  player: string;
  isOutsider: boolean;
  word: string | null;
};

export type GameRound = {
  category: Category;
  word: string;
  outsider: string;
  roles: PlayerRole[];
};

export const DEFAULT_PLAYERS = [
  "نور",
  "رقية",
  "ضحى",
  "هشام",
  "زينب",
  "فاطمة",
  "مصطفى",
  "جمان",
  "ربيع",
];

export const CATEGORIES: Category[] = [
  { id: "cities", title: "مدن عربية", emoji: "🏙️", words: ["دمشق", "بيروت", "عمّان", "القاهرة", "دبي", "الدوحة", "مراكش", "بغداد", "القدس", "جدة", "مسقط", "تونس"] },
  { id: "food", title: "أكلات", emoji: "🍽️", words: ["مقلوبة", "كبسة", "منسف", "كبة", "شاورما", "فتوش", "محشي", "مسخّن", "فلافل", "ورق عنب", "برياني", "كنافة"] },
  { id: "places", title: "أماكن", emoji: "📍", words: ["المطار", "المستشفى", "الجامعة", "الشاطئ", "المكتبة", "السوق", "الملعب", "المتحف", "المطعم", "الحديقة", "السينما", "الفندق"] },
  { id: "jobs", title: "مهن", emoji: "🧑‍💼", words: ["طبيب", "مهندس", "طيار", "معلّم", "محامي", "صيدلي", "صحفي", "مصمم", "طباخ", "مصور", "ممرض", "مترجم"] },
  { id: "animals", title: "حيوانات", emoji: "🦁", words: ["أسد", "زرافة", "دلفين", "بطريق", "حصان", "فيل", "نمر", "قرد", "سلحفاة", "جمل", "طاووس", "كنغر"] },
  { id: "objects", title: "أشياء يومية", emoji: "🎒", words: ["مفتاح", "مرآة", "مظلة", "وسادة", "ساعة", "نظارة", "حقيبة", "شمعة", "هاتف", "مقص", "زجاجة", "دفتر"] },
  { id: "sports", title: "رياضة", emoji: "⚽", words: ["كرة القدم", "سباحة", "تنس", "كرة سلة", "ملاكمة", "ركوب الخيل", "تزلج", "كرة طائرة", "جري", "غولف", "رماية", "دراجات"] },
  { id: "movies", title: "ترفيه", emoji: "🎬", words: ["مسلسل", "فيلم", "مسرحية", "حفلة", "بودكاست", "لعبة فيديو", "أغنية", "رواية", "سيرك", "مهرجان", "كرتون", "مسابقة"] },
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
  random: () => number = Math.random,
): GameRound {
  const cleanPlayers = normalizePlayers(players);
  if (cleanPlayers.length < 3) throw new Error("تحتاج اللعبة إلى 3 لاعبين على الأقل");
  const outsiderIndex = Math.floor(random() * cleanPlayers.length);
  const word = category.words[Math.floor(random() * category.words.length)];
  const outsider = cleanPlayers[outsiderIndex];
  return {
    category,
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
