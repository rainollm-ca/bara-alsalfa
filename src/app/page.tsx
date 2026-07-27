"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, Plus, RotateCcw, Shuffle, Sparkles, Trash2, Users } from "lucide-react";
import { buildRound, CATEGORIES, DEFAULT_PLAYERS, normalizePlayers, type GameRound, type Locale } from "../lib/game";

type Screen = "home" | "setup" | "reveal" | "play" | "result";

const copy = {
  ar: {
    brand: "برا السالفة", tagline: "مين اللي ضايع بينكم؟", gameNight: "لعبة السهرة",
    hero1: "الكل يعرف", hero2: "السالفة", hero3: "إلا واحد.",
    intro: "مرّروا الجوال، اكتشفوا كلماتكم، واسألوا بذكاء. هل تعرفون من هو برا السالفة قبل أن يخدعكم؟",
    start: "ابدأوا اللعب", playersRange: "3–12 لاعب", categoriesCount: "8 فئات", minutes: "10 دقائق",
    who: "مين بيلعب؟", whoHint: "أدخلوا أسماء اللاعبين للبدء", addName: "أضف اسم لاعب", add: "إضافة لاعب", remove: "حذف",
    choose: "اختاروا السالفة", chooseHint: "الفئة تظهر للجميع، الكلمة سرّية", assign: "وزّع الأدوار",
    player: "اللاعب", of: "من", passTo: "ناولوا الجوال إلى", private: "تأكد إن محد غيرك يشوف", hide: "لا تخلي أحد يشوف الشاشة",
    reveal: "اضغط لتكشف دورك", hideScreen: "وخبي الشاشة عن الباقين", youAre: "أنت", outsider: "برا السالفة!",
    category: "الفئة", outsiderHint: "تصرّف طبيعي وحاول تعرف الكلمة", secretWord: "الكلمة السرّية",
    next: "خبّيت دوري، التالي", beginQuestions: "ابدأوا الأسئلة",
    investigate: "ابدأوا التحقيق", investigateHint: "كل لاعب يسأل لاعباً آخر سؤالاً عن الكلمة. لا تكونوا واضحين زيادة… ولا غامضين زيادة.",
    ask: "اسألوا بالدور", askHint: "سؤال واحد لكل لاعب", watch: "راقبوا الإجابات", watchHint: "مين كلامه مش راكب؟",
    vote: "صوّتوا سوا", voteHint: "اختاروا المشتبه به", whoOut: "مين برا السالفة؟", truth: "اكشفوا الحقيقة",
    caught: "كشفتوه!", fooled: "ضحك عليكم!", wasOut: "كان برا السالفة", wordWas: "الكلمة كانت",
    again: "جولة جديدة بنفس اللاعبين", change: "تغيير اللاعبين أو الفئة", footer: "مصممة للّمة الحلوة · لا تجمع أي بيانات",
  },
  en: {
    brand: "Out of the Loop", tagline: "Who has no idea?", gameNight: "Party game",
    hero1: "Everyone knows", hero2: "the secret", hero3: "except one.",
    intro: "Pass the phone, discover your word, and ask clever questions. Can you catch the outsider before they fool everyone?",
    start: "Start the game", playersRange: "3–12 players", categoriesCount: "8 categories", minutes: "10 minutes",
    who: "Who is playing?", whoHint: "Add player names to begin", addName: "Add a player name", add: "Add player", remove: "Remove",
    choose: "Choose a category", chooseHint: "Everyone sees the category; the word stays secret", assign: "Assign roles",
    player: "Player", of: "of", passTo: "Pass the phone to", private: "Make sure only you can see", hide: "Keep the screen hidden",
    reveal: "Tap to reveal your role", hideScreen: "Keep the screen away from everyone else", youAre: "You are", outsider: "Out of the loop!",
    category: "Category", outsiderHint: "Act natural and try to discover the word", secretWord: "Secret word",
    next: "I hid my role — next", beginQuestions: "Start the questions",
    investigate: "Start investigating", investigateHint: "Each player asks someone one question about the word. Do not be too obvious… or too vague.",
    ask: "Take turns asking", askHint: "One question per player", watch: "Watch the answers", watchHint: "Whose story does not fit?",
    vote: "Vote together", voteHint: "Choose your suspect", whoOut: "Who is out of the loop?", truth: "Reveal the truth",
    caught: "You caught them!", fooled: "They fooled you!", wasOut: "was out of the loop", wordWas: "The word was",
    again: "New round, same players", change: "Change players or category", footer: "Made for good company · No data collected",
  },
} as const;

