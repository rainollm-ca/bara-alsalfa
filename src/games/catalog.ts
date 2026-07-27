import type { GameDefinition } from "./types";

export const GAME_CATALOG: GameDefinition[] = [
  {
    id: "category-challenge",
    title: { ar: "تحدّي الفئات", en: "Category Challenge" },
    description: {
      ar: "تسابقوا لذكر إجابات تنتمي إلى الفئة قبل انتهاء الوقت.",
      en: "Race to name answers that fit the category before time runs out.",
    },
    emoji: "🗂️",
    playerRange: { min: 2, max: 12 },
    approximateMinutes: 15,
    supportedModes: ["local", "room"],
  },
  {
    id: "out-of-loop",
    title: { ar: "برا السالفة", en: "Out of the Loop" },
    description: {
      ar: "اكتشفوا من لا يعرف الكلمة السرية قبل أن يكتشفها هو.",
      en: "Find the player who does not know the secret word before they figure it out.",
    },
    emoji: "🕵️",
    playerRange: { min: 3, max: 12 },
    approximateMinutes: 15,
    supportedModes: ["local", "room"],
  },
  {
    id: "charades",
    title: { ar: "تمثيل صامت", en: "Charades" },
    description: {
      ar: "مثّل الكلمة من دون كلام ودع فريقك يحزرها.",
      en: "Act out the word without speaking and let your team guess it.",
    },
    emoji: "🎭",
    playerRange: { min: 4, max: 16 },
    approximateMinutes: 20,
    supportedModes: ["local", "room"],
  },
  {
    id: "forbidden-word",
    title: { ar: "الكلمة الممنوعة", en: "Forbidden Word" },
    description: {
      ar: "اشرح الكلمة لفريقك من دون استخدام الكلمات الممنوعة.",
      en: "Describe the target to your team without using the forbidden words.",
    },
    emoji: "🚫",
    playerRange: { min: 4, max: 16 },
    approximateMinutes: 20,
    supportedModes: ["local", "room"],
  },
  {
    id: "who-am-i",
    title: { ar: "من أنا؟", en: "Who Am I?" },
    description: {
      ar: "اطرح أسئلة بنعم أو لا لتعرف الشخصية المخفية.",
      en: "Ask yes-or-no questions to discover your hidden identity.",
    },
    emoji: "❓",
    playerRange: { min: 2, max: 12 },
    approximateMinutes: 15,
    supportedModes: ["local", "room"],
  },
  {
    id: "rapid-fire",
    title: { ar: "إجابات سريعة", en: "Rapid Fire" },
    description: {
      ar: "أجب عن أكبر عدد من الأسئلة قبل انتهاء العدّ التنازلي.",
      en: "Answer as many prompts as possible before the countdown ends.",
    },
    emoji: "⚡",
    playerRange: { min: 2, max: 12 },
    approximateMinutes: 10,
    supportedModes: ["local", "room"],
  },
  {
    id: "most-likely-to",
    title: { ar: "مين الأكثر احتمالاً؟", en: "Most Likely To" },
    description: {
      ar: "صوّتوا للشخص الأكثر احتمالاً أن ينطبق عليه السؤال.",
      en: "Vote for the person most likely to match each prompt.",
    },
    emoji: "👉",
    playerRange: { min: 3, max: 16 },
    approximateMinutes: 15,
    supportedModes: ["local", "room"],
  },
  {
    id: "two-truths-lie",
    title: { ar: "حقيقتان وكذبة", en: "Two Truths and a Lie" },
    description: {
      ar: "شارك ثلاث جمل عن نفسك ودع الآخرين يكتشفون الكذبة.",
      en: "Share three statements about yourself and let the others spot the lie.",
    },
    emoji: "🤥",
    playerRange: { min: 3, max: 12 },
    approximateMinutes: 20,
    supportedModes: ["local", "room"],
  },
];
