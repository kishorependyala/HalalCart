from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request

from ..data import (
    ADMIN_EMAIL,
    BUILTIN_ADMIN_PHONES,
    add_location,
    add_menu_item,
    delete_location,
    delete_menu_item,
    get_order,
    is_admin_email,
    is_admin_phone,
    list_data_files,
    list_orders,
    list_users,
    load_admins,
    load_locations,
    load_menu,
    load_settings,
    read_data_file,
    save_admins,
    save_order,
    save_settings,
    suggested_prep_minutes,
    update_location,
    update_menu_item,
    update_order,
)

bp = Blueprint('api', __name__)

VALID_STATUSES = {'Pending', 'Accepted', 'Ready', 'Completed'}


@bp.get('/health')
def health():
    import os
    data_dir = os.getenv('DATA_DIR', 'data')
    return jsonify({'status': 'ok', 'dataDir': data_dir})


def _is_admin() -> bool:
    phone = (request.headers.get('X-Admin-Phone') or '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if phone and is_admin_phone(phone):
        return True
    email = (request.headers.get('X-Admin-Email') or '').strip().lower()
    if email and is_admin_email(email):
        return True
    return False


@bp.post('/login')
def login():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    email = str(payload.get('email', '')).strip().lower()
    if not name or not phone:
        return jsonify({'error': 'Name and phone are required.'}), 400
    is_admin = is_admin_phone(phone) or (bool(email) and is_admin_email(email))
    resp: dict = {'name': name, 'phone': phone, 'isAdmin': is_admin}
    if email:
        resp['email'] = email
    return jsonify(resp)


@bp.get('/locations')
def get_locations():
    return jsonify(load_locations())


@bp.get('/menu')
def get_menu():
    return jsonify(load_menu())


@bp.get('/orders')
def get_orders():
    phone_filter = request.args.get('phone', '').strip()
    orders = list_orders()
    if phone_filter and not _is_admin():
        orders = [o for o in orders if o.get('phone') == phone_filter]
    return jsonify(orders)


@bp.get('/orders/<order_id>')
def get_single_order(order_id: str):
    order = get_order(order_id)
    if order is None:
        return jsonify({'error': 'Order not found.'}), 404
    return jsonify(order)


@bp.post('/orders')
def create_order():
    payload = request.get_json(silent=True) or {}
    customer_name = str(payload.get('customerName', '')).strip()
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    pickup_time = str(payload.get('pickupTime', '')).strip()
    items = payload.get('items') or []
    location_id = str(payload.get('locationId', '')).strip()
    location_name = str(payload.get('locationName', '')).strip()

    if not customer_name or not phone or not pickup_time:
        return jsonify({'error': 'Customer name, phone, and pickup time are required.'}), 400
    if not isinstance(items, list) or not items:
        return jsonify({'error': 'At least one cart item is required.'}), 400

    normalized_items = []
    total = 0.0
    for item in items:
        item_id = str(item.get('id', '')).strip()
        name = str(item.get('name', '')).strip()
        try:
            qty = int(item.get('qty', 0))
            price = float(item.get('price', 0))
        except (TypeError, ValueError):
            return jsonify({'error': 'Each item must include a valid quantity and price.'}), 400
        if not item_id or not name or qty <= 0 or price < 0:
            return jsonify({'error': 'Each item must include id, name, positive qty, and price.'}), 400

        line_total = round(qty * price, 2)
        total += line_total
        normalized_items.append(
            {
                'id': item_id,
                'name': name,
                'qty': qty,
                'price': round(price, 2),
                'lineTotal': line_total,
            }
        )

    order = {
        'id': str(uuid4()),
        'customerName': customer_name,
        'phone': phone,
        'pickupTime': pickup_time,
        'locationId': location_id,
        'locationName': location_name,
        'items': normalized_items,
        'total': round(total, 2),
        'status': 'Pending',
        'prepMinutes': suggested_prep_minutes(normalized_items),
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'acceptedAt': None,
        'readyAt': None,
    }
    save_order(order)
    return jsonify(order), 201


@bp.patch('/orders/<order_id>')
def patch_order(order_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403

    order = get_order(order_id)
    if order is None:
        return jsonify({'error': 'Order not found.'}), 404

    payload = request.get_json(silent=True) or {}
    updates: dict = {}

    if 'status' in payload:
        new_status = str(payload['status']).strip()
        if new_status not in VALID_STATUSES:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(VALID_STATUSES)}'}), 400
        updates['status'] = new_status
        now = datetime.now(timezone.utc).isoformat()
        if new_status == 'Accepted' and not order.get('acceptedAt'):
            updates['acceptedAt'] = now
        if new_status == 'Ready' and not order.get('readyAt'):
            updates['readyAt'] = now

    if 'prepMinutes' in payload:
        try:
            prep = int(payload['prepMinutes'])
            if prep < 1:
                raise ValueError
            updates['prepMinutes'] = prep
        except (TypeError, ValueError):
            return jsonify({'error': 'prepMinutes must be a positive integer.'}), 400

    updated = update_order(order_id, updates)
    return jsonify(updated)


# ── Admin management routes ──────────────────────────────────────────────────

@bp.get('/admin/admins')
def get_admins():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    stored = load_admins()
    return jsonify({
        'builtinPhones': sorted(BUILTIN_ADMIN_PHONES),
        'phones': stored.get('phones', []),
        'emails': stored.get('emails', []),
    })


@bp.post('/admin/admins')
def add_admin():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    email = str(payload.get('email', '')).strip().lower()
    if not phone and not email:
        return jsonify({'error': 'phone or email is required.'}), 400
    stored = load_admins()
    if phone:
        if phone not in stored['phones'] and phone not in BUILTIN_ADMIN_PHONES:
            stored.setdefault('phones', []).append(phone)
    if email:
        if email not in stored.get('emails', []) and email != ADMIN_EMAIL:
            stored.setdefault('emails', []).append(email)
    save_admins(stored)
    return jsonify({'ok': True, 'phones': stored.get('phones', []), 'emails': stored.get('emails', [])})


@bp.delete('/admin/admins')
def remove_admin():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    email = str(payload.get('email', '')).strip().lower()
    if not phone and not email:
        return jsonify({'error': 'phone or email is required.'}), 400
    if phone and phone in BUILTIN_ADMIN_PHONES:
        return jsonify({'error': 'Cannot remove a built-in admin phone.'}), 400
    stored = load_admins()
    if phone and phone in stored.get('phones', []):
        stored['phones'].remove(phone)
    if email and email in stored.get('emails', []):
        stored['emails'].remove(email)
    save_admins(stored)
    return jsonify({'ok': True, 'phones': stored.get('phones', []), 'emails': stored.get('emails', [])})


# ── Data folder browser routes ───────────────────────────────────────────────

@bp.get('/admin/data')
def browse_data():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(list_data_files())


@bp.get('/admin/data/file')
def read_data():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    rel_path = request.args.get('path', '').strip()
    if not rel_path:
        return jsonify({'error': 'path is required.'}), 400
    content = read_data_file(rel_path)
    if content is None:
        return jsonify({'error': 'File not found or not readable.'}), 404
    return jsonify({'path': rel_path, 'content': content})


# ── Users route ──────────────────────────────────────────────────────────────

@bp.get('/admin/users')
def admin_get_users():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(list_users())


# ── Menu management routes ───────────────────────────────────────────────────

@bp.get('/admin/menu')
def admin_get_menu():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(load_menu())


@bp.post('/admin/menu')
def admin_add_menu_item():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    category = str(payload.get('category', '')).strip()
    if not name or not category:
        return jsonify({'error': 'name and category are required.'}), 400
    try:
        price = float(payload.get('price', 0))
        if price < 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'price must be a non-negative number.'}), 400
    item = add_menu_item({
        'name': name,
        'category': category,
        'price': price,
        'unit': str(payload.get('unit', '')).strip(),
        'description': str(payload.get('description', '')).strip(),
    })
    return jsonify(item), 201


