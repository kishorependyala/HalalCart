import json
import os
from pathlib import Path
from typing import Any


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / 'data'


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


def save_order(order: dict[str, Any]) -> dict[str, Any]:
    file_path = get_orders_dir() / f"{order['id']}.json"
    with file_path.open('w', encoding='utf-8') as handle:
        json.dump(order, handle, indent=2)
    return order
