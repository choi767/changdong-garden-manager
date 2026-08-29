# 창동 틀밭관리 V2.2 클라우드 전환 메모

## 목표

4명이 PC와 휴대폰에서 같은 데이터를 동시에 보는 Cloudflare Pages + Supabase 무료 플랜 기반 웹앱으로 전환한다.

## 무료 플랜을 오래 쓰기 위한 선택

- 앱 배포는 Cloudflare Pages 정적 호스팅을 사용한다.
- 업무 데이터는 Supabase `garden_snapshots` 테이블의 JSON 스냅샷 1개로 시작한다.
- 저장할 때 `revision`을 비교해서 다른 사용자가 먼저 저장한 경우 덮어쓰지 않는다.
- Supabase 환경변수가 없으면 기존 IndexedDB 로컬 모드로 계속 실행된다.
- 사진은 현재 앱에서 이미 긴 변 1600px 이하 JPEG와 썸네일로 압축한다. 무료 용량을 아끼려면 원본 사진 업로드는 피하고, 필요 없는 사진은 주기적으로 정리한다.

## 현재 무료 한도 참고

- Supabase Free: DB 500MB, Storage 1GB, Realtime peak connections 200, monthly messages 2M, free projects pause after 1 week inactivity.
- Cloudflare Pages Free: 500 builds/month, unlimited static requests/bandwidth, free plan file limit 20,000 files/site.

## Supabase 설정

1. Supabase에서 새 프로젝트를 만든다.
2. SQL Editor에서 `supabase-schema.sql` 내용을 실행한다.
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
- 사진이 가장 먼저 용량을 잡아먹는다. DB 500MB에 가까워지면 사진을 Supabase Storage 분리 구조로 2단계 개선한다.
- 동시에 같은 화면을 수정하다 충돌 메시지가 뜨면 새로고침 후 다시 저장한다.
