import json
from pathlib import Path

import pycountry
from babel.numbers import get_territory_currencies

OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent / "employees" / "data" / "countries.json"
)

# Territories where the source lists several currencies; the local currency is chosen explicitly.
DEFAULT_CURRENCY_OVERRIDES = {
    "BT": "BTN",
    "HT": "HTG",
    "LS": "LSL",
    "NA": "NAD",
    "PA": "PAB",
    "PS": "ILS",
    "ZW": "USD",
}


def build_country_entry(country) -> dict:
    currencies = get_territory_currencies(country.alpha_2)
    default_currency = DEFAULT_CURRENCY_OVERRIDES.get(
        country.alpha_2, currencies[0] if currencies else None
    )
    return {
        "code": country.alpha_2,
        "name": getattr(country, "common_name", country.name),
        "currency": default_currency,
    }


def collect_currencies() -> list[str]:
    return sorted(
        {
            currency
            for country in pycountry.countries
            for currency in get_territory_currencies(country.alpha_2)
        }
    )


def main() -> None:
    countries = sorted(
        (build_country_entry(country) for country in pycountry.countries),
        key=lambda entry: entry["code"],
    )
    payload = {"countries": countries, "currencies": collect_currencies()}
    OUTPUT_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
