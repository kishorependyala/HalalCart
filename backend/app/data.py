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

DEFAULT_MENU: list[dict] = [
    {'id': 'g3', 'category': 'Goat',    'name': 'Goat Leg',            'price': 35.00, 'unit': 'per leg', 'description': 'Bone-in goat leg, great for biryani'},
    {'id': 'g4', 'category': 'Goat',    'name': 'Goat Shoulder',       'price': 28.00, 'unit': 'per lb',  'description': 'Tender goat shoulder, perfect for curry'},
    {'id': 'g5', 'category': 'Goat',    'name': 'Goat Chops',          'price': 22.00, 'unit': 'per lb',  'description': 'Goat rib chops, halal certified'},
    {'id': 'g6', 'category': 'Goat',    'name': 'Goat Keema',          'price': 18.00, 'unit': 'per lb',  'description': 'Fresh ground goat meat'},
    {'id': 'c1', 'category': 'Chicken', 'name': 'Whole Chicken',       'price': 12.00, 'unit': 'per bird','description': 'Fresh whole chicken, halal slaughtered'},
    {'id': 'c2', 'category': 'Chicken', 'name': 'Chicken Leg Quarters','price':  3.50, 'unit': 'per lb',  'description': 'Juicy leg quarters, skin-on'},
    {'id': 'c3', 'category': 'Chicken', 'name': 'Boneless Breast',     'price':  5.99, 'unit': 'per lb',  'description': 'Skinless boneless chicken breast'},
    {'id': 'c4', 'category': 'Chicken', 'name': 'Chicken Wings',       'price':  4.50, 'unit': 'per lb',  'description': 'Fresh chicken wings'},
    {'id': 'c5', 'category': 'Chicken', 'name': 'Chicken Keema',       'price':  4.99, 'unit': 'per lb',  'description': 'Ground chicken, great for kebabs'},
    {'id': 'f1', 'category': 'Fish',    'name': 'Whole Fish',          'price': 14.00, 'unit': 'per fish','description': 'Fresh whole fish, cleaned'},
    {'id': 'f2', 'category': 'Fish',    'name': 'Fish Fillet',         'price':  8.99, 'unit': 'per lb',  'description': 'Fresh boneless fish fillet'},
    {'id': 'f3', 'category': 'Fish',    'name': 'Shrimp',              'price': 12.99, 'unit': 'per lb',  'description': 'Fresh shrimp, peeled and deveined'},
]


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


def list_users() -> list[dict[str, Any]]:
    """Aggregate unique users from all orders, sorted by most recent order."""
    seen: dict[str, dict[str, Any]] = {}
    for order in list_orders():
        phone = order.get('phone', '')
        if not phone:
            continue
        if phone not in seen:
            seen[phone] = {
                'name': order.get('customerName', ''),
                'phone': phone,
                'orderCount': 0,
                'lastOrderAt': '',
                'totalSpent': 0.0,
            }
        seen[phone]['orderCount'] += 1
        seen[phone]['totalSpent'] = round(seen[phone]['totalSpent'] + order.get('total', 0.0), 2)
        created = order.get('createdAt', '')
        if created > seen[phone]['lastOrderAt']:
            seen[phone]['lastOrderAt'] = created
            seen[phone]['name'] = order.get('customerName', seen[phone]['name'])
    return sorted(seen.values(), key=lambda u: u['lastOrderAt'], reverse=True)


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
    return round(sum(diffs) / len(diffs)) if diffs else load_settings().get('goatPrepMinutes', DEFAULT_GOAT_PREP_MINUTES)


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
    settings = load_settings()
    has_goat = any(item.get('id', '').startswith('g') for item in items)
    has_chicken = any(item.get('id', '').startswith('c') for item in items)
    times = []
    if has_chicken:
        times.append(settings['chickenPrepMinutes'])
    if has_goat:
        times.append(avg_goat_prep_minutes())
    return max(times) if times else settings['chickenPrepMinutes']


# ── Menu management ──────────────────────────────────────────────────────────

def get_menu_path() -> Path:
    return get_data_dir() / 'menu.json'


def load_menu() -> list[dict[str, Any]]:
    """Load menu from file, falling back to DEFAULT_MENU."""
    path = get_menu_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return [item.copy() for item in DEFAULT_MENU]


def save_menu(menu: list[dict[str, Any]]) -> None:
    path = get_menu_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(menu, indent=2), encoding='utf-8')


