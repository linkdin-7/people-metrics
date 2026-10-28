import json
from dataclasses import dataclass
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "data" / "countries.json"


class UnknownCountryError(ValueError):
    pass


@dataclass(frozen=True)
class Country:
    code: str
    name: str
    currency: str | None


# Read once when the module is imported: code -> Country, plus all valid currency codes.
data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
COUNTRIES = {entry["code"]: Country(**entry) for entry in data["countries"]}
CURRENCIES = frozenset(data["currencies"])


def list_countries() -> list[Country]:
    return sorted(COUNTRIES.values(), key=lambda country: country.name)


def list_currencies() -> list[str]:
    return sorted(CURRENCIES)


def is_valid_country(code: str | None) -> bool:
    return code in COUNTRIES


def is_valid_currency(code: str | None) -> bool:
    return code in CURRENCIES


def default_currency_for(code: str) -> str | None:
    if code not in COUNTRIES:
        raise UnknownCountryError(code)
    return COUNTRIES[code].currency
