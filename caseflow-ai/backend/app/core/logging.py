import logging
import re
import sys
from typing import Optional, Dict, Any

class CaseFlowFormatter(logging.Formatter):
    """Custom formatter to enforce structured log format and scrub sensitive tokens."""
    def format(self, record: logging.LogRecord) -> str:
        case_id = getattr(record, "case_id", "N/A")
        action = getattr(record, "action", "N/A")
        msg = record.getMessage()
        
        msg = re.sub(r'(?i)(api[_ -]?key|password|token|secret)\s*[:=]\s*[^\s,;]+', r'\1=[REDACTED]', msg)

        return f"[{self.formatTime(record, '%Y-%m-%d %H:%M:%S')}] [{record.levelname}] [{record.name}] [case_id={case_id}] [action={action}] {msg}"

def setup_logging(log_level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("caseflow")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # Avoid duplicate handlers
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(CaseFlowFormatter())
        logger.addHandler(handler)
        
    return logger

logger = setup_logging()

def log_audit_event(action: str, case_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None, level: str = "info"):
    extra = {"case_id": case_id or "N/A", "action": action}
    log_fn = getattr(logger, level.lower(), logger.info)
    log_fn(f"Event: {action} | Details: {details or {}}", extra=extra)
