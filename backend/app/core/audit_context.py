from contextvars import ContextVar

from fastapi import Request


request_ip: ContextVar[str] = ContextVar("request_ip", default="")
request_device: ContextVar[str] = ContextVar("request_device", default="")


def capture_request_context(request: Request) -> tuple[object, object]:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    ip = forwarded or (request.client.host if request.client else "")
    return request_ip.set(ip[:64]), request_device.set(request.headers.get("user-agent", "")[:500])


def reset_request_context(tokens: tuple[object, object]) -> None:
    request_ip.reset(tokens[0])
    request_device.reset(tokens[1])
