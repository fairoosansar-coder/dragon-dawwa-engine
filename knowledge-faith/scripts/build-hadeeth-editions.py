"""Build an immutable seed from the two public editions matched against the supplied workbook."""
import csv
import hashlib
import io
import re
import sqlite3
import sys
from urllib.request import Request, urlopen

EDITIONS = {
    "ta": ("v1.36.0", 737, "bb2b5909bf1527e73eadc843c93c463b4ef2b8e8419deaee7da7a592cbd38c76"),
    "si": ("v1.24.0", 1318, "0dbcab98fe80a460901e46a98ee739a31914f35d107ab04edc8ab0d7be4ac471"),
}
fields = "title_ar title hadith_text_ar hadith_text explanation_ar explanation benefits_ar benefits grade_ar takhrij_ar grade takhrij link".split()
db = sqlite3.connect(sys.argv[1])
db.executescript("""
CREATE TABLE hadeeth(lang TEXT NOT NULL,id TEXT NOT NULL,source_version TEXT NOT NULL,source_updated TEXT NOT NULL,
source_file TEXT NOT NULL,title_ar TEXT,title TEXT NOT NULL,hadith_text_ar TEXT,hadith_text TEXT NOT NULL,
explanation_ar TEXT,explanation TEXT,benefits_ar TEXT,benefits TEXT,grade_ar TEXT,takhrij_ar TEXT,grade TEXT,
takhrij TEXT,link TEXT NOT NULL,PRIMARY KEY(lang,id));
CREATE TABLE import_meta(lang TEXT PRIMARY KEY,source_version TEXT NOT NULL,source_updated TEXT NOT NULL,
source_file TEXT NOT NULL,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,sheet_rows INTEGER NOT NULL,
data_rows INTEGER NOT NULL,empty_text INTEGER NOT NULL,imported_at TEXT NOT NULL);
CREATE TABLE source_notices(sheet TEXT PRIMARY KEY,banner TEXT NOT NULL);
""")
with db:
    for lang, (version, expected, sha) in EDITIONS.items():
        name = f"HadeethEnc.com_{lang}-{version}.csv"
        url = "https://hadeethenc.com/downloads/csv/" + name
        with urlopen(Request(url, headers={"User-Agent":"OpenPassage edition import"}), timeout=75) as response:
            raw = response.read(20_000_001)
        if hashlib.sha256(raw).hexdigest() != sha:
            raise ValueError(f"{lang}: publisher file checksum changed")
        # Excel stores in-cell line breaks as LF and missing optional cells as NULL.
        stream = io.StringIO(raw.decode("utf-8-sig"), newline=None)
        banner = next(csv.reader(stream))[0]
        date = re.search(r"Last update: ([\d: -]+) \((v[\d.]+)\)",banner)
        if not date or date[2] != version: raise ValueError("Edition banner mismatch")
        db.execute("INSERT INTO source_notices VALUES (?,?)", (lang,banner))
        count=total=0
        for row in csv.DictReader(stream):
            total+=1
            if not row["hadith_text"].strip(): continue
            if row["lang"]!=lang or not row["id"].isdigit() or row["link"]!=f"https://hadeethenc.com/{lang}/browse/hadith/{row['id']}":
                raise ValueError(f"{lang}: invalid source identity")
            db.execute("INSERT INTO hadeeth VALUES ("+",".join("?"*18)+")",
                [lang,row["id"],version,date[1],name]+[row[f] or None for f in fields])
            count+=1
        if count!=expected: raise ValueError(f"{lang}: unexpected row count")
        db.execute("INSERT INTO import_meta VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))",
                   (lang,version,date[1],name,sha,len(raw),total+2,count,total-count))
if db.execute("PRAGMA integrity_check").fetchone()!=("ok",): raise ValueError("Invalid database")
db.close()
