import pytest

from employees.countries import (
    UnknownCountryError,
    default_currency_for,
    is_valid_country,
    is_valid_currency,
    list_countries,
    list_currencies,
)


def test_every_country_has_a_unique_uppercase_two_letter_code():
    codes = [country.code for country in list_countries()]

    assert len(codes) == len(set(codes))
    assert all(len(code) == 2 and code.isupper() for code in codes)


def test_every_country_has_a_name():
    assert all(country.name for country in list_countries())


def test_countries_are_sorted_by_name():
    names = [country.name for country in list_countries()]

    assert names == sorted(names)


def test_list_contains_the_full_iso_set():
    assert len(list_countries()) >= 240


def test_only_antarctica_has_no_default_currency():
    without_currency = [c.code for c in list_countries() if c.currency is None]

    assert without_currency == ["AQ"]


def test_every_default_currency_is_a_valid_currency():
    assert all(
        is_valid_currency(country.currency)
        for country in list_countries()
        if country.currency
    )


@pytest.mark.parametrize(
    "code, currency",
    [("IN", "INR"), ("DE", "EUR"), ("US", "USD"), ("GB", "GBP"), ("BT", "BTN")],
)
def test_default_currency_of_known_countries(code, currency):
    assert default_currency_for(code) == currency


def test_default_currency_for_antarctica_is_none():
    assert default_currency_for("AQ") is None


def test_default_currency_for_unknown_country_raises():
    with pytest.raises(UnknownCountryError):
        default_currency_for("ZZ")


@pytest.mark.parametrize("code", ["IN", "US", "DE"])
def test_known_country_codes_are_valid(code):
    assert is_valid_country(code)


@pytest.mark.parametrize("code", ["ZZ", "in", "IND", "", None])
def test_unknown_or_malformed_country_codes_are_invalid(code):
    assert not is_valid_country(code)


@pytest.mark.parametrize("code", ["INR", "USD", "EUR", "ZWG"])
def test_known_currency_codes_are_valid(code):
    assert is_valid_currency(code)


@pytest.mark.parametrize("code", ["ABC", "inr", "US", "", None])
def test_unknown_or_malformed_currency_codes_are_invalid(code):
    assert not is_valid_currency(code)


def test_currency_list_is_sorted_and_unique():
    currencies = list_currencies()

    assert currencies == sorted(set(currencies))
