// Web Audio API로 직접 합성하는 효과음/배경음 엔진 -- 저장소에 오디오
// 파일이 전혀 없으므로(라이선스 문제 없이 즉시 동작하도록) 모든 소리를
// 오실레이터+게인 엔벨로프로 코드에서 만든다. 브라우저 자동재생 정책 때문에
// AudioContext는 반드시 사용자 제스처(클릭) 안에서 생성/재개해야 하므로,
// `unlock()`을 실제 클릭 핸들러(게임 시작 버튼 등) 안에서 호출한다.
import { loadAudioSettings, saveAudioSettings } from "../persistence/audioSettings";

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  /** Set for a pitch sweep (e.g. elimination's descending tone). */
  freqEnd?: number;
  attack?: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private bgmNextTime = 0;
  private bgmStep = 0;
  private muted: boolean;
  private volume: number;

  constructor() {
    const settings = loadAudioSettings();
    this.muted = settings.muted;
    this.volume = settings.volume;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    this.masterGain.connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.masterGain);
    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.value = 0.5;
    this.bgmGain.connect(this.masterGain);
    return ctx;
  }

  /** 반드시 실제 클릭 등 사용자 제스처 콜백 안에서 호출할 것 (자동재생
   * 정책으로 그 밖에서는 AudioContext가 suspended 상태로 남는다). */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    saveAudioSettings({ muted: this.muted, volume: this.volume });
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
    saveAudioSettings({ muted: this.muted, volume: this.volume });
  }

  private tone(opts: ToneOptions): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const { freq, duration, type = "sine", gain = 0.2, delay = 0, freqEnd, attack = 0.005 } = opts;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // ---- 효과음 팔레트 ----
  playClick(): void {
    this.tone({ freq: 900, duration: 0.05, type: "square", gain: 0.06 });
  }
  playCardPlay(): void {
    this.tone({ freq: 260, freqEnd: 150, duration: 0.12, type: "triangle", gain: 0.18 });
  }
  playTargetLock(): void {
    this.tone({ freq: 520, duration: 0.06, type: "sine", gain: 0.14 });
  }
  playGuessHit(): void {
    this.tone({ freq: 660, duration: 0.1, type: "triangle", gain: 0.18 });
    this.tone({ freq: 880, duration: 0.16, type: "triangle", gain: 0.2, delay: 0.09 });
    this.tone({ freq: 1108.73, duration: 0.22, type: "triangle", gain: 0.2, delay: 0.18 });
  }
  playGuessMiss(): void {
    this.tone({ freq: 180, freqEnd: 90, duration: 0.28, type: "sawtooth", gain: 0.12 });
  }
  playElimination(): void {
    this.tone({ freq: 320, freqEnd: 70, duration: 0.55, type: "sawtooth", gain: 0.18 });
  }
  playRoundWin(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ freq: f, duration: 0.22, type: "triangle", gain: 0.18, delay: i * 0.1 })
    );
  }
  playLetterGain(): void {
    [880, 1108.73, 1318.51].forEach((f, i) =>
      this.tone({ freq: f, duration: 0.14, type: "sine", gain: 0.13, delay: i * 0.06 })
    );
  }
  playStoryReveal(): void {
    this.tone({ freq: 220, freqEnd: 440, duration: 0.9, type: "sine", gain: 0.1, attack: 0.25 });
    this.tone({ freq: 330, freqEnd: 550, duration: 0.9, type: "sine", gain: 0.07, delay: 0.08, attack: 0.25 });
  }
  playBlocked(): void {
    this.tone({ freq: 150, duration: 0.15, type: "square", gain: 0.09 });
  }
  playSessionEnd(): void {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ freq: f, duration: 0.3, type: "sine", gain: 0.16, delay: i * 0.14 })
    );
  }

  // ---- 배경음: 부드러운 아르페지오 루프를 미리 스케줄링 ----
  startBgm(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain || this.bgmTimer !== null) return;
    const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
    const noteDuration = 1.1;
    this.bgmStep = 0;
    this.bgmNextTime = ctx.currentTime + 0.1;
    const scheduleAhead = () => {
      if (!this.ctx || !this.bgmGain) return;
      while (this.bgmNextTime < this.ctx.currentTime + 2) {
        const t0 = this.bgmNextTime;
        const freq = notes[this.bgmStep % notes.length];
        for (const [mult, peakGain, attack] of [
          [1, 0.16, 0.3],
          [0.5, 0.07, 0.4],
        ] as const) {
          const osc = this.ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = freq * mult;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(peakGain, t0 + attack);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + noteDuration);
          osc.connect(g);
          g.connect(this.bgmGain);
          osc.start(t0);
          osc.stop(t0 + noteDuration + 0.05);
        }
        this.bgmNextTime += noteDuration * 0.9;
        this.bgmStep += 1;
      }
    };
    scheduleAhead();
    this.bgmTimer = window.setInterval(scheduleAhead, 500);
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

let instance: SoundEngine | null = null;
export function getSoundEngine(): SoundEngine {
  if (!instance) instance = new SoundEngine();
  return instance;
}
