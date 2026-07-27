export type LocalizedText = {
  ar: string;
  en: string;
};

export type GameId =
  | "category-challenge"
  | "out-of-loop"
  | "charades"
  | "forbidden-word"
  | "who-am-i"
  | "rapid-fire"
  | "most-likely-to"
  | "two-truths-lie";

export type PlayMode = "local" | "room";

export type GameDefinition = {
  id: GameId;
  title: LocalizedText;
  description: LocalizedText;
  emoji: string;
  playerRange: {
    min: number;
    max: number;
  };
  approximateMinutes: number;
  supportedModes: PlayMode[];
};
