from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request

from ..data import list_orders, save_order

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


@bp.get('/menu')
def get_menu():
    return jsonify(MENU)


@bp.get('/orders')
def get_orders():
    return jsonify(list_orders())


@bp.post('/orders')
def create_order():
    payload = request.get_json(silent=True) or {}
    customer_name = str(payload.get('customerName', '')).strip()
    phone = str(payload.get('phone', '')).strip()
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
        'createdAt': datetime.now(timezone.utc).isoformat(),
    }
    save_order(order)
    return jsonify(order), 201
