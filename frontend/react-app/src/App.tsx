import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { postAttempt, fetchLearningCurve, fetchSummary } from './api';
import type { LearningCurvePoint, StudentSummary } from './api';

// ─── Types ────────────────────────────────────────────────
type Screen =
  | 'landing'
  | 'signin'
  | 'mainmenu'
  | 'welcome'
  | 'avatarselect'
  | 'howitworks'
  | 'pretest'
  | 'lesson'
  | 'posttest'
  | 'progress'
  | 'sessioncomplete'
  | 'reward'
  | 'freequest'
  | 'leaderboard'
  | 'evalmetrics'
  | 'misconceptions'
  | 'spacedrepeat'
  | 'switchstudent';

type RobotMood = 'idle' | 'thinking' | 'celebrating' | 'pointing';

interface StudentProfile { id: string; name: string; avatarId: string; }

interface SpacedRepItem {
  concept: string; interval: number; ease: number;
  nextReview: Date; lastCorrect: boolean;
}

// ─── Shared pixel art SVG helpers ────────────────────────
const PixelCloud = ({ x = 0, y = 0, scale = 1, color = '#f0e8ff', delay = '0s' }) => (
  <g transform={`translate(${x},${y}) scale(${scale})`} style={{ animation: `cloudmove 18s ${delay} linear infinite` }}>
    <rect x="16" y="8"  width="48" height="8"  fill={color} />
    <rect x="8"  y="16" width="64" height="8"  fill={color} />
    <rect x="4"  y="24" width="72" height="8"  fill={color} />
    <rect x="0"  y="32" width="80" height="8"  fill={color} />
    <rect x="4"  y="40" width="72" height="8"  fill={color} />
    <rect x="16" y="48" width="48" height="8"  fill={color} />
  </g>
);

const PixelBuilding = ({ x = 0, color = '#5b3a8e', w = 40, h = 80 }: any) => (
  <g transform={`translate(${x},0)`}>
    <rect x={0} y={200 - h} width={w} height={h} fill={color} />
    <rect x={0} y={200 - h} width={w} height={4} fill="#000" />
    {[0, 1, 2].map(row =>
      [0, 1].map(col => (
        <rect
          key={`w-${row}-${col}`}
          x={6 + col * 14}
          y={200 - h + 10 + row * 20}
          width={8} height={8}
          fill={(row * 2 + col) % 3 !== 0 ? '#ffe94a' : '#1a0a2e'}
        />
      ))
    )}
  </g>
);

const MascotWizard = ({ mood = 'idle', size = 1, className = '' }: { mood?: string; size?: number; className?: string }) => {
  const moodColor = mood === 'celebrate' ? '#ffe94a' : mood === 'thinking' ? '#00ffee' : '#ff4fa3';
  return (
    <svg
      width={64 * size} height={80 * size}
      viewBox="0 0 64 80"
      className={className}
      style={{ imageRendering: 'pixelated' }}
    >
      <rect x="20" y="0"  width="24" height="4"  fill="#ff00cc" />
      <rect x="24" y="4"  width="16" height="4"  fill="#ff00cc" />
      <rect x="24" y="8"  width="16" height="4"  fill="#ff00cc" />
      <rect x="24" y="12" width="16" height="4"  fill="#ff00cc" />
      <rect x="16" y="16" width="32" height="4"  fill="#ff00cc" />
      <rect x="30" y="4"  width="4" height="4"   fill="#ffe94a" />
      <rect x="16" y="20" width="32" height="24" fill="#ffd9aa" />
      <rect x="22" y="26" width="6"  height="6"  fill="#1a0a2e" />
      <rect x="36" y="26" width="6"  height="6"  fill="#1a0a2e" />
      <rect x="24" y="27" width="2"  height="2"  fill="#fff" />
      <rect x="38" y="27" width="2"  height="2"  fill="#fff" />
      {mood === 'celebrate'
        ? <><rect x="24" y="36" width="16" height="4" fill="#ff3355" /><rect x="26" y="34" width="2" height="2" fill="#fff" /><rect x="36" y="34" width="2" height="2" fill="#fff" /></>
        : <rect x="26" y="36" width="12" height="3" fill="#c07040" />
      }
      <rect x="12" y="44" width="40" height="24" fill="#5b3a8e" />
      <rect x="12" y="44" width="40" height="4"  fill="#ff00cc" />
      <rect x="28" y="52" width="8"  height="12" fill="#ff00cc" />
      <rect x="0"  y="44" width="12" height="8"  fill="#5b3a8e" />
      <rect x="52" y="44" width="12" height="8"  fill="#5b3a8e" />
      <rect x="0"  y="52" width="10" height="8"  fill="#ffd9aa" />
      <rect x="54" y="52" width="10" height="8"  fill="#ffd9aa" />
      <rect x="56" y="40" width="4" height="20"  fill="#c8a050" />
      <rect x="54" y="36" width="8" height="8"   fill={moodColor} style={{ animation: 'startwink 1.5s ease-in-out infinite' }} />
      <rect x="16" y="68" width="12" height="12" fill="#3d1f6e" />
      <rect x="36" y="68" width="12" height="12" fill="#3d1f6e" />
      <rect x="14" y="76" width="14" height="4"  fill="#000" />
      <rect x="36" y="76" width="14" height="4"  fill="#000" />
    </svg>
  );
};

// ─── ROBOT MASCOT SVG ────────────────────────────────────
const RobotMascotSVG = ({ mood }: { mood: RobotMood }) => {
  const eyeColor = mood === 'celebrating' ? '#ffe94a' : mood === 'thinking' ? '#00ffee' : mood === 'pointing' ? '#ff4fa3' : '#00ffee';
  return (
    <svg width="56" height="72" viewBox="0 0 56 72" style={{ imageRendering: 'pixelated' }}>
      <rect x="26" y="0" width="4" height="8" fill="#aaa" />
      <rect x="22" y="0" width="12" height="4" fill="#888" />
      <rect x="24" y="-4" width="8" height="6" fill={eyeColor} style={{ animation: 'blink 2s step-end infinite' }} />
      <rect x="8"  y="8"  width="40" height="28" fill="#4a4a6a" />
      <rect x="8"  y="8"  width="40" height="4"  fill="#333" />
      <rect x="8"  y="32" width="40" height="4"  fill="#333" />
      <rect x="12" y="14" width="32" height="14" fill="#1a1a2e" />
      <rect x="14" y="16" width="12" height="10" fill={eyeColor} style={{ opacity: 0.9 }} />
      <rect x="30" y="16" width="12" height="10" fill={eyeColor} style={{ opacity: 0.9 }} />
      <rect x="15" y="17" width="4" height="4" fill="#fff" style={{ opacity: 0.6 }} />
      <rect x="31" y="17" width="4" height="4" fill="#fff" style={{ opacity: 0.6 }} />
      <rect x="16" y="28" width="24" height="6" fill="#333" />
      {mood === 'celebrating'
        ? [0,4,8,12,16,20].map(i => <rect key={i} x={16+i} y={30} width="3" height="3" fill={i%2===0 ? '#ffe94a' : '#ff00cc'} />)
        : [0,6,12,18].map(i => <rect key={i} x={18+i} y={30} width="3" height="3" fill="#555" />)
      }
      <rect x="10" y="36" width="36" height="24" fill="#3a3a5a" />
      <rect x="10" y="36" width="36" height="4"  fill="#555" />
      <rect x="16" y="42" width="24" height="12" fill="#2a2a4a" />
      <rect x="18" y="44" width="6" height="6" fill={eyeColor} style={{ opacity: 0.7 }} />
      <rect x="28" y="44" width="6" height="6" fill="#ff00cc" style={{ opacity: 0.7 }} />
      <rect x="36" y="44" width="4" height="8" fill="#888" />
      <rect x="0"  y="38" width="10" height="6" fill="#3a3a5a" />
      <rect x="46" y="38" width="10" height="6" fill="#3a3a5a" />
      <rect x="0"  y="44" width="8"  height="8" fill="#555" />
      <rect x="48" y="44" width="8"  height="8" fill="#555" />
      {mood === 'pointing' && <rect x="-4" y="44" width="8" height="4" fill="#ffe94a" />}
      <rect x="14" y="60" width="10" height="10" fill="#2a2a4a" />
      <rect x="32" y="60" width="10" height="10" fill="#2a2a4a" />
      <rect x="12" y="68" width="12" height="4" fill="#000" />
      <rect x="32" y="68" width="12" height="4" fill="#000" />
    </svg>
  );
};

// ─── ROBOT MASCOT (Global Persistent — Feature 10) ───────
interface RobotMascotProps {
  screen: Screen;
  wrongAnswerStreak?: number;
  spacedRepDueCount?: number;
  newBestCurve?: boolean;
}

const ANCHOR_POINTS = [
  { bottom: 24, right: 24, left: undefined },
  { bottom: 24, right: 280, left: undefined },
  { bottom: 200, right: 24, left: undefined },
  { bottom: 200, right: 280, left: undefined },
  { bottom: 80, right: 140, left: undefined },
];

const RobotMascot = ({ screen, wrongAnswerStreak = 0, spacedRepDueCount = 0, newBestCurve = false }: RobotMascotProps) => {
  const [mood, setMood] = useState<RobotMood>('idle');
  const [bubble, setBubble] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [pos, setPos] = useState({ bottom: 24, right: 24 });
  const [dragging, setDragging] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, rb: 0, rr: 0 });
  const lastDragTime = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Screen-based contextual tips
  const tips: Partial<Record<Screen, { mood: RobotMood; msg: string }>> = {
    landing:        { mood: 'pointing',    msg: '▶ Press START to begin your quest!' },
    signin:         { mood: 'idle',        msg: "What's your hero name? 🎮" },
    mainmenu:       { mood: 'pointing',    msg: 'Pick a mode from the menu!' },
    freequest:      { mood: 'pointing',    msg: 'Try asking me something!' },
    lesson:         { mood: 'idle',        msg: 'Read carefully and answer!' },
    reward:         { mood: 'celebrating', msg: 'New high score, nice! 🏆' },
    sessioncomplete:{ mood: 'celebrating', msg: 'Session done! Claim your reward!' },
    leaderboard:    { mood: 'idle',        msg: 'Top scholars of the realm! ⭐' },
    pretest:        { mood: 'thinking',    msg: "Let's see what you already know!" },
    posttest:       { mood: 'thinking',    msg: "Show me what you've learned!" },
    evalmetrics:    { mood: 'idle',        msg: 'Your stats are looking great! 📊' },
    misconceptions: { mood: 'pointing',    msg: 'Click a concept node to learn more!' },
    spacedrepeat:   { mood: 'pointing',    msg: "Don't forget your review items!" },
    progress:       { mood: 'idle',        msg: 'Track your learning journey! 📈' },
    switchstudent:  { mood: 'idle',        msg: 'Switch between player profiles!' },
  };

  useEffect(() => {
    const tip = tips[screen];
    if (tip) {
      setMood(tip.mood);
      setBubble(tip.msg);
      setShowBubble(true);
      const t = setTimeout(() => setShowBubble(false), 5000);
      return () => clearTimeout(t);
    }
  }, [screen]);

  // State-based override tips (Feature 10 — smarter tips)
  useEffect(() => {
    if (wrongAnswerStreak >= 2) {
      setMood('pointing');
      setBubble('Struggling? Try reading slowly! 💡 Use a hint!');
      setShowBubble(true);
      const t = setTimeout(() => setShowBubble(false), 6000);
      return () => clearTimeout(t);
    }
  }, [wrongAnswerStreak]);

  useEffect(() => {
    if (spacedRepDueCount > 0) {
      setMood('pointing');
      setBubble(`${spacedRepDueCount} review item${spacedRepDueCount > 1 ? 's' : ''} due today! ⏰`);
      setShowBubble(true);
      const t = setTimeout(() => setShowBubble(false), 5000);
      return () => clearTimeout(t);
    }
  }, [spacedRepDueCount]);

  useEffect(() => {
    if (newBestCurve) {
      setMood('celebrating');
      setBubble('New personal best on your learning curve! 🌟');
      setShowBubble(true);
      const t = setTimeout(() => setShowBubble(false), 5000);
      return () => clearTimeout(t);
    }
  }, [newBestCurve]);

  // Autonomous movement (Feature 10) — walk to random anchor every 15–25s
  useEffect(() => {
    const schedule = () => {
      const delay = 15000 + Math.random() * 10000;
      return setTimeout(() => {
        const timeSinceDrag = Date.now() - lastDragTime.current;
        if (timeSinceDrag > 5000 && !dragging) {
          const anchor = ANCHOR_POINTS[Math.floor(Math.random() * ANCHOR_POINTS.length)];
          setIsWalking(true);
          setPos({ bottom: anchor.bottom, right: anchor.right });
          setTimeout(() => setIsWalking(false), 1500);
        }
        const t = schedule();
        return t;
      }, delay);
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, [dragging]);

  // Dragging
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    lastDragTime.current = Date.now();
    dragStart.current = { mx: e.clientX, my: e.clientY, rb: pos.bottom, rr: pos.right }; // mx used in dragStart ref
    e.preventDefault();
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      lastDragTime.current = Date.now();
      setPos({
        bottom: Math.max(0, dragStart.current.rb - (e.clientY - dragStart.current.my)),
        right: Math.max(0, dragStart.current.rr - (e.clientX - dragStart.current.mx)),
      });
    };
    const onUp = () => { setDragging(false); lastDragTime.current = Date.now(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const bobAnim = mood === 'idle' ? 'animate-float' : mood === 'celebrating' ? 'animate-bounce2' : '';

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] select-none"
      style={{
        bottom: pos.bottom,
        right: pos.right,
        cursor: dragging ? 'grabbing' : 'grab',
        transition: isWalking ? 'bottom 1.5s ease-in-out, right 1.5s ease-in-out' : 'none',
      }}
      onMouseDown={onMouseDown}
      onClick={() => setShowBubble(v => !v)}
    >
      {/* Speech bubble */}
      {showBubble && bubble && (
        <div className="absolute bottom-full right-0 mb-2 w-52">
          <div className="bg-white border-3 border-black p-2 text-xs font-body text-gray-900 leading-relaxed relative" style={{ border: '3px solid #000', boxShadow: '3px 3px 0 #000' }}>
            {bubble}
            <div className="absolute -bottom-2 right-6 w-0 h-0"
              style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #000' }} />
            <div className="absolute -bottom-1 right-7 w-0 h-0"
              style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #fff' }} />
          </div>
        </div>
      )}

      {/* Thinking gear */}
      {mood === 'thinking' && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-2xl" style={{ animation: 'wiggle 0.4s linear infinite' }}>⚙️</div>
      )}

      {/* Celebrating sparkles */}
      {mood === 'celebrating' && (
        <>
          {['✨', '⭐', '💫'].map((s, i) => (
            <div key={i} className="absolute text-lg" style={{
              top: -20 - i * 10, left: i * 14 - 10,
              animation: `confetti ${0.8 + i * 0.3}s ease-out ${i * 0.1}s infinite`,
            }}>{s}</div>
          ))}
        </>
      )}

      {/* Robot body */}
      <div className={`${bobAnim} ${isWalking ? 'mascot-walking' : ''}`} style={{ filter: 'drop-shadow(3px 3px 0 #000)' }}>
        <RobotMascotSVG mood={mood} />
      </div>

      <p className="text-center font-pixel mt-1" style={{ fontSize: '6px', color: '#00ffee' }}>TAP ME</p>
    </div>
  );
};

