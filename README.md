# 창동 틀밭관리 프로그램 V2.3

창동 틀밭을 Zone, 틀, 관리그룹, 관리표 단위로 관리하는 클라우드 반응형 웹 애플리케이션입니다. V1.4 코드를 기반으로 시작해 V2.3에서 Supabase 동기화, 관리자 기능, 업데이트 감지, 사진 연결 기록, 식물DB 엑셀 백업/복원 기능을 포함합니다.

## 주요 기능

- Zone 1 틀 24개, Zone 2 틀 42개 초기 생성
- 틀 상태: `미경작 상태`, `경작 중`
- 같은 Zone의 미경작 틀로 관리그룹 생성
- 관리그룹 생성 시 관리표 자동 생성
- 관리 중 같은 Zone의 틀 추가 및 기존 틀 삭제
- 마지막 틀 삭제 방지
- 관리표당 작물 최대 3종 등록
- 작물 기본 DB 직접 등록/수정, 100개 제한 및 정규화 중복 방지
- 작업이력, Zone 일괄 작업 구조, 수확기록
- 종료된 관리표 보존 및 복원
- 과거 관리표 검색
- 틀 좌표 편집, JSON 백업/복원, 테스트 데이터 초기화

## 기술 스택

- React, TypeScript strict mode, Vite
- React Router
- Zustand
- IndexedDB 저장소 계층
- Vitest, React Testing Library
- 일반 CSS 반응형 UI

Dexie.js는 현재 로컬 의존성에 없어 네트워크 설치 없이 실행 가능하도록 IndexedDB 래퍼를 직접 구현했습니다. React 화면은 저장소 구현체를 직접 호출하지 않고 Repository 계층을 통해 접근하므로 이후 Dexie 또는 Supabase 저장소로 교체할 수 있습니다.

## 실행 방법

```powershell
cd "C:\Users\Administrator\Documents\창동 틀밭관리 프로그램"
npm install
npm run dev
```

Codex 번들 런타임으로 확인할 때는 상위 폴더의 기존 `node_modules`를 사용해 실행할 수 있습니다.

```powershell
npm run dev
```

## 테스트

```powershell
npm run test
```

현재 테스트는 초기 틀 개수, 같은 Zone 제약, 관리표 작물 3종 제한, 작물명 중복 방지, 그룹번호 증가, 마지막 틀 삭제 방지를 검증합니다.

## 빌드

```powershell
npm run build
```

## 데이터 저장 방식

업무 데이터는 브라우저 IndexedDB의 `changdong-garden-v1` 데이터베이스에 저장됩니다. localStorage는 주요 업무 데이터 저장소로 사용하지 않습니다.

## IndexedDB 초기화

설정 화면의 `테스트 데이터 초기화` 버튼을 누르면 Zone 1 24개, Zone 2 42개가 다시 생성됩니다. 작물 DB는 사용자가 직접 구축하도록 빈 상태로 초기화됩니다.

## 배경 이미지와 좌표

V2.3은 V1.4의 배치 이미지와 좌표 구조를 기반으로 합니다. 각 틀 좌표는 배경 기준 퍼센트 값으로 저장되며 관리자 설정에서 `positionX`, `positionY`, `width`, `height`, `rotation`을 직접 편집할 수 있습니다. 향후 실제 배치 이미지 파일이 제공되면 저장소에 배경 이미지를 넣고 기존 퍼센트 좌표를 유지하는 방식으로 교체할 수 있습니다.

## 백업과 복원

설정 화면에서 JSON 백업을 내려받고 JSON 복원을 수행할 수 있습니다. 백업에는 `schemaVersion`, `appVersion`, `exportedAt`, 전체 데이터 본문이 포함됩니다.

## 알려진 제한사항

- 사진은 기록별 연결과 확대 보기를 지원하지만, 무료 플랜 용량 관리를 위해 압축 저장을 기본으로 합니다.
- 배경 이미지는 실제 사진이 아니라 임시 배치도입니다.
- Dexie.js는 미설치 상태라 직접 IndexedDB 래퍼를 사용했습니다.
- 다중 사용자, 로그인, 권한, 실시간 동기화는 구현하지 않았습니다.

## 향후 Supabase 전환 계획

- `GardenRepository` 인터페이스 유지
- `IndexedDbGardenRepository`를 `SupabaseGardenRepository`로 교체
- Blob 이미지를 Supabase Storage로 이전
- UUID, createdAt, updatedAt 유지
- 서버 권한 정책과 충돌 처리 필드 추가
- 실시간 구독 및 optimistic concurrency 추가
