from decimal import Decimal
from app.routers.reimbursements import compute_amounts, KM_RATE_EUR


def test_km_rate_is_032():
    assert KM_RATE_EUR == Decimal("0.32")


def test_compute_amounts_basic():
    km_amount, total = compute_amounts(Decimal("10"), Decimal("100"), Decimal("5"))
    assert km_amount == Decimal("32.00")      # 100 km * 0.32
    assert total == Decimal("47.00")          # 10 + 32 + 5


def test_compute_amounts_rounding():
    km_amount, total = compute_amounts(Decimal("0"), Decimal("33.33"), Decimal("0"))
    assert km_amount == Decimal("10.67")      # 33.33 * 0.32 = 10.6656 -> 10.67
    assert total == Decimal("10.67")
