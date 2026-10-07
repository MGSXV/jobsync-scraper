"""DataFrame -> JSON normalization.

``scrape_jobs`` returns a pandas DataFrame whose missing values are a mix of
``NaN``, ``NaT`` and ``None`` depending on column dtype, none of which survive
``json.dumps``. Normalizing here (rather than in JobSync) keeps the wire format
boring: every absent value is ``null``, every date is an ISO string.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Any

import pandas as pd

from .schema import ScrapedJob, ScrapedSalary

# Suffix shown after a salary figure, by JobSpy's CompensationInterval values.
_INTERVAL_SUFFIX = {
    "yearly": "yr",
    "monthly": "mo",
    "weekly": "wk",
    "daily": "day",
    "hourly": "hr",
}

_CURRENCY_SYMBOL = {"USD": "$", "CAD": "$", "EUR": "€", "GBP": "£"}


def clean(value: Any) -> Any:
    """Collapse pandas' several flavours of 'missing' to None."""
    if value is None:
        return None
    # pd.isna raises on list-likes, which `emails`/`skills` can still be if a
    # future JobSpy stops joining them into strings.
    if isinstance(value, (list, tuple, set, dict)):
        return value or None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def _as_iso_date(value: Any) -> str | None:
    value = clean(value)
    if value is None:
        return None
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    # Already a string (or something stringly) -- trust it rather than guess a
    # parse format; JobSync treats postedDate as opaque display text.
    return str(value)


def _as_bool(value: Any) -> bool | None:
    value = clean(value)
    return None if value is None else bool(value)


def _as_str(value: Any) -> str | None:
    value = clean(value)
    if value is None:
        return None
    if isinstance(value, (list, tuple, set)):
        return ", ".join(str(v) for v in value) or None
    text = str(value).strip()
    return text or None


def _as_float(value: Any) -> float | None:
    value = clean(value)
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(parsed) or math.isinf(parsed) else parsed


def _format_amount(amount: float) -> str:
    # Hourly/daily rates need their cents; annual figures read better whole.
    if amount < 1000 and amount != int(amount):
        return f"{amount:,.2f}"
    return f"{amount:,.0f}"


def build_salary(row: dict[str, Any]) -> ScrapedSalary:
    minimum = _as_float(row.get("min_amount"))
    maximum = _as_float(row.get("max_amount"))
    interval = _as_str(row.get("interval"))
    currency = _as_str(row.get("currency"))
    source = _as_str(row.get("salary_source"))

    text: str | None = None
    if minimum is not None or maximum is not None:
        symbol = _CURRENCY_SYMBOL.get((currency or "").upper(), "")
        prefix = symbol or (f"{currency} " if currency else "")
        if minimum is not None and maximum is not None and minimum != maximum:
            body = f"{prefix}{_format_amount(minimum)} - {prefix}{_format_amount(maximum)}"
        else:
            single = minimum if minimum is not None else maximum
            body = f"{prefix}{_format_amount(single)}"
        suffix = _INTERVAL_SUFFIX.get((interval or "").lower())
        text = f"{body}/{suffix}" if suffix else body

    return ScrapedSalary(
        min_amount=minimum,
        max_amount=maximum,
        interval=interval,
        currency=currency,
        source=source,
        text=text,
    )


def normalize_row(row: dict[str, Any]) -> ScrapedJob | None:
    """Map one DataFrame record to the wire shape.

    Returns None for rows that cannot be used downstream. A job with no URL has
    no stable identity for JobSync's dedupe key, and one with no title has
    nothing to rank or display -- both are dropped rather than persisted as a
    placeholder the user has to clean up.
    """
    job_url = _as_str(row.get("job_url"))
    title = _as_str(row.get("title"))
    if not job_url or not title:
        return None

    return ScrapedJob(
        site=_as_str(row.get("site")) or "unknown",
        title=title,
        company=_as_str(row.get("company")),
        company_url=_as_str(row.get("company_url")),
        job_url=job_url,
        job_url_direct=_as_str(row.get("job_url_direct")),
        location=_as_str(row.get("location")),
        description=_as_str(row.get("description")),
        job_type=_as_str(row.get("job_type")),
        date_posted=_as_iso_date(row.get("date_posted")),
        is_remote=_as_bool(row.get("is_remote")),
        job_level=_as_str(row.get("job_level")),
        company_industry=_as_str(row.get("company_industry")),
        company_logo=_as_str(row.get("company_logo")),
        work_from_home_type=_as_str(row.get("work_from_home_type")),
        skills=_as_str(row.get("skills")),
        salary=build_salary(row),
    )


def normalize_frame(frame: pd.DataFrame) -> list[ScrapedJob]:
    if frame is None or frame.empty:
        return []
    jobs: list[ScrapedJob] = []
    for record in frame.to_dict(orient="records"):
        job = normalize_row(record)
        if job is not None:
            jobs.append(job)
    return jobs
