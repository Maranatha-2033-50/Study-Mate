"""
한국사능력검정시험 기출문제 PDF 크롤러
대상: https://www.historyexam.go.kr/pst/list.do?bbs=dat
저장: 프로젝트 루트 /raw_data/hanneunggeom/

URL 패턴:
  목록: GET  /pst/list.do?bbs=dat&pageIndex=N
  상세: POST /pst/view.do?bbs=dat   body: pst_sno=<id>
  다운: GET  /atchFile/FileDown.do?atch_file_id=<B_...>
"""

import sys
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "https://www.historyexam.go.kr"
LIST_URL = f"{BASE_URL}/pst/list.do"
VIEW_URL = f"{BASE_URL}/pst/view.do"
DOWN_URL = f"{BASE_URL}/atchFile/FileDown.do"

SAVE_DIR = Path(__file__).parent.parent / "raw_data" / "hanneunggeom"
SAVE_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": f"{BASE_URL}/pst/list.do?bbs=dat",
}

sess = requests.Session()
sess.headers.update(HEADERS)


def init_session():
    """쿠키 획득을 위한 초기 GET."""
    sess.get(LIST_URL, params={"bbs": "dat"}, timeout=20)


def fetch_list_page(page: int) -> BeautifulSoup:
    resp = sess.get(
        LIST_URL,
        params={"bbs": "dat", "pageIndex": page},
        timeout=20,
    )
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def parse_posts(soup: BeautifulSoup) -> list[dict]:
    """목록 테이블에서 게시글 ID와 제목 추출."""
    posts = []
    table = soup.find("table", class_="tabtop")
    if not table:
        return posts
    for row in table.find_all("tr")[1:]:  # 헤더 행 제외
        cells = row.find_all("td")
        if not cells:
            continue
        title_cell = cells[1] if len(cells) > 1 else cells[0]
        a_tag = title_cell.find("a", onclick=True)
        if not a_tag:
            continue
        title = a_tag.get_text(strip=True)
        onclick = a_tag.get("onclick", "")
        m = re.search(r"fn_goDetail\('([^']+)'", onclick)
        if not m:
            continue
        posts.append({"id": m.group(1), "title": title})
    return posts


def fetch_detail_files(post_id: str) -> list[dict]:
    """상세 페이지 POST로 파일 ID + 파일명 추출."""
    resp = sess.post(
        VIEW_URL,
        params={"bbs": "dat"},
        data={"pst_sno": post_id, "pageIndex": "1"},
        timeout=20,
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    files = []
    # fnFileDownload('B_...') 패턴의 모든 링크
    for a in soup.find_all("a", onclick=re.compile(r"fnFileDownload")):
        onclick = a.get("onclick", "")
        m = re.search(r"fnFileDownload\('([^']+)'\)", onclick)
        if not m:
            continue
        file_id = m.group(1)
        label = a.get_text(strip=True).replace("\xa0", "").strip()
        files.append({"file_id": file_id, "label": label})
    return files


def safe_name(text: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", text).strip()[:120]


def download(file_id: str, save_path: Path) -> bool:
    if save_path.exists():
        print(f"    [SKIP] {save_path.name}")
        return False
    try:
        resp = sess.get(DOWN_URL, params={"atch_file_id": file_id}, timeout=60, stream=True)
        resp.raise_for_status()
        ct = resp.headers.get("Content-Type", "")
        if "html" in ct:
            print(f"    [FAIL] HTML 응답 (로그인 필요?): {file_id}")
            return False
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        size_kb = save_path.stat().st_size // 1024
        print(f"    [OK] {save_path.name} ({size_kb} KB)")
        return True
    except Exception as e:
        print(f"    [FAIL] {file_id}: {e}")
        save_path.unlink(missing_ok=True)
        return False


def get_total_pages(soup: BeautifulSoup) -> int:
    """페이지네이션 파싱."""
    max_page = 1
    for a in soup.find_all("a", onclick=re.compile(r"fn_goList|pageIndex")):
        onclick = a.get("onclick", "")
        m = re.search(r"['\"](\d+)['\"]", onclick)
        if m:
            max_page = max(max_page, int(m.group(1)))
    # 페이지 입력 form 의 hidden 값도 확인
    for inp in soup.find_all("input", {"name": "totalPageCount"}):
        val = inp.get("value", "")
        if val.isdigit():
            max_page = max(max_page, int(val))
    return max_page


def main():
    print("=" * 60)
    print("한국사능력검정시험 기출문제 PDF 크롤러")
    print(f"저장 위치: {SAVE_DIR}")
    print("=" * 60)

    init_session()

    soup_p1 = fetch_list_page(1)
    total_pages = get_total_pages(soup_p1)
    all_posts = parse_posts(soup_p1)
    print(f"\n1페이지 게시글: {len(all_posts)}건")

    for page in range(2, total_pages + 1):
        time.sleep(0.5)
        soup = fetch_list_page(page)
        posts = parse_posts(soup)
        all_posts.extend(posts)
        print(f"{page}페이지 게시글: {len(posts)}건")

    print(f"\n총 {len(all_posts)}개 게시글 발견\n")

    downloaded = skipped = failed = 0

    for post in all_posts:
        title = post["title"]
        post_id = post["id"]
        print(f"\n[{post_id}] {title}")

        try:
            files = fetch_detail_files(post_id)
        except Exception as e:
            print(f"  상세 페이지 오류: {e}")
            failed += 1
            continue

        if not files:
            print("  첨부 파일 없음")
            continue

        for f in files:
            label = f["label"] or title
            # 라벨이 이미 .pdf 포함한 경우 그대로, 아니면 .pdf 추가
            if not label.lower().endswith(".pdf"):
                fname = safe_name(label) + ".pdf"
            else:
                fname = safe_name(label)
            save_path = SAVE_DIR / fname
            ok = download(f["file_id"], save_path)
            if ok:
                downloaded += 1
            elif save_path.exists():
                skipped += 1
            else:
                failed += 1

        time.sleep(0.8)

    print("\n" + "=" * 60)
    print(f"완료: 다운로드 {downloaded}건 / 스킵 {skipped}건 / 실패 {failed}건")
    print(f"저장 위치: {SAVE_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
