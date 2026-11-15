"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_VIDEO_BYTES, MAX_VIDEO_MB } from "@/lib/video";
import f from "./form.module.css";

/**
 * 영상 파일을 /api/video로 스트림 업로드하고, 돌려받은 내부 경로를 숨은 링크 값으로 넣는다.
 * 폼(서버 액션)은 6MB까지만 받으므로 파일 본문은 여기서 따로 보낸다.
 */
export function VideoUpload({ initialUrl = "", name = "link_url" }: { initialUrl?: string; name?: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [size, setSize] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const uid = useId();

  useEffect(() => () => xhrRef.current?.abort(), []);

  function cancel() {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setProgress(null);
  }

  function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`영상은 ${MAX_VIDEO_MB}MB 이하로 올려 주세요.`);
      return;
    }
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/video");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      xhrRef.current = null;
      setProgress(null);
      let res: { url?: string; size?: number; error?: string } = {};
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        // 아래에서 실패로 처리한다.
      }
      if (xhr.status === 200 && res.url) {
        setUrl(res.url);
        setSize(res.size ?? file.size);
      } else {
        setError(res.error ?? "영상을 올리지 못했어요.");
      }
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      setProgress(null);
      setError("영상을 올리지 못했어요. 연결을 확인해 주세요.");
    };
    xhr.onabort = () => {
      xhrRef.current = null;
      setProgress(null);
    };
    setProgress(0);
    xhr.send(file);
  }

  return (
    <div className={f.videoUpload}>
      <input type="hidden" name={name} value={url} />
      {url ? (
        <div className={f.videoState}>
          <span className={f.videoName}>
            올린 영상{size ? ` · ${size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))}KB` : `${(size / 1024 / 1024).toFixed(1)}MB`}` : ""}
          </span>
          <button
            type="button"
            className={f.iconBtn}
            aria-label="올린 영상 지우기"
            onClick={() => {
              setUrl("");
              setSize(null);
            }}
          >
            ×
          </button>
        </div>
      ) : progress !== null ? (
        <div className={f.videoState}>
          <progress className={f.progress} value={progress} max={100} aria-label="영상 올리는 중" />
          <span className="t-mono">{progress}%</span>
          <button type="button" className={f.iconBtn} aria-label="영상 올리기 취소" onClick={cancel}>
            ×
          </button>
        </div>
      ) : (
        <input
          id={`${uid}-video`}
          type="file"
          accept="video/mp4,video/webm"
          aria-label="영상 파일 올리기"
          className={f.file}
          onChange={(ev) => {
            upload(ev.target.files?.[0]);
            ev.target.value = "";
          }}
        />
      )}
      <p className={f.hint}>MP4·WebM 파일, {MAX_VIDEO_MB}MB 이하. 올리는 동안 창을 닫지 마세요.</p>
      {error && (
        <p className={f.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
