#!/usr/bin/env python3
"""
캐릭터 이미지 최적화: image-asset/*.png (AI 생성 원본, 1024px, 투명 배경 RGBA) →
public/characters/*.webp (512px, 품질 85, 알파 유지).

원본 PNG는 투명 배경(알파 채널 포함)이므로 알파를 보존하는 WebP로 변환한다.
(JPEG는 알파를 지원하지 않아 배경이 검게 채워지므로 사용하지 않는다.)
이미지는 패널 헤더의 정사각 박스에 표시되며, 투명 배경 덕에 인물만 떠 보인다.

사용법:
    python3 scripts/optimize_characters.py

의존성: Pillow (pip install Pillow, WebP 지원 필요)
변환 후 코드 참조는 .webp 확장자여야 함 (src/data/regionData.js, src/data/shipCharacters.js).
"""
import glob
import os

from PIL import Image

SRC_DIR = "image-asset"
OUT_DIR = "public/characters"
MAX_SIZE = 512
QUALITY = 85


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sources = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
    if not sources:
        print(f"원본 없음: {SRC_DIR}/*.png")
        return

    total_in = total_out = 0
    for f in sources:
        name = os.path.splitext(os.path.basename(f))[0]
        out = os.path.join(OUT_DIR, f"{name}.webp")
        im = Image.open(f).convert("RGBA")
        if max(im.size) > MAX_SIZE:
            im.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)
        im.save(out, "WEBP", quality=QUALITY, method=6)
        total_in += os.path.getsize(f)
        total_out += os.path.getsize(out)

    print(f"변환 완료: {len(sources)}개")
    print(
        f"원본 {total_in / 1024 / 1024:.1f}MB → 출력 {total_out / 1024 / 1024:.2f}MB "
        f"({total_out / total_in * 100:.1f}%)"
    )


if __name__ == "__main__":
    main()
