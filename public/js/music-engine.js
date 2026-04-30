/**
 * music-engine.js
 * Tone.js 로 무한 앰비언트/아르페지오를 합성하는 엔진.
 *
 * 사용:
 *   const engine = new MusicEngine(params.music);
 *   await engine.start();   // 사용자 제스처 후 호출 (iOS 정책)
 *   engine.stop();
 */

import * as Tone from "https://esm.sh/tone@15";

export class MusicEngine {
  constructor(musicParams) {
    this.params = musicParams;
    this.started = false;
    this._nodes = [];
  }

  async start() {
    if (this.started) return;
    await Tone.start();
    this.started = true;

    const p = this.params;

    // 잔향 + 핑퐁 딜레이
    const reverb = new Tone.Reverb({ decay: 6, wet: p.reverb }).toDestination();
    const delay = new Tone.FeedbackDelay({
      delayTime: 60 / p.tempo,
      feedback: 0.35,
      wet: 0.25,
    }).connect(reverb);

    // 메인 신스 (악기 프리셋에 따라 다름)
    const synth = this._makeSynth(p.instrument).connect(delay);
    synth.volume.value = -8;

    // 베이스 패드 (낮은 옥타브, 부드러운 sine)
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 1, sustain: 0.6, release: 4 },
    }).connect(reverb);
    pad.volume.value = -16;

    this._nodes.push(reverb, delay, synth, pad);

    // 키 → root 주파수
    const rootMidi = 48 + p.keyIndex; // C3 부근
    const arpMidis = p.arp.map((stepIdx, i) => {
      const oct = i % p.octaveSpread;
      return rootMidi + p.scale[stepIdx] + oct * 12 + 12; // 한 옥타브 위
    });
    const padMidis = [
      rootMidi - 12,
      rootMidi - 12 + p.scale[2],
      rootMidi - 12 + p.scale[4],
    ];

    // 아르페지오 시퀀스
    const arpFreqs = arpMidis.map(m => Tone.Frequency(m, "midi").toFrequency());
    const arpStep = (60 / p.tempo) / 2; // 8분음표

    let stepIndex = 0;
    this._arpLoop = new Tone.Loop((time) => {
      const f = arpFreqs[stepIndex % arpFreqs.length];
      synth.triggerAttackRelease(f, arpStep * 0.9, time);
      stepIndex++;
    }, arpStep).start(0);

    // 패드: 4마디마다 코드 한 번
    this._padLoop = new Tone.Loop((time) => {
      const freqs = padMidis.map(m => Tone.Frequency(m, "midi").toFrequency());
      pad.triggerAttackRelease(freqs, "2n", time);
    }, "1m").start(0);

    Tone.Transport.bpm.value = p.tempo;
    Tone.Transport.start();

    // 부드러운 페이드 인
    Tone.Destination.volume.value = -60;
    Tone.Destination.volume.rampTo(0, 2);
  }

  _makeSynth(name) {
    switch (name) {
      case "amSynth":   return new Tone.PolySynth(Tone.AMSynth);
      case "fmSynth":   return new Tone.PolySynth(Tone.FMSynth);
      case "polySynth": return new Tone.PolySynth(Tone.Synth);
      case "membrane":  return new Tone.PolySynth(Tone.MembraneSynth);
      case "metal":     return new Tone.PolySynth(Tone.MetalSynth);
      case "pluck":     return new Tone.PluckSynth();
      case "duo":       return new Tone.PolySynth(Tone.DuoSynth);
      default:          return new Tone.PolySynth(Tone.Synth);
    }
  }

  async stop() {
    if (!this.started) return;
    Tone.Destination.volume.rampTo(-60, 1);
    await new Promise(r => setTimeout(r, 1100));
    if (this._arpLoop) this._arpLoop.stop();
    if (this._padLoop) this._padLoop.stop();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    for (const n of this._nodes) {
      try { n.dispose(); } catch {}
    }
    this._nodes = [];
    this.started = false;
  }
}
