import { useMemo, useState } from "react";
import "./EndingScene.css";

interface EndingSceneProps {
  title: string;
  imageSrc?: string;
  text: string;
  onDone: () => void;
  doneLabel?: string;
}

/** 원본 텍스트를 "한 줄씩" 넘겨 보여줄 단위로 나눈다 -- 스프레드시트의
 * word-wrap 줄바꿈은 data/endings.ts 추출 단계에서 이미 공백으로 합쳐졌고,
 * 여기 남은 \n은 대사 등 실제 단락 구분(진엔딩 텍스트)뿐이다. 문장은
 * 마침표/느낌표/물음표 뒤에서 끊는다 -- 정확한 국어 문장 분석기는 아니지만
 * "비주얼노벨처럼 한 줄씩 넘어가는" 연출에는 충분하다. */
function splitIntoLines(text: string): string[] {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const matches = para.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [para];
    for (const raw of matches) {
      const trimmed = raw.trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  return lines.length > 0 ? lines : [text];
}

/** 비주얼노벨풍 엔딩 재생 화면. 위쪽 큰 이미지(imageSrc가 없으면 자리만
 * 표시하는 플레이스홀더)와 아래쪽 텍스트박스로 구성되며, 텍스트를 문장
 * 단위로 한 줄씩 보여주고 "다음 >"으로 넘긴다. 마지막 줄에서 누르면
 * onDone. */
export function EndingScene({ title, imageSrc, text, onDone, doneLabel }: EndingSceneProps) {
  const lines = useMemo(() => splitIntoLines(text), [text]);
  const [index, setIndex] = useState(0);
  const isLast = index >= lines.length - 1;

  function advance() {
    if (isLast) {
      onDone();
      return;
    }
    setIndex((i) => Math.min(i + 1, lines.length - 1));
  }

  return (
    <div className="ending-scene">
      <div className="ending-scene__frame">
        <div
          className="ending-scene__image"
          onClick={advance}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") advance();
          }}
          role="button"
          tabIndex={0}
        >
          {imageSrc ? (
            <img src={imageSrc} alt={title} />
          ) : (
            <div className="ending-scene__image-placeholder">
              <span>{title}</span>
            </div>
          )}
        </div>
        <div className="ending-scene__textbox">
          <p className="ending-scene__title">{title}</p>
          <p className="ending-scene__line">{lines[index]}</p>
          <div className="ending-scene__controls">
            <span className="ending-scene__progress">
              {index + 1} / {lines.length}
            </span>
            <button type="button" className="ending-scene__next-btn" onClick={advance}>
              {isLast ? (doneLabel ?? "다음 >") : "다음 >"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
