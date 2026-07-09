import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// ─── Types ────────────────────────────────────────────────
type Screen =
  | 'landing'
  | 'signin'
  | 'mainmenu'
  | 'welcome'
  | 'avatarselect'
  | 'howitworks'
  | 'lesson'
  | 'progress'
  | 'sessioncomplete'
  | 'reward'
  | 'freequest'
  | 'leaderboard';

type RobotMood = 'idle' | 'thinking' | 'celebrating' | 'pointing';

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

// ─── ROBOT MASCOT (Global Persistent) ────────────────────
const RobotMascotSVG = ({ mood }: { mood: RobotMood }) => {
  const eyeColor = mood === 'celebrating' ? '#ffe94a' : mood === 'thinking' ? '#00ffee' : mood === 'pointing' ? '#ff4fa3' : '#00ffee';
  return (
    <svg width="56" height="72" viewBox="0 0 56 72" style={{ imageRendering: 'pixelated' }}>
      {/* Antenna */}
      <rect x="26" y="0" width="4" height="8" fill="#aaa" />
      <rect x="22" y="0" width="12" height="4" fill="#888" />
      <rect x="24" y="-4" width="8" height="6" fill={eyeColor} style={{ animation: 'blink 2s step-end infinite' }} />
      {/* Head */}
      <rect x="8"  y="8"  width="40" height="28" fill="#4a4a6a" />
      <rect x="8"  y="8"  width="40" height="4"  fill="#333" />
      <rect x="8"  y="32" width="40" height="4"  fill="#333" />
      {/* Eye visor */}
      <rect x="12" y="14" width="32" height="14" fill="#1a1a2e" />
      <rect x="14" y="16" width="12" height="10" fill={eyeColor} style={{ opacity: 0.9 }} />
      <rect x="30" y="16" width="12" height="10" fill={eyeColor} style={{ opacity: 0.9 }} />
      <rect x="15" y="17" width="4" height="4" fill="#fff" style={{ opacity: 0.6 }} />
      <rect x="31" y="17" width="4" height="4" fill="#fff" style={{ opacity: 0.6 }} />
      {/* Mouth panel */}
      <rect x="16" y="28" width="24" height="6" fill="#333" />
      {mood === 'celebrating'
        ? [0,4,8,12,16,20].map(i => <rect key={i} x={16+i} y={30} width="3" height="3" fill={i%2===0 ? '#ffe94a' : '#ff00cc'} />)
        : [0,6,12,18].map(i => <rect key={i} x={18+i} y={30} width="3" height="3" fill="#555" />)
      }
      {/* Body */}
      <rect x="10" y="36" width="36" height="24" fill="#3a3a5a" />
      <rect x="10" y="36" width="36" height="4"  fill="#555" />
      {/* Chest panel */}
      <rect x="16" y="42" width="24" height="12" fill="#2a2a4a" />
      <rect x="18" y="44" width="6" height="6" fill={eyeColor} style={{ opacity: 0.7 }} />
      <rect x="28" y="44" width="6" height="6" fill="#ff00cc" style={{ opacity: 0.7 }} />
      <rect x="36" y="44" width="4" height="8" fill="#888" />
      {/* Arms */}
      <rect x="0"  y="38" width="10" height="6" fill="#3a3a5a" />
      <rect x="46" y="38" width="10" height="6" fill="#3a3a5a" />
      <rect x="0"  y="44" width="8"  height="8" fill="#555" />
      <rect x="48" y="44" width="8"  height="8" fill="#555" />
      {/* Pointing hand if pointing */}
      {mood === 'pointing' && <rect x="-4" y="44" width="8" height="4" fill="#ffe94a" />}
      {/* Legs */}
      <rect x="14" y="60" width="10" height="10" fill="#2a2a4a" />
      <rect x="32" y="60" width="10" height="10" fill="#2a2a4a" />
      <rect x="12" y="68" width="12" height="4" fill="#000" />
      <rect x="32" y="68" width="12" height="4" fill="#000" />
    </svg>
  );
};