// ─── Reusable Components ─────────────────────────────────
interface PixelButtonProps {
  children: React.ReactNode;
  color?: string;
  textColor?: string;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  disabled?: boolean;
}
const PixelButton = ({ children, color = '#ff00cc', textColor = '#fff', onClick, className = '', size = 'md', glow = false, disabled = false }: PixelButtonProps) => {
  const [pressed, setPressed] = useState(false);
  const sizes = { sm: 'text-xs px-4 py-2', md: 'text-sm px-6 py-3', lg: 'text-base px-8 py-4' };
  return (
    <button
      className={`pixel-btn font-pixel border-4 border-black ${sizes[size]} inline-block select-none ${className}`}
      disabled={disabled}
      style={{
        background: disabled ? '#444' : color,
        color: disabled ? '#888' : textColor,
        boxShadow: pressed ? '0 0 0 #000' : glow ? `5px 5px 0 #000, 0 0 18px ${color}88` : '5px 5px 0 #000',
        transform: pressed ? 'translate(5px,5px)' : 'translate(0,0)',
        transition: 'transform 0.08s, box-shadow 0.08s',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </button>
  );
};

// Typewriter
const TypeWriter = ({ text, speed = 40, onDone }: { text: string; speed?: number; onDone?: () => void }) => {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const iv = setInterval(() => {
      if (i < text.length) { setDisplayed(text.slice(0, ++i)); }
      else { clearInterval(iv); onDone?.(); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <span>{displayed}<span style={{ animation: 'blink 1s step-end infinite' }}>▌</span></span>;
};

// HUD
const HUD = ({ coins = 0, level = 1, xp = 60, goTo, playerName = '' }: { coins: number; level: number; xp: number; goTo: (s: Screen) => void; playerName?: string }) => (
  <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-px-dark border-b-4 border-black font-pixel" style={{ background: '#1a0a2e', borderBottom: '4px solid #000' }}>
    <div className="flex items-center gap-3">
      <span className="font-pixel text-xs" style={{ color: '#ffe94a' }}>⭐ LVL {level}</span>
      <div className="hp-bar-track" style={{ width: 128, height: 16 }}>
        <div className="hp-bar-fill" style={{ '--fill': `${xp}%` } as React.CSSProperties} />
      </div>
      <span className="font-pixel text-xs" style={{ color: '#4aff91' }}>XP {xp}%</span>
    </div>
    <div className="flex items-center gap-3">
      {playerName && <span className="font-pixel text-xs" style={{ color: '#ff4fa3' }}>👤 {playerName.slice(0, 8)}</span>}
      <button onClick={() => goTo('leaderboard')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>🏆</button>
      <button onClick={() => goTo('freequest')}   className="font-pixel text-xs" style={{ color: '#00ffee', background: 'none', border: 'none', cursor: 'pointer' }}>❓</button>
      <div className="flex items-center gap-1" style={{ color: '#ffe94a' }}>
        <span style={{ animation: 'bounce2 0.8s ease-in-out infinite' }}>🪙</span>
        <span className="font-pixel text-xs">{coins}</span>
      </div>
    </div>
  </div>
);

// Dialogue box
const DialogueBox = ({ speaker = '', text = '', onNext }: { speaker?: string; text: string; onNext?: () => void }) => (
  <div className="relative ml-4">
    <div className="bg-white border-4 border-black p-4" style={{ boxShadow: '6px 6px 0 #000' }}>
      {speaker && (
        <p className="font-pixel text-xs mb-2 pb-1" style={{ color: '#5b3a8e', borderBottom: '2px solid #eee' }}>{speaker}</p>
      )}
      <p className="font-body text-sm text-gray-900 leading-relaxed">
        <TypeWriter text={text} />
      </p>
      {onNext && (
        <button onClick={onNext} className="absolute bottom-2 right-3 font-pixel text-xs" style={{ color: '#5b3a8e', animation: 'bounce2 0.8s ease-in-out infinite', background: 'none', border: 'none', cursor: 'pointer' }}>▼</button>
      )}
    </div>
    <div className="absolute top-5" style={{ left: -12, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '12px solid #000' }} />
    <div className="absolute top-6" style={{ left: -8, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: '10px solid #fff' }} />
  </div>
);

// ─── FEATURE 2: QuizTimer component ──────────────────────
interface QuizTimerProps {
  timeLimitSec: number;
  paused: boolean;
  onTimeout: () => void;
}
const QuizTimer = ({ timeLimitSec, paused, onTimeout }: QuizTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);
  const timedOut = useRef(false);

  useEffect(() => {
    setTimeLeft(timeLimitSec);
    timedOut.current = false;
  }, [timeLimitSec]);

  useEffect(() => {
    if (paused || timedOut.current) return;
    if (timeLeft <= 0) {
      if (!timedOut.current) { timedOut.current = true; onTimeout(); }
      return;
    }
    const iv = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(iv);
  }, [timeLeft, paused, onTimeout]);

  const pct = (timeLeft / timeLimitSec) * 100;
  const barColor = pct > 50 ? '#4aff91' : pct > 25 ? '#ffe94a' : '#ff3355';
  const textColor = pct > 50 ? '#4aff91' : pct > 25 ? '#ffe94a' : '#ff3355';

  return (
    <div className="w-full flex items-center gap-3 mb-3">
      <span className="font-pixel text-xs flex-shrink-0" style={{ color: textColor, minWidth: 32 }}>
        {timeLeft}s
      </span>
      <div className="hp-bar-track flex-1" style={{ height: 14 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor,
          transition: 'width 1s linear, background 0.3s ease',
          boxShadow: pct <= 25 ? `0 0 8px ${barColor}` : 'none',
        }} />
      </div>
      {pct <= 25 && (
        <span className="font-pixel text-xs flex-shrink-0" style={{ color: '#ff3355', animation: 'blink 0.5s step-end infinite' }}>⚠</span>
      )}
    </div>
  );
};

// ─── SCREEN 1: Landing ───────────────────────────────────
const LandingScreen = ({ next }: { next: () => void }) => (
  <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #3d1f6e, #5b3a8e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
    {Array.from({ length: 30 }).map((_, i) => (
      <div key={i} className="absolute rounded-full" style={{
        width: i % 3 === 0 ? 4 : 2, height: i % 3 === 0 ? 4 : 2,
        background: i % 4 === 0 ? '#00ffee' : i % 4 === 1 ? '#ff4fa3' : '#fff',
        top: `${(i * 37) % 70}%`, left: `${(i * 53) % 100}%`,
        animation: `startwink 1.5s ${(i * 0.2) % 2}s ease-in-out infinite`,
      }} />
    ))}

    <svg className="absolute" style={{ top: 32, left: 0, width: '100%', overflow: 'visible' }} height="80" viewBox="0 0 800 80">
      <g style={{ animation: 'cloudmove 22s linear infinite' }}>
        <PixelCloud x={-80} y={5}  scale={0.6} color="#f0e8ff" delay="0s" />
        <PixelCloud x={200} y={15} scale={0.5} color="#d0b8ff" delay="-6s" />
        <PixelCloud x={500} y={2}  scale={0.7} color="#f0e8ff" delay="-12s" />
      </g>
    </svg>

    <svg className="absolute" style={{ bottom: 80, left: 0, width: '100%' }} height="200" viewBox="0 0 800 200" preserveAspectRatio="none">
      <PixelBuilding x={0}   color="#5b3a8e" w={50} h={100} />
      <PixelBuilding x={60}  color="#3d1f6e" w={40} h={140} />
      <PixelBuilding x={110} color="#6a2e9e" w={60} h={80}  />
      <PixelBuilding x={180} color="#2a1050" w={35} h={160} />
      <PixelBuilding x={220} color="#5b3a8e" w={55} h={110} />
      <PixelBuilding x={285} color="#3d1f6e" w={45} h={90}  />
      <PixelBuilding x={500} color="#5b3a8e" w={50} h={120} />
      <PixelBuilding x={560} color="#3d1f6e" w={60} h={150} />
      <PixelBuilding x={630} color="#6a2e9e" w={40} h={85}  />
      <PixelBuilding x={680} color="#2a1050" w={55} h={130} />
      <PixelBuilding x={745} color="#5b3a8e" w={55} h={100} />
    </svg>

    <div className="absolute bottom-0 left-0 right-0 h-20 ground" />

    <div className="absolute bottom-20 left-0" style={{ animation: 'busmove 10s linear infinite' }}>
      <svg width="140" height="60" viewBox="0 0 140 60" style={{ imageRendering: 'pixelated' }}>
        <rect x="0" y="10" width="120" height="40" fill="#ff8c1a" />
        <rect x="0" y="10" width="120" height="8" fill="#ff3355" />
        <rect x="120" y="18" width="20" height="32" fill="#ff8c1a" />
        <rect x="10" y="18" width="20" height="20" fill="#00ffee" opacity="0.8" />
        <rect x="40" y="18" width="20" height="20" fill="#00ffee" opacity="0.8" />
        <rect x="70" y="18" width="20" height="20" fill="#00ffee" opacity="0.8" />
        <circle cx="25" cy="52" r="8" fill="#1a0a2e" />
        <circle cx="95" cy="52" r="8" fill="#1a0a2e" />
        <circle cx="25" cy="52" r="4" fill="#666" />
        <circle cx="95" cy="52" r="4" fill="#666" />
        <rect x="128" y="25" width="10" height="6" fill="#ffe94a" />
      </svg>
    </div>

    <div className="relative z-10 text-center" style={{ animation: 'float 3s ease-in-out infinite', marginBottom: 8 }}>
      <div className="font-pixel text-xs" style={{ color: '#ffe94a', letterSpacing: '0.15em', marginBottom: 8 }}>▶ PRESS START ◀</div>
      <h1 className="font-pixel" style={{ fontSize: 'clamp(1.2rem,5vw,2.8rem)', color: '#ffe94a', textShadow: '4px 4px 0 #000, -1px -1px 0 #ff00cc, 1px 1px 0 #ff00cc', letterSpacing: '0.05em', lineHeight: 1.6 }}>
        LET'S LEARN!
      </h1>
      <p className="font-pixel text-xs mt-3" style={{ color: '#00ffee', textShadow: '2px 2px 0 #000' }}>— PIXEL TUTOR AI —</p>
    </div>

    <div className="relative z-10" style={{ animation: 'float 3s 0.5s ease-in-out infinite' }}>
      <MascotWizard mood="idle" size={1.5} />
    </div>

    <div className="relative z-10" style={{ marginTop: 32 }}>
      <PixelButton onClick={next} color="#ff00cc" size="lg" glow>▶ START GAME</PixelButton>
    </div>
    <p className="relative z-10 font-pixel text-xs mt-4" style={{ color: '#00ffee', animation: 'blink 1s step-end infinite' }}>© 2025 PIXEL TUTOR</p>
  </div>
);

// ─── SCREEN 2: Sign In ───────────────────────────────────
const SignInScreen = ({ next, back, onSetName }: { next: () => void; back: () => void; onSetName: (name: string) => void }) => {
  const [name, setName] = useState('');
  const handleConfirm = () => { if (name.trim()) { onSetName(name.trim()); next(); } };
  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #5b3a8e)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md px-4">
        <h1 className="font-pixel text-center" style={{ fontSize: 'clamp(0.9rem,3vw,1.4rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000', lineHeight: 1.8 }}>
          ARE YOU<br/>READY?
        </h1>
        <div className="w-full bg-white border-4 border-black p-6" style={{ boxShadow: '6px 6px 0 #000' }}>
          <p className="font-pixel text-xs text-gray-800 mb-6" style={{ lineHeight: 2 }}>PLAYER 1 — ENTER YOUR NAME:</p>
          <input
            className="w-full border-4 border-black bg-white text-gray-900 font-body px-3 py-2 mb-6 text-base outline-none"
            style={{ borderColor: '#000' }}
            placeholder="HERO NAME..."
            maxLength={20}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            onFocus={e => (e.target.style.borderColor = '#ff00cc')}
            onBlur={e => (e.target.style.borderColor = '#000')}
          />
          <div className="flex gap-4 justify-center">
            <PixelButton onClick={handleConfirm} color="#4aff91" textColor="#000" size="md">✔ YES!</PixelButton>
            <PixelButton onClick={back} color="#ff3355" size="md">✘ NO</PixelButton>
          </div>
        </div>
        <div className="flex gap-2 items-center font-pixel text-xs" style={{ color: '#ff3355' }}>
          <span>LIVES:</span>
          {['❤️','❤️','❤️'].map((h, i) => <span key={i} className="text-lg">{h}</span>)}
        </div>
      </div>
    </div>
  );
};

// ─── SCREEN 3: Main Menu ─────────────────────────────────
const MainMenuScreen = ({ goTo }: { goTo: (s: Screen) => void }) => (
  <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #5b3a8e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
    <svg className="absolute bottom-16 left-1/2" style={{ transform: 'translateX(-50%)' }} width="200" height="160" viewBox="0 0 200 160" preserveAspectRatio="xMidYMax meet">
      <rect x="40"  y="60"  width="120" height="100" fill="#3d1f6e" />
      <rect x="10"  y="40"  width="50"  height="120" fill="#2a1050" />
      <rect x="140" y="40"  width="50"  height="120" fill="#2a1050" />
      {[0,1,2].map(i => <rect key={i} x={10+i*16} y={30} width="10" height="14" fill="#2a1050" />)}
      {[0,1,2].map(i => <rect key={i} x={140+i*16} y={30} width="10" height="14" fill="#2a1050" />)}
      <rect x="24"  y="60"  width="18" height="18" fill="#ffe94a" />
      <rect x="158" y="60"  width="18" height="18" fill="#ffe94a" />
      <rect x="88"  y="80"  width="24" height="30" fill="#ffe94a" />
      <rect x="80"  y="120" width="40" height="40" fill="#1a0a2e" />
      <rect x="85"  y="115" width="30" height="8"  fill="#000" />
      <rect x="97"  y="10"  width="4"  height="50" fill="#c8a050" />
      <rect x="101" y="12"  width="24" height="16" fill="#ff00cc" />
    </svg>
    <div className="absolute bottom-0 left-0 right-0 h-16 ground" />

    <div className="relative z-10 flex flex-col items-center gap-3 mb-8">
      <h1 className="font-pixel text-center mb-4" style={{ fontSize: 'clamp(1rem,3.5vw,1.6rem)', color: '#ffe94a', textShadow: '4px 4px 0 #000' }}>
        ⚔ MAIN MENU ⚔
      </h1>
      <PixelButton onClick={() => goTo('signin')}       color="#ff00cc"             size="lg" className="w-64">👤 SIGN IN</PixelButton>
      <PixelButton onClick={() => goTo('pretest')}      color="#00ffee" textColor="#000" size="lg" className="w-64">📚 START LESSON</PixelButton>
      <PixelButton onClick={() => goTo('freequest')}    color="#ffe94a" textColor="#000" size="lg" className="w-64" glow>✨ FREE QUEST</PixelButton>
      <PixelButton onClick={() => goTo('leaderboard')}  color="#ff4fa3"             size="lg" className="w-64">🏆 LEADERBOARD</PixelButton>
      <PixelButton onClick={() => goTo('progress')}     color="#4aff91" textColor="#000" size="lg" className="w-64">📊 PROGRESS</PixelButton>
      <PixelButton onClick={() => goTo('howitworks')}   color="#5b3a8e"             size="lg" className="w-64">❓ HOW IT WORKS</PixelButton>
      <PixelButton onClick={() => goTo('evalmetrics')}  color="#ff8c1a" textColor="#000" size="lg" className="w-64">📈 EVAL METRICS</PixelButton>
      <PixelButton onClick={() => goTo('misconceptions')} color="#ff3355"           size="lg" className="w-64">🧠 MISCONCEPTIONS</PixelButton>
      <PixelButton onClick={() => goTo('spacedrepeat')} color="#00ffee" textColor="#000" size="lg" className="w-64">📅 SPACED REVIEW</PixelButton>
      <PixelButton onClick={() => goTo('switchstudent')} color="#ff4fa3"            size="lg" className="w-64">👥 SWITCH STUDENT</PixelButton>
    </div>
  </div>
);

// ─── SCREEN 4: Welcome ───────────────────────────────────
const WelcomeScreen = ({ next }: { next: () => void }) => (
  <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #3d1f6e, #5b3a8e)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, position: 'relative', overflow: 'hidden' }}>
    <div className="relative mb-6" style={{ animation: 'float 3s ease-in-out infinite' }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'radial-gradient(circle, #ffe94a, #ff8c1a)', boxShadow: '0 0 40px #ffe94a, 0 0 80px #ff8c1a44, 4px 4px 0 #000', border: '4px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>☀️</div>
    </div>

    <svg className="absolute" style={{ bottom: 112, left: 0, width: '100%' }} height="100" viewBox="0 0 800 100" preserveAspectRatio="none">
      {[0,60,130,180,240,300,360,420,500,560,620,680,740].map((x, i) => (
        <rect key={x} x={x} y={100-(40+i%3*30)} width={50} height={40+i%3*30} fill="#1a0a2e" opacity="0.8" />
      ))}
    </svg>
    <div className="absolute bottom-0 left-0 right-0 h-28 ground" />

    <h1 className="font-pixel text-center mb-6" style={{ fontSize: 'clamp(1.2rem,4vw,2rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>
      ✨ HELLO, HERO! ✨
    </h1>

    <div className="flex items-end gap-6 relative z-10 max-w-xl w-full px-4">
      <div style={{ animation: 'walk 0.8s ease-out forwards' }}>
        <MascotWizard mood="idle" size={1.3} />
      </div>
      <div className="flex-1">
        <DialogueBox
          speaker="PIXEL — AI TUTOR"
          text="Welcome, brave learner! I am Pixel, your magical AI tutor. Together we shall conquer every subject and level up your brain! Are you ready to begin your quest?"
          onNext={next}
        />
      </div>
    </div>

    <div className="relative z-10 mt-8">
      <PixelButton onClick={next} color="#ff00cc" size="lg">LET'S GO! ▶</PixelButton>
    </div>
  </div>
);

// ─── SCREEN 5: Avatar Selection ──────────────────────────
const avatars = [
  { id: 'wizard',   emoji: '🧙', name: 'WIZARD',   color: '#ff00cc', desc: 'Magic & Science' },
  { id: 'knight',   emoji: '⚔️', name: 'KNIGHT',   color: '#ff8c1a', desc: 'History & Logic' },
  { id: 'ranger',   emoji: '🏹', name: 'RANGER',   color: '#4aff91', desc: 'Nature & Bio'    },
  { id: 'scholar',  emoji: '📚', name: 'SCHOLAR',  color: '#00ffee', desc: 'Literature & Art' },
  { id: 'inventor', emoji: '⚙️', name: 'INVENTOR', color: '#ffe94a', desc: 'Tech & Math'     },
];
const AvatarScreen = ({ next, onSelect }: { next: () => void; onSelect: (id: string) => void }) => {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #3d1f6e)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, overflow: 'hidden' }}>
      <h1 className="font-pixel text-center mb-2" style={{ fontSize: 'clamp(0.9rem,3vw,1.4rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>
        ⚔ CHOOSE YOUR AVATAR ⚔
      </h1>
      <p className="font-pixel text-xs mb-8 text-center" style={{ color: '#00ffee', textShadow: '1px 1px 0 #000' }}>SELECT YOUR STUDY COMPANION</p>

      <div className="flex flex-wrap justify-center gap-4 max-w-2xl px-4 mb-8">
        {avatars.map(av => (
          <button key={av.id} onClick={() => setSelected(av.id)}
            className="pixel-btn flex flex-col items-center gap-2 p-4 border-4 border-black w-36"
            style={{
              background: selected === av.id ? av.color : '#3d1f6e',
              boxShadow: selected === av.id ? '0 0 0 #000' : '5px 5px 0 #000',
              transform: selected === av.id ? 'translate(5px,5px) scale(1.05)' : 'translate(0,0)',
            }}>
            <span className="text-5xl" style={{ animation: 'float 3s ease-in-out infinite' }}>{av.emoji}</span>
            <span className="font-pixel text-xs text-white">{av.name}</span>
            <span className="font-body text-xs text-white" style={{ opacity: 0.8 }}>{av.desc}</span>
            {selected === av.id && <span className="font-pixel text-xs" style={{ color: '#1a0a2e', animation: 'blink 1s step-end infinite' }}>✓ CHOSEN</span>}
          </button>
        ))}
      </div>
      <PixelButton onClick={() => { if (selected) { onSelect(selected); next(); } }} color={selected ? '#4aff91' : '#555'} textColor="#000" size="lg">
        {selected ? '▶ CONFIRM!' : 'SELECT ONE...'}
      </PixelButton>
    </div>
  );
};

// ─── SCREEN 6: How It Works ──────────────────────────────
const rules = [
  { icon: '🎯', color: '#ff00cc', title: 'QUEST',    text: 'Answer questions to complete lesson quests and earn XP!' },
  { icon: '🪙', color: '#ffe94a', title: 'COINS',    text: 'Correct answers = coins. Use them to unlock power-ups!'  },
  { icon: '💡', color: '#00ffee', title: 'HINTS',    text: 'Stuck? Use a hint coin to get a clue from Pixel!'        },
  { icon: '❤️', color: '#ff3355', title: 'LIVES',    text: 'You have 3 lives per session. Wrong answers cost one!'   },
  { icon: '🏆', color: '#4aff91', title: 'REWARDS',  text: 'Complete sessions to unlock trophies and level badges!'  },
];
const HowItWorksScreen = ({ next }: { next: () => void }) => (
  <div className="game-screen scanlines" style={{ background: '#2a1050', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 96, overflowY: 'auto' }}>
    <h1 className="font-pixel text-center mb-8" style={{ fontSize: 'clamp(1rem,3vw,1.5rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>
      ❓ HOW IT WORKS ❓
    </h1>
    <div className="flex flex-col gap-4 max-w-lg w-full px-4">
      {rules.map((r, i) => (
        <div key={i} className="flex items-center gap-4 border-4 border-black p-4"
          style={{ background: r.color + '22', animation: 'walk 0.8s ease-out forwards', animationDelay: `${i * 0.1}s` }}>
          <div className="w-16 h-16 flex items-center justify-center border-4 border-black text-4xl flex-shrink-0"
            style={{ background: r.color, animation: 'float 3s ease-in-out infinite', animationDelay: `${i * 0.3}s` }}>
            {r.icon}
          </div>
          <div>
            <p className="font-pixel text-xs mb-1" style={{ color: r.color, textShadow: '1px 1px 0 #000' }}>{r.title}</p>
            <p className="font-body text-sm" style={{ color: '#f0e8ff' }}>{r.text}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-8">
      <PixelButton onClick={next} color="#ff00cc" size="lg">GOT IT! ▶</PixelButton>
    </div>
  </div>
);

// ─── Quiz Questions Data ──────────────────────────────────
const pretestQuestions = [
  { id: 'pre-q1', text: 'What is Newton\'s First Law about?', options: ['Inertia', 'Acceleration', 'Gravity', 'Friction'], correct: 'Inertia', concept: 'newton-laws' },
  { id: 'pre-q2', text: 'F = ma stands for?', options: ['Force = Mass × Acceleration', 'Frequency × Motion', 'Friction × Area', 'Force ÷ Mass'], correct: 'Force = Mass × Acceleration', concept: 'newton-laws' },
  { id: 'pre-q3', text: 'Which is a unit of force?', options: ['Newton', 'Kilogram', 'Meter', 'Second'], correct: 'Newton', concept: 'newton-laws' },
  { id: 'pre-q4', text: 'Newton\'s Third Law says:', options: ['Action = Reaction', 'Speed = Distance/Time', 'Energy is conserved', 'Mass × Gravity = Weight'], correct: 'Action = Reaction', concept: 'newton-laws' },
  { id: 'pre-q5', text: 'What force keeps planets orbiting the sun?', options: ['Gravity', 'Magnetism', 'Friction', 'Tension'], correct: 'Gravity', concept: 'newton-laws' },
];
const lessonQuestions = [
  { id: 'les-q1', text: 'Which formula is Newton\'s 2nd Law?', options: ['F = ma', 'E = mc²', 'P = mv', 'a = v/t'], correct: 'F = ma', concept: 'newton-laws' },
];
const posttestQuestions = [
  { id: 'post-q1', text: 'If mass doubles and force stays same, acceleration:', options: ['Halves', 'Doubles', 'Stays same', 'Quadruples'], correct: 'Halves', concept: 'newton-laws' },
  { id: 'post-q2', text: 'A 10N force on 2kg mass gives acceleration of:', options: ['5 m/s²', '20 m/s²', '2 m/s²', '0.2 m/s²'], correct: '5 m/s²', concept: 'newton-laws' },
  { id: 'post-q3', text: 'Newton\'s First Law is also called the law of:', options: ['Inertia', 'Motion', 'Energy', 'Gravity'], correct: 'Inertia', concept: 'newton-laws' },
  { id: 'post-q4', text: 'Which of these is Newton\'s Third Law?', options: ['Action = Reaction', 'F = ma', 'Gravity pulls objects', 'Energy is conserved'], correct: 'Action = Reaction', concept: 'newton-laws' },
  { id: 'post-q5', text: 'Unit of mass in SI system is?', options: ['Kilogram', 'Newton', 'Pound', 'Gram'], correct: 'Kilogram', concept: 'newton-laws' },
];

// ─── FEATURE 3: Shared Quiz Battery Component ─────────────
interface QuizBatteryProps {
  title: string;
  questions: typeof pretestQuestions;
  studentId: string;
  onComplete: (score: number, total: number) => void;
  timeLimitSec?: number;
  onUpdateRisk?: (tabSwitches: number, fastAnswers: number) => void;
}
const QuizBattery = ({ title, questions, studentId, onComplete, timeLimitSec = 30, onUpdateRisk }: QuizBatteryProps) => {
  const [qIdx, setQIdx] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [done, setDone] = useState(false);
  const questionStartTime = useRef<number>(performance.now());
  const tabSwitches = useRef(0);
  const fastAnswers = useRef(0);

  const q = questions[qIdx];

  // Reset timer when question changes
  useEffect(() => {
    setAnswered(null);
    setTimedOut(false);
    questionStartTime.current = performance.now();
  }, [qIdx]);

  // Feature 7: tab-switch tracking
  useEffect(() => {
    const onViz = () => {
      if (document.hidden && !answered) {
        tabSwitches.current += 1;
        onUpdateRisk?.(tabSwitches.current, fastAnswers.current);
      }
    };
    document.addEventListener('visibilitychange', onViz);
    return () => document.removeEventListener('visibilitychange', onViz);
  }, [answered, onUpdateRisk]);

  const handleAnswer = (opt: string) => {
    if (answered || timedOut) return;
    const timeTaken = Math.round(performance.now() - questionStartTime.current);
    const isCorrect = opt === q.correct;

    // Feature 7: fast answer detection (<1500ms)
    if (timeTaken < 1500) { fastAnswers.current += 1; onUpdateRisk?.(tabSwitches.current, fastAnswers.current); }

    setAnswered(opt);
    if (isCorrect) setScore(s => s + 1);

    // Feature 1: post attempt to backend
    postAttempt({ student_id: studentId || 'anonymous', concept: q.concept, question_id: q.id, correct: isCorrect, time_taken_ms: timeTaken, hint_used: false });
  };

  const handleTimeout = () => {
    setTimedOut(true);
    postAttempt({ student_id: studentId || 'anonymous', concept: q.concept, question_id: q.id, correct: false, time_taken_ms: timeLimitSec * 1000, hint_used: false });
  };

  const nextQuestion = () => {
    if (qIdx + 1 >= questions.length) { setDone(true); onComplete(score + (answered === q.correct ? 1 : 0), questions.length); }
    else setQIdx(i => i + 1);
  };

  if (done) return null;

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #3d1f6e)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
      <div className="w-full max-w-2xl px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-pixel text-xs" style={{ color: '#ffe94a', textShadow: '2px 2px 0 #000' }}>{title}</h1>
          <span className="font-pixel text-xs" style={{ color: '#00ffee' }}>Q {qIdx + 1}/{questions.length}</span>
        </div>

        {/* Progress bar */}
        <div className="hp-bar-track w-full mb-4" style={{ height: 12 }}>
          <div className="hp-bar-fill" style={{ '--fill': `${((qIdx) / questions.length) * 100}%` } as React.CSSProperties} />
        </div>

        {/* Timer (Feature 2) */}
        <QuizTimer
          timeLimitSec={timeLimitSec}
          paused={!!(answered || timedOut)}
          onTimeout={handleTimeout}
        />

        {/* Mascot */}
        <div className="flex items-end gap-4 mb-6">
          <div className="flex-shrink-0">
            <MascotWizard mood={timedOut ? 'thinking' : answered ? (answered === q.correct ? 'celebrate' : 'thinking') : 'idle'} size={1.1} />
          </div>
          <div className="flex-1">
            <DialogueBox speaker="PIXEL — AI TUTOR" text={q.text} />
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {q.options.map(opt => {
            let color = '#5b3a8e';
            if (answered || timedOut) {
              if (opt === q.correct) color = '#4aff91';
              else if (opt === answered) color = '#ff3355';
            }
            return (
              <PixelButton
                key={opt}
                onClick={() => handleAnswer(opt)}
                color={color}
                size="md"
                className="w-full"
                disabled={!!(answered || timedOut)}
              >
                {opt}
              </PixelButton>
            );
          })}
        </div>

        {/* Feedback */}
        {(answered || timedOut) && (
          <div className="flex items-center gap-3 mb-4 slide-up">
            <MascotWizard mood={answered === q.correct ? 'celebrate' : 'thinking'} size={0.7} />
            <div className="flex-1 border-4 border-black bg-white p-3" style={{ boxShadow: '4px 4px 0 #000' }}>
              <p className="font-body text-sm text-gray-900">
                {timedOut
                  ? `⏰ Time's up! The answer was: ${q.correct}`
                  : answered === q.correct
                    ? `🎉 Correct! +1 point!`
                    : `❌ Not quite! Answer: ${q.correct}`
                }
              </p>
            </div>
          </div>
        )}

        {(answered || timedOut) && (
          <div className="flex justify-center">
            <PixelButton onClick={nextQuestion} color="#ff00cc" size="lg">
              {qIdx + 1 >= questions.length ? 'FINISH ▶' : 'NEXT ▶'}
            </PixelButton>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── SCREEN 7: Pretest ───────────────────────────────────
const PretestScreen = ({
  studentId, onComplete, onUpdateRisk
}: {
  studentId: string;
  onComplete: (score: number, total: number) => void;
  onUpdateRisk?: (tabSwitches: number, fastAnswers: number) => void;
}) => (
  <QuizBattery
    title="📋 PRE-TEST"
    questions={pretestQuestions}
    studentId={studentId}
    onComplete={onComplete}
    timeLimitSec={30}
    onUpdateRisk={onUpdateRisk}
  />
);

// ─── SCREEN 8: Lesson ────────────────────────────────────
const lessonLines = [
  "Welcome to today's lesson! Today we're covering the Laws of Motion. Ready?",
  "Newton's First Law: An object at rest stays at rest unless acted upon by a force.",
  "Newton's Second Law: Force = Mass × Acceleration. F = ma!",
  "Newton's Third Law: Every action has an equal and opposite reaction!",
  "Now let's test your knowledge with a quick question...",
];

const LessonScreen = ({
  next, studentId, onWrongStreak, onUpdateRisk
}: {
  next: () => void;
  studentId: string;
  onWrongStreak: (streak: number) => void;
  onUpdateRisk?: (tabSwitches: number, fastAnswers: number) => void;
}) => {
  const [lineIdx, setLineIdx] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const questionStartTime = useRef<number>(0);
  const wrongStreak = useRef(0);
  const tabSwitches = useRef(0);
  const fastAnswers = useRef(0);

  const q = lessonQuestions[0];
  const quizVisible = lineIdx >= lessonLines.length - 1;

  useEffect(() => {
    if (quizVisible && !answered) {
      questionStartTime.current = performance.now();
    }
  }, [quizVisible, answered]);

  // Feature 7: tab-switch tracking
  useEffect(() => {
    const onViz = () => {
      if (document.hidden && quizVisible && !answered) {
        tabSwitches.current += 1;
        onUpdateRisk?.(tabSwitches.current, fastAnswers.current);
      }
    };
    document.addEventListener('visibilitychange', onViz);
    return () => document.removeEventListener('visibilitychange', onViz);
  }, [quizVisible, answered, onUpdateRisk]);

  const handleAnswer = (opt: string) => {
    if (answered || timedOut) return;
    const timeTaken = Math.round(performance.now() - questionStartTime.current);
    const isCorrect = opt === q.correct;

    // Feature 7: fast answer
    if (timeTaken < 1500) { fastAnswers.current += 1; onUpdateRisk?.(tabSwitches.current, fastAnswers.current); }

    setAnswered(opt);
    if (!isCorrect) { wrongStreak.current += 1; onWrongStreak(wrongStreak.current); }
    else { wrongStreak.current = 0; onWrongStreak(0); }

    // Feature 1: persist attempt
    postAttempt({ student_id: studentId || 'anonymous', concept: q.concept, question_id: q.id, correct: isCorrect, time_taken_ms: timeTaken, hint_used: false });
  };

  const handleTimeout = () => {
    setTimedOut(true);
    postAttempt({ student_id: studentId || 'anonymous', concept: q.concept, question_id: q.id, correct: false, time_taken_ms: 30000, hint_used: false });
  };

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #3d1f6e)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="absolute top-0 left-0 right-0 h-20" style={{
        background: 'repeating-linear-gradient(0deg,transparent 0,transparent 15px,rgba(0,0,0,0.15) 15px,rgba(0,0,0,0.15) 16px), repeating-linear-gradient(90deg,transparent 0,transparent 31px,rgba(0,0,0,0.15) 31px,rgba(0,0,0,0.15) 32px)',
        backgroundColor: '#5b3a8e',
      }} />

      <div className="flex-1 flex flex-col items-center justify-center pt-20 pb-6 px-4">
        <div className="w-full max-w-md mb-4">
          <div className="flex justify-between font-pixel text-xs mb-1" style={{ color: '#00ffee' }}>
            <span>LESSON 1/5</span><span>XP: 120</span>
          </div>
          <div className="hp-bar-track w-full">
            <div className="hp-bar-fill" style={{ '--fill': '40%' } as React.CSSProperties} />
          </div>
        </div>

        <div className="flex items-end gap-4 w-full max-w-2xl mb-6">
          <div className="flex-shrink-0">
            <MascotWizard mood={lineIdx === lessonLines.length - 1 ? 'thinking' : 'idle'} size={1.2} />
          </div>
          <div className="flex-1">
            <DialogueBox
              speaker="PIXEL — AI TUTOR"
              text={lessonLines[Math.min(lineIdx, lessonLines.length - 1)]}
              onNext={lineIdx < lessonLines.length - 1 ? () => setLineIdx(i => i + 1) : undefined}
            />
          </div>
        </div>

        {quizVisible && (
          <div className="w-full max-w-2xl">
            {/* Timer (Feature 2) */}
            <QuizTimer
              timeLimitSec={30}
              paused={!!(answered || timedOut)}
              onTimeout={handleTimeout}
            />

            <div className="border-4 border-black p-4 mb-4" style={{ background: '#1a0a2e' }}>
              <p className="font-pixel text-xs mb-4" style={{ color: '#ffe94a', textShadow: '2px 2px 0 #000' }}>
                ❓ Which formula represents Newton's 2nd Law?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {q.options.map(opt => {
                  let color = '#5b3a8e';
                  if (answered || timedOut) {
                    if (opt === q.correct) color = '#4aff91';
                    else if (opt === answered) color = '#ff3355';
                  }
                  return (
                    <PixelButton
                      key={opt}
                      onClick={() => handleAnswer(opt)}
                      color={color}
                      size="md"
                      className="w-full"
                      disabled={!!(answered || timedOut)}
                    >
                      {opt}
                    </PixelButton>
                  );
                })}
              </div>
            </div>
            {(answered || timedOut) && (
              <div className="flex items-center gap-4 mb-4 slide-up">
                <MascotWizard mood={answered === q.correct ? 'celebrate' : 'thinking'} size={0.8} />
                <div className="flex-1 border-4 border-black bg-white p-3">
                  <p className="font-body text-sm text-gray-900">
                    {timedOut
                      ? `⏰ Time's up! The answer is F = ma.`
                      : answered === q.correct
                        ? '🎉 Correct! F = ma is Newton\'s Second Law. +50 XP!'
                        : `❌ Not quite! The correct answer is F = ma. Keep going!`
                    }
                  </p>
                </div>
              </div>
            )}
            {(answered || timedOut) && (
              <div className="flex justify-center mt-4">
                <PixelButton onClick={next} color="#ff00cc" size="lg">NEXT ▶</PixelButton>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="ground h-12" />
    </div>
  );
};

// ─── SCREEN 9: Posttest ──────────────────────────────────
const PosttestScreen = ({
  studentId, preScore, preTotal, onComplete, onUpdateRisk
}: {
  studentId: string;
  preScore: number | null;
  preTotal: number;
  onComplete: (score: number, total: number) => void;
  onUpdateRisk?: (tabSwitches: number, fastAnswers: number) => void;
}) => {
  const [postDone, setPostDone] = useState(false);
  const [postScore, setPostScore] = useState(0);
  const [postTotal, setPostTotal] = useState(posttestQuestions.length);

  const handleComplete = (score: number, total: number) => {
    setPostScore(score); setPostTotal(total); setPostDone(true); onComplete(score, total);
  };

  if (!postDone) return (
    <QuizBattery
      title="🏁 POST-TEST"
      questions={posttestQuestions}
      studentId={studentId}
      onComplete={handleComplete}
      timeLimitSec={30}
      onUpdateRisk={onUpdateRisk}
    />
  );

  // Pre vs Post comparison card
  const prePct = preScore !== null ? Math.round((preScore / preTotal) * 100) : 0;
  const postPct = Math.round((postScore / postTotal) * 100);
  const delta = postPct - prePct;

  return (
    <div className="game-screen scanlines starfield" style={{ background: '#1a0a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 40px' }}>
      <h1 className="font-pixel text-center mb-6" style={{ fontSize: 'clamp(0.9rem,3vw,1.4rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>
        📊 LEARNING GAIN
      </h1>
      <div className="border-4 border-black p-6 w-full max-w-sm mb-6 slide-up" style={{ background: '#3d1f6e', borderColor: '#ffe94a', boxShadow: '6px 6px 0 #000' }}>
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div className="border-4 border-black p-3" style={{ background: '#2a1050', boxShadow: '4px 4px 0 #000' }}>
            <p className="font-pixel text-xs mb-2" style={{ color: '#00ffee' }}>PRE</p>
            <p className="font-body text-2xl font-bold" style={{ color: '#ff4fa3' }}>{prePct}%</p>
            <p className="font-pixel text-xs mt-1" style={{ color: '#aaa' }}>{preScore}/{preTotal}</p>
          </div>
          <div className="flex items-center justify-center">
            <span className="font-pixel text-xl" style={{ color: delta >= 0 ? '#4aff91' : '#ff3355' }}>
              {delta >= 0 ? '▲' : '▼'}
            </span>
          </div>
          <div className="border-4 border-black p-3" style={{ background: '#2a1050', boxShadow: '4px 4px 0 #000' }}>
            <p className="font-pixel text-xs mb-2" style={{ color: '#00ffee' }}>POST</p>
            <p className="font-body text-2xl font-bold" style={{ color: '#4aff91' }}>{postPct}%</p>
            <p className="font-pixel text-xs mt-1" style={{ color: '#aaa' }}>{postScore}/{postTotal}</p>
          </div>
        </div>
        <div className="border-4 border-black p-3 text-center" style={{ background: delta >= 0 ? '#4aff9133' : '#ff335533', borderColor: delta >= 0 ? '#4aff91' : '#ff3355', boxShadow: '4px 4px 0 #000' }}>
          <p className="font-pixel text-xs" style={{ color: delta >= 0 ? '#4aff91' : '#ff3355' }}>
            {delta >= 0 ? '🎉' : '📚'} LEARNING GAIN: {delta >= 0 ? '+' : ''}{delta}%
          </p>
        </div>
      </div>
      <MascotWizard mood={delta >= 0 ? 'celebrate' : 'thinking'} size={1.3} className="animate-float" />
      <div className="mt-6">
        <PixelButton onClick={() => { /* handled by App routing */ }} color="#ff00cc" size="lg" glow>▶ CLAIM REWARD</PixelButton>
      </div>
    </div>
  );
};

// ─── SCREEN 10: Progress (with Feature 1 Learning Curve) ──
const ProgressScreen = ({ next, studentId }: { next: () => void; studentId: string }) => {
  const [curveData, setCurveData] = useState<LearningCurvePoint[]>([]);
  const [summary, setSummary] = useState<StudentSummary>({ rolling_accuracy: 84, rolling_avg_time_ms: 12400, streak: 7 });
  const [loading, setLoading] = useState(false);
  const [bucket, setBucket] = useState<'session' | 'day'>('session');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; pt: LearningCurvePoint } | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    Promise.all([
      fetchLearningCurve(studentId, bucket),
      fetchSummary(studentId),
    ]).then(([curve, sum]) => {
      setCurveData(curve);
      if (sum.streak > 0 || sum.rolling_accuracy > 0) setSummary(sum);
      setLoading(false);
    });
  }, [studentId, bucket]);

  const stats = [
    { label: 'STREAK',   value: `🔥 ${summary.streak} Days`, color: '#ff8c1a' },
    { label: 'ACCURACY', value: `🎯 ${summary.rolling_accuracy || 84}%`, color: '#00ffee' },
    { label: 'AVG TIME', value: `⏱ ${summary.rolling_avg_time_ms ? Math.round(summary.rolling_avg_time_ms / 1000) : 12}s`, color: '#4aff91' },
    { label: 'COINS',    value: '🪙 82', color: '#ffe94a' },
  ];

  // SVG chart dimensions
  const W = 320; const H = 140; const PAD = 30;
  const chartW = W - PAD * 2; const chartH = H - PAD * 2;
  const pts = curveData.length > 0 ? curveData : [];

  const maxAcc = pts.length ? Math.max(...pts.map(p => p.accuracy_pct), 100) : 100;
  const toX = (i: number) => PAD + (pts.length <= 1 ? chartW / 2 : (i / (pts.length - 1)) * chartW);
  const toY = (acc: number) => PAD + chartH - (acc / maxAcc) * chartH;

  const polyline = pts.map((p, i) => `${toX(i)},${toY(p.accuracy_pct)}`).join(' ');

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #3d1f6e)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 96, overflowY: 'auto' }}>
      <h1 className="font-pixel text-center mb-6" style={{ fontSize: 'clamp(0.9rem,2.5vw,1.3rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>
        📊 YOUR PROGRESS
      </h1>
      <div className="grid grid-cols-2 gap-4 w-full max-w-md px-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="stat-card"
            style={{ background: s.color + '33', animation: `float 3s ${i * 0.2}s ease-in-out infinite` }}>
            <p className="font-pixel text-xs text-white" style={{ textShadow: '1px 1px 0 #000' }}>{s.label}</p>
            <p className="font-body text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="w-full max-w-md px-4 mb-6">
        <div className="flex justify-between font-pixel text-xs mb-1" style={{ color: '#00ffee' }}>
          <span>LESSON PROGRESS</span><span>70%</span>
        </div>
        <div className="hp-bar-track w-full">
          <div className="hp-bar-fill" style={{ '--fill': '70%' } as React.CSSProperties} />
        </div>
      </div>

      {/* ── FEATURE 1: Learning Curve Chart ── */}
      <div className="w-full max-w-md px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="font-pixel text-xs" style={{ color: '#ff00cc' }}>📈 LEARNING CURVE</p>
          <div className="flex gap-2">
            {(['session', 'day'] as const).map(b => (
              <button key={b} onClick={() => setBucket(b)}
                className="pixel-btn font-pixel border-2 border-black px-2 py-1"
                style={{ fontSize: '7px', background: bucket === b ? '#ff00cc' : '#3d1f6e', color: bucket === b ? '#fff' : '#aaa', boxShadow: bucket === b ? '0 0 0 #000' : '2px 2px 0 #000', transform: bucket === b ? 'translate(2px,2px)' : 'none' }}>
                {b.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="border-4 border-black relative" style={{ background: '#1a0a2e', boxShadow: '6px 6px 0 #000' }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: H }}>
              <span className="font-pixel text-xs" style={{ color: '#00ffee', animation: 'blink 1s step-end infinite' }}>LOADING...</span>
            </div>
          ) : pts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-4" style={{ minHeight: H }}>
              <MascotWizard mood="thinking" size={0.9} />
              <p className="font-pixel text-xs text-center" style={{ color: '#ff4fa3', fontSize: '8px', lineHeight: 2 }}>
                No quest data yet,<br />brave learner!<br />Complete a lesson<br />to see your curve!
              </p>
            </div>
          ) : (
            <div className="relative" onMouseLeave={() => setTooltip(null)}>
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ imageRendering: 'pixelated' }}>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(tick => {
                  const ty = PAD + chartH - (tick / 100) * chartH;
                  return (
                    <g key={tick}>
                      <line x1={PAD} y1={ty} x2={W - PAD} y2={ty} stroke="#ffffff15" strokeWidth="1" />
                      <text x={PAD - 4} y={ty + 3} textAnchor="end" fill="#00ffee" fontSize="7" fontFamily="'Press Start 2P', cursive">{tick}</text>
                    </g>
                  );
                })}
                {/* X-axis labels */}
                {pts.map((p, i) => (
                  <text key={i} x={toX(i)} y={H - 8} textAnchor="middle" fill="#ffe94a" fontSize="6" fontFamily="'Press Start 2P', cursive">{p.label}</text>
                ))}
                {/* Axes */}
                <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#00ffee" strokeWidth="2" />
                <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#00ffee" strokeWidth="2" />
                {/* Filled area under curve */}
                {pts.length > 1 && (
                  <polygon
                    points={`${toX(0)},${H - PAD} ${polyline} ${toX(pts.length - 1)},${H - PAD}`}
                    fill="#ff00cc22"
                  />
                )}
                {/* Polyline — stepped pixel style */}
                {pts.length > 1 && (
                  <polyline
                    points={polyline}
                    fill="none"
                    stroke="#ff00cc"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                )}
                {/* Data point markers */}
                {pts.map((p, i) => (
                  <g key={i} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setTooltip({ x: toX(i), y: toY(p.accuracy_pct), pt: p })}>
                    <rect
                      x={toX(i) - 5} y={toY(p.accuracy_pct) - 5}
                      width={10} height={10}
                      fill="#ff00cc"
                      stroke="#000"
                      strokeWidth="2"
                    />
                    <rect
                      x={toX(i) - 2} y={toY(p.accuracy_pct) - 2}
                      width={4} height={4}
                      fill="#fff"
                    />
                  </g>
                ))}
                {/* Tooltip */}
                {tooltip && (
                  <g>
                    <rect
                      x={Math.min(tooltip.x - 30, W - 110)} y={tooltip.y - 38}
                      width={100} height={34}
                      fill="#1a0a2e"
                      stroke="#00ffee"
                      strokeWidth="2"
                    />
                    <text x={Math.min(tooltip.x - 25, W - 105)} y={tooltip.y - 24} fill="#ffe94a" fontSize="6" fontFamily="'Press Start 2P', cursive">{tooltip.pt.label}: {tooltip.pt.accuracy_pct}%</text>
                    <text x={Math.min(tooltip.x - 25, W - 105)} y={tooltip.y - 12} fill="#00ffee" fontSize="6" fontFamily="'Press Start 2P', cursive">⏱ {Math.round(tooltip.pt.avg_time_ms / 1000)}s avg</text>
                  </g>
                )}
              </svg>
            </div>
          )}
          {/* Y-axis label */}
          <div className="absolute top-1 left-1">
            <span className="font-pixel" style={{ fontSize: '6px', color: '#ff00cc' }}>ACCURACY %</span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-4 w-full max-w-md px-4 mb-8">
        <MascotWizard mood="thinking" size={1.1} />
        <div className="flex-1">
          <DialogueBox speaker="PIXEL TIP" text="You're on a streak! Keep going and you'll earn the PHOENIX badge. Study for 20 more minutes today!" />
        </div>
      </div>
      <PixelButton onClick={next} color="#ff00cc" size="lg">CONTINUE ▶</PixelButton>
    </div>
  );
};

// ─── SCREEN 11: Session Complete ─────────────────────────
const SessionCompleteScreen = ({ next }: { next: () => void }) => (
  <div className="game-screen scanlines starfield" style={{ background: '#1a0a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
    {Array.from({ length: 50 }).map((_, i) => (
      <div key={i} className="absolute rounded-full" style={{
        width: 2, height: 2, background: i % 3 === 0 ? '#00ffee' : '#fff',
        top: `${(i * 41) % 100}%`, left: `${(i * 67) % 100}%`,
        animation: `startwink 1.5s ${(i * 0.1) % 3}s ease-in-out infinite`,
      }} />
    ))}
    <div className="relative z-10 text-center flex flex-col items-center gap-6">
      <p className="font-pixel text-xs" style={{ color: '#00ffee', animation: 'blink 1s step-end infinite', textShadow: '2px 2px 0 #000' }}>*** GAME SAVED ***</p>
      <h1 className="font-pixel" style={{ fontSize: 'clamp(1rem,4vw,2rem)', color: '#ffe94a', textShadow: '4px 4px 0 #000', animation: 'glitch 0.3s ease-in-out infinite', lineHeight: 1.6 }}>
        SESSION<br/>COMPLETE!
      </h1>
      <div className="border-4 border-black p-6 flex flex-col gap-3 w-72" style={{ background: '#3d1f6e', boxShadow: '6px 6px 0 #000', borderColor: '#ffe94a' }}>
        {[['QUESTIONS','10 / 10'],['CORRECT','8'],['XP EARNED','+340'],['COINS','+25 🪙'],['TIME','14:32']].map(([k,v]) => (
          <div key={k} className="flex justify-between font-pixel text-xs">
            <span style={{ color: '#00ffee' }}>{k}</span>
            <span style={{ color: '#ffe94a' }}>{v}</span>
          </div>
        ))}
      </div>
      <MascotWizard mood="celebrate" size={1.4} className="animate-float" />
      <PixelButton onClick={next} color="#ffe94a" textColor="#000" size="lg" glow>▶ CLAIM REWARD</PixelButton>
    </div>
  </div>
);

// ─── SCREEN 12: Reward ───────────────────────────────────
const RewardScreen = ({ goTo }: { goTo: (s: Screen) => void }) => (
  <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #5b3a8e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
    {Array.from({ length: 24 }).map((_, i) => (
      <div key={i} className="absolute w-3 h-3"
        style={{
          top: '40%', left: `${10 + (i * 3.3) % 80}%`,
          background: ['#ff00cc','#00ffee','#ffe94a','#4aff91','#ff3355','#ff8c1a'][i % 6],
          animation: `confetti ${1 + (i % 3) * 0.3}s ease-out ${(i % 5) * 0.15}s infinite`,
          transform: `rotate(${i * 15}deg)`,
        }} />
    ))}
    <div className="relative z-10 flex flex-col items-center gap-4 text-center px-4">
      <div className="text-8xl" style={{ animation: 'bounce2 0.8s ease-in-out infinite' }}>🏆</div>
      <h1 className="font-pixel" style={{ fontSize: 'clamp(1.2rem,4vw,2.2rem)', color: '#ffe94a', textShadow: '4px 4px 0 #000', lineHeight: 1.6 }}>GREAT JOB!</h1>
      <p className="font-pixel text-xs" style={{ color: '#00ffee', textShadow: '2px 2px 0 #000' }}>YOU EARNED A NEW BADGE!</p>
      <div className="border-4 border-black p-6 flex flex-col items-center gap-3" style={{ background: '#3d1f6e', borderColor: '#ffe94a', boxShadow: '6px 6px 0 #000' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-5xl border-4 border-black" style={{ background: 'radial-gradient(circle, #ffe94a, #ff8c1a)', animation: 'float 3s ease-in-out infinite' }}>🌟</div>
        <p className="font-pixel text-xs" style={{ color: '#ffe94a' }}>PHYSICS MASTER</p>
        <p className="font-body text-xs" style={{ color: '#aaa' }}>Completed: Laws of Motion</p>
      </div>
      <MascotWizard mood="celebrate" size={1.5} className="animate-wiggle" />
      <div className="flex gap-4 flex-wrap justify-center mt-2">
        <PixelButton onClick={() => goTo('mainmenu')}  color="#ff00cc"             size="md">🏠 MENU</PixelButton>
        <PixelButton onClick={() => goTo('pretest')}   color="#4aff91" textColor="#000" size="md">▶ NEXT LESSON</PixelButton>
        <PixelButton onClick={() => goTo('leaderboard')} color="#ffe94a" textColor="#000" size="md">🏆 LEADERBOARD</PixelButton>
      </div>
    </div>
  </div>
);

// ─── SCREEN 13: FREE QUEST ───────────────────────────────
const questTags = [
  { label: '∑ MATH',     color: '#ff00cc' },
  { label: '⚗ SCIENCE',  color: '#00ffee' },
  { label: '📜 HISTORY', color: '#ff8c1a' },
  { label: '📖 ENGLISH', color: '#4aff91' },
  { label: '🎨 ART',     color: '#ff4fa3' },
  { label: '💻 CODE',    color: '#ffe94a' },
];

const FreeQuestScreen = ({ goTo, setRobotMood }: { goTo: (s: Screen) => void; setRobotMood: (m: RobotMood) => void }) => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const simulateStream = useCallback((question: string) => {
    setLoading(true);
    setRobotMood('thinking');
    setResponse('');

    const answers: Record<string, string> = {
      default: `Great question, hero! "${question}" — Here's what I know: This topic connects to many areas of learning. In essence, understanding the fundamentals will help you level up in this quest. Keep asking great questions and your knowledge XP will grow!`,
      math:    `Excellent math quest! For "${question}": Start by identifying what you know, then set up your equation. Work step by step, and always double-check your answer. Math is like unlocking a puzzle — each step reveals the next!`,
      science: `Science quest activated! For "${question}": Science begins with observation. Form a hypothesis, test it, and analyze results. The universe is full of wonders waiting for you to discover!`,
      history: `History scroll opened! For "${question}": History teaches us patterns. Great civilizations rose by cooperation and fell by division. Understanding the past arms you for the future!`,
    };

    const tag = selectedTag?.toLowerCase() || 'default';
    const text = answers[tag] ?? answers.default;
    let i = 0;
    const iv = setInterval(() => {
      if (i < text.length) { setResponse(text.slice(0, ++i)); }
      else {
        clearInterval(iv);
        setLoading(false);
        setRobotMood('celebrating');
        setHistory(h => [...h, { q: question, a: text }]);
        setTimeout(() => setRobotMood('idle'), 3000);
      }
    }, 25);
  }, [selectedTag, setRobotMood]);

  const handleSubmit = () => { if (!input.trim()) return; simulateStream(input.trim()); setInput(''); };

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #2a1050)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => goTo('mainmenu')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>◀ BACK</button>
        <h1 className="font-pixel text-center" style={{ fontSize: 'clamp(0.9rem,3vw,1.4rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>
          ✨ FREE QUEST
        </h1>
      </div>

      <div className="w-full max-w-2xl px-4 flex flex-col gap-5">
        <div>
          <p className="font-pixel text-xs mb-3" style={{ color: '#00ffee' }}>SELECT QUEST TYPE:</p>
          <div className="flex flex-wrap gap-2">
            {questTags.map(t => (
              <button key={t.label} onClick={() => setSelectedTag(selectedTag === t.label ? null : t.label)}
                className="pixel-btn font-pixel text-xs border-2 border-black px-3 py-1"
                style={{ background: selectedTag === t.label ? t.color : '#3d1f6e', color: selectedTag === t.label ? '#000' : '#fff', boxShadow: selectedTag === t.label ? '0 0 0 #000' : '3px 3px 0 #000', transform: selectedTag === t.label ? 'translate(3px,3px)' : 'none' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-4 border-black" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', boxShadow: '6px 6px 0 #000' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-black" style={{ background: '#0f0f1a' }}>
            <div className="w-3 h-3 rounded-full" style={{ background: '#ff3355', border: '2px solid #000' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#ffe94a', border: '2px solid #000' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#4aff91', border: '2px solid #000' }} />
            <span className="font-pixel text-xs ml-2" style={{ color: '#00ffee' }}>QUEST_INPUT.exe</span>
          </div>
          <div className="p-4">
            <p className="font-pixel text-xs mb-2" style={{ color: '#4aff91' }}>&gt; TYPE YOUR QUEST:</p>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                rows={3}
                placeholder="e.g. Why is the sky blue? What is algebra? Explain DNA..."
                className="w-full bg-transparent font-body text-sm p-2 outline-none resize-none"
                style={{ border: '2px solid #00ffee', color: '#f0e8ff', caretColor: '#00ffee', boxShadow: '0 0 8px #00ffee44' }}
              />
              <span className="absolute bottom-3 right-3 text-xs" style={{ color: '#00ffee', animation: 'blink 1s step-end infinite' }}>▌</span>
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="font-pixel text-xs" style={{ color: '#555' }}>ENTER to cast • SHIFT+ENTER for newline</span>
              <PixelButton onClick={handleSubmit} color={loading ? '#555' : '#ff00cc'} size="sm" glow={!loading}>
                {loading ? '⏳ CASTING...' : '🔮 CAST SPELL'}
              </PixelButton>
            </div>
          </div>
        </div>

        {(response || loading) && (
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <MascotWizard mood={loading ? 'thinking' : 'idle'} size={1.0} />
              {loading && <div className="text-center mt-1" style={{ animation: 'wiggle 0.4s linear infinite', fontSize: 20 }}>⚙️</div>}
            </div>
            <div className="flex-1">
              <div className="bg-white border-4 border-black p-4" style={{ boxShadow: '6px 6px 0 #000' }}>
                <p className="font-pixel text-xs mb-2 pb-1" style={{ color: '#5b3a8e', borderBottom: '2px solid #eee' }}>PIXEL — AI TUTOR</p>
                <p className="font-body text-sm text-gray-900 leading-relaxed">
                  {response}
                  {loading && <span style={{ animation: 'blink 1s step-end infinite' }}>▌</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <p className="font-pixel text-xs mb-3" style={{ color: '#ff4fa3' }}>⚔ QUEST LOG:</p>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {history.slice(-3).reverse().map((h, i) => (
                <div key={i} className="border-2 border-black p-2 cursor-pointer" style={{ background: '#3d1f6e', boxShadow: '2px 2px 0 #000' }}
                  onClick={() => setResponse(h.a)}>
                  <p className="font-pixel text-xs" style={{ color: '#00ffee' }}>▶ {h.q}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── SCREEN 14: Leaderboard ──────────────────────────────
const leaderData = [
  { rank: 1,  name: 'QUANTUMKID',   xp: 12400, streak: 21, badge: '🔥', avatar: '🧙' },
  { rank: 2,  name: 'PRIYA_STAR',   xp: 11200, streak: 18, badge: '⭐', avatar: '📚' },
  { rank: 3,  name: 'ALEXDOOM',     xp: 10800, streak: 14, badge: '💡', avatar: '⚔️' },
  { rank: 4,  name: 'MATHWIZARD',   xp:  9500, streak: 10, badge: '🎯', avatar: '⚙️' },
  { rank: 5,  name: 'CODEMASTER',   xp:  8900, streak:  8, badge: '🏹', avatar: '🏹' },
  { rank: 6,  name: 'SCIENCEBOT',   xp:  7600, streak:  6, badge: '⚗', avatar: '🧙' },
  { rank: 7,  name: 'HISTORYKING',  xp:  6300, streak:  5, badge: '📜', avatar: '⚔️' },
  { rank: 8,  name: 'ARTQUEEN',     xp:  5700, streak:  4, badge: '🎨', avatar: '📚' },
  { rank: 9,  name: 'WORDSMITH',    xp:  4900, streak:  3, badge: '✍', avatar: '📚' },
  { rank: 10, name: 'PUZZLEGEEK',   xp:  4100, streak:  2, badge: '🧩', avatar: '⚙️' },
];
const trophyColors: Record<number, { bg: string; glow: string; icon: string }> = {
  1: { bg: '#ffe94a', glow: '#ffe94a66', icon: '👑' },
  2: { bg: '#c0c0c0', glow: '#c0c0c066', icon: '🥈' },
  3: { bg: '#ff8c1a', glow: '#ff8c1a66', icon: '🥉' },
};
const tickerMessages = [
  'QUANTUMKID just leveled up! ⭐',
  'PRIYA_STAR hit a 18-day streak! 🔥',
  'ALEXDOOM earned the PHYSICS MASTER badge! 🏆',
  'MATHWIZARD answered 50 questions! 🎯',
  'CODEMASTER unlocked CODE WIZARD! 💻',
];

const LeaderboardScreen = ({ goTo, profiles, activeProfileId }: { goTo: (s: Screen) => void; profiles: StudentProfile[]; activeProfileId: string }) => {
  const [filter, setFilter] = useState<'week' | 'alltime' | 'friends'>('alltime');

  useEffect(() => {
    const iv = setInterval(() => { /* ticker kept for future use */ }, 3000);
    return () => clearInterval(iv);
  }, []);

  const filters: { key: typeof filter; label: string; color: string }[] = [
    { key: 'week',    label: '7 DAYS',   color: '#00ffee' },
    { key: 'alltime', label: 'ALL TIME', color: '#ff00cc' },
    { key: 'friends', label: 'FRIENDS',  color: '#4aff91' },
  ];

  // Feature 9: incorporate local profiles into leaderboard
  const localProfiles = profiles.map((p, i) => ({
    rank: 11 + i, name: p.name.toUpperCase(), xp: 1240 + i * 300,
    streak: 7, badge: '🔥', avatar: avatars.find(a => a.id === p.avatarId)?.emoji || '🧙',
    isLocal: true, isActive: p.id === activeProfileId,
  }));

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #2a1050)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
      <div className="w-full border-b-4 border-black mb-6 overflow-hidden" style={{ background: '#1a0a2e', padding: '6px 0' }}>
        <div style={{ animation: 'cloudmove 8s linear infinite', whiteSpace: 'nowrap', display: 'inline-block' }}>
          {[...tickerMessages, ...tickerMessages].map((m, i) => (
            <span key={i} className="font-pixel text-xs mx-8" style={{ color: i % 2 === 0 ? '#ffe94a' : '#ff4fa3' }}>★ {m}</span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => goTo('mainmenu')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>◀ BACK</button>
        <h1 className="font-pixel text-center" style={{ fontSize: 'clamp(0.9rem,3vw,1.4rem)', color: '#ffe94a', textShadow: '4px 4px 0 #000' }}>
          🏆 TOP SCHOLARS 🏆
        </h1>
      </div>

      <div className="flex gap-3 mb-6">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="pixel-btn font-pixel text-xs border-3 border-black px-4 py-2"
            style={{ border: '3px solid #000', background: filter === f.key ? f.color : '#3d1f6e', color: filter === f.key ? '#000' : '#fff', boxShadow: filter === f.key ? '0 0 0 #000' : '4px 4px 0 #000', transform: filter === f.key ? 'translate(4px,4px)' : 'none' }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-lg px-4 flex flex-col gap-2">
        <div className="grid grid-cols-12 gap-1 font-pixel text-xs mb-2 px-2" style={{ color: '#00ffee' }}>
          <span className="col-span-1">#</span><span className="col-span-1"></span>
          <span className="col-span-4">NAME</span>
          <span className="col-span-3 text-right">XP</span>
          <span className="col-span-2 text-right">🔥</span>
          <span className="col-span-1 text-right"></span>
        </div>

        {leaderData.map((p) => {
          const trophy = trophyColors[p.rank];
          return (
            <div key={p.rank} className="grid grid-cols-12 gap-1 items-center border-4 border-black px-2 py-2"
              style={{ background: trophy ? trophy.bg + '33' : '#3d1f6e', boxShadow: trophy ? `4px 4px 0 #000, 0 0 16px ${trophy.glow}` : '3px 3px 0 #000', border: trophy ? `4px solid ${trophy.bg}` : '4px solid #000' }}>
              <div className="col-span-1 font-pixel text-xs text-center" style={{ color: trophy ? trophy.bg : '#aaa' }}>{trophy ? trophy.icon : p.rank}</div>
              <div className="col-span-1 text-center text-xl" style={{ animation: trophy ? 'float 3s ease-in-out infinite' : 'none' }}>{p.avatar}</div>
              <div className="col-span-4 font-pixel text-xs truncate" style={{ color: trophy ? '#ffe94a' : '#f0e8ff' }}>{p.name}{trophy && <span className="ml-1" style={{ color: trophy.bg }}>★</span>}</div>
              <div className="col-span-3 font-pixel text-xs text-right" style={{ color: '#4aff91' }}>{p.xp.toLocaleString()}</div>
              <div className="col-span-2 font-pixel text-xs text-right" style={{ color: '#ff8c1a' }}>{p.streak}d</div>
              <div className="col-span-1 text-center text-sm">{p.badge}</div>
            </div>
          );
        })}

        {/* Local profiles (Feature 9) */}
        {localProfiles.length > 0 && (
          <>
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 border-t-2 border-black border-dashed" />
              <span className="font-pixel text-xs" style={{ color: '#555' }}>• LOCAL PLAYERS •</span>
              <div className="flex-1 border-t-2 border-black border-dashed" />
            </div>
            {localProfiles.map((p) => (
              <div key={p.rank} className="grid grid-cols-12 gap-1 items-center border-4 border-black px-2 py-2"
                style={{ background: p.isActive ? '#ff00cc33' : '#2a1050', boxShadow: p.isActive ? '4px 4px 0 #000, 0 0 16px #ff00cc44' : '3px 3px 0 #000', borderColor: p.isActive ? '#ff00cc' : '#000' }}>
                <div className="col-span-1 font-pixel text-xs text-center" style={{ color: p.isActive ? '#ff00cc' : '#aaa' }}>{p.rank}</div>
                <div className="col-span-1 text-center text-xl">{p.avatar}</div>
                <div className="col-span-4 font-pixel text-xs" style={{ color: p.isActive ? '#ffe94a' : '#f0e8ff' }}>
                  {p.name} {p.isActive && <span style={{ color: '#ff4fa3', animation: 'blink 1s step-end infinite' }}>◀</span>}
                </div>
                <div className="col-span-3 font-pixel text-xs text-right" style={{ color: '#4aff91' }}>{p.xp.toLocaleString()}</div>
                <div className="col-span-2 font-pixel text-xs text-right" style={{ color: '#ff8c1a' }}>{p.streak}d</div>
                <div className="col-span-1 text-center text-sm">{p.badge}</div>
              </div>
            ))}
          </>
        )}

        <div className="flex items-center gap-2 my-2">
          <div className="flex-1 border-t-2 border-black border-dashed" />
          <span className="font-pixel text-xs" style={{ color: '#555' }}>• • •</span>
          <div className="flex-1 border-t-2 border-black border-dashed" />
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <PixelButton onClick={() => goTo('pretest')} color="#ff00cc" size="md">▶ STUDY MORE</PixelButton>
        <PixelButton onClick={() => goTo('freequest')} color="#ffe94a" textColor="#000" size="md" glow>✨ FREE QUEST</PixelButton>
      </div>
    </div>
  );
};

// ─── FEATURE 4: Eval Metrics Screen ──────────────────────
const EvalMetricsScreen = ({ goTo, sessionRiskScore }: { goTo: (s: Screen) => void; sessionRiskScore: number }) => {
  const riskLevel = sessionRiskScore < 33 ? { label: 'LOW', color: '#4aff91' } : sessionRiskScore < 66 ? { label: 'MEDIUM', color: '#ffe94a' } : { label: 'HIGH', color: '#ff3355' };

  const metrics = [
    { label: 'ACCURACY',    value: '84%',    trend: '▲', trendDir: 'up',   color: '#00ffee', icon: '🎯', sub: 'last 20 attempts' },
    { label: 'HINT USAGE',  value: '23%',    trend: '▼', trendDir: 'down', color: '#ffe94a', icon: '💡', sub: 'of questions' },
    { label: 'AVG SPEED',   value: '12.4s',  trend: '▲', trendDir: 'up',   color: '#4aff91', icon: '⏱', sub: 'per answer' },
    { label: 'MISCONCEPTIONS', value: '3',   trend: '▼', trendDir: 'good', color: '#ff8c1a', icon: '🧠', sub: 'recurring' },
    { label: 'CONFIDENCE',  value: '76%',    trend: '▲', trendDir: 'up',   color: '#ff00cc', icon: '💪', sub: 'trend upward' },
    { label: 'ESCALATIONS', value: '2',      trend: '▼', trendDir: 'good', color: '#ff3355', icon: '⚠️', sub: 'this session' },
  ];

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #2a1050)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
      <div className="flex items-center gap-4 mb-2 w-full max-w-2xl px-4">
        <button onClick={() => goTo('mainmenu')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>◀ BACK</button>
        <h1 className="font-pixel" style={{ fontSize: 'clamp(0.8rem,2.5vw,1.1rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>📈 EVAL METRICS</h1>
      </div>
      <p className="font-pixel text-xs mb-6 w-full max-w-2xl px-4" style={{ color: '#ff4fa3' }}>TEACHER / ANALYST VIEW</p>

      {/* Risk Score (Feature 7) */}
      <div className="w-full max-w-2xl px-4 mb-6">
        <div className="border-4 border-black p-4 slide-up" style={{ background: '#1a0a2e', boxShadow: '6px 6px 0 #000', borderColor: riskLevel.color }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-pixel text-xs" style={{ color: riskLevel.color }}>🛡️ CHEATING RISK SIGNAL</p>
            <span className="font-pixel text-xs" style={{ color: riskLevel.color, animation: sessionRiskScore > 66 ? 'blink 0.5s step-end infinite' : 'none' }}>
              {riskLevel.label}
            </span>
          </div>
          <div className="hp-bar-track w-full" style={{ height: 16 }}>
            <div className="hp-bar-fill-risk" style={{ '--fill': `${sessionRiskScore}%`, animation: 'hpbar 1s ease-out forwards' } as React.CSSProperties} />
          </div>
          <div className="flex justify-between font-pixel mt-2" style={{ fontSize: '7px', color: '#555' }}>
            <span>0 — LOW RISK</span><span>100 — HIGH RISK</span>
          </div>
          <p className="font-pixel mt-2" style={{ fontSize: '7px', color: '#aaa' }}>Based on tab-switching, answer speed, and paste events</p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-2xl px-4 mb-6">
        {metrics.map((m, i) => (
          <div key={i} className="border-4 border-black p-4 slide-up"
            style={{ background: m.color + '15', boxShadow: '6px 6px 0 #000', animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-pixel mb-1" style={{ fontSize: '7px', color: '#aaa' }}>{m.label}</p>
                <p className="font-body text-2xl font-bold" style={{ color: m.color }}>{m.icon} {m.value}</p>
              </div>
              <span className={`font-pixel text-sm ${m.trendDir === 'up' || m.trendDir === 'good' ? 'trend-up' : 'trend-down'}`}>
                {m.trend}
              </span>
            </div>
            <p className="font-pixel" style={{ fontSize: '7px', color: '#555' }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Mascot tip */}
      <div className="flex items-end gap-4 w-full max-w-2xl px-4">
        <MascotWizard mood="thinking" size={0.9} />
        <div className="flex-1">
          <DialogueBox speaker="ANALYSIS" text="Overall performance is trending upward! Hint usage is decreasing which shows growing confidence. Keep monitoring misconception recurrence." />
        </div>
      </div>
    </div>
  );
};

// ─── FEATURE 5: Misconception Graph Screen ───────────────
const misconceptionData = [
  { concept: 'NEWTON LAWS',    masteryPct: 72, prerequisite: null,           x: 200, y: 40,  topic: 'Physics' },
  { concept: 'FORCES',         masteryPct: 60, prerequisite: 'NEWTON LAWS',  x: 80,  y: 130, topic: 'Physics' },
  { concept: 'MOTION',         masteryPct: 85, prerequisite: 'NEWTON LAWS',  x: 320, y: 130, topic: 'Physics' },
  { concept: 'GRAVITY',        masteryPct: 45, prerequisite: 'FORCES',       x: 40,  y: 230, topic: 'Physics' },
  { concept: 'FRICTION',       masteryPct: 30, prerequisite: 'FORCES',       x: 140, y: 230, topic: 'Physics' },
  { concept: 'VELOCITY',       masteryPct: 88, prerequisite: 'MOTION',       x: 280, y: 230, topic: 'Physics' },
  { concept: 'ACCELERATION',   masteryPct: 55, prerequisite: 'MOTION',       x: 380, y: 230, topic: 'Physics' },
];

const MisconceptionsScreen = ({ goTo }: { goTo: (s: Screen) => void }) => {
  const [selected, setSelected] = useState<typeof misconceptionData[0] | null>(null);

  const masteryColor = (pct: number) =>
    pct >= 75 ? '#4aff91' : pct >= 50 ? '#ffe94a' : '#ff3355';

  const tips: Record<string, string> = {
    'NEWTON LAWS':  "Newton's Laws are your foundation! Focus on F=ma — it connects everything else.",
    'FORCES':       "Forces cause acceleration. Weak here? Try the Forces & Motion lesson next!",
    'MOTION':       "Great progress on Motion! You're above 80% — keep it up!",
    'GRAVITY':      "Gravity is pulling your score down! 😄 Review gravitational force concepts.",
    'FRICTION':     "Friction is your lowest concept. Start with 'What is friction?' exercises!",
    'VELOCITY':     "Excellent! Velocity is mastered. Use this to tackle Acceleration next.",
    'ACCELERATION': "Acceleration needs work. Remember: a = Δv/Δt. Practice calculations!",
  };

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #2a1050)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
      <div className="flex items-center gap-4 mb-2 w-full max-w-2xl px-4">
        <button onClick={() => goTo('mainmenu')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>◀ BACK</button>
        <h1 className="font-pixel" style={{ fontSize: 'clamp(0.8rem,2.5vw,1.1rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>🧠 MISCONCEPTION MAP</h1>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        {[['#4aff91', 'MASTERED ≥75%'], ['#ffe94a', 'DEVELOPING 50-74%'], ['#ff3355', 'WEAK <50%']].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1">
            <div style={{ width: 12, height: 12, background: c as string, border: '2px solid #000' }} />
            <span className="font-pixel" style={{ fontSize: '6px', color: '#aaa' }}>{l}</span>
          </div>
        ))}
      </div>

      {/* SVG Graph */}
      <div className="border-4 border-black mb-4" style={{ background: '#1a0a2e', boxShadow: '6px 6px 0 #000', maxWidth: 480, width: '100%', margin: '0 16px 16px' }}>
        <svg viewBox="0 0 460 290" style={{ width: '100%', imageRendering: 'pixelated' }}>
          {/* Edges (prerequisite lines) */}
          {misconceptionData.filter(n => n.prerequisite).map(node => {
            const parent = misconceptionData.find(n => n.concept === node.prerequisite);
            if (!parent) return null;
            return (
              <g key={node.concept + '-edge'}>
                <polyline
                  points={`${parent.x + 40},${parent.y + 16} ${parent.x + 40},${parent.y + 28} ${node.x + 40},${parent.y + 28} ${node.x + 40},${node.y}`}
                  fill="none"
                  stroke="#5b3a8e"
                  strokeWidth="3"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {misconceptionData.map(node => {
            const color = masteryColor(node.masteryPct);
            const isSelected = selected?.concept === node.concept;
            return (
              <g key={node.concept} style={{ cursor: 'pointer' }}
                onClick={() => setSelected(selected?.concept === node.concept ? null : node)}>
                {/* Glow on selection */}
                {isSelected && <rect x={node.x - 6} y={node.y - 6} width={92} height={36} fill={color} opacity={0.25} />}
                {/* Node box */}
                <rect x={node.x} y={node.y} width={80} height={28} fill="#2a1050" stroke={color} strokeWidth={isSelected ? 4 : 2} />
                <rect x={node.x} y={node.y} width={80} height={4} fill={color} />
                <text x={node.x + 4} y={node.y + 16} className="concept-node-text" style={{ fontSize: '6px', fontFamily: "'Press Start 2P', cursive", fill: '#fff' }}>
                  {node.concept.length > 10 ? node.concept.slice(0, 9) + '…' : node.concept}
                </text>
                <text x={node.x + 4} y={node.y + 25} style={{ fontSize: '6px', fontFamily: "'Press Start 2P', cursive", fill: color }}>
                  {node.masteryPct}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Info panel when a node is selected */}
      {selected ? (
        <div className="flex items-end gap-4 w-full max-w-2xl px-4 slide-up">
          <MascotWizard mood="pointing" size={0.9} />
          <div className="flex-1">
            <DialogueBox
              speaker={`${selected.concept} — ${selected.masteryPct}% MASTERED`}
              text={tips[selected.concept] || 'Click any concept node to learn more!'}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-4 w-full max-w-2xl px-4">
          <MascotWizard mood="idle" size={0.9} />
          <div className="flex-1">
            <DialogueBox speaker="PIXEL — AI TUTOR" text="Click any concept node to see your gap analysis and next lesson suggestion!" />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── FEATURE 6: Spaced Repetition Hook + Screen ──────────
interface SpacedRepState {
  [concept: string]: { interval: number; ease: number; nextReview: Date; lastCorrect: boolean };
}

function useSpacedRepetition(quizResults: { concept: string; correct: boolean }[]) {
  const [schedule, setSchedule] = useState<SpacedRepState>({});

  useEffect(() => {
    if (quizResults.length === 0) return;
    setSchedule(prev => {
      const next = { ...prev };
      quizResults.forEach(({ concept, correct }) => {
        const existing = next[concept] || { interval: 1, ease: 2.5, nextReview: new Date(), lastCorrect: false };
        const newEase = correct
          ? Math.max(1.3, existing.ease + 0.1)
          : Math.max(1.3, existing.ease - 0.2);
        const newInterval = correct
          ? existing.interval <= 1 ? 2 : Math.round(existing.interval * newEase)
          : 1;
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + newInterval);
        next[concept] = { interval: newInterval, ease: newEase, nextReview, lastCorrect: correct };
      });
      return next;
    });
  }, [quizResults.length]);

  const items: SpacedRepItem[] = Object.entries(schedule).map(([concept, s]) => ({
    concept, ...s
  }));

  return items.sort((a, b) => a.nextReview.getTime() - b.nextReview.getTime());
}

const SpacedRepeatScreen = ({ goTo, quizResults }: { goTo: (s: Screen) => void; quizResults: { concept: string; correct: boolean }[] }) => {
  const items = useSpacedRepetition(quizResults);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mockItems: SpacedRepItem[] = [
    { concept: 'NEWTON LAWS',  interval: 1,  ease: 2.3, nextReview: new Date(),                         lastCorrect: false },
    { concept: 'FORCES',       interval: 3,  ease: 2.5, nextReview: new Date(Date.now() + 86400000*2),   lastCorrect: true  },
    { concept: 'GRAVITY',      interval: 7,  ease: 2.7, nextReview: new Date(Date.now() + 86400000*6),   lastCorrect: true  },
    { concept: 'MOTION',       interval: 14, ease: 2.9, nextReview: new Date(Date.now() + 86400000*13),  lastCorrect: true  },
    { concept: 'VELOCITY',     interval: 1,  ease: 2.1, nextReview: new Date(),                         lastCorrect: false  },
  ];

  const displayItems = items.length > 0 ? items : mockItems;

  const daysUntil = (d: Date) => {
    const diff = d.getTime() - today.getTime();
    return Math.ceil(diff / 86400000);
  };

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #2a1050)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
      <div className="flex items-center gap-4 mb-6 w-full max-w-lg px-4">
        <button onClick={() => goTo('mainmenu')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>◀ BACK</button>
        <h1 className="font-pixel" style={{ fontSize: 'clamp(0.8rem,2.5vw,1.1rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>📅 REVIEW QUEUE</h1>
      </div>

      <p className="font-pixel text-xs mb-6 w-full max-w-lg px-4" style={{ color: '#00ffee' }}>SM-2 SPACED REPETITION SCHEDULE</p>

      <div className="w-full max-w-lg px-4 flex flex-col gap-3">
        {displayItems.map((item, i) => {
          const days = daysUntil(item.nextReview);
          const isDue = days <= 0;
          return (
            <div key={item.concept} className="border-4 border-black p-3 flex items-center justify-between slide-up"
              style={{
                background: isDue ? '#ff335522' : '#3d1f6e',
                borderColor: isDue ? '#ff3355' : '#5b3a8e',
                boxShadow: isDue ? '4px 4px 0 #000, 0 0 12px #ff335544' : '4px 4px 0 #000',
                animationDelay: `${i * 0.06}s`,
              }}>
              <div className="flex-1">
                <p className="font-pixel text-xs" style={{ color: isDue ? '#ff3355' : '#f0e8ff' }}>
                  {isDue && <span style={{ animation: 'blink 0.5s step-end infinite' }}>⚠️ </span>}
                  {item.concept}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-pixel" style={{ fontSize: '7px', color: '#aaa' }}>
                    Interval: {item.interval}d | Ease: {item.ease.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                {isDue ? (
                  <span className="font-pixel text-xs" style={{ color: '#ff3355', animation: 'blink 1s step-end infinite' }}>
                    REVIEW NOW
                  </span>
                ) : (
                  <span className="font-pixel" style={{ fontSize: '7px', color: '#00ffee' }}>
                    in {days}d
                  </span>
                )}
                <div className="hp-bar-track mt-1" style={{ width: 80, height: 6 }}>
                  <div style={{
                    width: `${Math.min(100, (item.ease / 3.5) * 100)}%`,
                    height: '100%',
                    background: '#ff00cc',
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-4 w-full max-w-lg px-4 mt-6">
        <MascotWizard mood="pointing" size={0.9} />
        <div className="flex-1">
          <DialogueBox
            speaker="PIXEL — SCHEDULER"
            text={`${displayItems.filter(i => daysUntil(i.nextReview) <= 0).length} item(s) due today! Regular review is the secret to mastery. SM-2 algorithm optimizes your review timing!`}
          />
        </div>
      </div>
    </div>
  );
};

// ─── FEATURE 9: Switch Student Screen ────────────────────
const SwitchStudentScreen = ({
  goTo, profiles, activeProfileId, onSwitch, onAddNew
}: {
  goTo: (s: Screen) => void;
  profiles: StudentProfile[];
  activeProfileId: string;
  onSwitch: (id: string) => void;
  onAddNew: () => void;
}) => (
  <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #3d1f6e)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
    <div className="flex items-center gap-4 mb-6 w-full max-w-lg px-4">
      <button onClick={() => goTo('mainmenu')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>◀ BACK</button>
      <h1 className="font-pixel" style={{ fontSize: 'clamp(0.8rem,2.5vw,1.2rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>👥 SWITCH STUDENT</h1>
    </div>

    <div className="w-full max-w-lg px-4 flex flex-col gap-4">
      {profiles.length === 0 ? (
        <div className="border-4 border-black p-8 text-center" style={{ background: '#1a0a2e', boxShadow: '6px 6px 0 #000' }}>
          <MascotWizard mood="thinking" size={0.9} className="mx-auto mb-4" />
          <p className="font-pixel text-xs" style={{ color: '#aaa', lineHeight: 2 }}>NO PROFILES YET!<br />CREATE ONE BELOW.</p>
        </div>
      ) : (
        profiles.map(p => {
          const av = avatars.find(a => a.id === p.avatarId);
          const isActive = p.id === activeProfileId;
          return (
            <button key={p.id} onClick={() => { onSwitch(p.id); goTo('mainmenu'); }}
              className="pixel-btn border-4 border-black p-4 flex items-center gap-4 text-left w-full"
              style={{
                background: isActive ? '#ff00cc33' : '#3d1f6e',
                boxShadow: isActive ? '0 0 0 #000, 0 0 16px #ff00cc44' : '5px 5px 0 #000',
                transform: isActive ? 'translate(5px,5px)' : 'translate(0,0)',
                borderColor: isActive ? '#ff00cc' : '#000',
              }}>
              <span className="text-4xl">{av?.emoji || '🧙'}</span>
              <div className="flex-1">
                <p className="font-pixel text-xs" style={{ color: isActive ? '#ffe94a' : '#f0e8ff' }}>{p.name}</p>
                <p className="font-pixel mt-1" style={{ fontSize: '7px', color: '#aaa' }}>{av?.name || 'WIZARD'} CLASS</p>
              </div>
              {isActive && <span className="font-pixel text-xs" style={{ color: '#ff00cc', animation: 'blink 1s step-end infinite' }}>ACTIVE</span>}
            </button>
          );
        })
      )}

      <PixelButton onClick={onAddNew} color="#4aff91" textColor="#000" size="lg" className="w-full">
        ➕ ADD NEW PLAYER
      </PixelButton>
    </div>
  </div>
);

// ─── App Router ──────────────────────────────────────────
const SCREEN_ORDER: Screen[] = [
  'landing','signin','mainmenu','welcome','avatarselect',
  'howitworks','pretest','lesson','posttest','progress','sessioncomplete','reward',
];

export default function App() {
  const [screen, setScreen]   = useState<Screen>('landing');
  const [coins]               = useState(82);
  const [xp]                  = useState(70);
  const [, setRobotMood] = useState<RobotMood>('idle');

  // Feature 9: Multi-student profiles
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('wizard');

  // Feature 3: Pre/post scores
  const [preScore, setPreScore] = useState<number | null>(null);
  const [preTotal, setPreTotal] = useState<number>(5);

  // Feature 7: Risk signals
  const [tabSwitches, setTabSwitches] = useState(0);
  const [fastAnswers, setFastAnswers] = useState(0);
  const sessionRiskScore = Math.min(100, tabSwitches * 15 + fastAnswers * 20);

  // Feature 10: Wrong answer streak for mascot tips
  const [wrongAnswerStreak, setWrongAnswerStreak] = useState(0);

  // Feature 6: Quiz results for spaced repetition
  const [quizResults, setQuizResults] = useState<{ concept: string; correct: boolean }[]>([]);

  const handleUpdateRisk = useCallback((tabs: number, fast: number) => {
    setTabSwitches(tabs);
    setFastAnswers(fast);
  }, []);

  // Spaced rep due count (Feature 10 mascot tip)
  const spacedRepDueCount = 2; // Mock — would be computed from useSpacedRepetition in a real flow

  const next = () => {
    const idx = SCREEN_ORDER.indexOf(screen);
    if (idx >= 0 && idx < SCREEN_ORDER.length - 1) setScreen(SCREEN_ORDER[idx + 1]);
  };
  const goTo = (s: Screen) => setScreen(s);

  const showHud = !['landing', 'signin'].includes(screen);

  // Feature 9: create a new profile from signin
  const handleSetName = (name: string) => {
    setPlayerName(name);
    const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const newProfile: StudentProfile = { id, name, avatarId: selectedAvatarId };
    setProfiles(prev => {
      const exists = prev.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (exists) { setActiveProfileId(exists.id); return prev; }
      setActiveProfileId(id);
      return [...prev, newProfile];
    });
  };

  const handleAvatarSelect = (id: string) => {
    setSelectedAvatarId(id);
    // Update the active profile's avatarId
    setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, avatarId: id } : p));
  };

  const handlePretestComplete = (score: number, total: number) => {
    setPreScore(score);
    setPreTotal(total);
    next();
  };

  const handlePosttestComplete = (score: number, _total: number) => {
    // Add quiz results for spaced repetition
    setQuizResults(prev => [...prev, ...posttestQuestions.map((q, i) => ({ concept: q.concept, correct: i < score }))]);
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const studentId = activeProfile?.name || playerName || 'anonymous';

  return (
    <div style={{ minHeight: '100vh', background: '#1a0a2e' }}>
      {showHud && <HUD coins={coins} level={3} xp={xp} goTo={goTo} playerName={playerName} />}

      <div style={{ paddingTop: showHud ? 48 : 0 }}>
        {screen === 'landing'         && <LandingScreen next={next} />}
        {screen === 'signin'          && <SignInScreen next={next} back={() => setScreen('landing')} onSetName={handleSetName} />}
        {screen === 'mainmenu'        && <MainMenuScreen goTo={goTo} />}
        {screen === 'welcome'         && <WelcomeScreen next={next} />}
        {screen === 'avatarselect'    && <AvatarScreen next={next} onSelect={handleAvatarSelect} />}
        {screen === 'howitworks'      && <HowItWorksScreen next={next} />}
        {screen === 'pretest'         && (
          <PretestScreen
            studentId={studentId}
            onComplete={handlePretestComplete}
            onUpdateRisk={handleUpdateRisk}
          />
        )}
        {screen === 'lesson'          && (
          <LessonScreen
            next={next}
            studentId={studentId}
            onWrongStreak={setWrongAnswerStreak}
            onUpdateRisk={handleUpdateRisk}
          />
        )}
        {screen === 'posttest'        && (
          <PosttestScreen
            studentId={studentId}
            preScore={preScore}
            preTotal={preTotal}
            onComplete={handlePosttestComplete}
            onUpdateRisk={handleUpdateRisk}
          />
        )}
        {screen === 'progress'        && <ProgressScreen next={next} studentId={studentId} />}
        {screen === 'sessioncomplete' && <SessionCompleteScreen next={next} />}
        {screen === 'reward'          && <RewardScreen goTo={goTo} />}
        {screen === 'freequest'       && <FreeQuestScreen goTo={goTo} setRobotMood={setRobotMood} />}
        {screen === 'leaderboard'     && <LeaderboardScreen goTo={goTo} profiles={profiles} activeProfileId={activeProfileId} />}
        {screen === 'evalmetrics'     && <EvalMetricsScreen goTo={goTo} sessionRiskScore={sessionRiskScore} />}
        {screen === 'misconceptions'  && <MisconceptionsScreen goTo={goTo} />}
        {screen === 'spacedrepeat'    && <SpacedRepeatScreen goTo={goTo} quizResults={quizResults} />}
        {screen === 'switchstudent'   && (
          <SwitchStudentScreen
            goTo={goTo}
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSwitch={id => { setActiveProfileId(id); const p = profiles.find(x => x.id === id); if (p) setPlayerName(p.name); }}
            onAddNew={() => goTo('signin')}
          />
        )}
      </div>

      {/* Global persistent robot mascot (Feature 10) */}
      <RobotMascot
        screen={screen}
        wrongAnswerStreak={wrongAnswerStreak}
        spacedRepDueCount={spacedRepDueCount}
        newBestCurve={false}
      />
    </div>
  );
}
