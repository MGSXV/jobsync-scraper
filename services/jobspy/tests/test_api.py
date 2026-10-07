from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


def frame(**overrides):
    base = {
        "site": "indeed",
        "title": "Backend Engineer",
        "company": "Acme",
        "job_url": "https://indeed.com/viewjob?jk=1",
        "location": "Remote",
        "description": "Work.",
    }
    base.update(overrides)
    return pd.DataFrame([base])


@pytest.fixture(autouse=True)
def no_auth(monkeypatch):
    monkeypatch.setattr(main, "AUTH_TOKEN", "")


def body(**overrides):
    payload = {"sites": ["indeed"], "search_term": "backend engineer"}
    payload.update(overrides)
    return payload


class TestHealth:
    def test_reports_ok(self):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


class TestAuth:
    def test_rejects_missing_token_when_configured(self, monkeypatch):
        monkeypatch.setattr(main, "AUTH_TOKEN", "s3cret")
        assert client.post("/scrape", json=body()).status_code == 401

    def test_rejects_wrong_token(self, monkeypatch):
        monkeypatch.setattr(main, "AUTH_TOKEN", "s3cret")
        res = client.post("/scrape", json=body(), headers={"X-JobSpy-Token": "nope"})
        assert res.status_code == 401

    def test_accepts_correct_token(self, monkeypatch):
        monkeypatch.setattr(main, "AUTH_TOKEN", "s3cret")
        monkeypatch.setattr(main, "_scrape_one_site", lambda site, req: frame())
        res = client.post("/scrape", json=body(), headers={"X-JobSpy-Token": "s3cret"})
        assert res.status_code == 200


class TestValidation:
    def test_requires_at_least_one_site(self):
        assert client.post("/scrape", json=body(sites=[])).status_code == 422

    def test_rejects_unknown_site(self):
        assert client.post("/scrape", json=body(sites=["monster"])).status_code == 422

    def test_caps_results_wanted(self):
        assert client.post("/scrape", json=body(results_wanted=5000)).status_code == 422

    def test_dedupes_repeated_sites(self, monkeypatch):
        calls: list[str] = []

        def fake(site, req):
            calls.append(site)
            return frame()

        monkeypatch.setattr(main, "_scrape_one_site", fake)
        res = client.post("/scrape", json=body(sites=["indeed", "indeed"]))
        assert res.status_code == 200
        assert calls == ["indeed"]


class TestScrape:
    def test_returns_normalized_jobs(self, monkeypatch):
        monkeypatch.setattr(main, "_scrape_one_site", lambda site, req: frame())
        res = client.post("/scrape", json=body())
        assert res.status_code == 200
        payload = res.json()
        assert len(payload["jobs"]) == 1
        assert payload["jobs"][0]["title"] == "Backend Engineer"
        assert payload["errors"] == []
        assert payload["elapsed_ms"] >= 0

    def test_one_failing_site_does_not_sink_the_others(self, monkeypatch):
        def fake(site, req):
            if site == "linkedin":
                raise RuntimeError("429 blocked")
            return frame(site=site)

        monkeypatch.setattr(main, "_scrape_one_site", fake)
        res = client.post("/scrape", json=body(sites=["indeed", "linkedin"]))
        assert res.status_code == 200
        payload = res.json()
        assert len(payload["jobs"]) == 1
        assert payload["errors"] == [{"token": "linkedin", "reason": "429 blocked"}]

    def test_empty_site_is_reported_as_an_error(self, monkeypatch):
        # The scrapers swallow their own failures, so "no results" is the only
        # signal a rate-limited board gives us.
        monkeypatch.setattr(main, "_scrape_one_site", lambda site, req: pd.DataFrame())
        res = client.post("/scrape", json=body())
        payload = res.json()
        assert payload["jobs"] == []
        assert payload["errors"] == [{"token": "indeed", "reason": "returned no results"}]

    def test_request_params_reach_the_library(self, monkeypatch):
        seen = {}

        def fake(site, req):
            seen["req"] = req
            return frame()

        monkeypatch.setattr(main, "_scrape_one_site", fake)
        client.post(
            "/scrape",
            json=body(
                location="Calgary, AB",
                hours_old=72,
                is_remote=True,
                job_type="fulltime",
                country_indeed="canada",
                fetch_description=False,
            ),
        )
        req = seen["req"]
        assert req.location == "Calgary, AB"
        assert req.hours_old == 72
        assert req.is_remote is True
        assert req.job_type == "fulltime"
        assert req.country_indeed == "canada"
        assert req.fetch_description is False

    def test_fetch_description_defaults_on(self, monkeypatch):
        seen = {}

        def fake(site, req):
            seen["req"] = req
            return frame()

        monkeypatch.setattr(main, "_scrape_one_site", fake)
        client.post("/scrape", json=body())
        assert seen["req"].fetch_description is True
