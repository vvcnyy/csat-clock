# Dockerfile 단일 컨테이너 배포

Node 24가 정적 파일과 의견 전송 API를 함께 제공합니다. Caddy/Compose는 제거했습니다.
HTTPS는 Dokploy가 담당하며 GA4와 기존 오디오 로직은 유지합니다.

## Dokploy Application

1. Build Type: Dockerfile, 경로: `Dockerfile`, context: 저장소 루트.
   이전 build target(web/api/sound-sync)이 있다면 비웁니다.
2. Domains의 Container Port: **3000**, 내부 연결: **HTTP**. 외부 HTTPS는 Dokploy에서 설정합니다.
3. `SITE_ADDRESS`는 삭제해도 됩니다. DNS는 Dokploy 서버를 가리켜야 합니다.
4. 아래 빌드 인자와 런타임 환경변수를 구분해 설정하고 재빌드·배포합니다.

공개 **빌드 인자**:

```dotenv
DEPLOY_ENV=production
VITE_GA_MEASUREMENT_ID=G-실제측정ID
VITE_AUDIO_UNLOCK_SCOPE=apple
VITE_AUDIO_DEBUG=false
VITE_SOUND_BASE_URL=/sound
```

**런타임 환경변수**:

```dotenv
PORT=3000
LOG_DIR=/app/logs
TRUST_PROXY_HOPS=0
R2_SYNC_ENABLED=false
DISCORD_FEEDBACK_WEBHOOK_URL=실제Webhook
```

VITE_* 변경은 재빌드가 필요합니다. 비밀 키를 빌드 인자나 VITE_*에 넣지 마세요.
로그 영속 볼륨은 `/app/logs`에 연결하고 UID 1000(node)에 쓰기를 허용하세요.
호스트 3000번 포트를 별도 공개할 필요는 없습니다. HTTP 헬스체크는 `/api/health`입니다.
R2 동기화가 켜져 있으면 완료까지 서버가 대기하므로 배포 시작 유예 시간을 충분히 주세요.

## R2 자동 업로드

최초 한 번 버킷, 해당 버킷의 Object Read & Write S3 키, 공개 CDN 도메인과 CORS를 설정합니다.
이후 음원 업로드는 컨테이너 시작 시 자동 수행합니다.

빌드 인자와 런타임 양쪽에 동일한 `VITE_SOUND_BASE_URL=https://audio.example.com/sound`를 설정합니다.
아래 값은 런타임에만 전달합니다:

```dotenv
R2_SYNC_ENABLED=true
R2_ACCOUNT_ID=Cloudflare계정ID
R2_BUCKET=버킷이름
R2_ACCESS_KEY_ID=S3접근키
R2_SECRET_ACCESS_KEY=S3비밀키
R2_PREFIX=sound
```

CDN URL 경로와 R2_PREFIX는 같아야 합니다. 버킷 CORS 예시:

```json
[{"AllowedOrigins":["https://csat-clock.vvcnyy.me"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["Range"],"ExposeHeaders":["Accept-Ranges","Content-Range","ETag"],"MaxAgeSeconds":3600}]
```

`public/sound` MP3를 `sound/<SHA-256>/<파일명>`에 업로드하고 동일 파일은 생략합니다.
기존 R2 파일은 삭제하지 않습니다. 동기화 실패 시 서버를 시작하지 않습니다.
사용자가 저장한 영어 듣기 파일은 업로드하지 않습니다. 음원 변경은 재빌드가 필요합니다.
R2_SYNC_ENABLED=false이면 R2에 접속하지 않습니다. CDN 장애 시 로컬 자동 대체는 없습니다.
동기화만 실행하려면 이미지 실행 명령을 `node scripts/sync-sounds.mjs`로 지정합니다.

## 로그와 프록시

stdout과 `/app/logs/access.jsonl`에 시각·경로·메서드·상태·처리시간·IP·User-Agent를 기록합니다.
쿼리 문자열, 요청 본문, 쿠키, Webhook은 기록하지 않습니다.
하루 또는 20MB 단위로 회전하며 이전 파일 최대 14개를 압축 보관합니다(정확한 14일 정책은 아님).
stdout 보관 제한은 배포 플랫폼에서 설정하세요. IP 등 개인정보의 접근 권한과 보관 기간을 관리하세요.
CDN/브라우저/PWA 캐시에서 끝난 요청은 서버 로그에 남지 않습니다.

TRUST_PROXY_HOPS=0은 전달 헤더를 신뢰하지 않습니다. 오직 신뢰할 수 있는 Traefik만
컨테이너에 접근하고 전달 헤더를 올바르게 관리한다면 1을 사용할 수 있습니다.
Cloudflare를 포함한 체인은 실제 X-Forwarded-For 및 Traefik 신뢰 설정을 확인한 뒤 지정하세요.
무조건 2로 설정하지 마세요. 오른쪽에서 지정된 홉 수만큼 IP를 선택합니다.
이 IP로 의견 전송을 분당 5회 제한합니다(메모리 기반). 0이면 프록시를 공유하는 사용자가 제한을 공유할 수 있습니다.

## 로컬 확인

```sh
docker build -t csat-clock .
docker run --rm -p 127.0.0.1:3000:3000 csat-clock
```

홈 200, `/api/health` 200, `/sw.js` no-store, 없는 JS 404, MP3 Range 요청 206을 확인하세요.
HTML은 재검증, 해시 assets는 장기 캐시합니다. 시험 중 강제 새로고침하지 않습니다.
PWA는 localhost 또는 HTTPS에서 확인합니다. iPadOS/Tizen 실기기 검증은 별도로 필요합니다.
배포 방식 변경은 브라우저 자동재생 정책을 바꾸지 않습니다.