export default function Home() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [screen, setScreen] = useState<Screen>("home");
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [newName, setNewName] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [round, setRound] = useState<GameRound | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suspect, setSuspect] = useState("");
  const t = copy[locale];

  const category = useMemo(() => CATEGORIES.find((item) => item.id === categoryId)!, [categoryId]);

  function addPlayer() {
    const clean = newName.trim();
    if (clean && !players.includes(clean) && players.length < 12) setPlayers([...players, clean]);
    setNewName("");
  }

  function startRound() {
    const nextRound = buildRound(players, category, locale);
    setRound(nextRound);
    setRevealIndex(0);
    setRevealed(false);
    setSuspect("");
    setScreen("reveal");
  }

  function nextReveal() {
    if (!round) return;
    if (revealIndex === round.roles.length - 1) {
      setScreen("play");
      return;
    }
    setRevealIndex(revealIndex + 1);
    setRevealed(false);
  }

  const role = round?.roles[revealIndex];

  return (
    <main className="shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <section className="appCard">
        <header className="brand">
          <div className="brandMark">ب</div>
          <div>
            <strong>{t.brand}</strong>
            <span>{t.tagline}</span>
          </div>
          <div className="languageSwitch" aria-label="Language">
            <button className={locale === "ar" ? "active" : ""} onClick={() => setLocale("ar")}>ع</button>
            <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button>
          </div>
        </header>

        {screen === "home" && (
          <div className="hero">
            <div className="eyebrow"><Sparkles size={16} /> {t.gameNight}</div>
            <h1>{t.hero1} <span>{t.hero2}</span><br /><em>{t.hero3}</em></h1>
            <p>{t.intro}</p>
            <button className="primary" onClick={() => setScreen("setup")}>
              {t.start} <ArrowLeft size={20} />
            </button>
            <div className="miniStats">
              <span><Users size={17} /> {t.playersRange}</span>
              <span><Shuffle size={17} /> {t.categoriesCount}</span>
              <span>⏱️ {t.minutes}</span>
            </div>
          </div>
        )}

        {screen === "setup" && (
          <div className="panel">
            <div className="step"><span>1</span><div><h2>{t.who}</h2><p>{t.whoHint}</p></div></div>
            <div className="players">
              {players.map((name, index) => (
                <div className="playerChip" key={name}>
                  <span className="avatar">{name[0]}</span>
                  <span>{name}</span>
                  <button aria-label={`${t.remove} ${name}`} onClick={() => setPlayers(players.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            {players.length < 12 && (
              <div className="addRow">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} placeholder={t.addName} />
                <button onClick={addPlayer} aria-label={t.add}><Plus size={21} /></button>
              </div>
            )}
            <div className="step categoryStep"><span>2</span><div><h2>{t.choose}</h2><p>{t.chooseHint}</p></div></div>
            <div className="categories">
              {CATEGORIES.map((item) => (
                <button key={item.id} className={categoryId === item.id ? "category active" : "category"} onClick={() => setCategoryId(item.id)}>
                  <b>{item.emoji}</b><span>{item.title[locale]}</span>{categoryId === item.id && <Check size={16} />}
                </button>
              ))}
            </div>
            <button className="primary" disabled={normalizePlayers(players).length < 3} onClick={startRound}>{t.assign} <Shuffle size={20} /></button>
          </div>
        )}

        {screen === "reveal" && role && round && (
          <div className="reveal">
            <div className="progress"><span style={{ width: `${((revealIndex + 1) / round.roles.length) * 100}%` }} /></div>
            <p className="counter">{t.player} {revealIndex + 1} {t.of} {round.roles.length}</p>
            <h2>{t.passTo}</h2>
            <div className="bigName">{role.player}</div>
            <p className="privacy">{revealed ? t.hide : t.private}</p>
            <button className={revealed ? "secretCard shown" : "secretCard"} onClick={() => setRevealed(!revealed)}>
              {!revealed ? (
                <><Eye size={34} /><strong>{t.reveal}</strong><small>{t.hideScreen}</small></>
              ) : role.isOutsider ? (
                <><EyeOff size={34} /><span className="outsiderTag">{t.youAre}</span><strong>{t.outsider}</strong><small>{t.category}: {round.categoryTitle}<br />{t.outsiderHint}</small></>
              ) : (
                <><span className="wordLabel">{t.secretWord}</span><strong>{role.word}</strong><small>{t.category}: {round.categoryTitle}</small></>
              )}
            </button>
            {revealed && <button className="primary" onClick={nextReveal}>{revealIndex === round.roles.length - 1 ? t.beginQuestions : t.next} <ArrowLeft size={20} /></button>}
          </div>
        )}

        {screen === "play" && round && (
          <div className="panel play">
            <div className="roundBadge">{round.category.emoji} {round.categoryTitle}</div>
            <h2>{t.investigate}</h2>
            <p className="lead">{t.investigateHint}</p>
            <div className="rules">
              <div><span>1</span><p><b>{t.ask}</b><br />{t.askHint}</p></div>
              <div><span>2</span><p><b>{t.watch}</b><br />{t.watchHint}</p></div>
              <div><span>3</span><p><b>{t.vote}</b><br />{t.voteHint}</p></div>
            </div>
            <h3>{t.whoOut}</h3>
            <div className="suspects">
              {round.roles.map(({ player }) => <button key={player} onClick={() => setSuspect(player)} className={suspect === player ? "selected" : ""}>{player}{suspect === player && <Check size={15} />}</button>)}
            </div>
            <button className="primary" disabled={!suspect} onClick={() => setScreen("result")}>{t.truth} <Eye size={20} /></button>
          </div>
        )}

        {screen === "result" && round && (
          <div className="result">
            <div className={suspect === round.outsider ? "resultIcon win" : "resultIcon lose"}>{suspect === round.outsider ? "🎉" : "😏"}</div>
            <p className="eyebrow">{suspect === round.outsider ? t.caught : t.fooled}</p>
            <h2><em>{round.outsider}</em> {t.wasOut}</h2>
            <div className="answer"><span>{t.wordWas}</span><strong>{round.word}</strong><small>{round.category.emoji} {round.categoryTitle}</small></div>
            <button className="primary" onClick={startRound}><RotateCcw size={19} /> {t.again}</button>
            <button className="textButton" onClick={() => setScreen("setup")}>{t.change}</button>
          </div>
        )}
      </section>
      <footer>{t.footer}</footer>
    </main>
  );
}
