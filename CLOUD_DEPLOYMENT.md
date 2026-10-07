# 창동 틀밭관리 V2.5 클라우드 운영 메모

## 목표

4명이 PC와 휴대폰에서 같은 데이터를 동시에 보는 Cloudflare Pages + Supabase 무료 플랜 기반 웹앱으로 전환한다.

## 무료 플랜을 오래 쓰기 위한 선택

- 앱 배포는 Cloudflare Pages 정적 호스팅을 사용한다.
- 업무 데이터는 Supabase `garden_snapshots` 테이블에 두고 추가, 수정, 삭제한 항목만 `save_garden_changes_v3`로 전송한다.
- 사진, 썸네일, 식물 사진, 배치 이미지는 비공개 `garden-images` Storage 버킷에 별도로 저장한다. 같은 파일은 SHA-256 경로를 재사용한다.
- 저장할 때 `revision`을 비교해서 다른 사용자가 먼저 저장한 경우 덮어쓰지 않는다.
- Supabase 환경변수가 없으면 기존 IndexedDB 로컬 모드로 계속 실행된다.
- 사진은 현재 앱에서 이미 긴 변 1600px 이하 JPEG와 썸네일로 압축한다. 무료 용량을 아끼려면 원본 사진 업로드는 피하고, 필요 없는 사진은 주기적으로 정리한다.

## 현재 무료 한도 참고

- Supabase Free: DB 500MB, Storage 1GB, Realtime peak connections 200, monthly messages 2M, free projects pause after 1 week inactivity.
- Cloudflare Pages Free: 500 builds/month, unlimited static requests/bandwidth, free plan file limit 20,000 files/site.

## Supabase 설정

1. Supabase에서 새 프로젝트를 만든다.
2. SQL Editor에서 `supabase-schema.sql`을 실행하고 이어서 `supabase-storage.sql`을 실행한다. 기존 운영 서버에서는 새 SQL만 실행하면 된다. 서버 설정을 먼저 적용하고 V2.5 클라이언트를 배포한다.
3. Authentication > Users에서 사용할 4명 계정을 만든다.
4. Project Settings > API에서 Project URL과 anon public key를 확인한다.
5. 로컬 테스트용으로 `.env`를 만들고 아래 값을 채운다.

```powershell
Copy-Item .env.example .env
```

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_GARDEN_SNAPSHOT_ID=changdong-main
```

## 기존 로컬 데이터 이전

1. 기존 앱 설정 화면에서 JSON 백업을 내려받는다.
2. `.env`를 설정한 클라우드 모드 앱으로 접속한다.
3. 로그인 후 설정 화면에서 JSON 복원을 실행한다.
4. 다른 기기에서 로그인해 같은 데이터가 보이는지 확인한다.

## Cloudflare Pages 배포

1. GitHub 저장소에 현재 프로젝트를 올린다.
2. Cloudflare Pages에서 GitHub 저장소를 연결한다.
3. Build command: `pnpm run build`
4. Build output directory: `dist`
5. Environment variables에 `.env`와 같은 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GARDEN_SNAPSHOT_ID`를 등록한다.
6. 배포 후 4명 계정으로 로그인 테스트한다.

## 운영 주의

- 무료 Supabase 프로젝트는 1주일 미사용 시 멈출 수 있으니 주 1회 이상 접속한다.
- 기존 사진은 V2.5에서 처음 저장할 때 Storage로 옮긴다. 모든 사진 업로드가 성공한 뒤에만 DB의 사진 내용을 경로로 바꾼다. 실패하면 기존 DB 사진이 유지되고 재시도할 수 있다.
- 최초 이전이 끝난 후 구버전 클라이언트의 전체 덮어쓰기는 서버에서 거부한다. 모든 기기에서 앱을 새로고침한다.
- JSON 백업에는 실제 사진 데이터를 포함하므로 다른 기기에서 복원할 수 있다.
- 삭제한 사진 및 저장 실패로 연결되지 않은 업로드 파일은 Storage에 남겨 둔다. 공유 파일 및 저장 중인 파일을 잘못 지우지 않도록 자동 물리 삭제는 하지 않는다. 용량 정리가 필요하면 현재 스냅샷 참조와 진행 중 업로드를 확인한 뒤 별도로 정리한다.
- 앱 시작 시 모든 사진을 읽는 기존 화면 구조는 유지된다. 이번 개선은 저장 전송량을 줄이며, 사진이 아주 많아지면 화면별 사진 지연 로딩을 추가할 수 있다.
- 동시에 같은 화면을 수정하다 충돌 메시지가 뜨면 새로고침 후 다시 저장한다.
