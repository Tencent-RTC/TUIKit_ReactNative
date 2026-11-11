export interface InputSegment {
  type: 'text' | 'emoji';
  text?: string;
  src?: string;
}

export interface TextRun {
  type: 'text';
  text: string;
}

export interface EmojiRun {
  type: 'emoji';
  src: string;
}

export type LineRun = TextRun | EmojiRun;
export type MessageLine = LineRun[];

export interface WrapOptions {
  line0AvailPx: number;
  lineNAvailPx: number;
  emojiPx: number;
  measureCharPx: (ch: string) => number;
}

const toUnits = (segments: InputSegment[]): InputSegment[] => {
  const units: InputSegment[] = [];
  segments.forEach((seg) => {
    if (seg.type === 'emoji') {
      units.push(seg);
      return;
    }
    Array.from(seg.text || '').forEach((ch) =>
      units.push({ type: 'text', text: ch })
    );
  });
  return units;
};

export const wrapSegmentsIntoLines = (
  segments: InputSegment[],
  opts: WrapOptions
): MessageLine[] => {
  const { line0AvailPx, lineNAvailPx, emojiPx, measureCharPx } = opts;
  const lines: MessageLine[] = [];
  let current: MessageLine = [];
  lines.push(current);
  let lineIdx = 0;
  let used = 0;
  let avail = line0AvailPx;

  const pushRun = (seg: InputSegment) => {
    if (seg.type === 'emoji') {
      current.push({ type: 'emoji', src: seg.src || '' });
      return;
    }
    const last = current[current.length - 1];
    if (last && last.type === 'text') {
      last.text += seg.text || '';
    } else {
      current.push({ type: 'text', text: seg.text || '' });
    }
  };

  const newLine = () => {
    current = [];
    lines.push(current);
    lineIdx += 1;
    used = 0;
    avail = lineNAvailPx;
  };

  toUnits(segments).forEach((seg) => {
    const w = seg.type === 'emoji' ? emojiPx : measureCharPx(seg.text || '');
    if (used + w > avail) {
      const canGainByWrap = lineIdx === 0 && lineNAvailPx > avail;
      if (current.length > 0 || canGainByWrap) newLine();
    }
    pushRun(seg);
    used += w;
  });

  return lines;
};