@bp.patch('/admin/menu/<item_id>')
def admin_patch_menu_item(item_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    updates: dict = {}
    if 'name' in payload:
        name = str(payload['name']).strip()
        if not name:
            return jsonify({'error': 'name cannot be empty.'}), 400
        updates['name'] = name
    if 'price' in payload:
        try:
            price = float(payload['price'])
            if price < 0:
                raise ValueError
            updates['price'] = round(price, 2)
        except (TypeError, ValueError):
            return jsonify({'error': 'price must be a non-negative number.'}), 400
    if 'unit' in payload:
        updates['unit'] = str(payload['unit']).strip()
    if 'description' in payload:
        updates['description'] = str(payload['description']).strip()
    if 'category' in payload:
        updates['category'] = str(payload['category']).strip()
    if not updates:
        return jsonify({'error': 'No valid fields provided.'}), 400
    item = update_menu_item(item_id, updates)
    if item is None:
        return jsonify({'error': 'Menu item not found.'}), 404
    return jsonify(item)


@bp.delete('/admin/menu/<item_id>')
def admin_delete_menu_item(item_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    deleted = delete_menu_item(item_id)
    if not deleted:
        return jsonify({'error': 'Menu item not found.'}), 404
    return jsonify({'ok': True})


# ── Settings routes ──────────────────────────────────────────────────────────

@bp.get('/admin/settings')
def admin_get_settings():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(load_settings())


@bp.patch('/admin/settings')
def admin_patch_settings():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    settings = load_settings()
    if 'chickenPrepMinutes' in payload:
        try:
            val = int(payload['chickenPrepMinutes'])
            if val < 1:
                raise ValueError
            settings['chickenPrepMinutes'] = val
        except (TypeError, ValueError):
            return jsonify({'error': 'chickenPrepMinutes must be a positive integer.'}), 400
    if 'goatPrepMinutes' in payload:
        try:
            val = int(payload['goatPrepMinutes'])
            if val < 1:
                raise ValueError
            settings['goatPrepMinutes'] = val
        except (TypeError, ValueError):
            return jsonify({'error': 'goatPrepMinutes must be a positive integer.'}), 400
    save_settings(settings)
    return jsonify(settings)


# ── Location management routes ────────────────────────────────────────────────

@bp.get('/admin/locations')
def admin_get_locations():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(load_locations())


@bp.post('/admin/locations')
def admin_add_location():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    if not name:
        return jsonify({'error': 'name is required.'}), 400
    loc = add_location({
        'name': name,
        'address': str(payload.get('address', '')).strip(),
        'phone': str(payload.get('phone', '')).strip(),
        'hours': payload.get('hours'),
    })
    return jsonify(loc), 201


@bp.patch('/admin/locations/<loc_id>')
def admin_patch_location(loc_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    updates: dict = {}
    for field in ('name', 'address', 'phone', 'hours'):
        if field in payload:
            updates[field] = payload[field]
    if not updates:
        return jsonify({'error': 'No valid fields provided.'}), 400
    loc = update_location(loc_id, updates)
    if loc is None:
        return jsonify({'error': 'Location not found.'}), 404
    return jsonify(loc)


@bp.delete('/admin/locations/<loc_id>')
def admin_delete_location(loc_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    deleted = delete_location(loc_id)
    if not deleted:
        return jsonify({'error': 'Location not found.'}), 404
    return jsonify({'ok': True})