def update_menu_item(item_id: str, updates: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Update a single menu item by id. Returns the updated item or None if not found."""
    menu = load_menu()
    for item in menu:
        if item['id'] == item_id:
            allowed = {'name', 'price', 'unit', 'description', 'category'}
            for key, val in updates.items():
                if key in allowed:
                    item[key] = val
            save_menu(menu)
            return item
    return None


def delete_menu_item(item_id: str) -> bool:
    """Delete a menu item by id. Returns True if deleted, False if not found."""
    menu = load_menu()
    new_menu = [item for item in menu if item['id'] != item_id]
    if len(new_menu) == len(menu):
        return False
    save_menu(new_menu)
    return True


def add_menu_item(item: dict[str, Any]) -> dict[str, Any]:
    """Append a new menu item, generating a unique id."""
    from uuid import uuid4
    menu = load_menu()
    new_item: dict[str, Any] = {
        'id': str(uuid4())[:8],
        'category': item['category'],
        'name': item['name'],
        'price': round(float(item['price']), 2),
        'unit': item.get('unit', ''),
        'description': item.get('description', ''),
    }
    menu.append(new_item)
    save_menu(menu)
    return new_item


# ── Location / Hours management ──────────────────────────────────────────────

# Hours: dict keyed by weekday string "0"=Sun … "6"=Sat.
# Each value: {"open": "10:00", "close": "20:00"} or null for closed.
DEFAULT_LOCATIONS: list[dict] = [
    {
        'id': 'loc1',
        'name': 'Monroe Township',
        'address': '355 Applegarth Rd, Monroe Township, NJ 08831',
        'phone': '(609) 235-9158',
        'hours': {
            '0': {'open': '10:00', 'close': '18:00'},
            '1': {'open': '10:00', 'close': '20:00'},
            '2': {'open': '10:00', 'close': '20:00'},
            '3': {'open': '10:00', 'close': '20:00'},
            '4': {'open': '10:00', 'close': '20:00'},
            '5': {'open': '10:00', 'close': '20:00'},
            '6': {'open': '10:00', 'close': '20:00'},
        },
    },
    {
        'id': 'loc2',
        'name': 'Location 2',
        'address': 'Address TBD — update in Admin',
        'phone': '',
        'hours': {
            '0': {'open': '10:00', 'close': '18:00'},
            '1': {'open': '10:00', 'close': '20:00'},
            '2': {'open': '10:00', 'close': '20:00'},
            '3': {'open': '10:00', 'close': '20:00'},
            '4': {'open': '10:00', 'close': '20:00'},
            '5': {'open': '10:00', 'close': '20:00'},
            '6': {'open': '10:00', 'close': '20:00'},
        },
    },
]


def get_locations_path() -> Path:
    return get_data_dir() / 'locations.json'


def load_locations() -> list[dict[str, Any]]:
    path = get_locations_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return [loc.copy() for loc in DEFAULT_LOCATIONS]


def save_locations(locations: list[dict[str, Any]]) -> None:
    path = get_locations_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(locations, indent=2), encoding='utf-8')


def add_location(loc: dict[str, Any]) -> dict[str, Any]:
    from uuid import uuid4
    locations = load_locations()
    new_loc: dict[str, Any] = {
        'id': 'loc' + str(uuid4())[:6],
        'name': loc.get('name', 'New Location'),
        'address': loc.get('address', ''),
        'phone': loc.get('phone', ''),
        'hours': loc.get('hours', DEFAULT_LOCATIONS[0]['hours'].copy()),
    }
    locations.append(new_loc)
    save_locations(locations)
    return new_loc


def update_location(loc_id: str, updates: dict[str, Any]) -> Optional[dict[str, Any]]:
    locations = load_locations()
    for loc in locations:
        if loc['id'] == loc_id:
            for key in ('name', 'address', 'phone', 'hours'):
                if key in updates:
                    loc[key] = updates[key]
            save_locations(locations)
            return loc
    return None


def delete_location(loc_id: str) -> bool:
    locations = load_locations()
    new_locs = [loc for loc in locations if loc['id'] != loc_id]
    if len(new_locs) == len(locations):
        return False
    save_locations(new_locs)
    return True


# ── Settings management ───────────────────────────────────────────────────────

DEFAULT_SETTINGS: dict[str, Any] = {
    'chickenPrepMinutes': CHICKEN_PREP_MINUTES,
    'goatPrepMinutes': DEFAULT_GOAT_PREP_MINUTES,
}


def get_settings_path() -> Path:
    return get_data_dir() / 'settings.json'


def load_settings() -> dict[str, Any]:
    """Load app settings from file, merging with defaults."""
    path = get_settings_path()
    if path.exists():
        try:
            stored = json.loads(path.read_text(encoding='utf-8'))
            return {**DEFAULT_SETTINGS, **stored}
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict[str, Any]) -> None:
    path = get_settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(settings, indent=2), encoding='utf-8')
