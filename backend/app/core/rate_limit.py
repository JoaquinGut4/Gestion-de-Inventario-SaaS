from collections import deque
from dataclasses import dataclass
from ipaddress import ip_address
from threading import Lock
from time import monotonic

from fastapi import Request

from backend.app.core.config import get_settings


MAX_TRACKED_KEYS = 10_000


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after: int


class SlidingWindowLimiter:
    """Counts events per key in a sliding window.

    State lives in the process memory, so every worker keeps its own counters. A
    deployment with several workers multiplies the effective threshold by the
    number of workers; keep that in mind when sizing the limits.
    """

    def __init__(self, max_events: int, window_seconds: int) -> None:
        self._max_events = max_events
        self._window = float(window_seconds)
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    @property
    def enabled(self) -> bool:
        return self._max_events > 0 and self._window > 0

    def _prune(self, events: deque[float], now: float) -> None:
        while events and events[0] <= now - self._window:
            events.popleft()

    def check(self, key: str) -> RateLimitResult:
        if not self.enabled:
            return RateLimitResult(True, 0)
        now = monotonic()
        with self._lock:
            events = self._events.get(key)
            if events is None:
                return RateLimitResult(True, 0)
            self._prune(events, now)
            if len(events) < self._max_events:
                return RateLimitResult(True, 0)
            retry_after = max(1, int(events[0] + self._window - now) + 1)
            return RateLimitResult(False, retry_after)

    def record(self, key: str) -> None:
        if not self.enabled:
            return
        now = monotonic()
        with self._lock:
            events = self._events.setdefault(key, deque())
            self._prune(events, now)
            events.append(now)
            if len(self._events) > MAX_TRACKED_KEYS:
                self._prune_all(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def reset_all(self) -> None:
        with self._lock:
            self._events.clear()

    def _prune_all(self, now: float) -> None:
        for key in [key for key, events in self._events.items() if not events or events[-1] <= now - self._window]:
            del self._events[key]
        if len(self._events) > MAX_TRACKED_KEYS:
            self._events.clear()


settings = get_settings()
account_login_limiter = SlidingWindowLimiter(settings.login_account_max_attempts, settings.login_attempt_window_seconds)
ip_login_limiter = SlidingWindowLimiter(settings.login_ip_max_attempts, settings.login_attempt_window_seconds)


def login_client_ip(request: Request) -> str | None:
    """Return the caller address for per-IP limits, or None when it cannot distinguish clients.

    Loopback peers mean either a local browser or a reverse proxy that rewrites the
    address. In that case a single bucket would throttle every user together, which
    is worse than the attack it prevents; enable TRUST_FORWARDED_FOR behind a proxy
    so the real client address is used instead.
    """
    if settings.trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",", 1)[0].strip() or "unknown"
    host = request.client.host if request.client else None
    return host if host and should_limit_by_ip(host) else None


def should_limit_by_ip(host: str) -> bool:
    try:
        return not ip_address(host).is_loopback
    except ValueError:
        return True

