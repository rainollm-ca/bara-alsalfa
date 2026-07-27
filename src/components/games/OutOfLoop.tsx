"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, RotateCcw, Shuffle, Sparkles, Users } from "lucide-react";
import { CategorySelector, PlayerNamesField, SetupShell, validateSetup } from "../SetupShell";
import { buildRound, calculateVote, CATEGORIES, DEFAULT_PLAYERS, normalizePlayers, type GameRound, type Locale } from "../../lib/game";

type Screen = "home" | "setup" | "reveal" | "play" | "vote-pass" | "vote" | "result";

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
    passVote: "مرّروا الجوال إلى", readyVote: "جاهز، صوّت بسرية", lockVote: "ثبّت صوتي", tiedVote: "تعادل في التصويت",
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
    passVote: "Pass the phone to", readyVote: "Ready, vote privately", lockVote: "Lock my vote", tiedVote: "The vote was tied",
    again: "New round, same players", change: "Change players or category", footer: "Made for good company · No data collected",
  },
} as const;

type OutOfLoopProps = {
  locale: Locale;
};

export function OutOfLoop({ locale }: OutOfLoopProps) {
  const [screen, setScreen] = useState<Screen>("home");
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [newName, setNewName] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [round, setRound] = useState<GameRound | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suspect, setSuspect] = useState("");
  const [voteIndex, setVoteIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const voteHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultAnnouncementRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (screen === "vote") voteHeadingRef.current?.focus();
    if (screen === "result") resultAnnouncementRef.current?.focus();
  }, [screen]);
  const t = copy[locale];

  const category = useMemo(() => CATEGORIES.find((item) => item.id === categoryId)!, [categoryId]);
  const setupValidation = validateSetup(normalizePlayers(players).length, { min: 3, max: 12 }, locale);

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
    setVoteIndex(0);
    setVotes({});
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
  const voteResult = calculateVote(votes);
  const outsiderSoleWinner = voteResult.leaders.length === 1 && voteResult.leaders[0] === round?.outsider;

  return (
    <>
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
          <SetupShell title={t.who} hint={t.whoHint}>
            <PlayerNamesField
              label={t.who}
              hint={t.whoHint}
              names={players}
              value={newName}
              placeholder={t.addName}
              addLabel={t.add}
              removeLabel={t.remove}
              max={12}
              onValueChange={setNewName}
              onAdd={addPlayer}
              onRemove={(index) => setPlayers(players.filter((_, itemIndex) => itemIndex !== index))}
            />
            <CategorySelector
              label={t.choose}
              hint={t.chooseHint}
              locale={locale}
              options={CATEGORIES}
              value={categoryId}
              onChange={setCategoryId}
            />
            {!setupValidation.valid && <p className="validationMessage" role="status">{setupValidation.message}</p>}
            <button data-primary-action className="primary" disabled={!setupValidation.valid} onClick={startRound}>{t.assign} <Shuffle size={20} /></button>
          </SetupShell>
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
            <button className="primary" onClick={() => setScreen("vote-pass")}>{t.vote} <Eye size={20} /></button>
          </div>
        )}

        {screen === "vote-pass" && round && <div className="reveal">
          <h2>{t.passVote}</h2><div className="bigName">{round.roles[voteIndex].player}</div>
          <p className="privacy">{t.private}</p>
          <button autoFocus className="primary" onClick={() => setScreen("vote")}>{t.readyVote}</button>
        </div>}

        {screen === "vote" && round && <div className="panel play">
          <h2 ref={voteHeadingRef} tabIndex={-1}>{t.whoOut}</h2>
          <div className="suspects">{round.roles.filter((_, index) => index !== voteIndex).map(({ player }) => <button key={player} onClick={() => setSuspect(player)} className={suspect === player ? "selected" : ""}>{player}{suspect === player && <Check size={15} />}</button>)}</div>
          <button className="primary" disabled={!suspect} onClick={() => {
            const nextVotes = { ...votes, [round.roles[voteIndex].player]: suspect };
            setVotes(nextVotes); setSuspect("");
            if (voteIndex === round.roles.length - 1) setScreen("result");
            else { setVoteIndex(voteIndex + 1); setScreen("vote-pass"); }
          }}>{t.lockVote}</button>
        </div>}

        {screen === "result" && round && (
          <div className="result">
            <div className={voteResult.tied ? "resultIcon neutral" : outsiderSoleWinner ? "resultIcon win" : "resultIcon lose"}>{voteResult.tied ? "🤝" : outsiderSoleWinner ? "🎉" : "😏"}</div>
            <p ref={resultAnnouncementRef} tabIndex={-1} aria-live="polite" className="eyebrow">{voteResult.tied ? t.tiedVote : outsiderSoleWinner ? t.caught : t.fooled}</p>
            <h2><em>{round.outsider}</em> {t.wasOut}</h2>
            <div className="answer"><span>{t.wordWas}</span><strong>{round.word}</strong><small>{round.category.emoji} {round.categoryTitle}</small></div>
            <button className="primary" onClick={startRound}><RotateCcw size={19} /> {t.again}</button>
            <button className="textButton" onClick={() => setScreen("setup")}>{t.change}</button>
          </div>
        )}
    </>
  );
}
