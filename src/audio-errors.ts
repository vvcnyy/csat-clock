const mediaErrorMessages: Record<number, { code: string; message: string }> = {
  1: {
    code: "SND-E03",
    message: "브라우저가 음원 요청을 중단했습니다.",
  },
  2: {
    code: "SND-E04",
    message: "네트워크 문제로 음원을 불러오지 못했습니다.",
  },
  3: {
    code: "SND-E05",
    message: "브라우저가 음원을 디코딩하지 못했습니다.",
  },
  4: {
    code: "SND-E06",
    message: "음원 형식이 지원되지 않거나 미디어 재생 장치를 초기화하지 못했습니다.",
  },
};

export function formatAudioError(
  context: string,
  rejection?: unknown,
  mediaError?: MediaError | null,
) {
  if (mediaError) {
    const detail = mediaErrorMessages[mediaError.code];
    if (detail) return `[${detail.code}] ${context}: ${detail.message}`;
  }

  const errorName =
    rejection && typeof rejection === "object" && "name" in rejection
      ? String(rejection.name)
      : "";

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return `[SND-E01] ${context}: 브라우저가 소리 재생을 차단했습니다. 소리 권한을 확인해 주세요.`;
  }
  if (errorName === "AbortError") {
    return `[SND-E02] ${context}: 다른 미디어 동작으로 인해 재생 요청이 중단되었습니다.`;
  }
  if (errorName === "NotSupportedError") {
    return `[SND-E06] ${context}: 음원 형식이 지원되지 않거나 미디어 재생 장치를 초기화하지 못했습니다.`;
  }

  return `[SND-E99] ${context}: 알 수 없는 이유로 소리를 재생하지 못했습니다.`;
}

export function getAudioErrorCode(
  rejection?: unknown,
  mediaError?: MediaError | null,
) {
  if (mediaError) return mediaErrorMessages[mediaError.code]?.code ?? "SND-E99";

  const errorName =
    rejection && typeof rejection === "object" && "name" in rejection
      ? String(rejection.name)
      : "";
  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return "SND-E01";
  }
  if (errorName === "AbortError") return "SND-E02";
  if (errorName === "NotSupportedError") return "SND-E06";
  return "SND-E99";
}

const sanitizeErrorMessage = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value
    .replace(/(?:blob:|data:|https?:\/\/)[^\s"')]+/gi, "[source]")
    .replace(/(?:file:\/\/|[A-Za-z]:\\)[^\s"')]+/gi, "[file]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
};

export function getAudioErrorDetails(
  rejection?: unknown,
  audio?: HTMLAudioElement,
) {
  const errorObject =
    rejection && typeof rejection === "object"
      ? (rejection as { name?: unknown; message?: unknown; code?: unknown })
      : undefined;
  const rejectionCode = errorObject?.code;

  return {
    error_name:
      typeof errorObject?.name === "string" ? errorObject.name : undefined,
    error_message: sanitizeErrorMessage(errorObject?.message),
    rejection_code:
      typeof rejectionCode === "string" || typeof rejectionCode === "number"
        ? String(rejectionCode)
        : undefined,
    media_error_code: audio?.error?.code
      ? String(audio.error.code)
      : undefined,
    media_error_message: sanitizeErrorMessage(audio?.error?.message),
    network_state: audio ? String(audio.networkState) : undefined,
    ready_state: audio ? String(audio.readyState) : undefined,
    audio_paused: audio?.paused,
    audio_ended: audio?.ended,
  };
}
