import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { setupBindings, teardownBindings } from "./helpers/bindings";

before(setupBindings);
after(teardownBindings);

const FILE_URL = "/media/video/123e4567-e89b-12d3-a456-426614174000.mp4";

test("업로드한 영상 파일은 file 링크로만 유효하다", async () => {
  const { readMemberWorkForm, validateWork } = await import("../src/lib/content/form");
  const fd = new FormData();
  for (const [key, value] of Object.entries({ purpose: "other", type: "video", title: "내가 만든 영상", summary: "직접 올린 영상 작품", link_url: FILE_URL })) fd.set(key, value);
  const values = readMemberWorkForm(fd, "Teacher");
  assert.equal(values.links[0].kind, "file");
  assert.ok(validateWork(values).data);

  assert.ok("errors" in validateWork({ ...values, links: [{ kind: "open", url: FILE_URL }] }));
  assert.ok("errors" in validateWork({ ...values, links: [{ kind: "file", url: "https://youtu.be/abc" }] }));
});

test("영상 스트림은 형식을 확인해 저장하고, 지우면 파일도 사라진다", async () => {
  const { deleteVideo, saveVideo, UploadError, VIDEO_KEY } = await import("../src/lib/uploads");
  const { getUploads } = await import("../src/lib/db");
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(20)]);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(mp4));
      controller.close();
    },
  });
  const saved = await saveVideo(stream);
  assert.match(saved.url, /^\/media\/video\/[0-9a-f-]{36}\.mp4$/);
  assert.equal(saved.size, mp4.length);
  const file = saved.url.split("/").pop()!;
  const stored = await getUploads().get(VIDEO_KEY(file));
  assert.deepEqual(Buffer.from(await stored!.arrayBuffer()), mp4);
  await deleteVideo(saved.url);
  assert.equal(await getUploads().get(VIDEO_KEY(file)), null);

  const bogus = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("not a video at all"));
      controller.close();
    },
  });
  await assert.rejects(saveVideo(bogus), UploadError);
});

test("큰 영상은 멀티파트로 올리고 크기와 내용이 그대로 저장된다", async () => {
  const { deleteVideo, saveVideo, VIDEO_KEY } = await import("../src/lib/uploads");
  const { getUploads } = await import("../src/lib/db");
  const size = 20 * 1024 * 1024 + 123;
  const bytes = new Uint8Array(size);
  bytes.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  for (let i = 12; i < size; i += 4096) bytes[i] = i % 251;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let at = 0; at < size; at += 1024 * 1024) controller.enqueue(bytes.subarray(at, Math.min(size, at + 1024 * 1024)));
      controller.close();
    },
  });
  const saved = await saveVideo(stream);
  assert.equal(saved.size, size);
  const stored = await getUploads().get(VIDEO_KEY(saved.url.split("/").pop()!));
  assert.equal(stored?.size, size);
  assert.deepEqual(new Uint8Array(await stored!.arrayBuffer()), bytes);
  await deleteVideo(saved.url);
});
