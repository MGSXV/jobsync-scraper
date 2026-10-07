from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.normalize import build_salary, clean, normalize_frame, normalize_row


def row(**overrides):
    base = {
        "site": "indeed",
        "title": "Senior Backend Engineer",
        "company": "Acme Corp",
        "job_url": "https://www.indeed.com/viewjob?jk=abc123",
        "location": "Calgary, AB, Canada",
        "description": "Build things.",
    }
    base.update(overrides)
    return base


class TestClean:
    @pytest.mark.parametrize("value", [None, np.nan, float("nan"), pd.NaT])
    def test_missing_values_become_none(self, value):
        assert clean(value) is None

    def test_infinity_is_dropped(self):
        assert clean(float("inf")) is None

    def test_zero_and_false_survive(self):
        # Guards against a truthiness check sneaking in: 0 and False are real
        # values, not absences.
        assert clean(0) == 0
        assert clean(False) is False

    def test_empty_list_becomes_none(self):
        assert clean([]) is None


class TestNormalizeRow:
    def test_maps_core_fields(self):
        job = normalize_row(row())
        assert job is not None
        assert job.title == "Senior Backend Engineer"
        assert job.company == "Acme Corp"
        assert job.site == "indeed"
        assert job.location == "Calgary, AB, Canada"

    def test_drops_row_without_url(self):
        # No URL means no stable dedupe identity in JobSync.
        assert normalize_row(row(job_url=None)) is None
        assert normalize_row(row(job_url="  ")) is None

    def test_drops_row_without_title(self):
        assert normalize_row(row(title=None)) is None

    def test_drops_row_without_company(self):
        # JobSync's Job.companyId is a required relation; an empty name would
        # mint one blank Company row shared by every such job. Indeed omits
        # the employer on some listings.
        assert normalize_row(row(company=None)) is None
        assert normalize_row(row(company="   ")) is None

    def test_date_posted_becomes_iso_string(self):
        job = normalize_row(row(date_posted=pd.Timestamp("2026-03-04")))
        assert job.date_posted == "2026-03-04"

    def test_missing_date_posted_is_none(self):
        assert normalize_row(row(date_posted=pd.NaT)).date_posted is None

    def test_is_remote_nan_stays_none_not_false(self):
        # A board that does not report remoteness must not be recorded as
        # explicitly on-site.
        assert normalize_row(row(is_remote=np.nan)).is_remote is None
        assert normalize_row(row(is_remote=True)).is_remote is True

    def test_skills_list_is_joined(self):
        job = normalize_row(row(skills=["python", "django"]))
        assert job.skills == "python, django"


class TestBuildSalary:
    def test_range_with_interval(self):
        salary = build_salary(
            {
                "min_amount": 120000.0,
                "max_amount": 150000.0,
                "interval": "yearly",
                "currency": "USD",
                "salary_source": "direct_data",
            }
        )
        assert salary.text == "$120,000 - $150,000/yr"
        assert salary.min_amount == 120000.0
        assert salary.source == "direct_data"

    def test_hourly_rate_keeps_cents(self):
        salary = build_salary(
            {"min_amount": 32.5, "max_amount": 47.75, "interval": "hourly", "currency": "USD"}
        )
        assert salary.text == "$32.50 - $47.75/hr"

    def test_single_amount(self):
        salary = build_salary({"min_amount": 90000.0, "interval": "yearly", "currency": "USD"})
        assert salary.text == "$90,000/yr"

    def test_equal_bounds_render_once(self):
        salary = build_salary(
            {"min_amount": 90000.0, "max_amount": 90000.0, "interval": "yearly", "currency": "USD"}
        )
        assert salary.text == "$90,000/yr"

    def test_unknown_currency_is_prefixed_by_code(self):
        salary = build_salary({"min_amount": 50000.0, "interval": "yearly", "currency": "PLN"})
        assert salary.text == "PLN 50,000/yr"

    def test_absent_compensation_yields_no_text(self):
        salary = build_salary({"min_amount": np.nan, "max_amount": np.nan})
        assert salary.text is None
        assert salary.min_amount is None

    def test_missing_interval_omits_suffix(self):
        salary = build_salary({"min_amount": 1000.0, "currency": "USD"})
        assert salary.text == "$1,000"


class TestNormalizeFrame:
    def test_empty_frame(self):
        assert normalize_frame(pd.DataFrame()) == []

    def test_none_frame(self):
        assert normalize_frame(None) == []

    def test_skips_unusable_rows_but_keeps_the_rest(self):
        frame = pd.DataFrame([row(), row(title=None), row(job_url=None)])
        assert len(normalize_frame(frame)) == 1

    def test_nan_columns_do_not_leak(self):
        # A column absent for one board is NaN for every row once pandas builds
        # the frame; none of it may reach the JSON response.
        frame = pd.DataFrame([row(job_level=np.nan, company_industry=np.nan)])
        job = normalize_frame(frame)[0]
        assert job.job_level is None
        assert job.company_industry is None
