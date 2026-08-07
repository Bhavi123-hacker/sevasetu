"""
Structured logging.

Deliberately separate from AuditEvent (models.py) — that table is a
business-domain record ("this application was OCR'd, then flagged for
a duplicate, then resolved by Suresh") meant to be queried and shown to
users. This is operational logging ("request took 340ms, OCR call
succeeded, DB write failed") meant to be piped to a log aggregator and
read by whoever's running the service at 2am. They look similar
(both are timestamped, structured records) but serve different readers
and different purposes — conflating them would make both worse at
their actual job.

JSON output, one line per event, so it's immediately usable by any log
aggregator (CloudWatch, Datadog, Grafana Loki, or just `jq` on a raw
file) without a custom parser.
"""
import json
import logging
import sys
import time
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Anything passed via logger.info("msg", extra={"foo": "bar"})
        # ends up as attributes on the record — pull out the ones that
        # aren't standard LogRecord fields.
        standard_fields = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys())
        for key, value in record.__dict__.items():
            if key not in standard_fields and key != "message":
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


class RequestLoggingContext:
    """Times a request and logs method/path/status/duration as one structured line."""

    def __init__(self, logger: logging.Logger, method: str, path: str):
        self.logger = logger
        self.method = method
        self.path = path
        self.start = None

    def __enter__(self):
        self.start = time.monotonic()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = round((time.monotonic() - self.start) * 1000, 1)
        if exc_type is not None:
            self.logger.error(
                "request_failed",
                extra={"method": self.method, "path": self.path, "duration_ms": duration_ms, "error": str(exc_val)},
            )
        else:
            self.logger.info(
                "request_completed",
                extra={"method": self.method, "path": self.path, "duration_ms": duration_ms},
            )
        return False  # never swallow exceptions
