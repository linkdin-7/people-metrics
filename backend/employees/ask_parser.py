"""Turns a plain-English question into a structured query, using fixed rules and no AI model."""

import re
from dataclasses import dataclass
from datetime import date
from difflib import get_close_matches

EXAMPLE_QUESTIONS = (
    "What is the median salary of software engineers in India?",
    "Which department has the highest average salary in Germany?",
    "How many employees earn more than 100,000 USD?",
    "Top 5 job titles by average salary in the UK",
    "How many employees are in each country?",
)

UNITS = {"k": 1000, "thousand": 1000, "m": 1000000, "million": 1000000}
AMOUNT = r"(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?(?![a-z0-9])"
GROUP_NOUN = r"(countries|country|departments|department|teams|team|job titles|job title|roles|role|titles|title)"
GROUP_BY_FIELD = {
    "countries": "country", "country": "country",
    "departments": "department", "department": "department", "teams": "department", "team": "department",
    "job titles": "job_title", "job title": "job_title", "roles": "job_title", "role": "job_title",
    "titles": "job_title", "title": "job_title",
}
HIGH_WORDS = r"\b(?:highest|best|most|largest|biggest|greatest|top)\b"
LOW_WORDS = r"\b(?:lowest|least|smallest|fewest|cheapest|bottom)\b"
COUNT_NOUN = r"\b(?:employees|employee|people|persons|staff|workers)\b"
SALARY_WORD = r"\b(?:salary|salaries|pay|wage|wages|compensation|income)\b"
MAX_RANKING = 50

# Ordinary words that carry no meaning for the rules. A leftover word NOT in this list is reported.
STOP_WORDS = set(
    """a an the of in on at for from to by per is are was were be been do does did has have had what which who
    how many much there their they it its that this these those and or with without than as all any each every
    our my we us me you your please tell show give list can could would will currently now right
    employees employee people person persons staff worker workers salary salaries pay paid earn earns earning
    earnings wage wages compensation income total overall department departments team teams country countries
    job jobs title titles role roles company organisation organization acme more less over under above below
    between and to""".split()
)


@dataclass(frozen=True)
class Vocabulary:
    countries: dict[str, str]
    country_names: dict[str, str]
    departments: dict[str, str]
    job_titles: dict[str, str]
    currencies: frozenset[str]


@dataclass
class QuerySpec:
    metric: str
    group_by: str | None = None
    country: str | None = None
    department: str | None = None
    job_title: str | None = None
    currency: str | None = None
    min_salary: int | None = None
    max_salary: int | None = None
    salary_description: str | None = None
    limit: int | None = None
    order: str | None = None


@dataclass
class ParseOutcome:
    status: str
    spec: QuerySpec | None = None
    message: str = ""
    suggestions: tuple[str, ...] = ()


def clarification(message: str, suggestions: tuple[str, ...] = ()) -> ParseOutcome:
    return ParseOutcome("needs_clarification", message=message, suggestions=suggestions)


class Text:
    """The lowercase question; parts that were understood are blanked so nothing is read twice."""

    def __init__(self, value: str):
        self.value = value

    def blank(self, start: int, end: int) -> None:
        self.value = self.value[:start] + " " * (end - start) + self.value[end:]

    def take(self, pattern: str) -> re.Match | None:
        match = re.search(pattern, self.value)
        if match:
            self.blank(match.start(), match.end())
        return match

    def take_all(self, pattern: str) -> list[re.Match]:
        matches = list(re.finditer(pattern, self.value))
        for match in matches:
            self.blank(match.start(), match.end())
        return matches

    def has(self, pattern: str) -> bool:
        return re.search(pattern, self.value) is not None


def amount_value(number: str, unit: str | None) -> int:
    return round(float(number.replace(",", "")) * UNITS.get(unit or "", 1))


def take_currency(text: Text, vocabulary: Vocabulary) -> str | None:
    for match in re.finditer(r"\b[a-z]{3}\b", text.value):
        code = match.group().upper()
        if match.group() not in STOP_WORDS and code in vocabulary.currencies:
            text.blank(match.start(), match.end())
            return code
    return None


