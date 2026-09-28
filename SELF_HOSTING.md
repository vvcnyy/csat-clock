# 셀프호스트 배포

구성: Caddy(정적 파일·HTTPS·access log) + Node 24(의견 전송 API).
`compose.yaml`로 실행합니다. GA4는 유지하고 Vercel Analytics는 제거했습니다.
Vercel의 `api/feedback.ts` 로직은 Node 서버에서 재사용합니다. `vercel.json`은
셀프호스트에서는 사용하지 않으며, 캐시 설정은 `deploy/Caddyfile`에 있습니다.

## 1. 서버 준비

Docker Engine과 Compose 플러그인이 필요합니다. 운영 도메인은 기존
`csat-clock.vvcnyy.me`를 유지하는 것을 전제로 합니다.
80/443 포트에 다른 웹서버가 있으면 먼저 포트/리버스 프록시 구성을 조정하세요.
기존 서버를 종료하거나 DNS를 바꾸기 전에 별도 포트에서 검증하세요.

`.env.example`을 참고해 서버에 `.env`를 만듭니다(커밋·이미지 빌드 대상 제외).

```dotenv
SITE_ADDRESS=csat-clock.vvcnyy.me
DEPLOY_ENV=production
VITE_GA_MEASUREMENT_ID=기존_GA4_측정_ID
VITE_AUDIO_UNLOCK_SCOPE=apple
VITE_AUDIO_DEBUG=false
VITE_SOUND_BASE_URL=/sound
DISCORD_FEEDBACK_WEBHOOK_URL=실제_Discord_Webhook_URL
```

`VITE_*`와 `DEPLOY_ENV`는 빌드 시 적용됩니다. 변경하면 web 이미지를 다시 빌드하세요.
Webhook은 API 컨테이너 런타임에만 주입됩니다. 브라우저용 `VITE_*`에 넣지 마세요.
버전은 기존처럼 빌드 시 자동 생성되므로 별도 버전 환경변수는 필요 없습니다.
production에서는 디버그 패널을 숨기며 preview에서만 기본 표시합니다.

## 2. 테스트 후 전환

먼저 로컬 HTTP로 실행해 확인합니다. 이때 PWA는 localhost 또는 HTTPS에서 검증하세요.

```sh
SITE_ADDRESS=:80 HTTP_PORT=8080 HTTPS_PORT=8443 docker compose up -d --build
curl -I http://localhost:8080/
curl http://localhost:8080/api/health
curl -I http://localhost:8080/sw.js
curl -I http://localhost:8080/assets/missing.js
curl -H 'Range: bytes=0-99' -I http://localhost:8080/sound/005_korean_start.mp3
```

정상 결과: 홈페이지 200, health 200, sw.js no-store, 없는 JS 404, 음원 범위 요청 206.
브라우저에서 과목별/자유 설정 시험, 타종 테스트, 연속 시험, 의견 전송을 확인하세요.
iPadOS/Tizen 실기기 확인은 별도로 필요합니다. 셀프호스트/CDN이 자동재생 정책을 바꾸지는 않습니다.

운영 전환 시 DNS의 A/AAAA를 실제 서버로 맞추고 80/443을 개방한 뒤 실행합니다.
사용하지 않는 이전 IPv6 주소나 Vercel CNAME을 남기지 마세요.

```sh
docker compose up -d --build
docker compose ps
```

Caddy가 도메인 인증서를 자동 발급합니다. `caddy_data` 볼륨은 인증서 유지용입니다.
도메인이 그대로면 브라우저의 기존 시험 설정·저장 음원도 같은 출처에 남습니다.
도메인을 바꾸는 경우 index.html의 canonical/구조화 데이터, sitemap.xml, robots.txt와
GA4 스트림 설정도 별도로 맞춰야 합니다.

Vercel 배포는 전환 검증이 끝날 때까지 유지하세요. 장애 시 DNS를 원래 값으로 되돌릴 수
있도록 기록해 두세요. 이미 브라우저에 로드된 앱은 배포만으로 교체되지 않습니다.

## 3. 음원 CDN 분리 (선택)

Cloudflare R2 + 커스텀 도메인으로 제공할 수 있습니다. Worker는 필수가 아닙니다.

1. 최초 한 번 R2 버킷과 해당 버킷의 Object Read & Write S3 API 키를 준비합니다.
   파일을 콘솔에서 수동 업로드할 필요는 없습니다.
2. 예를 들어 `audio.example.com`을 R2 커스텀 도메인으로 연결합니다.
3. 동기화 프로그램이 MP3 Content-Type을 `audio/mpeg`로 설정합니다.
   배포 후 CDN에서도 Range 요청(206)이 되는지 확인합니다.
4. 버킷에 아래처럼 사이트 출처의 GET/HEAD CORS를 허용합니다. 현재 앱은 사전 다운로드에
   fetch를 사용하므로, 직접 재생이 돼도 CORS가 없으면 프리로드는 실패합니다.

