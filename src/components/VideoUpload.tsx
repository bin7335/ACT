"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_VIDEO_BYTES, MAX_VIDEO_MB, MAX_VIDEO_SOURCE_BYTES, MAX_VIDEO_SOURCE_MB } from "@/lib/video";
import { VIDEO_POSTER_FIELD } from "@/lib/video-poster";
import f from "./form.module.css";

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`);

/**
 * 영상 파일을 브라우저에서 필요한 만큼 압축한 뒤 /api/video로 스트림 업로드하고,
 * 돌려받은 내부 경로를 숨은 링크 값으로 넣는다.
 * 폼(서버 액션)은 6MB까지만 받으므로 파일 본문은 여기서 따로 보낸다.
 */
export function VideoUpload({ initialUrl = "", name = "link_url" }: { initialUrl?: string; name?: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [size, setSize] = useState<number | null>(null);
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  const [phase, setPhase] = useState<"compress" | "upload" | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const posterRef = useRef<HTMLInputElement | null>(null);
  const uid = useId();

  useEffect(
    () => () => {
      abortRef.current?.abort();
      xhrRef.current?.abort();
    },
    [],
  );

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    xhrRef.current?.abort();
    xhrRef.current = null;
    setPhase(null);
    setPoster(null);
  }

  /** 영상에서 뽑은 장면을 숨은 파일 필드에 담아 폼과 함께 보낸다. 대표 이미지를 따로 안 올렸을 때 서버가 쓴다. */
  function setPoster(file: File | null) {
    const input = posterRef.current;
    if (!input) return;
    try {
      const data = new DataTransfer();
      if (file) data.items.add(file);
      input.files = data.files;
    } catch {
      // 파일 필드를 채울 수 없는 브라우저에서는 자동 대표 이미지 없이 진행한다.
    }
  }

  async function start(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_VIDEO_SOURCE_BYTES) {
      setError(`영상 원본은 ${MAX_VIDEO_SOURCE_MB / 1024}GB 이하로 골라 주세요.`);
      return;
    }
    const abort = new AbortController();
    abortRef.current = abort;
    setProgress(0);
    setPhase("compress");
    try {
      const { compressVideo } = await import("@/lib/video-compress");
      const { blob, compressed } = await compressVideo(file, { signal: abort.signal, onProgress: setProgress });
      if (abort.signal.aborted) return;
      // 올리는 동안 대표 이미지로 쓸 장면을 뽑아 둔다. 실패해도 업로드는 그대로 간다.
      setPoster(null);
      void import("@/lib/video-poster").then(async ({ captureVideoPoster }) => {
        const poster = await captureVideoPoster(blob);
        if (!abort.signal.aborted) setPoster(poster);
      });
      upload(blob, compressed ? file.size : null);
    } catch (err) {
      if (abort.signal.aborted) return;
      abortRef.current = null;
      setPhase(null);
      if (err instanceof Error && err.name === "VideoCompressError") setError(err.message);
      else {
        console.error("video compression failed", err);
        setError(file.size <= MAX_VIDEO_BYTES ? "영상을 읽을 수 없어요. 다른 파일로 시도해 주세요." : `영상을 압축하지 못했어요. ${MAX_VIDEO_MB}MB 이하 MP4로 올려 주세요.`);
      }
    }
  }

  function upload(body: Blob, originalSize: number | null) {
    const done = () => {
      xhrRef.current = null;
      abortRef.current = null;
      setPhase(null);
    };
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/video");
    xhr.setRequestHeader("Content-Type", body.type || "application/octet-stream");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      done();
      let res: { url?: string; size?: number; error?: string } = {};
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        // 아래에서 실패로 처리한다.
      }
      if (xhr.status === 200 && res.url) {
        setUrl(res.url);
        setSize(res.size ?? body.size);
        setSavedFrom(originalSize);
      } else {
        setError(res.error ?? "영상을 올리지 못했어요.");
      }
    };
    xhr.onerror = () => {
      done();
      setError("영상을 올리지 못했어요. 연결을 확인해 주세요.");
    };
    xhr.onabort = done;
    setProgress(0);
    setPhase("upload");
    xhr.send(body);
  }

  return (
    <div className={f.videoUpload}>
      <input type="hidden" name={name} value={url} />
      <input ref={posterRef} type="file" name={VIDEO_POSTER_FIELD} hidden tabIndex={-1} aria-hidden="true" />
      {url ? (
        <div className={f.videoState}>
          <span className={f.videoName}>
            올린 영상{size ? ` · ${formatSize(size)}` : ""}
            {size && savedFrom ? ` (원본 ${formatSize(savedFrom)}에서 압축)` : ""}
          </span>
          <button
            type="button"
            className={f.iconBtn}
            aria-label="올린 영상 지우기"
            onClick={() => {
              setUrl("");
              setSize(null);
              setSavedFrom(null);
              setPoster(null);
            }}
          >
            ×
          </button>
        </div>
      ) : phase ? (
        <div className={f.videoState}>
          <span className={f.videoPhase}>{phase === "compress" ? "압축 중" : "올리는 중"}</span>
          <progress className={f.progress} value={progress} max={100} aria-label={phase === "compress" ? "영상 압축하는 중" : "영상 올리는 중"} />
          <span className="t-mono">{progress}%</span>
          <button type="button" className={f.iconBtn} aria-label="영상 올리기 취소" onClick={cancel}>
            ×
          </button>
        </div>
      ) : (
        <input
          id={`${uid}-video`}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          aria-label="영상 파일 올리기"
          className={f.file}
          onChange={(ev) => {
            void start(ev.target.files?.[0]);
            ev.target.value = "";
          }}
        />
      )}
      <p className={f.hint}>MP4·MOV·WebM 파일. {MAX_VIDEO_MB}MB를 넘으면 이 기기에서 자동으로 압축해서 올려요. 대표 이미지를 따로 올리지 않으면 영상의 한 장면을 씁니다. 끝날 때까지 창을 닫지 마세요.</p>
      {error && (
        <p className={f.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