def take_salary_filters(text: Text) -> tuple[int | None, int | None, str | None]:
    low = high = None
    parts = []

    between = text.take(rf"\bbetween\s+{AMOUNT}\s+(?:and|to)\s+{AMOUNT}")
    if between:
        low = amount_value(between.group(1), between.group(2) or between.group(4))
        high = amount_value(between.group(3), between.group(4))
        parts.append(f"between {low:,} and {high:,}")

    above = text.take(rf"\b(?:more than|greater than|above|over)\s+{AMOUNT}")
    if above:
        amount = amount_value(above.group(1), above.group(2))
        low = amount + 1
        parts.append(f"above {amount:,}")

    below = text.take(rf"\b(?:less than|under|below)\s+{AMOUNT}")
    if below:
        amount = amount_value(below.group(1), below.group(2))
        high = amount - 1
        parts.append(f"below {amount:,}")
    return low, high, " and ".join(parts) or None


def find_entities(text: Text, phrases: dict[str, str], allow_plural: bool) -> list[str]:
    found: list[str] = []
    suffix = r"(?:e?s)?" if allow_plural else ""
    for phrase in sorted(phrases, key=len, reverse=True):
        pattern = rf"(?<![a-z0-9]){re.escape(phrase)}{suffix}(?![a-z0-9])"
        for match in list(re.finditer(pattern, text.value)):
            text.blank(match.start(), match.end())
            if phrases[phrase] not in found:
                found.append(phrases[phrase])
    return found


def find_country_codes(text: Text, source: str, vocabulary: Vocabulary) -> list[str]:
    found = []
    for match in re.finditer(r"\b[A-Z]{2}\b", source):
        if match.group() in vocabulary.country_names and text.value[match.start():match.end()].strip():
            text.blank(match.start(), match.end())
            found.append(match.group())
    return found


def explain_unrecognised(words: list[str], original: str, vocabulary: Vocabulary) -> ParseOutcome:
    phrase = " ".join(words)
    names = {name: name.title() for name in vocabulary.departments}
    names.update(vocabulary.departments)
    names.update({title.lower(): title for title in vocabulary.job_titles.values()})
    names.update({name: vocabulary.country_names[code] for name, code in vocabulary.countries.items()})

    options = [names[match] for match in get_close_matches(phrase, list(names), n=3, cutoff=0.8)]
    singular = {word.rstrip("s") for word in words}
    options += [title for title in sorted(vocabulary.job_titles.values()) if singular & set(title.lower().split())]
    options = list(dict.fromkeys(options))[:4]

    message = f"I didn't understand '{phrase}'."
    if options:
        message += f" Did you mean {' or '.join(options)}?"
    suggestions = tuple(re.sub(re.escape(phrase), option, original, count=1, flags=re.IGNORECASE) for option in options)
    return clarification(message, suggestions)


def statistic_suggestions(spec: QuerySpec, vocabulary: Vocabulary) -> tuple[str, ...]:
    suffix = f" of {spec.job_title}" if spec.job_title else ""
    suffix += f" in {spec.department}" if spec.department else ""
    suffix += f" in {vocabulary.country_names[spec.country]}" if spec.country else ""
    return tuple(f"What is the {name} salary{suffix}?" for name in ("median", "average", "lowest", "highest"))