```json
[
  {
    "AllowedOrigins": ["https://csat-clock.vvcnyy.me"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Accept-Ranges", "Content-Range", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

5. 서버의 `.env`에 아래 값을 한 번 설정합니다. 접근 키는 브라우저 번들이 아니라
   동기화 컨테이너에만 주입됩니다.

```dotenv
VITE_SOUND_BASE_URL=https://audio.example.com/sound
R2_SYNC_ENABLED=true
R2_ACCOUNT_ID=Cloudflare_계정_ID
R2_BUCKET=버킷_이름
R2_ACCESS_KEY_ID=S3_접근_키_ID
R2_SECRET_ACCESS_KEY=S3_비밀_키
R2_PREFIX=sound
```

URL 경로와 `R2_PREFIX`는 일치해야 합니다. 끝 슬래시는 허용됩니다.
이후 배포는 `docker compose up -d --build`만 실행하면 됩니다.

- `sound-sync`가 `public/sound/`의 MP3만 검사합니다(short 포함).
- 파일 내용의 SHA-256으로 `sound/<해시>/<파일명>.mp3`에 업로드합니다.
- 이미 같은 파일이 있으면 업로드를 생략합니다. 변경된 파일만 새 경로를 사용합니다.
- 앱 빌드가 같은 해시로 URL을 생성하므로 파일별 주소를 수동 수정할 필요가 없습니다.
- 동기화가 성공해야 web 컨테이너가 시작됩니다. 인증/업로드 실패 시 시작을 차단합니다.
- 기존 R2 파일은 삭제하지 않습니다. 이전 배포나 진행 중인 시험이 참조할 수 있습니다.
- 사용자 기기에 저장된 영어 듣기 파일은 업로드하지 않습니다.

음원을 바꿀 때 로컬 MP3를 교체하고 다시 배포하면 됩니다. 해시별 URL에 immutable 캐시를
설정하므로 파일 변경 때 CDN 캐시 제거를 할 필요가 없습니다. 이전 버전 정리는 자동화하지
않았으며 버킷 저장량은 누적됩니다.
버킷 생성·공개 CDN 도메인 연결·CORS는 최초 한 번 설정해야 합니다. S3 업로드 키만으로
도메인/DNS 설정까지 대신하지는 않습니다. 실제 CDN 접근 권한과 CORS도 첫 배포 후 확인하세요.

동기화만 수동 재실행할 때:

```sh
docker compose build sound-sync
docker compose run --rm sound-sync
```

Node 24 환경에서는 `npm run sync:sounds`도 가능합니다(.env 자동 로드).
`docker compose restart web`은 동기화를 수행하지 않습니다. 새 음원을 반영하려면 반드시
이미지를 다시 빌드하고 `up`으로 배포하세요. `R2_SYNC_ENABLED=false`이면 R2 요청 없이 종료합니다.

CDN 캐시 정책도 R2 커스텀 도메인에 맞춰 확인하세요. `r2.dev`는 운영 CDN 용도로 쓰지 않습니다.

CDN 연결 전에는 `/sound` 기본값으로 자체 서버 음원이 동작합니다. CDN 장애 시 자동으로
로컬 재시도하지는 않습니다. 되돌리려면 기본값으로 재빌드하세요.
CDN은 전송을 개선하지만 브라우저 오디오 로딩/재생 지연 문제를 해결하지는 않습니다.

Workers를 앞에 두는 대안도 있지만 현재 구성에는 포함하지 않았습니다. Workers Logs는
Worker가 실행된 요청과 출력 로그를 기록합니다. CDN/정적 자산이 Worker를 우회하면 그 요청은
Worker 실행 로그로 남지 않습니다. Workers Logs는 Free/Paid 플랜에 있지만 수집·보관 한도가
있고, Workers Logpush는 Paid 플랜 기능입니다. 음원 전달만 필요하면 R2 커스텀 도메인으로
시작하고, 요청별 처리가 필요할 때 Worker를 추가할 수 있습니다.
https://developers.cloudflare.com/workers/observability/logs/workers-logs/
https://developers.cloudflare.com/workers/observability/logs/logpush/

공식 참고:
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- https://developers.cloudflare.com/r2/buckets/cors/

## 4. 로그

Caddy 요청 로그는 호스트의 `logs/access.jsonl`에 JSON 한 줄씩 저장됩니다.
요청 시각, 클라이언트 주소, 경로, 상태 코드, 처리 시간 등을 확인할 수 있습니다.
20MiB 단위로 회전하며 지난 파일은 최대 10개/14일 기준으로 정리됩니다.
현재 쓰는 파일은 회전 전까지 유지되므로 엄격한 14일 삭제 정책은 아닙니다.
Docker 자체 stdout 로그도 컨테이너별 10MB × 3개로 제한합니다.

```sh
tail -f logs/access.jsonl
docker compose logs --tail 100 api
```

요청 본문과 Discord 토큰은 애플리케이션 로그로 출력하지 않습니다. access log에는
IP·User-Agent·요청 URL 등이 포함되므로 파일 접근 권한과 보관 기간을 관리하세요.
CDN 캐시에서 처리한 음원 요청, 브라우저 캐시/PWA가 처리한 요청은 이 서버에 도달하지
않아 access log에 남지 않습니다. 실제 소리 재생 여부는 별도 앱 진단 로그가 필요합니다.
로그를 Axiom으로 보내려면 이 파일을 읽는 수집기를 나중에 붙일 수 있습니다.

API는 호스트 포트를 공개하지 않고 Caddy를 통해서만 접근합니다. Caddy가 설정한
클라이언트 헤더로 분당 5회 의견 전송 제한을 적용합니다(메모리 기반, 재시작 시 초기화).
상위 CDN/프록시를 추가하면 실제 IP 전달·신뢰 프록시 설정도 조정해야 합니다.

## 5. 업데이트

```sh
git pull
docker compose up -d --build
```

단일 web 컨테이너 교체 중 짧은 연결 중단이 있을 수 있습니다. 시험 이용이 적은 시간에
배포하세요. 이전 HTML을 계속 열어 둔 사용자에게는 새로고침 시 새 버전이 적용됩니다.
`index.html`/manifest는 재검증, `sw.js`는 no-store, 해시가 붙은 assets는 장기 캐시합니다.
서비스 워커는 온라인 응답을 우선하고 시험 도중 강제 새로고침하지 않습니다.