const RobotMascot = ({ screen }: { screen: Screen }) => {
  const [mood, setMood] = useState<RobotMood>('idle');
  const [bubble, setBubble] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, rx: 0, ry: 0 });
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

  // Dragging
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, rx: pos.x, ry: pos.y };
    e.preventDefault();
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: dragStart.current.rx + (e.clientX - dragStart.current.mx),
        y: dragStart.current.ry + (e.clientY - dragStart.current.my),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const bobAnim = mood === 'idle' ? 'animate-float' : mood === 'celebrating' ? 'animate-bounce2' : '';

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] select-none"
      style={{ bottom: 24 + pos.y * -1, right: 24 - pos.x, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
      onClick={() => setShowBubble(v => !v)}
    >
      {/* Speech bubble */}
      {showBubble && bubble && (
        <div className="absolute bottom-full right-0 mb-2 w-48">
          <div className="bg-white border-3 border-black p-2 text-xs font-body text-gray-900 leading-relaxed shadow-pixel relative" style={{ border: '3px solid #000', boxShadow: '3px 3px 0 #000' }}>
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
      <div className={`${bobAnim}`} style={{ filter: 'drop-shadow(3px 3px 0 #000)' }}>
        <RobotMascotSVG mood={mood} />
      </div>

      {/* Tap hint */}
      <p className="text-center font-pixel text-px-cyan mt-1" style={{ fontSize: '6px', color: '#00ffee' }}>TAP ME</p>
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
}
const PixelButton = ({ children, color = '#ff00cc', textColor = '#fff', onClick, className = '', size = 'md', glow = false }: PixelButtonProps) => {
  const [pressed, setPressed] = useState(false);
  const sizes = { sm: 'text-xs px-4 py-2', md: 'text-sm px-6 py-3', lg: 'text-base px-8 py-4' };
  return (
    <button
      className={`pixel-btn font-pixel border-4 border-black ${sizes[size]} inline-block select-none ${className}`}
      style={{
        background: color,
        color: textColor,
        boxShadow: pressed ? '0 0 0 #000' : glow ? `5px 5px 0 #000, 0 0 18px ${color}88` : '5px 5px 0 #000',
        transform: pressed ? 'translate(5px,5px)' : 'translate(0,0)',
        transition: 'transform 0.08s, box-shadow 0.08s',
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
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
const HUD = ({ coins = 0, level = 1, xp = 60, goTo }: { coins: number; level: number; xp: number; goTo: (s: Screen) => void }) => (
  <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-px-dark border-b-4 border-black font-pixel" style={{ background: '#1a0a2e', borderBottom: '4px solid #000' }}>
    <div className="flex items-center gap-3">
      <span className="font-pixel text-xs" style={{ color: '#ffe94a' }}>⭐ LVL {level}</span>
      <div className="hp-bar-track" style={{ width: 128, height: 16 }}>
        <div className="hp-bar-fill" style={{ '--fill': `${xp}%` } as React.CSSProperties} />
      </div>
      <span className="font-pixel text-xs" style={{ color: '#4aff91' }}>XP {xp}%</span>
    </div>
    <div className="flex items-center gap-3">
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
const SignInScreen = ({ next, back }: { next: () => void; back: () => void }) => (
  <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #5b3a8e)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
    <div className="absolute left-4 bottom-24" style={{ display: 'none' }}><MascotWizard mood="idle" size={1.2} /></div>
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
          onFocus={e => (e.target.style.borderColor = '#ff00cc')}
          onBlur={e => (e.target.style.borderColor = '#000')}
        />
        <div className="flex gap-4 justify-center">
          <PixelButton onClick={next} color="#4aff91" textColor="#000" size="md">✔ YES!</PixelButton>
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

    <div className="relative z-10 flex flex-col items-center gap-4 mb-8">
      <h1 className="font-pixel text-center mb-4" style={{ fontSize: 'clamp(1rem,3.5vw,1.6rem)', color: '#ffe94a', textShadow: '4px 4px 0 #000' }}>
        ⚔ MAIN MENU ⚔
      </h1>
      <PixelButton onClick={() => goTo('signin')}     color="#ff00cc"             size="lg" className="w-64">👤 SIGN IN</PixelButton>
      <PixelButton onClick={() => goTo('lesson')}     color="#00ffee" textColor="#000" size="lg" className="w-64">📚 START LESSON</PixelButton>
      <PixelButton onClick={() => goTo('freequest')}  color="#ffe94a" textColor="#000" size="lg" className="w-64" glow>✨ FREE QUEST</PixelButton>
      <PixelButton onClick={() => goTo('leaderboard')} color="#ff4fa3"             size="lg" className="w-64">🏆 LEADERBOARD</PixelButton>
      <PixelButton onClick={() => goTo('progress')}   color="#4aff91" textColor="#000" size="lg" className="w-64">📊 PROGRESS</PixelButton>
      <PixelButton onClick={() => goTo('howitworks')} color="#5b3a8e"             size="lg" className="w-64">❓ HOW IT WORKS</PixelButton>
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
const AvatarScreen = ({ next }: { next: () => void }) => {
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
      <PixelButton onClick={next} color={selected ? '#4aff91' : '#555'} textColor="#000" size="lg">
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

// ─── SCREEN 7: Lesson ────────────────────────────────────
const lessonLines = [
  "Welcome to today's lesson! Today we're covering the Laws of Motion. Ready?",
  "Newton's First Law: An object at rest stays at rest unless acted upon by a force.",
  "Newton's Second Law: Force = Mass × Acceleration. F = ma!",
  "Newton's Third Law: Every action has an equal and opposite reaction!",
  "Now let's test your knowledge with a quick question...",
];
const LessonScreen = ({ next }: { next: () => void }) => {
  const [lineIdx, setLineIdx] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const options = ['F = ma', 'E = mc²', 'P = mv', 'a = v/t'];
  const correct = 'F = ma';
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

        {lineIdx >= lessonLines.length - 1 && (
          <div className="w-full max-w-2xl">
            <div className="border-4 border-black p-4 mb-4" style={{ background: '#1a0a2e' }}>
              <p className="font-pixel text-xs mb-4" style={{ color: '#ffe94a', textShadow: '2px 2px 0 #000' }}>
                ❓ Which formula represents Newton's 2nd Law?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {options.map(opt => (
                  <PixelButton key={opt} onClick={() => setAnswered(opt)}
                    color={!answered ? '#5b3a8e' : opt === correct ? '#4aff91' : opt === answered ? '#ff3355' : '#5b3a8e'}
                    size="md" className="w-full">
                    {opt}
                  </PixelButton>
                ))}
              </div>
            </div>
            {answered && (
              <div className="flex items-center gap-4">
                <MascotWizard mood={answered === correct ? 'celebrate' : 'thinking'} size={0.8} />
                <div className="flex-1 border-4 border-black bg-white p-3">
                  <p className="font-body text-sm text-gray-900">
                    {answered === correct ? '🎉 Correct! F = ma is Newton\'s Second Law. +50 XP!' : `❌ Not quite! The correct answer is F = ma. Keep going!`}
                  </p>
                </div>
              </div>
            )}
            {answered && (
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

// ─── SCREEN 8: Progress ──────────────────────────────────
const ProgressScreen = ({ next }: { next: () => void }) => {
  const stats = [
    { label: 'STREAK',   value: '🔥 7 Days', color: '#ff8c1a' },
    { label: 'XP TODAY', value: '⭐ 340',    color: '#ffe94a' },
    { label: 'COINS',    value: '🪙 82',      color: '#4aff91' },
    { label: 'ACCURACY', value: '🎯 84%',     color: '#00ffee' },
  ];
  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #2a1050, #3d1f6e)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 96, overflowY: 'auto' }}>
      <h1 className="font-pixel text-center mb-6" style={{ fontSize: 'clamp(0.9rem,2.5vw,1.3rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>
        📊 YOUR PROGRESS
      </h1>
      <div className="grid grid-cols-2 gap-4 w-full max-w-md px-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="border-4 border-black p-4 flex flex-col items-center gap-2"
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
      <div className="flex items-end gap-4 w-full max-w-md px-4 mb-8">
        <MascotWizard mood="thinking" size={1.1} />
        <div className="flex-1">
          <DialogueBox speaker="PIXEL TIP" text="You're on a 7-day streak! Keep going and you'll earn the PHOENIX badge. Study for 20 more minutes today!" />
        </div>
      </div>
      <PixelButton onClick={next} color="#ff00cc" size="lg">CONTINUE ▶</PixelButton>
    </div>
  );
};

// ─── SCREEN 9: Session Complete ──────────────────────────
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

// ─── SCREEN 10: Reward ───────────────────────────────────
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
        <PixelButton onClick={() => goTo('lesson')}    color="#4aff91" textColor="#000" size="md">▶ NEXT LESSON</PixelButton>
        <PixelButton onClick={() => goTo('leaderboard')} color="#ffe94a" textColor="#000" size="md">🏆 LEADERBOARD</PixelButton>
      </div>
    </div>
  </div>
);

// ─── SCREEN 11: FREE QUEST (Ask Anything) ────────────────
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
      if (i < text.length) {
        setResponse(text.slice(0, ++i));
      } else {
        clearInterval(iv);
        setLoading(false);
        setRobotMood('celebrating');
        setHistory(h => [...h, { q: question, a: text }]);
        setTimeout(() => setRobotMood('idle'), 3000);
      }
    }, 25);
  }, [selectedTag, setRobotMood]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    simulateStream(input.trim());
    setInput('');
  };

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #2a1050)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => goTo('mainmenu')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>◀ BACK</button>
        <h1 className="font-pixel text-center" style={{ fontSize: 'clamp(0.9rem,3vw,1.4rem)', color: '#ffe94a', textShadow: '3px 3px 0 #000' }}>
          ✨ FREE QUEST
        </h1>
      </div>

      <div className="w-full max-w-2xl px-4 flex flex-col gap-5">
        {/* Quest tags */}
        <div>
          <p className="font-pixel text-xs mb-3" style={{ color: '#00ffee' }}>SELECT QUEST TYPE:</p>
          <div className="flex flex-wrap gap-2">
            {questTags.map(t => (
              <button
                key={t.label}
                onClick={() => setSelectedTag(selectedTag === t.label ? null : t.label)}
                className="pixel-btn font-pixel text-xs border-2 border-black px-3 py-1"
                style={{
                  background: selectedTag === t.label ? t.color : '#3d1f6e',
                  color: selectedTag === t.label ? '#000' : '#fff',
                  boxShadow: selectedTag === t.label ? '0 0 0 #000' : '3px 3px 0 #000',
                  transform: selectedTag === t.label ? 'translate(3px,3px)' : 'none',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Parchment / terminal input panel */}
        <div className="border-4 border-black" style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          boxShadow: '6px 6px 0 #000',
        }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-black" style={{ background: '#0f0f1a' }}>
            <div className="w-3 h-3 rounded-full" style={{ background: '#ff3355', border: '2px solid #000' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#ffe94a', border: '2px solid #000' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#4aff91', border: '2px solid #000' }} />
            <span className="font-pixel text-xs ml-2" style={{ color: '#00ffee' }}>QUEST_INPUT.exe</span>
          </div>
          <div className="p-4">
            <p className="font-pixel text-xs mb-2" style={{ color: '#4aff91' }}>{'>'} TYPE YOUR QUEST:</p>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                rows={3}
                placeholder="e.g. Why is the sky blue? What is algebra? Explain DNA..."
                className="w-full bg-transparent font-body text-sm p-2 outline-none resize-none"
                style={{
                  border: '2px solid #00ffee',
                  color: '#f0e8ff',
                  caretColor: '#00ffee',
                  boxShadow: '0 0 8px #00ffee44',
                }}
              />
              <span className="absolute bottom-3 right-3 text-xs" style={{ color: '#00ffee', animation: 'blink 1s step-end infinite' }}>▌</span>
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="font-pixel text-xs" style={{ color: '#555' }}>ENTER to cast • SHIFT+ENTER for newline</span>
              <PixelButton
                onClick={handleSubmit}
                color={loading ? '#555' : '#ff00cc'}
                size="sm"
                glow={!loading}
              >
                {loading ? '⏳ CASTING...' : '🔮 CAST SPELL'}
              </PixelButton>
            </div>
          </div>
        </div>

        {/* Response dialogue box */}
        {(response || loading) && (
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <MascotWizard mood={loading ? 'thinking' : 'idle'} size={1.0} />
              {loading && <div className="text-center mt-1" style={{ animation: 'wiggle 0.4s linear infinite', fontSize: 20 }}>⚙️</div>}
            </div>
            <div className="flex-1">
              <div className="bg-white border-4 border-black p-4" style={{ boxShadow: '6px 6px 0 #000' }}>
                <p className="font-pixel text-xs mb-2 pb-1" style={{ color: '#5b3a8e', borderBottom: '2px solid #eee' }}>
                  PIXEL — AI TUTOR
                </p>
                <p className="font-body text-sm text-gray-900 leading-relaxed">
                  {response}
                  {loading && <span style={{ animation: 'blink 1s step-end infinite' }}>▌</span>}
                </p>
              </div>
              <div className="absolute top-5" style={{ left: -12, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '12px solid #000' }} />
            </div>
          </div>
        )}

        {/* History */}
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

// ─── SCREEN 12: Leaderboard ──────────────────────────────
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
const myRank = { rank: 23, name: 'YOU', xp: 1240, streak: 7, badge: '🔥', avatar: '🧙' };

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

const LeaderboardScreen = ({ goTo }: { goTo: (s: Screen) => void }) => {
  const [filter, setFilter] = useState<'week' | 'alltime' | 'friends'>('alltime');
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTickerIdx(i => (i + 1) % tickerMessages.length), 3000);
    return () => clearInterval(iv);
  }, []);

  const filters: { key: typeof filter; label: string; color: string }[] = [
    { key: 'week',    label: '7 DAYS',   color: '#00ffee' },
    { key: 'alltime', label: 'ALL TIME', color: '#ff00cc' },
    { key: 'friends', label: 'FRIENDS',  color: '#4aff91' },
  ];

  return (
    <div className="game-screen scanlines" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #2a1050)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, paddingBottom: 40, overflowY: 'auto' }}>
      {/* Ticker marquee */}
      <div className="w-full border-b-4 border-black mb-6 overflow-hidden" style={{ background: '#1a0a2e', padding: '6px 0' }}>
        <div style={{ animation: 'cloudmove 8s linear infinite', whiteSpace: 'nowrap', display: 'inline-block' }}>
          {[...tickerMessages, ...tickerMessages].map((m, i) => (
            <span key={i} className="font-pixel text-xs mx-8" style={{ color: i % 2 === 0 ? '#ffe94a' : '#ff4fa3' }}>★ {m}</span>
          ))}
        </div>
      </div>

      {/* Back + Title */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => goTo('mainmenu')} className="font-pixel text-xs" style={{ color: '#ff4fa3', background: 'none', border: 'none', cursor: 'pointer' }}>◀ BACK</button>
        <h1 className="font-pixel text-center" style={{ fontSize: 'clamp(0.9rem,3vw,1.4rem)', color: '#ffe94a', textShadow: '4px 4px 0 #000' }}>
          🏆 TOP SCHOLARS 🏆
        </h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-3 mb-6">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="pixel-btn font-pixel text-xs border-3 border-black px-4 py-2"
            style={{
              border: '3px solid #000',
              background: filter === f.key ? f.color : '#3d1f6e',
              color: filter === f.key ? '#000' : '#fff',
              boxShadow: filter === f.key ? '0 0 0 #000' : '4px 4px 0 #000',
              transform: filter === f.key ? 'translate(4px,4px)' : 'none',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div className="w-full max-w-lg px-4 flex flex-col gap-2">
        {/* Header */}
        <div className="grid grid-cols-12 gap-1 font-pixel text-xs mb-2 px-2" style={{ color: '#00ffee' }}>
          <span className="col-span-1">#</span>
          <span className="col-span-1"></span>
          <span className="col-span-4">NAME</span>
          <span className="col-span-3 text-right">XP</span>
          <span className="col-span-2 text-right">🔥</span>
          <span className="col-span-1 text-right"></span>
        </div>

        {leaderData.map((p) => {
          const trophy = trophyColors[p.rank];
          return (
            <div key={p.rank}
              className="grid grid-cols-12 gap-1 items-center border-4 border-black px-2 py-2"
              style={{
                background: trophy ? trophy.bg + '33' : '#3d1f6e',
                boxShadow: trophy ? `4px 4px 0 #000, 0 0 16px ${trophy.glow}` : '3px 3px 0 #000',
                border: trophy ? `4px solid ${trophy.bg}` : '4px solid #000',
              }}>
              {/* Rank */}
              <div className="col-span-1 font-pixel text-xs text-center" style={{ color: trophy ? trophy.bg : '#aaa' }}>
                {trophy ? trophy.icon : p.rank}
              </div>
              {/* Avatar */}
              <div className="col-span-1 text-center text-xl"
                style={{ animation: trophy ? 'float 3s ease-in-out infinite' : 'none' }}>
                {p.avatar}
              </div>
              {/* Name */}
              <div className="col-span-4 font-pixel text-xs truncate" style={{ color: trophy ? '#ffe94a' : '#f0e8ff' }}>
                {p.name}
                {trophy && <span className="ml-1" style={{ color: trophy.bg }}>★</span>}
              </div>
              {/* XP */}
              <div className="col-span-3 font-pixel text-xs text-right" style={{ color: '#4aff91' }}>
                {p.xp.toLocaleString()}
              </div>
              {/* Streak */}
              <div className="col-span-2 font-pixel text-xs text-right" style={{ color: '#ff8c1a' }}>
                {p.streak}d
              </div>
              {/* Badge */}
              <div className="col-span-1 text-center text-sm">{p.badge}</div>
            </div>
          );
        })}

        {/* Separator */}
        <div className="flex items-center gap-2 my-2">
          <div className="flex-1 border-t-2 border-black border-dashed" />
          <span className="font-pixel text-xs" style={{ color: '#555' }}>• • •</span>
          <div className="flex-1 border-t-2 border-black border-dashed" />
        </div>

        {/* My rank pinned */}
        <div className="grid grid-cols-12 gap-1 items-center border-4 border-black px-2 py-2"
          style={{ background: '#ff00cc33', boxShadow: '4px 4px 0 #000, 0 0 16px #ff00cc44', borderColor: '#ff00cc' }}>
          <div className="col-span-1 font-pixel text-xs text-center" style={{ color: '#ff00cc' }}>{myRank.rank}</div>
          <div className="col-span-1 text-center text-xl">{myRank.avatar}</div>
          <div className="col-span-4 font-pixel text-xs" style={{ color: '#ffe94a' }}>
            {myRank.name} <span style={{ color: '#ff4fa3', animation: 'blink 1s step-end infinite' }}>◀</span>
          </div>
          <div className="col-span-3 font-pixel text-xs text-right" style={{ color: '#4aff91' }}>{myRank.xp.toLocaleString()}</div>
          <div className="col-span-2 font-pixel text-xs text-right" style={{ color: '#ff8c1a' }}>{myRank.streak}d</div>
          <div className="col-span-1 text-center text-sm">{myRank.badge}</div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 flex gap-4">
        <PixelButton onClick={() => goTo('lesson')} color="#ff00cc" size="md">▶ STUDY MORE</PixelButton>
        <PixelButton onClick={() => goTo('freequest')} color="#ffe94a" textColor="#000" size="md" glow>✨ FREE QUEST</PixelButton>
      </div>
    </div>
  );
};

// ─── App Router ──────────────────────────────────────────
const SCREEN_ORDER: Screen[] = [
  'landing','signin','mainmenu','welcome','avatarselect',
  'howitworks','lesson','progress','sessioncomplete','reward',
];

export default function App() {
  const [screen, setScreen]   = useState<Screen>('landing');
  const [coins]               = useState(82);
  const [xp]                  = useState(70);
  const [robotMood, setRobotMood] = useState<RobotMood>('idle');

  const next = () => {
    const idx = SCREEN_ORDER.indexOf(screen);
    if (idx >= 0 && idx < SCREEN_ORDER.length - 1) setScreen(SCREEN_ORDER[idx + 1]);
  };
  const goTo = (s: Screen) => setScreen(s);

  const showHud = !['landing', 'signin'].includes(screen);

  return (
    <div style={{ minHeight: '100vh', background: '#1a0a2e' }}>
      {showHud && <HUD coins={coins} level={3} xp={xp} goTo={goTo} />}

      <div style={{ paddingTop: showHud ? 48 : 0 }}>
        {screen === 'landing'         && <LandingScreen next={next} />}
        {screen === 'signin'          && <SignInScreen next={next} back={() => setScreen('landing')} />}
        {screen === 'mainmenu'        && <MainMenuScreen goTo={goTo} />}
        {screen === 'welcome'         && <WelcomeScreen next={next} />}
        {screen === 'avatarselect'    && <AvatarScreen next={next} />}
        {screen === 'howitworks'      && <HowItWorksScreen next={next} />}
        {screen === 'lesson'          && <LessonScreen next={next} />}
        {screen === 'progress'        && <ProgressScreen next={next} />}
        {screen === 'sessioncomplete' && <SessionCompleteScreen next={next} />}
        {screen === 'reward'          && <RewardScreen goTo={goTo} />}
        {screen === 'freequest'       && <FreeQuestScreen goTo={goTo} setRobotMood={setRobotMood} />}
        {screen === 'leaderboard'     && <LeaderboardScreen goTo={goTo} />}
      </div>

      {/* Global persistent robot mascot */}
      <RobotMascot screen={screen} />
    </div>
  );
}
