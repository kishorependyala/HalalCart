from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request

from ..data import (
    ADMIN_EMAIL,
    ADMIN_PHONE,
    get_order,
    list_orders,
    save_order,
    suggested_prep_minutes,
    update_order,
)

bp = Blueprint('api', __name__)

MENU = [
    {'id': 'g1', 'category': 'Goat', 'name': 'Whole Goat', 'price': 180.00, 'unit': 'per animal', 'description': 'Fresh whole goat, cleaned and cut to order'},
    {'id': 'g2', 'category': 'Goat', 'name': 'Half Goat', 'price': 95.00, 'unit': 'per half', 'description': 'Half goat, mixed cuts'},
    {'id': 'g3', 'category': 'Goat', 'name': 'Goat Leg', 'price': 35.00, 'unit': 'per leg', 'description': 'Bone-in goat leg, great for biryani'},
    {'id': 'g4', 'category': 'Goat', 'name': 'Goat Shoulder', 'price': 28.00, 'unit': 'per lb', 'description': 'Tender goat shoulder, perfect for curry'},
    {'id': 'g5', 'category': 'Goat', 'name': 'Goat Chops', 'price': 22.00, 'unit': 'per lb', 'description': 'Goat rib chops, halal certified'},
    {'id': 'g6', 'category': 'Goat', 'name': 'Goat Keema', 'price': 18.00, 'unit': 'per lb', 'description': 'Fresh ground goat meat'},
    {'id': 'c1', 'category': 'Chicken', 'name': 'Whole Chicken', 'price': 12.00, 'unit': 'per bird', 'description': 'Fresh whole chicken, halal slaughtered'},
    {'id': 'c2', 'category': 'Chicken', 'name': 'Chicken Leg Quarters', 'price': 3.50, 'unit': 'per lb', 'description': 'Juicy leg quarters, skin-on'},
    {'id': 'c3', 'category': 'Chicken', 'name': 'Boneless Breast', 'price': 5.99, 'unit': 'per lb', 'description': 'Skinless boneless chicken breast'},
    {'id': 'c4', 'category': 'Chicken', 'name': 'Chicken Wings', 'price': 4.50, 'unit': 'per lb', 'description': 'Fresh chicken wings'},
    {'id': 'c5', 'category': 'Chicken', 'name': 'Chicken Keema', 'price': 4.99, 'unit': 'per lb', 'description': 'Ground chicken, great for kebabs'},
    {'id': 's1', 'category': 'Snacks', 'name': 'Samosa (4 pc)', 'price': 4.00, 'unit': 'per pack', 'description': 'Crispy fried pastry with spiced potato filling'},
    {'id': 's2', 'category': 'Snacks', 'name': 'Chicken Samosa (4 pc)', 'price': 5.00, 'unit': 'per pack', 'description': 'Samosa filled with spiced chicken'},
    {'id': 's3', 'category': 'Snacks', 'name': 'Pakora (8 pc)', 'price': 5.00, 'unit': 'per pack', 'description': 'Crispy fried vegetable fritters'},
    {'id': 's4', 'category': 'Snacks', 'name': 'Seekh Kebab (4 pc)', 'price': 8.00, 'unit': 'per pack', 'description': 'Grilled minced meat kebabs on skewers'},
]

VALID_STATUSES = {'Pending', 'Accepted', 'Ready', 'Completed'}


@bp.get('/health')
def health():
    import os
    data_dir = os.getenv('DATA_DIR', 'data')
    return jsonify({'status': 'ok', 'dataDir': data_dir})


def _is_admin() -> bool:
    phone = (request.headers.get('X-Admin-Phone') or '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if phone == ADMIN_PHONE:
        return True
    if ADMIN_EMAIL:
        email = (request.headers.get('X-Admin-Email') or '').strip().lower()
        return email == ADMIN_EMAIL
    return False


@bp.post('/login')
def login():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    email = str(payload.get('email', '')).strip().lower()
    if not name or not phone:
        return jsonify({'error': 'Name and phone are required.'}), 400
    is_admin = (phone == ADMIN_PHONE) or (bool(ADMIN_EMAIL) and email == ADMIN_EMAIL)
    resp: dict = {'name': name, 'phone': phone, 'isAdmin': is_admin}
    if email:
        resp['email'] = email
    return jsonify(resp)


@bp.get('/menu')
def get_menu():
    return jsonify(MENU)


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
