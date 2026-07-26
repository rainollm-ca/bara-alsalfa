"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, Plus, RotateCcw, Shuffle, Sparkles, Trash2, Users } from "lucide-react";
import { buildRound, CATEGORIES, DEFAULT_PLAYERS, normalizePlayers, type GameRound } from "../lib/game";

type Screen = "home" | "setup" | "reveal" | "play" | "result";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [newName, setNewName] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [round, setRound] = useState<GameRound | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suspect, setSuspect] = useState("");

  const category = useMemo(() => CATEGORIES.find((item) => item.id === categoryId)!, [categoryId]);

  function addPlayer() {
    const clean = newName.trim();
    if (clean && !players.includes(clean) && players.length < 12) setPlayers([...players, clean]);
    setNewName("");
  }

  function startRound() {
    const nextRound = buildRound(players, category);
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
    <main className="shell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <section className="appCard">
        <header className="brand">
          <div className="brandMark">ب</div>
          <div>
            <strong>برا السالفة</strong>
            <span>مين اللي ضايع بينكم؟</span>
          </div>
        </header>

        {screen === "home" && (
          <div className="hero">
            <div className="eyebrow"><Sparkles size={16} /> لعبة السهرة</div>
            <h1>الكل يعرف السالفة<br /><em>إلا واحد.</em></h1>
            <p>مرّروا الجوال، اكتشفوا كلماتكم، واسألوا بذكاء. هل تعرفون من هو برا السالفة قبل أن يخدعكم؟</p>
            <button className="primary" onClick={() => setScreen("setup")}>
              ابدأوا اللعب <ArrowLeft size={20} />
            </button>
            <div className="miniStats">
              <span><Users size={17} /> 3–12 لاعب</span>
              <span><Shuffle size={17} /> 8 فئات</span>
              <span>⏱️ 10 دقائق</span>
            </div>
          </div>
        )}

        {screen === "setup" && (
          <div className="panel">
            <div className="step"><span>١</span><div><h2>مين بيلعب؟</h2><p>الأسماء جاهزة، عدّلها إذا احتجت</p></div></div>
            <div className="players">
              {players.map((name, index) => (
                <div className="playerChip" key={name}>
                  <span className="avatar">{name[0]}</span>
                  <span>{name}</span>
                  <button aria-label={`حذف ${name}`} onClick={() => setPlayers(players.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            {players.length < 12 && (
              <div className="addRow">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} placeholder="أضف اسم لاعب" />
                <button onClick={addPlayer} aria-label="إضافة لاعب"><Plus size={21} /></button>
              </div>
            )}
            <div className="step categoryStep"><span>٢</span><div><h2>اختاروا السالفة</h2><p>الفئة تظهر للجميع، الكلمة سرّية</p></div></div>
            <div className="categories">
              {CATEGORIES.map((item) => (
                <button key={item.id} className={categoryId === item.id ? "category active" : "category"} onClick={() => setCategoryId(item.id)}>
                  <b>{item.emoji}</b><span>{item.title}</span>{categoryId === item.id && <Check size={16} />}
                </button>
              ))}
            </div>
            <button className="primary" disabled={normalizePlayers(players).length < 3} onClick={startRound}>وزّع الأدوار <Shuffle size={20} /></button>
          </div>
        )}

        {screen === "reveal" && role && round && (
          <div className="reveal">
            <div className="progress"><span style={{ width: `${((revealIndex + 1) / round.roles.length) * 100}%` }} /></div>
            <p className="counter">اللاعب {revealIndex + 1} من {round.roles.length}</p>
            <h2>ناولوا الجوال إلى</h2>
            <div className="bigName">{role.player}</div>
            <p className="privacy">{revealed ? "لا تخلي أحد يشوف الشاشة" : "تأكد إن محد غيرك يشوف"}</p>
            <button className={revealed ? "secretCard shown" : "secretCard"} onClick={() => setRevealed(!revealed)}>
              {!revealed ? (
                <><Eye size={34} /><strong>اضغط لتكشف دورك</strong><small>وخبي الشاشة عن الباقين</small></>
              ) : role.isOutsider ? (
                <><EyeOff size={34} /><span className="outsiderTag">أنت</span><strong>برا السالفة!</strong><small>الفئة: {round.category.title}<br />تصرّف طبيعي وحاول تعرف الكلمة</small></>
              ) : (
                <><span className="wordLabel">الكلمة السرّية</span><strong>{role.word}</strong><small>الفئة: {round.category.title}</small></>
              )}
            </button>
            {revealed && <button className="primary" onClick={nextReveal}>{revealIndex === round.roles.length - 1 ? "ابدأوا الأسئلة" : "خبّيت دوري، التالي"} <ArrowLeft size={20} /></button>}
          </div>
        )}

        {screen === "play" && round && (
          <div className="panel play">
            <div className="roundBadge">{round.category.emoji} {round.category.title}</div>
            <h2>ابدأوا التحقيق</h2>
            <p className="lead">كل لاعب يسأل لاعباً آخر سؤالاً عن الكلمة. لا تكونوا واضحين زيادة… ولا غامضين زيادة.</p>
            <div className="rules">
              <div><span>١</span><p><b>اسألوا بالدور</b><br />سؤال واحد لكل لاعب</p></div>
              <div><span>٢</span><p><b>راقبوا الإجابات</b><br />مين كلامه مش راكب؟</p></div>
              <div><span>٣</span><p><b>صوّتوا سوا</b><br />اختاروا المشتبه به</p></div>
            </div>
            <h3>مين برا السالفة؟</h3>
            <div className="suspects">
              {round.roles.map(({ player }) => <button key={player} onClick={() => setSuspect(player)} className={suspect === player ? "selected" : ""}>{player}{suspect === player && <Check size={15} />}</button>)}
            </div>
            <button className="primary" disabled={!suspect} onClick={() => setScreen("result")}>اكشفوا الحقيقة <Eye size={20} /></button>
          </div>
        )}

        {screen === "result" && round && (
          <div className="result">
            <div className={suspect === round.outsider ? "resultIcon win" : "resultIcon lose"}>{suspect === round.outsider ? "🎉" : "😏"}</div>
            <p className="eyebrow">{suspect === round.outsider ? "كشفتوه!" : "ضحك عليكم!"}</p>
            <h2><em>{round.outsider}</em> كان برا السالفة</h2>
            <div className="answer"><span>الكلمة كانت</span><strong>{round.word}</strong><small>{round.category.emoji} {round.category.title}</small></div>
            <button className="primary" onClick={startRound}><RotateCcw size={19} /> جولة جديدة بنفس اللاعبين</button>
            <button className="textButton" onClick={() => setScreen("setup")}>تغيير اللاعبين أو الفئة</button>
          </div>
        )}
      </section>
      <footer>مصممة للّمة الحلوة · لا تجمع أي بيانات</footer>
    </main>
  );
}
