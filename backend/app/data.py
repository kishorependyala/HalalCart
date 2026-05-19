import json
import os
from pathlib import Path
from typing import Any, Optional


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / 'data'

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
