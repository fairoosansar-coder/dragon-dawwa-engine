#!/usr/bin/env python3
"""
Dragon Dawwa — Hadith Master Parser (Isnad vs. Matn Structural Separator)
Preserves 100% of original Arabic Tashkeel/diacritics while separating the
chain of narrators (Isnad) from the core prophetic statement (Matn), and splits
Tamil/Sinhala/English translations into companion attribution + core Matn.
"""

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

ARABIC_DIACRITIC_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")

ARABIC_BOUNDARY_PATTERNS = [
    re.compile(r"(?:قال|يقول)\s+(?=كان\s+(?:رسول\s+الله|النبي))"),
    re.compile(r"(?:قال|يقول)\s+(?=قال\s+(?:رسول\s+الله|النبي))"),
    re.compile(r"(?=(?:قال|يقول)\s+(?:رسول\s+الله|النبي))"),
    re.compile(r"(?=كان\s+(?:رسول\s+الله|النبي))"),
    re.compile(r"(?=ان\s+(?:رسول\s+الله|النبي))"),
    re.compile(r"(?=عن\s+(?:رسول\s+الله|النبي)[^،:]{0,60}(?:قال|يقول))"),
    re.compile(r"(?=سمعت\s+(?:رسول\s+الله|النبي))"),
    re.compile(r"(?=رايت\s+(?:رسول\s+الله|النبي))"),
]

TAMIL_BOUNDARY_PATTERNS = [
    re.compile(r"^(.*?கூறினார்கள்\s*[:\-–]\s*)(.+)$", re.DOTALL),
    re.compile(r"^(.*?அறிவிக்கிறார்கள்\s*[:\-–]\s*)(.+)$", re.DOTALL),
    re.compile(r"^(.*?அறிவித்தார்கள்\s*[:\-–]\s*)(.+)$", re.DOTALL),
    re.compile(r"^(.*?அறிவிப்பதாவது\s*[:\-–]\s*)(.+)$", re.DOTALL),
    re.compile(r"^(.*?கூறுவதை\s+நான்\s+கேட்டேன்\s*[:\-–]\s*)(.+)$", re.DOTALL),
    re.compile(r"^(.*?கேட்டேன்\s*[:\-–]\s*)(.+)$", re.DOTALL),
]


def _build_normalized_map(raw_arabic: str) -> Tuple[str, List[int]]:
    stripped_chars: List[str] = []
    raw_indices: List[int] = []
    for idx, ch in enumerate(raw_arabic):
        if ARABIC_DIACRITIC_RE.match(ch):
            continue
        norm = "ا" if ch in ("أ", "إ", "آ", "ٱ") else ch
        stripped_chars.append(norm)
        raw_indices.append(idx)
    return "".join(stripped_chars), raw_indices


def split_arabic_hadith(raw_arabic: str) -> Dict[str, str]:
    full = (raw_arabic or "").strip()
    if not full:
        return {"isnad": "", "matn": "", "full": ""}

    stripped, raw_indices = _build_normalized_map(full)
    if not stripped:
        return {"isnad": "", "matn": full, "full": full}

    best_start = -1
    for pattern in ARABIC_BOUNDARY_PATTERNS:
        match = pattern.search(stripped)
        if match and match.start() >= 12:
            offset = match.end() if match.group(0) else match.start()
            best_start = offset
            break

    if best_start <= 0 or best_start >= len(raw_indices):
        return {"isnad": "", "matn": full, "full": full}

    raw_split = raw_indices[best_start]
    isnad = re.sub(r"[\s،,:؛\-–—]+$", "", full[:raw_split]).strip()
    matn = re.sub(r"^[\s،,:؛\-–—]+", "", full[raw_split:]).strip()
    if not isnad or not matn:
        return {"isnad": "", "matn": full, "full": full}
    return {"isnad": isnad, "matn": matn, "full": full}


