#!/usr/bin/env python3
"""
캐릭터 이미지 최적화: image-asset/*.png (AI 생성 원본, 1024px) →
public/characters/*.jpg (512px, 품질 85, progressive).

원본 PNG는 전부 불투명(알파 미사용)이므로 RGB JPEG로 변환해도 화질 손실 외 시각 차이 없음.
이미지는 패널에서 80px(w-20 h-20) 정사각 박스에 object-cover로만 표시되므로 512px면 충분.

사용법:
    python3 scripts/optimize_characters.py

의존성: Pillow (pip install Pillow)
변환 후 코드 참조는 .jpg 확장자여야 함 (src/data/regionData.js, src/data/shipCharacters.js).
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
        out = os.path.join(OUT_DIR, f"{name}.jpg")
        im = Image.open(f).convert("RGB")
        if max(im.size) > MAX_SIZE:
            im.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)
        im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        total_in += os.path.getsize(f)
        total_out += os.path.getsize(out)

    print(f"변환 완료: {len(sources)}개")
    print(
        f"원본 {total_in / 1024 / 1024:.1f}MB → 출력 {total_out / 1024 / 1024:.2f}MB "
        f"({total_out / total_in * 100:.1f}%)"
    )


if __name__ == "__main__":
    main()
