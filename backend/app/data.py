import json
import os
from pathlib import Path
from typing import Any, Optional


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / 'data'

# Built-in admin phones — always valid regardless of admins.json
BUILTIN_ADMIN_PHONES: set[str] = {'7327184414', '9179419406'}
# Legacy alias kept for backward compatibility
ADMIN_PHONE = '7327184414'
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', '').strip().lower()
CHICKEN_PREP_MINUTES = 20
DEFAULT_GOAT_PREP_MINUTES = 45


def get_data_dir() -> Path:
    configured = os.getenv('DATA_DIR')
    return Path(configured).resolve() if configured else DEFAULT_DATA_DIR


def get_orders_dir() -> Path:
    orders_dir = get_data_dir() / 'orders'
    orders_dir.mkdir(parents=True, exist_ok=True)
    return orders_dir


def list_orders() -> list[dict[str, Any]]:
    orders: list[dict[str, Any]] = []
    for file_path in sorted(get_orders_dir().glob('*.json'), reverse=True):
        with file_path.open('r', encoding='utf-8') as handle:
            orders.append(json.load(handle))
    return sorted(orders, key=lambda order: order.get('createdAt', ''), reverse=True)


def get_order(order_id: str) -> Optional[dict[str, Any]]:
    file_path = get_orders_dir() / f'{order_id}.json'
    if not file_path.exists():
        return None
    with file_path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def save_order(order: dict[str, Any]) -> dict[str, Any]:
    file_path = get_orders_dir() / f"{order['id']}.json"
    with file_path.open('w', encoding='utf-8') as handle:
        json.dump(order, handle, indent=2)
    return order


def update_order(order_id: str, updates: dict[str, Any]) -> Optional[dict[str, Any]]:
    order = get_order(order_id)
    if order is None:
        return None
    order.update(updates)
    return save_order(order)


def avg_goat_prep_minutes() -> int:
    """Return average goat prep time (accepted→ready) from past orders, or the default."""
    diffs: list[float] = []
    for order in list_orders():
        if order.get('status') in ('Ready', 'Completed') and order.get('acceptedAt') and order.get('readyAt'):
            has_goat = any(item.get('id', '').startswith('g') for item in order.get('items', []))
            if has_goat:
                try:
                    from datetime import datetime
                    accepted = datetime.fromisoformat(order['acceptedAt'])
                    ready = datetime.fromisoformat(order['readyAt'])
                    diff = (ready - accepted).total_seconds() / 60
                    if 1 <= diff <= 300:
                        diffs.append(diff)
                except (ValueError, TypeError):
                    pass
    return round(sum(diffs) / len(diffs)) if diffs else DEFAULT_GOAT_PREP_MINUTES


# ── Admin management ────────────────────────────────────────────────────────

def get_admins_path() -> Path:
    return get_data_dir() / 'admins.json'


def load_admins() -> dict[str, Any]:
    """Return stored admin data (phones/emails lists, excluding builtins)."""
    path = get_admins_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {'phones': [], 'emails': []}


def save_admins(data: dict[str, Any]) -> None:
    path = get_admins_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')


def is_admin_phone(phone: str) -> bool:
    if phone in BUILTIN_ADMIN_PHONES:
        return True
    return phone in load_admins().get('phones', [])


def is_admin_email(email: str) -> bool:
    if ADMIN_EMAIL and email == ADMIN_EMAIL:
        return True
    return email in load_admins().get('emails', [])


# ── Data folder browser ──────────────────────────────────────────────────────

def list_data_files() -> list[dict[str, Any]]:
    """List all files under the data directory (relative paths)."""
    data_dir = get_data_dir()
    result: list[dict[str, Any]] = []
    if not data_dir.exists():
        return result
    for p in sorted(data_dir.rglob('*')):
        if p.is_file():
            stat = p.stat()
            result.append({
                'path': str(p.relative_to(data_dir)),
                'size': stat.st_size,
            })
    return result


def read_data_file(rel_path: str) -> Optional[str]:
    """Read a file within the data directory. Returns None if unsafe/missing."""
    data_dir = get_data_dir().resolve()
    try:
        target = (data_dir / rel_path).resolve()
        target.relative_to(data_dir)  # raises ValueError if outside data_dir
    except (ValueError, Exception):
        return None
    if not target.is_file():
        return None
    try:
        return target.read_text(encoding='utf-8')
    except Exception:
        return None


def suggested_prep_minutes(items: list[dict[str, Any]]) -> int:
    """Calculate suggested prep time based on item categories."""
    has_goat = any(item.get('id', '').startswith('g') for item in items)
    has_chicken = any(item.get('id', '').startswith('c') for item in items)
    times = []
    if has_chicken:
        times.append(CHICKEN_PREP_MINUTES)
    if has_goat:
        times.append(avg_goat_prep_minutes())
    return max(times) if times else CHICKEN_PREP_MINUTES