def split_tamil_translation(raw_tamil: str) -> Dict[str, str]:
    full = (raw_tamil or "").strip()
    if not full:
        return {"companion_attribution": "", "matn": "", "full": ""}

    for pattern in TAMIL_BOUNDARY_PATTERNS:
        match = pattern.match(full)
        if match:
            attribution = re.sub(r"[\s:\-–—]+$", "", match.group(1)).strip()
            matn = match.group(2).strip().strip('"“”\'')
            if attribution and matn:
                return {
                    "companion_attribution": attribution,
                    "matn": matn,
                    "full": full,
                }
    return {"companion_attribution": "", "matn": full, "full": full}


def process_record(record: Dict[str, Any]) -> Dict[str, Any]:
    arabic_raw = str(record.get("arabic") or "")
    text_raw = str(record.get("text") or record.get("tamil") or "")
    ar_seg = split_arabic_hadith(arabic_raw)
    tr_seg = split_tamil_translation(text_raw)
    out = dict(record)
    out["segmented"] = {
        "arabic": ar_seg,
        "translation": tr_seg,
        "audio_targets": {
            "elevenlabs_short": ar_seg["matn"] or ar_seg["full"],
            "elevenlabs_full": ar_seg["full"],
            "translation_short": tr_seg["matn"] or tr_seg["full"],
            "translation_full": tr_seg["full"],
        },
    }
    return out


def run_batch_json(input_path: str, output_path: str) -> int:
    data = json.loads(Path(input_path).read_text(encoding="utf-8"))
    if isinstance(data, list):
        processed = [process_record(item) for item in data]
        count = len(processed)
    elif isinstance(data, dict) and isinstance(data.get("items"), list):
        processed = dict(data)
        processed["items"] = [process_record(item) for item in data["items"]]
        count = len(processed["items"])
    else:
        processed = process_record(data)
        count = 1
    Path(output_path).write_text(
        json.dumps(processed, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return count


def _self_test_hadith_803() -> None:
    sample_ar = (
        "حَدَّثَنَا عَلِيُّ بْنُ مُحَمَّدٍ الطَّنَافِسِيُّ، حَدَّثَنَا أَبُو أُسَامَةَ، "
        "حَدَّثَنِي عَبْدُ الْحَمِيدِ بْنُ جَعْفَرٍ، حَدَّثَنِي مُحَمَّدُ بْنُ عَمْرِو بْنِ عَطَاءٍ، "
        "قَالَ سَمِعْتُ أَبَا حُمَيْدٍ السَّاعِدِيَّ، فِي عَشَرَةٍ مِنْ أَصْحَابِ النَّبِيِّ ـ صلى الله عليه وسلم ـ "
        "أَحَدُهُمْ أَبُو قَتَادَةَ بْنُ رِبْعِيٍّ يَقُولُ كَانَ رَسُولُ اللَّهِ ـ صلى الله عليه وسلم ـ "
        "إِذَا قَامَ إِلَى الصَّلَاةِ اعْتَدَلَ قَائِمًا وَرَفَعَ يَدَيْهِ حَتَّى يُحَاذِيَ بِهِمَا مَنْكِبَيْهِ"
    )
    sample_ta = (
        "அபூ ஹுமைத் அஸ்-ஸாஇதீ (ரலி) அவர்கள் நபித்தோழர்கள் பத்துப் பேருக்கு மத்தியில் கூறினார்கள்: "
        "\"அல்லாஹ்வின் தூதர் (ஸல்) அவர்கள் தொழுகைக்காக நின்றால் நேராக நிற்பார்கள்.\""
    )
    res = process_record({"number": 803, "arabic": sample_ar, "text": sample_ta})
    seg = res["segmented"]
    assert seg["arabic"]["isnad"].startswith("حَدَّثَنَا عَلِيُّ بْنُ مُحَمَّدٍ")
    assert seg["arabic"]["matn"].startswith("كَانَ رَسُولُ اللَّهِ")
    assert seg["translation"]["companion_attribution"].startswith("அபூ ஹுமைத்")
    assert seg["translation"]["matn"].startswith("அல்லாஹ்வின் தூதர்")
    print(json.dumps(seg, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) == 3:
        total = run_batch_json(sys.argv[1], sys.argv[2])
        print(f"Processed {total} hadith records -> {sys.argv[2]}")
    else:
        _self_test_hadith_803()
