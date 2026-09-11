import { describe, it, expect } from "vitest";
import { pickNew, youtubeUrl, cleanTitle, hashtagsFor, caption } from "../pipeline/lib/distribute.mjs";

describe("pickNew", () => {
  const list = [
    { video_id: "a", privacy: "public", title: "A" },
    { video_id: "b", privacy: "private", title: "B" },
    { video_id: "c", privacy: "public", title: "C" },
    { video_id: "d", privacy: "public", title: "D" },
  ];
  it("solo públicos, con id, no repostados; respeta el máximo", () => {
    const r = pickNew(list, ["a"], 5);
    expect(r.map((v) => v.video_id)).toEqual(["c", "d"]); // a ya hecho, b privado
  });
  it("cap por max", () => {
    expect(pickNew(list, [], 1).length).toBe(1);
  });
});

describe("youtubeUrl", () => {
  it("short -> /shorts/", () => expect(youtubeUrl({ video_id: "x", format: "short" })).toBe("https://www.youtube.com/shorts/x"));
  it("largo -> /watch", () => expect(youtubeUrl({ video_id: "x", seconds: 600 })).toBe("https://www.youtube.com/watch?v=x"));
});

describe("cleanTitle / hashtagsFor", () => {
  it("quita hashtags y acota", () => expect(cleanTitle("Cute cats #Shorts #asmr")).toBe("Cute cats"));
  it("hashtags por nicho", () => {
    expect(hashtagsFor({ niche_label: "Animales tiernos" }, "auto2")).toMatch(/animals/);
    expect(hashtagsFor({}, "data-lens")).toMatch(/history/);
  });
});

describe("caption", () => {
  it("arma título + url + hashtags", () => {
    const c = caption({ video_id: "z", title: "Wow #shorts", format: "short", niche_label: "satisfying" }, "auto2");
    expect(c).toMatch(/Wow/);
    expect(c).toMatch(/youtube.com\/shorts\/z/);
    expect(c).toMatch(/#satisfying/);
  });
});