def parse_question(question: str, vocabulary: Vocabulary, today: date) -> ParseOutcome:
    original = question.strip()
    text = Text(original.lower())

    min_salary, max_salary, salary_description = take_salary_filters(text)

    order = limit = group_by = None
    ranking = text.take(rf"\b(top|bottom)\s+(\d+)(?:\s+{GROUP_NOUN})?(?![a-z])")
    if ranking:
        limit = min(max(int(ranking.group(2)), 1), MAX_RANKING)
        order = "highest" if ranking.group(1) == "top" else "lowest"
        if ranking.group(3):
            group_by = GROUP_BY_FIELD[ranking.group(3)]

    each = text.take(rf"\b(?:by|per|for each|in each|of each|across|each|every)\s+{GROUP_NOUN}\b")
    if each:
        group_by = GROUP_BY_FIELD[each.group(1)]
    which = text.take(rf"\b(?:which|what)\s+(?:is\s+|are\s+)?(?:the\s+)?{GROUP_NOUN}\b")
    if which:
        group_by = group_by or GROUP_BY_FIELD[which.group(1)]
        limit = limit or 1
    plural = text.take(r"\b(countries|departments|teams|job titles|roles|titles)\b")
    if plural:
        group_by = group_by or GROUP_BY_FIELD[plural.group(1)]

    stats = set()
    for pattern, name in ((r"\bmedian\b", "median"), (r"\b(?:average|avg|mean)\b", "average"),
                          (r"\b(?:maximum|max)\b", "max"), (r"\b(?:minimum|min)\b", "min")):
        if text.take(pattern):
            stats.add(name)
    counting = text.take(r"\b(?:how many|number of|count|headcount)\b") is not None
    if len(stats) > 1:
        return clarification("I can give one statistic at a time. Which one: median, average, lowest or highest?")

    highs = text.take_all(HIGH_WORDS)
    lows = text.take_all(LOW_WORDS)
    if highs and lows:
        return clarification("I couldn't tell whether you want the highest or the lowest. Which one?")
    if order is None and (highs or lows):
        order = "highest" if highs else "lowest"

    currency = take_currency(text, vocabulary)
    job_titles = find_entities(text, vocabulary.job_titles, allow_plural=True)
    departments = find_entities(text, vocabulary.departments, allow_plural=True)
    country_codes = find_entities(text, vocabulary.countries, allow_plural=False)
    for code in find_country_codes(text, original, vocabulary):
        if code not in country_codes:
            country_codes.append(code)
    for label, found in (("job title", job_titles), ("department", departments), ("country", country_codes)):
        if len(found) > 1:
            return clarification(f"I can only look at one {label} at a time. Which one did you mean?")

    job_title = job_titles[0] if job_titles else None
    department = departments[0] if departments else None
    country = country_codes[0] if country_codes else None
    has_filter = min_salary is not None or max_salary is not None
    mentions_pay = text.has(SALARY_WORD) or text.has(COUNT_NOUN)

    recognised = any([stats, counting, highs, lows, group_by, job_title, department, country, has_filter, currency])
    if not recognised and not mentions_pay:
        return ParseOutcome(
            "unsupported",
            message="I can answer questions about employee counts and salary statistics. Here are some examples.",
            suggestions=EXAMPLE_QUESTIONS,
        )

    leftover = [word for word in re.findall(r"[a-z][a-z'-]*", text.value) if word not in STOP_WORDS]
    if leftover:
        return explain_unrecognised(leftover[:3], original, vocabulary)

    if limit and not group_by:
        return clarification(
            f"{'Top' if order == 'highest' else 'Bottom'} {limit} of what? Add what to rank, "
            "for example 'job titles', 'departments' or 'countries'.",
            ("Top 5 job titles by average salary in the UK", "Top 3 departments by headcount"),
        )

    metric = next(iter(stats), None)
    if metric is None and counting:
        metric = "headcount"
    if metric is None and (highs or lows) and text.has(SALARY_WORD) and not text.has(COUNT_NOUN):
        metric = "max" if highs else "min"
    if metric is None and text.has(COUNT_NOUN) and (not text.has(SALARY_WORD) or has_filter):
        metric = "headcount"
    spec = QuerySpec(
        metric=metric or "", group_by=group_by, country=country, department=department, job_title=job_title,
        currency=currency, min_salary=min_salary, max_salary=max_salary, salary_description=salary_description,
        limit=limit, order=order or ("highest" if group_by else None),
    )
    if metric is None:
        return clarification(
            "Which statistic would you like: median, average, lowest or highest salary?",
            statistic_suggestions(spec, vocabulary),
        )
    return ParseOutcome("understood", spec)
