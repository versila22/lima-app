"""Reimbursement router — soumission membre, relecture 5 min, suivi admin."""

from decimal import Decimal, ROUND_HALF_UP

KM_RATE_EUR = Decimal("0.32")


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_amounts(
    direct_expenses: Decimal, km_distance: Decimal, toll: Decimal
) -> tuple[Decimal, Decimal]:
    """Recalcule serveur : (montant km, total). Jamais le front."""
    km_amount = _round2(km_distance * KM_RATE_EUR)
    total = _round2(direct_expenses + km_amount + toll)
    return km_amount, total
