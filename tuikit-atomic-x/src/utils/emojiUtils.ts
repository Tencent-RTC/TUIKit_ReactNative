import { emojiUrlMap, emojiBaseUrl, emojiNameMap } from '../constants/emoji';

const EMOJI_KEY_REGEX = /\[TUIEmoji_[^\]]+\]/g;
const TRAILING_PARTIAL_KEY_REGEX = /\[TUIEmoji_[^\]]*$/;

let emojiNameToKeyMap: Record<string, string> | null = null;

const getEmojiNameToKeyMap = (): Record<string, string> => {
  if (emojiNameToKeyMap) return emojiNameToKeyMap;
  const map: Record<string, string> = {};
  Object.keys(emojiNameMap).forEach((key) => {
    map[(emojiNameMap as Record<string, string>)[key] as string] = key;
  });
  emojiNameToKeyMap = map;
  return map;
};

export const transformEmojiKeyToName = (text: string): string => {
  if (!text) return '';
  return text.replace(EMOJI_KEY_REGEX, (match) => {
    const name = (emojiNameMap as Record<string, string>)[match];
    return name || match;
  });
};

export const transformEmojiNameToKey = (text: string): string => {
  if (!text) return '';
  const nameToKey = getEmojiNameToKeyMap();
  return text.replace(/\[[^[\]]+\]/g, (match) => nameToKey[match] || match);
};

export const hasEmoji = (text: string): boolean =>
  /\[TUIEmoji_[^\]]+\]/.test(text);

export const getEmojiUrl = (emojiKey: string): string | undefined => {
  const fileName = emojiUrlMap[emojiKey];
  return fileName ? emojiBaseUrl + fileName : undefined;
};

export interface TextSegment {
  type: 'text';
  text: string;
}

export interface EmojiSegment {
  type: 'emoji';
  src: string;
  key: string;
}

export type TextOrEmojiSegment = TextSegment | EmojiSegment;

export const parseTextToSegments = (input: string): TextOrEmojiSegment[] => {
  const segments: TextOrEmojiSegment[] = [];
  if (!input) return segments;

  const truncatedAt = input.search(TRAILING_PARTIAL_KEY_REGEX);
  const text = truncatedAt >= 0 ? input.substring(0, truncatedAt) : input;
  if (!text) return segments;

  const pushText = (plain: string): void => {
    if (!plain) return;
    const last = segments[segments.length - 1];
    if (last && last.type === 'text') {
      last.text += plain;
    } else {
      segments.push({ type: 'text', text: plain });
    }
  };

  const regex = new RegExp(EMOJI_KEY_REGEX.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushText(text.substring(lastIndex, match.index));
    }
    const key = match[0];
    const src = getEmojiUrl(key);
    if (src) {
      segments.push({ type: 'emoji', src, key });
    } else {
      pushText(key);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    pushText(text.substring(lastIndex));
  }
  return segments;
};
